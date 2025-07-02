import * as vscode from 'vscode';
import { ApiKey, createApiKey } from '../types/StrictTypes';
import { isNonEmptyString } from '../types/TypeGuards';
import { DevikaError, ErrorHandler, ErrorSeverity, ErrorType } from '../utils/ErrorHandler';
import { Logger } from '../utils/Logger';

export class ConfigManager {
    private static instance: ConfigManager;
    private config: vscode.WorkspaceConfiguration;
    private readonly errorHandler: ErrorHandler;
    private readonly logger: Logger;

    private constructor() {
        this.config = vscode.workspace.getConfiguration('devika');
        this.errorHandler = ErrorHandler.getInstance();
        this.logger = Logger.getInstance();

        // 監聽配置變更
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('devika')) {
                this.logger.info('ConfigManager', 'Configuration changed, reloading...');
                this.config = vscode.workspace.getConfiguration('devika');
            }
        });
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    // API 金鑰相關 - 使用類型安全的方法
    getOpenAIApiKey(): ApiKey | null {
        try {
            const key = this.config.get<string>('openaiApiKey', '');
            return isNonEmptyString(key) ? createApiKey(key) : null;
        } catch (error) {
            this.logger.error('ConfigManager', 'Failed to get OpenAI API key', error);
            return null;
        }
    }

    async setOpenAIApiKey(key: string): Promise<void> {
        try {
            if (!isNonEmptyString(key)) {
                throw new DevikaError(
                    'OpenAI API 金鑰不能為空',
                    ErrorType.VALIDATION,
                    ErrorSeverity.HIGH,
                    'INVALID_API_KEY'
                );
            }

            const apiKey = createApiKey(key);
            await this.config.update('openaiApiKey', apiKey, vscode.ConfigurationTarget.Global);
            this.logger.info('ConfigManager', 'OpenAI API key updated successfully');
        } catch (error) {
            const devikaError = error instanceof DevikaError ? error : new DevikaError(
                `設置 OpenAI API 金鑰失敗: ${error instanceof Error ? error.message : String(error)}`,
                ErrorType.CONFIGURATION,
                ErrorSeverity.HIGH,
                'SET_API_KEY_FAILED'
            );
            await this.errorHandler.handleError(devikaError);
            throw devikaError;
        }
    }

    getClaudeApiKey(): ApiKey | null {
        try {
            const key = this.config.get<string>('claudeApiKey', '');
            return isNonEmptyString(key) ? createApiKey(key) : null;
        } catch (error) {
            this.logger.error('ConfigManager', 'Failed to get Claude API key', error);
            return null;
        }
    }

    async setClaudeApiKey(key: string): Promise<void> {
        try {
            if (!isNonEmptyString(key)) {
                throw new DevikaError(
                    'Claude API 金鑰不能為空',
                    ErrorType.VALIDATION,
                    ErrorSeverity.HIGH,
                    'INVALID_API_KEY'
                );
            }

            const apiKey = createApiKey(key);
            await this.config.update('claudeApiKey', apiKey, vscode.ConfigurationTarget.Global);
            this.logger.info('ConfigManager', 'Claude API key updated successfully');
        } catch (error) {
            const devikaError = error instanceof DevikaError ? error : new DevikaError(
                `設置 Claude API 金鑰失敗: ${error instanceof Error ? error.message : String(error)}`,
                ErrorType.CONFIGURATION,
                ErrorSeverity.HIGH,
                'SET_API_KEY_FAILED'
            );
            await this.errorHandler.handleError(devikaError);
            throw devikaError;
        }
    }

    getGeminiApiKey(): ApiKey | null {
        try {
            const key = this.config.get<string>('geminiApiKey', '');
            return isNonEmptyString(key) ? createApiKey(key) : null;
        } catch (error) {
            this.logger.error('ConfigManager', 'Failed to get Gemini API key', error);
            return null;
        }
    }

    async setGeminiApiKey(key: string): Promise<void> {
        try {
            if (!isNonEmptyString(key)) {
                throw new DevikaError(
                    'Gemini API 金鑰不能為空',
                    ErrorType.VALIDATION,
                    ErrorSeverity.HIGH,
                    'INVALID_API_KEY'
                );
            }

            const apiKey = createApiKey(key);
            await this.config.update('geminiApiKey', apiKey, vscode.ConfigurationTarget.Global);
            this.logger.info('ConfigManager', 'Gemini API key updated successfully');
        } catch (error) {
            const devikaError = error instanceof DevikaError ? error : new DevikaError(
                `設置 Gemini API 金鑰失敗: ${error instanceof Error ? error.message : String(error)}`,
                ErrorType.CONFIGURATION,
                ErrorSeverity.HIGH,
                'SET_API_KEY_FAILED'
            );
            await this.errorHandler.handleError(devikaError);
            throw devikaError;
        }
    }

    // 模型設定
    getPreferredModel(): string {
        return this.config.get<string>('preferredModel', 'gemini-2.5-flash');
    }

    setPreferredModel(model: string): void {
        this.config.update('preferredModel', model, vscode.ConfigurationTarget.Workspace);
    }

    // 功能開關
    getAutoScanTodos(): boolean {
        return this.config.get<boolean>('autoScanTodos', true);
    }

    setAutoScanTodos(enabled: boolean): void {
        this.config.update('autoScanTodos', enabled, vscode.ConfigurationTarget.Workspace);
    }

    getEnableCodeIndexing(): boolean {
        return this.config.get<boolean>('enableCodeIndexing', true);
    }

    setEnableCodeIndexing(enabled: boolean): void {
        this.config.update('enableCodeIndexing', enabled, vscode.ConfigurationTarget.Workspace);
    }

    // 效能設定
    getMaxContextLines(): number {
        return this.config.get<number>('maxContextLines', 100);
    }

    setMaxContextLines(lines: number): void {
        this.config.update('maxContextLines', lines, vscode.ConfigurationTarget.Workspace);
    }

    // 驗證配置
    validateConfiguration(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 檢查是否至少有一個 API 金鑰
        const hasOpenAI = this.getOpenAIApiKey().length > 0;
        const hasClaude = this.getClaudeApiKey().length > 0;
        const hasGemini = this.getGeminiApiKey().length > 0;

        if (!hasOpenAI && !hasClaude && !hasGemini) {
            errors.push('請至少設定一個 AI 模型的 API 金鑰');
        }

        // 檢查偏好模型是否有對應的 API 金鑰
        const preferredModel = this.getPreferredModel();
        if (preferredModel.startsWith('gpt-') && !hasOpenAI) {
            errors.push('偏好模型為 GPT，但未設定 OpenAI API 金鑰');
        } else if (preferredModel.startsWith('claude-') && !hasClaude) {
            errors.push('偏好模型為 Claude，但未設定 Claude API 金鑰');
        } else if (preferredModel.startsWith('gemini-') && !hasGemini) {
            errors.push('偏好模型為 Gemini，但未設定 Gemini API 金鑰');
        }

        // 檢查數值設定
        const maxContextLines = this.getMaxContextLines();
        if (maxContextLines < 10 || maxContextLines > 1000) {
            errors.push('最大上下文行數應在 10-1000 之間');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // 取得所有配置的摘要
    getConfigurationSummary(): any {
        return {
            hasOpenAIKey: this.getOpenAIApiKey().length > 0,
            hasClaudeKey: this.getClaudeApiKey().length > 0,
            hasGeminiKey: this.getGeminiApiKey().length > 0,
            preferredModel: this.getPreferredModel(),
            autoScanTodos: this.getAutoScanTodos(),
            enableCodeIndexing: this.getEnableCodeIndexing(),
            maxContextLines: this.getMaxContextLines()
        };
    }

    // 重設為預設值
    resetToDefaults(): void {
        this.config.update('preferredModel', 'claude-3-sonnet', vscode.ConfigurationTarget.Workspace);
        this.config.update('autoScanTodos', true, vscode.ConfigurationTarget.Workspace);
        this.config.update('enableCodeIndexing', true, vscode.ConfigurationTarget.Workspace);
        this.config.update('maxContextLines', 100, vscode.ConfigurationTarget.Workspace);
    }

    // 匯出配置（不包含敏感資訊）
    exportConfiguration(): any {
        return {
            preferredModel: this.getPreferredModel(),
            autoScanTodos: this.getAutoScanTodos(),
            enableCodeIndexing: this.getEnableCodeIndexing(),
            maxContextLines: this.getMaxContextLines()
        };
    }

    // 匯入配置
    importConfiguration(config: any): void {
        if (config.preferredModel) {
            this.setPreferredModel(config.preferredModel);
        }
        if (typeof config.autoScanTodos === 'boolean') {
            this.setAutoScanTodos(config.autoScanTodos);
        }
        if (typeof config.enableCodeIndexing === 'boolean') {
            this.setEnableCodeIndexing(config.enableCodeIndexing);
        }
        if (typeof config.maxContextLines === 'number') {
            this.setMaxContextLines(config.maxContextLines);
        }
    }

    // 顯示配置設定介面
    async showConfigurationUI(): Promise<void> {
        const items = [
            {
                label: '$(key) 設定 API 金鑰',
                description: '設定 OpenAI、Claude 或 Gemini API 金鑰',
                action: 'apiKeys'
            },
            {
                label: '$(settings-gear) 模型設定',
                description: '選擇偏好的 AI 模型',
                action: 'model'
            },
            {
                label: '$(checklist) 功能開關',
                description: '啟用或停用特定功能',
                action: 'features'
            },
            {
                label: '$(dashboard) 效能設定',
                description: '調整效能相關參數',
                action: 'performance'
            },
            {
                label: '$(info) 檢視目前配置',
                description: '顯示目前的配置摘要',
                action: 'summary'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇要設定的項目'
        });

        if (selected) {
            await this.handleConfigurationAction(selected.action);
        }
    }

    private async handleConfigurationAction(action: string): Promise<void> {
        switch (action) {
            case 'apiKeys':
                await this.showApiKeyConfiguration();
                break;
            case 'model':
                await this.showModelConfiguration();
                break;
            case 'features':
                await this.showFeatureConfiguration();
                break;
            case 'performance':
                await this.showPerformanceConfiguration();
                break;
            case 'summary':
                await this.showConfigurationSummary();
                break;
        }
    }

    private async showApiKeyConfiguration(): Promise<void> {
        const providers = [
            { label: 'OpenAI', key: 'openai' },
            { label: 'Claude', key: 'claude' },
            { label: 'Gemini', key: 'gemini' }
        ];

        const selected = await vscode.window.showQuickPick(providers, {
            placeHolder: '選擇要設定的 API 提供商'
        });

        if (selected) {
            const apiKey = await vscode.window.showInputBox({
                prompt: `請輸入 ${selected.label} API 金鑰`,
                password: true,
                placeHolder: '輸入 API 金鑰...'
            });

            if (apiKey) {
                switch (selected.key) {
                    case 'openai':
                        this.setOpenAIApiKey(apiKey);
                        break;
                    case 'claude':
                        this.setClaudeApiKey(apiKey);
                        break;
                    case 'gemini':
                        this.setGeminiApiKey(apiKey);
                        break;
                }
                vscode.window.showInformationMessage(`${selected.label} API 金鑰已設定`);
            }
        }
    }

    private async showModelConfiguration(): Promise<void> {
        const models = [
            'gpt-4',
            'gpt-3.5-turbo',
            'claude-3-opus',
            'claude-3-sonnet',
            'gemini-pro'
        ];

        const selected = await vscode.window.showQuickPick(models, {
            placeHolder: '選擇偏好的 AI 模型'
        });

        if (selected) {
            this.setPreferredModel(selected);
            vscode.window.showInformationMessage(`偏好模型已設定為 ${selected}`);
        }
    }

    private async showFeatureConfiguration(): Promise<void> {
        // 實作功能開關設定
        vscode.window.showInformationMessage('功能設定介面開發中...');
    }

    private async showPerformanceConfiguration(): Promise<void> {
        // 實作效能設定
        vscode.window.showInformationMessage('效能設定介面開發中...');
    }

    private async showConfigurationSummary(): Promise<void> {
        const summary = this.getConfigurationSummary();
        const validation = this.validateConfiguration();

        let message = '目前配置摘要：\n\n';
        message += `偏好模型: ${summary.preferredModel}\n`;
        message += `OpenAI API: ${summary.hasOpenAIKey ? '已設定' : '未設定'}\n`;
        message += `Claude API: ${summary.hasClaudeKey ? '已設定' : '未設定'}\n`;
        message += `Gemini API: ${summary.hasGeminiKey ? '已設定' : '未設定'}\n`;
        message += `自動掃描 TODO: ${summary.autoScanTodos ? '啟用' : '停用'}\n`;
        message += `程式碼索引: ${summary.enableCodeIndexing ? '啟用' : '停用'}\n`;
        message += `最大上下文行數: ${summary.maxContextLines}\n`;

        if (!validation.isValid) {
            message += '\n⚠️ 配置問題：\n';
            message += validation.errors.join('\n');
        }

        vscode.window.showInformationMessage(message);
    }

    // 插件配置相关
    getPluginConfig(pluginId: string): any {
        return this.config.get<any>(`plugins.${pluginId}`, {});
    }

    setPluginConfig(pluginId: string, config: any): void {
        this.config.update(`plugins.${pluginId}`, config, vscode.ConfigurationTarget.Workspace);
    }

    getPluginEnabled(pluginId: string): boolean {
        return this.config.get<boolean>(`plugins.${pluginId}.enabled`, true);
    }

    setPluginEnabled(pluginId: string, enabled: boolean): void {
        this.config.update(`plugins.${pluginId}.enabled`, enabled, vscode.ConfigurationTarget.Workspace);
    }

    // 聊天配置
    getChatAutoScroll(): boolean {
        return this.config.get<boolean>('chat.autoScroll', true);
    }

    setChatAutoScroll(enabled: boolean): void {
        this.config.update('chat.autoScroll', enabled, vscode.ConfigurationTarget.Workspace);
    }

    getChatMaxHistory(): number {
        return this.config.get<number>('chat.maxHistory', 50);
    }

    setChatMaxHistory(count: number): void {
        this.config.update('chat.maxHistory', count, vscode.ConfigurationTarget.Workspace);
    }

    // 文件排除配置
    getFileExclusionEnabled(): boolean {
        return this.config.get<boolean>('fileExclusion.enabled', true);
    }

    setFileExclusionEnabled(enabled: boolean): void {
        this.config.update('fileExclusion.enabled', enabled, vscode.ConfigurationTarget.Workspace);
    }

    getCustomExclusionPatterns(): string[] {
        return this.config.get<string[]>('fileExclusion.customPatterns', []);
    }

    setCustomExclusionPatterns(patterns: string[]): void {
        this.config.update('fileExclusion.customPatterns', patterns, vscode.ConfigurationTarget.Workspace);
    }

    // 代理模式配置
    getAgentModeEnabled(): boolean {
        return this.config.get<boolean>('agentMode.enabled', false);
    }

    setAgentModeEnabled(enabled: boolean): void {
        this.config.update('agentMode.enabled', enabled, vscode.ConfigurationTarget.Workspace);
    }

    getAgentAutoApprove(): boolean {
        return this.config.get<boolean>('agentMode.autoApprove', false);
    }

    setAgentAutoApprove(enabled: boolean): void {
        this.config.update('agentMode.autoApprove', enabled, vscode.ConfigurationTarget.Workspace);
    }

    // 上下文管理配置
    getContextMaxSnippets(): number {
        return this.config.get<number>('context.maxSnippets', 20);
    }

    setContextMaxSnippets(count: number): void {
        this.config.update('context.maxSnippets', count, vscode.ConfigurationTarget.Workspace);
    }

    getContextAutoCleanup(): boolean {
        return this.config.get<boolean>('context.autoCleanup', true);
    }

    setContextAutoCleanup(enabled: boolean): void {
        this.config.update('context.autoCleanup', enabled, vscode.ConfigurationTarget.Workspace);
    }
}
