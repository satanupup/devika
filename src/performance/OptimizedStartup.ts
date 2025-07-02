import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';
import { Logger } from '../utils/Logger';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * 優化的啟動管理器
 * 實現分階段啟動和懶加載以提升性能
 */
export class OptimizedStartup {
    private static instance: OptimizedStartup;
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private startupMetrics: StartupMetrics;
    private lazyInitQueue: LazyInitTask[] = [];
    private isInitialized = false;

    private constructor(private context: vscode.ExtensionContext) {
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        this.startupMetrics = {
            startTime: Date.now(),
            criticalPhaseTime: 0,
            backgroundPhaseTime: 0,
            totalTime: 0,
            memoryUsage: 0
        };
    }

    static getInstance(context?: vscode.ExtensionContext): OptimizedStartup {
        if (!OptimizedStartup.instance && context) {
            OptimizedStartup.instance = new OptimizedStartup(context);
        }
        return OptimizedStartup.instance;
    }

    /**
     * 執行優化的啟動流程
     */
    async performOptimizedStartup(): Promise<void> {
        try {
            this.logger.info('OptimizedStartup', 'Starting optimized startup sequence');

            // 階段 1: 關鍵服務 (< 200ms)
            await this.initializeCriticalServices();
            this.startupMetrics.criticalPhaseTime = Date.now() - this.startupMetrics.startTime;

            // 階段 2: 背景初始化 (非阻塞)
            this.initializeBackgroundServices();

            // 階段 3: 設置懶加載
            this.setupLazyInitialization();

            this.isInitialized = true;
            this.startupMetrics.totalTime = Date.now() - this.startupMetrics.startTime;
            this.startupMetrics.memoryUsage = process.memoryUsage().heapUsed;

            this.logger.info('OptimizedStartup', 'Startup completed', this.startupMetrics);

        } catch (error) {
            this.errorHandler.handleError(error as Error);
            throw error;
        }
    }

    /**
     * 初始化關鍵服務 (同步，必須在啟動時完成)
     */
    private async initializeCriticalServices(): Promise<void> {
        const criticalTasks = [
            // 1. 配置管理器 (必須最先初始化)
            () => ConfigManager.getInstance(),
            
            // 2. 註冊基本命令 (用戶可能立即使用)
            () => this.registerEssentialCommands(),
            
            // 3. 設置上下文變量
            () => vscode.commands.executeCommand('setContext', 'devika.activated', true),
            
            // 4. 創建狀態欄 (用戶可見反饋)
            () => this.createMinimalStatusBar()
        ];

        for (const task of criticalTasks) {
            await task();
        }
    }

    /**
     * 初始化背景服務 (異步，不阻塞啟動)
     */
    private initializeBackgroundServices(): void {
        // 使用 setTimeout 確保不阻塞主線程
        setTimeout(async () => {
            try {
                const backgroundStart = Date.now();

                // 並行初始化非關鍵服務
                const backgroundTasks = [
                    this.initializePluginManager(),
                    this.initializeCoreManager(),
                    this.registerAllCommands(),
                    this.registerViewProviders(),
                    this.setupFileWatchers()
                ];

                await Promise.allSettled(backgroundTasks);
                
                this.startupMetrics.backgroundPhaseTime = Date.now() - backgroundStart;
                this.logger.info('OptimizedStartup', 'Background services initialized');

            } catch (error) {
                this.logger.error('OptimizedStartup', 'Background initialization failed', error);
            }
        }, 0);
    }

    /**
     * 設置懶加載機制
     */
    private setupLazyInitialization(): void {
        // 註冊懶加載任務
        this.addLazyInitTask('workspace-indexing', async () => {
            await this.performWorkspaceIndexing();
        }, 'high');

        this.addLazyInitTask('todo-scanning', async () => {
            await this.performTodoScanning();
        }, 'medium');

        this.addLazyInitTask('git-analysis', async () => {
            await this.performGitAnalysis();
        }, 'low');

        // 監聽用戶活動以觸發懶加載
        this.setupLazyTriggers();
    }

    /**
     * 註冊基本命令
     */
    private registerEssentialCommands(): void {
        const essentialCommands = [
            vscode.commands.registerCommand('devika.start', () => {
                this.triggerLazyInit('workspace-indexing');
                // 延遲加載主面板
                setTimeout(() => this.showMainPanel(), 100);
            }),

            vscode.commands.registerCommand('devika.setupApiKeys', () => {
                this.showApiKeySetup();
            }),

            vscode.commands.registerCommand('devika.switchLLM', () => {
                this.showLLMSwitcher();
            })
        ];

        essentialCommands.forEach(cmd => this.context.subscriptions.push(cmd));
    }

    /**
     * 創建最小狀態欄
     */
    private createMinimalStatusBar(): void {
        const statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        statusBarItem.text = '$(robot) Devika';
        statusBarItem.tooltip = 'Devika AI 助理';
        statusBarItem.command = 'devika.start';
        statusBarItem.show();
        
        this.context.subscriptions.push(statusBarItem);
    }

    /**
     * 添加懶加載任務
     */
    private addLazyInitTask(
        id: string, 
        task: () => Promise<void>, 
        priority: 'high' | 'medium' | 'low'
    ): void {
        this.lazyInitQueue.push({
            id,
            task,
            priority,
            executed: false
        });
    }

    /**
     * 觸發懶加載任務
     */
    private async triggerLazyInit(taskId?: string): Promise<void> {
        const tasksToExecute = taskId 
            ? this.lazyInitQueue.filter(t => t.id === taskId && !t.executed)
            : this.lazyInitQueue.filter(t => !t.executed);

        for (const lazyTask of tasksToExecute) {
            try {
                await lazyTask.task();
                lazyTask.executed = true;
                this.logger.info('OptimizedStartup', `Lazy task completed: ${lazyTask.id}`);
            } catch (error) {
                this.logger.error('OptimizedStartup', `Lazy task failed: ${lazyTask.id}`, error);
            }
        }
    }

    /**
     * 設置懶加載觸發器
     */
    private setupLazyTriggers(): void {
        // 當用戶打開文件時觸發索引
        vscode.workspace.onDidOpenTextDocument(() => {
            this.triggerLazyInit('workspace-indexing');
        });

        // 當用戶保存文件時觸發 TODO 掃描
        vscode.workspace.onDidSaveTextDocument(() => {
            this.triggerLazyInit('todo-scanning');
        });

        // 延遲觸發低優先級任務
        setTimeout(() => {
            this.triggerLazyInit();
        }, 5000); // 5秒後執行剩餘任務
    }

    // 佔位符方法 - 實際實現需要引用相應的服務
    private async initializePluginManager(): Promise<void> {
        // 實現插件管理器初始化
    }

    private async initializeCoreManager(): Promise<void> {
        // 實現核心管理器初始化
    }

    private registerAllCommands(): void {
        // 實現所有命令註冊
    }

    private registerViewProviders(): void {
        // 實現視圖提供者註冊
    }

    private setupFileWatchers(): void {
        // 實現文件監視器設置
    }

    private async performWorkspaceIndexing(): Promise<void> {
        // 實現工作區索引
    }

    private async performTodoScanning(): Promise<void> {
        // 實現 TODO 掃描
    }

    private async performGitAnalysis(): Promise<void> {
        // 實現 Git 分析
    }

    private showMainPanel(): void {
        // 實現主面板顯示
    }

    private showApiKeySetup(): void {
        // 實現 API 密鑰設置
    }

    private showLLMSwitcher(): void {
        // 實現 LLM 切換器
    }

    /**
     * 獲取啟動指標
     */
    getStartupMetrics(): StartupMetrics {
        return { ...this.startupMetrics };
    }
}

interface StartupMetrics {
    startTime: number;
    criticalPhaseTime: number;
    backgroundPhaseTime: number;
    totalTime: number;
    memoryUsage: number;
}

interface LazyInitTask {
    id: string;
    task: () => Promise<void>;
    priority: 'high' | 'medium' | 'low';
    executed: boolean;
}
