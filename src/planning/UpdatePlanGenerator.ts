import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { APIDAO, APICoverageAnalysis } from '../storage/APIDAO';
import { APIEndpoint, CrawlResult } from '../crawler/VSCodeAPICrawler';
import { DatabaseManager } from '../storage/DatabaseManager';

export interface UpdatePlan {
    generatedAt: Date;
    vscodeVersion: string;
    currentCoverage: number;
    totalAPIs: number;
    usedAPIs: number;
    newAPIs: APIUpdateItem[];
    updatedAPIs: APIUpdateItem[];
    deprecatedAPIs: APIUpdateItem[];
    recommendations: Recommendation[];
    implementationTasks: ImplementationTask[];
}

export interface APIUpdateItem {
    name: string;
    namespace: string;
    type: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    impact: 'breaking' | 'feature' | 'improvement' | 'deprecation';
    estimatedEffort: number; // hours
    implementationGuide: string;
    examples: string[];
    relatedAPIs: string[];
    since?: string;
    url?: string;
}

export interface Recommendation {
    type: 'new_api' | 'deprecated_api' | 'performance' | 'security' | 'best_practice';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    actionItems: string[];
    estimatedEffort: number;
    benefits: string[];
}

export interface ImplementationTask {
    id: string;
    title: string;
    description: string;
    category: 'api_integration' | 'refactoring' | 'testing' | 'documentation';
    priority: 'high' | 'medium' | 'low';
    estimatedHours: number;
    dependencies: string[];
    acceptanceCriteria: string[];
    implementationSteps: string[];
    testingRequirements: string[];
}

export class UpdatePlanGenerator {
    private apiDAO: APIDAO;
    private dbManager: DatabaseManager;

    constructor(dbManager: DatabaseManager) {
        this.dbManager = dbManager;
        this.apiDAO = new APIDAO(dbManager);
    }

    /**
     * 生成完整的更新計畫
     */
    async generateUpdatePlan(crawlResult: CrawlResult): Promise<UpdatePlan> {
        console.log('開始生成更新計畫...');

        // 獲取當前覆蓋率分析
        const coverageAnalysis = await this.apiDAO.getLatestCoverageAnalysis();
        const usageStats = await this.apiDAO.getAPIUsageStats();

        // 分析新 API
        const newAPIItems = await this.analyzeNewAPIs(crawlResult.newAPIs);
        
        // 分析更新的 API
        const updatedAPIItems = await this.analyzeUpdatedAPIs(crawlResult.updatedAPIs);
        
        // 分析已棄用的 API
        const deprecatedAPIItems = await this.analyzeDeprecatedAPIs(crawlResult.deprecatedAPIs);

        // 生成建議
        const recommendations = await this.generateRecommendations(
            crawlResult, 
            coverageAnalysis, 
            usageStats
        );

        // 生成實作任務
        const implementationTasks = await this.generateImplementationTasks(
            newAPIItems,
            updatedAPIItems,
            deprecatedAPIItems,
            recommendations
        );

        const updatePlan: UpdatePlan = {
            generatedAt: new Date(),
            vscodeVersion: crawlResult.version,
            currentCoverage: coverageAnalysis?.coverage_percentage || 0,
            totalAPIs: crawlResult.totalAPIs,
            usedAPIs: usageStats.usedAPIs,
            newAPIs: newAPIItems,
            updatedAPIs: updatedAPIItems,
            deprecatedAPIs: deprecatedAPIItems,
            recommendations,
            implementationTasks
        };

        console.log(`更新計畫生成完成！包含 ${newAPIItems.length} 個新 API，${implementationTasks.length} 個實作任務`);
        
        return updatePlan;
    }

    /**
     * 分析新 API
     */
    private async analyzeNewAPIs(newAPIs: APIEndpoint[]): Promise<APIUpdateItem[]> {
        const items: APIUpdateItem[] = [];

        for (const api of newAPIs) {
            const priority = this.calculateAPIPriority(api);
            const impact = this.determineAPIImpact(api, 'new');
            const estimatedEffort = this.estimateImplementationEffort(api, 'new');

            items.push({
                name: api.name,
                namespace: api.namespace,
                type: api.type,
                description: api.description,
                priority,
                impact: impact as any,
                estimatedEffort,
                implementationGuide: this.generateImplementationGuide(api, 'new'),
                examples: api.examples || [],
                relatedAPIs: api.relatedAPIs || [],
                since: api.since,
                url: api.url
            });
        }

        // 按優先級排序
        return items.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * 分析更新的 API
     */
    private async analyzeUpdatedAPIs(updatedAPIs: APIEndpoint[]): Promise<APIUpdateItem[]> {
        const items: APIUpdateItem[] = [];

        for (const api of updatedAPIs) {
            const priority = this.calculateAPIPriority(api);
            const impact = this.determineAPIImpact(api, 'updated');
            const estimatedEffort = this.estimateImplementationEffort(api, 'updated');

            items.push({
                name: api.name,
                namespace: api.namespace,
                type: api.type,
                description: api.description,
                priority,
                impact: impact as any,
                estimatedEffort,
                implementationGuide: this.generateImplementationGuide(api, 'updated'),
                examples: api.examples || [],
                relatedAPIs: api.relatedAPIs || [],
                since: api.since,
                url: api.url
            });
        }

        return items.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * 分析已棄用的 API
     */
    private async analyzeDeprecatedAPIs(deprecatedAPIs: APIEndpoint[]): Promise<APIUpdateItem[]> {
        const items: APIUpdateItem[] = [];

        for (const api of deprecatedAPIs) {
            items.push({
                name: api.name,
                namespace: api.namespace,
                type: api.type,
                description: api.description,
                priority: 'high', // 已棄用的 API 通常是高優先級
                impact: 'deprecation',
                estimatedEffort: this.estimateImplementationEffort(api, 'deprecated'),
                implementationGuide: this.generateImplementationGuide(api, 'deprecated'),
                examples: api.examples || [],
                relatedAPIs: api.relatedAPIs || [],
                since: api.since,
                url: api.url
            });
        }

        return items;
    }

    /**
     * 計算 API 優先級
     */
    private calculateAPIPriority(api: APIEndpoint): 'high' | 'medium' | 'low' {
        let score = 0;

        // 基於 API 類型的分數
        switch (api.type) {
            case 'class':
            case 'interface':
                score += 3;
                break;
            case 'function':
                score += 2;
                break;
            case 'enum':
            case 'variable':
                score += 1;
                break;
        }

        // 基於命名空間的分數
        const highPriorityNamespaces = ['vscode', 'window', 'workspace', 'commands'];
        if (highPriorityNamespaces.includes(api.namespace.toLowerCase())) {
            score += 2;
        }

        // 基於描述關鍵字的分數
        const highPriorityKeywords = ['editor', 'document', 'file', 'command', 'extension'];
        const description = api.description.toLowerCase();
        for (const keyword of highPriorityKeywords) {
            if (description.includes(keyword)) {
                score += 1;
                break;
            }
        }

        if (score >= 5) return 'high';
        if (score >= 3) return 'medium';
        return 'low';
    }

    /**
     * 確定 API 影響
     */
    private determineAPIImpact(api: APIEndpoint, changeType: 'new' | 'updated' | 'deprecated'): string {
        if (changeType === 'deprecated') return 'deprecation';
        if (changeType === 'new') return 'feature';
        
        // 對於更新的 API，檢查是否有破壞性變更
        if (api.signature && api.signature.includes('deprecated')) {
            return 'breaking';
        }
        
        return 'improvement';
    }

    /**
     * 估算實作工作量
     */
    private estimateImplementationEffort(api: APIEndpoint, changeType: 'new' | 'updated' | 'deprecated'): number {
        let baseHours = 0;

        switch (api.type) {
            case 'class':
            case 'interface':
                baseHours = 8;
                break;
            case 'function':
                baseHours = 4;
                break;
            case 'enum':
            case 'variable':
                baseHours = 2;
                break;
        }

        // 根據變更類型調整
        switch (changeType) {
            case 'new':
                return baseHours;
            case 'updated':
                return baseHours * 0.5;
            case 'deprecated':
                return baseHours * 0.3;
        }

        return baseHours;
    }

    /**
     * 生成實作指南
     */
    private generateImplementationGuide(api: APIEndpoint, changeType: 'new' | 'updated' | 'deprecated'): string {
        const guides = {
            new: `
## 新增 ${api.name} API

### 實作步驟：
1. 在適當的模組中添加 ${api.name} 的使用
2. 創建包裝函數以簡化 API 調用
3. 添加錯誤處理和類型檢查
4. 編寫單元測試
5. 更新文檔和範例

### 注意事項：
- 確保與現有代碼的兼容性
- 考慮性能影響
- 添加適當的日誌記錄
            `,
            updated: `
## 更新 ${api.name} API

### 實作步驟：
1. 檢查現有使用情況
2. 更新 API 調用以使用新的簽名
3. 測試所有相關功能
4. 更新文檔

### 注意事項：
- 檢查是否有破壞性變更
- 確保向後兼容性
            `,
            deprecated: `
## 處理已棄用的 ${api.name} API

### 實作步驟：
1. 識別所有使用該 API 的地方
2. 找到替代的 API 或實作方式
3. 逐步遷移代碼
4. 移除對已棄用 API 的依賴
5. 測試所有變更

### 注意事項：
- 盡快遷移以避免未來的兼容性問題
- 確保替代方案提供相同的功能
            `
        };

        return guides[changeType];
    }

    /**
     * 生成建議
     */
    private async generateRecommendations(
        crawlResult: CrawlResult,
        coverageAnalysis: APICoverageAnalysis | null,
        usageStats: any
    ): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];

        // 覆蓋率建議
        if (coverageAnalysis && coverageAnalysis.coverage_percentage < 50) {
            recommendations.push({
                type: 'new_api',
                title: '提高 API 覆蓋率',
                description: `當前 API 覆蓋率為 ${coverageAnalysis.coverage_percentage.toFixed(1)}%，建議整合更多有用的 VS Code API`,
                priority: 'medium',
                actionItems: [
                    '分析未使用的高價值 API',
                    '優先整合核心功能相關的 API',
                    '創建 API 使用範例和文檔'
                ],
                estimatedEffort: 16,
                benefits: [
                    '提供更豐富的功能',
                    '更好的用戶體驗',
                    '與 VS Code 更深度整合'
                ]
            });
        }

        // 已棄用 API 建議
        if (usageStats.deprecatedAPIsInUse.length > 0) {
            recommendations.push({
                type: 'deprecated_api',
                title: '遷移已棄用的 API',
                description: `發現 ${usageStats.deprecatedAPIsInUse.length} 個已棄用的 API 仍在使用中`,
                priority: 'high',
                actionItems: [
                    '識別所有已棄用 API 的使用位置',
                    '找到對應的替代 API',
                    '制定遷移計畫',
                    '逐步替換已棄用的 API'
                ],
                estimatedEffort: usageStats.deprecatedAPIsInUse.length * 2,
                benefits: [
                    '避免未來的兼容性問題',
                    '使用更現代的 API',
                    '提高代碼品質'
                ]
            });
        }

        // 新 API 建議
        if (crawlResult.newAPIs.length > 0) {
            recommendations.push({
                type: 'new_api',
                title: '整合新的 VS Code API',
                description: `發現 ${crawlResult.newAPIs.length} 個新的 API 可以整合`,
                priority: 'medium',
                actionItems: [
                    '評估新 API 的價值和適用性',
                    '優先整合高價值的 API',
                    '創建實作計畫',
                    '添加測試和文檔'
                ],
                estimatedEffort: crawlResult.newAPIs.length * 4,
                benefits: [
                    '利用最新的 VS Code 功能',
                    '提供更好的用戶體驗',
                    '保持技術領先性'
                ]
            });
        }

        return recommendations;
    }

    /**
     * 生成實作任務
     */
    private async generateImplementationTasks(
        newAPIs: APIUpdateItem[],
        updatedAPIs: APIUpdateItem[],
        deprecatedAPIs: APIUpdateItem[],
        recommendations: Recommendation[]
    ): Promise<ImplementationTask[]> {
        const tasks: ImplementationTask[] = [];

        // 為高優先級的新 API 創建任務
        const highPriorityNewAPIs = newAPIs.filter(api => api.priority === 'high');
        for (const api of highPriorityNewAPIs) {
            tasks.push({
                id: this.generateTaskId(),
                title: `整合新 API: ${api.namespace}.${api.name}`,
                description: `整合新的 ${api.type} API: ${api.name}`,
                category: 'api_integration',
                priority: api.priority,
                estimatedHours: api.estimatedEffort,
                dependencies: [],
                acceptanceCriteria: [
                    `成功整合 ${api.name} API`,
                    '添加適當的錯誤處理',
                    '編寫單元測試',
                    '更新文檔'
                ],
                implementationSteps: [
                    '研究 API 文檔和範例',
                    '設計整合方案',
                    '實作 API 包裝器',
                    '添加錯誤處理',
                    '編寫測試',
                    '更新文檔'
                ],
                testingRequirements: [
                    '單元測試覆蓋率 > 80%',
                    '整合測試',
                    '錯誤情況測試'
                ]
            });
        }

        // 為已棄用的 API 創建遷移任務
        for (const api of deprecatedAPIs) {
            tasks.push({
                id: this.generateTaskId(),
                title: `遷移已棄用 API: ${api.namespace}.${api.name}`,
                description: `將已棄用的 ${api.name} API 遷移到新的替代方案`,
                category: 'refactoring',
                priority: 'high',
                estimatedHours: api.estimatedEffort,
                dependencies: [],
                acceptanceCriteria: [
                    '完全移除對已棄用 API 的依賴',
                    '功能保持不變',
                    '所有測試通過'
                ],
                implementationSteps: [
                    '識別所有使用位置',
                    '找到替代 API',
                    '制定遷移計畫',
                    '逐步替換',
                    '測試所有變更'
                ],
                testingRequirements: [
                    '回歸測試',
                    '功能測試',
                    '性能測試'
                ]
            });
        }

        return tasks.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * 保存更新計畫到本地文件
     */
    async saveUpdatePlanToFile(updatePlan: UpdatePlan, outputPath?: string): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const defaultPath = workspaceFolder 
            ? path.join(workspaceFolder.uri.fsPath, '.devika', 'update-plan.md')
            : path.join(process.cwd(), 'devika-update-plan.md');
        
        const filePath = outputPath || defaultPath;
        
        // 確保目錄存在
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const content = this.generateMarkdownContent(updatePlan);
        fs.writeFileSync(filePath, content, 'utf8');

        console.log(`更新計畫已保存到: ${filePath}`);
        return filePath;
    }

    /**
     * 生成 Markdown 內容
     */
    private generateMarkdownContent(plan: UpdatePlan): string {
        return `# VS Code 擴充套件 API 更新計畫

**生成時間**: ${plan.generatedAt.toLocaleString()}  
**VS Code 版本**: ${plan.vscodeVersion}  
**當前 API 覆蓋率**: ${plan.currentCoverage.toFixed(1)}%  
**總 API 數量**: ${plan.totalAPIs}  
**已使用 API**: ${plan.usedAPIs}  

## 📊 概覽

- 🆕 **新 API**: ${plan.newAPIs.length} 個
- 🔄 **更新 API**: ${plan.updatedAPIs.length} 個  
- ⚠️ **已棄用 API**: ${plan.deprecatedAPIs.length} 個
- 📋 **實作任務**: ${plan.implementationTasks.length} 個
- ⏱️ **預估總工時**: ${plan.implementationTasks.reduce((sum, task) => sum + task.estimatedHours, 0)} 小時

## 🆕 新增 API (${plan.newAPIs.length})

${plan.newAPIs.map(api => `
### ${api.namespace}.${api.name}
- **類型**: ${api.type}
- **優先級**: ${api.priority}
- **影響**: ${api.impact}
- **預估工時**: ${api.estimatedEffort} 小時
- **描述**: ${api.description}
${api.url ? `- **文檔**: [查看文檔](${api.url})` : ''}

${api.implementationGuide}
`).join('\n')}

## 🔄 更新 API (${plan.updatedAPIs.length})

${plan.updatedAPIs.map(api => `
### ${api.namespace}.${api.name}
- **類型**: ${api.type}
- **優先級**: ${api.priority}
- **影響**: ${api.impact}
- **預估工時**: ${api.estimatedEffort} 小時
- **描述**: ${api.description}

${api.implementationGuide}
`).join('\n')}

## ⚠️ 已棄用 API (${plan.deprecatedAPIs.length})

${plan.deprecatedAPIs.map(api => `
### ${api.namespace}.${api.name}
- **類型**: ${api.type}
- **預估遷移工時**: ${api.estimatedEffort} 小時
- **描述**: ${api.description}

${api.implementationGuide}
`).join('\n')}

## 💡 建議 (${plan.recommendations.length})

${plan.recommendations.map(rec => `
### ${rec.title}
- **類型**: ${rec.type}
- **優先級**: ${rec.priority}
- **預估工時**: ${rec.estimatedEffort} 小時

**描述**: ${rec.description}

**行動項目**:
${rec.actionItems.map(item => `- ${item}`).join('\n')}

**預期效益**:
${rec.benefits.map(benefit => `- ${benefit}`).join('\n')}
`).join('\n')}

## 📋 實作任務 (${plan.implementationTasks.length})

${plan.implementationTasks.map(task => `
### ${task.title}
- **ID**: ${task.id}
- **類別**: ${task.category}
- **優先級**: ${task.priority}
- **預估工時**: ${task.estimatedHours} 小時

**描述**: ${task.description}

**驗收標準**:
${task.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n')}

**實作步驟**:
${task.implementationSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

**測試要求**:
${task.testingRequirements.map(req => `- ${req}`).join('\n')}
`).join('\n')}

---

**📝 注意**: 此計畫由 Devika VS Code 擴充套件自動生成。請根據實際情況調整優先級和工時估算。
`;
    }

    /**
     * 生成任務 ID
     */
    private generateTaskId(): string {
        return 'TASK-' + Date.now().toString(36).toUpperCase();
    }
}
