/**
 * 錯誤恢復管理器
 * 提供智能錯誤恢復和用戶友好的錯誤處理
 */

import * as vscode from 'vscode';
import { DevikaError, ErrorType } from './ErrorHandler';

/**
 * 恢復策略接口
 */
export interface RecoveryStrategy {
    canRecover(error: DevikaError): boolean;
    recover(error: DevikaError, context?: any): Promise<boolean>;
    getRecoveryMessage(): string;
}

/**
 * API 錯誤恢復策略
 */
export class ApiErrorRecoveryStrategy implements RecoveryStrategy {
    canRecover(error: DevikaError): boolean {
        return error.type === ErrorType.API &&
               (error.code === 'RATE_LIMIT' ||
                error.code === 'TIMEOUT' ||
                error.code === 'NETWORK_ERROR');
    }

    async recover(error: DevikaError, context?: any): Promise<boolean> {
        switch (error.code) {
            case 'RATE_LIMIT':
                // 等待並重試
                await this.waitWithBackoff(5000);
                return true;

            case 'TIMEOUT':
                // 增加超時時間並重試
                if (context?.retryCount < 3) {
                    await this.waitWithBackoff(2000);
                    return true;
                }
                break;

            case 'NETWORK_ERROR':
                // 檢查網絡連接並重試
                const isOnline = await this.checkNetworkConnection();
                if (isOnline && context?.retryCount < 2) {
                    await this.waitWithBackoff(3000);
                    return true;
                }
                break;
        }
        return false;
    }

    getRecoveryMessage(): string {
        return '正在嘗試恢復 API 連接...';
    }

    private async waitWithBackoff(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async checkNetworkConnection(): Promise<boolean> {
        try {
            await fetch('https://www.google.com', {
                method: 'HEAD',
                mode: 'no-cors'
            });
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * 文件系統錯誤恢復策略
 */
export class FileSystemErrorRecoveryStrategy implements RecoveryStrategy {
    canRecover(error: DevikaError): boolean {
        return error.type === ErrorType.FILE_SYSTEM;
    }

    async recover(error: DevikaError, context?: any): Promise<boolean> {
        switch (error.code) {
            case 'FILE_NOT_FOUND':
                // 嘗試創建文件或目錄
                return await this.createMissingFile(context?.filePath);

            case 'PERMISSION_DENIED':
                // 提示用戶檢查權限
                const choice = await vscode.window.showWarningMessage(
                    '文件權限不足，是否嘗試以管理員權限運行？',
                    '重試',
                    '跳過'
                );
                return choice === '重試';

            case 'DISK_FULL':
                // 提示用戶清理磁盤空間
                await vscode.window.showErrorMessage(
                    '磁盤空間不足，請清理磁盤空間後重試'
                );
                return false;
        }
        return false;
    }

    getRecoveryMessage(): string {
        return '正在嘗試恢復文件操作...';
    }

    private async createMissingFile(filePath?: string): Promise<boolean> {
        if (!filePath) {return false;}

        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.fs.writeFile(uri, new Uint8Array());
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * 配置錯誤恢復策略
 */
export class ConfigurationErrorRecoveryStrategy implements RecoveryStrategy {
    canRecover(error: DevikaError): boolean {
        return error.type === ErrorType.CONFIGURATION;
    }

    async recover(error: DevikaError, _context?: any): Promise<boolean> {
        switch (error.code) {
            case 'MISSING_API_KEY':
                // 引導用戶設置 API 金鑰
                const choice = await vscode.window.showWarningMessage(
                    'API 金鑰未設置，是否現在設置？',
                    '設置',
                    '稍後'
                );

                if (choice === '設置') {
                    await vscode.commands.executeCommand('devika.setApiKey');
                    return true;
                }
                break;

            case 'INVALID_CONFIG':
                // 重置為默認配置
                const resetChoice = await vscode.window.showWarningMessage(
                    '配置文件無效，是否重置為默認配置？',
                    '重置',
                    '手動修復'
                );

                if (resetChoice === '重置') {
                    await this.resetToDefaultConfig();
                    return true;
                }
                break;
        }
        return false;
    }

    getRecoveryMessage(): string {
        return '正在修復配置問題...';
    }

    private async resetToDefaultConfig(): Promise<void> {
        const config = vscode.workspace.getConfiguration('devika');
        const defaultSettings = {
            'enableAI': true,
            'autoAnalyze': false,
            'maxContextLines': 50,
            'preferredModel': 'claude-3-5-sonnet'
        };

        for (const [key, value] of Object.entries(defaultSettings)) {
            await config.update(key, value, vscode.ConfigurationTarget.Global);
        }
    }
}

/**
 * 錯誤恢復管理器
 */
export class ErrorRecoveryManager {
    private static instance: ErrorRecoveryManager;
    private strategies: RecoveryStrategy[] = [];
    private recoveryHistory = new Map<string, number>();

    private constructor() {
        this.registerDefaultStrategies();
    }

    static getInstance(): ErrorRecoveryManager {
        if (!ErrorRecoveryManager.instance) {
            ErrorRecoveryManager.instance = new ErrorRecoveryManager();
        }
        return ErrorRecoveryManager.instance;
    }

    /**
     * 註冊默認恢復策略
     */
    private registerDefaultStrategies(): void {
        this.strategies.push(
            new ApiErrorRecoveryStrategy(),
            new FileSystemErrorRecoveryStrategy(),
            new ConfigurationErrorRecoveryStrategy()
        );
    }

    /**
     * 註冊自定義恢復策略
     */
    registerStrategy(strategy: RecoveryStrategy): void {
        this.strategies.push(strategy);
    }

    /**
     * 嘗試恢復錯誤
     */
    async attemptRecovery(error: DevikaError, context?: any): Promise<boolean> {
        const errorKey = `${error.type}-${error.code}`;
        const retryCount = this.recoveryHistory.get(errorKey) || 0;

        // 防止無限重試
        if (retryCount >= 3) {
            console.warn(`錯誤恢復次數過多，停止嘗試: ${errorKey}`);
            return false;
        }

        // 查找適用的恢復策略
        const strategy = this.strategies.find(s => s.canRecover(error));
        if (!strategy) {
            console.warn(`未找到適用的恢復策略: ${error.type} - ${error.code}`);
            return false;
        }

        try {
            // 顯示恢復消息
            const recoveryMessage = strategy.getRecoveryMessage();
            vscode.window.showInformationMessage(recoveryMessage);

            // 嘗試恢復
            const recovered = await strategy.recover(error, {
                ...context,
                retryCount
            });

            if (recovered) {
                console.log(`錯誤恢復成功: ${errorKey}`);
                this.recoveryHistory.delete(errorKey); // 清除歷史記錄
                vscode.window.showInformationMessage('✅ 錯誤已自動修復');
                return true;
            } else {
                // 增加重試計數
                this.recoveryHistory.set(errorKey, retryCount + 1);
                console.warn(`錯誤恢復失敗: ${errorKey}, 重試次數: ${retryCount + 1}`);
                return false;
            }

        } catch (recoveryError) {
            console.error(`恢復策略執行失敗:`, recoveryError);
            this.recoveryHistory.set(errorKey, retryCount + 1);
            return false;
        }
    }

    /**
     * 生成用戶友好的錯誤消息
     */
    generateUserFriendlyMessage(error: DevikaError): string {
        const baseMessage = this.getBaseMessage(error);
        const actionMessage = this.getActionMessage(error);
        const recoveryMessage = this.getRecoveryMessage(error);

        return `${baseMessage}\n\n${actionMessage}\n\n${recoveryMessage}`;
    }

    private getBaseMessage(error: DevikaError): string {
        switch (error.type) {
            case ErrorType.API:
                return '🔌 AI 服務連接出現問題';
            case ErrorType.FILE_SYSTEM:
                return '📁 文件操作遇到問題';
            case ErrorType.CONFIGURATION:
                return '⚙️ 配置設置需要調整';
            case ErrorType.NETWORK:
                return '🌐 網絡連接出現問題';
            case ErrorType.VALIDATION:
                return '✅ 數據驗證失敗';
            default:
                return '❌ 發生未知錯誤';
        }
    }

    private getActionMessage(error: DevikaError): string {
        switch (error.code) {
            case 'MISSING_API_KEY':
                return '請設置有效的 API 金鑰';
            case 'RATE_LIMIT':
                return '請求過於頻繁，請稍後再試';
            case 'FILE_NOT_FOUND':
                return '找不到指定的文件';
            case 'PERMISSION_DENIED':
                return '權限不足，請檢查文件權限';
            default:
                return error.message;
        }
    }

    private getRecoveryMessage(error: DevikaError): string {
        const strategy = this.strategies.find(s => s.canRecover(error));
        if (strategy) {
            return '💡 系統將嘗試自動修復此問題';
        }
        return '💡 請手動解決此問題或聯繫支持';
    }

    /**
     * 清除恢復歷史
     */
    clearRecoveryHistory(): void {
        this.recoveryHistory.clear();
    }

    /**
     * 獲取恢復統計
     */
    getRecoveryStats(): { errorType: string; attempts: number }[] {
        return Array.from(this.recoveryHistory.entries()).map(([errorType, attempts]) => ({
            errorType,
            attempts
        }));
    }
}

// 導出單例實例
export const errorRecoveryManager = ErrorRecoveryManager.getInstance();
