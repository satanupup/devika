import * as vscode from 'vscode';

/**
 * 操作結果接口
 */
export interface OperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: Error;
    message?: string;
}

/**
 * 錯誤處理選項
 */
export interface ErrorHandlingOptions {
    logError?: boolean;
    showToUser?: boolean;
    context?: string;
    recoverable?: boolean;
    retryCount?: number;
}

/**
 * 批量操作結果
 */
export interface BatchOperationResult<T = any> {
    results: T[];
    errors: string[];
    success: boolean;
    totalCount: number;
    successCount: number;
    failureCount: number;
}

/**
 * 統一的錯誤處理工具類
 * 提供一致的錯誤處理、日誌記錄和用戶通知機制
 */
export class ErrorHandlingUtils {
    private static readonly DEFAULT_OPTIONS: ErrorHandlingOptions = {
        logError: true,
        showToUser: false,
        recoverable: false,
        retryCount: 0
    };

    /**
     * 執行操作並處理錯誤
     */
    static async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        context: string,
        options: ErrorHandlingOptions = {}
    ): Promise<OperationResult<T>> {
        const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= (mergedOptions.retryCount || 0); attempt++) {
            try {
                const result = await operation();
                return { success: true, data: result };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                if (attempt < (mergedOptions.retryCount || 0)) {
                    // 等待後重試
                    await this.delay(Math.pow(2, attempt) * 1000); // 指數退避
                    continue;
                }
            }
        }

        return this.handleOperationError(lastError!, context, mergedOptions);
    }

    /**
     * 執行同步操作並處理錯誤
     */
    static executeWithErrorHandlingSync<T>(
        operation: () => T,
        context: string,
        options: ErrorHandlingOptions = {}
    ): OperationResult<T> {
        const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };

        try {
            const result = operation();
            return { success: true, data: result };
        } catch (error) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            return this.handleOperationError(normalizedError, context, mergedOptions);
        }
    }

    /**
     * 批量執行操作
     */
    static async executeBatchWithErrorHandling<T, R>(
        items: T[],
        operation: (item: T, index: number) => Promise<R>,
        context: string,
        options: ErrorHandlingOptions & { continueOnError?: boolean } = {}
    ): Promise<BatchOperationResult<R>> {
        const results: R[] = [];
        const errors: string[] = [];
        const { continueOnError = true } = options;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemContext = `${context} [${i + 1}/${items.length}]`;

            const result = await this.executeWithErrorHandling(
                () => operation(item, i),
                itemContext,
                { ...options, showToUser: false } // 批量操作不顯示個別錯誤
            );

            if (result.success && result.data !== undefined) {
                results.push(result.data);
            } else {
                errors.push(result.message || `${itemContext} 失敗`);
                if (!continueOnError) {
                    break;
                }
            }
        }

        const batchResult: BatchOperationResult<R> = {
            results,
            errors,
            success: errors.length === 0,
            totalCount: items.length,
            successCount: results.length,
            failureCount: errors.length
        };

        // 顯示批量操作結果
        if (options.showToUser) {
            this.showBatchResult(context, batchResult);
        }

        return batchResult;
    }

    /**
     * 處理操作錯誤
     */
    private static handleOperationError(
        error: Error,
        context: string,
        options: ErrorHandlingOptions
    ): OperationResult<never> {
        const errorMessage = `${context}: ${error.message}`;
        
        if (options.logError) {
            console.error(errorMessage, error);
        }
        
        if (options.showToUser) {
            this.showErrorToUser(errorMessage, error, options.recoverable);
        }
        
        return {
            success: false,
            error,
            message: errorMessage
        };
    }

    /**
     * 顯示錯誤給用戶
     */
    private static async showErrorToUser(
        message: string,
        error: Error,
        recoverable: boolean = false
    ): Promise<void> {
        const actions: string[] = ['查看詳情'];
        
        if (recoverable) {
            actions.unshift('重試');
        }

        const choice = await vscode.window.showErrorMessage(
            message,
            ...actions
        );

        if (choice === '查看詳情') {
            this.showErrorDetails(error);
        }
    }

    /**
     * 顯示錯誤詳情
     */
    private static showErrorDetails(error: Error): void {
        const outputChannel = vscode.window.createOutputChannel('Devika 錯誤詳情');
        outputChannel.appendLine(`錯誤時間: ${new Date().toISOString()}`);
        outputChannel.appendLine(`錯誤類型: ${error.constructor.name}`);
        outputChannel.appendLine(`錯誤消息: ${error.message}`);
        
        if (error.stack) {
            outputChannel.appendLine(`錯誤堆棧:`);
            outputChannel.appendLine(error.stack);
        }
        
        outputChannel.show();
    }

    /**
     * 顯示批量操作結果
     */
    private static showBatchResult<T>(
        context: string,
        result: BatchOperationResult<T>
    ): void {
        const { totalCount, successCount, failureCount } = result;
        
        if (result.success) {
            vscode.window.showInformationMessage(
                `${context} 完成: ${successCount}/${totalCount} 成功`
            );
        } else {
            const message = `${context} 部分失敗: ${successCount} 成功, ${failureCount} 失敗`;
            
            vscode.window.showWarningMessage(
                message,
                '查看錯誤'
            ).then(choice => {
                if (choice === '查看錯誤') {
                    this.showBatchErrors(context, result.errors);
                }
            });
        }
    }

    /**
     * 顯示批量錯誤
     */
    private static showBatchErrors(context: string, errors: string[]): void {
        const outputChannel = vscode.window.createOutputChannel(`${context} 錯誤報告`);
        outputChannel.appendLine(`錯誤報告 - ${new Date().toISOString()}`);
        outputChannel.appendLine(`總錯誤數: ${errors.length}`);
        outputChannel.appendLine('');
        
        errors.forEach((error, index) => {
            outputChannel.appendLine(`${index + 1}. ${error}`);
        });
        
        outputChannel.show();
    }

    /**
     * 標準化錯誤
     */
    static normalizeError(error: unknown): Error {
        if (error instanceof Error) {
            return error;
        }
        
        if (typeof error === 'string') {
            return new Error(error);
        }
        
        if (error && typeof error === 'object' && 'message' in error) {
            return new Error(String(error.message));
        }
        
        return new Error('未知錯誤');
    }

    /**
     * 創建帶上下文的錯誤
     */
    static createContextualError(
        message: string,
        context: string,
        originalError?: Error
    ): Error {
        const fullMessage = `${context}: ${message}`;
        const error = new Error(fullMessage);
        
        if (originalError) {
            error.stack = `${error.stack}\n原始錯誤: ${originalError.stack}`;
        }
        
        return error;
    }

    /**
     * 延遲函數
     */
    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 安全執行函數（不拋出異常）
     */
    static safeExecute<T>(
        operation: () => T,
        fallback: T,
        context?: string
    ): T {
        try {
            return operation();
        } catch (error) {
            if (context) {
                console.warn(`${context} 失敗，使用備用值:`, error);
            }
            return fallback;
        }
    }

    /**
     * 安全執行異步函數
     */
    static async safeExecuteAsync<T>(
        operation: () => Promise<T>,
        fallback: T,
        context?: string
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (context) {
                console.warn(`${context} 失敗，使用備用值:`, error);
            }
            return fallback;
        }
    }
}
