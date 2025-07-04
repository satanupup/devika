import * as vscode from 'vscode';
import { VSCodeAPICrawler, CrawlResult } from '../crawler/VSCodeAPICrawler';
import { APIDAO } from '../storage/APIDAO';
import { UpdatePlanGenerator, UpdatePlan } from '../planning/UpdatePlanGenerator';
import { DatabaseManager } from '../storage/DatabaseManager';

export interface APIManagerConfig {
    autoScanInterval?: number; // 自動掃描間隔（小時）
    enableAutoUpdate?: boolean;
    outputDirectory?: string;
    notificationLevel?: 'all' | 'important' | 'none';
}

export interface ScanResult {
    success: boolean;
    crawlResult?: CrawlResult;
    updatePlan?: UpdatePlan;
    updatePlanPath?: string;
    error?: string;
    duration: number;
}

export class VSCodeAPIManager {
    private crawler: VSCodeAPICrawler;
    private apiDAO: APIDAO;
    private planGenerator: UpdatePlanGenerator;
    private dbManager: DatabaseManager;
    private config: APIManagerConfig;
    private scanTimer?: NodeJS.Timeout;

    private onScanCompleteEmitter = new vscode.EventEmitter<ScanResult>();
    public readonly onScanComplete = this.onScanCompleteEmitter.event;

    constructor(dbManager: DatabaseManager, config: APIManagerConfig = {}) {
        this.dbManager = dbManager;
        this.crawler = new VSCodeAPICrawler(dbManager);
        this.apiDAO = new APIDAO(dbManager);
        this.planGenerator = new UpdatePlanGenerator(dbManager);

        this.config = {
            autoScanInterval: 24, // 預設每24小時掃描一次
            enableAutoUpdate: false,
            outputDirectory: undefined,
            notificationLevel: 'important',
            ...config
        };

        this.setupAutoScan();
    }

    /**
     * 手動執行完整的 API 掃描和更新計畫生成
     */
    async performFullScan(): Promise<ScanResult> {
        const startTime = Date.now();

        try {
            vscode.window.showInformationMessage('開始掃描 VS Code API...');

            // 執行 API 爬取
            const crawlResult = await this.crawler.crawlVSCodeAPI();

            // 保存 API 數據到數據庫
            await this.saveAPIData(crawlResult);

            // 生成更新計畫
            const updatePlan = await this.planGenerator.generateUpdatePlan(crawlResult);

            // 保存更新計畫到文件
            const updatePlanPath = await this.planGenerator.saveUpdatePlanToFile(
                updatePlan,
                this.config.outputDirectory
            );

            const duration = Date.now() - startTime;

            const result: ScanResult = {
                success: true,
                crawlResult,
                updatePlan,
                updatePlanPath,
                duration
            };

            // 顯示結果通知
            this.showScanResultNotification(result);

            // 觸發事件
            this.onScanCompleteEmitter.fire(result);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            const result: ScanResult = {
                success: false,
                error: errorMessage,
                duration
            };

            vscode.window.showErrorMessage(`API 掃描失敗: ${errorMessage}`);
            this.onScanCompleteEmitter.fire(result);

            return result;
        }
    }

    /**
     * 檢查 API 更新（不生成完整計畫）
     */
    async checkForUpdates(): Promise<{
        hasUpdates: boolean;
        newAPIs: number;
        updatedAPIs: number;
        deprecatedAPIs: number;
        lastScanDate?: Date;
    }> {
        try {
            // 獲取最後一次掃描結果
            const lastCrawl = await this.dbManager.get<any>(`
                SELECT * FROM api_crawl_history 
                ORDER BY timestamp DESC 
                LIMIT 1
            `);

            if (!lastCrawl) {
                return {
                    hasUpdates: true,
                    newAPIs: 0,
                    updatedAPIs: 0,
                    deprecatedAPIs: 0
                };
            }

            // 執行快速掃描檢查
            const quickScan = await this.performQuickScan();

            return {
                hasUpdates: quickScan.hasChanges,
                newAPIs: quickScan.newAPIs,
                updatedAPIs: quickScan.updatedAPIs,
                deprecatedAPIs: quickScan.deprecatedAPIs,
                lastScanDate: new Date(lastCrawl.timestamp)
            };

        } catch (error) {
            console.error('檢查更新失敗:', error);
            return {
                hasUpdates: false,
                newAPIs: 0,
                updatedAPIs: 0,
                deprecatedAPIs: 0
            };
        }
    }

    /**
     * 獲取 API 覆蓋率報告
     */
    async getAPICoverageReport(): Promise<{
        totalAPIs: number;
        usedAPIs: number;
        unusedAPIs: number;
        coveragePercentage: number;
        mostUsedAPIs: Array<{ name: string; namespace: string; usage_count: number }>;
        deprecatedAPIsInUse: Array<{ name: string; namespace: string; usage_count: number }>;
        recommendations: string[];
    }> {
        const usageStats = await this.apiDAO.getAPIUsageStats();
        const unusedAPIs = await this.apiDAO.getUnusedAPIs();
        const deprecatedInUse = await this.apiDAO.getDeprecatedAPIsInUse();

        const coveragePercentage = usageStats.totalAPIs > 0
            ? (usageStats.usedAPIs / usageStats.totalAPIs) * 100
            : 0;

        const recommendations: string[] = [];

        if (coveragePercentage < 30) {
            recommendations.push('API 覆蓋率較低，建議整合更多核心 VS Code API');
        }

        if (deprecatedInUse.length > 0) {
            recommendations.push(`發現 ${deprecatedInUse.length} 個已棄用的 API 仍在使用，建議盡快遷移`);
        }

        if (unusedAPIs.length > 50) {
            recommendations.push('有大量未使用的 API，可以考慮整合以提供更豐富的功能');
        }

        return {
            totalAPIs: usageStats.totalAPIs,
            usedAPIs: usageStats.usedAPIs,
            unusedAPIs: usageStats.unusedAPIs,
            coveragePercentage,
            mostUsedAPIs: usageStats.mostUsedAPIs,
            deprecatedAPIsInUse: usageStats.deprecatedAPIsInUse,
            recommendations
        };
    }

    /**
     * 搜索 API
     */
    async searchAPIs(query: string): Promise<Array<{
        name: string;
        namespace: string;
        type: string;
        description: string;
        isUsed: boolean;
        isDeprecated: boolean;
        url?: string;
    }>> {
        const results = await this.apiDAO.searchEndpoints(query);

        return results.map(api => ({
            name: api.name,
            namespace: api.namespace_id,
            type: api.type,
            description: api.description || '',
            isUsed: api.usage_count > 0,
            isDeprecated: api.deprecated === 1,
            url: api.url
        }));
    }

    /**
     * 獲取 API 詳細信息
     */
    async getAPIDetails(apiId: string): Promise<{
        endpoint: any;
        parameters: any[];
        examples: string[];
        namespace: any;
        usageLocations: Array<{ file: string; line: number; context: string }>;
    } | null> {
        const details = await this.apiDAO.getEndpointDetails(apiId);
        if (!details) {
            return null;
        }

        // 獲取使用位置
        const usageLocations = await this.dbManager.query<any>(`
            SELECT file_path, line_number, usage_context 
            FROM extension_api_usage 
            WHERE endpoint_id = ? AND is_active = 1
        `, [apiId]);

        return {
            ...details,
            usageLocations: usageLocations.map(usage => ({
                file: usage.file_path,
                line: usage.line_number || 0,
                context: usage.usage_context || ''
            }))
        };
    }

    /**
     * 設置自動掃描
     */
    private setupAutoScan(): void {
        if (this.config.enableAutoUpdate && this.config.autoScanInterval) {
            const intervalMs = this.config.autoScanInterval * 60 * 60 * 1000; // 轉換為毫秒

            this.scanTimer = setInterval(async () => {
                console.log('執行自動 API 掃描...');
                await this.performFullScan();
            }, intervalMs);
        }
    }

    /**
     * 執行快速掃描
     */
    private async performQuickScan(): Promise<{
        hasChanges: boolean;
        newAPIs: number;
        updatedAPIs: number;
        deprecatedAPIs: number;
    }> {
        // 這裡實作快速掃描邏輯
        // 可以只檢查主要頁面的變更，而不進行完整爬取

        // 暫時返回模擬數據
        return {
            hasChanges: false,
            newAPIs: 0,
            updatedAPIs: 0,
            deprecatedAPIs: 0
        };
    }

    /**
     * 保存 API 數據到數據庫
     */
    private async saveAPIData(crawlResult: CrawlResult): Promise<void> {
        console.log('保存 API 數據到數據庫...');

        for (const namespace of crawlResult.namespaces) {
            const namespaceId = await this.apiDAO.saveNamespace(namespace);

            for (const endpoint of namespace.endpoints) {
                await this.apiDAO.saveEndpoint(endpoint, namespaceId);
            }
        }

        console.log('API 數據保存完成');
    }

    /**
     * 顯示掃描結果通知
     */
    private showScanResultNotification(result: ScanResult): void {
        if (this.config.notificationLevel === 'none') {
            return;
        }

        if (result.success && result.crawlResult) {
            const { newAPIs, updatedAPIs, deprecatedAPIs } = result.crawlResult;
            const hasImportantChanges = newAPIs.length > 0 || deprecatedAPIs.length > 0;

            if (this.config.notificationLevel === 'all' || hasImportantChanges) {
                const message = `API 掃描完成！新增: ${newAPIs.length}, 更新: ${updatedAPIs.length}, 已棄用: ${deprecatedAPIs.length}`;

                if (result.updatePlanPath) {
                    vscode.window.showInformationMessage(
                        message,
                        '查看更新計畫'
                    ).then(selection => {
                        if (selection === '查看更新計畫') {
                            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.updatePlanPath!));
                        }
                    });
                } else {
                    vscode.window.showInformationMessage(message);
                }
            }
        }
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig: Partial<APIManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // 重新設置自動掃描
        if (this.scanTimer) {
            clearInterval(this.scanTimer);
            this.scanTimer = undefined;
        }

        this.setupAutoScan();
    }

    /**
     * 清理資源
     */
    dispose(): void {
        if (this.scanTimer) {
            clearInterval(this.scanTimer);
        }

        this.onScanCompleteEmitter.dispose();
    }
}
