/**
 * 類型安全強化器
 * 提供運行時類型檢查和編譯時類型安全保證
 */

import * as vscode from 'vscode';
import { StrictTypes } from './StrictTypes';

/**
 * 運行時類型檢查器
 */
export class RuntimeTypeChecker {
    
    /**
     * 檢查是否為有效的 API 金鑰
     */
    static isValidApiKey(value: unknown): value is string {
        return typeof value === 'string' && 
               value.length > 0 && 
               value.trim().length > 0 &&
               !value.includes(' ');
    }

    /**
     * 檢查是否為有效的文件路徑
     */
    static isValidFilePath(value: unknown): value is string {
        return typeof value === 'string' && 
               value.length > 0 && 
               (value.includes('/') || value.includes('\\'));
    }

    /**
     * 檢查是否為有效的 VS Code URI
     */
    static isValidUri(value: unknown): value is vscode.Uri {
        return value instanceof vscode.Uri;
    }

    /**
     * 檢查是否為有效的範圍
     */
    static isValidRange(value: unknown): value is vscode.Range {
        return value instanceof vscode.Range;
    }

    /**
     * 檢查是否為有效的選擇
     */
    static isValidSelection(value: unknown): value is vscode.Selection {
        return value instanceof vscode.Selection;
    }

    /**
     * 檢查是否為有效的文檔
     */
    static isValidTextDocument(value: unknown): value is vscode.TextDocument {
        return value != null && 
               typeof value === 'object' &&
               'uri' in value &&
               'getText' in value &&
               'lineCount' in value;
    }

    /**
     * 檢查是否為有效的任務狀態
     */
    static isValidTaskStatus(value: unknown): value is 'pending' | 'in-progress' | 'completed' | 'cancelled' {
        return typeof value === 'string' && 
               ['pending', 'in-progress', 'completed', 'cancelled'].includes(value);
    }

    /**
     * 檢查是否為有效的優先級
     */
    static isValidPriority(value: unknown): value is 'low' | 'medium' | 'high' | 'urgent' {
        return typeof value === 'string' && 
               ['low', 'medium', 'high', 'urgent'].includes(value);
    }

    /**
     * 檢查是否為有效的 LLM 提供商
     */
    static isValidLLMProvider(value: unknown): value is 'openai' | 'claude' | 'gemini' {
        return typeof value === 'string' && 
               ['openai', 'claude', 'gemini'].includes(value);
    }

    /**
     * 檢查是否為有效的配置對象
     */
    static isValidConfig(value: unknown): value is Record<string, unknown> {
        return value != null && 
               typeof value === 'object' && 
               !Array.isArray(value);
    }

    /**
     * 安全的類型轉換
     */
    static safeCast<T>(value: unknown, checker: (value: unknown) => value is T, defaultValue: T): T {
        return checker(value) ? value : defaultValue;
    }
}

/**
 * 類型安全的配置管理器
 */
export class TypeSafeConfigManager {
    
    /**
     * 安全獲取字符串配置
     */
    static getString(config: vscode.WorkspaceConfiguration, key: string, defaultValue: string = ''): string {
        const value = config.get(key);
        return typeof value === 'string' ? value : defaultValue;
    }

    /**
     * 安全獲取數字配置
     */
    static getNumber(config: vscode.WorkspaceConfiguration, key: string, defaultValue: number = 0): number {
        const value = config.get(key);
        return typeof value === 'number' && !isNaN(value) ? value : defaultValue;
    }

    /**
     * 安全獲取布爾配置
     */
    static getBoolean(config: vscode.WorkspaceConfiguration, key: string, defaultValue: boolean = false): boolean {
        const value = config.get(key);
        return typeof value === 'boolean' ? value : defaultValue;
    }

    /**
     * 安全獲取數組配置
     */
    static getArray<T>(
        config: vscode.WorkspaceConfiguration, 
        key: string, 
        defaultValue: T[] = [],
        itemChecker?: (item: unknown) => item is T
    ): T[] {
        const value = config.get(key);
        if (!Array.isArray(value)) return defaultValue;
        
        if (itemChecker) {
            return value.filter(itemChecker);
        }
        
        return value as T[];
    }

    /**
     * 安全獲取對象配置
     */
    static getObject<T extends Record<string, unknown>>(
        config: vscode.WorkspaceConfiguration, 
        key: string, 
        defaultValue: T
    ): T {
        const value = config.get(key);
        return RuntimeTypeChecker.isValidConfig(value) ? value as T : defaultValue;
    }
}

/**
 * 類型安全的錯誤處理
 */
export class TypeSafeErrorHandler {
    
    /**
     * 安全的錯誤消息提取
     */
    static extractErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        
        if (typeof error === 'string') {
            return error;
        }
        
        if (error && typeof error === 'object' && 'message' in error) {
            const message = (error as any).message;
            return typeof message === 'string' ? message : '未知錯誤';
        }
        
        return '未知錯誤';
    }

    /**
     * 安全的錯誤堆棧提取
     */
    static extractErrorStack(error: unknown): string | undefined {
        if (error instanceof Error && error.stack) {
            return error.stack;
        }
        return undefined;
    }

    /**
     * 創建類型安全的錯誤對象
     */
    static createSafeError(message: string, code?: string, details?: Record<string, unknown>): Error & {
        code?: string;
        details?: Record<string, unknown>;
    } {
        const error = new Error(message) as Error & {
            code?: string;
            details?: Record<string, unknown>;
        };
        
        if (code) error.code = code;
        if (details) error.details = details;
        
        return error;
    }
}

/**
 * 類型安全的 Promise 工具
 */
export class TypeSafePromiseUtils {
    
    /**
     * 安全的 Promise.all 包裝
     */
    static async safePromiseAll<T>(
        promises: Promise<T>[],
        onError?: (error: unknown, index: number) => void
    ): Promise<(T | null)[]> {
        const results = await Promise.allSettled(promises);
        
        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                if (onError) {
                    onError(result.reason, index);
                }
                return null;
            }
        });
    }

    /**
     * 帶超時的 Promise
     */
    static withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`操作超時 (${timeoutMs}ms)`)), timeoutMs);
            })
        ]);
    }

    /**
     * 重試機制
     */
    static async retry<T>(
        operation: () => Promise<T>,
        maxAttempts: number = 3,
        delayMs: number = 1000
    ): Promise<T> {
        let lastError: unknown;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                }
            }
        }
        
        throw lastError;
    }
}

/**
 * 類型安全的 JSON 處理
 */
export class TypeSafeJsonUtils {
    
    /**
     * 安全的 JSON 解析
     */
    static safeParse<T>(json: string, defaultValue: T): T {
        try {
            const parsed = JSON.parse(json);
            return parsed !== null && parsed !== undefined ? parsed : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    /**
     * 安全的 JSON 字符串化
     */
    static safeStringify(value: unknown, defaultValue: string = '{}'): string {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return defaultValue;
        }
    }

    /**
     * 深度克隆對象
     */
    static deepClone<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime()) as unknown as T;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item)) as unknown as T;
        }
        
        const cloned = {} as T;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        
        return cloned;
    }
}

/**
 * 類型安全的事件發射器
 */
export class TypeSafeEventEmitter<TEvents extends Record<string, any[]>> {
    private listeners = new Map<keyof TEvents, Function[]>();

    /**
     * 添加事件監聽器
     */
    on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
    }

    /**
     * 移除事件監聽器
     */
    off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(listener);
            if (index !== -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    /**
     * 發射事件
     */
    emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(listener => {
                try {
                    listener(...args);
                } catch (error) {
                    console.error(`事件監聽器錯誤 (${String(event)}):`, error);
                }
            });
        }
    }

    /**
     * 清除所有監聽器
     */
    clear(): void {
        this.listeners.clear();
    }
}

/**
 * 導出類型安全工具集合
 */
export const TypeSafetyUtils = {
    RuntimeTypeChecker,
    TypeSafeConfigManager,
    TypeSafeErrorHandler,
    TypeSafePromiseUtils,
    TypeSafeJsonUtils,
    TypeSafeEventEmitter
} as const;
