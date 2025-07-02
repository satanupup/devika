import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';

export class PluginConfigUI {
    private configManager: ConfigManager;
    private panel: vscode.WebviewPanel | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.configManager = ConfigManager.getInstance();
    }

    async showConfigPanel(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'devikaConfig',
            'Devika 配置',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getConfigHtml();

        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'updateConfig':
                await this.updateConfig(message.config);
                break;
            case 'resetConfig':
                await this.resetConfig();
                break;
            case 'exportConfig':
                await this.exportConfig();
                break;
            case 'importConfig':
                await this.importConfig();
                break;
        }
    }

    private async updateConfig(config: any): Promise<void> {
        try {
            // API Keys
            if (config.openaiApiKey !== undefined) {
                this.configManager.setOpenAIApiKey(config.openaiApiKey);
            }
            if (config.claudeApiKey !== undefined) {
                this.configManager.setClaudeApiKey(config.claudeApiKey);
            }
            if (config.geminiApiKey !== undefined) {
                this.configManager.setGeminiApiKey(config.geminiApiKey);
            }

            // Chat settings
            if (config.chatAutoScroll !== undefined) {
                this.configManager.setChatAutoScroll(config.chatAutoScroll);
            }
            if (config.chatMaxHistory !== undefined) {
                this.configManager.setChatMaxHistory(config.chatMaxHistory);
            }

            // File exclusion settings
            if (config.fileExclusionEnabled !== undefined) {
                this.configManager.setFileExclusionEnabled(config.fileExclusionEnabled);
            }
            if (config.customExclusionPatterns !== undefined) {
                this.configManager.setCustomExclusionPatterns(config.customExclusionPatterns);
            }

            // Agent mode settings
            if (config.agentModeEnabled !== undefined) {
                this.configManager.setAgentModeEnabled(config.agentModeEnabled);
            }
            if (config.agentAutoApprove !== undefined) {
                this.configManager.setAgentAutoApprove(config.agentAutoApprove);
            }

            // Context settings
            if (config.contextMaxSnippets !== undefined) {
                this.configManager.setContextMaxSnippets(config.contextMaxSnippets);
            }
            if (config.contextAutoCleanup !== undefined) {
                this.configManager.setContextAutoCleanup(config.contextAutoCleanup);
            }

            vscode.window.showInformationMessage('配置已更新');

            // Refresh the panel
            if (this.panel) {
                this.panel.webview.html = this.getConfigHtml();
            }

        } catch (error) {
            vscode.window.showErrorMessage(`配置更新失败: ${error}`);
        }
    }

    private async resetConfig(): Promise<void> {
        const result = await vscode.window.showWarningMessage(
            '确定要重置所有配置吗？',
            { modal: true },
            '确定',
            '取消'
        );

        if (result === '确定') {
            // Reset to defaults by clearing configuration
            const config = vscode.workspace.getConfiguration('devika');
            await config.update('openaiApiKey', undefined, vscode.ConfigurationTarget.Global);
            await config.update('claudeApiKey', undefined, vscode.ConfigurationTarget.Global);
            await config.update('geminiApiKey', undefined, vscode.ConfigurationTarget.Global);

            vscode.window.showInformationMessage('配置已重置');

            if (this.panel) {
                this.panel.webview.html = this.getConfigHtml();
            }
        }
    }

    private async exportConfig(): Promise<void> {
        const config = {
            openaiApiKey: this.configManager.getOpenAIApiKey(),
            claudeApiKey: this.configManager.getClaudeApiKey(),
            geminiApiKey: this.configManager.getGeminiApiKey(),
            chatAutoScroll: this.configManager.getChatAutoScroll(),
            chatMaxHistory: this.configManager.getChatMaxHistory(),
            fileExclusionEnabled: this.configManager.getFileExclusionEnabled(),
            customExclusionPatterns: this.configManager.getCustomExclusionPatterns(),
            agentModeEnabled: this.configManager.getAgentModeEnabled(),
            agentAutoApprove: this.configManager.getAgentAutoApprove(),
            contextMaxSnippets: this.configManager.getContextMaxSnippets(),
            contextAutoCleanup: this.configManager.getContextAutoCleanup()
        };

        const configJson = JSON.stringify(config, null, 2);

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('devika-config.json'),
            filters: {
                'JSON files': ['json']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(configJson, 'utf8'));
            vscode.window.showInformationMessage('配置已导出');
        }
    }

    private async importConfig(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'JSON files': ['json']
            }
        });

        if (uris && uris.length > 0 && uris[0]) {
            try {
                const content = await vscode.workspace.fs.readFile(uris[0]);
                const config = JSON.parse(content.toString());

                await this.updateConfig(config);
                vscode.window.showInformationMessage('配置已导入');

            } catch (error) {
                vscode.window.showErrorMessage(`配置导入失败: ${error}`);
            }
        }
    }

    private getConfigHtml(): string {
        const config = {
            openaiApiKey: this.configManager.getOpenAIApiKey(),
            claudeApiKey: this.configManager.getClaudeApiKey(),
            geminiApiKey: this.configManager.getGeminiApiKey(),
            chatAutoScroll: this.configManager.getChatAutoScroll(),
            chatMaxHistory: this.configManager.getChatMaxHistory(),
            fileExclusionEnabled: this.configManager.getFileExclusionEnabled(),
            customExclusionPatterns: this.configManager.getCustomExclusionPatterns(),
            agentModeEnabled: this.configManager.getAgentModeEnabled(),
            agentAutoApprove: this.configManager.getAgentAutoApprove(),
            contextMaxSnippets: this.configManager.getContextMaxSnippets(),
            contextAutoCleanup: this.configManager.getContextAutoCleanup()
        };

        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Devika 配置</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .section {
                    margin-bottom: 30px;
                    padding: 20px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                }
                .section h3 {
                    margin-top: 0;
                    color: var(--vscode-textLink-foreground);
                }
                .form-group {
                    margin-bottom: 15px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                input, textarea, select {
                    width: 100%;
                    padding: 8px;
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    font-family: inherit;
                }
                input[type="checkbox"] {
                    width: auto;
                    margin-right: 8px;
                }
                .checkbox-group {
                    display: flex;
                    align-items: center;
                }
                .btn {
                    padding: 10px 20px;
                    margin-right: 10px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: inherit;
                }
                .btn-primary {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .actions {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
            </style>
        </head>
        <body>
            <h1>🤖 Devika AI 助理配置</h1>

            <div class="section">
                <h3>🔑 API 密钥配置</h3>
                <div class="form-group">
                    <label for="openaiApiKey">OpenAI API Key:</label>
                    <input type="password" id="openaiApiKey" value="${config.openaiApiKey}" placeholder="sk-...">
                </div>
                <div class="form-group">
                    <label for="claudeApiKey">Claude API Key:</label>
                    <input type="password" id="claudeApiKey" value="${config.claudeApiKey}" placeholder="sk-ant-...">
                </div>
                <div class="form-group">
                    <label for="geminiApiKey">Gemini API Key:</label>
                    <input type="password" id="geminiApiKey" value="${config.geminiApiKey}" placeholder="AI...">
                </div>
            </div>

            <div class="section">
                <h3>💬 聊天配置</h3>
                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="chatAutoScroll" ${config.chatAutoScroll ? 'checked' : ''}>
                        <label for="chatAutoScroll">自动滚动聊天消息</label>
                    </div>
                </div>
                <div class="form-group">
                    <label for="chatMaxHistory">最大聊天历史记录数:</label>
                    <input type="number" id="chatMaxHistory" value="${config.chatMaxHistory}" min="10" max="200">
                </div>
            </div>

            <div class="section">
                <h3>📁 文件排除配置</h3>
                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="fileExclusionEnabled" ${config.fileExclusionEnabled ? 'checked' : ''}>
                        <label for="fileExclusionEnabled">启用文件排除功能</label>
                    </div>
                </div>
                <div class="form-group">
                    <label for="customExclusionPatterns">自定义排除模式 (每行一个):</label>
                    <textarea id="customExclusionPatterns" rows="5" placeholder="*.log&#10;temp/**&#10;*.tmp">${config.customExclusionPatterns.join('\n')}</textarea>
                </div>
            </div>

            <div class="section">
                <h3>🤖 代理模式配置</h3>
                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="agentModeEnabled" ${config.agentModeEnabled ? 'checked' : ''}>
                        <label for="agentModeEnabled">启用代理模式</label>
                    </div>
                </div>
                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="agentAutoApprove" ${config.agentAutoApprove ? 'checked' : ''}>
                        <label for="agentAutoApprove">自动批准代理操作</label>
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>📋 上下文管理配置</h3>
                <div class="form-group">
                    <label for="contextMaxSnippets">最大代码片段数:</label>
                    <input type="number" id="contextMaxSnippets" value="${config.contextMaxSnippets}" min="5" max="100">
                </div>
                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="contextAutoCleanup" ${config.contextAutoCleanup ? 'checked' : ''}>
                        <label for="contextAutoCleanup">自动清理过期上下文</label>
                    </div>
                </div>
            </div>

            <div class="actions">
                <button class="btn btn-primary" onclick="saveConfig()">💾 保存配置</button>
                <button class="btn btn-secondary" onclick="resetConfig()">🔄 重置配置</button>
                <button class="btn btn-secondary" onclick="exportConfig()">📤 导出配置</button>
                <button class="btn btn-secondary" onclick="importConfig()">📥 导入配置</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function saveConfig() {
                    const config = {
                        openaiApiKey: document.getElementById('openaiApiKey').value,
                        claudeApiKey: document.getElementById('claudeApiKey').value,
                        geminiApiKey: document.getElementById('geminiApiKey').value,
                        chatAutoScroll: document.getElementById('chatAutoScroll').checked,
                        chatMaxHistory: parseInt(document.getElementById('chatMaxHistory').value),
                        fileExclusionEnabled: document.getElementById('fileExclusionEnabled').checked,
                        customExclusionPatterns: document.getElementById('customExclusionPatterns').value.split('\\n').filter(p => p.trim()),
                        agentModeEnabled: document.getElementById('agentModeEnabled').checked,
                        agentAutoApprove: document.getElementById('agentAutoApprove').checked,
                        contextMaxSnippets: parseInt(document.getElementById('contextMaxSnippets').value),
                        contextAutoCleanup: document.getElementById('contextAutoCleanup').checked
                    };

                    vscode.postMessage({
                        command: 'updateConfig',
                        config: config
                    });
                }

                function resetConfig() {
                    vscode.postMessage({ command: 'resetConfig' });
                }

                function exportConfig() {
                    vscode.postMessage({ command: 'exportConfig' });
                }

                function importConfig() {
                    vscode.postMessage({ command: 'importConfig' });
                }
            </script>
        </body>
        </html>
        `;
    }

    dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}
