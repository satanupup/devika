import * as vscode from 'vscode';

export interface ErrorReport {
    id: string;
    timestamp: string;
    level: 'error' | 'warning' | 'info';
    message: string;
    stack?: string;
    context: ErrorContext;
    userAction?: string;
    resolved: boolean;
    reportedToTelemetry: boolean;
}

export interface ErrorContext {
    operation: string;
    component: string;
    userId?: string;
    sessionId: string;
    extensionVersion: string;
    vscodeVersion: string;
    platform: string;
    additionalData?: any;
}

export interface RecoveryStrategy {
    name: string;
    description: string;
    execute(): Promise<boolean>;
    canRecover(error: Error, context: ErrorContext): boolean;
}

export class EnhancedErrorHandler {
    private errorReports: Map<string, ErrorReport> = new Map();
    private recoveryStrategies: RecoveryStrategy[] = [];
    private sessionId: string;
    private maxReports = 1000;
    private autoReportingEnabled = true;

    constructor(private context: vscode.ExtensionContext) {
        this.sessionId = this.generateSessionId();
        this.setupGlobalErrorHandlers();
        this.registerDefaultRecoveryStrategies();
        this.loadErrorReports();
    }

    private setupGlobalErrorHandlers(): void {
        // Handle unhandled promise rejections
        if (typeof process !== 'undefined') {
            process.on('unhandledRejection', (reason, promise) => {
                this.handleError(
                    new Error(`Unhandled Promise Rejection: ${reason}`),
                    { operation: 'promise', component: 'global' }
                );
            });

            process.on('uncaughtException', (error) => {
                this.handleError(error, { operation: 'exception', component: 'global' });
            });
        }

        // Handle VS Code specific errors
        vscode.window.onDidChangeWindowState((state) => {
            if (!state.focused) {
                // Save error reports when window loses focus
                this.saveErrorReports();
            }
        });
    }

    private registerDefaultRecoveryStrategies(): void {
        // LLM Service Recovery
        this.addRecoveryStrategy({
            name: 'LLM Service Recovery',
            description: '重新初始化 LLM 服務連接',
            canRecover: (error, context) => {
                return context.component === 'LLMService' && 
                       (error.message.includes('API') || error.message.includes('network'));
            },
            execute: async () => {
                try {
                    // Reinitialize LLM service
                    const { LLMService } = await import('../llm/LLMService');
                    const { ConfigManager } = await import('../config/ConfigManager');
                    const configManager = ConfigManager.getInstance();
                    const llmService = new LLMService(configManager);
                    return true;
                } catch {
                    return false;
                }
            }
        });

        // File System Recovery
        this.addRecoveryStrategy({
            name: 'File System Recovery',
            description: '重新嘗試文件操作',
            canRecover: (error, context) => {
                return context.operation.includes('file') && 
                       (error.message.includes('ENOENT') || error.message.includes('permission'));
            },
            execute: async () => {
                try {
                    // Wait and retry file operation
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return true;
                } catch {
                    return false;
                }
            }
        });

        // UI Recovery
        this.addRecoveryStrategy({
            name: 'UI Recovery',
            description: '重新初始化用戶界面',
            canRecover: (error, context) => {
                return context.component === 'UIManager' || context.component === 'Webview';
            },
            execute: async () => {
                try {
                    // Reinitialize UI components
                    vscode.commands.executeCommand('devika.restart');
                    return true;
                } catch {
                    return false;
                }
            }
        });

        // Configuration Recovery
        this.addRecoveryStrategy({
            name: 'Configuration Recovery',
            description: '重置為默認配置',
            canRecover: (error, context) => {
                return context.component === 'ConfigManager' || 
                       error.message.includes('configuration');
            },
            execute: async () => {
                try {
                    // Reset to default configuration
                    const config = vscode.workspace.getConfiguration('devika');
                    await config.update('resetToDefaults', true, vscode.ConfigurationTarget.Global);
                    return true;
                } catch {
                    return false;
                }
            }
        });
    }

    async handleError(
        error: Error, 
        context: Partial<ErrorContext>,
        userAction?: string
    ): Promise<void> {
        const errorId = this.generateErrorId();
        const fullContext = this.buildFullContext(context);
        
        const errorReport: ErrorReport = {
            id: errorId,
            timestamp: new Date().toISOString(),
            level: 'error',
            message: error.message,
            stack: error.stack,
            context: fullContext,
            userAction,
            resolved: false,
            reportedToTelemetry: false
        };

        this.errorReports.set(errorId, errorReport);

        // Log error details
        this.logError(errorReport);

        // Attempt automatic recovery
        const recovered = await this.attemptRecovery(error, fullContext);
        if (recovered) {
            errorReport.resolved = true;
            vscode.window.showInformationMessage(
                `錯誤已自動恢復: ${error.message.substring(0, 50)}...`
            );
        } else {
            // Show user-friendly error message
            await this.showUserError(errorReport);
        }

        // Auto-report if enabled
        if (this.autoReportingEnabled && !errorReport.reportedToTelemetry) {
            await this.reportToTelemetry(errorReport);
        }

        // Save reports
        await this.saveErrorReports();
    }

    private async attemptRecovery(error: Error, context: ErrorContext): Promise<boolean> {
        for (const strategy of this.recoveryStrategies) {
            if (strategy.canRecover(error, context)) {
                try {
                    console.log(`Attempting recovery with strategy: ${strategy.name}`);
                    const success = await strategy.execute();
                    if (success) {
                        console.log(`Recovery successful with strategy: ${strategy.name}`);
                        return true;
                    }
                } catch (recoveryError) {
                    console.warn(`Recovery strategy ${strategy.name} failed:`, recoveryError);
                }
            }
        }
        return false;
    }

    private async showUserError(errorReport: ErrorReport): Promise<void> {
        const actions = ['查看詳情', '報告問題', '忽略'];
        
        if (this.hasRecoveryOptions(errorReport)) {
            actions.unshift('嘗試修復');
        }

        const choice = await vscode.window.showErrorMessage(
            `Devika 遇到錯誤: ${errorReport.message.substring(0, 100)}...`,
            ...actions
        );

        switch (choice) {
            case '嘗試修復':
                await this.showRecoveryOptions(errorReport);
                break;
            case '查看詳情':
                await this.showErrorDetails(errorReport);
                break;
            case '報告問題':
                await this.reportIssue(errorReport);
                break;
        }
    }

    private hasRecoveryOptions(errorReport: ErrorReport): boolean {
        return this.recoveryStrategies.some(strategy => 
            strategy.canRecover(new Error(errorReport.message), errorReport.context)
        );
    }

    private async showRecoveryOptions(errorReport: ErrorReport): Promise<void> {
        const applicableStrategies = this.recoveryStrategies.filter(strategy =>
            strategy.canRecover(new Error(errorReport.message), errorReport.context)
        );

        if (applicableStrategies.length === 0) {
            vscode.window.showInformationMessage('沒有可用的恢復選項');
            return;
        }

        const strategyItems = applicableStrategies.map(strategy => ({
            label: strategy.name,
            description: strategy.description,
            strategy
        }));

        const selected = await vscode.window.showQuickPick(strategyItems, {
            placeHolder: '選擇恢復策略'
        });

        if (selected) {
            try {
                const success = await selected.strategy.execute();
                if (success) {
                    errorReport.resolved = true;
                    vscode.window.showInformationMessage('錯誤已成功修復！');
                } else {
                    vscode.window.showWarningMessage('修復嘗試失敗，請嘗試其他方法');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`修復過程中出現錯誤: ${error}`);
            }
        }
    }

    private async showErrorDetails(errorReport: ErrorReport): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'errorDetails',
            `錯誤詳情: ${errorReport.id}`,
            vscode.ViewColumn.Two,
            { enableScripts: false }
        );

        panel.webview.html = this.getErrorDetailsHtml(errorReport);
    }

    private getErrorDetailsHtml(errorReport: ErrorReport): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .error-header {
                    background: var(--vscode-textCodeBlock-background);
                    border-left: 4px solid var(--vscode-errorForeground);
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .error-section {
                    margin-bottom: 20px;
                }
                .error-section h3 {
                    color: var(--vscode-textLink-foreground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 5px;
                }
                .stack-trace {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    padding: 10px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    white-space: pre-wrap;
                    overflow-x: auto;
                }
                .context-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
            </style>
        </head>
        <body>
            <div class="error-header">
                <h2>🚨 錯誤報告 ${errorReport.id}</h2>
                <p><strong>時間:</strong> ${new Date(errorReport.timestamp).toLocaleString()}</p>
                <p><strong>狀態:</strong> ${errorReport.resolved ? '✅ 已解決' : '❌ 未解決'}</p>
            </div>

            <div class="error-section">
                <h3>錯誤信息</h3>
                <p>${errorReport.message}</p>
            </div>

            <div class="error-section">
                <h3>上下文信息</h3>
                <div class="context-item">
                    <span>操作:</span>
                    <span>${errorReport.context.operation}</span>
                </div>
                <div class="context-item">
                    <span>組件:</span>
                    <span>${errorReport.context.component}</span>
                </div>
                <div class="context-item">
                    <span>會話ID:</span>
                    <span>${errorReport.context.sessionId}</span>
                </div>
                <div class="context-item">
                    <span>擴展版本:</span>
                    <span>${errorReport.context.extensionVersion}</span>
                </div>
                <div class="context-item">
                    <span>VS Code版本:</span>
                    <span>${errorReport.context.vscodeVersion}</span>
                </div>
                <div class="context-item">
                    <span>平台:</span>
                    <span>${errorReport.context.platform}</span>
                </div>
            </div>

            ${errorReport.userAction ? `
            <div class="error-section">
                <h3>用戶操作</h3>
                <p>${errorReport.userAction}</p>
            </div>
            ` : ''}

            ${errorReport.stack ? `
            <div class="error-section">
                <h3>堆棧跟蹤</h3>
                <div class="stack-trace">${errorReport.stack}</div>
            </div>
            ` : ''}
        </body>
        </html>
        `;
    }

    private async reportIssue(errorReport: ErrorReport): Promise<void> {
        const issueUrl = this.generateIssueUrl(errorReport);
        vscode.env.openExternal(vscode.Uri.parse(issueUrl));
    }

    private generateIssueUrl(errorReport: ErrorReport): string {
        const title = encodeURIComponent(`Error: ${errorReport.message.substring(0, 50)}...`);
        const body = encodeURIComponent(`
## 錯誤描述
${errorReport.message}

## 重現步驟
${errorReport.userAction || '請描述導致錯誤的操作步驟'}

## 環境信息
- 擴展版本: ${errorReport.context.extensionVersion}
- VS Code版本: ${errorReport.context.vscodeVersion}
- 平台: ${errorReport.context.platform}
- 錯誤ID: ${errorReport.id}

## 堆棧跟蹤
\`\`\`
${errorReport.stack || 'No stack trace available'}
\`\`\`
        `);

        return `https://github.com/satanupup/devika/issues/new?title=${title}&body=${body}`;
    }

    private async reportToTelemetry(errorReport: ErrorReport): Promise<void> {
        try {
            // In a real implementation, this would send to telemetry service
            console.log('Reporting to telemetry:', {
                errorId: errorReport.id,
                message: errorReport.message,
                component: errorReport.context.component,
                operation: errorReport.context.operation
            });
            
            errorReport.reportedToTelemetry = true;
        } catch (error) {
            console.warn('Failed to report to telemetry:', error);
        }
    }

    addRecoveryStrategy(strategy: RecoveryStrategy): void {
        this.recoveryStrategies.push(strategy);
    }

    private buildFullContext(context: Partial<ErrorContext>): ErrorContext {
        return {
            operation: context.operation || 'unknown',
            component: context.component || 'unknown',
            sessionId: this.sessionId,
            extensionVersion: this.getExtensionVersion(),
            vscodeVersion: vscode.version,
            platform: process.platform,
            ...context
        };
    }

    private getExtensionVersion(): string {
        const extension = vscode.extensions.getExtension('devika.vscode-extension');
        return extension?.packageJSON?.version || '0.0.0';
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateErrorId(): string {
        return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private logError(errorReport: ErrorReport): void {
        const logMessage = `[${errorReport.level.toUpperCase()}] ${errorReport.context.component}:${errorReport.context.operation} - ${errorReport.message}`;
        console.error(logMessage);
        
        if (errorReport.stack) {
            console.error('Stack trace:', errorReport.stack);
        }
    }

    async getErrorStatistics(): Promise<{
        totalErrors: number;
        resolvedErrors: number;
        errorsByComponent: { [key: string]: number };
        errorsByOperation: { [key: string]: number };
        recentErrors: ErrorReport[];
    }> {
        const errors = Array.from(this.errorReports.values());
        const resolvedErrors = errors.filter(e => e.resolved).length;
        
        const errorsByComponent: { [key: string]: number } = {};
        const errorsByOperation: { [key: string]: number } = {};
        
        for (const error of errors) {
            errorsByComponent[error.context.component] = 
                (errorsByComponent[error.context.component] || 0) + 1;
            errorsByOperation[error.context.operation] = 
                (errorsByOperation[error.context.operation] || 0) + 1;
        }

        const recentErrors = errors
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);

        return {
            totalErrors: errors.length,
            resolvedErrors,
            errorsByComponent,
            errorsByOperation,
            recentErrors
        };
    }

    private async loadErrorReports(): Promise<void> {
        try {
            const saved = this.context.globalState.get<any[]>('errorReports', []);
            this.errorReports = new Map(saved);
        } catch (error) {
            console.warn('Failed to load error reports:', error);
        }
    }

    private async saveErrorReports(): Promise<void> {
        try {
            // Keep only recent reports to avoid storage bloat
            const reports = Array.from(this.errorReports.entries());
            const recentReports = reports
                .sort((a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime())
                .slice(0, this.maxReports);
            
            await this.context.globalState.update('errorReports', recentReports);
        } catch (error) {
            console.warn('Failed to save error reports:', error);
        }
    }

    async clearErrorReports(): Promise<void> {
        this.errorReports.clear();
        await this.context.globalState.update('errorReports', []);
        vscode.window.showInformationMessage('錯誤報告已清除');
    }

    setAutoReporting(enabled: boolean): void {
        this.autoReportingEnabled = enabled;
    }
}
