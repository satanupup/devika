/**
 * API 調用優化器
 * 實施智能快取、請求去重、批量處理等優化策略
 */

import * as crypto from 'crypto';
import { MemoryManager } from '../performance/MemoryManager';

/**
 * API 請求快取項目
 */
interface CacheItem<T> {
    data: T;
    timestamp: number;
    ttl: number;
    hitCount: number;
    size: number;
}

/**
 * API 調用統計
 */
interface ApiStats {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    totalTokensUsed: number;
    totalCost: number;
    averageResponseTime: number;
}

/**
 * 請求去重管理器
 */
class RequestDeduplicator {
    private pendingRequests = new Map<string, Promise<any>>();

    /**
     * 去重執行請求
     */
    async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
        // 如果已有相同請求在進行中，返回該 Promise
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key)!;
        }

        // 創建新請求
        const promise = requestFn().finally(() => {
            // 請求完成後清除
            this.pendingRequests.delete(key);
        });

        this.pendingRequests.set(key, promise);
        return promise;
    }

    /**
     * 清除所有待處理請求
     */
    clear(): void {
        this.pendingRequests.clear();
    }
}

/**
 * API 調用優化器
 */
export class ApiOptimizer {
    private cache = new Map<string, CacheItem<any>>();
    private deduplicator = new RequestDeduplicator();
    private stats: ApiStats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        averageResponseTime: 0
    };
    private responseTimes: number[] = [];
    private maxCacheSize: number;
    private defaultTTL: number;

    constructor(options: {
        maxCacheSize?: number;
        defaultTTL?: number;
    } = {}) {
        this.maxCacheSize = options.maxCacheSize || 100 * 1024 * 1024; // 100MB
        this.defaultTTL = options.defaultTTL || 30 * 60 * 1000; // 30 分鐘

        // 定期清理過期快取
        setInterval(() => this.cleanupExpiredCache(), 5 * 60 * 1000); // 5 分鐘
    }

    /**
     * 優化的 API 調用
     */
    async optimizedCall<T>(
        key: string,
        requestFn: () => Promise<T>,
        options: {
            ttl?: number;
            skipCache?: boolean;
            skipDeduplication?: boolean;
            estimatedTokens?: number;
            estimatedCost?: number;
        } = {}
    ): Promise<T> {
        const startTime = Date.now();
        this.stats.totalRequests++;

        try {
            // 檢查快取
            if (!options.skipCache) {
                const cached = this.getFromCache<T>(key);
                if (cached) {
                    this.stats.cacheHits++;
                    return cached;
                }
            }

            this.stats.cacheMisses++;

            // 去重處理
            const result = options.skipDeduplication
                ? await requestFn()
                : await this.deduplicator.deduplicate(key, requestFn);

            // 更新統計
            const responseTime = Date.now() - startTime;
            this.updateStats(responseTime, options.estimatedTokens, options.estimatedCost);

            // 存入快取
            if (!options.skipCache) {
                this.setCache(key, result, options.ttl || this.defaultTTL);
            }

            return result;

        } catch (error) {
            // 記錄錯誤但不影響統計
            console.error('API 調用失敗:', error);
            throw error;
        }
    }

    /**
     * 批量 API 調用
     */
    async batchCall<T>(
        requests: Array<{
            key: string;
            requestFn: () => Promise<T>;
            options?: any;
        }>,
        batchOptions: {
            maxConcurrency?: number;
            delayBetweenBatches?: number;
        } = {}
    ): Promise<(T | Error)[]> {
        const { maxConcurrency = 5, delayBetweenBatches = 1000 } = batchOptions;
        const results: (T | Error)[] = [];

        // 分批處理
        for (let i = 0; i < requests.length; i += maxConcurrency) {
            const batch = requests.slice(i, i + maxConcurrency);

            const batchPromises = batch.map(async (req) => {
                try {
                    return await this.optimizedCall(req.key, req.requestFn, req.options);
                } catch (error) {
                    return error instanceof Error ? error : new Error(String(error));
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // 批次間延遲
            if (i + maxConcurrency < requests.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }

        return results;
    }

    /**
     * 智能快取預熱
     */
    async preloadCache(
        preloadRequests: Array<{
            key: string;
            requestFn: () => Promise<any>;
            priority?: number;
        }>
    ): Promise<void> {
        // 按優先級排序
        const sortedRequests = preloadRequests.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        console.log(`開始預熱快取，共 ${sortedRequests.length} 個請求`);

        for (const req of sortedRequests) {
            try {
                await this.optimizedCall(req.key, req.requestFn, { ttl: this.defaultTTL * 2 });
                console.log(`快取預熱成功: ${req.key}`);
            } catch (error) {
                console.warn(`快取預熱失敗: ${req.key}`, error);
            }
        }

        console.log('快取預熱完成');
    }

    /**
     * 從快取獲取數據
     */
    private getFromCache<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) {return null;}

        // 檢查是否過期
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            return null;
        }

        // 增加命中次數
        item.hitCount++;
        return item.data;
    }

    /**
     * 設置快取
     */
    private setCache<T>(key: string, data: T, ttl: number): void {
        const size = this.estimateSize(data);

        // 檢查快取大小限制
        if (this.getCurrentCacheSize() + size > this.maxCacheSize) {
            this.evictLeastUsed();
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
            hitCount: 0,
            size
        });
    }

    /**
     * 清理過期快取
     */
    private cleanupExpiredCache(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > item.ttl) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`清理了 ${cleanedCount} 個過期快取項目`);
        }
    }

    /**
     * 驅逐最少使用的快取項目
     */
    private evictLeastUsed(): void {
        let leastUsedKey: string | null = null;
        let leastHitCount = Infinity;

        for (const [key, item] of this.cache.entries()) {
            if (item.hitCount < leastHitCount) {
                leastHitCount = item.hitCount;
                leastUsedKey = key;
            }
        }

        if (leastUsedKey) {
            this.cache.delete(leastUsedKey);
            console.log(`驅逐最少使用的快取項目: ${leastUsedKey}`);
        }
    }

    /**
     * 估算數據大小
     */
    private estimateSize(data: any): number {
        try {
            return JSON.stringify(data).length * 2; // 粗略估算
        } catch {
            return 1024; // 默認 1KB
        }
    }

    /**
     * 獲取當前快取大小
     */
    private getCurrentCacheSize(): number {
        let totalSize = 0;
        for (const item of this.cache.values()) {
            totalSize += item.size;
        }
        return totalSize;
    }

    /**
     * 更新統計信息
     */
    private updateStats(responseTime: number, tokens?: number, cost?: number): void {
        this.responseTimes.push(responseTime);

        // 保持最近 100 次的響應時間
        if (this.responseTimes.length > 100) {
            this.responseTimes.shift();
        }

        this.stats.averageResponseTime =
            this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;

        if (tokens) {
            this.stats.totalTokensUsed += tokens;
        }

        if (cost) {
            this.stats.totalCost += cost;
        }
    }

    /**
     * 生成快取鍵
     */
    static generateCacheKey(prompt: string, options: any = {}): string {
        const content = JSON.stringify({ prompt, options });
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * 獲取統計信息
     */
    getStats(): ApiStats & {
        cacheHitRate: number;
        currentCacheSize: number;
        cacheItemCount: number;
    } {
        const cacheHitRate = this.stats.totalRequests > 0
            ? this.stats.cacheHits / this.stats.totalRequests
            : 0;

        return {
            ...this.stats,
            cacheHitRate,
            currentCacheSize: this.getCurrentCacheSize(),
            cacheItemCount: this.cache.size
        };
    }

    /**
     * 清除所有快取
     */
    clearCache(): void {
        this.cache.clear();
        this.deduplicator.clear();
        console.log('已清除所有 API 快取');
    }

    /**
     * 重置統計信息
     */
    resetStats(): void {
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalTokensUsed: 0,
            totalCost: 0,
            averageResponseTime: 0
        };
        this.responseTimes = [];
        console.log('已重置 API 統計信息');
    }

    /**
     * 生成優化報告
     */
    generateOptimizationReport(): string {
        const stats = this.getStats();
        const costSavings = stats.cacheHitRate * stats.totalCost;

        return `
📊 API 調用優化報告
================================
總請求數: ${stats.totalRequests}
快取命中率: ${(stats.cacheHitRate * 100).toFixed(1)}%
平均響應時間: ${stats.averageResponseTime.toFixed(0)}ms
總 Token 使用: ${stats.totalTokensUsed.toLocaleString()}
總成本: $${stats.totalCost.toFixed(2)}
預估節省成本: $${costSavings.toFixed(2)}

快取狀態:
- 快取項目數: ${stats.cacheItemCount}
- 快取大小: ${(stats.currentCacheSize / 1024 / 1024).toFixed(1)}MB
- 最大快取大小: ${(this.maxCacheSize / 1024 / 1024).toFixed(1)}MB

優化建議:
${this.generateOptimizationSuggestions(stats)}
================================
        `.trim();
    }

    /**
     * 生成優化建議
     */
    private generateOptimizationSuggestions(stats: any): string {
        const suggestions = [];

        if (stats.cacheHitRate < 0.3) {
            suggestions.push('• 快取命中率較低，考慮增加 TTL 或預熱常用請求');
        }

        if (stats.averageResponseTime > 5000) {
            suggestions.push('• 平均響應時間較長，考慮實施請求超時和重試機制');
        }

        if (stats.currentCacheSize > this.maxCacheSize * 0.8) {
            suggestions.push('• 快取使用率較高，考慮增加快取大小或調整驅逐策略');
        }

        if (stats.totalCost > 100) {
            suggestions.push('• API 成本較高，建議優化 prompt 設計以減少 token 使用');
        }

        return suggestions.length > 0 ? suggestions.join('\n') : '• 當前優化狀態良好';
    }
}

// 導出單例實例
export const apiOptimizer = new ApiOptimizer();
