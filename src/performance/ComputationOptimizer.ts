import * as vscode from 'vscode';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 計算緩存項目
 */
interface CacheItem<T> {
    value: T;
    timestamp: number;
    accessCount: number;
    computationTime: number;
}

/**
 * 計算統計
 */
interface ComputationStats {
    totalCalls: number;
    cacheHits: number;
    cacheMisses: number;
    totalComputationTime: number;
    averageComputationTime: number;
    cacheHitRate: number;
}

/**
 * 記憶化選項
 */
interface MemoizationOptions {
    maxCacheSize: number;
    ttl: number; // 生存時間（毫秒）
    keyGenerator?: (...args: any[]) => string;
    shouldCache?: (result: any) => boolean;
}

/**
 * 計算優化器
 * 識別並優化重複的計算和無效的迴圈
 */
export class ComputationOptimizer {
    private static instance: ComputationOptimizer;
    private memoCache = new Map<string, CacheItem<any>>();
    private computationStats = new Map<string, ComputationStats>();
    private debounceTimers = new Map<string, NodeJS.Timeout>();
    private throttleLastCall = new Map<string, number>();

    private constructor() {
        // 定期清理過期緩存
        setInterval(() => this.cleanupExpiredCache(), 5 * 60 * 1000); // 5分鐘
    }

    static getInstance(): ComputationOptimizer {
        if (!ComputationOptimizer.instance) {
            ComputationOptimizer.instance = new ComputationOptimizer();
        }
        return ComputationOptimizer.instance;
    }

    /**
     * 記憶化函數
     */
    memoize<T extends (...args: any[]) => any>(
        fn: T,
        options: Partial<MemoizationOptions> = {}
    ): T {
        const opts: MemoizationOptions = {
            maxCacheSize: 100,
            ttl: 30 * 60 * 1000, // 30分鐘
            keyGenerator: (...args) => JSON.stringify(args),
            shouldCache: () => true,
            ...options
        };

        const fnName = fn.name || 'anonymous';
        
        // 初始化統計
        if (!this.computationStats.has(fnName)) {
            this.computationStats.set(fnName, {
                totalCalls: 0,
                cacheHits: 0,
                cacheMisses: 0,
                totalComputationTime: 0,
                averageComputationTime: 0,
                cacheHitRate: 0
            });
        }

        return ((...args: Parameters<T>) => {
            const key = `${fnName}:${opts.keyGenerator!(...args)}`;
            const stats = this.computationStats.get(fnName)!;
            stats.totalCalls++;

            // 檢查緩存
            const cached = this.memoCache.get(key);
            if (cached && Date.now() - cached.timestamp < opts.ttl) {
                cached.accessCount++;
                stats.cacheHits++;
                stats.cacheHitRate = stats.cacheHits / stats.totalCalls;
                return cached.value;
            }

            // 計算新值
            const startTime = Date.now();
            const result = fn(...args);
            const computationTime = Date.now() - startTime;

            stats.cacheMisses++;
            stats.totalComputationTime += computationTime;
            stats.averageComputationTime = stats.totalComputationTime / stats.cacheMisses;
            stats.cacheHitRate = stats.cacheHits / stats.totalCalls;

            // 緩存結果
            if (opts.shouldCache!(result)) {
                this.setCacheItem(key, result, computationTime, opts.maxCacheSize);
            }

            return result;
        }) as T;
    }

    /**
     * 防抖函數
     */
    debounce<T extends (...args: any[]) => any>(
        fn: T,
        delay: number,
        immediate: boolean = false
    ): T {
        const fnName = fn.name || 'anonymous';
        
        return ((...args: Parameters<T>) => {
            const key = `debounce:${fnName}`;
            const callNow = immediate && !this.debounceTimers.has(key);
            
            // 清除之前的定時器
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // 設置新的定時器
            const timer = setTimeout(() => {
                this.debounceTimers.delete(key);
                if (!immediate) {
                    fn(...args);
                }
            }, delay);
            
            this.debounceTimers.set(key, timer);

            if (callNow) {
                return fn(...args);
            }
        }) as T;
    }

    /**
     * 節流函數
     */
    throttle<T extends (...args: any[]) => any>(
        fn: T,
        limit: number
    ): T {
        const fnName = fn.name || 'anonymous';
        
        return ((...args: Parameters<T>) => {
            const key = `throttle:${fnName}`;
            const now = Date.now();
            const lastCall = this.throttleLastCall.get(key) || 0;

            if (now - lastCall >= limit) {
                this.throttleLastCall.set(key, now);
                return fn(...args);
            }
        }) as T;
    }

    /**
     * 批量處理優化
     */
    batchProcess<T, R>(
        items: T[],
        processor: (batch: T[]) => Promise<R[]>,
        batchSize: number = 10,
        delay: number = 0
    ): Promise<R[]> {
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const results: R[] = [];
                
                for (let i = 0; i < items.length; i += batchSize) {
                    const batch = items.slice(i, i + batchSize);
                    const batchResults = await processor(batch);
                    results.push(...batchResults);
                    
                    // 添加延遲以避免阻塞
                    if (delay > 0 && i + batchSize < items.length) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                
                return results;
            },
            '批量處理',
            { logError: true, showToUser: false }
        ).then(result => result.success ? result.data! : []);
    }

    /**
     * 惰性計算
     */
    lazy<T>(computation: () => T): () => T {
        let computed = false;
        let result: T;

        return () => {
            if (!computed) {
                result = computation();
                computed = true;
            }
            return result;
        };
    }

    /**
     * 異步惰性計算
     */
    lazyAsync<T>(computation: () => Promise<T>): () => Promise<T> {
        let promise: Promise<T> | null = null;

        return () => {
            if (!promise) {
                promise = computation();
            }
            return promise;
        };
    }

    /**
     * 循環優化 - 提前退出
     */
    optimizedFind<T>(
        array: T[],
        predicate: (item: T, index: number) => boolean,
        maxIterations?: number
    ): T | undefined {
        const limit = maxIterations || array.length;
        
        for (let i = 0; i < Math.min(array.length, limit); i++) {
            if (predicate(array[i], i)) {
                return array[i];
            }
        }
        
        return undefined;
    }

    /**
     * 循環優化 - 分塊處理
     */
    async optimizedForEach<T>(
        array: T[],
        callback: (item: T, index: number) => Promise<void> | void,
        chunkSize: number = 100,
        delay: number = 0
    ): Promise<void> {
        for (let i = 0; i < array.length; i += chunkSize) {
            const chunk = array.slice(i, i + chunkSize);
            
            await Promise.all(
                chunk.map((item, chunkIndex) => 
                    callback(item, i + chunkIndex)
                )
            );
            
            // 添加延遲以避免阻塞
            if (delay > 0 && i + chunkSize < array.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * 重複計算檢測
     */
    detectDuplicateComputations(): Array<{
        functionName: string;
        duplicateRate: number;
        suggestions: string[];
    }> {
        const results: Array<{
            functionName: string;
            duplicateRate: number;
            suggestions: string[];
        }> = [];

        for (const [fnName, stats] of this.computationStats.entries()) {
            if (stats.totalCalls > 10) { // 只分析調用次數較多的函數
                const duplicateRate = 1 - stats.cacheHitRate;
                const suggestions: string[] = [];

                if (duplicateRate > 0.7) {
                    suggestions.push('考慮增加緩存大小');
                    suggestions.push('檢查是否有不必要的重複調用');
                }

                if (stats.averageComputationTime > 100) {
                    suggestions.push('考慮異步處理');
                    suggestions.push('檢查是否可以優化算法');
                }

                if (duplicateRate > 0.5 || stats.averageComputationTime > 50) {
                    results.push({
                        functionName: fnName,
                        duplicateRate,
                        suggestions
                    });
                }
            }
        }

        return results.sort((a, b) => b.duplicateRate - a.duplicateRate);
    }

    /**
     * 獲取計算統計
     */
    getComputationStats(): Map<string, ComputationStats> {
        return new Map(this.computationStats);
    }

    /**
     * 清除特定函數的緩存
     */
    clearCache(functionName?: string): void {
        if (functionName) {
            const keysToDelete = Array.from(this.memoCache.keys())
                .filter(key => key.startsWith(`${functionName}:`));
            keysToDelete.forEach(key => this.memoCache.delete(key));
        } else {
            this.memoCache.clear();
        }
    }

    /**
     * 獲取緩存統計
     */
    getCacheStats(): {
        totalItems: number;
        totalMemoryUsage: number;
        hitRate: number;
        topFunctions: Array<{ name: string; hitRate: number; calls: number }>;
    } {
        const totalItems = this.memoCache.size;
        const totalMemoryUsage = Array.from(this.memoCache.values())
            .reduce((sum, item) => sum + JSON.stringify(item.value).length, 0);

        const functionStats = Array.from(this.computationStats.entries())
            .map(([name, stats]) => ({
                name,
                hitRate: stats.cacheHitRate,
                calls: stats.totalCalls
            }))
            .sort((a, b) => b.calls - a.calls)
            .slice(0, 10);

        const overallHitRate = functionStats.length > 0
            ? functionStats.reduce((sum, stat) => sum + stat.hitRate, 0) / functionStats.length
            : 0;

        return {
            totalItems,
            totalMemoryUsage,
            hitRate: overallHitRate,
            topFunctions: functionStats
        };
    }

    /**
     * 設置緩存項目
     */
    private setCacheItem<T>(
        key: string,
        value: T,
        computationTime: number,
        maxCacheSize: number
    ): void {
        // 如果緩存已滿，移除最少使用的項目
        if (this.memoCache.size >= maxCacheSize) {
            const lruKey = this.findLRUKey();
            if (lruKey) {
                this.memoCache.delete(lruKey);
            }
        }

        this.memoCache.set(key, {
            value,
            timestamp: Date.now(),
            accessCount: 1,
            computationTime
        });
    }

    /**
     * 查找最少使用的緩存鍵
     */
    private findLRUKey(): string | null {
        let lruKey: string | null = null;
        let minAccessCount = Infinity;
        let oldestTimestamp = Infinity;

        for (const [key, item] of this.memoCache.entries()) {
            if (item.accessCount < minAccessCount || 
                (item.accessCount === minAccessCount && item.timestamp < oldestTimestamp)) {
                minAccessCount = item.accessCount;
                oldestTimestamp = item.timestamp;
                lruKey = key;
            }
        }

        return lruKey;
    }

    /**
     * 清理過期緩存
     */
    private cleanupExpiredCache(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, item] of this.memoCache.entries()) {
            // 假設默認 TTL 為 30 分鐘
            if (now - item.timestamp > 30 * 60 * 1000) {
                expiredKeys.push(key);
            }
        }

        expiredKeys.forEach(key => this.memoCache.delete(key));

        if (expiredKeys.length > 0) {
            console.log(`清理了 ${expiredKeys.length} 個過期緩存項目`);
        }
    }

    /**
     * 重置統計
     */
    resetStats(): void {
        this.computationStats.clear();
        this.memoCache.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.throttleLastCall.clear();
    }
}
