import * as vscode from 'vscode';
import { BaseAgent } from './agents/BaseAgent';
import { DocumentationAgent } from './agents/DocumentationAgent';
import { TaskDefinition, TaskContext, TaskResult } from './types';

export interface PluginDefinition {
    id: string;
    name: string;
    description: string;
    agent: string;
    category: string;
    inputs: any;
    steps: string[];
    estimatedTime?: string;
    tags: string[];
}

export class PluginManager {
    private agents: Map<string, BaseAgent> = new Map();
    private plugins: Map<string, PluginDefinition> = new Map();
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeAgents();
        this.loadBuiltinPlugins();
    }

    private initializeAgents(): void {
        // 註冊內建代理
        this.agents.set('DocumentationAgent', new DocumentationAgent());
        // 未來可以新增更多代理
        // this.agents.set('CodeAnalysisAgent', new CodeAnalysisAgent());
        // this.agents.set('RefactoringAgent', new RefactoringAgent());
    }

    private loadBuiltinPlugins(): void {
        // 載入內建插件定義
        const builtinPlugins: PluginDefinition[] = [
            {
                id: 'generate-contributing',
                name: '生成貢獻指南',
                description: '根據專案結構自動生成 CONTRIBUTING.md',
                agent: 'DocumentationAgent',
                category: 'documentation',
                inputs: {
                    outputPath: 'CONTRIBUTING.md'
                },
                steps: [
                    '分析專案結構',
                    '檢測開發工具',
                    '生成貢獻指南',
                    '寫入檔案'
                ],
                estimatedTime: '1-2 分鐘',
                tags: ['documentation', 'contributing', 'automation']
            },
            {
                id: 'generate-roadmap',
                name: '生成專案路線圖',
                description: '根據 README 和程式碼結構生成 ROADMAP.md',
                agent: 'DocumentationAgent',
                category: 'documentation',
                inputs: {
                    readmePath: 'README.md',
                    sourceDirs: ['src', 'packages'],
                    outputPath: 'ROADMAP.md'
                },
                steps: [
                    '讀取專案資訊',
                    '分析程式碼結構',
                    '生成路線圖',
                    '寫入檔案'
                ],
                estimatedTime: '2-3 分鐘',
                tags: ['documentation', 'roadmap', 'planning']
            },
            {
                id: 'generate-changelog',
                name: '生成變更日誌',
                description: '根據 Git 歷史生成 CHANGELOG.md',
                agent: 'DocumentationAgent',
                category: 'documentation',
                inputs: {
                    outputPath: 'CHANGELOG.md',
                    sinceVersion: 'latest'
                },
                steps: [
                    '分析 Git 歷史',
                    '分類變更類型',
                    '生成變更日誌',
                    '寫入檔案'
                ],
                estimatedTime: '1-2 分鐘',
                tags: ['documentation', 'changelog', 'git']
            }
        ];

        builtinPlugins.forEach(plugin => {
            this.plugins.set(plugin.id, plugin);
        });
    }

    async executePlugin(pluginId: string, customInputs?: any): Promise<TaskResult> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }

        const agent = this.agents.get(plugin.agent);
        if (!agent) {
            throw new Error(`Agent not found: ${plugin.agent}`);
        }

        // 建立任務上下文
        const taskContext: TaskContext = {
            plugin,
            inputs: { ...plugin.inputs, ...customInputs },
            fileSystem: this.createFileSystemInterface(),
            ui: this.createUIInterface(),
            project: this.createProjectInterface(),
            llmService: agent.getLLMService()
        };

        try {
            // 顯示進度
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `執行插件: ${plugin.name}`,
                cancellable: true
            }, async (progress, token) => {
                // 更新進度
                for (let i = 0; i < plugin.steps.length; i++) {
                    if (token.isCancellationRequested) {
                        throw new Error('使用者取消操作');
                    }

                    progress.report({
                        increment: (100 / plugin.steps.length),
                        message: plugin.steps[i]
                    });

                    // 模擬步驟執行時間
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // 執行實際任務
                return await agent.executeTask(pluginId, taskContext);
            });

        } catch (error) {
            return {
                success: false,
                message: `插件執行失敗: ${error}`,
                error: error as Error
            };
        }
    }

    getAvailablePlugins(): PluginDefinition[] {
        return Array.from(this.plugins.values());
    }

    getPluginsByCategory(category: string): PluginDefinition[] {
        return this.getAvailablePlugins().filter(plugin => plugin.category === category);
    }

    getPluginsByTag(tag: string): PluginDefinition[] {
        return this.getAvailablePlugins().filter(plugin => plugin.tags.includes(tag));
    }

    registerPlugin(plugin: PluginDefinition): void {
        this.plugins.set(plugin.id, plugin);
    }

    registerAgent(name: string, agent: BaseAgent): void {
        this.agents.set(name, agent);
    }

    private createFileSystemInterface() {
        return {
            async readFile(path: string): Promise<string> {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('沒有開啟的工作區');
                }

                const uri = vscode.Uri.joinPath(workspaceFolder.uri, path);
                try {
                    const content = await vscode.workspace.fs.readFile(uri);
                    return Buffer.from(content).toString('utf8');
                } catch (error) {
                    throw new Error(`無法讀取檔案 ${path}: ${error}`);
                }
            },

            async writeFile(path: string, content: string): Promise<void> {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('沒有開啟的工作區');
                }

                const uri = vscode.Uri.joinPath(workspaceFolder.uri, path);
                const contentBytes = Buffer.from(content, 'utf8');
                await vscode.workspace.fs.writeFile(uri, contentBytes);
            },

            async fileExists(path: string): Promise<boolean> {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    return false;
                }

                const uri = vscode.Uri.joinPath(workspaceFolder.uri, path);
                try {
                    await vscode.workspace.fs.stat(uri);
                    return true;
                } catch {
                    return false;
                }
            },

            async getProjectStructure(): Promise<string[]> {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    return [];
                }

                const files = await vscode.workspace.findFiles(
                    '**/*',
                    '**/node_modules/**'
                );

                return files.map(file =>
                    vscode.workspace.asRelativePath(file)
                );
            }
        };
    }

    private createUIInterface() {
        const getPreviewHtml = (fileName: string, content: string, message: string): string => {
            return `
            <!DOCTYPE html>
            <html lang="zh-TW">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>預覽: ${fileName}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 20px;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .header {
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    .content {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 20px;
                        border-radius: 4px;
                        margin-bottom: 20px;
                        white-space: pre-wrap;
                        font-family: 'Courier New', monospace;
                        max-height: 400px;
                        overflow-y: auto;
                    }
                    .actions {
                        display: flex;
                        gap: 10px;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .cancel {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>📄 ${fileName}</h2>
                    <p>${message}</p>
                </div>
                <div class="content">${content}</div>
                <div class="actions">
                    <button onclick="confirm()">✅ 確認建立</button>
                    <button class="cancel" onclick="cancel()">❌ 取消</button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    function confirm() {
                        vscode.postMessage({ command: 'confirm' });
                    }

                    function cancel() {
                        vscode.postMessage({ command: 'cancel' });
                    }
                </script>
            </body>
            </html>
            `;
        };

        return {
            async showPreview(fileName: string, content: string, message: string): Promise<boolean> {
                // 建立預覽面板
                const panel = vscode.window.createWebviewPanel(
                    'pluginPreview',
                    `預覽: ${fileName}`,
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = getPreviewHtml(fileName, content, message);

                return new Promise((resolve) => {
                    panel.webview.onDidReceiveMessage(
                        message => {
                            if (message.command === 'confirm') {
                                resolve(true);
                                panel.dispose();
                            } else if (message.command === 'cancel') {
                                resolve(false);
                                panel.dispose();
                            }
                        }
                    );

                    panel.onDidDispose(() => {
                        resolve(false);
                    });
                });
            },

            async showMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
                switch (type) {
                    case 'info':
                        vscode.window.showInformationMessage(message);
                        break;
                    case 'warning':
                        vscode.window.showWarningMessage(message);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message);
                        break;
                }
            }
        };
    }

    private createProjectInterface() {
        return {
            get primaryLanguage(): string {
                // 簡單的語言檢測邏輯
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    return 'unknown';
                }

                // 檢查常見的配置檔案
                const configFiles = [
                    { file: 'package.json', language: 'javascript' },
                    { file: 'tsconfig.json', language: 'typescript' },
                    { file: 'requirements.txt', language: 'python' },
                    { file: 'Cargo.toml', language: 'rust' },
                    { file: 'go.mod', language: 'go' }
                ];

                // 這裡應該實際檢查檔案存在性，簡化為返回 typescript
                return 'typescript';
            },

            get name(): string {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                return workspaceFolder?.name || 'Unknown Project';
            }
        };
    }

}
