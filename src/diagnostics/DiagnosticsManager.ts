import * as vscode from 'vscode';
import { DatabaseManager } from '../storage/DatabaseManager';
import { LLMService } from '../llm/LLMService';

export interface DiagnosticRecord {
    id: string;
    file_path: string;
    line: number;
    column?: number;
    severity: string;
    message: string;
    source?: string;
    code?: string;
    status: 'active' | 'resolved' | 'ignored';
    first_seen: string;
    last_seen: string;
    resolved_at?: string;
    metadata?: string;
}

export interface DiagnosticSummary {
    total: number;
    errors: number;
    warnings: number;
    information: number;
    hints: number;
    bySource: { [source: string]: number };
    byFile: { [file: string]: number };
}

export interface DiagnosticSolution {
    diagnostic: vscode.Diagnostic;
    solutions: string[];
    autoFixAvailable: boolean;
    confidence: number;
}

export class DiagnosticsManager {
    private diagnosticsCollection: Map<string, vscode.Diagnostic[]> = new Map();
    private onDidChangeDiagnosticsEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeDiagnostics = this.onDidChangeDiagnosticsEmitter.event;

    constructor(
        private dbManager: DatabaseManager,
        private llmService: LLMService,
        private context: vscode.ExtensionContext
    ) {
        this.initialize();
    }

    /**
     * 初始化診斷管理器
     */
    private initialize(): void {
        // 監聽診斷變更
        vscode.languages.onDidChangeDiagnostics(this.onDiagnosticsChanged, this, this.context.subscriptions);

        // 定期同步診斷到數據庫
        setInterval(() => {
            this.syncDiagnosticsToDatabase();
        }, 30000); // 每30秒同步一次
    }

    /**
     * 診斷變更處理
     */
    private async onDiagnosticsChanged(event: vscode.DiagnosticChangeEvent): Promise<void> {
        for (const uri of event.uris) {
            const diagnostics = vscode.languages.getDiagnostics(uri);
            this.diagnosticsCollection.set(uri.toString(), diagnostics);

            // 更新數據庫
            await this.updateDiagnosticsInDatabase(uri, diagnostics);
        }

        this.onDidChangeDiagnosticsEmitter.fire();
    }

    /**
     * 獲取所有診斷
     */
    getAllDiagnostics(): Map<string, vscode.Diagnostic[]> {
        const allDiagnostics = new Map<string, vscode.Diagnostic[]>();

        // 從 VS Code 獲取當前所有診斷
        for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
            if (diagnostics.length > 0) {
                allDiagnostics.set(uri.toString(), diagnostics);
            }
        }

        return allDiagnostics;
    }

    /**
     * 獲取指定文件的診斷
     */
    getDiagnosticsForFile(uri: vscode.Uri): vscode.Diagnostic[] {
        return vscode.languages.getDiagnostics(uri);
    }

    /**
     * 獲取診斷摘要
     */
    getDiagnosticsSummary(): DiagnosticSummary {
        const summary: DiagnosticSummary = {
            total: 0,
            errors: 0,
            warnings: 0,
            information: 0,
            hints: 0,
            bySource: {},
            byFile: {}
        };

        const allDiagnostics = this.getAllDiagnostics();

        for (const [uriString, diagnostics] of allDiagnostics) {
            const fileName = vscode.Uri.parse(uriString).fsPath;
            summary.byFile[fileName] = diagnostics.length;

            for (const diagnostic of diagnostics) {
                summary.total++;

                // 按嚴重程度統計
                switch (diagnostic.severity) {
                    case vscode.DiagnosticSeverity.Error:
                        summary.errors++;
                        break;
                    case vscode.DiagnosticSeverity.Warning:
                        summary.warnings++;
                        break;
                    case vscode.DiagnosticSeverity.Information:
                        summary.information++;
                        break;
                    case vscode.DiagnosticSeverity.Hint:
                        summary.hints++;
                        break;
                }

                // 按來源統計
                const source = diagnostic.source || 'unknown';
                summary.bySource[source] = (summary.bySource[source] || 0) + 1;
            }
        }

        return summary;
    }

    /**
     * 按嚴重程度過濾診斷
     */
    getDiagnosticsBySeverity(severity: vscode.DiagnosticSeverity): Array<{ uri: string; diagnostic: vscode.Diagnostic }> {
        const result: Array<{ uri: string; diagnostic: vscode.Diagnostic }> = [];
        const allDiagnostics = this.getAllDiagnostics();

        for (const [uriString, diagnostics] of allDiagnostics) {
            for (const diagnostic of diagnostics) {
                if (diagnostic.severity === severity) {
                    result.push({ uri: uriString, diagnostic });
                }
            }
        }

        return result;
    }

    /**
     * 按來源過濾診斷
     */
    getDiagnosticsBySource(source: string): Array<{ uri: string; diagnostic: vscode.Diagnostic }> {
        const result: Array<{ uri: string; diagnostic: vscode.Diagnostic }> = [];
        const allDiagnostics = this.getAllDiagnostics();

        for (const [uriString, diagnostics] of allDiagnostics) {
            for (const diagnostic of diagnostics) {
                if (diagnostic.source === source) {
                    result.push({ uri: uriString, diagnostic });
                }
            }
        }

        return result;
    }

    /**
     * 搜索診斷
     */
    searchDiagnostics(query: string): Array<{ uri: string; diagnostic: vscode.Diagnostic }> {
        const result: Array<{ uri: string; diagnostic: vscode.Diagnostic }> = [];
        const allDiagnostics = this.getAllDiagnostics();
        const lowerQuery = query.toLowerCase();

        for (const [uriString, diagnostics] of allDiagnostics) {
            for (const diagnostic of diagnostics) {
                if (diagnostic.message.toLowerCase().includes(lowerQuery) ||
                    diagnostic.source?.toLowerCase().includes(lowerQuery) ||
                    (typeof diagnostic.code === 'string' && diagnostic.code.toLowerCase().includes(lowerQuery))) {
                    result.push({ uri: uriString, diagnostic });
                }
            }
        }

        return result;
    }

    /**
     * 獲取 AI 解決方案
     */
    async getAISolutions(uri: vscode.Uri, diagnostic: vscode.Diagnostic): Promise<DiagnosticSolution> {
        try {
            // 獲取文件內容和上下文
            const document = await vscode.workspace.openTextDocument(uri);
            const line = document.lineAt(diagnostic.range.start.line);
            const contextStart = Math.max(0, diagnostic.range.start.line - 3);
            const contextEnd = Math.min(document.lineCount - 1, diagnostic.range.end.line + 3);
            const context = document.getText(new vscode.Range(contextStart, 0, contextEnd, 0));

            const prompt = `
分析以下代碼問題並提供解決方案：

文件: ${uri.fsPath}
問題: ${diagnostic.message}
來源: ${diagnostic.source || 'unknown'}
代碼: ${typeof diagnostic.code === 'string' ? diagnostic.code : 'N/A'}
嚴重程度: ${this.getSeverityText(diagnostic.severity)}

問題所在行:
${line.text}

上下文代碼:
\`\`\`
${context}
\`\`\`

請提供：
1. 問題的詳細分析
2. 具體的解決方案（最多3個）
3. 是否可以自動修復
4. 解決方案的可信度（1-10分）

請用中文回答。
            `;

            const response = await this.llmService.generateCompletion(prompt);

            // 解析 AI 回應
            const solutions = this.parseAISolutions(response.content);
            const autoFixAvailable = this.checkAutoFixAvailability(diagnostic);
            const confidence = this.calculateConfidence(diagnostic, solutions);

            return {
                diagnostic,
                solutions,
                autoFixAvailable,
                confidence
            };
        } catch (error) {
            console.error('獲取 AI 解決方案失敗:', error);
            return {
                diagnostic,
                solutions: ['無法獲取 AI 解決方案'],
                autoFixAvailable: false,
                confidence: 0
            };
        }
    }

    /**
     * 嘗試自動修復診斷
     */
    async attemptAutoFix(uri: vscode.Uri, diagnostic: vscode.Diagnostic): Promise<boolean> {
        try {
            // 獲取代碼操作
            const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
                'vscode.executeCodeActionProvider',
                uri,
                diagnostic.range,
                vscode.CodeActionKind.QuickFix
            );

            if (codeActions && codeActions.length > 0) {
                // 執行第一個可用的快速修復
                const action = codeActions[0];
                if (action.edit) {
                    const success = await vscode.workspace.applyEdit(action.edit);
                    if (success) {
                        await this.markDiagnosticAsResolved(uri, diagnostic);
                        return true;
                    }
                } else if (action.command) {
                    await vscode.commands.executeCommand(action.command.command, ...action.command.arguments || []);
                    await this.markDiagnosticAsResolved(uri, diagnostic);
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('自動修復失敗:', error);
            return false;
        }
    }

    /**
     * 標記診斷為已解決
     */
    async markDiagnosticAsResolved(uri: vscode.Uri, diagnostic: vscode.Diagnostic): Promise<void> {
        const diagnosticId = this.generateDiagnosticId(uri, diagnostic);

        await this.dbManager.run(`
            UPDATE diagnostics 
            SET status = 'resolved', resolved_at = ? 
            WHERE id = ?
        `, [new Date().toISOString(), diagnosticId]);
    }

    /**
     * 忽略診斷
     */
    async ignoreDiagnostic(uri: vscode.Uri, diagnostic: vscode.Diagnostic): Promise<void> {
        const diagnosticId = this.generateDiagnosticId(uri, diagnostic);

        await this.dbManager.run(`
            UPDATE diagnostics 
            SET status = 'ignored' 
            WHERE id = ?
        `, [diagnosticId]);
    }

    /**
     * 更新數據庫中的診斷
     */
    private async updateDiagnosticsInDatabase(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): Promise<void> {
        try {
            const filePath = uri.fsPath;
            const now = new Date().toISOString();

            // 標記該文件的所有診斷為已解決（如果它們不在當前診斷列表中）
            await this.dbManager.run(`
                UPDATE diagnostics 
                SET status = 'resolved', resolved_at = ? 
                WHERE file_path = ? AND status = 'active'
            `, [now, filePath]);

            // 插入或更新當前診斷
            for (const diagnostic of diagnostics) {
                const diagnosticId = this.generateDiagnosticId(uri, diagnostic);

                const existing = await this.dbManager.get(
                    'SELECT id FROM diagnostics WHERE id = ?',
                    [diagnosticId]
                );

                if (existing) {
                    // 更新現有診斷
                    await this.dbManager.run(`
                        UPDATE diagnostics 
                        SET last_seen = ?, status = 'active'
                        WHERE id = ?
                    `, [now, diagnosticId]);
                } else {
                    // 插入新診斷
                    await this.dbManager.run(`
                        INSERT INTO diagnostics (
                            id, file_path, line, column, severity, message, 
                            source, code, status, first_seen, last_seen
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        diagnosticId,
                        filePath,
                        diagnostic.range.start.line + 1,
                        diagnostic.range.start.character + 1,
                        this.getSeverityText(diagnostic.severity),
                        diagnostic.message,
                        diagnostic.source,
                        typeof diagnostic.code === 'string' ? diagnostic.code : null,
                        'active',
                        now,
                        now
                    ]);
                }
            }
        } catch (error) {
            console.error('更新診斷到數據庫失敗:', error);
        }
    }

    /**
     * 同步診斷到數據庫
     */
    private async syncDiagnosticsToDatabase(): Promise<void> {
        const allDiagnostics = this.getAllDiagnostics();

        for (const [uriString, diagnostics] of allDiagnostics) {
            const uri = vscode.Uri.parse(uriString);
            await this.updateDiagnosticsInDatabase(uri, diagnostics);
        }
    }

    /**
     * 生成診斷 ID
     */
    private generateDiagnosticId(uri: vscode.Uri, diagnostic: vscode.Diagnostic): string {
        const content = `${uri.fsPath}:${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}:${diagnostic.source}`;
        return Buffer.from(content).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    }

    /**
     * 獲取嚴重程度文本
     */
    private getSeverityText(severity: vscode.DiagnosticSeverity): string {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'error';
            case vscode.DiagnosticSeverity.Warning:
                return 'warning';
            case vscode.DiagnosticSeverity.Information:
                return 'information';
            case vscode.DiagnosticSeverity.Hint:
                return 'hint';
            default:
                return 'unknown';
        }
    }

    /**
     * 解析 AI 解決方案
     */
    private parseAISolutions(content: string): string[] {
        // 簡單的解析邏輯，可以根據需要改進
        const lines = content.split('\n');
        const solutions: string[] = [];

        let currentSolution = '';
        for (const line of lines) {
            if (line.match(/^\d+\./)) {
                if (currentSolution) {
                    solutions.push(currentSolution.trim());
                }
                currentSolution = line;
            } else if (currentSolution) {
                currentSolution += '\n' + line;
            }
        }

        if (currentSolution) {
            solutions.push(currentSolution.trim());
        }

        return solutions.length > 0 ? solutions : [content];
    }

    /**
     * 檢查是否可以自動修復
     */
    private checkAutoFixAvailability(diagnostic: vscode.Diagnostic): boolean {
        // 基於診斷來源和代碼判斷是否可能有自動修復
        const autoFixSources = ['typescript', 'javascript', 'eslint', 'tslint'];
        return diagnostic.source ? autoFixSources.includes(diagnostic.source.toLowerCase()) : false;
    }

    /**
     * 計算解決方案可信度
     */
    private calculateConfidence(diagnostic: vscode.Diagnostic, solutions: string[]): number {
        let confidence = 5; // 基礎分數

        // 根據診斷來源調整
        if (diagnostic.source) {
            const knownSources = ['typescript', 'javascript', 'eslint', 'python'];
            if (knownSources.includes(diagnostic.source.toLowerCase())) {
                confidence += 2;
            }
        }

        // 根據解決方案數量調整
        if (solutions.length > 1) {
            confidence += 1;
        }

        // 根據診斷嚴重程度調整
        if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
            confidence += 1;
        }

        return Math.min(10, confidence);
    }
}
