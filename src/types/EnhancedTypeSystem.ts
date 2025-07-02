/**
 * 增強型類型系統
 * 提供更嚴格的類型檢查和運行時類型驗證
 */

import * as vscode from 'vscode';
import * as TypeGuards from './TypeGuards';

/**
 * 嚴格的配置類型
 */
export interface StrictConfig {
    readonly apiKeys: Readonly<{
        openai?: string;
        claude?: string;
        gemini?: string;
    }>;
    readonly preferences: Readonly<{
        preferredModel: 'gpt-4o' | 'claude-3-5-sonnet' | 'gemini-2.5-pro';
        maxContextLines: number;
        autoScanTodos: boolean;
        enableCodeIndexing: boolean;
    }>;
    readonly performance: Readonly<{
        cacheSize: number;
        maxConcurrency: number;
        timeoutMs: number;
    }>;
}

/**
 * 嚴格的任務類型
 */
export interface StrictTask {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly status: 'pending' | 'in-progress' | 'completed' | 'failed';
    readonly priority: 'low' | 'medium' | 'high' | 'critical';
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly assignee?: string;
    readonly tags: readonly string[];
    readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * 嚴格的代碼分析結果類型
 */
export interface StrictCodeAnalysis {
    readonly uri: vscode.Uri;
    readonly language: string;
    readonly symbols: readonly StrictSymbol[];
    readonly issues: readonly StrictIssue[];
    readonly metrics: Readonly<{
        complexity: number;
        maintainabilityIndex: number;
        linesOfCode: number;
        testCoverage?: number;
    }>;
    readonly dependencies: readonly string[];
    readonly analyzedAt: Date;
}

/**
 * 嚴格的符號類型
 */
export interface StrictSymbol {
    readonly name: string;
    readonly kind: vscode.SymbolKind;
    readonly range: vscode.Range;
    readonly selectionRange: vscode.Range;
    readonly detail?: string;
    readonly documentation?: string;
    readonly children: readonly StrictSymbol[];
}

/**
 * 嚴格的問題類型
 */
export interface StrictIssue {
    readonly id: string;
    readonly severity: vscode.DiagnosticSeverity;
    readonly message: string;
    readonly range: vscode.Range;
    readonly source: string;
    readonly code?: string | number;
    readonly relatedInformation?: readonly vscode.DiagnosticRelatedInformation[];
    readonly tags?: readonly vscode.DiagnosticTag[];
}

/**
 * 嚴格的 API 響應類型
 */
export interface StrictApiResponse<T = unknown> {
    readonly success: boolean;
    readonly data?: T;
    readonly error?: Readonly<{
        code: string;
        message: string;
        details?: Record<string, unknown>;
    }>;
    readonly timestamp: Date;
    readonly requestId: string;
}

/**
 * 類型驗證器類
 */
export class TypeValidator {

    /**
     * 驗證配置對象
     */
    static validateConfig(value: unknown): value is StrictConfig {
        if (!TypeGuards.isObject(value)) return false;

        // 驗證 apiKeys
        if (!TypeGuards.hasProperty(value, 'apiKeys') ||
            !TypeGuards.isObject(value.apiKeys)) return false;

        // 驗證 preferences
        if (!TypeGuards.hasProperty(value, 'preferences') ||
            !TypeGuards.isObject(value.preferences)) return false;

        const prefs = value.preferences;
        if (!TypeGuards.hasPropertyOfType(prefs, 'preferredModel', TypeGuards.isString) ||
            !['gpt-4o', 'claude-3-5-sonnet', 'gemini-2.5-pro'].includes(prefs.preferredModel) ||
            !TypeGuards.hasPropertyOfType(prefs, 'maxContextLines', TypeGuards.isPositiveNumber) ||
            !TypeGuards.hasPropertyOfType(prefs, 'autoScanTodos', TypeGuards.isBoolean) ||
            !TypeGuards.hasPropertyOfType(prefs, 'enableCodeIndexing', TypeGuards.isBoolean)) {
            return false;
        }

        // 驗證 performance
        if (!TypeGuards.hasProperty(value, 'performance') ||
            !TypeGuards.isObject(value.performance)) return false;

        const perf = value.performance;
        if (!TypeGuards.hasPropertyOfType(perf, 'cacheSize', TypeGuards.isPositiveNumber) ||
            !TypeGuards.hasPropertyOfType(perf, 'maxConcurrency', TypeGuards.isPositiveNumber) ||
            !TypeGuards.hasPropertyOfType(perf, 'timeoutMs', TypeGuards.isPositiveNumber)) {
            return false;
        }

        return true;
    }

    /**
     * 驗證任務對象
     */
    static validateTask(value: unknown): value is StrictTask {
        if (!TypeGuards.isObject(value)) return false;

        return TypeGuards.hasPropertyOfType(value, 'id', TypeGuards.isNonEmptyString) &&
               TypeGuards.hasPropertyOfType(value, 'title', TypeGuards.isNonEmptyString) &&
               TypeGuards.hasPropertyOfType(value, 'description', TypeGuards.isString) &&
               TypeGuards.hasProperty(value, 'status') &&
               ['pending', 'in-progress', 'completed', 'failed'].includes(value.status as string) &&
               TypeGuards.hasProperty(value, 'priority') &&
               ['low', 'medium', 'high', 'critical'].includes(value.priority as string) &&
               TypeGuards.hasPropertyOfType(value, 'createdAt', TypeGuards.isDate) &&
               TypeGuards.hasPropertyOfType(value, 'updatedAt', TypeGuards.isDate) &&
               TypeGuards.hasPropertyOfType(value, 'tags', TypeGuards.isStringArray) &&
               TypeGuards.hasPropertyOfType(value, 'metadata', TypeGuards.isObject);
    }

    /**
     * 驗證代碼分析結果
     */
    static validateCodeAnalysis(value: unknown): value is StrictCodeAnalysis {
        if (!TypeGuards.isObject(value)) return false;

        return TypeGuards.hasPropertyOfType(value, 'uri', TypeGuards.isVSCodeUri) &&
               TypeGuards.hasPropertyOfType(value, 'language', TypeGuards.isNonEmptyString) &&
               TypeGuards.hasProperty(value, 'symbols') &&
               TypeGuards.isArray(value.symbols) &&
               TypeGuards.hasProperty(value, 'issues') &&
               TypeGuards.isArray(value.issues) &&
               TypeGuards.hasPropertyOfType(value, 'metrics', TypeGuards.isObject) &&
               TypeGuards.hasPropertyOfType(value, 'dependencies', TypeGuards.isStringArray) &&
               TypeGuards.hasPropertyOfType(value, 'analyzedAt', TypeGuards.isDate);
    }

    /**
     * 驗證 API 響應
     */
    static validateApiResponse<T>(
        value: unknown,
        dataValidator?: (data: unknown) => data is T
    ): value is StrictApiResponse<T> {
        if (!TypeGuards.isObject(value)) return false;

        const hasValidStructure =
            TypeGuards.hasPropertyOfType(value, 'success', TypeGuards.isBoolean) &&
            TypeGuards.hasPropertyOfType(value, 'timestamp', TypeGuards.isDate) &&
            TypeGuards.hasPropertyOfType(value, 'requestId', TypeGuards.isNonEmptyString);

        if (!hasValidStructure) return false;

        // 如果成功，檢查數據
        if (value.success) {
            if (!TypeGuards.hasProperty(value, 'data')) return false;
            if (dataValidator && !dataValidator(value.data)) return false;
        } else {
            // 如果失敗，檢查錯誤
            if (!TypeGuards.hasProperty(value, 'error') ||
                !TypeGuards.isObject(value.error)) return false;

            const error = value.error;
            if (!TypeGuards.hasPropertyOfType(error, 'code', TypeGuards.isNonEmptyString) ||
                !TypeGuards.hasPropertyOfType(error, 'message', TypeGuards.isNonEmptyString)) {
                return false;
            }
        }

        return true;
    }
}

/**
 * 類型安全的工廠函數
 */
export class TypeSafeFactory {

    /**
     * 創建嚴格的配置對象
     */
    static createConfig(partial: Partial<StrictConfig>): StrictConfig {
        const defaultConfig: StrictConfig = {
            apiKeys: {},
            preferences: {
                preferredModel: 'claude-3-5-sonnet',
                maxContextLines: 100,
                autoScanTodos: true,
                enableCodeIndexing: true
            },
            performance: {
                cacheSize: 50 * 1024 * 1024, // 50MB
                maxConcurrency: 5,
                timeoutMs: 30000 // 30秒
            }
        };

        return {
            ...defaultConfig,
            ...partial,
            apiKeys: { ...defaultConfig.apiKeys, ...partial.apiKeys },
            preferences: { ...defaultConfig.preferences, ...partial.preferences },
            performance: { ...defaultConfig.performance, ...partial.performance }
        };
    }

    /**
     * 創建嚴格的任務對象
     */
    static createTask(partial: Partial<StrictTask> & Pick<StrictTask, 'title'>): StrictTask {
        const now = new Date();

        return {
            id: partial.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: partial.title,
            description: partial.description || '',
            status: partial.status || 'pending',
            priority: partial.priority || 'medium',
            createdAt: partial.createdAt || now,
            updatedAt: partial.updatedAt || now,
            assignee: partial.assignee,
            tags: partial.tags || [],
            metadata: partial.metadata || {}
        };
    }

    /**
     * 創建嚴格的 API 響應對象
     */
    static createApiResponse<T>(
        success: boolean,
        data?: T,
        error?: { code: string; message: string; details?: Record<string, unknown> }
    ): StrictApiResponse<T> {
        return {
            success,
            data,
            error,
            timestamp: new Date(),
            requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
    }

    /**
     * 創建成功的 API 響應
     */
    static createSuccessResponse<T>(data: T): StrictApiResponse<T> {
        return this.createApiResponse(true, data);
    }

    /**
     * 創建錯誤的 API 響應
     */
    static createErrorResponse(
        code: string,
        message: string,
        details?: Record<string, unknown>
    ): StrictApiResponse<never> {
        return this.createApiResponse(false, undefined, { code, message, details });
    }
}

/**
 * 類型安全的轉換器
 */
export class TypeSafeConverter {

    /**
     * 安全地轉換為配置對象
     */
    static toConfig(value: unknown): StrictConfig | null {
        if (TypeValidator.validateConfig(value)) {
            return value;
        }

        // 嘗試修復常見問題
        if (TypeGuards.isObject(value)) {
            try {
                return TypeSafeFactory.createConfig(value as Partial<StrictConfig>);
            } catch {
                return null;
            }
        }

        return null;
    }

    /**
     * 安全地轉換為任務對象
     */
    static toTask(value: unknown): StrictTask | null {
        if (TypeValidator.validateTask(value)) {
            return value;
        }

        // 嘗試修復常見問題
        if (TypeGuards.isObject(value) && TypeGuards.hasPropertyOfType(value, 'title', TypeGuards.isString)) {
            try {
                return TypeSafeFactory.createTask(value as Partial<StrictTask> & { title: string });
            } catch {
                return null;
            }
        }

        return null;
    }

    /**
     * 安全地轉換數組
     */
    static toArray<T>(
        value: unknown,
        itemConverter: (item: unknown) => T | null
    ): T[] {
        if (!TypeGuards.isArray(value)) return [];

        return value
            .map(itemConverter)
            .filter(TypeGuards.isNotNullish);
    }
}

/**
 * 運行時類型檢查裝飾器
 */
export function validateParams<T extends any[]>(
    ...validators: { [K in keyof T]: (value: unknown) => value is T[K] }
) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            for (let i = 0; i < validators.length; i++) {
                if (!validators[i](args[i])) {
                    throw new TypeError(`參數 ${i} 類型驗證失敗`);
                }
            }

            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * 返回值類型檢查裝飾器
 */
export function validateReturn<T>(validator: (value: unknown) => value is T) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const result = originalMethod.apply(this, args);

            if (!validator(result)) {
                throw new TypeError(`返回值類型驗證失敗`);
            }

            return result;
        };

        return descriptor;
    };
}
