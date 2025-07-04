/**
 * 懶加載管理器
 * 實現模組的延遲加載以優化啟動時間
 */

import { Logger } from '../utils/Logger';
import { ErrorHandler, DevikaError, ErrorType, ErrorSeverity } from '../utils/ErrorHandler';

/**
 * 懶加載模組接口
 */
export interface LazyModule<T = any> {
    name: string;
    priority: 'high' | 'medium' | 'low';
    dependencies?: string[];
    loader: () => Promise<T>;
    instance?: T;
    loaded: boolean;
    loading: boolean;
    error?: Error;
}

/**
 * 懶加載配置
 */
export interface LazyLoadConfig {
    maxConcurrentLoads: number;
    loadTimeout: number;
    retryAttempts: number;
    retryDelay: number;
}

/**
 * 懶加載管理器
 */
export class LazyLoader {
    private static instance: LazyLoader;
    private modules = new Map<string, LazyModule>();
    private loadingQueue: string[] = [];
    private currentlyLoading = new Set<string>();
    private loadPromises = new Map<string, Promise<any>>();
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private config: LazyLoadConfig;

    private constructor(config?: Partial<LazyLoadConfig>) {
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        this.config = {
            maxConcurrentLoads: 3,
            loadTimeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            ...config
        };
    }

    public static getInstance(config?: Partial<LazyLoadConfig>): LazyLoader {
        if (!LazyLoader.instance) {
            LazyLoader.instance = new LazyLoader(config);
        }
        return LazyLoader.instance;
    }

    /**
     * 註冊懶加載模組
     */
    public registerModule<T>(
        name: string,
        loader: () => Promise<T>,
        options: {
            priority?: 'high' | 'medium' | 'low';
            dependencies?: string[];
        } = {}
    ): void {
        if (this.modules.has(name)) {
            this.logger.warn('LazyLoader', `Module ${name} is already registered`);
            return;
        }

        const module: LazyModule<T> = {
            name,
            priority: options.priority || 'medium',
            dependencies: options.dependencies || [],
            loader,
            loaded: false,
            loading: false
        };

        this.modules.set(name, module);
        this.logger.debug('LazyLoader', `Registered module: ${name}`, { priority: module.priority, dependencies: module.dependencies });
    }

    /**
     * 加載模組
     */
    public async loadModule<T>(name: string): Promise<T> {
        const module = this.modules.get(name);
        if (!module) {
            throw new DevikaError(
                `Module ${name} not found`,
                ErrorType.CONFIGURATION,
                ErrorSeverity.HIGH,
                'MODULE_NOT_FOUND',
                { moduleName: name }
            );
        }

        // 如果已經加載，直接返回實例
        if (module.loaded && module.instance) {
            return module.instance;
        }

        // 如果正在加載，等待加載完成
        if (module.loading) {
            const existingPromise = this.loadPromises.get(name);
            if (existingPromise) {
                return await existingPromise;
            }
        }

        // 開始加載
        const loadPromise = this.performLoad<T>(module);
        this.loadPromises.set(name, loadPromise);

        try {
            const result = await loadPromise;
            this.loadPromises.delete(name);
            return result;
        } catch (error) {
            this.loadPromises.delete(name);
            throw error;
        }
    }

    /**
     * 執行模組加載
     */
    private async performLoad<T>(module: LazyModule<T>): Promise<T> {
        try {
            this.logger.info('LazyLoader', `Loading module: ${module.name}`);
            module.loading = true;
            this.currentlyLoading.add(module.name);

            // 檢查依賴
            await this.loadDependencies(module);

            // 等待並發加載限制
            await this.waitForLoadSlot();

            // 加載模組
            const startTime = Date.now();
            const instance = await this.loadWithTimeout(module);
            const loadTime = Date.now() - startTime;

            module.instance = instance;
            module.loaded = true;
            module.loading = false;
            module.error = undefined;
            this.currentlyLoading.delete(module.name);

            this.logger.info('LazyLoader', `Module loaded successfully: ${module.name}`, { loadTime });
            return instance;

        } catch (error) {
            module.loading = false;
            module.error = error instanceof Error ? error : new Error(String(error));
            this.currentlyLoading.delete(module.name);

            const devikaError = new DevikaError(
                `Failed to load module ${module.name}: ${module.error.message}`,
                ErrorType.CONFIGURATION,
                ErrorSeverity.HIGH,
                'MODULE_LOAD_FAILED',
                { moduleName: module.name, error: module.error.message }
            );

            this.logger.error('LazyLoader', `Module load failed: ${module.name}`, devikaError);
            await this.errorHandler.handleError(devikaError, false);
            throw devikaError;
        }
    }

    /**
     * 加載依賴模組
     */
    private async loadDependencies(module: LazyModule): Promise<void> {
        if (!module.dependencies || module.dependencies.length === 0) {
            return;
        }

        this.logger.debug('LazyLoader', `Loading dependencies for ${module.name}`, { dependencies: module.dependencies });

        const dependencyPromises = module.dependencies.map(dep => this.loadModule(dep));
        await Promise.all(dependencyPromises);
    }

    /**
     * 等待加載槽位
     */
    private async waitForLoadSlot(): Promise<void> {
        while (this.currentlyLoading.size >= this.config.maxConcurrentLoads) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * 帶超時的加載
     */
    private async loadWithTimeout<T>(module: LazyModule<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Module load timeout: ${module.name}`));
            }, this.config.loadTimeout);

            module.loader()
                .then(instance => {
                    clearTimeout(timeout);
                    resolve(instance);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    /**
     * 預加載高優先級模組
     */
    public async preloadHighPriorityModules(): Promise<void> {
        const highPriorityModules = Array.from(this.modules.values())
            .filter(module => module.priority === 'high' && !module.loaded && !module.loading)
            .sort((a, b) => (a.dependencies?.length || 0) - (b.dependencies?.length || 0));

        this.logger.info('LazyLoader', `Preloading ${highPriorityModules.length} high priority modules`);

        const loadPromises = highPriorityModules.map(module =>
            this.loadModule(module.name).catch(error => {
                this.logger.warn('LazyLoader', `Failed to preload module: ${module.name}`, error);
            })
        );

        await Promise.allSettled(loadPromises);
    }

    /**
     * 批量加載模組
     */
    public async loadModules(names: string[]): Promise<Map<string, any>> {
        const results = new Map<string, any>();
        const loadPromises = names.map(async name => {
            try {
                const instance = await this.loadModule(name);
                results.set(name, instance);
            } catch (error) {
                this.logger.error('LazyLoader', `Failed to load module in batch: ${name}`, error);
                results.set(name, null);
            }
        });

        await Promise.allSettled(loadPromises);
        return results;
    }

    /**
     * 檢查模組是否已加載
     */
    public isModuleLoaded(name: string): boolean {
        const module = this.modules.get(name);
        return module ? module.loaded : false;
    }

    /**
     * 檢查模組是否正在加載
     */
    public isModuleLoading(name: string): boolean {
        const module = this.modules.get(name);
        return module ? module.loading : false;
    }

    /**
     * 獲取模組實例（如果已加載）
     */
    public getModuleInstance<T>(name: string): T | null {
        const module = this.modules.get(name);
        return module && module.loaded ? module.instance : null;
    }

    /**
     * 獲取所有已註冊的模組
     */
    public getRegisteredModules(): string[] {
        return Array.from(this.modules.keys());
    }

    /**
     * 獲取加載統計
     */
    public getLoadStatistics(): {
        total: number;
        loaded: number;
        loading: number;
        failed: number;
        byPriority: Record<string, number>;
    } {
        const modules = Array.from(this.modules.values());
        const stats = {
            total: modules.length,
            loaded: modules.filter(m => m.loaded).length,
            loading: modules.filter(m => m.loading).length,
            failed: modules.filter(m => m.error).length,
            byPriority: {
                high: modules.filter(m => m.priority === 'high').length,
                medium: modules.filter(m => m.priority === 'medium').length,
                low: modules.filter(m => m.priority === 'low').length
            }
        };

        return stats;
    }

    /**
     * 卸載模組
     */
    public unloadModule(name: string): void {
        const module = this.modules.get(name);
        if (module) {
            module.loaded = false;
            module.loading = false;
            module.instance = undefined;
            module.error = undefined;
            this.currentlyLoading.delete(name);
            this.loadPromises.delete(name);
            this.logger.debug('LazyLoader', `Module unloaded: ${name}`);
        }
    }

    /**
     * 清理所有模組
     */
    public clear(): void {
        this.modules.clear();
        this.loadingQueue = [];
        this.currentlyLoading.clear();
        this.loadPromises.clear();
        this.logger.debug('LazyLoader', 'All modules cleared');
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.clear();
    }
}
