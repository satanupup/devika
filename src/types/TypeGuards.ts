/**
 * TypeScript 類型守衛和工具函數
 * 提供運行時類型檢查和類型安全保證
 */

/**
 * 檢查值是否為字符串
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * 檢查值是否為數字
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

/**
 * 檢查值是否為布爾值
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

/**
 * 檢查值是否為對象（非 null）
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 檢查值是否為數組
 */
export function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

/**
 * 檢查值是否為字符串數組
 */
export function isStringArray(value: unknown): value is string[] {
    return isArray(value) && value.every(isString);
}

/**
 * 檢查值是否為 VSCode Uri 對象
 */
export function isVSCodeUri(value: unknown): value is import('vscode').Uri {
    return isObject(value) && 'fsPath' in value && 'scheme' in value;
}

/**
 * 檢查值是否不為 null 或 undefined
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

/**
 * 檢查值是否為函數
 */
export function isFunction(value: unknown): value is Function {
    return typeof value === 'function';
}

/**
 * 檢查值是否為 undefined
 */
export function isUndefined(value: unknown): value is undefined {
    return value === undefined;
}

/**
 * 檢查值是否為 null
 */
export function isNull(value: unknown): value is null {
    return value === null;
}

/**
 * 檢查值是否為 null 或 undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

/**
 * 檢查值是否為非空字符串
 */
export function isNonEmptyString(value: unknown): value is string {
    return isString(value) && value.trim().length > 0;
}

/**
 * 檢查值是否為正數
 */
export function isPositiveNumber(value: unknown): value is number {
    return isNumber(value) && value > 0;
}

/**
 * 檢查值是否為非負數
 */
export function isNonNegativeNumber(value: unknown): value is number {
    return isNumber(value) && value >= 0;
}

/**
 * 檢查值是否為整數
 */
export function isInteger(value: unknown): value is number {
    return isNumber(value) && Number.isInteger(value);
}

/**
 * 檢查值是否為有效的 URL
 */
export function isValidUrl(value: unknown): value is string {
    if (!isString(value)) {
        return false;
    }

    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * 檢查值是否為有效的電子郵件
 */
export function isValidEmail(value: unknown): value is string {
    if (!isString(value)) {
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
}

/**
 * 檢查值是否為有效的 JSON 字符串
 */
export function isValidJson(value: unknown): value is string {
    if (!isString(value)) {
        return false;
    }

    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * 檢查對象是否具有指定的屬性
 */
export function hasProperty<T extends Record<string, unknown>, K extends string>(
    obj: T,
    key: K
): obj is T & Record<K, unknown> {
    return key in obj;
}

/**
 * 檢查對象是否具有指定類型的屬性
 */
export function hasPropertyOfType<T extends Record<string, unknown>, K extends string, V>(
    obj: T,
    key: K,
    typeGuard: (value: unknown) => value is V
): obj is T & Record<K, V> {
    return key in obj && typeGuard(obj[key]);
}

/**
 * 檢查值是否為指定枚舉的成員
 */
export function isEnumValue<T extends Record<string, string | number>>(
    enumObject: T,
    value: unknown
): value is T[keyof T] {
    return Object.values(enumObject).includes(value as T[keyof T]);
}

/**
 * 檢查數組是否包含指定類型的元素
 */
export function isArrayOf<T>(
    value: unknown,
    typeGuard: (item: unknown) => item is T
): value is T[] {
    return isArray(value) && value.every(typeGuard);
}

/**
 * 檢查值是否為 Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
    return value instanceof Promise;
}

/**
 * 檢查值是否為 Error 對象
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

/**
 * 檢查值是否為 Date 對象
 */
export function isDate(value: unknown): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
}

/**
 * 檢查值是否為 RegExp 對象
 */
export function isRegExp(value: unknown): value is RegExp {
    return value instanceof RegExp;
}

/**
 * 安全的類型轉換函數
 */
export class TypeConverter {
    /**
     * 安全地轉換為字符串
     */
    static toString(value: unknown, defaultValue: string = ''): string {
        if (isString(value)) {
            return value;
        }
        if (isNumber(value) || isBoolean(value)) {
            return String(value);
        }
        return defaultValue;
    }

    /**
     * 安全地轉換為數字
     */
    static toNumber(value: unknown, defaultValue: number = 0): number {
        if (isNumber(value)) {
            return value;
        }
        if (isString(value)) {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? defaultValue : parsed;
        }
        return defaultValue;
    }

    /**
     * 安全地轉換為布爾值
     */
    static toBoolean(value: unknown, defaultValue: boolean = false): boolean {
        if (isBoolean(value)) {
            return value;
        }
        if (isString(value)) {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1' || lower === 'yes') {
                return true;
            }
            if (lower === 'false' || lower === '0' || lower === 'no') {
                return false;
            }
        }
        if (isNumber(value)) {
            return value !== 0;
        }
        return defaultValue;
    }

    /**
     * 安全地轉換為數組
     */
    static toArray<T>(value: unknown, defaultValue: T[] = []): T[] {
        if (isArray(value)) {
            return value as T[];
        }
        if (value !== null && value !== undefined) {
            return [value as T];
        }
        return defaultValue;
    }

    /**
     * 安全地轉換為對象
     */
    static toObject(value: unknown, defaultValue: Record<string, unknown> = {}): Record<string, unknown> {
        if (isObject(value)) {
            return value;
        }
        if (isString(value) && isValidJson(value)) {
            try {
                const parsed = JSON.parse(value);
                return isObject(parsed) ? parsed : defaultValue;
            } catch {
                return defaultValue;
            }
        }
        return defaultValue;
    }
}

/**
 * 類型斷言工具
 */
export class TypeAssertion {
    /**
     * 斷言值為字符串
     */
    static assertString(value: unknown, message?: string): asserts value is string {
        if (!isString(value)) {
            throw new TypeError(message || `Expected string, got ${typeof value}`);
        }
    }

    /**
     * 斷言值為數字
     */
    static assertNumber(value: unknown, message?: string): asserts value is number {
        if (!isNumber(value)) {
            throw new TypeError(message || `Expected number, got ${typeof value}`);
        }
    }

    /**
     * 斷言值為布爾值
     */
    static assertBoolean(value: unknown, message?: string): asserts value is boolean {
        if (!isBoolean(value)) {
            throw new TypeError(message || `Expected boolean, got ${typeof value}`);
        }
    }

    /**
     * 斷言值為對象
     */
    static assertObject(value: unknown, message?: string): asserts value is Record<string, unknown> {
        if (!isObject(value)) {
            throw new TypeError(message || `Expected object, got ${typeof value}`);
        }
    }

    /**
     * 斷言值為數組
     */
    static assertArray(value: unknown, message?: string): asserts value is unknown[] {
        if (!isArray(value)) {
            throw new TypeError(message || `Expected array, got ${typeof value}`);
        }
    }

    /**
     * 斷言值不為 null 或 undefined
     */
    static assertNotNullOrUndefined<T>(value: T | null | undefined, message?: string): asserts value is T {
        if (isNullOrUndefined(value)) {
            throw new TypeError(message || 'Value cannot be null or undefined');
        }
    }

    /**
     * 斷言值為非空字符串
     */
    static assertNonEmptyString(value: unknown, message?: string): asserts value is string {
        if (!isNonEmptyString(value)) {
            throw new TypeError(message || 'Expected non-empty string');
        }
    }

    /**
     * 斷言值為正數
     */
    static assertPositiveNumber(value: unknown, message?: string): asserts value is number {
        if (!isPositiveNumber(value)) {
            throw new TypeError(message || 'Expected positive number');
        }
    }
}

/**
 * 可選值處理工具
 */
export class Optional<T> {
    private constructor(private readonly value: T | null | undefined) {}

    static of<T>(value: T | null | undefined): Optional<T> {
        return new Optional(value);
    }

    static empty<T>(): Optional<T> {
        return new Optional<T>(null);
    }

    isPresent(): boolean {
        return !isNullOrUndefined(this.value);
    }

    isEmpty(): boolean {
        return isNullOrUndefined(this.value);
    }

    get(): T {
        if (isNullOrUndefined(this.value)) {
            throw new Error('No value present');
        }
        return this.value;
    }

    orElse(defaultValue: T): T {
        return isNullOrUndefined(this.value) ? defaultValue : this.value;
    }

    orElseGet(supplier: () => T): T {
        return isNullOrUndefined(this.value) ? supplier() : this.value;
    }

    orElseThrow(errorSupplier?: () => Error): T {
        if (isNullOrUndefined(this.value)) {
            throw errorSupplier ? errorSupplier() : new Error('No value present');
        }
        return this.value;
    }

    map<U>(mapper: (value: T) => U): Optional<U> {
        return isNullOrUndefined(this.value)
            ? Optional.empty<U>()
            : Optional.of(mapper(this.value));
    }

    filter(predicate: (value: T) => boolean): Optional<T> {
        return isNullOrUndefined(this.value) || !predicate(this.value)
            ? Optional.empty<T>()
            : this;
    }

    ifPresent(consumer: (value: T) => void): void {
        if (!isNullOrUndefined(this.value)) {
            consumer(this.value);
        }
    }
}

/**
 * 結果類型，用於處理可能失敗的操作
 */
export abstract class Result<T, E = Error> {
    abstract isSuccess(): this is Success<T, E>;
    abstract isFailure(): this is Failure<T, E>;
    abstract getValue(): T;
    abstract getError(): E;
    abstract map<U>(mapper: (value: T) => U): Result<U, E>;
    abstract flatMap<U>(mapper: (value: T) => Result<U, E>): Result<U, E>;
    abstract mapError<F>(mapper: (error: E) => F): Result<T, F>;
    abstract orElse(defaultValue: T): T;
    abstract orElseGet(supplier: () => T): T;
    abstract orElseThrow(): T;

    static success<T, E = Error>(value: T): Result<T, E> {
        return new Success(value);
    }

    static failure<T, E = Error>(error: E): Result<T, E> {
        return new Failure(error);
    }

    static from<T>(supplier: () => T): Result<T, Error> {
        try {
            return Result.success(supplier());
        } catch (error) {
            return Result.failure(error instanceof Error ? error : new Error(String(error)));
        }
    }

    static async fromAsync<T>(supplier: () => Promise<T>): Promise<Result<T, Error>> {
        try {
            const value = await supplier();
            return Result.success(value);
        } catch (error) {
            return Result.failure(error instanceof Error ? error : new Error(String(error)));
        }
    }
}

class Success<T, E> extends Result<T, E> {
    constructor(private readonly value: T) {
        super();
    }

    isSuccess(): this is Success<T, E> {
        return true;
    }

    isFailure(): this is Failure<T, E> {
        return false;
    }

    getValue(): T {
        return this.value;
    }

    getError(): E {
        throw new Error('Cannot get error from Success');
    }

    map<U>(mapper: (value: T) => U): Result<U, E> {
        return Result.success(mapper(this.value));
    }

    flatMap<U>(mapper: (value: T) => Result<U, E>): Result<U, E> {
        return mapper(this.value);
    }

    mapError<F>(_mapper: (error: E) => F): Result<T, F> {
        return Result.success(this.value);
    }

    orElse(_defaultValue: T): T {
        return this.value;
    }

    orElseGet(_supplier: () => T): T {
        return this.value;
    }

    orElseThrow(): T {
        return this.value;
    }
}

class Failure<T, E> extends Result<T, E> {
    constructor(private readonly error: E) {
        super();
    }

    isSuccess(): this is Success<T, E> {
        return false;
    }

    isFailure(): this is Failure<T, E> {
        return true;
    }

    getValue(): T {
        throw new Error('Cannot get value from Failure');
    }

    getError(): E {
        return this.error;
    }

    map<U>(_mapper: (value: T) => U): Result<U, E> {
        return Result.failure(this.error);
    }

    flatMap<U>(_mapper: (value: T) => Result<U, E>): Result<U, E> {
        return Result.failure(this.error);
    }

    mapError<F>(mapper: (error: E) => F): Result<T, F> {
        return Result.failure(mapper(this.error));
    }

    orElse(defaultValue: T): T {
        return defaultValue;
    }

    orElseGet(supplier: () => T): T {
        return supplier();
    }

    orElseThrow(): T {
        if (this.error instanceof Error) {
            throw this.error;
        }
        throw new Error(String(this.error));
    }
}
