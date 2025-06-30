/**
 * 異步初始化管理器
 * 管理擴充套件的異步初始化過程，優化啟動性能
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { ErrorHandler, DevikaError, ErrorType, ErrorSeverity } from '../utils/ErrorHandler';
import { LazyLoader } from './LazyLoader';

/**
 * 初始化階段
 */
export enum InitializationPhase {
    IMMEDIATE = 'immediate',      // 立即執行（阻塞啟動）
    EARLY = 'early',             // 早期執行（非阻塞）
    NORMAL = 'normal',           // 正常執行
    LATE = 'late',               // 延遲執行
    BACKGROUND = 'background'     // 背景執行
}

/**
 * 初始化任務接口
 */
export interface InitializationTask {
    name: string;
    phase: InitializationPhase;
    priority: number;
    dependencies?: string[];
    timeout?: number;
    retryable?: boolean;
    critical?: boolean;
    task: () => Promise<void>;
}

/**
 * 初始化結果
 */
export interface InitializationResult {
    taskName: string;
    success: boolean;
    duration: number;
    error?: Error;
    phase: InitializationPhase;
}

/**
 * 初始化統計
 */
export interface InitializationStats {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalDuration: number;
    phaseStats: Record<InitializationPhase, {
        tasks: number;
        completed: number;
        failed: number;
        duration: number;
    }>;
}

/**
 * 異步初始化管理器
 */
export class AsyncInitializer {
    private static instance: AsyncInitializer;
    private tasks = new Map<string, InitializationTask>();
    private results = new Map<string, InitializationResult>();
    private completedTasks = new Set<string>();
    private runningTasks = new Set<string>();
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private lazyLoader: LazyLoader;
    private initializationStartTime: number = 0;

    private constructor() {
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        this.lazyLoader = LazyLoader.getInstance();
    }

    public static getInstance(): AsyncInitializer {
        if (!AsyncInitializer.instance) {
            AsyncInitializer.instance = new AsyncInitializer();
        }
        return AsyncInitializer.instance;
    }

    /**
     * 註冊初始化任務
     */
    public registerTask(task: InitializationTask): void {
        if (this.tasks.has(task.name)) {
            this.logger.warn('AsyncInitializer', `Task ${task.name} is already registered`);
            return;
        }

        this.tasks.set(task.name, {
            timeout: 30000,
            retryable: false,
            critical: false,
            ...task
        });

        this.logger.debug('AsyncInitializer', `Registered initialization task: ${task.name}`, {
            phase: task.phase,
            priority: task.priority,
            critical: task.critical
        });
    }

    /**
     * 開始初始化過程
     */
    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        this.initializationStartTime = Date.now();
        this.logger.info('AsyncInitializer', 'Starting extension initialization');

        try {
            // 階段 1: 立即執行的任務（阻塞啟動）
            await this.executePhase(InitializationPhase.IMMEDIATE);

            // 階段 2-5: 異步執行
            this.executeAsyncPhases();

            this.logger.info('AsyncInitializer', 'Extension initialization completed');
        } catch (error) {
            const devikaError = new DevikaError(
                `Extension initialization failed: ${error instanceof Error ? error.message : String(error)}`,
                ErrorType.CONFIGURATION,
                ErrorSeverity.CRITICAL,
                'INITIALIZATION_FAILED'
            );

            this.logger.error('AsyncInitializer', 'Extension initialization failed', devikaError);
            await this.errorHandler.handleError(devikaError);
            throw devikaError;
        }
    }

    /**
     * 執行指定階段的任務
     */
    private async executePhase(phase: InitializationPhase): Promise<void> {
        const phaseTasks = this.getTasksForPhase(phase);
        if (phaseTasks.length === 0) {
            return;
        }

        this.logger.info('AsyncInitializer', `Executing ${phase} phase with ${phaseTasks.length} tasks`);

        const startTime = Date.now();
        const results = await Promise.allSettled(
            phaseTasks.map(task => this.executeTask(task))
        );

        const duration = Date.now() - startTime;
        const failed = results.filter(r => r.status === 'rejected').length;

        this.logger.info('AsyncInitializer', `Phase ${phase} completed`, {
            duration,
            completed: results.length - failed,
            failed
        });

        // 檢查關鍵任務是否失敗
        const criticalFailures = phaseTasks.filter((task, index) => 
            task.critical && results[index].status === 'rejected'
        );

        if (criticalFailures.length > 0) {
            throw new Error(`Critical tasks failed in ${phase} phase: ${criticalFailures.map(t => t.name).join(', ')}`);
        }
    }

    /**
     * 異步執行後續階段
     */
    private executeAsyncPhases(): void {
        // 使用 setTimeout 確保不阻塞主線程
        setTimeout(async () => {
            try {
                await this.executePhase(InitializationPhase.EARLY);
                await this.executePhase(InitializationPhase.NORMAL);
                await this.executePhase(InitializationPhase.LATE);
                await this.executePhase(InitializationPhase.BACKGROUND);

                const totalDuration = Date.now() - this.initializationStartTime;
                this.logger.info('AsyncInitializer', 'All initialization phases completed', {
                    totalDuration,
                    stats: this.getInitializationStats()
                });
            } catch (error) {
                this.logger.error('AsyncInitializer', 'Async initialization phases failed', error);
            }
        }, 0);
    }

    /**
     * 執行單個任務
     */
    private async executeTask(task: InitializationTask): Promise<void> {
        if (this.completedTasks.has(task.name) || this.runningTasks.has(task.name)) {
            return;
        }

        this.runningTasks.add(task.name);
        const startTime = Date.now();

        try {
            this.logger.debug('AsyncInitializer', `Starting task: ${task.name}`);

            // 檢查依賴
            await this.waitForDependencies(task);

            // 執行任務（帶超時）
            await this.executeWithTimeout(task);

            const duration = Date.now() - startTime;
            this.completedTasks.add(task.name);
            this.runningTasks.delete(task.name);

            const result: InitializationResult = {
                taskName: task.name,
                success: true,
                duration,
                phase: task.phase
            };

            this.results.set(task.name, result);
            this.logger.debug('AsyncInitializer', `Task completed: ${task.name}`, { duration });

        } catch (error) {
            const duration = Date.now() - startTime;
            this.runningTasks.delete(task.name);

            const result: InitializationResult = {
                taskName: task.name,
                success: false,
                duration,
                error: error instanceof Error ? error : new Error(String(error)),
                phase: task.phase
            };

            this.results.set(task.name, result);

            if (task.retryable) {
                this.logger.warn('AsyncInitializer', `Task failed, will retry: ${task.name}`, error);
                // 可以在這裡實現重試邏輯
            } else {
                this.logger.error('AsyncInitializer', `Task failed: ${task.name}`, error);
                if (task.critical) {
                    throw error;
                }
            }
        }
    }

    /**
     * 等待依賴任務完成
     */
    private async waitForDependencies(task: InitializationTask): Promise<void> {
        if (!task.dependencies || task.dependencies.length === 0) {
            return;
        }

        const maxWaitTime = 30000; // 30 秒
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const pendingDependencies = task.dependencies.filter(dep => !this.completedTasks.has(dep));
            
            if (pendingDependencies.length === 0) {
                return;
            }

            this.logger.debug('AsyncInitializer', `Waiting for dependencies: ${task.name}`, {
                pending: pendingDependencies
            });

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        throw new Error(`Timeout waiting for dependencies: ${task.dependencies.join(', ')}`);
    }

    /**
     * 帶超時執行任務
     */
    private async executeWithTimeout(task: InitializationTask): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Task timeout: ${task.name}`));
            }, task.timeout || 30000);

            task.task()
                .then(() => {
                    clearTimeout(timeout);
                    resolve();
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    /**
     * 獲取指定階段的任務
     */
    private getTasksForPhase(phase: InitializationPhase): InitializationTask[] {
        return Array.from(this.tasks.values())
            .filter(task => task.phase === phase)
            .sort((a, b) => b.priority - a.priority); // 高優先級先執行
    }

    /**
     * 獲取初始化統計
     */
    public getInitializationStats(): InitializationStats {
        const allTasks = Array.from(this.tasks.values());
        const allResults = Array.from(this.results.values());

        const phaseStats: Record<InitializationPhase, any> = {
            [InitializationPhase.IMMEDIATE]: { tasks: 0, completed: 0, failed: 0, duration: 0 },
            [InitializationPhase.EARLY]: { tasks: 0, completed: 0, failed: 0, duration: 0 },
            [InitializationPhase.NORMAL]: { tasks: 0, completed: 0, failed: 0, duration: 0 },
            [InitializationPhase.LATE]: { tasks: 0, completed: 0, failed: 0, duration: 0 },
            [InitializationPhase.BACKGROUND]: { tasks: 0, completed: 0, failed: 0, duration: 0 }
        };

        // 統計每個階段
        for (const task of allTasks) {
            phaseStats[task.phase].tasks++;
        }

        for (const result of allResults) {
            const stats = phaseStats[result.phase];
            if (result.success) {
                stats.completed++;
            } else {
                stats.failed++;
            }
            stats.duration += result.duration;
        }

        return {
            totalTasks: allTasks.length,
            completedTasks: allResults.filter(r => r.success).length,
            failedTasks: allResults.filter(r => !r.success).length,
            totalDuration: Date.now() - this.initializationStartTime,
            phaseStats
        };
    }

    /**
     * 檢查任務是否完成
     */
    public isTaskCompleted(taskName: string): boolean {
        return this.completedTasks.has(taskName);
    }

    /**
     * 檢查任務是否正在運行
     */
    public isTaskRunning(taskName: string): boolean {
        return this.runningTasks.has(taskName);
    }

    /**
     * 獲取任務結果
     */
    public getTaskResult(taskName: string): InitializationResult | undefined {
        return this.results.get(taskName);
    }

    /**
     * 清理資源
     */
    public dispose(): void {
        this.tasks.clear();
        this.results.clear();
        this.completedTasks.clear();
        this.runningTasks.clear();
    }
}
