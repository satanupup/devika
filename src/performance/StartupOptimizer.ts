import * as vscode from 'vscode';

export interface StartupMetrics {
    extensionActivationTime: number;
    serviceInitializationTime: number;
    indexLoadTime: number;
    totalStartupTime: number;
    cacheHitRate: number;
    memoryUsage: number;
}

export interface LazyLoadableService {
    name: string;
    initialize(): Promise<void>;
    isInitialized(): boolean;
    priority: 'high' | 'medium' | 'low';
}

export class StartupOptimizer {
    private startupMetrics: StartupMetrics;
    private lazyServices: Map<string, LazyLoadableService> = new Map();
    private initializationPromises: Map<string, Promise<void>> = new Map();
    private startupCache: Map<string, any> = new Map();
    private extensionStartTime: number;

    constructor(private context: vscode.ExtensionContext) {
        this.extensionStartTime = Date.now();
        this.startupMetrics = {
            extensionActivationTime: 0,
            serviceInitializationTime: 0,
            indexLoadTime: 0,
            totalStartupTime: 0,
            cacheHitRate: 0,
            memoryUsage: 0
        };
        this.loadStartupCache();
    }

    async optimizeStartup(): Promise<void> {
        const startTime = Date.now();

        try {
            // Phase 1: Critical services only (< 500ms)
            await this.initializeCriticalServices();

            // Phase 2: Background initialization
            this.initializeBackgroundServices();

            // Phase 3: Lazy initialization setup
            this.setupLazyInitialization();

            this.startupMetrics.totalStartupTime = Date.now() - startTime;
            this.recordStartupMetrics();

        } catch (error) {
            console.error('Startup optimization failed:', error);
            throw error;
        }
    }

    private async initializeCriticalServices(): Promise<void> {
        const criticalStartTime = Date.now();

        // Only initialize absolutely essential services
        const criticalServices = [
            'ConfigManager',
            'UIManager'
        ];

        const promises = criticalServices.map(async (serviceName) => {
            const cached = this.getFromCache(`service_${serviceName}`);
            if (cached) {
                return this.restoreServiceFromCache(serviceName, cached);
            }
            return this.initializeService(serviceName);
        });

        await Promise.all(promises);

        this.startupMetrics.serviceInitializationTime = Date.now() - criticalStartTime;
    }

    private initializeBackgroundServices(): void {
        // Initialize non-critical services in background
        const backgroundServices = [
            'LLMService',
            'GitService',
            'PluginManager',
            'TaskManager'
        ];

        // Use setTimeout to avoid blocking the main thread
        setTimeout(async () => {
            for (const serviceName of backgroundServices) {
                try {
                    await this.initializeServiceLazily(serviceName);
                } catch (error) {
                    console.warn(`Background service ${serviceName} failed to initialize:`, error);
                }
            }
        }, 100);
    }

    private setupLazyInitialization(): void {
        // Register lazy-loadable services
        this.registerLazyService('CodeParser', {
            name: 'CodeParser',
            priority: 'medium',
            initialize: async () => {
                const { CodeParser } = await import('../context/CodeParser');
                // Initialize CodeParser
            },
            isInitialized: () => this.initializationPromises.has('CodeParser')
        });

        this.registerLazyService('ProjectAnalyzer', {
            name: 'ProjectAnalyzer',
            priority: 'low',
            initialize: async () => {
                const { ProjectAnalyzer } = await import('../agent/ProjectAnalyzer');
                // Initialize ProjectAnalyzer
            },
            isInitialized: () => this.initializationPromises.has('ProjectAnalyzer')
        });

        this.registerLazyService('UsageAnalytics', {
            name: 'UsageAnalytics',
            priority: 'low',
            initialize: async () => {
                const { UsageAnalytics } = await import('../analytics/UsageAnalytics');
                // Initialize UsageAnalytics
            },
            isInitialized: () => this.initializationPromises.has('UsageAnalytics')
        });
    }

    registerLazyService(name: string, service: LazyLoadableService): void {
        this.lazyServices.set(name, service);
    }

    async getService<T>(serviceName: string): Promise<T> {
        // Check if service is already initialized
        if (this.initializationPromises.has(serviceName)) {
            await this.initializationPromises.get(serviceName);
            return this.getServiceInstance<T>(serviceName);
        }

        // Initialize service lazily
        const service = this.lazyServices.get(serviceName);
        if (service) {
            const initPromise = service.initialize();
            this.initializationPromises.set(serviceName, initPromise);
            await initPromise;
            return this.getServiceInstance<T>(serviceName);
        }

        throw new Error(`Service ${serviceName} not found`);
    }

    private getServiceInstance<T>(serviceName: string): T {
        // This would return the actual service instance
        // Implementation depends on your service registry
        return {} as T;
    }

    private async initializeService(serviceName: string): Promise<void> {
        const startTime = Date.now();

        try {
            // Dynamic import to reduce initial bundle size
            switch (serviceName) {
                case 'ConfigManager':
                    const { ConfigManager } = await import('../config/ConfigManager');
                    // Initialize ConfigManager
                    break;
                case 'UIManager':
                    const { UIManager } = await import('../ui/UIManager');
                    // Initialize UIManager
                    break;
                default:
                    console.warn(`Unknown service: ${serviceName}`);
            }

            // Cache the initialization result
            this.cacheService(serviceName, { initialized: true, timestamp: Date.now() });

        } catch (error) {
            console.error(`Failed to initialize service ${serviceName}:`, error);
            throw error;
        }
    }

    private async initializeServiceLazily(serviceName: string): Promise<void> {
        if (this.initializationPromises.has(serviceName)) {
            return this.initializationPromises.get(serviceName);
        }

        const initPromise = this.initializeService(serviceName);
        this.initializationPromises.set(serviceName, initPromise);
        return initPromise;
    }

    private async restoreServiceFromCache(serviceName: string, cached: any): Promise<void> {
        // Restore service state from cache
        console.log(`Restoring ${serviceName} from cache`);
        // Implementation would restore the actual service state
    }

    private cacheService(serviceName: string, data: any): void {
        this.startupCache.set(`service_${serviceName}`, {
            ...data,
            timestamp: Date.now()
        });
        this.saveStartupCache();
    }

    private getFromCache(key: string): any {
        const cached = this.startupCache.get(key);
        if (!cached) {return null;}

        // Check if cache is still valid (24 hours)
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - cached.timestamp > maxAge) {
            this.startupCache.delete(key);
            return null;
        }

        return cached;
    }

    private loadStartupCache(): void {
        try {
            const saved = this.context.globalState.get<any[]>('startupCache', []);
            this.startupCache = new Map(saved);
        } catch (error) {
            console.warn('Failed to load startup cache:', error);
        }
    }

    private saveStartupCache(): void {
        try {
            const cacheArray = Array.from(this.startupCache.entries());
            this.context.globalState.update('startupCache', cacheArray);
        } catch (error) {
            console.warn('Failed to save startup cache:', error);
        }
    }

    private recordStartupMetrics(): void {
        this.startupMetrics.extensionActivationTime = Date.now() - this.extensionStartTime;
        this.startupMetrics.memoryUsage = this.getMemoryUsage();
        this.startupMetrics.cacheHitRate = this.calculateCacheHitRate();

        // Store metrics for analysis
        this.context.globalState.update('lastStartupMetrics', this.startupMetrics);

        // Log performance metrics
        console.log('Startup Metrics:', this.startupMetrics);

        // Show warning if startup is slow
        if (this.startupMetrics.totalStartupTime > 3000) {
            vscode.window.showWarningMessage(
                `Devika 啟動較慢 (${this.startupMetrics.totalStartupTime}ms)，建議檢查系統性能`
            );
        }
    }

    private getMemoryUsage(): number {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        return 0;
    }

    private calculateCacheHitRate(): number {
        // Calculate cache hit rate based on service initialization
        let hits = 0;
        let total = 0;

        for (const [key] of this.startupCache.entries()) {
            if (key.startsWith('service_')) {
                total++;
                if (this.getFromCache(key)) {
                    hits++;
                }
            }
        }

        return total > 0 ? (hits / total) * 100 : 0;
    }

    async preloadCriticalResources(): Promise<void> {
        // Preload frequently used resources
        const criticalResources = [
            'common-prompts',
            'language-configs',
            'ui-templates'
        ];

        const promises = criticalResources.map(async (resource) => {
            const cached = this.getFromCache(`resource_${resource}`);
            if (!cached) {
                await this.loadAndCacheResource(resource);
            }
        });

        await Promise.all(promises);
    }

    private async loadAndCacheResource(resourceName: string): Promise<void> {
        try {
            let resourceData: any;

            switch (resourceName) {
                case 'common-prompts':
                    resourceData = await this.loadCommonPrompts();
                    break;
                case 'language-configs':
                    resourceData = await this.loadLanguageConfigs();
                    break;
                case 'ui-templates':
                    resourceData = await this.loadUITemplates();
                    break;
                default:
                    return;
            }

            this.startupCache.set(`resource_${resourceName}`, {
                data: resourceData,
                timestamp: Date.now()
            });

        } catch (error) {
            console.warn(`Failed to load resource ${resourceName}:`, error);
        }
    }

    private async loadCommonPrompts(): Promise<any> {
        // Load commonly used prompts
        return {
            codeAnalysis: "Analyze the following code...",
            documentation: "Generate documentation for...",
            refactoring: "Suggest refactoring for..."
        };
    }

    private async loadLanguageConfigs(): Promise<any> {
        // Load language-specific configurations
        return {
            typescript: { extensions: ['.ts', '.tsx'], parser: 'typescript' },
            javascript: { extensions: ['.js', '.jsx'], parser: 'javascript' },
            python: { extensions: ['.py'], parser: 'python' }
        };
    }

    private async loadUITemplates(): Promise<any> {
        // Load UI templates
        return {
            chatInterface: '<div class="chat-container">...</div>',
            taskPanel: '<div class="task-panel">...</div>'
        };
    }

    getStartupMetrics(): StartupMetrics {
        return { ...this.startupMetrics };
    }

    async clearStartupCache(): Promise<void> {
        this.startupCache.clear();
        await this.context.globalState.update('startupCache', []);
        vscode.window.showInformationMessage('啟動緩存已清除');
    }

    async optimizeForNextStartup(): Promise<void> {
        // Prepare optimizations for next startup
        await this.preloadCriticalResources();

        // Warm up service caches
        const servicesToWarm = ['ConfigManager', 'UIManager'];
        for (const service of servicesToWarm) {
            this.cacheService(service, { prewarmed: true });
        }

        vscode.window.showInformationMessage('下次啟動已優化');
    }

    // Method to be called when extension is deactivating
    async onExtensionDeactivate(): Promise<void> {
        // Save final metrics and cache state
        await this.saveStartupCache();

        // Prepare for next startup
        await this.optimizeForNextStartup();
    }
}
