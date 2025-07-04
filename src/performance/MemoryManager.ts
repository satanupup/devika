/**
 * 增強版內存管理器
 * 監控和優化內存使用，實現智能緩存和垃圾回收
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { ErrorHandler, DevikaError, ErrorType, ErrorSeverity } from '../utils/ErrorHandler';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 內存使用統計
 */
export interface MemoryStats {
    used: number;
    total: number;
    free: number;
    percentage: number;
    timestamp: Date;
}

/**
 * 緩存項目接口
 */
export interface CacheItem<T> {
    key: string;
    value: T;
    size: number;
    accessCount: number;
    lastAccessed: Date;
    created: Date;
    ttl?: number;
}

/**
 * 緩存配置
 */
export interface CacheConfig {
    maxSize: number;        // 最大緩存大小（字節）
    maxItems: number;       // 最大項目數量
    defaultTTL: number;     // 默認生存時間（毫秒）
    cleanupInterval: number; // 清理間隔（毫秒）
    evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
}

/**
 * 內存管理器
 */
export class MemoryManager {
    private static instance: MemoryManager;
    private cache = new Map<string, CacheItem<any>>();
    private cacheSize = 0;
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private config: CacheConfig;
    private cleanupTimer?: NodeJS.Timeout;
    private memoryCheckTimer?: NodeJS.Timeout;
    private memoryThreshold = 0.8; // 80% 內存使用率警告閾值

    private constructor(config?: Partial<CacheConfig>) {
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        this.config = {
            maxSize: 100 * 1024 * 1024, // 100MB
            maxItems: 10000,
            defaultTTL: 30 * 60 * 1000, // 30 分鐘
            cleanupInterval: 5 * 60 * 1000, // 5 分鐘
            evictionPolicy: 'LRU',
            ...config
        };

        this.startCleanupTimer();
        this.startMemoryMonitoring();
    }

    public static getInstance(config?: Partial<CacheConfig>): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager(config);
        }
        return MemoryManager.instance;
    }

    /**
     * 設置緩存項目
     */
    public set<T>(key: string, value: T, ttl?: number): void {
        try {
            const size = this.calculateSize(value);
            const now = new Date();

            // 檢查是否需要清理空間
            if (this.cacheSize + size > this.config.maxSize || this.cache.size >= this.config.maxItems) {
                this.evictItems(size);
            }

            // 如果項目已存在，先移除舊的
            if (this.cache.has(key)) {
                this.delete(key);
            }

            const item: CacheItem<T> = {
                key,
                value,
                size,
                accessCount: 0,
                lastAccessed: now,
                created: now,
                ttl: ttl || this.config.defaultTTL
            };

            this.cache.set(key, item);
            this.cacheSize += size;

            this.logger.debug('MemoryManager', `Cache item set: ${key}`, { size, cacheSize: this.cacheSize });
        } catch (error) {
            this.logger.error('MemoryManager', `Failed to set cache item: ${key}`, error);
        }
    }

    /**
     * 獲取緩存項目
     */
    public get<T>(key: string): T | undefined {
        const item = this.cache.get(key);
        if (!item) {
            return undefined;
        }

        // 檢查是否過期
        if (this.isExpired(item)) {
            this.delete(key);
            return undefined;
        }

        // 更新訪問統計
        item.accessCount++;
        item.lastAccessed = new Date();

        this.logger.debug('MemoryManager', `Cache item accessed: ${key}`, { accessCount: item.accessCount });
        return item.value;
    }

    /**
     * 檢查緩存項目是否存在
     */
    public has(key: string): boolean {
        const item = this.cache.get(key);
        if (!item) {
            return false;
        }

        if (this.isExpired(item)) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /**
     * 刪除緩存項目
     */
    public delete(key: string): boolean {
        const item = this.cache.get(key);
        if (!item) {
            return false;
        }

        this.cache.delete(key);
        this.cacheSize -= item.size;

        this.logger.debug('MemoryManager', `Cache item deleted: ${key}`, { size: item.size, cacheSize: this.cacheSize });
        return true;
    }

    /**
     * 清空緩存
     */
    public clear(): void {
        const itemCount = this.cache.size;
        const totalSize = this.cacheSize;

        this.cache.clear();
        this.cacheSize = 0;

        this.logger.info('MemoryManager', 'Cache cleared', { itemCount, totalSize });
    }

    /**
     * 計算對象大小（粗略估算）
     */
    private calculateSize(obj: any): number {
        try {
            if (obj === null || obj === undefined) {
                return 0;
            }

            if (typeof obj === 'string') {
                return obj.length * 2; // UTF-16 字符
            }

            if (typeof obj === 'number') {
                return 8; // 64-bit 數字
            }

            if (typeof obj === 'boolean') {
                return 4;
            }

            if (obj instanceof Date) {
                return 8;
            }

            if (Array.isArray(obj)) {
                return obj.reduce((total, item) => total + this.calculateSize(item), 0);
            }

            if (typeof obj === 'object') {
                return Object.keys(obj).reduce((total, key) => {
                    return total + key.length * 2 + this.calculateSize(obj[key]);
                }, 0);
            }

            // 對於其他類型，使用 JSON 序列化長度作為估算
            return JSON.stringify(obj).length * 2;
        } catch (error) {
            // 如果無法計算大小，返回默認值
            return 1024; // 1KB
        }
    }

    /**
     * 檢查項目是否過期
     */
    private isExpired(item: CacheItem<any>): boolean {
        if (!item.ttl) {
            return false;
        }

        const now = Date.now();
        const expireTime = item.created.getTime() + item.ttl;
        return now > expireTime;
    }

    /**
     * 驅逐項目以釋放空間
     */
    private evictItems(requiredSpace: number): void {
        const itemsToEvict: string[] = [];
        let spaceToFree = requiredSpace;

        // 首先移除過期項目
        for (const [key, item] of this.cache) {
            if (this.isExpired(item)) {
                itemsToEvict.push(key);
                spaceToFree -= item.size;
            }
        }

        // 如果還需要更多空間，根據驅逐策略移除項目
        if (spaceToFree > 0) {
            const candidates = Array.from(this.cache.entries())
                .filter(([key]) => !itemsToEvict.includes(key))
                .map(([key, item]) => ({ key, item }));

            // 根據驅逐策略排序
            switch (this.config.evictionPolicy) {
                case 'LRU':
                    candidates.sort((a, b) => a.item.lastAccessed.getTime() - b.item.lastAccessed.getTime());
                    break;
                case 'LFU':
                    candidates.sort((a, b) => a.item.accessCount - b.item.accessCount);
                    break;
                case 'FIFO':
                    candidates.sort((a, b) => a.item.created.getTime() - b.item.created.getTime());
                    break;
            }

            // 移除項目直到有足夠空間
            for (const { key, item } of candidates) {
                if (spaceToFree <= 0) {
                    break;
                }
                itemsToEvict.push(key);
                spaceToFree -= item.size;
            }
        }

        // 執行驅逐
        for (const key of itemsToEvict) {
            this.delete(key);
        }

        this.logger.info('MemoryManager', `Evicted ${itemsToEvict.length} cache items`, {
            policy: this.config.evictionPolicy,
            spaceFreed: requiredSpace - spaceToFree
        });
    }

    /**
     * 清理過期項目
     */
    private cleanupExpiredItems(): void {
        const expiredKeys: string[] = [];

        for (const [key, item] of this.cache) {
            if (this.isExpired(item)) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.delete(key);
        }

        if (expiredKeys.length > 0) {
            this.logger.debug('MemoryManager', `Cleaned up ${expiredKeys.length} expired cache items`);
        }
    }

    /**
     * 開始清理定時器
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredItems();
        }, this.config.cleanupInterval);
    }

    /**
     * 開始內存監控
     */
    private startMemoryMonitoring(): void {
        this.memoryCheckTimer = setInterval(() => {
            this.checkMemoryUsage();
        }, 60000); // 每分鐘檢查一次
    }

    /**
     * 檢查內存使用情況
     */
    private checkMemoryUsage(): void {
        try {
            const stats = this.getMemoryStats();

            if (stats.percentage > this.memoryThreshold) {
                this.logger.warn('MemoryManager', 'High memory usage detected', stats);

                // 觸發緊急清理
                this.emergencyCleanup();
            }

            this.logger.debug('MemoryManager', 'Memory usage check', stats);
        } catch (error) {
            this.logger.error('MemoryManager', 'Failed to check memory usage', error);
        }
    }

    /**
     * 緊急清理
     */
    private emergencyCleanup(): void {
        const beforeSize = this.cacheSize;
        const beforeCount = this.cache.size;

        // 清理過期項目
        this.cleanupExpiredItems();

        // 如果內存使用率仍然很高，強制驅逐一些項目
        const targetSize = this.config.maxSize * 0.7; // 降到 70%
        if (this.cacheSize > targetSize) {
            this.evictItems(this.cacheSize - targetSize);
        }

        const afterSize = this.cacheSize;
        const afterCount = this.cache.size;

        this.logger.info('MemoryManager', 'Emergency cleanup completed', {
            beforeSize,
            afterSize,
            beforeCount,
            afterCount,
            spaceFreed: beforeSize - afterSize,
            itemsRemoved: beforeCount - afterCount
        });
    }

    /**
     * 獲取內存統計
     */
    public getMemoryStats(): MemoryStats {
        const memUsage = process.memoryUsage();

        return {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            free: memUsage.heapTotal - memUsage.heapUsed,
            percentage: memUsage.heapUsed / memUsage.heapTotal,
            timestamp: new Date()
        };
    }

    /**
     * 獲取緩存統計
     */
    public getCacheStats(): {
        itemCount: number;
        totalSize: number;
        maxSize: number;
        hitRate: number;
        averageItemSize: number;
    } {
        const totalAccess = Array.from(this.cache.values()).reduce((sum, item) => sum + item.accessCount, 0);
        const totalHits = Array.from(this.cache.values()).filter(item => item.accessCount > 0).length;

        return {
            itemCount: this.cache.size,
            totalSize: this.cacheSize,
            maxSize: this.config.maxSize,
            hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
            averageItemSize: this.cache.size > 0 ? this.cacheSize / this.cache.size : 0
        };
    }

    /**
     * 強制垃圾回收（如果可用）
     */
    public forceGarbageCollection(): void {
        try {
            if (global.gc) {
                global.gc();
                this.logger.debug('MemoryManager', 'Forced garbage collection');
            } else {
                this.logger.warn('MemoryManager', 'Garbage collection not available');
            }
        } catch (error) {
            this.logger.error('MemoryManager', 'Failed to force garbage collection', error);
        }
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        if (this.memoryCheckTimer) {
            clearInterval(this.memoryCheckTimer);
        }

        this.clear();
        this.logger.debug('MemoryManager', 'Memory manager disposed');
    }
}
