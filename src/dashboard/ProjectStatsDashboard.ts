import * as vscode from 'vscode';
import { CodeQualityAnalyzer, CodeQualityReport } from '../analysis/CodeQualityAnalyzer';
import { EnhancedMultiProjectAnalyzer, ProjectInfo } from '../analysis/EnhancedMultiProjectAnalyzer';
import { DependencyAnalyzer, DependencyAnalysisResult } from '../analysis/DependencyAnalyzer';

export interface DashboardData {
    overview: ProjectOverview;
    quality: QualityOverview;
    dependencies: DependencyOverview;
    activity: ActivityOverview;
    trends: TrendData[];
    alerts: AlertData[];
    recommendations: RecommendationData[];
}

export interface ProjectOverview {
    totalProjects: number;
    totalFiles: number;
    totalLines: number;
    totalSize: number;
    languages: LanguageStats[];
    lastUpdated: Date;
}

export interface LanguageStats {
    language: string;
    files: number;
    lines: number;
    percentage: number;
    color: string;
}

export interface QualityOverview {
    overallScore: number;
    complexity: number;
    maintainability: number;
    testCoverage: number;
    technicalDebt: number;
    issues: IssueStats;
    trends: QualityTrend[];
}

export interface IssueStats {
    critical: number;
    major: number;
    minor: number;
    total: number;
}

export interface QualityTrend {
    metric: string;
    current: number;
    previous: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
}

export interface DependencyOverview {
    totalDependencies: number;
    outdatedDependencies: number;
    vulnerabilities: number;
    duplicates: number;
    size: number;
    topDependencies: TopDependency[];
}

export interface TopDependency {
    name: string;
    version: string;
    size: number;
    usage: number;
    risk: 'low' | 'medium' | 'high';
}

export interface ActivityOverview {
    commitsToday: number;
    commitsThisWeek: number;
    commitsThisMonth: number;
    activeFiles: number;
    recentActivity: ActivityItem[];
}

export interface ActivityItem {
    type: 'commit' | 'file_change' | 'issue' | 'build';
    description: string;
    timestamp: Date;
    impact: 'low' | 'medium' | 'high';
}

export interface TrendData {
    name: string;
    data: DataPoint[];
    color: string;
    unit: string;
}

export interface DataPoint {
    date: Date;
    value: number;
}

export interface AlertData {
    id: string;
    type: 'error' | 'warning' | 'info';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    actionable: boolean;
    actions?: AlertAction[];
}

export interface AlertAction {
    label: string;
    command: string;
    args?: any[];
}

export interface RecommendationData {
    id: string;
    category: 'performance' | 'security' | 'maintainability' | 'best_practices';
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    priority: number;
    actions: string[];
}

export class ProjectStatsDashboard {
    private panel: vscode.WebviewPanel | undefined;
    private codeQualityAnalyzer: CodeQualityAnalyzer;
    private projectAnalyzer: EnhancedMultiProjectAnalyzer;
    private dependencyAnalyzer: DependencyAnalyzer;
    private updateInterval: NodeJS.Timeout | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.codeQualityAnalyzer = new CodeQualityAnalyzer(context);
        this.projectAnalyzer = new EnhancedMultiProjectAnalyzer(context);
        this.dependencyAnalyzer = new DependencyAnalyzer(context);
    }

    /**
     * 顯示儀表板
     */
    async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'projectStatsDashboard',
            '📊 項目統計儀表板',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = undefined;
            }
        });

        // 設置 webview 內容
        await this.updateDashboard();

        // 設置定期更新
        this.updateInterval = setInterval(() => {
            this.updateDashboard();
        }, 30000); // 每30秒更新一次

        // 處理來自 webview 的消息
        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this.handleWebviewMessage(message);
        });
    }

    /**
     * 更新儀表板數據
     */
    private async updateDashboard(): Promise<void> {
        if (!this.panel) return;

        try {
            const dashboardData = await this.collectDashboardData();
            const html = this.generateDashboardHTML(dashboardData);
            this.panel.webview.html = html;
        } catch (error) {
            console.error('更新儀表板失敗:', error);
            this.showError('更新儀表板數據時發生錯誤');
        }
    }

    /**
     * 收集儀表板數據
     */
    private async collectDashboardData(): Promise<DashboardData> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('沒有打開的工作區');
        }

        const projectPath = workspaceFolder.uri.fsPath;

        // 並行收集數據
        const [projectInfo, qualityReport, dependencyAnalysis] = await Promise.all([
            this.projectAnalyzer.analyzeProject(projectPath),
            this.codeQualityAnalyzer.analyzeCodeQuality(projectPath),
            this.dependencyAnalyzer.analyzeDependencies(projectPath)
        ]);

        // 構建儀表板數據
        const overview = this.buildProjectOverview(projectInfo);
        const quality = this.buildQualityOverview(qualityReport);
        const dependencies = this.buildDependencyOverview(dependencyAnalysis);
        const activity = await this.buildActivityOverview(projectPath);
        const trends = await this.buildTrendData(projectPath);
        const alerts = this.buildAlerts(qualityReport, dependencyAnalysis);
        const recommendations = this.buildRecommendations(qualityReport, dependencyAnalysis);

        return {
            overview,
            quality,
            dependencies,
            activity,
            trends,
            alerts,
            recommendations
        };
    }

    /**
     * 構建項目概覽
     */
    private buildProjectOverview(projectInfo: ProjectInfo | null): ProjectOverview {
        if (!projectInfo) {
            return {
                totalProjects: 0,
                totalFiles: 0,
                totalLines: 0,
                totalSize: 0,
                languages: [],
                lastUpdated: new Date()
            };
        }

        // 模擬語言統計
        const languages: LanguageStats[] = [
            { language: 'TypeScript', files: 45, lines: 12500, percentage: 65, color: '#3178c6' },
            { language: 'JavaScript', files: 23, lines: 5800, percentage: 25, color: '#f7df1e' },
            { language: 'JSON', files: 8, lines: 1200, percentage: 6, color: '#000000' },
            { language: 'Markdown', files: 5, lines: 800, percentage: 4, color: '#083fa1' }
        ];

        return {
            totalProjects: 1 + projectInfo.subProjects.length,
            totalFiles: projectInfo.metadata.fileCount,
            totalLines: projectInfo.metadata.lineCount,
            totalSize: projectInfo.metadata.size,
            languages,
            lastUpdated: projectInfo.metadata.lastModified
        };
    }

    /**
     * 構建品質概覽
     */
    private buildQualityOverview(qualityReport: CodeQualityReport): QualityOverview {
        const issues: IssueStats = {
            critical: qualityReport.issues.filter(i => i.severity === 'critical').length,
            major: qualityReport.issues.filter(i => i.severity === 'major').length,
            minor: qualityReport.issues.filter(i => i.severity === 'minor').length,
            total: qualityReport.issues.length
        };

        const trends: QualityTrend[] = qualityReport.trends.map(trend => ({
            metric: trend.metric,
            current: trend.current,
            previous: trend.previous,
            change: trend.change,
            trend: trend.trend === 'improving' ? 'up' : trend.trend === 'degrading' ? 'down' : 'stable'
        }));

        return {
            overallScore: qualityReport.overallScore,
            complexity: qualityReport.metrics.complexity.cyclomaticComplexity,
            maintainability: qualityReport.metrics.maintainability.maintainabilityIndex,
            testCoverage: qualityReport.metrics.testCoverage.lineCoverage,
            technicalDebt: qualityReport.metrics.maintainability.technicalDebt,
            issues,
            trends
        };
    }

    /**
     * 構建依賴概覽
     */
    private buildDependencyOverview(dependencyAnalysis: DependencyAnalysisResult): DependencyOverview {
        const topDependencies: TopDependency[] = Array.from(dependencyAnalysis.graph.nodes.values())
            .slice(0, 10)
            .map(node => ({
                name: node.name,
                version: node.version,
                size: node.size || 0,
                usage: node.dependents.length,
                risk: node.vulnerabilities.length > 0 ? 'high' : node.outdated ? 'medium' : 'low'
            }));

        return {
            totalDependencies: dependencyAnalysis.statistics.totalDependencies,
            outdatedDependencies: dependencyAnalysis.statistics.totalDependencies, // 簡化
            vulnerabilities: dependencyAnalysis.securityReport.totalVulnerabilities,
            duplicates: dependencyAnalysis.statistics.duplicatedDependencies,
            size: dependencyAnalysis.statistics.totalSize,
            topDependencies
        };
    }

    /**
     * 構建活動概覽
     */
    private async buildActivityOverview(projectPath: string): Promise<ActivityOverview> {
        // 模擬活動數據
        const recentActivity: ActivityItem[] = [
            {
                type: 'commit',
                description: '修復依賴安全漏洞',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
                impact: 'high'
            },
            {
                type: 'file_change',
                description: '更新 README.md',
                timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
                impact: 'low'
            },
            {
                type: 'build',
                description: '構建成功',
                timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
                impact: 'medium'
            }
        ];

        return {
            commitsToday: 3,
            commitsThisWeek: 15,
            commitsThisMonth: 67,
            activeFiles: 12,
            recentActivity
        };
    }

    /**
     * 構建趨勢數據
     */
    private async buildTrendData(projectPath: string): Promise<TrendData[]> {
        // 模擬趨勢數據
        const dates = Array.from({ length: 30 }, (_, i) =>
            new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
        );

        return [
            {
                name: '代碼品質',
                data: dates.map(date => ({
                    date,
                    value: 75 + Math.random() * 20
                })),
                color: '#4CAF50',
                unit: '分'
            },
            {
                name: '測試覆蓋率',
                data: dates.map(date => ({
                    date,
                    value: 60 + Math.random() * 30
                })),
                color: '#2196F3',
                unit: '%'
            },
            {
                name: '技術債',
                data: dates.map(date => ({
                    date,
                    value: 2 + Math.random() * 3
                })),
                color: '#FF9800',
                unit: '天'
            }
        ];
    }

    /**
     * 構建警告
     */
    private buildAlerts(qualityReport: CodeQualityReport, dependencyAnalysis: DependencyAnalysisResult): AlertData[] {
        const alerts: AlertData[] = [];

        // 品質警告
        if (qualityReport.overallScore < 60) {
            alerts.push({
                id: 'low-quality',
                type: 'warning',
                title: '代碼品質偏低',
                description: `項目整體品質分數為 ${qualityReport.overallScore}，建議進行改善`,
                severity: 'high',
                timestamp: new Date(),
                actionable: true,
                actions: [
                    { label: '查看詳細報告', command: 'devika.showQualityReport' },
                    { label: '開始重構', command: 'devika.startRefactoring' }
                ]
            });
        }

        // 安全警告
        if (dependencyAnalysis.securityReport.totalVulnerabilities > 0) {
            alerts.push({
                id: 'security-vulnerabilities',
                type: 'error',
                title: '發現安全漏洞',
                description: `發現 ${dependencyAnalysis.securityReport.totalVulnerabilities} 個安全漏洞`,
                severity: 'critical',
                timestamp: new Date(),
                actionable: true,
                actions: [
                    { label: '查看漏洞詳情', command: 'devika.showVulnerabilities' },
                    { label: '自動修復', command: 'devika.fixVulnerabilities' }
                ]
            });
        }

        return alerts;
    }

    /**
     * 構建建議
     */
    private buildRecommendations(qualityReport: CodeQualityReport, dependencyAnalysis: DependencyAnalysisResult): RecommendationData[] {
        return qualityReport.recommendations.map((rec, index) => ({
            id: `rec-${index}`,
            category: this.mapRecommendationCategory(rec.category),
            title: rec.title || '改善建議',
            description: rec.description,
            impact: rec.impact,
            effort: rec.effort,
            priority: rec.priority === 'high' ? 3 : rec.priority === 'medium' ? 2 : 1,
            actions: rec.actions || []
        }));
    }

    /**
     * 映射建議類別
     */
    private mapRecommendationCategory(category: string): RecommendationData['category'] {
        switch (category) {
            case 'security': return 'security';
            case 'performance': return 'performance';
            case 'maintainability': return 'maintainability';
            default: return 'best_practices';
        }
    }

    /**
     * 處理 webview 消息
     */
    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'refresh':
                await this.updateDashboard();
                break;
            case 'executeAction':
                await vscode.commands.executeCommand(message.action, ...(message.args || []));
                break;
            case 'exportData':
                await this.exportDashboardData();
                break;
        }
    }

    /**
     * 顯示錯誤
     */
    private showError(message: string): void {
        if (this.panel) {
            this.panel.webview.html = `
                <html>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>❌ 錯誤</h2>
                    <p>${message}</p>
                    <button onclick="location.reload()">重試</button>
                </body>
                </html>
            `;
        }
    }

    /**
     * 導出儀表板數據
     */
    private async exportDashboardData(): Promise<void> {
        try {
            const data = await this.collectDashboardData();
            const json = JSON.stringify(data, null, 2);

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('dashboard-data.json'),
                filters: { 'JSON': ['json'] }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
                vscode.window.showInformationMessage('儀表板數據已導出');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`導出失敗: ${error}`);
        }
    }

    /**
     * 生成儀表板 HTML
     */
    private generateDashboardHTML(data: DashboardData): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>項目統計儀表板</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .dashboard {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .card {
                    background: var(--vscode-editor-selectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .card h3 {
                    margin: 0 0 15px 0;
                    color: var(--vscode-editor-foreground);
                    font-size: 18px;
                }
                .metric {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 10px 0;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .metric:last-child {
                    border-bottom: none;
                }
                .metric-value {
                    font-weight: bold;
                    font-size: 16px;
                }
                .score {
                    font-size: 24px;
                    font-weight: bold;
                    text-align: center;
                    margin: 10px 0;
                }
                .score.excellent { color: #4CAF50; }
                .score.good { color: #8BC34A; }
                .score.fair { color: #FF9800; }
                .score.poor { color: #F44336; }
                .alert {
                    padding: 10px;
                    margin: 5px 0;
                    border-radius: 4px;
                    border-left: 4px solid;
                }
                .alert.error {
                    background: rgba(244, 67, 54, 0.1);
                    border-color: #F44336;
                }
                .alert.warning {
                    background: rgba(255, 152, 0, 0.1);
                    border-color: #FF9800;
                }
                .alert.info {
                    background: rgba(33, 150, 243, 0.1);
                    border-color: #2196F3;
                }
                .language-bar {
                    height: 20px;
                    border-radius: 10px;
                    overflow: hidden;
                    display: flex;
                    margin: 10px 0;
                }
                .language-segment {
                    height: 100%;
                    transition: all 0.3s ease;
                }
                .refresh-btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 10px 0;
                }
                .refresh-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="dashboard">
                <!-- 項目概覽 -->
                <div class="card">
                    <h3>📊 項目概覽</h3>
                    <div class="metric">
                        <span>總項目數</span>
                        <span class="metric-value">${data.overview.totalProjects}</span>
                    </div>
                    <div class="metric">
                        <span>總文件數</span>
                        <span class="metric-value">${data.overview.totalFiles.toLocaleString()}</span>
                    </div>
                    <div class="metric">
                        <span>總代碼行數</span>
                        <span class="metric-value">${data.overview.totalLines.toLocaleString()}</span>
                    </div>
                    <div class="metric">
                        <span>項目大小</span>
                        <span class="metric-value">${this.formatBytes(data.overview.totalSize)}</span>
                    </div>
                    <div class="language-bar">
                        ${data.overview.languages.map(lang =>
                            `<div class="language-segment" style="width: ${lang.percentage}%; background-color: ${lang.color};" title="${lang.language}: ${lang.percentage}%"></div>`
                        ).join('')}
                    </div>
                </div>

                <!-- 代碼品質 -->
                <div class="card">
                    <h3>🎯 代碼品質</h3>
                    <div class="score ${this.getScoreClass(data.quality.overallScore)}">${data.quality.overallScore}/100</div>
                    <div class="metric">
                        <span>複雜度</span>
                        <span class="metric-value">${data.quality.complexity}</span>
                    </div>
                    <div class="metric">
                        <span>可維護性</span>
                        <span class="metric-value">${data.quality.maintainability}%</span>
                    </div>
                    <div class="metric">
                        <span>測試覆蓋率</span>
                        <span class="metric-value">${data.quality.testCoverage.toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span>技術債</span>
                        <span class="metric-value">${data.quality.technicalDebt} 天</span>
                    </div>
                </div>

                <!-- 依賴管理 -->
                <div class="card">
                    <h3>📦 依賴管理</h3>
                    <div class="metric">
                        <span>總依賴數</span>
                        <span class="metric-value">${data.dependencies.totalDependencies}</span>
                    </div>
                    <div class="metric">
                        <span>過時依賴</span>
                        <span class="metric-value">${data.dependencies.outdatedDependencies}</span>
                    </div>
                    <div class="metric">
                        <span>安全漏洞</span>
                        <span class="metric-value">${data.dependencies.vulnerabilities}</span>
                    </div>
                    <div class="metric">
                        <span>重複依賴</span>
                        <span class="metric-value">${data.dependencies.duplicates}</span>
                    </div>
                </div>

                <!-- 活動統計 -->
                <div class="card">
                    <h3>📈 活動統計</h3>
                    <div class="metric">
                        <span>今日提交</span>
                        <span class="metric-value">${data.activity.commitsToday}</span>
                    </div>
                    <div class="metric">
                        <span>本週提交</span>
                        <span class="metric-value">${data.activity.commitsThisWeek}</span>
                    </div>
                    <div class="metric">
                        <span>本月提交</span>
                        <span class="metric-value">${data.activity.commitsThisMonth}</span>
                    </div>
                    <div class="metric">
                        <span>活躍文件</span>
                        <span class="metric-value">${data.activity.activeFiles}</span>
                    </div>
                </div>

                <!-- 警告和建議 -->
                <div class="card">
                    <h3>⚠️ 警告</h3>
                    ${data.alerts.map(alert => `
                        <div class="alert ${alert.type}">
                            <strong>${alert.title}</strong><br>
                            ${alert.description}
                            ${alert.actionable ? '<br><button class="refresh-btn" onclick="handleAction(\'' + alert.actions?.[0]?.command + '\')">處理</button>' : ''}
                        </div>
                    `).join('')}
                </div>

                <!-- 建議 -->
                <div class="card">
                    <h3>💡 改善建議</h3>
                    ${data.recommendations.slice(0, 5).map(rec => `
                        <div class="metric">
                            <div>
                                <strong>${rec.title}</strong><br>
                                <small>${rec.description}</small>
                            </div>
                            <span class="metric-value">優先級 ${rec.priority}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <button class="refresh-btn" onclick="refresh()">🔄 刷新數據</button>

            <script>
                const vscode = acquireVsCodeApi();

                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                }

                function handleAction(command) {
                    vscode.postMessage({ command: 'executeAction', action: command });
                }

                // 自動刷新
                setInterval(refresh, 60000); // 每分鐘刷新
            </script>
        </body>
        </html>
        `;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private getScoreClass(score: number): string {
        if (score >= 90) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 60) return 'fair';
        return 'poor';
    }

    /**
     * 清理資源
     */
    dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.panel?.dispose();
    }
}