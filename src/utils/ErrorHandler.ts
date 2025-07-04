import * as vscode from 'vscode';

/**
 * 錯誤類型枚舉
 */
export enum ErrorType {
    CONFIGURATION = 'CONFIGURATION',
    API = 'API',
    FILE_SYSTEM = 'FILE_SYSTEM',
    NETWORK = 'NETWORK',
    VALIDATION = 'VALIDATION',
    PARSING = 'PARSING',
    DATABASE = 'DATABASE',
    GIT = 'GIT',
    UNKNOWN = 'UNKNOWN'
}

/**
 * 錯誤嚴重程度
 */
export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

/**
 * 自定義錯誤類
 */
export class DevikaError extends Error {
    public readonly type: ErrorType;
    public readonly severity: ErrorSeverity;
    public readonly code: string;
    public readonly context: Record<string, any> | undefined;
    public readonly timestamp: Date;
    public readonly recoverable: boolean;

    constructor(
        message: string,
        type: ErrorType = ErrorType.UNKNOWN,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        code?: string,
        context?: Record<string, any>,
        recoverable: boolean = true
    ) {
        super(message);
        this.name = 'DevikaError';
        this.type = type;
        this.severity = severity;
        this.code = code || `${type}_ERROR`;
        this.context = context;
        this.timestamp = new Date();
        this.recoverable = recoverable;

        // 確保堆棧跟踪正確
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DevikaError);
        }
    }

    /**
     * 轉換為用戶友好的消息
     */
    toUserMessage(): string {
        switch (this.type) {
            case ErrorType.CONFIGURATION:
                return `配置錯誤: ${this.message}`;
            case ErrorType.API:
                return `API 錯誤: ${this.message}`;
            case ErrorType.FILE_SYSTEM:
                return `文件系統錯誤: ${this.message}`;
            case ErrorType.NETWORK:
                return `網絡錯誤: ${this.message}`;
            case ErrorType.VALIDATION:
                return `驗證錯誤: ${this.message}`;
            case ErrorType.PARSING:
                return `解析錯誤: ${this.message}`;
            case ErrorType.DATABASE:
                return `數據庫錯誤: ${this.message}`;
            case ErrorType.GIT:
                return `Git 錯誤: ${this.message}`;
            default:
                return `錯誤: ${this.message}`;
        }
    }

    /**
     * 獲取恢復建議
     */
    getRecoveryActions(): string[] {
        const actions: string[] = [];

        switch (this.type) {
            case ErrorType.CONFIGURATION:
                actions.push('檢查配置設定');
                actions.push('重新設定 API 金鑰');
                break;
            case ErrorType.API:
                actions.push('檢查網絡連接');
                actions.push('驗證 API 金鑰');
                actions.push('稍後重試');
                break;
            case ErrorType.FILE_SYSTEM:
                actions.push('檢查文件權限');
                actions.push('確認文件路徑');
                break;
            case ErrorType.NETWORK:
                actions.push('檢查網絡連接');
                actions.push('檢查防火牆設定');
                break;
            case ErrorType.VALIDATION:
                actions.push('檢查輸入數據');
                actions.push('確認數據格式');
                break;
            default:
                actions.push('重新啟動擴充套件');
                actions.push('查看詳細錯誤日誌');
        }

        return actions;
    }
}

/**
 * 統一錯誤處理器
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private outputChannel: vscode.OutputChannel;
    private errorHistory: DevikaError[] = [];
    private readonly maxHistorySize = 100;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Devika Errors');
    }

    public static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * 處理錯誤
     */
    public async handleError(error: Error | DevikaError, showToUser: boolean = true): Promise<void> {
        const devikaError = this.normalizeError(error);

        // 記錄錯誤
        this.logError(devikaError);

        // 添加到歷史記錄
        this.addToHistory(devikaError);

        // 顯示給用戶
        if (showToUser) {
            await this.showErrorToUser(devikaError);
        }

        // 嘗試自動恢復
        if (devikaError.recoverable) {
            await this.attemptRecovery(devikaError);
        }
    }

    /**
     * 標準化錯誤
     */
    private normalizeError(error: Error | DevikaError): DevikaError {
        if (error instanceof DevikaError) {
            return error;
        }

        // 根據錯誤消息推斷類型
        const type = this.inferErrorType(error.message);
        const severity = this.inferSeverity(error.message);

        return new DevikaError(
            error.message,
            type,
            severity,
            undefined,
            { originalError: error.name },
            true
        );
    }

    /**
     * 推斷錯誤類型
     */
    private inferErrorType(message: string): ErrorType {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('api') || lowerMessage.includes('key')) {
            return ErrorType.API;
        }
        if (lowerMessage.includes('file') || lowerMessage.includes('path')) {
            return ErrorType.FILE_SYSTEM;
        }
        if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
            return ErrorType.NETWORK;
        }
        if (lowerMessage.includes('config')) {
            return ErrorType.CONFIGURATION;
        }
        if (lowerMessage.includes('git')) {
            return ErrorType.GIT;
        }
        if (lowerMessage.includes('parse') || lowerMessage.includes('syntax')) {
            return ErrorType.PARSING;
        }
        if (lowerMessage.includes('database') || lowerMessage.includes('sqlite')) {
            return ErrorType.DATABASE;
        }

        return ErrorType.UNKNOWN;
    }

    /**
     * 推斷錯誤嚴重程度
     */
    private inferSeverity(message: string): ErrorSeverity {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('critical') || lowerMessage.includes('fatal')) {
            return ErrorSeverity.CRITICAL;
        }
        if (lowerMessage.includes('error') || lowerMessage.includes('failed')) {
            return ErrorSeverity.HIGH;
        }
        if (lowerMessage.includes('warning') || lowerMessage.includes('warn')) {
            return ErrorSeverity.MEDIUM;
        }

        return ErrorSeverity.LOW;
    }

    /**
     * 記錄錯誤
     */
    private logError(error: DevikaError): void {
        const logMessage = this.formatLogMessage(error);

        // 輸出到 VS Code 輸出面板
        this.outputChannel.appendLine(logMessage);

        // 根據嚴重程度決定是否在控制台輸出
        if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
            console.error(logMessage);
        } else {
            console.warn(logMessage);
        }
    }

    /**
     * 格式化日誌消息
     */
    private formatLogMessage(error: DevikaError): string {
        const timestamp = error.timestamp.toISOString();
        const context = error.context ? JSON.stringify(error.context) : '';

        return `[${timestamp}] [${error.severity}] [${error.type}] ${error.code}: ${error.message}
Stack: ${error.stack}
Context: ${context}
Recoverable: ${error.recoverable}
---`;
    }

    /**
     * 添加到錯誤歷史
     */
    private addToHistory(error: DevikaError): void {
        this.errorHistory.unshift(error);

        // 限制歷史記錄大小
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
        }
    }

    /**
     * 顯示錯誤給用戶
     */
    private async showErrorToUser(error: DevikaError): Promise<void> {
        const userMessage = error.toUserMessage();
        const actions = error.getRecoveryActions();

        const showDetailsAction = '顯示詳細信息';
        const retryAction = '重試';

        const selectedAction = await this.showErrorMessage(error.severity, userMessage, [
            showDetailsAction,
            retryAction,
            ...actions.slice(0, 2) // 只顯示前兩個恢復動作
        ]);

        if (selectedAction === showDetailsAction) {
            this.outputChannel.show();
        } else if (selectedAction === retryAction && error.recoverable) {
            await this.attemptRecovery(error);
        }
    }

    /**
     * 根據嚴重程度顯示錯誤消息
     */
    private async showErrorMessage(
        severity: ErrorSeverity,
        message: string,
        actions: string[]
    ): Promise<string | undefined> {
        switch (severity) {
            case ErrorSeverity.CRITICAL:
                return await vscode.window.showErrorMessage(message, ...actions);
            case ErrorSeverity.HIGH:
                return await vscode.window.showErrorMessage(message, ...actions);
            case ErrorSeverity.MEDIUM:
                return await vscode.window.showWarningMessage(message, ...actions);
            case ErrorSeverity.LOW:
                return await vscode.window.showInformationMessage(message, ...actions);
            default:
                return await vscode.window.showErrorMessage(message, ...actions);
        }
    }

    /**
     * 嘗試自動恢復
     */
    private async attemptRecovery(error: DevikaError): Promise<void> {
        try {
            switch (error.type) {
                case ErrorType.CONFIGURATION:
                    await this.recoverConfiguration();
                    break;
                case ErrorType.API:
                    await this.recoverApiConnection();
                    break;
                case ErrorType.FILE_SYSTEM:
                    await this.recoverFileSystem();
                    break;
                default:
                    // 通用恢復策略
                    await this.genericRecovery();
            }
        } catch (recoveryError) {
            console.warn('自動恢復失敗:', recoveryError);
        }
    }

    /**
     * 配置恢復
     */
    private async recoverConfiguration(): Promise<void> {
        // 重新加載配置
        const _config = vscode.workspace.getConfiguration('devika');
        // 觸發配置驗證
        // 這裡可以添加具體的配置恢復邏輯
    }

    /**
     * API 連接恢復
     */
    private async recoverApiConnection(): Promise<void> {
        // 重置 API 連接
        // 清除緩存
        // 重新初始化 API 客戶端
    }

    /**
     * 文件系統恢復
     */
    private async recoverFileSystem(): Promise<void> {
        // 檢查文件權限
        // 創建缺失的目錄
        // 重新初始化文件監視器
    }

    /**
     * 通用恢復
     */
    private async genericRecovery(): Promise<void> {
        // 清除緩存
        // 重新初始化組件
        // 重新加載配置
    }

    /**
     * 獲取錯誤歷史
     */
    public getErrorHistory(): DevikaError[] {
        return [...this.errorHistory];
    }

    /**
     * 清除錯誤歷史
     */
    public clearErrorHistory(): void {
        this.errorHistory = [];
    }

    /**
     * 獲取錯誤統計
     */
    public getErrorStatistics(): Record<string, number> {
        const stats: Record<string, number> = {};

        for (const error of this.errorHistory) {
            const key = `${error.type}_${error.severity}`;
            stats[key] = (stats[key] || 0) + 1;
        }

        return stats;
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.outputChannel.dispose();
        this.errorHistory = [];
    }
}
