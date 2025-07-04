import * as vscode from 'vscode';

export interface ConfigTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    settings: { [key: string]: any };
    tags: string[];
    author?: string;
    version?: string;
}

export interface ConfigValidationRule {
    key: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
    validator?: (value: any) => boolean | string;
}

export interface ConfigExportData {
    version: string;
    timestamp: string;
    settings: { [key: string]: any };
    templates: ConfigTemplate[];
    metadata: {
        extensionVersion: string;
        vscodeVersion: string;
        platform: string;
    };
}

export class AdvancedConfigManager {
    private templates: Map<string, ConfigTemplate> = new Map();
    private validationRules: Map<string, ConfigValidationRule> = new Map();
    private readonly configPrefix = 'devika';

    constructor(private context: vscode.ExtensionContext) {
        this.initializeDefaultTemplates();
        this.setupValidationRules();
        this.loadTemplates();
    }

    private initializeDefaultTemplates(): void {
        // Beginner Template
        this.addTemplate({
            id: 'beginner',
            name: '初學者配置',
            description: '適合初次使用 Devika 的用戶，包含基本設置和安全選項',
            category: 'preset',
            tags: ['beginner', 'safe', 'basic'],
            settings: {
                'devika.defaultProvider': 'openai',
                'devika.defaultModel': 'gpt-3.5-turbo',
                'devika.agentMode.enabled': false,
                'devika.agentMode.autoApprove': false,
                'devika.chat.autoScroll': true,
                'devika.fileExclusion.enabled': true,
                'devika.context.maxSnippets': 10,
                'devika.analytics.enabled': true
            }
        });

        // Advanced Template
        this.addTemplate({
            id: 'advanced',
            name: '高級用戶配置',
            description: '適合有經驗的開發者，啟用所有高級功能',
            category: 'preset',
            tags: ['advanced', 'power-user', 'full-features'],
            settings: {
                'devika.defaultProvider': 'claude',
                'devika.defaultModel': 'claude-3-sonnet-20240229',
                'devika.agentMode.enabled': true,
                'devika.agentMode.autoApprove': false,
                'devika.chat.autoScroll': true,
                'devika.chat.maxHistory': 100,
                'devika.fileExclusion.enabled': true,
                'devika.context.maxSnippets': 50,
                'devika.context.autoCleanup': true,
                'devika.analytics.enabled': true,
                'devika.performance.largeProjectOptimization': true
            }
        });

        // Team Template
        this.addTemplate({
            id: 'team',
            name: '團隊協作配置',
            description: '適合團隊開發環境的配置',
            category: 'team',
            tags: ['team', 'collaboration', 'shared'],
            settings: {
                'devika.defaultProvider': 'openai',
                'devika.defaultModel': 'gpt-4',
                'devika.agentMode.enabled': true,
                'devika.agentMode.autoApprove': false,
                'devika.chat.autoScroll': true,
                'devika.fileExclusion.enabled': true,
                'devika.fileExclusion.customPatterns': ['*.log', 'node_modules/**', '.env*'],
                'devika.context.maxSnippets': 30,
                'devika.analytics.enabled': false, // Privacy for teams
                'devika.feedback.autoPrompt': false
            }
        });

        // Performance Template
        this.addTemplate({
            id: 'performance',
            name: '性能優化配置',
            description: '針對大型項目和性能優化的配置',
            category: 'optimization',
            tags: ['performance', 'large-projects', 'optimization'],
            settings: {
                'devika.defaultProvider': 'openai',
                'devika.defaultModel': 'gpt-3.5-turbo',
                'devika.agentMode.enabled': true,
                'devika.chat.maxHistory': 20,
                'devika.fileExclusion.enabled': true,
                'devika.context.maxSnippets': 15,
                'devika.context.autoCleanup': true,
                'devika.performance.largeProjectOptimization': true,
                'devika.performance.startupOptimization': true,
                'devika.performance.memoryOptimization': true
            }
        });
    }

    private setupValidationRules(): void {
        // Provider validation
        this.addValidationRule({
            key: 'devika.defaultProvider',
            type: 'string',
            required: true,
            enum: ['openai', 'claude', 'gemini']
        });

        // Model validation
        this.addValidationRule({
            key: 'devika.defaultModel',
            type: 'string',
            required: true,
            validator: (value: string) => {
                const validModels = [
                    'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo',
                    'claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229',
                    'gemini-pro', 'gemini-pro-vision'
                ];
                return validModels.includes(value) || '無效的模型名稱';
            }
        });

        // Numeric validations
        this.addValidationRule({
            key: 'devika.chat.maxHistory',
            type: 'number',
            min: 1,
            max: 1000
        });

        this.addValidationRule({
            key: 'devika.context.maxSnippets',
            type: 'number',
            min: 1,
            max: 100
        });

        // Array validations
        this.addValidationRule({
            key: 'devika.fileExclusion.customPatterns',
            type: 'array'
        });

        // Boolean validations
        this.addValidationRule({
            key: 'devika.agentMode.enabled',
            type: 'boolean'
        });

        this.addValidationRule({
            key: 'devika.agentMode.autoApprove',
            type: 'boolean'
        });
    }

    addTemplate(template: ConfigTemplate): void {
        this.templates.set(template.id, template);
        this.saveTemplates();
    }

    getTemplates(category?: string): ConfigTemplate[] {
        const templates = Array.from(this.templates.values());
        return category ? templates.filter(t => t.category === category) : templates;
    }

    getTemplate(id: string): ConfigTemplate | undefined {
        return this.templates.get(id);
    }

    async applyTemplate(templateId: string): Promise<boolean> {
        const template = this.templates.get(templateId);
        if (!template) {
            vscode.window.showErrorMessage(`找不到配置模板: ${templateId}`);
            return false;
        }

        try {
            const config = vscode.workspace.getConfiguration();

            for (const [key, value] of Object.entries(template.settings)) {
                await config.update(key, value, vscode.ConfigurationTarget.Global);
            }

            vscode.window.showInformationMessage(
                `已應用配置模板: ${template.name}`
            );
            return true;

        } catch (error) {
            vscode.window.showErrorMessage(`應用配置模板失敗: ${error}`);
            return false;
        }
    }

    async createCustomTemplate(
        name: string,
        description: string,
        category: string = 'custom'
    ): Promise<string | undefined> {
        const currentSettings = this.getCurrentSettings();

        const template: ConfigTemplate = {
            id: `custom_${Date.now()}`,
            name,
            description,
            category,
            settings: currentSettings,
            tags: ['custom', 'user-created'],
            author: 'user',
            version: '1.0.0'
        };

        this.addTemplate(template);

        vscode.window.showInformationMessage(
            `已創建自定義配置模板: ${name}`
        );

        return template.id;
    }

    private getCurrentSettings(): { [key: string]: any } {
        const config = vscode.workspace.getConfiguration(this.configPrefix);
        const settings: { [key: string]: any } = {};

        // Get all Devika-related settings
        const inspect = config.inspect('');
        if (inspect) {
            const allSettings = {
                ...(inspect.globalValue || {}),
                ...(inspect.workspaceValue || {})
            };
            for (const [key, value] of Object.entries(allSettings)) {
                settings[`${this.configPrefix}.${key}`] = value;
            }
        }

        return settings;
    }

    addValidationRule(rule: ConfigValidationRule): void {
        this.validationRules.set(rule.key, rule);
    }

    validateConfiguration(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        const config = vscode.workspace.getConfiguration();

        for (const [key, rule] of this.validationRules.entries()) {
            const value = config.get(key);

            // Check required
            if (rule.required && (value === undefined || value === null)) {
                errors.push(`必需的配置項 ${key} 未設置`);
                continue;
            }

            if (value !== undefined && value !== null) {
                // Type validation
                if (!this.validateType(value, rule.type)) {
                    errors.push(`配置項 ${key} 的類型不正確，期望 ${rule.type}`);
                    continue;
                }

                // Range validation for numbers
                if (rule.type === 'number' && typeof value === 'number') {
                    if (rule.min !== undefined && value < rule.min) {
                        errors.push(`配置項 ${key} 的值 ${value} 小於最小值 ${rule.min}`);
                    }
                    if (rule.max !== undefined && value > rule.max) {
                        errors.push(`配置項 ${key} 的值 ${value} 大於最大值 ${rule.max}`);
                    }
                }

                // Pattern validation for strings
                if (rule.type === 'string' && typeof value === 'string' && rule.pattern) {
                    const regex = new RegExp(rule.pattern);
                    if (!regex.test(value)) {
                        errors.push(`配置項 ${key} 的值不符合模式 ${rule.pattern}`);
                    }
                }

                // Enum validation
                if (rule.enum && !rule.enum.includes(value)) {
                    errors.push(`配置項 ${key} 的值必須是以下之一: ${rule.enum.join(', ')}`);
                }

                // Custom validator
                if (rule.validator) {
                    const result = rule.validator(value);
                    if (result !== true) {
                        errors.push(typeof result === 'string' ? result : `配置項 ${key} 驗證失敗`);
                    }
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private validateType(value: any, expectedType: string): boolean {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            default:
                return true;
        }
    }

    async exportConfiguration(): Promise<string | undefined> {
        try {
            const exportData: ConfigExportData = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                settings: this.getCurrentSettings(),
                templates: Array.from(this.templates.values()),
                metadata: {
                    extensionVersion: this.getExtensionVersion(),
                    vscodeVersion: vscode.version,
                    platform: process.platform
                }
            };

            const jsonString = JSON.stringify(exportData, null, 2);

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`devika-config-${Date.now()}.json`),
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonString, 'utf8'));
                vscode.window.showInformationMessage(`配置已導出到: ${uri.fsPath}`);
                return uri.fsPath;
            }

        } catch (error) {
            vscode.window.showErrorMessage(`導出配置失敗: ${error}`);
        }

        return undefined;
    }

    async importConfiguration(): Promise<boolean> {
        try {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                }
            });

            if (!uri || uri.length === 0) {
                return false;
            }

            const content = await vscode.workspace.fs.readFile(uri[0]);
            const importData: ConfigExportData = JSON.parse(Buffer.from(content).toString('utf8'));

            // Validate import data
            if (!importData.version || !importData.settings) {
                vscode.window.showErrorMessage('無效的配置文件格式');
                return false;
            }

            // Ask user what to import
            const options = ['設置', '模板', '全部'];
            const choice = await vscode.window.showQuickPick(options, {
                placeHolder: '選擇要導入的內容'
            });

            if (!choice) {return false;}

            const config = vscode.workspace.getConfiguration();

            if (choice === '設置' || choice === '全部') {
                for (const [key, value] of Object.entries(importData.settings)) {
                    await config.update(key, value, vscode.ConfigurationTarget.Global);
                }
            }

            if (choice === '模板' || choice === '全部') {
                for (const template of importData.templates) {
                    this.templates.set(template.id, template);
                }
                await this.saveTemplates();
            }

            vscode.window.showInformationMessage('配置導入成功');
            return true;

        } catch (error) {
            vscode.window.showErrorMessage(`導入配置失敗: ${error}`);
            return false;
        }
    }

    async showConfigurationEditor(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'configEditor',
            'Devika 配置編輯器',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getConfigEditorHtml();

        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'applyTemplate':
                        await this.applyTemplate(message.templateId);
                        break;
                    case 'validateConfig':
                        const validation = this.validateConfiguration();
                        panel.webview.postMessage({
                            command: 'validationResult',
                            result: validation
                        });
                        break;
                    case 'exportConfig':
                        await this.exportConfiguration();
                        break;
                    case 'importConfig':
                        await this.importConfiguration();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private getConfigEditorHtml(): string {
        const templates = this.getTemplates();
        const validation = this.validateConfiguration();

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Devika 配置編輯器</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .config-section {
                    margin-bottom: 30px;
                    padding: 20px;
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                }
                .template-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }
                .template-card {
                    padding: 15px;
                    background: var(--vscode-list-hoverBackground);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .template-card:hover {
                    background: var(--vscode-list-activeSelectionBackground);
                }
                .btn {
                    padding: 8px 16px;
                    margin: 5px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .validation-error {
                    color: var(--vscode-errorForeground);
                    margin: 5px 0;
                }
                .validation-success {
                    color: var(--vscode-terminal-ansiGreen);
                }
            </style>
        </head>
        <body>
            <h1>⚙️ Devika 配置編輯器</h1>
            
            <div class="config-section">
                <h2>📋 配置模板</h2>
                <p>選擇預設的配置模板快速設置 Devika</p>
                <div class="template-grid">
                    ${templates.map(template => `
                        <div class="template-card" onclick="applyTemplate('${template.id}')">
                            <h3>${template.name}</h3>
                            <p>${template.description}</p>
                            <div style="margin-top: 10px;">
                                ${template.tags.map(tag => `<span style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 5px;">${tag}</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="config-section">
                <h2>✅ 配置驗證</h2>
                <div id="validation-result">
                    ${validation.isValid
                        ? '<div class="validation-success">✅ 配置驗證通過</div>'
                        : `<div class="validation-error">❌ 發現 ${validation.errors.length} 個配置錯誤:</div>
                           ${validation.errors.map(error => `<div class="validation-error">• ${error}</div>`).join('')}`
                    }
                </div>
                <button class="btn" onclick="validateConfig()">重新驗證</button>
            </div>

            <div class="config-section">
                <h2>📤 導入/導出</h2>
                <p>備份和分享您的配置設置</p>
                <button class="btn" onclick="exportConfig()">導出配置</button>
                <button class="btn" onclick="importConfig()">導入配置</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function applyTemplate(templateId) {
                    vscode.postMessage({
                        command: 'applyTemplate',
                        templateId: templateId
                    });
                }

                function validateConfig() {
                    vscode.postMessage({
                        command: 'validateConfig'
                    });
                }

                function exportConfig() {
                    vscode.postMessage({
                        command: 'exportConfig'
                    });
                }

                function importConfig() {
                    vscode.postMessage({
                        command: 'importConfig'
                    });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'validationResult':
                            const result = message.result;
                            const resultDiv = document.getElementById('validation-result');
                            if (result.isValid) {
                                resultDiv.innerHTML = '<div class="validation-success">✅ 配置驗證通過</div>';
                            } else {
                                resultDiv.innerHTML = \`
                                    <div class="validation-error">❌ 發現 \${result.errors.length} 個配置錯誤:</div>
                                    \${result.errors.map(error => \`<div class="validation-error">• \${error}</div>\`).join('')}
                                \`;
                            }
                            break;
                    }
                });
            </script>
        </body>
        </html>
        `;
    }

    private getExtensionVersion(): string {
        const extension = vscode.extensions.getExtension('devika.vscode-extension');
        return extension?.packageJSON?.version || '0.0.0';
    }

    private async loadTemplates(): Promise<void> {
        try {
            const saved = this.context.globalState.get<ConfigTemplate[]>('configTemplates', []);
            for (const template of saved) {
                this.templates.set(template.id, template);
            }
        } catch (error) {
            console.warn('Failed to load config templates:', error);
        }
    }

    private async saveTemplates(): Promise<void> {
        try {
            const templates = Array.from(this.templates.values());
            await this.context.globalState.update('configTemplates', templates);
        } catch (error) {
            console.warn('Failed to save config templates:', error);
        }
    }
}
