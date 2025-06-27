import * as vscode from 'vscode';
import { DatabaseManager } from '../storage/DatabaseManager';

export interface Tool {
    name: string;
    description: string;
    parameters: ToolParameter[];
    requiresApproval: boolean;
    category: 'file' | 'terminal' | 'browser' | 'code' | 'interaction' | 'workspace';
    execute: (parameters: any, context: ToolContext) => Promise<any>;
}

export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    default?: any;
    enum?: string[];
}

export interface ToolContext {
    workspaceFolder?: vscode.WorkspaceFolder;
    activeEditor?: vscode.TextEditor;
    extensionContext: vscode.ExtensionContext;
    dbManager: DatabaseManager;
}

export interface ToolExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    metadata?: {
        executionTime: number;
        toolName: string;
        parameters: any;
    };
}

export class ToolManager {
    private tools: Map<string, Tool> = new Map();
    private executionHistory: Array<{
        toolName: string;
        parameters: any;
        result: ToolExecutionResult;
        timestamp: Date;
    }> = [];

    constructor(
        private context: vscode.ExtensionContext,
        private dbManager: DatabaseManager
    ) {
        this.registerBuiltinTools();
    }

    /**
     * 註冊內建工具
     */
    private registerBuiltinTools(): void {
        // 文件操作工具
        this.registerTool({
            name: 'read_file',
            description: '讀取指定文件的內容',
            category: 'file',
            requiresApproval: false,
            parameters: [
                {
                    name: 'path',
                    type: 'string',
                    description: '要讀取的文件路徑',
                    required: true
                }
            ],
            execute: async (params, context) => {
                const uri = vscode.Uri.file(params.path);
                const content = await vscode.workspace.fs.readFile(uri);
                return new TextDecoder().decode(content);
            }
        });

        this.registerTool({
            name: 'write_to_file',
            description: '寫入內容到指定文件',
            category: 'file',
            requiresApproval: true,
            parameters: [
                {
                    name: 'path',
                    type: 'string',
                    description: '要寫入的文件路徑',
                    required: true
                },
                {
                    name: 'content',
                    type: 'string',
                    description: '要寫入的內容',
                    required: true
                }
            ],
            execute: async (params, context) => {
                const uri = vscode.Uri.file(params.path);
                const content = new TextEncoder().encode(params.content);
                await vscode.workspace.fs.writeFile(uri, content);
                return { success: true, path: params.path };
            }
        });

        this.registerTool({
            name: 'list_files',
            description: '列出指定目錄下的文件',
            category: 'file',
            requiresApproval: false,
            parameters: [
                {
                    name: 'path',
                    type: 'string',
                    description: '要列出的目錄路徑',
                    required: false,
                    default: '.'
                },
                {
                    name: 'pattern',
                    type: 'string',
                    description: '文件匹配模式（glob）',
                    required: false,
                    default: '**/*'
                }
            ],
            execute: async (params, context) => {
                const workspaceFolder = context.workspaceFolder || vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('沒有打開的工作區');
                }

                const pattern = new vscode.RelativePattern(workspaceFolder, params.pattern);
                const files = await vscode.workspace.findFiles(pattern);
                
                return files.map(uri => ({
                    path: vscode.workspace.asRelativePath(uri),
                    fullPath: uri.fsPath
                }));
            }
        });

        this.registerTool({
            name: 'search_files',
            description: '在文件中搜索指定內容',
            category: 'file',
            requiresApproval: false,
            parameters: [
                {
                    name: 'query',
                    type: 'string',
                    description: '要搜索的內容',
                    required: true
                },
                {
                    name: 'include',
                    type: 'string',
                    description: '包含的文件模式',
                    required: false,
                    default: '**/*'
                },
                {
                    name: 'exclude',
                    type: 'string',
                    description: '排除的文件模式',
                    required: false
                }
            ],
            execute: async (params, context) => {
                const results = await vscode.workspace.findTextInFiles(
                    { pattern: params.query },
                    { include: params.include, exclude: params.exclude }
                );

                return Array.from(results.entries()).map(([uri, matches]) => ({
                    file: vscode.workspace.asRelativePath(uri),
                    matches: matches.map(match => ({
                        line: match.range.start.line + 1,
                        column: match.range.start.character + 1,
                        text: match.text,
                        preview: match.preview.text
                    }))
                }));
            }
        });

        // 終端執行工具
        this.registerTool({
            name: 'execute_command',
            description: '在終端中執行命令',
            category: 'terminal',
            requiresApproval: true,
            parameters: [
                {
                    name: 'command',
                    type: 'string',
                    description: '要執行的命令',
                    required: true
                },
                {
                    name: 'cwd',
                    type: 'string',
                    description: '工作目錄',
                    required: false
                }
            ],
            execute: async (params, context) => {
                return new Promise((resolve, reject) => {
                    const terminal = vscode.window.createTerminal({
                        name: 'Devika Command',
                        cwd: params.cwd || context.workspaceFolder?.uri.fsPath
                    });

                    terminal.show();
                    terminal.sendText(params.command);

                    // 簡化的結果返回
                    resolve({
                        success: true,
                        command: params.command,
                        terminal: terminal.name
                    });
                });
            }
        });

        // 代碼分析工具
        this.registerTool({
            name: 'list_code_definition_names',
            description: '列出文件中的代碼定義（函數、類、變量等）',
            category: 'code',
            requiresApproval: false,
            parameters: [
                {
                    name: 'path',
                    type: 'string',
                    description: '要分析的文件路徑',
                    required: true
                }
            ],
            execute: async (params, context) => {
                const uri = vscode.Uri.file(params.path);
                const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                    'vscode.executeDocumentSymbolProvider',
                    uri
                );

                const extractSymbols = (symbols: vscode.DocumentSymbol[]): any[] => {
                    const result: any[] = [];
                    for (const symbol of symbols) {
                        result.push({
                            name: symbol.name,
                            kind: vscode.SymbolKind[symbol.kind],
                            range: {
                                start: { line: symbol.range.start.line, character: symbol.range.start.character },
                                end: { line: symbol.range.end.line, character: symbol.range.end.character }
                            }
                        });

                        if (symbol.children) {
                            result.push(...extractSymbols(symbol.children));
                        }
                    }
                    return result;
                };

                return symbols ? extractSymbols(symbols) : [];
            }
        });

        this.registerTool({
            name: 'apply_diff',
            description: '應用代碼差異到文件',
            category: 'code',
            requiresApproval: true,
            parameters: [
                {
                    name: 'path',
                    type: 'string',
                    description: '要修改的文件路徑',
                    required: true
                },
                {
                    name: 'diff',
                    type: 'string',
                    description: '要應用的差異（unified diff 格式）',
                    required: true
                }
            ],
            execute: async (params, context) => {
                // 簡化的 diff 應用實作
                const uri = vscode.Uri.file(params.path);
                const document = await vscode.workspace.openTextDocument(uri);
                
                // 這裡應該實作完整的 diff 解析和應用邏輯
                // 暫時返回成功狀態
                return {
                    success: true,
                    path: params.path,
                    message: 'Diff 應用功能開發中'
                };
            }
        });

        // 交互工具
        this.registerTool({
            name: 'ask_followup_question',
            description: '向用戶提出後續問題',
            category: 'interaction',
            requiresApproval: false,
            parameters: [
                {
                    name: 'question',
                    type: 'string',
                    description: '要問的問題',
                    required: true
                },
                {
                    name: 'options',
                    type: 'array',
                    description: '可選的回答選項',
                    required: false
                }
            ],
            execute: async (params, context) => {
                let response: string | undefined;

                if (params.options && params.options.length > 0) {
                    response = await vscode.window.showQuickPick(params.options, {
                        placeHolder: params.question
                    });
                } else {
                    response = await vscode.window.showInputBox({
                        prompt: params.question
                    });
                }

                return {
                    question: params.question,
                    response: response || null
                };
            }
        });

        this.registerTool({
            name: 'attempt_completion',
            description: '嘗試完成當前任務',
            category: 'interaction',
            requiresApproval: false,
            parameters: [
                {
                    name: 'result',
                    type: 'string',
                    description: '任務完成的結果描述',
                    required: true
                }
            ],
            execute: async (params, context) => {
                vscode.window.showInformationMessage(`任務完成: ${params.result}`);
                return {
                    completed: true,
                    result: params.result
                };
            }
        });

        // 工作區工具
        this.registerTool({
            name: 'new_task',
            description: '創建新的任務',
            category: 'workspace',
            requiresApproval: false,
            parameters: [
                {
                    name: 'title',
                    type: 'string',
                    description: '任務標題',
                    required: true
                },
                {
                    name: 'description',
                    type: 'string',
                    description: '任務描述',
                    required: true
                },
                {
                    name: 'type',
                    type: 'string',
                    description: '任務類型',
                    required: false,
                    enum: ['analysis', 'refactor', 'test', 'todo', 'fix', 'feature', 'documentation', 'deployment']
                }
            ],
            execute: async (params, context) => {
                // 這裡會調用 TaskManager 創建新任務
                // 暫時返回模擬結果
                return {
                    success: true,
                    taskId: Date.now().toString(),
                    title: params.title,
                    description: params.description
                };
            }
        });

        this.registerTool({
            name: 'switch_mode',
            description: '切換 AI 助手模式',
            category: 'workspace',
            requiresApproval: false,
            parameters: [
                {
                    name: 'mode',
                    type: 'string',
                    description: '要切換到的模式',
                    required: true,
                    enum: ['code', 'architect', 'ask', 'debug', 'custom']
                }
            ],
            execute: async (params, context) => {
                // 這裡會調用 ModeManager 切換模式
                return {
                    success: true,
                    previousMode: 'code', // 暫時硬編碼
                    newMode: params.mode
                };
            }
        });

        // 瀏覽器控制工具（基礎實作）
        this.registerTool({
            name: 'browser_action',
            description: '執行瀏覽器操作',
            category: 'browser',
            requiresApproval: true,
            parameters: [
                {
                    name: 'action',
                    type: 'string',
                    description: '要執行的操作',
                    required: true,
                    enum: ['open', 'navigate', 'click', 'type', 'screenshot']
                },
                {
                    name: 'url',
                    type: 'string',
                    description: 'URL 地址（用於 open 和 navigate）',
                    required: false
                },
                {
                    name: 'selector',
                    type: 'string',
                    description: 'CSS 選擇器（用於 click 和 type）',
                    required: false
                },
                {
                    name: 'text',
                    type: 'string',
                    description: '要輸入的文本（用於 type）',
                    required: false
                }
            ],
            execute: async (params, context) => {
                // 基礎的瀏覽器操作實作
                switch (params.action) {
                    case 'open':
                        if (params.url) {
                            await vscode.env.openExternal(vscode.Uri.parse(params.url));
                            return { success: true, action: 'open', url: params.url };
                        }
                        break;
                    default:
                        return { success: false, error: '瀏覽器操作功能開發中' };
                }
                
                return { success: false, error: '無效的瀏覽器操作' };
            }
        });
    }

    /**
     * 註冊工具
     */
    registerTool(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    /**
     * 獲取工具
     */
    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * 獲取所有工具
     */
    getAllTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * 按類別獲取工具
     */
    getToolsByCategory(category: Tool['category']): Tool[] {
        return Array.from(this.tools.values()).filter(tool => tool.category === category);
    }

    /**
     * 執行工具
     */
    async executeTool(name: string, parameters: any): Promise<ToolExecutionResult> {
        const startTime = Date.now();
        const tool = this.tools.get(name);

        if (!tool) {
            return {
                success: false,
                error: `工具 "${name}" 不存在`,
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: name,
                    parameters
                }
            };
        }

        try {
            // 驗證參數
            const validationError = this.validateParameters(tool, parameters);
            if (validationError) {
                return {
                    success: false,
                    error: validationError,
                    metadata: {
                        executionTime: Date.now() - startTime,
                        toolName: name,
                        parameters
                    }
                };
            }

            // 構建執行上下文
            const context: ToolContext = {
                workspaceFolder: vscode.workspace.workspaceFolders?.[0],
                activeEditor: vscode.window.activeTextEditor,
                extensionContext: this.context,
                dbManager: this.dbManager
            };

            // 執行工具
            const result = await tool.execute(parameters, context);

            const executionResult: ToolExecutionResult = {
                success: true,
                result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: name,
                    parameters
                }
            };

            // 記錄執行歷史
            this.executionHistory.push({
                toolName: name,
                parameters,
                result: executionResult,
                timestamp: new Date()
            });

            // 記錄到數據庫
            await this.logToolExecution(name, parameters, executionResult);

            return executionResult;

        } catch (error) {
            const executionResult: ToolExecutionResult = {
                success: false,
                error: String(error),
                metadata: {
                    executionTime: Date.now() - startTime,
                    toolName: name,
                    parameters
                }
            };

            // 記錄錯誤
            this.executionHistory.push({
                toolName: name,
                parameters,
                result: executionResult,
                timestamp: new Date()
            });

            await this.logToolExecution(name, parameters, executionResult);

            return executionResult;
        }
    }

    /**
     * 驗證工具參數
     */
    private validateParameters(tool: Tool, parameters: any): string | null {
        for (const param of tool.parameters) {
            if (param.required && (parameters[param.name] === undefined || parameters[param.name] === null)) {
                return `缺少必需參數: ${param.name}`;
            }

            if (parameters[param.name] !== undefined) {
                const value = parameters[param.name];
                
                // 類型檢查
                switch (param.type) {
                    case 'string':
                        if (typeof value !== 'string') {
                            return `參數 ${param.name} 必須是字符串`;
                        }
                        break;
                    case 'number':
                        if (typeof value !== 'number') {
                            return `參數 ${param.name} 必須是數字`;
                        }
                        break;
                    case 'boolean':
                        if (typeof value !== 'boolean') {
                            return `參數 ${param.name} 必須是布爾值`;
                        }
                        break;
                    case 'array':
                        if (!Array.isArray(value)) {
                            return `參數 ${param.name} 必須是數組`;
                        }
                        break;
                    case 'object':
                        if (typeof value !== 'object' || Array.isArray(value)) {
                            return `參數 ${param.name} 必須是對象`;
                        }
                        break;
                }

                // 枚舉檢查
                if (param.enum && !param.enum.includes(value)) {
                    return `參數 ${param.name} 必須是以下值之一: ${param.enum.join(', ')}`;
                }
            }
        }

        return null;
    }

    /**
     * 記錄工具執行到數據庫
     */
    private async logToolExecution(toolName: string, parameters: any, result: ToolExecutionResult): Promise<void> {
        try {
            await this.dbManager.run(`
                INSERT INTO ai_operation_logs (
                    id, operation_type, api_endpoint_id, operation_details,
                    parameters, result, success, error_message, execution_time,
                    user_context, timestamp, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                Date.now().toString(36) + Math.random().toString(36).substr(2),
                'tool_execution',
                null,
                JSON.stringify({ toolName }),
                JSON.stringify(parameters),
                JSON.stringify(result.result),
                result.success ? 1 : 0,
                result.error,
                result.metadata?.executionTime,
                JSON.stringify({
                    workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                    activeFile: vscode.window.activeTextEditor?.document.fileName
                }),
                new Date().toISOString(),
                JSON.stringify(result.metadata)
            ]);
        } catch (error) {
            console.error('記錄工具執行失敗:', error);
        }
    }

    /**
     * 獲取執行歷史
     */
    getExecutionHistory(): Array<{
        toolName: string;
        parameters: any;
        result: ToolExecutionResult;
        timestamp: Date;
    }> {
        return [...this.executionHistory];
    }

    /**
     * 清除執行歷史
     */
    clearExecutionHistory(): void {
        this.executionHistory = [];
    }

    /**
     * 獲取工具使用統計
     */
    getToolUsageStats(): { [toolName: string]: number } {
        const stats: { [toolName: string]: number } = {};
        
        for (const entry of this.executionHistory) {
            stats[entry.toolName] = (stats[entry.toolName] || 0) + 1;
        }

        return stats;
    }
}
