import * as vscode from 'vscode';
import { DatabaseManager } from '../storage/DatabaseManager';

export interface APICoverageReport {
    totalAPIs: number;
    implementedAPIsCount: number;
    coveragePercentage: number;
    categories: CategoryCoverage[];
    missingAPIs: MissingAPI[];
    implementedAPIs: ImplementedAPI[];
    recommendations: APIRecommendation[];
    trends: CoverageTrend[];
    timestamp: Date;
}

export interface CategoryCoverage {
    category: string;
    totalAPIs: number;
    implementedAPIs: number;
    coveragePercentage: number;
    priority: 'high' | 'medium' | 'low';
    description: string;
}

export interface MissingAPI {
    name: string;
    category: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedEffort: string;
    dependencies: string[];
    examples: string[];
    documentation: string;
    since: string;
    deprecated?: boolean;
}

export interface ImplementedAPI {
    name: string;
    category: string;
    implementationFile: string;
    implementationLine: number;
    usage: APIUsage[];
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    lastUpdated: Date;
    notes?: string;
}

export interface APIUsage {
    file: string;
    line: number;
    context: string;
    frequency: number;
}

export interface APIRecommendation {
    type: 'implement' | 'improve' | 'deprecate' | 'optimize';
    api: string;
    reason: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    priority: number;
    steps: string[];
}

export interface CoverageTrend {
    date: Date;
    totalAPIs: number;
    implementedAPIs: number;
    coveragePercentage: number;
    newImplementations: string[];
    removedImplementations: string[];
}

export interface APIAnalysisOptions {
    includeDeprecated: boolean;
    includeExperimental: boolean;
    minVersion?: string;
    maxVersion?: string;
    categories?: string[];
    priorityFilter?: ('critical' | 'high' | 'medium' | 'low')[];
}

export class APICoverageAnalyzer {
    private coverageHistory: CoverageTrend[] = [];
    private lastAnalysis: APICoverageReport | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private databaseManager: DatabaseManager
    ) {
        this.loadCoverageHistory();
    }

    /**
     * 分析 API 覆蓋率
     */
    async analyzeAPICoverage(options: APIAnalysisOptions = {
        includeDeprecated: false,
        includeExperimental: true
    }): Promise<APICoverageReport> {
        try {
            // 獲取所有 VS Code API
            const allAPIs = await this.getAllVSCodeAPIs(options);

            // 掃描項目中的 API 使用
            const implementedAPIs = await this.scanImplementedAPIs();

            // 分析覆蓋率
            const coverage = this.calculateCoverage(allAPIs, implementedAPIs);

            // 生成建議
            const recommendations = this.generateRecommendations(allAPIs, implementedAPIs);

            // 分析趨勢
            const trends = this.analyzeTrends();

            const report: APICoverageReport = {
                totalAPIs: allAPIs.length,
                implementedAPIsCount: implementedAPIs.length,
                implementedAPIs: implementedAPIs,
                coveragePercentage: Math.round((implementedAPIs.length / allAPIs.length) * 100),
                categories: coverage.categories,
                missingAPIs: coverage.missing,
                recommendations,
                trends,
                timestamp: new Date()
            };

            this.lastAnalysis = report;
            await this.saveCoverageTrend(report);

            return report;
        } catch (error) {
            throw new Error(`API 覆蓋率分析失敗: ${error}`);
        }
    }

    /**
     * 獲取所有 VS Code API
     */
    private async getAllVSCodeAPIs(options: APIAnalysisOptions): Promise<VSCodeAPI[]> {
        const apis: VSCodeAPI[] = [];

        try {
            // 從數據庫獲取 API 信息
            const apiData = await this.databaseManager.query(`
                SELECT * FROM vscode_apis
                WHERE 1=1
                ${!options.includeDeprecated ? 'AND deprecated = 0' : ''}
                ${!options.includeExperimental ? 'AND experimental = 0' : ''}
                ${options.minVersion ? `AND version >= '${options.minVersion}'` : ''}
                ${options.maxVersion ? `AND version <= '${options.maxVersion}'` : ''}
                ${options.categories ? `AND category IN (${options.categories.map(c => `'${c}'`).join(',')})` : ''}
            `);

            for (const row of apiData) {
                apis.push({
                    name: row.name,
                    category: row.category,
                    description: row.description,
                    since: row.version,
                    deprecated: row.deprecated === 1,
                    experimental: row.experimental === 1,
                    complexity: this.assessComplexity(row),
                    priority: this.assessPriority(row),
                    dependencies: JSON.parse(row.dependencies || '[]'),
                    examples: JSON.parse(row.examples || '[]'),
                    documentation: row.documentation_url
                });
            }
        } catch (error) {
            console.error('獲取 VS Code API 失敗:', error);
            // 回退到硬編碼的 API 列表
            apis.push(...this.getHardcodedAPIs());
        }

        return apis;
    }

    /**
     * 掃描已實作的 API
     */
    private async scanImplementedAPIs(): Promise<ImplementedAPI[]> {
        const implementedAPIs: ImplementedAPI[] = [];

        try {
            // 掃描工作區中的 TypeScript/JavaScript 文件
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js}',
                '**/node_modules/**'
            );

            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();

                // 查找 vscode API 使用
                const apiUsages = this.findAPIUsages(content, file.fsPath);
                implementedAPIs.push(...apiUsages);
            }
        } catch (error) {
            console.error('掃描實作的 API 失敗:', error);
        }

        return this.deduplicateImplementedAPIs(implementedAPIs);
    }

    /**
     * 查找 API 使用
     */
    private findAPIUsages(content: string, filePath: string): ImplementedAPI[] {
        const apis: ImplementedAPI[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 查找 vscode.* API 調用
            const vscodeMatches = line.match(/vscode\.(\w+(?:\.\w+)*)/g);
            if (vscodeMatches) {
                for (const match of vscodeMatches) {
                    const apiName = match.replace('vscode.', '');

                    apis.push({
                        name: apiName,
                        category: this.categorizeAPI(apiName),
                        implementationFile: filePath,
                        implementationLine: i + 1,
                        usage: [{
                            file: filePath,
                            line: i + 1,
                            context: line.trim(),
                            frequency: 1
                        }],
                        quality: this.assessImplementationQuality(line, apiName),
                        lastUpdated: new Date()
                    });
                }
            }
        }

        return apis;
    }

    /**
     * 計算覆蓋率
     */
    private calculateCoverage(allAPIs: VSCodeAPI[], implementedAPIs: ImplementedAPI[]): {
        categories: CategoryCoverage[];
        missing: MissingAPI[];
    } {
        const categories = new Map<string, CategoryCoverage>();
        const implementedNames = new Set(implementedAPIs.map(api => api.name));
        const missing: MissingAPI[] = [];

        // 初始化類別
        for (const api of allAPIs) {
            if (!categories.has(api.category)) {
                categories.set(api.category, {
                    category: api.category,
                    totalAPIs: 0,
                    implementedAPIs: 0,
                    coveragePercentage: 0,
                    priority: this.getCategoryPriority(api.category),
                    description: this.getCategoryDescription(api.category)
                });
            }
        }

        // 計算每個類別的覆蓋率
        for (const api of allAPIs) {
            const category = categories.get(api.category)!;
            category.totalAPIs++;

            if (implementedNames.has(api.name)) {
                category.implementedAPIs++;
            } else {
                missing.push({
                    name: api.name,
                    category: api.category,
                    description: api.description,
                    priority: api.priority,
                    complexity: api.complexity,
                    estimatedEffort: this.estimateImplementationEffort(api),
                    dependencies: api.dependencies,
                    examples: api.examples,
                    documentation: api.documentation,
                    since: api.since,
                    deprecated: api.deprecated
                });
            }
        }

        // 計算百分比
        for (const category of categories.values()) {
            category.coveragePercentage = category.totalAPIs > 0
                ? Math.round((category.implementedAPIs / category.totalAPIs) * 100)
                : 0;
        }

        return {
            categories: Array.from(categories.values()).sort((a, b) => b.coveragePercentage - a.coveragePercentage),
            missing: missing.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority))
        };
    }

    /**
     * 生成建議
     */
    private generateRecommendations(allAPIs: VSCodeAPI[], implementedAPIs: ImplementedAPI[]): APIRecommendation[] {
        const recommendations: APIRecommendation[] = [];
        const implementedNames = new Set(implementedAPIs.map(api => api.name));

        // 建議實作高優先級的缺失 API
        const missingHighPriority = allAPIs.filter(api =>
            !implementedNames.has(api.name) &&
            (api.priority === 'critical' || api.priority === 'high')
        );

        for (const api of missingHighPriority.slice(0, 10)) {
            recommendations.push({
                type: 'implement',
                api: api.name,
                reason: `高優先級 API，可以顯著提升功能`,
                impact: api.priority === 'critical' ? 'high' : 'medium',
                effort: this.mapComplexityToEffort(api.complexity),
                priority: this.getPriorityWeight(api.priority),
                steps: this.generateImplementationSteps(api)
            });
        }

        // 建議改進現有實作
        const poorQualityAPIs = implementedAPIs.filter(api => api.quality === 'poor' || api.quality === 'fair');
        for (const api of poorQualityAPIs.slice(0, 5)) {
            recommendations.push({
                type: 'improve',
                api: api.name,
                reason: `實作品質可以改善`,
                impact: 'medium',
                effort: 'low',
                priority: 3,
                steps: [
                    '檢查錯誤處理',
                    '添加類型註解',
                    '改善代碼結構',
                    '添加註釋說明'
                ]
            });
        }

        return recommendations.sort((a, b) => b.priority - a.priority);
    }

    // 輔助方法
    private assessComplexity(apiData: any): 'simple' | 'moderate' | 'complex' {
        const paramCount = (apiData.parameters || '').split(',').length;
        if (paramCount <= 2) return 'simple';
        if (paramCount <= 5) return 'moderate';
        return 'complex';
    }

    private assessPriority(apiData: any): 'critical' | 'high' | 'medium' | 'low' {
        const category = apiData.category.toLowerCase();
        if (['commands', 'window', 'workspace'].includes(category)) return 'high';
        if (['languages', 'debug', 'tasks'].includes(category)) return 'medium';
        return 'low';
    }

    private categorizeAPI(apiName: string): string {
        if (apiName.startsWith('window.')) return 'window';
        if (apiName.startsWith('workspace.')) return 'workspace';
        if (apiName.startsWith('commands.')) return 'commands';
        if (apiName.startsWith('languages.')) return 'languages';
        if (apiName.startsWith('debug.')) return 'debug';
        if (apiName.startsWith('tasks.')) return 'tasks';
        return 'other';
    }

    private assessImplementationQuality(line: string, apiName: string): 'excellent' | 'good' | 'fair' | 'poor' {
        // 簡化的品質評估
        if (line.includes('try') || line.includes('catch')) return 'excellent';
        if (line.includes('await') || line.includes('Promise')) return 'good';
        if (line.includes('//') || line.includes('/*')) return 'fair';
        return 'poor';
    }

    private deduplicateImplementedAPIs(apis: ImplementedAPI[]): ImplementedAPI[] {
        const uniqueAPIs = new Map<string, ImplementedAPI>();

        for (const api of apis) {
            const existing = uniqueAPIs.get(api.name);
            if (existing) {
                existing.usage.push(...api.usage);
            } else {
                uniqueAPIs.set(api.name, api);
            }
        }

        return Array.from(uniqueAPIs.values());
    }

    private getCategoryPriority(category: string): 'high' | 'medium' | 'low' {
        const highPriority = ['commands', 'window', 'workspace'];
        const mediumPriority = ['languages', 'debug', 'tasks'];

        if (highPriority.includes(category)) return 'high';
        if (mediumPriority.includes(category)) return 'medium';
        return 'low';
    }

    private getCategoryDescription(category: string): string {
        const descriptions: { [key: string]: string } = {
            'commands': '命令系統 API',
            'window': '視窗管理 API',
            'workspace': '工作區 API',
            'languages': '語言服務 API',
            'debug': '調試 API',
            'tasks': '任務 API',
            'extensions': '擴展 API'
        };
        return descriptions[category] || '其他 API';
    }

    private estimateImplementationEffort(api: VSCodeAPI): string {
        switch (api.complexity) {
            case 'simple': return '1-2 小時';
            case 'moderate': return '4-8 小時';
            case 'complex': return '1-3 天';
            default: return '未知';
        }
    }

    private getPriorityWeight(priority: string): number {
        const weights = { critical: 4, high: 3, medium: 2, low: 1 };
        return weights[priority as keyof typeof weights] || 0;
    }

    private mapComplexityToEffort(complexity: string): 'low' | 'medium' | 'high' {
        switch (complexity) {
            case 'simple': return 'low';
            case 'moderate': return 'medium';
            case 'complex': return 'high';
            default: return 'medium';
        }
    }

    private generateImplementationSteps(api: VSCodeAPI): string[] {
        return [
            `研究 ${api.name} API 文檔`,
            '設計實作方案',
            '編寫核心邏輯',
            '添加錯誤處理',
            '編寫測試',
            '更新文檔'
        ];
    }

    private analyzeTrends(): CoverageTrend[] {
        return this.coverageHistory.slice(-12); // 最近12次分析
    }

    private async saveCoverageTrend(report: APICoverageReport): Promise<void> {
        const trend: CoverageTrend = {
            date: new Date(),
            totalAPIs: report.totalAPIs,
            implementedAPIs: report.implementedAPIsCount,
            coveragePercentage: report.coveragePercentage,
            newImplementations: [], // 需要與上次比較
            removedImplementations: []
        };

        this.coverageHistory.push(trend);

        // 保持最近50次記錄
        if (this.coverageHistory.length > 50) {
            this.coverageHistory = this.coverageHistory.slice(-50);
        }

        await this.saveCoverageHistory();
    }

    private getHardcodedAPIs(): VSCodeAPI[] {
        return [
            {
                name: 'window.showInformationMessage',
                category: 'window',
                description: '顯示信息消息',
                since: '1.0.0',
                deprecated: false,
                experimental: false,
                complexity: 'simple',
                priority: 'high',
                dependencies: [],
                examples: ['vscode.window.showInformationMessage("Hello World!")'],
                documentation: 'https://code.visualstudio.com/api/references/vscode-api#window'
            },
            {
                name: 'commands.registerCommand',
                category: 'commands',
                description: '註冊命令',
                since: '1.0.0',
                deprecated: false,
                experimental: false,
                complexity: 'moderate',
                priority: 'critical',
                dependencies: [],
                examples: ['vscode.commands.registerCommand("extension.hello", () => {})'],
                documentation: 'https://code.visualstudio.com/api/references/vscode-api#commands'
            }
        ];
    }

    private loadCoverageHistory(): void {
        const history = this.context.globalState.get<any[]>('apiCoverageHistory', []);
        this.coverageHistory = history.map(item => ({
            ...item,
            date: new Date(item.date)
        }));
    }

    private async saveCoverageHistory(): Promise<void> {
        await this.context.globalState.update('apiCoverageHistory', this.coverageHistory);
    }

    /**
     * 獲取最新分析結果
     */
    getLastAnalysis(): APICoverageReport | undefined {
        return this.lastAnalysis;
    }

    /**
     * 導出覆蓋率報告
     */
    async exportCoverageReport(format: 'json' | 'csv' | 'html' = 'json'): Promise<string> {
        if (!this.lastAnalysis) {
            throw new Error('沒有可用的分析結果');
        }

        switch (format) {
            case 'json':
                return JSON.stringify(this.lastAnalysis, null, 2);
            case 'csv':
                return this.generateCSVReport(this.lastAnalysis);
            case 'html':
                return this.generateHTMLReport(this.lastAnalysis);
            default:
                throw new Error(`不支援的格式: ${format}`);
        }
    }

    private generateCSVReport(report: APICoverageReport): string {
        const headers = ['API名稱', '類別', '狀態', '優先級', '複雜度'];
        const rows = [headers.join(',')];

        for (const api of report.missingAPIs) {
            rows.push([
                api.name,
                api.category,
                '未實作',
                api.priority,
                api.complexity
            ].join(','));
        }

        for (const api of report.implementedAPIs) {
            rows.push([
                api.name,
                api.category,
                '已實作',
                '-',
                '-'
            ].join(','));
        }

        return rows.join('\n');
    }

    private generateHTMLReport(report: APICoverageReport): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>API 覆蓋率報告</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                .category { margin: 10px 0; }
                .progress { background: #ddd; border-radius: 10px; overflow: hidden; }
                .progress-bar { height: 20px; background: #4CAF50; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>API 覆蓋率報告</h1>
            <div class="summary">
                <h2>總覽</h2>
                <p>總 API 數: ${report.totalAPIs}</p>
                <p>已實作: ${report.implementedAPIsCount}</p>
                <p>覆蓋率: ${report.coveragePercentage}%</p>
                <div class="progress">
                    <div class="progress-bar" style="width: ${report.coveragePercentage}%"></div>
                </div>
            </div>

            <h2>類別覆蓋率</h2>
            ${report.categories.map(cat => `
                <div class="category">
                    <strong>${cat.category}</strong>: ${cat.coveragePercentage}%
                    <div class="progress">
                        <div class="progress-bar" style="width: ${cat.coveragePercentage}%"></div>
                    </div>
                </div>
            `).join('')}

            <h2>缺失的 API</h2>
            <table>
                <tr><th>API 名稱</th><th>類別</th><th>優先級</th><th>複雜度</th></tr>
                ${report.missingAPIs.slice(0, 20).map(api => `
                    <tr>
                        <td>${api.name}</td>
                        <td>${api.category}</td>
                        <td>${api.priority}</td>
                        <td>${api.complexity}</td>
                    </tr>
                `).join('')}
            </table>
        </body>
        </html>
        `;
    }

    /**
     * 清理資源
     */
    dispose(): void {
        // 清理資源
    }
}

interface VSCodeAPI {
    name: string;
    category: string;
    description: string;
    since: string;
    deprecated: boolean;
    experimental: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
    priority: 'critical' | 'high' | 'medium' | 'low';
    dependencies: string[];
    examples: string[];
    documentation: string;
}
