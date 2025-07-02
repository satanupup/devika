import * as vscode from 'vscode';

/**
 * 驗證規則接口
 */
export interface ValidationRule<T = any> {
    validate: (value: T) => boolean;
    message: string;
}

/**
 * 驗證結果接口
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * 字符串驗證選項
 */
export interface StringValidationOptions {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowEmpty?: boolean;
    trim?: boolean;
}

/**
 * 數字驗證選項
 */
export interface NumberValidationOptions {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
}

/**
 * 統一的驗證工具類
 * 提供常用的數據驗證功能
 */
export class ValidationUtils {
    
    /**
     * 驗證必需值
     */
    static validateRequired<T>(value: T, name: string): T {
        if (value === null || value === undefined) {
            throw new Error(`${name} 是必需的`);
        }
        return value;
    }

    /**
     * 驗證字符串
     */
    static validateString(
        value: unknown,
        name: string,
        options: StringValidationOptions = {}
    ): string {
        if (typeof value !== 'string') {
            throw new Error(`${name} 必須是字符串`);
        }

        let processedValue = options.trim ? value.trim() : value;

        if (!options.allowEmpty && processedValue.length === 0) {
            throw new Error(`${name} 不能為空`);
        }

        if (options.minLength !== undefined && processedValue.length < options.minLength) {
            throw new Error(`${name} 長度不能少於 ${options.minLength} 個字符`);
        }

        if (options.maxLength !== undefined && processedValue.length > options.maxLength) {
            throw new Error(`${name} 長度不能超過 ${options.maxLength} 個字符`);
        }

        if (options.pattern && !options.pattern.test(processedValue)) {
            throw new Error(`${name} 格式不正確`);
        }

        return processedValue;
    }

    /**
     * 驗證數字
     */
    static validateNumber(
        value: unknown,
        name: string,
        options: NumberValidationOptions = {}
    ): number {
        const num = typeof value === 'string' ? parseFloat(value) : value;

        if (typeof num !== 'number' || isNaN(num)) {
            throw new Error(`${name} 必須是有效數字`);
        }

        if (options.integer && !Number.isInteger(num)) {
            throw new Error(`${name} 必須是整數`);
        }

        if (options.positive && num <= 0) {
            throw new Error(`${name} 必須是正數`);
        }

        if (options.min !== undefined && num < options.min) {
            throw new Error(`${name} 不能小於 ${options.min}`);
        }

        if (options.max !== undefined && num > options.max) {
            throw new Error(`${name} 不能大於 ${options.max}`);
        }

        return num;
    }

    /**
     * 驗證布爾值
     */
    static validateBoolean(value: unknown, name: string): boolean {
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            if (lowerValue === 'true' || lowerValue === '1') {
                return true;
            }
            if (lowerValue === 'false' || lowerValue === '0') {
                return false;
            }
        }

        if (typeof value === 'number') {
            return value !== 0;
        }

        throw new Error(`${name} 必須是布爾值`);
    }

    /**
     * 驗證 URI
     */
    static validateUri(value: unknown, name: string): vscode.Uri {
        if (value instanceof vscode.Uri) {
            return value;
        }

        if (typeof value === 'string') {
            try {
                return vscode.Uri.parse(value);
            } catch (error) {
                throw new Error(`${name} 不是有效的 URI: ${value}`);
            }
        }

        throw new Error(`${name} 必須是有效的 URI`);
    }

    /**
     * 驗證數組
     */
    static validateArray<T>(
        value: unknown,
        name: string,
        itemValidator?: (item: unknown, index: number) => T
    ): T[] {
        if (!Array.isArray(value)) {
            throw new Error(`${name} 必須是數組`);
        }

        if (itemValidator) {
            return value.map((item, index) => {
                try {
                    return itemValidator(item, index);
                } catch (error) {
                    throw new Error(`${name}[${index}]: ${error}`);
                }
            });
        }

        return value as T[];
    }

    /**
     * 驗證對象
     */
    static validateObject<T extends Record<string, any>>(
        value: unknown,
        name: string,
        schema: { [K in keyof T]: (value: unknown) => T[K] }
    ): T {
        if (!value || typeof value !== 'object') {
            throw new Error(`${name} 必須是對象`);
        }

        const obj = value as Record<string, unknown>;
        const result = {} as T;

        for (const [key, validator] of Object.entries(schema)) {
            try {
                result[key as keyof T] = validator(obj[key]);
            } catch (error) {
                throw new Error(`${name}.${key}: ${error}`);
            }
        }

        return result;
    }

    /**
     * 驗證電子郵件
     */
    static validateEmail(value: unknown, name: string): string {
        const email = this.validateString(value, name);
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailPattern.test(email)) {
            throw new Error(`${name} 不是有效的電子郵件地址`);
        }

        return email;
    }

    /**
     * 驗證 URL
     */
    static validateUrl(value: unknown, name: string): string {
        const url = this.validateString(value, name);
        
        try {
            new URL(url);
            return url;
        } catch (error) {
            throw new Error(`${name} 不是有效的 URL`);
        }
    }

    /**
     * 驗證文件路徑
     */
    static validateFilePath(value: unknown, name: string): string {
        const path = this.validateString(value, name);
        
        // 基本路徑驗證
        const invalidChars = /[<>:"|?*]/;
        if (invalidChars.test(path)) {
            throw new Error(`${name} 包含無效字符`);
        }

        return path;
    }

    /**
     * 驗證 JSON 字符串
     */
    static validateJson<T = any>(value: unknown, name: string): T {
        const jsonString = this.validateString(value, name);
        
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            throw new Error(`${name} 不是有效的 JSON 格式`);
        }
    }

    /**
     * 驗證枚舉值
     */
    static validateEnum<T extends string | number>(
        value: unknown,
        name: string,
        enumValues: T[]
    ): T {
        if (!enumValues.includes(value as T)) {
            throw new Error(`${name} 必須是以下值之一: ${enumValues.join(', ')}`);
        }

        return value as T;
    }

    /**
     * 批量驗證
     */
    static validateBatch(
        validators: Array<() => void>
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const validator of validators) {
            try {
                validator();
            } catch (error) {
                if (error instanceof Error) {
                    errors.push(error.message);
                } else {
                    errors.push(String(error));
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 創建自定義驗證規則
     */
    static createRule<T>(
        validate: (value: T) => boolean,
        message: string
    ): ValidationRule<T> {
        return { validate, message };
    }

    /**
     * 應用驗證規則
     */
    static applyRules<T>(
        value: T,
        name: string,
        rules: ValidationRule<T>[]
    ): T {
        for (const rule of rules) {
            if (!rule.validate(value)) {
                throw new Error(`${name}: ${rule.message}`);
            }
        }
        return value;
    }

    /**
     * 安全驗證（不拋出異常）
     */
    static safeValidate<T>(
        validator: () => T,
        fallback: T
    ): { value: T; error?: string } {
        try {
            return { value: validator() };
        } catch (error) {
            return {
                value: fallback,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 驗證配置對象
     */
    static validateConfiguration(
        config: Record<string, unknown>,
        schema: Record<string, (value: unknown) => any>
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const [key, validator] of Object.entries(schema)) {
            try {
                validator(config[key]);
            } catch (error) {
                errors.push(`配置項 ${key}: ${error}`);
            }
        }

        // 檢查未知配置項
        for (const key of Object.keys(config)) {
            if (!(key in schema)) {
                warnings.push(`未知配置項: ${key}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 驗證 API 密鑰格式
     */
    static validateApiKey(value: unknown, name: string): string {
        const apiKey = this.validateString(value, name, {
            minLength: 10,
            trim: true
        });

        // 基本格式檢查
        if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
            throw new Error(`${name} 格式不正確，只能包含字母、數字、下劃線和連字符`);
        }

        return apiKey;
    }
}
