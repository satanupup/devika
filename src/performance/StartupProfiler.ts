/**
 * 啟動性能分析器
 * 用於監控和優化擴展啟動時間
 */

export interface StartupMetrics {
    totalStartupTime: number;
    coreInitTime: number;
    servicesInitTime: number;
    advancedFeaturesInitTime: number;
    memoryUsage: {
        initial: number;
        afterCore: number;
        afterServices: number;
        afterAdvanced: number;
    };
    timestamps: {
        start: number;
        coreReady: number;
        servicesReady: number;
        advancedReady: number;
        fullyReady: number;
    };
}

export class StartupProfiler {
    private static instance: StartupProfiler;
    private metrics: Partial<StartupMetrics> = {};
    private startTime: number = 0;

    private constructor() {}

    static getInstance(): StartupProfiler {
        if (!StartupProfiler.instance) {
            StartupProfiler.instance = new StartupProfiler();
        }
        return StartupProfiler.instance;
    }

    /**
     * 開始性能監控
     */
    startProfiling(): void {
        this.startTime = Date.now();
        this.metrics = {
            timestamps: {
                start: this.startTime,
                coreReady: 0,
                servicesReady: 0,
                advancedReady: 0,
                fullyReady: 0
            },
            memoryUsage: {
                initial: this.getMemoryUsage(),
                afterCore: 0,
                afterServices: 0,
                afterAdvanced: 0
            }
        };
        
        console.log('🚀 啟動性能監控已開始');
    }

    /**
     * 標記核心初始化完成
     */
    markCoreReady(): void {
        const now = Date.now();
        this.metrics.timestamps!.coreReady = now;
        this.metrics.coreInitTime = now - this.startTime;
        this.metrics.memoryUsage!.afterCore = this.getMemoryUsage();
        
        console.log(`⚡ 核心初始化完成: ${this.metrics.coreInitTime}ms`);
    }

    /**
     * 標記服務初始化完成
     */
    markServicesReady(): void {
        const now = Date.now();
        this.metrics.timestamps!.servicesReady = now;
        this.metrics.servicesInitTime = now - this.metrics.timestamps!.coreReady;
        this.metrics.memoryUsage!.afterServices = this.getMemoryUsage();
        
        console.log(`⚙️ 服務初始化完成: ${this.metrics.servicesInitTime}ms`);
    }

    /**
     * 標記高級功能初始化完成
     */
    markAdvancedFeaturesReady(): void {
        const now = Date.now();
        this.metrics.timestamps!.advancedReady = now;
        this.metrics.advancedFeaturesInitTime = now - this.metrics.timestamps!.servicesReady;
        this.metrics.memoryUsage!.afterAdvanced = this.getMemoryUsage();
        
        console.log(`🚀 高級功能初始化完成: ${this.metrics.advancedFeaturesInitTime}ms`);
    }

    /**
     * 標記完全就緒
     */
    markFullyReady(): void {
        const now = Date.now();
        this.metrics.timestamps!.fullyReady = now;
        this.metrics.totalStartupTime = now - this.startTime;
        
        console.log(`🎉 完全啟動完成: ${this.metrics.totalStartupTime}ms`);
        
        // 生成性能報告
        this.generatePerformanceReport();
    }

    /**
     * 獲取當前內存使用量 (MB)
     */
    private getMemoryUsage(): number {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        }
        return 0;
    }

    /**
     * 生成性能報告
     */
    private generatePerformanceReport(): void {
        const metrics = this.metrics as StartupMetrics;
        
        console.log('\n📊 Devika 啟動性能報告');
        console.log('================================');
        console.log(`總啟動時間: ${metrics.totalStartupTime}ms`);
        console.log(`核心初始化: ${metrics.coreInitTime}ms`);
        console.log(`服務初始化: ${metrics.servicesInitTime}ms`);
        console.log(`高級功能: ${metrics.advancedFeaturesInitTime}ms`);
        console.log('');
        console.log('內存使用:');
        console.log(`  初始: ${metrics.memoryUsage.initial}MB`);
        console.log(`  核心後: ${metrics.memoryUsage.afterCore}MB`);
        console.log(`  服務後: ${metrics.memoryUsage.afterServices}MB`);
        console.log(`  完成後: ${metrics.memoryUsage.afterAdvanced}MB`);
        console.log('');
        
        // 性能評估
        this.evaluatePerformance(metrics);
    }

    /**
     * 評估性能並提供建議
     */
    private evaluatePerformance(metrics: StartupMetrics): void {
        const suggestions: string[] = [];
        
        // 總啟動時間評估
        if (metrics.totalStartupTime > 3000) {
            suggestions.push('⚠️ 總啟動時間超過3秒，建議優化');
        } else if (metrics.totalStartupTime > 2000) {
            suggestions.push('💡 總啟動時間可以進一步優化');
        } else {
            console.log('✅ 啟動時間表現良好');
        }

        // 核心初始化評估
        if (metrics.coreInitTime > 1000) {
            suggestions.push('⚠️ 核心初始化時間過長，檢查同步操作');
        }

        // 內存使用評估
        const memoryIncrease = metrics.memoryUsage.afterAdvanced - metrics.memoryUsage.initial;
        if (memoryIncrease > 100) {
            suggestions.push('⚠️ 內存使用增長較大，檢查內存洩漏');
        }

        // 顯示建議
        if (suggestions.length > 0) {
            console.log('優化建議:');
            suggestions.forEach(suggestion => console.log(`  ${suggestion}`));
        }
        
        console.log('================================\n');
    }

    /**
     * 獲取性能指標
     */
    getMetrics(): StartupMetrics | null {
        if (this.metrics.totalStartupTime) {
            return this.metrics as StartupMetrics;
        }
        return null;
    }

    /**
     * 重置性能監控
     */
    reset(): void {
        this.metrics = {};
        this.startTime = 0;
    }

    /**
     * 導出性能數據為 JSON
     */
    exportMetrics(): string {
        return JSON.stringify(this.metrics, null, 2);
    }

    /**
     * 比較與目標性能
     */
    compareWithTarget(target: Partial<StartupMetrics>): void {
        const current = this.metrics as StartupMetrics;
        
        console.log('\n🎯 性能目標比較');
        console.log('================================');
        
        if (target.totalStartupTime) {
            const diff = current.totalStartupTime - target.totalStartupTime;
            const status = diff <= 0 ? '✅' : '❌';
            console.log(`總啟動時間: ${current.totalStartupTime}ms (目標: ${target.totalStartupTime}ms) ${status}`);
        }
        
        if (target.coreInitTime) {
            const diff = current.coreInitTime - target.coreInitTime;
            const status = diff <= 0 ? '✅' : '❌';
            console.log(`核心初始化: ${current.coreInitTime}ms (目標: ${target.coreInitTime}ms) ${status}`);
        }
        
        console.log('================================\n');
    }
}

// 性能目標常量
export const PERFORMANCE_TARGETS = {
    totalStartupTime: 1500,  // 1.5秒
    coreInitTime: 800,       // 0.8秒
    servicesInitTime: 400,   // 0.4秒
    advancedFeaturesInitTime: 300, // 0.3秒
    maxMemoryIncrease: 50    // 50MB
};

// 導出單例實例
export const startupProfiler = StartupProfiler.getInstance();
