/**
 * 嚴格類型定義
 * 提供更強的類型安全保證
 */

/**
 * 品牌類型 - 創建名義類型
 */
declare const __brand: unique symbol;
type Brand<T, TBrand> = T & { [__brand]: TBrand };

/**
 * 非空字符串類型
 */
export type NonEmptyString = Brand<string, 'NonEmptyString'>;

export function createNonEmptyString(value: string): NonEmptyString {
    if (!value || value.trim().length === 0) {
        throw new Error('String cannot be empty');
    }
    return value as NonEmptyString;
}

/**
 * 正數類型
 */
export type PositiveNumber = Brand<number, 'PositiveNumber'>;

export function createPositiveNumber(value: number): PositiveNumber {
    if (value <= 0) {
        throw new Error('Number must be positive');
    }
    return value as PositiveNumber;
}

/**
 * 非負數類型
 */
export type NonNegativeNumber = Brand<number, 'NonNegativeNumber'>;

export function createNonNegativeNumber(value: number): NonNegativeNumber {
    if (value < 0) {
        throw new Error('Number cannot be negative');
    }
    return value as NonNegativeNumber;
}

/**
 * URL 類型
 */
export type ValidUrl = Brand<string, 'ValidUrl'>;

export function createValidUrl(value: string): ValidUrl {
    try {
        new URL(value);
        return value as ValidUrl;
    } catch {
        throw new Error('Invalid URL format');
    }
}

/**
 * 電子郵件類型
 */
export type ValidEmail = Brand<string, 'ValidEmail'>;

export function createValidEmail(value: string): ValidEmail {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        throw new Error('Invalid email format');
    }
    return value as ValidEmail;
}

/**
 * 文件路徑類型
 */
export type FilePath = Brand<string, 'FilePath'>;

export function createFilePath(value: string): FilePath {
    if (!value || value.trim().length === 0) {
        throw new Error('File path cannot be empty');
    }
    return value as FilePath;
}

/**
 * API 金鑰類型
 */
export type ApiKey = Brand<string, 'ApiKey'>;

export function createApiKey(value: string): ApiKey {
    if (!value || value.trim().length === 0) {
        throw new Error('API key cannot be empty');
    }
    return value as ApiKey;
}

/**
 * 嚴格的對象類型 - 禁止額外屬性
 */
export type Exact<T> = T & { [K in Exclude<keyof any, keyof T>]?: never };

/**
 * 深度只讀類型
 */
export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends (infer U)[]
        ? DeepReadonlyArray<U>
        : T[P] extends object
        ? DeepReadonly<T[P]>
        : T[P];
};

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

/**
 * 深度可選類型
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
        ? DeepPartialArray<U>
        : T[P] extends object
        ? DeepPartial<T[P]>
        : T[P];
};

interface DeepPartialArray<T> extends Array<DeepPartial<T>> {}

/**
 * 深度必需類型
 */
export type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends (infer U)[]
        ? DeepRequiredArray<U>
        : T[P] extends object
        ? DeepRequired<T[P]>
        : T[P];
};

interface DeepRequiredArray<T> extends Array<DeepRequired<T>> {}

/**
 * 非空數組類型
 */
export type NonEmptyArray<T> = [T, ...T[]];

export function createNonEmptyArray<T>(items: T[]): NonEmptyArray<T> {
    if (items.length === 0) {
        throw new Error('Array cannot be empty');
    }
    return items as NonEmptyArray<T>;
}

/**
 * 字面量聯合類型的鍵
 */
export type LiteralUnion<T extends U, U = string> = T | (U & { _?: never });

/**
 * 提取 Promise 的類型
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * 函數參數類型
 */
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;

/**
 * 函數返回類型
 */
export type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;

/**
 * 構造函數參數類型
 */
export type ConstructorParameters<T extends abstract new (...args: any) => any> = T extends abstract new (...args: infer P) => any ? P : never;

/**
 * 實例類型
 */
export type InstanceType<T extends abstract new (...args: any) => any> = T extends abstract new (...args: any) => infer R ? R : any;

/**
 * 條件類型工具
 */
export type If<C extends boolean, T, F> = C extends true ? T : F;

/**
 * 類型相等檢查
 */
export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

/**
 * 聯合類型轉交集類型
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/**
 * 獲取聯合類型的最後一個類型
 */
export type LastOf<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never;

/**
 * 聯合類型轉元組
 */
export type UnionToTuple<T, L = LastOf<T>, N = [T] extends [never] ? true : false> = true extends N
    ? []
    : [...UnionToTuple<Exclude<T, L>>, L];

/**
 * 嚴格的配置對象類型
 */
export type StrictConfig<T> = {
    readonly [K in keyof T]: T[K];
};

/**
 * 創建嚴格配置
 */
export function createStrictConfig<T>(config: T): StrictConfig<T> {
    return Object.freeze({ ...config });
}

/**
 * 類型安全的事件發射器類型
 */
export interface TypedEventEmitter<TEvents extends Record<string, any[]>> {
    on<TEventName extends keyof TEvents>(
        eventName: TEventName,
        listener: (...args: TEvents[TEventName]) => void
    ): this;

    off<TEventName extends keyof TEvents>(
        eventName: TEventName,
        listener: (...args: TEvents[TEventName]) => void
    ): this;

    emit<TEventName extends keyof TEvents>(
        eventName: TEventName,
        ...args: TEvents[TEventName]
    ): boolean;
}

/**
 * 類型安全的狀態機
 */
export interface TypedStateMachine<TStates extends string, TEvents extends string> {
    readonly currentState: TStates;
    transition(event: TEvents): TStates;
    canTransition(event: TEvents): boolean;
    onStateChange(callback: (from: TStates, to: TStates, event: TEvents) => void): void;
}

/**
 * 類型安全的 Map
 */
export interface TypedMap<TKey extends string | number | symbol, TValue> {
    get(key: TKey): TValue | undefined;
    set(key: TKey, value: TValue): this;
    has(key: TKey): boolean;
    delete(key: TKey): boolean;
    clear(): void;
    keys(): IterableIterator<TKey>;
    values(): IterableIterator<TValue>;
    entries(): IterableIterator<[TKey, TValue]>;
    readonly size: number;
}

/**
 * 創建類型安全的 Map
 */
export function createTypedMap<TKey extends string | number | symbol, TValue>(): TypedMap<TKey, TValue> {
    return new Map() as TypedMap<TKey, TValue>;
}

/**
 * 類型安全的 Set
 */
export interface TypedSet<T> {
    add(value: T): this;
    has(value: T): boolean;
    delete(value: T): boolean;
    clear(): void;
    values(): IterableIterator<T>;
    keys(): IterableIterator<T>;
    entries(): IterableIterator<[T, T]>;
    readonly size: number;
}

/**
 * 創建類型安全的 Set
 */
export function createTypedSet<T>(): TypedSet<T> {
    return new Set() as TypedSet<T>;
}

/**
 * 不可變數組操作
 */
export interface ImmutableArray<T> {
    readonly length: number;
    readonly [index: number]: T;
    [Symbol.iterator](): Iterator<T>;

    append(item: T): ImmutableArray<T>;
    prepend(item: T): ImmutableArray<T>;
    insert(index: number, item: T): ImmutableArray<T>;
    remove(index: number): ImmutableArray<T>;
    update(index: number, item: T): ImmutableArray<T>;
    filter(predicate: (item: T, index: number) => boolean): ImmutableArray<T>;
    map<U>(mapper: (item: T, index: number) => U): ImmutableArray<U>;
    slice(start?: number, end?: number): ImmutableArray<T>;

    // ReadonlyArray methods
    forEach(callbackfn: (value: T, index: number, array: readonly T[]) => void): void;
    indexOf(searchElement: T, fromIndex?: number): number;
    includes(searchElement: T, fromIndex?: number): boolean;
    join(separator?: string): string;
    every(predicate: (value: T, index: number, array: readonly T[]) => boolean): boolean;
    some(predicate: (value: T, index: number, array: readonly T[]) => boolean): boolean;
    find(predicate: (value: T, index: number, obj: readonly T[]) => boolean): T | undefined;
    findIndex(predicate: (value: T, index: number, obj: readonly T[]) => boolean): number;
}

/**
 * 創建不可變數組
 */
export function createImmutableArray<T>(items: T[] = []): ImmutableArray<T> {
    const array = Object.create(Array.prototype) as ImmutableArray<T>;

    // Copy array properties
    Object.defineProperty(array, 'length', {
        value: items.length,
        writable: false,
        enumerable: false,
        configurable: false
    });

    // Copy array elements
    items.forEach((item, index) => {
        Object.defineProperty(array, index, {
            value: item,
            writable: false,
            enumerable: true,
            configurable: false
        });
    });

    // Add iterator
    array[Symbol.iterator] = function* (): Iterator<T> {
        for (let i = 0; i < items.length; i++) {
            yield items[i]!;
        }
    };

    // Add immutable methods
    array.append = (item: T) => createImmutableArray([...items, item]);
    array.prepend = (item: T) => createImmutableArray([item, ...items]);
    array.insert = (index: number, item: T) => {
        const newItems = [...items];
        newItems.splice(index, 0, item);
        return createImmutableArray(newItems);
    };
    array.remove = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        return createImmutableArray(newItems);
    };
    array.update = (index: number, item: T) => {
        const newItems = [...items];
        newItems[index] = item;
        return createImmutableArray(newItems);
    };
    array.filter = (predicate: (item: T, index: number) => boolean) =>
        createImmutableArray(items.filter(predicate));
    array.map = <U>(mapper: (item: T, index: number) => U) =>
        createImmutableArray(items.map(mapper));
    array.slice = (start?: number, end?: number) =>
        createImmutableArray(items.slice(start, end));

    // Add ReadonlyArray methods
    array.forEach = (callbackfn: (value: T, index: number, array: readonly T[]) => void) => {
        items.forEach(callbackfn);
    };
    array.indexOf = (searchElement: T, fromIndex?: number) => items.indexOf(searchElement, fromIndex);
    array.includes = (searchElement: T, fromIndex?: number) => items.includes(searchElement, fromIndex);
    array.join = (separator?: string) => items.join(separator);
    array.every = (predicate: (value: T, index: number, array: readonly T[]) => boolean) => items.every(predicate);
    array.some = (predicate: (value: T, index: number, array: readonly T[]) => boolean) => items.some(predicate);
    array.find = (predicate: (value: T, index: number, obj: readonly T[]) => boolean) => items.find(predicate);
    array.findIndex = (predicate: (value: T, index: number, obj: readonly T[]) => boolean) => items.findIndex(predicate);

    return Object.freeze(array);
}
