import * as vscode from 'vscode';
import { LLMService } from '../llm/LLMService';

export interface ProblemAnalysis {
    diagnostic: vscode.Diagnostic;
    file: string;
    analysis: DiagnosticAnalysis;
    solutions: ProblemSolution[];
    relatedProblems: vscode.Diagnostic[];
    confidence: number;
}

export interface DiagnosticAnalysis {
    category: 'syntax' | 'type' | 'logic' | 'style' | 'security' | 'performance' | 'other';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    cause: string;
    impact: string;
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedFixTime: string;
}

export interface ProblemSolution {
    id: string;
    title: string;
    description: string;
    type: 'quick_fix' | 'refactor' | 'configuration' | 'dependency' | 'manual';
    confidence: number;
    effort: 'low' | 'medium' | 'high';
    steps: SolutionStep[];
    codeChanges?: CodeChange[];
    risks: string[];
    benefits: string[];
    prerequisites?: string[];
}

export interface SolutionStep {
    order: number;
    title: string;
    description: string;
    action?: 'edit_file' | 'create_file' | 'delete_file' | 'run_command' | 'install_package';
    parameters?: { [key: string]: any };
    verification?: string;
}

export interface CodeChange {
    file: string;
    range: vscode.Range;
    oldText: string;
    newText: string;
    description: string;
}

export interface ProblemStatistics {
    totalProblems: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    hintCount: number;
    categoryCounts: { [category: string]: number };
    fileProblems: { [file: string]: number };
    topProblems: string[];
    trends: ProblemTrend[];
}

export interface ProblemTrend {
    date: Date;
    totalProblems: number;
    errorCount: number;
    warningCount: number;
}

export class VSCodeProblemViewer {
    private problemAnalyses: Map<string, ProblemAnalysis> = new Map();
    private problemHistory: ProblemTrend[] = [];
    private autoAnalyzeEnabled = true;
    private analysisInProgress = false;

    constructor(
        private context: vscode.ExtensionContext,
        private llmService: LLMService
    ) {
        this.setupDiagnosticListener();
        this.loadProblemHistory();
    }

    /**
     * 分析當前問題
     */
    async analyzeCurrentProblems(): Promise<ProblemAnalysis[]> {
        if (this.analysisInProgress) {
            vscode.window.showInformationMessage('問題分析正在進行中...');
            return [];
        }

        this.analysisInProgress = true;

        try {
            const diagnostics = vscode.languages.getDiagnostics();
            const analyses: ProblemAnalysis[] = [];

            for (const [uri, fileDiagnostics] of diagnostics) {
                for (const diagnostic of fileDiagnostics) {
                    const analysis = await this.analyzeProblem(uri.fsPath, diagnostic);
                    if (analysis) {
                        analyses.push(analysis);
                        this.problemAnalyses.set(this.getProblemKey(uri.fsPath, diagnostic), analysis);
                    }
                }
            }

            // 更新統計
            await this.updateProblemStatistics();

            return analyses;
        } finally {
            this.analysisInProgress = false;
        }
    }

    /**
     * 分析單個問題
     */
    async analyzeProblem(file: string, diagnostic: vscode.Diagnostic): Promise<ProblemAnalysis | null> {
        try {
            // 獲取文件內容和上下文
            const document = await vscode.workspace.openTextDocument(file);
            const problemLine = document.lineAt(diagnostic.range.start.line);
            const context = this.getCodeContext(document, diagnostic.range);

            // 使用 LLM 分析問題
            const analysis = await this.performLLMAnalysis(diagnostic, problemLine.text, context);

            // 生成解決方案
            const solutions = await this.generateSolutions(diagnostic, analysis, context);

            // 查找相關問題
            const relatedProblems = this.findRelatedProblems(file, diagnostic);

            return {
                diagnostic,
                file,
                analysis,
                solutions,
                relatedProblems,
                confidence: this.calculateConfidence(analysis, solutions)
            };
        } catch (error) {
            console.error('分析問題失敗:', error);
            return null;
        }
    }

    /**
     * 使用 LLM 分析問題
     */
    private async performLLMAnalysis(
        diagnostic: vscode.Diagnostic,
        problemLine: string,
        context: string
    ): Promise<DiagnosticAnalysis> {
        const prompt = `
分析以下代碼問題：

問題描述: ${diagnostic.message}
問題代碼: ${problemLine}
代碼上下文:
${context}

請提供詳細分析，包括：
1. 問題類別 (syntax/type/logic/style/security/performance/other)
2. 嚴重程度 (critical/high/medium/low)
3. 問題描述
4. 根本原因
5. 潛在影響
6. 修復複雜度 (simple/moderate/complex)
7. 預估修復時間

請以 JSON 格式回應。
        `;

        try {
            const llmResponse = await this.llmService.generateCompletion(prompt);
            const analysisData = JSON.parse(llmResponse.content);

            return {
                category: analysisData.category || 'other',
                severity: analysisData.severity || 'medium',
                description: analysisData.description || diagnostic.message,
                cause: analysisData.cause || '未知原因',
                impact: analysisData.impact || '可能影響代碼功能',
                complexity: analysisData.complexity || 'moderate',
                estimatedFixTime: analysisData.estimatedFixTime || '10-30 分鐘'
            };
        } catch (error) {
            // 回退到基本分析
            return this.performBasicAnalysis(diagnostic);
        }
    }

    /**
     * 基本問題分析
     */
    private performBasicAnalysis(diagnostic: vscode.Diagnostic): DiagnosticAnalysis {
        const category = this.categorizeProblem(diagnostic);
        const severity = this.mapSeverity(diagnostic.severity);

        return {
            category,
            severity,
            description: diagnostic.message,
            cause: '需要進一步分析',
            impact: '可能影響代碼品質',
            complexity: 'moderate',
            estimatedFixTime: '5-15 分鐘'
        };
    }

    /**
     * 生成解決方案
     */
    private async generateSolutions(
        diagnostic: vscode.Diagnostic,
        analysis: DiagnosticAnalysis,
        context: string
    ): Promise<ProblemSolution[]> {
        const solutions: ProblemSolution[] = [];

        // 嘗試獲取 VS Code 內建的快速修復
        const quickFixes = await this.getQuickFixes(diagnostic);
        solutions.push(...quickFixes);

        // 使用 LLM 生成自定義解決方案
        const customSolutions = await this.generateCustomSolutions(diagnostic, analysis, context);
        solutions.push(...customSolutions);

        return solutions.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * 獲取 VS Code 快速修復
     */
    private async getQuickFixes(diagnostic: vscode.Diagnostic): Promise<ProblemSolution[]> {
        // 這裡應該調用 VS Code 的 CodeAction API
        // 簡化實作
        return [];
    }

    /**
     * 生成自定義解決方案
     */
    private async generateCustomSolutions(
        diagnostic: vscode.Diagnostic,
        analysis: DiagnosticAnalysis,
        context: string
    ): Promise<ProblemSolution[]> {
        const prompt = `
為以下代碼問題生成解決方案：

問題: ${diagnostic.message}
分析: ${analysis.description}
原因: ${analysis.cause}
代碼上下文:
${context}

請提供 2-3 個解決方案，每個方案包括：
1. 標題和描述
2. 解決方案類型 (quick_fix/refactor/configuration/dependency/manual)
3. 信心度 (0-1)
4. 工作量 (low/medium/high)
5. 詳細步驟
6. 風險和好處

請以 JSON 格式回應。
        `;

        try {
            const llmResponse = await this.llmService.generateCompletion(prompt);
            const solutionsData = JSON.parse(llmResponse.content);

            return solutionsData.map((data: any, index: number) => ({
                id: `custom_${index}`,
                title: data.title || '自定義解決方案',
                description: data.description || '',
                type: data.type || 'manual',
                confidence: data.confidence || 0.5,
                effort: data.effort || 'medium',
                steps: data.steps || [],
                risks: data.risks || [],
                benefits: data.benefits || []
            }));
        } catch (error) {
            return [];
        }
    }

    /**
     * 應用解決方案
     */
    async applySolution(problemKey: string, solutionId: string): Promise<boolean> {
        const analysis = this.problemAnalyses.get(problemKey);
        if (!analysis) {
            vscode.window.showErrorMessage('找不到問題分析');
            return false;
        }

        const solution = analysis.solutions.find(s => s.id === solutionId);
        if (!solution) {
            vscode.window.showErrorMessage('找不到解決方案');
            return false;
        }

        try {
            // 執行解決方案步驟
            for (const step of solution.steps) {
                await this.executeStep(step);
            }

            // 應用代碼變更
            if (solution.codeChanges) {
                await this.applyCodeChanges(solution.codeChanges);
            }

            vscode.window.showInformationMessage(`解決方案 "${solution.title}" 已應用`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`應用解決方案失敗: ${error}`);
            return false;
        }
    }

    /**
     * 執行解決方案步驟
     */
    private async executeStep(step: SolutionStep): Promise<void> {
        switch (step.action) {
            case 'run_command':
                if (step.parameters?.command) {
                    await vscode.commands.executeCommand(step.parameters.command, ...(step.parameters.args || []));
                }
                break;
            case 'install_package':
                if (step.parameters?.package) {
                    const terminal = vscode.window.createTerminal('Devika Package Install');
                    terminal.sendText(`npm install ${step.parameters.package}`);
                    terminal.show();
                }
                break;
            // 其他動作類型...
        }
    }

    /**
     * 應用代碼變更
     */
    private async applyCodeChanges(changes: CodeChange[]): Promise<void> {
        const edit = new vscode.WorkspaceEdit();

        for (const change of changes) {
            const uri = vscode.Uri.file(change.file);
            edit.replace(uri, change.range, change.newText);
        }

        await vscode.workspace.applyEdit(edit);
    }

    /**
     * 顯示問題詳情
     */
    async showProblemDetails(problemKey: string): Promise<void> {
        const analysis = this.problemAnalyses.get(problemKey);
        if (!analysis) {
            vscode.window.showErrorMessage('找不到問題分析');
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'problemDetails',
            '問題詳情',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.generateProblemDetailsHTML(analysis);

        // 處理 webview 消息
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'applySolution':
                    await this.applySolution(problemKey, message.solutionId);
                    break;
                case 'refreshAnalysis':
                    const newAnalysis = await this.analyzeProblem(analysis.file, analysis.diagnostic);
                    if (newAnalysis) {
                        this.problemAnalyses.set(problemKey, newAnalysis);
                        panel.webview.html = this.generateProblemDetailsHTML(newAnalysis);
                    }
                    break;
            }
        });
    }

    /**
     * 生成問題詳情 HTML
     */
    private generateProblemDetailsHTML(analysis: ProblemAnalysis): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>問題詳情</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .problem-header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                .severity-${analysis.analysis.severity} { border-left: 4px solid; }
                .severity-critical { border-color: #d32f2f; }
                .severity-high { border-color: #f57c00; }
                .severity-medium { border-color: #fbc02d; }
                .severity-low { border-color: #388e3c; }
                .solution { background: #e8f5e8; padding: 15px; margin: 10px 0; border-radius: 5px; }
                .solution-header { font-weight: bold; margin-bottom: 10px; }
                .confidence { float: right; color: #666; }
                .steps { margin-top: 10px; }
                .step { margin: 5px 0; padding-left: 20px; }
                .apply-btn { background: #4CAF50; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
                .apply-btn:hover { background: #45a049; }
            </style>
        </head>
        <body>
            <div class="problem-header severity-${analysis.analysis.severity}">
                <h2>${analysis.diagnostic.message}</h2>
                <p><strong>文件:</strong> ${analysis.file}</p>
                <p><strong>行號:</strong> ${analysis.diagnostic.range.start.line + 1}</p>
                <p><strong>類別:</strong> ${analysis.analysis.category}</p>
                <p><strong>嚴重程度:</strong> ${analysis.analysis.severity}</p>
                <p><strong>預估修復時間:</strong> ${analysis.analysis.estimatedFixTime}</p>
            </div>

            <h3>問題分析</h3>
            <p><strong>描述:</strong> ${analysis.analysis.description}</p>
            <p><strong>原因:</strong> ${analysis.analysis.cause}</p>
            <p><strong>影響:</strong> ${analysis.analysis.impact}</p>

            <h3>解決方案</h3>
            ${analysis.solutions.map(solution => `
                <div class="solution">
                    <div class="solution-header">
                        ${solution.title}
                        <span class="confidence">信心度: ${Math.round(solution.confidence * 100)}%</span>
                    </div>
                    <p>${solution.description}</p>
                    <p><strong>工作量:</strong> ${solution.effort}</p>

                    ${solution.steps.length > 0 ? `
                        <div class="steps">
                            <strong>步驟:</strong>
                            ${solution.steps.map(step => `
                                <div class="step">${step.order}. ${step.title}</div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <button class="apply-btn" onclick="applySolution('${solution.id}')">
                        應用此解決方案
                    </button>
                </div>
            `).join('')}

            <script>
                const vscode = acquireVsCodeApi();

                function applySolution(solutionId) {
                    vscode.postMessage({
                        command: 'applySolution',
                        solutionId: solutionId
                    });
                }

                function refreshAnalysis() {
                    vscode.postMessage({
                        command: 'refreshAnalysis'
                    });
                }
            </script>
        </body>
        </html>
        `;
    }

    /**
     * 獲取問題統計
     */
    getProblemStatistics(): ProblemStatistics {
        const diagnostics = vscode.languages.getDiagnostics();
        let totalProblems = 0;
        let errorCount = 0;
        let warningCount = 0;
        let infoCount = 0;
        let hintCount = 0;
        const categoryCounts: { [category: string]: number } = {};
        const fileProblems: { [file: string]: number } = {};

        for (const [uri, fileDiagnostics] of diagnostics) {
            const fileName = uri.fsPath;
            fileProblems[fileName] = fileDiagnostics.length;
            totalProblems += fileDiagnostics.length;

            for (const diagnostic of fileDiagnostics) {
                switch (diagnostic.severity) {
                    case vscode.DiagnosticSeverity.Error:
                        errorCount++;
                        break;
                    case vscode.DiagnosticSeverity.Warning:
                        warningCount++;
                        break;
                    case vscode.DiagnosticSeverity.Information:
                        infoCount++;
                        break;
                    case vscode.DiagnosticSeverity.Hint:
                        hintCount++;
                        break;
                }

                const category = this.categorizeProblem(diagnostic);
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            }
        }

        // 獲取最常見的問題
        const topProblems = Object.entries(categoryCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([category]) => category);

        return {
            totalProblems,
            errorCount,
            warningCount,
            infoCount,
            hintCount,
            categoryCounts,
            fileProblems,
            topProblems,
            trends: this.problemHistory.slice(-30) // 最近30天的趨勢
        };
    }

    // 輔助方法
    private setupDiagnosticListener(): void {
        vscode.languages.onDidChangeDiagnostics(() => {
            if (this.autoAnalyzeEnabled) {
                // 延遲分析，避免頻繁觸發
                setTimeout(() => {
                    this.analyzeCurrentProblems();
                }, 1000);
            }
        });
    }

    private getProblemKey(file: string, diagnostic: vscode.Diagnostic): string {
        return `${file}:${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}`;
    }

    private getCodeContext(document: vscode.TextDocument, range: vscode.Range): string {
        const startLine = Math.max(0, range.start.line - 3);
        const endLine = Math.min(document.lineCount - 1, range.end.line + 3);

        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            const prefix = i === range.start.line ? '>>> ' : '    ';
            lines.push(`${prefix}${i + 1}: ${line.text}`);
        }

        return lines.join('\n');
    }

    private categorizeProblem(diagnostic: vscode.Diagnostic): 'syntax' | 'type' | 'logic' | 'style' | 'security' | 'performance' | 'other' {
        const message = diagnostic.message.toLowerCase();

        if (message.includes('syntax') || message.includes('parse')) {return 'syntax';}
        if (message.includes('type') || message.includes('cannot assign')) {return 'type';}
        if (message.includes('unused') || message.includes('unreachable')) {return 'style';}
        if (message.includes('security') || message.includes('vulnerable')) {return 'security';}
        if (message.includes('performance') || message.includes('slow')) {return 'performance';}

        return 'other';
    }

    private mapSeverity(severity: vscode.DiagnosticSeverity): 'critical' | 'high' | 'medium' | 'low' {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'critical';
            case vscode.DiagnosticSeverity.Warning:
                return 'high';
            case vscode.DiagnosticSeverity.Information:
                return 'medium';
            case vscode.DiagnosticSeverity.Hint:
                return 'low';
            default:
                return 'medium';
        }
    }

    private findRelatedProblems(file: string, diagnostic: vscode.Diagnostic): vscode.Diagnostic[] {
        const allDiagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(file));
        return allDiagnostics.filter(d =>
            d !== diagnostic &&
            Math.abs(d.range.start.line - diagnostic.range.start.line) <= 5
        );
    }

    private calculateConfidence(analysis: DiagnosticAnalysis, solutions: ProblemSolution[]): number {
        const avgSolutionConfidence = solutions.length > 0
            ? solutions.reduce((sum, s) => sum + s.confidence, 0) / solutions.length
            : 0.5;

        const complexityFactor = analysis.complexity === 'simple' ? 0.9 :
                               analysis.complexity === 'moderate' ? 0.7 : 0.5;

        return Math.min(0.95, avgSolutionConfidence * complexityFactor);
    }

    private async updateProblemStatistics(): Promise<void> {
        const stats = this.getProblemStatistics();
        const trend: ProblemTrend = {
            date: new Date(),
            totalProblems: stats.totalProblems,
            errorCount: stats.errorCount,
            warningCount: stats.warningCount
        };

        this.problemHistory.push(trend);

        // 保持最近100天的記錄
        if (this.problemHistory.length > 100) {
            this.problemHistory = this.problemHistory.slice(-100);
        }

        await this.saveProblemHistory();
    }

    private loadProblemHistory(): void {
        const history = this.context.globalState.get<any[]>('problemHistory', []);
        this.problemHistory = history.map(item => ({
            ...item,
            date: new Date(item.date)
        }));
    }

    private async saveProblemHistory(): Promise<void> {
        await this.context.globalState.update('problemHistory', this.problemHistory);
    }

    /**
     * 清理資源
     */
    dispose(): void {
        // 清理資源
    }
}
