/**
 * 性能監控與分析系統
 * 實施運行時性能監控，收集使用數據，建立性能基準測試
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { MemoryManager } from './MemoryManager';

/**
 * 性能指標
 */
export interface PerformanceMetrics {
    timestamp: number;
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    extension: {
        activationTime: number;
        commandExecutionTimes: Map<string, number[]>;
        apiCallTimes: Map<string, number[]>;
        errorCount: number;
        cacheHitRate: number;
    };
    system: {
        platform: string;
        nodeVersion: string;
        vscodeVersion: string;
        workspaceFileCount: number;
    };
}

/**
 * 性能基準測試結果
 */
export interface BenchmarkResult {
    testName: string;
    iterations: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    standardDeviation: number;
    throughput: number;
    memoryUsage: number;
}

/**
 * 性能監控器
 */
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: PerformanceMetrics[] = [];
    private isMonitoring = false;
    private monitoringInterval?: NodeJS.Timeout;
    private commandTimings = new Map<string, number[]>();
    private apiTimings = new Map<string, number[]>();
    private errorCount = 0;
    private activationTime = 0;

    private constructor() {}

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * 開始性能監控
     */
    startMonitoring(intervalMs: number = 30000): void {
        if (this.isMonitoring) {return;}

        this.isMonitoring = true;
        this.activationTime = Date.now();

        this.monitoringInterval = setInterval(async () => {
            const metrics = await this.collectMetrics();
            this.metrics.push(metrics);

            // 保持最近 100 個指標
            if (this.metrics.length > 100) {
                this.metrics.shift();
            }

            // 檢查性能警告
            this.checkPerformanceWarnings(metrics);

        }, intervalMs);

        console.log('🔍 性能監控已啟動');
    }

    /**
     * 停止性能監控
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {return;}

        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }

        console.log('🔍 性能監控已停止');
    }

    /**
     * 記錄命令執行時間
     */
    recordCommandExecution(commandName: string, executionTime: number): void {
        if (!this.commandTimings.has(commandName)) {
            this.commandTimings.set(commandName, []);
        }

        const timings = this.commandTimings.get(commandName)!;
        timings.push(executionTime);

        // 保持最近 50 次記錄
        if (timings.length > 50) {
            timings.shift();
        }
    }

    /**
     * 記錄 API 調用時間
     */
    recordApiCall(apiName: string, responseTime: number): void {
        if (!this.apiTimings.has(apiName)) {
            this.apiTimings.set(apiName, []);
        }

        const timings = this.apiTimings.get(apiName)!;
        timings.push(responseTime);

        // 保持最近 50 次記錄
        if (timings.length > 50) {
            timings.shift();
        }
    }

    /**
     * 記錄錯誤
     */
    recordError(): void {
        this.errorCount++;
    }

    /**
     * 執行性能基準測試
     */
    async runBenchmark(
        testName: string,
        testFunction: () => Promise<void> | void,
        iterations: number = 100
    ): Promise<BenchmarkResult> {
        console.log(`🏃 開始基準測試: ${testName} (${iterations} 次迭代)`);

        const times: number[] = [];
        let totalMemoryUsage = 0;

        for (let i = 0; i < iterations; i++) {
            // 記錄內存使用前
            const memoryBefore = process.memoryUsage().heapUsed;

            // 執行測試
            const startTime = performance.now();
            await testFunction();
            const endTime = performance.now();

            // 記錄內存使用後
            const memoryAfter = process.memoryUsage().heapUsed;

            times.push(endTime - startTime);
            totalMemoryUsage += memoryAfter - memoryBefore;

            // 每 10 次迭代進行垃圾回收
            if (i % 10 === 0 && global.gc) {
                global.gc();
            }
        }

        // 計算統計數據
        const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
        const standardDeviation = Math.sqrt(variance);

        const throughput = 1000 / averageTime; // 每秒操作數
        const averageMemoryUsage = totalMemoryUsage / iterations;

        const result: BenchmarkResult = {
            testName,
            iterations,
            averageTime,
            minTime,
            maxTime,
            standardDeviation,
            throughput,
            memoryUsage: averageMemoryUsage
        };

        console.log(`✅ 基準測試完成: ${testName}`);
        console.log(`   平均時間: ${averageTime.toFixed(2)}ms`);
        console.log(`   吞吐量: ${throughput.toFixed(2)} ops/sec`);

        return result;
    }

    /**
     * 生成性能報告
     */
    generatePerformanceReport(): string {
        if (this.metrics.length === 0) {
            return '📊 暫無性能數據';
        }

        const latestMetrics = this.metrics[this.metrics.length - 1];
        const averageMetrics = this.calculateAverageMetrics();

        const report = `
📊 Devika 性能監控報告
================================

🕒 監控時間: ${new Date(latestMetrics.timestamp).toLocaleString()}
⏱️ 運行時間: ${this.formatDuration(Date.now() - this.activationTime)}

💾 內存使用:
- 當前使用: ${(latestMetrics.memory.used / 1024 / 1024).toFixed(1)}MB
- 使用率: ${latestMetrics.memory.percentage.toFixed(1)}%
- 平均使用率: ${averageMetrics.memoryPercentage.toFixed(1)}%

🖥️ CPU 使用:
- 當前負載: ${latestMetrics.cpu.usage.toFixed(1)}%
- 系統負載: ${latestMetrics.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}

🚀 擴展性能:
- 啟動時間: ${this.activationTime > 0 ? (Date.now() - this.activationTime) : 0}ms
- 錯誤計數: ${this.errorCount}
- 快取命中率: ${(latestMetrics.extension.cacheHitRate * 100).toFixed(1)}%

⚡ 命令執行時間 (平均):
${this.formatCommandTimings()}

🌐 API 調用時間 (平均):
${this.formatApiTimings()}

🖥️ 系統信息:
- 平台: ${latestMetrics.system.platform}
- Node.js: ${latestMetrics.system.nodeVersion}
- VS Code: ${latestMetrics.system.vscodeVersion}
- 工作區文件數: ${latestMetrics.system.workspaceFileCount}

📈 性能趨勢:
${this.generatePerformanceTrend()}

💡 優化建議:
${this.generateOptimizationSuggestions(latestMetrics)}
================================
        `.trim();

        return report;
    }

    /**
     * 收集性能指標
     */
    private async collectMetrics(): Promise<PerformanceMetrics> {
        const memoryUsage = process.memoryUsage();
        const memoryManager = MemoryManager.getInstance();
        const memoryStats = memoryManager.getMemoryStats();
        const cacheStats = memoryManager.getCacheStats();

        // 獲取工作區文件數
        let workspaceFileCount = 0;
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 1000);
                workspaceFileCount = files.length;
            }
        } catch {
            // 忽略錯誤
        }

        return {
            timestamp: Date.now(),
            memory: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            cpu: {
                usage: this.getCpuUsage(),
                loadAverage: os.loadavg()
            },
            extension: {
                activationTime: this.activationTime,
                commandExecutionTimes: new Map(this.commandTimings),
                apiCallTimes: new Map(this.apiTimings),
                errorCount: this.errorCount,
                cacheHitRate: cacheStats.hitRate
            },
            system: {
                platform: os.platform(),
                nodeVersion: process.version,
                vscodeVersion: vscode.version,
                workspaceFileCount
            }
        };
    }

    /**
     * 計算平均指標
     */
    private calculateAverageMetrics() {
        if (this.metrics.length === 0) {
            return { memoryPercentage: 0, cpuUsage: 0 };
        }

        const totalMemoryPercentage = this.metrics.reduce((sum, m) => sum + m.memory.percentage, 0);
        const totalCpuUsage = this.metrics.reduce((sum, m) => sum + m.cpu.usage, 0);

        return {
            memoryPercentage: totalMemoryPercentage / this.metrics.length,
            cpuUsage: totalCpuUsage / this.metrics.length
        };
    }

    /**
     * 檢查性能警告
     */
    private checkPerformanceWarnings(metrics: PerformanceMetrics): void {
        // 內存使用警告
        if (metrics.memory.percentage > 80) {
            vscode.window.showWarningMessage(
                `⚠️ 內存使用率過高 (${metrics.memory.percentage.toFixed(1)}%)，建議重啟 VS Code`
            );
        }

        // CPU 使用警告
        if (metrics.cpu.usage > 90) {
            vscode.window.showWarningMessage(
                `⚠️ CPU 使用率過高 (${metrics.cpu.usage.toFixed(1)}%)，可能影響性能`
            );
        }

        // 錯誤率警告
        if (this.errorCount > 10) {
            vscode.window.showWarningMessage(
                `⚠️ 錯誤數量較多 (${this.errorCount})，請檢查日誌`
            );
        }
    }

    /**
     * 格式化命令執行時間
     */
    private formatCommandTimings(): string {
        if (this.commandTimings.size === 0) {
            return '- 暫無數據';
        }

        const lines: string[] = [];
        for (const [command, times] of this.commandTimings.entries()) {
            const average = times.reduce((sum, time) => sum + time, 0) / times.length;
            lines.push(`- ${command}: ${average.toFixed(1)}ms`);
        }

        return lines.slice(0, 5).join('\n'); // 只顯示前 5 個
    }

    /**
     * 格式化 API 調用時間
     */
    private formatApiTimings(): string {
        if (this.apiTimings.size === 0) {
            return '- 暫無數據';
        }

        const lines: string[] = [];
        for (const [api, times] of this.apiTimings.entries()) {
            const average = times.reduce((sum, time) => sum + time, 0) / times.length;
            lines.push(`- ${api}: ${average.toFixed(0)}ms`);
        }

        return lines.slice(0, 5).join('\n'); // 只顯示前 5 個
    }

    /**
     * 生成性能趨勢
     */
    private generatePerformanceTrend(): string {
        if (this.metrics.length < 2) {
            return '- 數據不足，無法分析趨勢';
        }

        const recent = this.metrics.slice(-10);
        const memoryTrend = this.calculateTrend(recent.map(m => m.memory.percentage));
        const cpuTrend = this.calculateTrend(recent.map(m => m.cpu.usage));

        return `- 內存使用趨勢: ${memoryTrend > 0 ? '📈 上升' : memoryTrend < 0 ? '📉 下降' : '➡️ 穩定'}
- CPU 使用趨勢: ${cpuTrend > 0 ? '📈 上升' : cpuTrend < 0 ? '📉 下降' : '➡️ 穩定'}`;
    }

    /**
     * 生成優化建議
     */
    private generateOptimizationSuggestions(metrics: PerformanceMetrics): string {
        const suggestions: string[] = [];

        if (metrics.memory.percentage > 70) {
            suggestions.push('- 考慮清理內存快取或重啟擴展');
        }

        if (metrics.extension.cacheHitRate < 0.5) {
            suggestions.push('- 快取命中率較低，考慮調整快取策略');
        }

        if (this.errorCount > 5) {
            suggestions.push('- 錯誤數量較多，建議檢查錯誤日誌');
        }

        if (suggestions.length === 0) {
            suggestions.push('- 當前性能狀態良好');
        }

        return suggestions.join('\n');
    }

    /**
     * 計算趨勢
     */
    private calculateTrend(values: number[]): number {
        if (values.length < 2) {return 0;}

        const first = values[0];
        const last = values[values.length - 1];
        return last - first;
    }

    /**
     * 獲取 CPU 使用率
     */
    private getCpuUsage(): number {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        for (const cpu of cpus) {
            for (const type in cpu.times) {
                totalTick += cpu.times[type as keyof typeof cpu.times];
            }
            totalIdle += cpu.times.idle;
        }

        return 100 - (totalIdle / totalTick) * 100;
    }

    /**
     * 格式化持續時間
     */
    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * 獲取當前指標
     */
    getCurrentMetrics(): PerformanceMetrics | null {
        return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
    }

    /**
     * 清除歷史數據
     */
    clearHistory(): void {
        this.metrics = [];
        this.commandTimings.clear();
        this.apiTimings.clear();
        this.errorCount = 0;
    }
}

// 導出單例實例
export const performanceMonitor = PerformanceMonitor.getInstance();
