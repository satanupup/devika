/**
 * 依賴注入容器
 * 實現控制反轉和依賴注入模式，改善模組化設計
 */

import { Logger } from '../utils/Logger';
import { ErrorHandler, DevikaError, ErrorType, ErrorSeverity } from '../utils/ErrorHandler';

/**
 * 服務生命週期
 */
export enum ServiceLifetime {
    SINGLETON = 'singleton',
    TRANSIENT = 'transient',
    SCOPED = 'scoped'
}

/**
 * 服務描述符
 */
export interface ServiceDescriptor<T = any> {
    token: string | symbol;
    implementation?: new (...args: any[]) => T;
    factory?: (...args: any[]) => T;
    instance?: T;
    lifetime: ServiceLifetime;
    dependencies?: (string | symbol)[];
}

/**
 * 依賴注入容器
 */
export class DependencyContainer {
    private static instance: DependencyContainer;
    private services = new Map<string | symbol, ServiceDescriptor>();
    private instances = new Map<string | symbol, any>();
    private scopedInstances = new Map<string, Map<string | symbol, any>>();
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private currentScope?: string;

    private constructor() {
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
    }

    public static getInstance(): DependencyContainer {
        if (!DependencyContainer.instance) {
            DependencyContainer.instance = new DependencyContainer();
        }
        return DependencyContainer.instance;
    }

    /**
     * 註冊單例服務
     */
    public registerSingleton<T>(
        token: string | symbol,
        implementation: new (...args: any[]) => T,
        dependencies?: (string | symbol)[]
    ): this {
        return this.register(token, implementation, ServiceLifetime.SINGLETON, dependencies);
    }

    /**
     * 註冊瞬態服務
     */
    public registerTransient<T>(
        token: string | symbol,
        implementation: new (...args: any[]) => T,
        dependencies?: (string | symbol)[]
    ): this {
        return this.register(token, implementation, ServiceLifetime.TRANSIENT, dependencies);
    }

    /**
     * 註冊作用域服務
     */
    public registerScoped<T>(
        token: string | symbol,
        implementation: new (...args: any[]) => T,
        dependencies?: (string | symbol)[]
    ): this {
        return this.register(token, implementation, ServiceLifetime.SCOPED, dependencies);
    }

    /**
     * 註冊工廠服務
     */
    public registerFactory<T>(
        token: string | symbol,
        factory: (...args: any[]) => T,
        lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
        dependencies?: (string | symbol)[]
    ): this {
        const descriptor: ServiceDescriptor<T> = {
            token,
            factory,
            lifetime,
            dependencies
        };

        this.services.set(token, descriptor);
        this.logger.debug('DependencyContainer', `Registered factory service: ${String(token)}`, {
            lifetime,
            dependencies
        });

        return this;
    }

    /**
     * 註冊實例
     */
    public registerInstance<T>(token: string | symbol, instance: T): this {
        const descriptor: ServiceDescriptor<T> = {
            token,
            instance,
            lifetime: ServiceLifetime.SINGLETON
        };

        this.services.set(token, descriptor);
        this.instances.set(token, instance);
        
        this.logger.debug('DependencyContainer', `Registered instance: ${String(token)}`);
        return this;
    }

    /**
     * 通用註冊方法
     */
    private register<T>(
        token: string | symbol,
        implementation: new (...args: any[]) => T,
        lifetime: ServiceLifetime,
        dependencies?: (string | symbol)[]
    ): this {
        const descriptor: ServiceDescriptor<T> = {
            token,
            implementation,
            lifetime,
            dependencies
        };

        this.services.set(token, descriptor);
        this.logger.debug('DependencyContainer', `Registered service: ${String(token)}`, {
            lifetime,
            dependencies
        });

        return this;
    }

    /**
     * 解析服務
     */
    public resolve<T>(token: string | symbol): T {
        try {
            return this.resolveInternal<T>(token, new Set());
        } catch (error) {
            const devikaError = new DevikaError(
                `Failed to resolve service: ${String(token)}`,
                ErrorType.CONFIGURATION,
                ErrorSeverity.HIGH,
                'SERVICE_RESOLUTION_FAILED',
                { token: String(token), error: error instanceof Error ? error.message : String(error) }
            );

            this.logger.error('DependencyContainer', 'Service resolution failed', devikaError);
            throw devikaError;
        }
    }

    /**
     * 內部解析方法（帶循環依賴檢測）
     */
    private resolveInternal<T>(token: string | symbol, resolving: Set<string | symbol>): T {
        // 檢測循環依賴
        if (resolving.has(token)) {
            throw new Error(`Circular dependency detected: ${Array.from(resolving).map(String).join(' -> ')} -> ${String(token)}`);
        }

        const descriptor = this.services.get(token);
        if (!descriptor) {
            throw new Error(`Service not registered: ${String(token)}`);
        }

        // 檢查是否已有實例
        const existingInstance = this.getExistingInstance(token, descriptor.lifetime);
        if (existingInstance) {
            return existingInstance;
        }

        resolving.add(token);

        try {
            let instance: T;

            if (descriptor.instance) {
                instance = descriptor.instance;
            } else if (descriptor.factory) {
                const dependencies = this.resolveDependencies(descriptor.dependencies || [], resolving);
                instance = descriptor.factory(...dependencies);
            } else if (descriptor.implementation) {
                const dependencies = this.resolveDependencies(descriptor.dependencies || [], resolving);
                instance = new descriptor.implementation(...dependencies);
            } else {
                throw new Error(`Invalid service descriptor for: ${String(token)}`);
            }

            // 根據生命週期存儲實例
            this.storeInstance(token, instance, descriptor.lifetime);

            resolving.delete(token);
            return instance;

        } catch (error) {
            resolving.delete(token);
            throw error;
        }
    }

    /**
     * 解析依賴
     */
    private resolveDependencies(dependencies: (string | symbol)[], resolving: Set<string | symbol>): any[] {
        return dependencies.map(dep => this.resolveInternal(dep, resolving));
    }

    /**
     * 獲取現有實例
     */
    private getExistingInstance<T>(token: string | symbol, lifetime: ServiceLifetime): T | undefined {
        switch (lifetime) {
            case ServiceLifetime.SINGLETON:
                return this.instances.get(token);
            
            case ServiceLifetime.SCOPED:
                if (this.currentScope) {
                    const scopedInstances = this.scopedInstances.get(this.currentScope);
                    return scopedInstances?.get(token);
                }
                return undefined;
            
            case ServiceLifetime.TRANSIENT:
                return undefined;
            
            default:
                return undefined;
        }
    }

    /**
     * 存儲實例
     */
    private storeInstance<T>(token: string | symbol, instance: T, lifetime: ServiceLifetime): void {
        switch (lifetime) {
            case ServiceLifetime.SINGLETON:
                this.instances.set(token, instance);
                break;
            
            case ServiceLifetime.SCOPED:
                if (this.currentScope) {
                    let scopedInstances = this.scopedInstances.get(this.currentScope);
                    if (!scopedInstances) {
                        scopedInstances = new Map();
                        this.scopedInstances.set(this.currentScope, scopedInstances);
                    }
                    scopedInstances.set(token, instance);
                }
                break;
            
            case ServiceLifetime.TRANSIENT:
                // 瞬態服務不存儲實例
                break;
        }
    }

    /**
     * 創建作用域
     */
    public createScope(scopeId: string): void {
        this.currentScope = scopeId;
        this.scopedInstances.set(scopeId, new Map());
        this.logger.debug('DependencyContainer', `Created scope: ${scopeId}`);
    }

    /**
     * 釋放作用域
     */
    public disposeScope(scopeId: string): void {
        const scopedInstances = this.scopedInstances.get(scopeId);
        if (scopedInstances) {
            // 調用 dispose 方法（如果存在）
            for (const instance of scopedInstances.values()) {
                if (instance && typeof instance.dispose === 'function') {
                    try {
                        instance.dispose();
                    } catch (error) {
                        this.logger.warn('DependencyContainer', 'Error disposing scoped instance', error);
                    }
                }
            }
            
            this.scopedInstances.delete(scopeId);
        }

        if (this.currentScope === scopeId) {
            this.currentScope = undefined;
        }

        this.logger.debug('DependencyContainer', `Disposed scope: ${scopeId}`);
    }

    /**
     * 檢查服務是否已註冊
     */
    public isRegistered(token: string | symbol): boolean {
        return this.services.has(token);
    }

    /**
     * 獲取所有註冊的服務
     */
    public getRegisteredServices(): (string | symbol)[] {
        return Array.from(this.services.keys());
    }

    /**
     * 獲取服務描述符
     */
    public getServiceDescriptor(token: string | symbol): ServiceDescriptor | undefined {
        return this.services.get(token);
    }

    /**
     * 清除所有服務
     */
    public clear(): void {
        // 調用所有單例實例的 dispose 方法
        for (const instance of this.instances.values()) {
            if (instance && typeof instance.dispose === 'function') {
                try {
                    instance.dispose();
                } catch (error) {
                    this.logger.warn('DependencyContainer', 'Error disposing singleton instance', error);
                }
            }
        }

        // 清除所有作用域
        for (const scopeId of this.scopedInstances.keys()) {
            this.disposeScope(scopeId);
        }

        this.services.clear();
        this.instances.clear();
        this.scopedInstances.clear();
        this.currentScope = undefined;

        this.logger.info('DependencyContainer', 'Container cleared');
    }

    /**
     * 獲取容器統計
     */
    public getStatistics(): {
        registeredServices: number;
        singletonInstances: number;
        scopedInstances: number;
        activeScopes: number;
    } {
        let totalScopedInstances = 0;
        for (const scopedInstances of this.scopedInstances.values()) {
            totalScopedInstances += scopedInstances.size;
        }

        return {
            registeredServices: this.services.size,
            singletonInstances: this.instances.size,
            scopedInstances: totalScopedInstances,
            activeScopes: this.scopedInstances.size
        };
    }

    /**
     * 釋放容器資源
     */
    public dispose(): void {
        this.clear();
    }
}

/**
 * 服務裝飾器
 */
export function Injectable(token?: string | symbol) {
    return function <T extends new (...args: any[]) => any>(constructor: T) {
        const serviceToken = token || constructor.name;
        
        // 這裡可以添加元數據來自動註冊服務
        // 實際實現可能需要使用 reflect-metadata 庫
        
        return constructor;
    };
}

/**
 * 依賴注入裝飾器
 */
export function Inject(token: string | symbol) {
    return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
        // 這裡可以添加參數元數據
        // 實際實現可能需要使用 reflect-metadata 庫
    };
}

/**
 * 全局容器實例
 */
export const container = DependencyContainer.getInstance();
