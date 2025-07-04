import * as vscode from 'vscode';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 錯誤類型枚舉
 */
export enum ErrorType {
    CONFIGURATION = 'configuration',
    API = 'api',
    FILE_SYSTEM = 'file_system',
    NETWORK = 'network',
    VALIDATION = 'validation',
    RUNTIME = 'runtime',
    USER_INPUT = 'user_input',
    PERMISSION = 'permission',
    TIMEOUT = 'timeout',
    UNKNOWN = 'unknown'
}

/**
 * 錯誤嚴重程度
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * 錯誤上下文接口
 */
export interface ErrorContext {
    component?: string;
    operation?: string;
    userId?: string;
    sessionId?: string;
    timestamp?: Date;
    stackTrace?: string;
    additionalData?: Record<string, any>;
}

/**
 * 恢復策略接口
 */
export interface RecoveryStrategy {
    name: string;
    description: string;
    canRecover: (error: DevikaError) => boolean;
    recover: (error: DevikaError) => Promise<boolean>;
    priority: number;
}

/**
 * 錯誤報告接口
 */
export interface ErrorReport {
    id: string;
    error: DevikaError;
    context: ErrorContext;
    timestamp: Date;
    resolved: boolean;
    recoveryAttempts: number;
    userNotified: boolean;
}

/**
 * 增強的 Devika 錯誤類
 */
export class DevikaError extends Error {
    public readonly type: ErrorType;
    public readonly severity: ErrorSeverity;
    public readonly context: ErrorContext;
    public readonly recoverable: boolean;
    public readonly userMessage: string;
    public readonly technicalDetails: string;

    constructor(
        message: string,
        type: ErrorType = ErrorType.UNKNOWN,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        context: ErrorContext = {},
        recoverable: boolean = false,
        userMessage?: string
    ) {
        super(message);
        this.name = 'DevikaError';
        this.type = type;
        this.severity = severity;
        this.context = {
            ...context,
            timestamp: context.timestamp || new Date()
        };
        this.recoverable = recoverable;
        this.userMessage = userMessage || this.generateUserMessage();
        this.technicalDetails = message;
    }

    /**
     * 生成用戶友好的錯誤消息
     */
    private generateUserMessage(): string {
        switch (this.type) {
            case ErrorType.CONFIGURATION:
                return '配置設置有問題，請檢查您的設置';
            case ErrorType.API:
                return 'API 服務暫時不可用，請稍後重試';
            case ErrorType.FILE_SYSTEM:
                return '文件操作失敗，請檢查文件權限';
            case ErrorType.NETWORK:
                return '網絡連接有問題，請檢查您的網絡設置';
            case ErrorType.VALIDATION:
                return '輸入的數據格式不正確';
            case ErrorType.PERMISSION:
                return '沒有足夠的權限執行此操作';
            case ErrorType.TIMEOUT:
                return '操作超時，請重試';
            default:
                return '發生了未知錯誤，請聯繫支持團隊';
        }
    }

    /**
     * 轉換為 JSON 格式
     */
    toJSON(): Record<string, any> {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            context: this.context,
            recoverable: this.recoverable,
            userMessage: this.userMessage,
            technicalDetails: this.technicalDetails,
            stack: this.stack
        };
    }

    /**
     * 創建配置錯誤
     */
    static configuration(message: string, context?: ErrorContext): DevikaError {
        return new DevikaError(
            message,
            ErrorType.CONFIGURATION,
            ErrorSeverity.HIGH,
            context,
            true,
            '配置設置有問題，請檢查您的設置'
        );
    }

    /**
     * 創建 API 錯誤
     */
    static api(message: string, context?: ErrorContext): DevikaError {
        return new DevikaError(
            message,
            ErrorType.API,
            ErrorSeverity.MEDIUM,
            context,
            true,
            'API 服務暫時不可用，請稍後重試'
        );
    }

    /**
     * 創建文件系統錯誤
     */
    static fileSystem(message: string, context?: ErrorContext): DevikaError {
        return new DevikaError(
            message,
            ErrorType.FILE_SYSTEM,
            ErrorSeverity.MEDIUM,
            context,
            true,
            '文件操作失敗，請檢查文件權限'
        );
    }

    /**
     * 創建網絡錯誤
     */
    static network(message: string, context?: ErrorContext): DevikaError {
        return new DevikaError(
            message,
            ErrorType.NETWORK,
            ErrorSeverity.MEDIUM,
            context,
            true,
            '網絡連接有問題，請檢查您的網絡設置'
        );
    }

    /**
     * 創建驗證錯誤
     */
    static validation(message: string, context?: ErrorContext): DevikaError {
        return new DevikaError(
            message,
            ErrorType.VALIDATION,
            ErrorSeverity.LOW,
            context,
            false,
            '輸入的數據格式不正確'
        );
    }
}

/**
 * 增強的錯誤處理系統
 */
export class EnhancedErrorSystem {
    private static instance: EnhancedErrorSystem;
    private errorReports: Map<string, ErrorReport> = new Map();
    private recoveryStrategies: RecoveryStrategy[] = [];
    private outputChannel: vscode.OutputChannel;
    private errorCount = 0;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Devika 錯誤日誌');
        this.initializeRecoveryStrategies();
    }

    static getInstance(): EnhancedErrorSystem {
        if (!EnhancedErrorSystem.instance) {
            EnhancedErrorSystem.instance = new EnhancedErrorSystem();
        }
        return EnhancedErrorSystem.instance;
    }

    /**
     * 處理錯誤
     */
    async handleError(
        error: Error | DevikaError,
        context: ErrorContext = {},
        showToUser: boolean = true
    ): Promise<void> {
        const devikaError = this.normalizeError(error, context);
        const errorId = this.generateErrorId();

        // 創建錯誤報告
        const errorReport: ErrorReport = {
            id: errorId,
            error: devikaError,
            context,
            timestamp: new Date(),
            resolved: false,
            recoveryAttempts: 0,
            userNotified: false
        };

        this.errorReports.set(errorId, errorReport);

        // 記錄錯誤
        this.logError(errorReport);

        // 嘗試自動恢復
        const recovered = await this.attemptRecovery(errorReport);

        if (recovered) {
            errorReport.resolved = true;
            this.showRecoverySuccess(devikaError);
        } else if (showToUser) {
            await this.showErrorToUser(errorReport);
        }
    }

    /**
     * 標準化錯誤
     */
    private normalizeError(error: Error | DevikaError, context: ErrorContext): DevikaError {
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
            {
                ...context,
                stackTrace: error.stack
            },
            this.isRecoverable(type)
        );
    }

    /**
     * 推斷錯誤類型
     */
    private inferErrorType(message: string): ErrorType {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('config') || lowerMessage.includes('setting')) {
            return ErrorType.CONFIGURATION;
        }
        if (lowerMessage.includes('api') || lowerMessage.includes('request')) {
            return ErrorType.API;
        }
        if (lowerMessage.includes('file') || lowerMessage.includes('path')) {
            return ErrorType.FILE_SYSTEM;
        }
        if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
            return ErrorType.NETWORK;
        }
        if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
            return ErrorType.VALIDATION;
        }
        if (lowerMessage.includes('permission') || lowerMessage.includes('access')) {
            return ErrorType.PERMISSION;
        }
        if (lowerMessage.includes('timeout')) {
            return ErrorType.TIMEOUT;
        }

        return ErrorType.RUNTIME;
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
     * 判斷是否可恢復
     */
    private isRecoverable(type: ErrorType): boolean {
        return [
            ErrorType.CONFIGURATION,
            ErrorType.API,
            ErrorType.NETWORK,
            ErrorType.TIMEOUT
        ].includes(type);
    }

    /**
     * 記錄錯誤
     */
    private logError(errorReport: ErrorReport): void {
        const { error, context, timestamp } = errorReport;

        this.outputChannel.appendLine(`[${timestamp.toISOString()}] ${error.severity.toUpperCase()}: ${error.type}`);
        this.outputChannel.appendLine(`消息: ${error.message}`);
        this.outputChannel.appendLine(`組件: ${context.component || 'unknown'}`);
        this.outputChannel.appendLine(`操作: ${context.operation || 'unknown'}`);

        if (error.stack) {
            this.outputChannel.appendLine(`堆棧跟蹤:\n${error.stack}`);
        }

        if (context.additionalData) {
            this.outputChannel.appendLine(`附加數據: ${JSON.stringify(context.additionalData, null, 2)}`);
        }

        this.outputChannel.appendLine('---');
    }

    /**
     * 嘗試自動恢復
     */
    private async attemptRecovery(errorReport: ErrorReport): Promise<boolean> {
        const { error } = errorReport;

        if (!error.recoverable) {
            return false;
        }

        // 按優先級排序恢復策略
        const applicableStrategies = this.recoveryStrategies
            .filter(strategy => strategy.canRecover(error))
            .sort((a, b) => b.priority - a.priority);

        for (const strategy of applicableStrategies) {
            try {
                errorReport.recoveryAttempts++;
                const recovered = await strategy.recover(error);

                if (recovered) {
                    this.outputChannel.appendLine(`自動恢復成功: ${strategy.name}`);
                    return true;
                }
            } catch (recoveryError) {
                this.outputChannel.appendLine(`恢復策略失敗 ${strategy.name}: ${recoveryError}`);
            }
        }

        return false;
    }

    /**
     * 顯示錯誤給用戶
     */
    private async showErrorToUser(errorReport: ErrorReport): Promise<void> {
        const { error } = errorReport;
        errorReport.userNotified = true;

        const actions: string[] = ['查看詳情'];

        if (error.recoverable) {
            actions.unshift('重試');
        }

        const choice = await vscode.window.showErrorMessage(
            error.userMessage,
            ...actions
        );

        if (choice === '重試' && error.recoverable) {
            await this.attemptRecovery(errorReport);
        } else if (choice === '查看詳情') {
            this.outputChannel.show();
        }
    }

    /**
     * 顯示恢復成功消息
     */
    private showRecoverySuccess(error: DevikaError): void {
        vscode.window.showInformationMessage(
            `問題已自動修復: ${error.userMessage}`
        );
    }

    /**
     * 初始化恢復策略
     */
    private initializeRecoveryStrategies(): void {
        // 配置恢復策略
        this.recoveryStrategies.push({
            name: '重新加載配置',
            description: '重新加載 VS Code 配置',
            canRecover: (error) => error.type === ErrorType.CONFIGURATION,
            recover: async () => {
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
                return true;
            },
            priority: 10
        });

        // API 恢復策略
        this.recoveryStrategies.push({
            name: '重試 API 請求',
            description: '等待後重試 API 請求',
            canRecover: (error) => error.type === ErrorType.API,
            recover: async () => {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return true;
            },
            priority: 8
        });

        // 網絡恢復策略
        this.recoveryStrategies.push({
            name: '檢查網絡連接',
            description: '檢查並重新建立網絡連接',
            canRecover: (error) => error.type === ErrorType.NETWORK,
            recover: async () => {
                // 簡單的網絡檢查
                try {
                    await fetch('https://www.google.com', { method: 'HEAD' });
                    return true;
                } catch {
                    return false;
                }
            },
            priority: 6
        });
    }

    /**
     * 生成錯誤 ID
     */
    private generateErrorId(): string {
        return `error-${Date.now()}-${++this.errorCount}`;
    }

    /**
     * 獲取錯誤統計
     */
    getErrorStatistics(): Record<string, any> {
        const reports = Array.from(this.errorReports.values());

        return {
            totalErrors: reports.length,
            resolvedErrors: reports.filter(r => r.resolved).length,
            errorsByType: this.groupBy(reports, r => r.error.type),
            errorsBySeverity: this.groupBy(reports, r => r.error.severity),
            averageRecoveryAttempts: reports.reduce((sum, r) => sum + r.recoveryAttempts, 0) / reports.length || 0
        };
    }

    /**
     * 分組輔助函數
     */
    private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, number> {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            groups[key] = (groups[key] || 0) + 1;
            return groups;
        }, {} as Record<string, number>);
    }

    /**
     * 清理舊的錯誤報告
     */
    cleanupOldReports(maxAge: number = 24 * 60 * 60 * 1000): void {
        const cutoff = new Date(Date.now() - maxAge);

        for (const [id, report] of this.errorReports) {
            if (report.timestamp < cutoff) {
                this.errorReports.delete(id);
            }
        }
    }
}
