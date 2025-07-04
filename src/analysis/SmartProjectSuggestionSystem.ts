import * as vscode from 'vscode';
import { CodeQualityReport } from './CodeQualityAnalyzer';
import { ProjectInfo } from './EnhancedMultiProjectAnalyzer';
import { DependencyAnalysisResult } from './DependencyAnalyzer';

export interface ProjectSuggestion {
    id: string;
    category: SuggestionCategory;
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    reasoning: string;
    impact: ImpactAssessment;
    implementation: ImplementationGuide;
    resources: Resource[];
    estimatedEffort: EffortEstimate;
    dependencies: string[];
    tags: string[];
    confidence: number;
    timestamp: Date;
}

export enum SuggestionCategory {
    Architecture = 'architecture',
    Performance = 'performance',
    Security = 'security',
    Maintainability = 'maintainability',
    Testing = 'testing',
    Documentation = 'documentation',
    Dependencies = 'dependencies',
    BestPractices = 'best_practices',
    Tooling = 'tooling',
    Workflow = 'workflow'
}

export interface ImpactAssessment {
    developmentSpeed: number; // -5 to +5
    codeQuality: number;
    maintainability: number;
    performance: number;
    security: number;
    teamProductivity: number;
    userExperience: number;
    overallScore: number;
}

export interface ImplementationGuide {
    steps: ImplementationStep[];
    prerequisites: string[];
    estimatedTime: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    risks: Risk[];
    alternatives: Alternative[];
}

export interface ImplementationStep {
    order: number;
    title: string;
    description: string;
    commands?: string[];
    files?: string[];
    codeExamples?: CodeExample[];
    verification: string;
}

export interface CodeExample {
    language: string;
    before?: string;
    after: string;
    explanation: string;
}

export interface Risk {
    description: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
}

export interface Alternative {
    title: string;
    description: string;
    pros: string[];
    cons: string[];
    effort: EffortEstimate;
}

export interface Resource {
    type: 'documentation' | 'tutorial' | 'tool' | 'library' | 'article' | 'video';
    title: string;
    url: string;
    description: string;
    relevance: number; // 0-1
}

export interface EffortEstimate {
    hours: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    skillLevel: 'junior' | 'mid' | 'senior' | 'expert';
    teamSize: number;
}

export interface SuggestionFilter {
    categories?: SuggestionCategory[];
    priorities?: string[];
    minConfidence?: number;
    maxEffort?: number;
    tags?: string[];
}

export interface SuggestionReport {
    projectPath: string;
    timestamp: Date;
    summary: SuggestionSummary;
    suggestions: ProjectSuggestion[];
    roadmap: DevelopmentRoadmap;
    metrics: SuggestionMetrics;
}

export interface SuggestionSummary {
    totalSuggestions: number;
    criticalIssues: number;
    quickWins: number;
    longTermGoals: number;
    estimatedImpact: number;
    recommendedPriority: string[];
}

export interface DevelopmentRoadmap {
    phases: RoadmapPhase[];
    timeline: string;
    milestones: Milestone[];
}

export interface RoadmapPhase {
    name: string;
    duration: string;
    suggestions: string[];
    goals: string[];
    deliverables: string[];
}

export interface Milestone {
    name: string;
    date: string;
    criteria: string[];
    dependencies: string[];
}

export interface SuggestionMetrics {
    categoryDistribution: { [key in SuggestionCategory]: number };
    priorityDistribution: { [key: string]: number };
    averageConfidence: number;
    totalEstimatedHours: number;
    potentialImpact: number;
}

export class SmartProjectSuggestionSystem {
    private suggestionHistory: SuggestionReport[] = [];
    private customRules: SuggestionRule[] = [];
    private bestPracticesDatabase: BestPractice[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.initializeBestPractices();
        this.loadSuggestionHistory();
    }

    /**
     * 生成項目建議
     */
    async generateSuggestions(
        projectInfo: ProjectInfo,
        qualityReport: CodeQualityReport,
        dependencyAnalysis: DependencyAnalysisResult,
        filter?: SuggestionFilter
    ): Promise<SuggestionReport> {
        const suggestions: ProjectSuggestion[] = [];

        // 分析各個方面並生成建議
        suggestions.push(...await this.analyzeArchitecture(projectInfo));
        suggestions.push(...await this.analyzeCodeQuality(qualityReport));
        suggestions.push(...await this.analyzeDependencies(dependencyAnalysis));
        suggestions.push(...await this.analyzePerformance(qualityReport));
        suggestions.push(...await this.analyzeSecurity(qualityReport, dependencyAnalysis));
        suggestions.push(...await this.analyzeTesting(qualityReport));
        suggestions.push(...await this.analyzeDocumentation(projectInfo));
        suggestions.push(...await this.analyzeBestPractices(projectInfo, qualityReport));

        // 應用過濾器
        const filteredSuggestions = this.applyFilter(suggestions, filter);

        // 排序和優先級
        const prioritizedSuggestions = this.prioritizeSuggestions(filteredSuggestions);

        // 生成摘要和路線圖
        const summary = this.generateSummary(prioritizedSuggestions);
        const roadmap = this.generateRoadmap(prioritizedSuggestions);
        const metrics = this.calculateMetrics(prioritizedSuggestions);

        const report: SuggestionReport = {
            projectPath: projectInfo.rootPath,
            timestamp: new Date(),
            summary,
            suggestions: prioritizedSuggestions,
            roadmap,
            metrics
        };

        // 保存到歷史
        this.addToHistory(report);

        return report;
    }

    /**
     * 分析架構
     */
    private async analyzeArchitecture(projectInfo: ProjectInfo): Promise<ProjectSuggestion[]> {
        const suggestions: ProjectSuggestion[] = [];

        // 檢查項目結構
        if (!projectInfo.configFiles.includes('tsconfig.json') && projectInfo.type === 'nodejs') {
            suggestions.push({
                id: 'add-typescript',
                category: SuggestionCategory.Architecture,
                priority: 'medium',
                title: '遷移到 TypeScript',
                description: '將項目遷移到 TypeScript 以提高代碼品質和開發體驗',
                reasoning: '檢測到 Node.js 項目但未使用 TypeScript，TypeScript 可以提供更好的類型安全和開發工具支援',
                impact: {
                    developmentSpeed: 2,
                    codeQuality: 4,
                    maintainability: 3,
                    performance: 0,
                    security: 1,
                    teamProductivity: 3,
                    userExperience: 0,
                    overallScore: 2.5
                },
                implementation: {
                    steps: [
                        {
                            order: 1,
                            title: '安裝 TypeScript',
                            description: '安裝 TypeScript 編譯器和相關依賴',
                            commands: ['npm install -D typescript @types/node'],
                            verification: '檢查 package.json 中是否包含 TypeScript 依賴'
                        },
                        {
                            order: 2,
                            title: '配置 tsconfig.json',
                            description: '創建 TypeScript 配置文件',
                            files: ['tsconfig.json'],
                            verification: '確認 tsconfig.json 文件存在且配置正確'
                        }
                    ],
                    prerequisites: ['Node.js 項目', '基本的 TypeScript 知識'],
                    estimatedTime: '2-4 天',
                    difficulty: 'intermediate',
                    risks: [
                        {
                            description: '現有代碼可能需要大量修改',
                            probability: 'medium',
                            impact: 'medium',
                            mitigation: '逐步遷移，從新文件開始使用 TypeScript'
                        }
                    ],
                    alternatives: [
                        {
                            title: '使用 JSDoc',
                            description: '在 JavaScript 中使用 JSDoc 註釋提供類型信息',
                            pros: ['無需重構現有代碼', '學習成本低'],
                            cons: ['類型檢查不如 TypeScript 嚴格', '工具支援有限'],
                            effort: { hours: 8, complexity: 'simple', skillLevel: 'junior', teamSize: 1 }
                        }
                    ]
                },
                resources: [
                    {
                        type: 'documentation',
                        title: 'TypeScript 官方文檔',
                        url: 'https://www.typescriptlang.org/docs/',
                        description: 'TypeScript 的完整文檔和教程',
                        relevance: 1.0
                    }
                ],
                estimatedEffort: {
                    hours: 32,
                    complexity: 'moderate',
                    skillLevel: 'mid',
                    teamSize: 2
                },
                dependencies: [],
                tags: ['typescript', 'migration', 'code-quality'],
                confidence: 0.85,
                timestamp: new Date()
            });
        }

        return suggestions;
    }

    /**
     * 分析代碼品質
     */
    private async analyzeCodeQuality(qualityReport: CodeQualityReport): Promise<ProjectSuggestion[]> {
        const suggestions: ProjectSuggestion[] = [];

        if (qualityReport.metrics.complexity.cyclomaticComplexity > 15) {
            suggestions.push({
                id: 'reduce-complexity',
                category: SuggestionCategory.Maintainability,
                priority: 'high',
                title: '降低代碼複雜度',
                description: '重構高複雜度的函數和類，提高代碼可讀性和維護性',
                reasoning: `檢測到圈複雜度為 ${qualityReport.metrics.complexity.cyclomaticComplexity}，超過建議閾值 15`,
                impact: {
                    developmentSpeed: 1,
                    codeQuality: 4,
                    maintainability: 5,
                    performance: 1,
                    security: 0,
                    teamProductivity: 2,
                    userExperience: 0,
                    overallScore: 2.6
                },
                implementation: {
                    steps: [
                        {
                            order: 1,
                            title: '識別高複雜度函數',
                            description: '使用代碼分析工具找出複雜度最高的函數',
                            verification: '生成複雜度報告'
                        },
                        {
                            order: 2,
                            title: '重構複雜函數',
                            description: '將大函數拆分為多個小函數',
                            codeExamples: [
                                {
                                    language: 'typescript',
                                    before: 'function complexFunction() {\n  // 100+ lines of code\n}',
                                    after: 'function mainFunction() {\n  step1();\n  step2();\n  step3();\n}\n\nfunction step1() { /* ... */ }\nfunction step2() { /* ... */ }\nfunction step3() { /* ... */ }',
                                    explanation: '將大函數拆分為多個職責單一的小函數'
                                }
                            ],
                            verification: '確認函數複雜度降低到 10 以下'
                        }
                    ],
                    prerequisites: ['代碼分析工具', '重構技能'],
                    estimatedTime: '1-2 週',
                    difficulty: 'intermediate',
                    risks: [
                        {
                            description: '重構可能引入新的 bug',
                            probability: 'medium',
                            impact: 'medium',
                            mitigation: '充分的測試覆蓋和逐步重構'
                        }
                    ],
                    alternatives: []
                },
                resources: [
                    {
                        type: 'article',
                        title: '重構：改善既有代碼的設計',
                        url: 'https://refactoring.com/',
                        description: 'Martin Fowler 的經典重構指南',
                        relevance: 0.9
                    }
                ],
                estimatedEffort: {
                    hours: 40,
                    complexity: 'moderate',
                    skillLevel: 'mid',
                    teamSize: 2
                },
                dependencies: [],
                tags: ['refactoring', 'complexity', 'maintainability'],
                confidence: 0.9,
                timestamp: new Date()
            });
        }

        return suggestions;
    }

    /**
     * 分析依賴
     */
    private async analyzeDependencies(dependencyAnalysis: DependencyAnalysisResult): Promise<ProjectSuggestion[]> {
        const suggestions: ProjectSuggestion[] = [];

        if (dependencyAnalysis.securityReport.totalVulnerabilities > 0) {
            suggestions.push({
                id: 'fix-vulnerabilities',
                category: SuggestionCategory.Security,
                priority: 'critical',
                title: '修復安全漏洞',
                description: '更新存在安全漏洞的依賴包',
                reasoning: `發現 ${dependencyAnalysis.securityReport.totalVulnerabilities} 個安全漏洞`,
                impact: {
                    developmentSpeed: 0,
                    codeQuality: 0,
                    maintainability: 0,
                    performance: 0,
                    security: 5,
                    teamProductivity: 0,
                    userExperience: 1,
                    overallScore: 3.0
                },
                implementation: {
                    steps: [
                        {
                            order: 1,
                            title: '審查漏洞報告',
                            description: '詳細檢查每個安全漏洞的影響範圍',
                            verification: '確認所有漏洞都已識別和評估'
                        },
                        {
                            order: 2,
                            title: '更新依賴',
                            description: '將存在漏洞的依賴更新到安全版本',
                            commands: ['npm audit fix', 'npm update'],
                            verification: '運行 npm audit 確認無漏洞'
                        }
                    ],
                    prerequisites: ['依賴管理權限'],
                    estimatedTime: '1-2 天',
                    difficulty: 'beginner',
                    risks: [
                        {
                            description: '更新可能導致破壞性變更',
                            probability: 'medium',
                            impact: 'medium',
                            mitigation: '在測試環境中先進行更新和測試'
                        }
                    ],
                    alternatives: []
                },
                resources: [
                    {
                        type: 'tool',
                        title: 'npm audit',
                        url: 'https://docs.npmjs.com/cli/v8/commands/npm-audit',
                        description: 'npm 內建的安全審計工具',
                        relevance: 1.0
                    }
                ],
                estimatedEffort: {
                    hours: 8,
                    complexity: 'simple',
                    skillLevel: 'junior',
                    teamSize: 1
                },
                dependencies: [],
                tags: ['security', 'dependencies', 'vulnerabilities'],
                confidence: 0.95,
                timestamp: new Date()
            });
        }

        return suggestions;
    }

    /**
     * 應用過濾器
     */
    private applyFilter(suggestions: ProjectSuggestion[], filter?: SuggestionFilter): ProjectSuggestion[] {
        if (!filter) {return suggestions;}

        return suggestions.filter(suggestion => {
            if (filter.categories && !filter.categories.includes(suggestion.category)) {
                return false;
            }
            if (filter.priorities && !filter.priorities.includes(suggestion.priority)) {
                return false;
            }
            if (filter.minConfidence && suggestion.confidence < filter.minConfidence) {
                return false;
            }
            if (filter.maxEffort && suggestion.estimatedEffort.hours > filter.maxEffort) {
                return false;
            }
            if (filter.tags && !filter.tags.some(tag => suggestion.tags.includes(tag))) {
                return false;
            }
            return true;
        });
    }

    /**
     * 優先級排序
     */
    private prioritizeSuggestions(suggestions: ProjectSuggestion[]): ProjectSuggestion[] {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

        return suggestions.sort((a, b) => {
            // 首先按優先級排序
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) {return priorityDiff;}

            // 然後按影響分數排序
            const impactDiff = b.impact.overallScore - a.impact.overallScore;
            if (impactDiff !== 0) {return impactDiff;}

            // 最後按信心度排序
            return b.confidence - a.confidence;
        });
    }

    /**
     * 生成摘要
     */
    private generateSummary(suggestions: ProjectSuggestion[]): SuggestionSummary {
        const criticalIssues = suggestions.filter(s => s.priority === 'critical').length;
        const quickWins = suggestions.filter(s => s.estimatedEffort.hours <= 8 && s.impact.overallScore >= 2).length;
        const longTermGoals = suggestions.filter(s => s.estimatedEffort.hours > 40).length;

        const averageImpact = suggestions.reduce((sum, s) => sum + s.impact.overallScore, 0) / suggestions.length;

        const priorityGroups = suggestions.reduce((groups, s) => {
            groups[s.priority] = (groups[s.priority] || 0) + 1;
            return groups;
        }, {} as { [key: string]: number });

        const recommendedPriority = Object.entries(priorityGroups)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([priority]) => priority);

        return {
            totalSuggestions: suggestions.length,
            criticalIssues,
            quickWins,
            longTermGoals,
            estimatedImpact: Math.round(averageImpact * 100) / 100,
            recommendedPriority
        };
    }

    /**
     * 生成路線圖
     */
    private generateRoadmap(suggestions: ProjectSuggestion[]): DevelopmentRoadmap {
        const phases: RoadmapPhase[] = [
            {
                name: '緊急修復階段',
                duration: '1-2 週',
                suggestions: suggestions.filter(s => s.priority === 'critical').map(s => s.id),
                goals: ['修復關鍵安全問題', '解決阻塞性問題'],
                deliverables: ['安全漏洞修復報告', '系統穩定性確認']
            },
            {
                name: '快速改進階段',
                duration: '2-4 週',
                suggestions: suggestions.filter(s => s.estimatedEffort.hours <= 16 && s.priority === 'high').map(s => s.id),
                goals: ['實施快速勝利項目', '提升開發效率'],
                deliverables: ['代碼品質改善', '開發工具優化']
            },
            {
                name: '長期優化階段',
                duration: '2-3 個月',
                suggestions: suggestions.filter(s => s.estimatedEffort.hours > 16).map(s => s.id),
                goals: ['架構重構', '性能優化', '最佳實踐實施'],
                deliverables: ['架構文檔', '性能基準', '最佳實踐指南']
            }
        ];

        const milestones: Milestone[] = [
            {
                name: '安全基線達成',
                date: '2 週後',
                criteria: ['所有關鍵安全漏洞已修復', '安全掃描通過'],
                dependencies: ['fix-vulnerabilities']
            },
            {
                name: '代碼品質提升',
                date: '6 週後',
                criteria: ['代碼複雜度降低 20%', '測試覆蓋率達到 80%'],
                dependencies: ['reduce-complexity', 'improve-testing']
            }
        ];

        return {
            phases,
            timeline: '3-4 個月',
            milestones
        };
    }

    /**
     * 計算指標
     */
    private calculateMetrics(suggestions: ProjectSuggestion[]): SuggestionMetrics {
        const categoryDistribution = suggestions.reduce((dist, s) => {
            dist[s.category] = (dist[s.category] || 0) + 1;
            return dist;
        }, {} as { [key in SuggestionCategory]: number });

        const priorityDistribution = suggestions.reduce((dist, s) => {
            dist[s.priority] = (dist[s.priority] || 0) + 1;
            return dist;
        }, {} as { [key: string]: number });

        const averageConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
        const totalEstimatedHours = suggestions.reduce((sum, s) => sum + s.estimatedEffort.hours, 0);
        const potentialImpact = suggestions.reduce((sum, s) => sum + s.impact.overallScore, 0);

        return {
            categoryDistribution,
            priorityDistribution,
            averageConfidence,
            totalEstimatedHours,
            potentialImpact
        };
    }

    // 其他分析方法的簡化實作
    private async analyzePerformance(qualityReport: CodeQualityReport): Promise<ProjectSuggestion[]> { return []; }
    private async analyzeSecurity(qualityReport: CodeQualityReport, dependencyAnalysis: DependencyAnalysisResult): Promise<ProjectSuggestion[]> { return []; }
    private async analyzeTesting(qualityReport: CodeQualityReport): Promise<ProjectSuggestion[]> { return []; }
    private async analyzeDocumentation(projectInfo: ProjectInfo): Promise<ProjectSuggestion[]> { return []; }
    private async analyzeBestPractices(projectInfo: ProjectInfo, qualityReport: CodeQualityReport): Promise<ProjectSuggestion[]> { return []; }

    private initializeBestPractices(): void {
        // 初始化最佳實踐數據庫
    }

    private addToHistory(report: SuggestionReport): void {
        this.suggestionHistory.unshift(report);
        if (this.suggestionHistory.length > 10) {
            this.suggestionHistory = this.suggestionHistory.slice(0, 10);
        }
        this.saveSuggestionHistory();
    }

    private loadSuggestionHistory(): void {
        const history = this.context.globalState.get<any[]>('suggestionHistory', []);
        this.suggestionHistory = history.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp)
        }));
    }

    private saveSuggestionHistory(): void {
        this.context.globalState.update('suggestionHistory', this.suggestionHistory);
    }

    /**
     * 獲取建議歷史
     */
    getSuggestionHistory(): SuggestionReport[] {
        return [...this.suggestionHistory];
    }

    /**
     * 導出建議報告
     */
    async exportSuggestionReport(report: SuggestionReport, format: 'json' | 'markdown' = 'markdown'): Promise<string> {
        switch (format) {
            case 'json':
                return JSON.stringify(report, null, 2);
            case 'markdown':
                return this.generateMarkdownReport(report);
            default:
                throw new Error(`不支援的格式: ${format}`);
        }
    }

    private generateMarkdownReport(report: SuggestionReport): string {
        return `
# 項目改進建議報告

**項目路徑**: ${report.projectPath}  
**生成時間**: ${report.timestamp.toLocaleString()}

## 摘要

- **總建議數**: ${report.summary.totalSuggestions}
- **關鍵問題**: ${report.summary.criticalIssues}
- **快速勝利**: ${report.summary.quickWins}
- **長期目標**: ${report.summary.longTermGoals}
- **預估影響**: ${report.summary.estimatedImpact}/5

## 建議列表

${report.suggestions.map(suggestion => `
### ${suggestion.title} (${suggestion.priority})

**類別**: ${suggestion.category}  
**信心度**: ${Math.round(suggestion.confidence * 100)}%  
**預估工時**: ${suggestion.estimatedEffort.hours} 小時

${suggestion.description}

**實施步驟**:
${suggestion.implementation.steps.map(step => `${step.order}. ${step.title}: ${step.description}`).join('\n')}

**預期影響**:
- 代碼品質: ${suggestion.impact.codeQuality}/5
- 可維護性: ${suggestion.impact.maintainability}/5
- 性能: ${suggestion.impact.performance}/5
- 安全性: ${suggestion.impact.security}/5

---
`).join('')}

## 開發路線圖

${report.roadmap.phases.map(phase => `
### ${phase.name} (${phase.duration})

**目標**: ${phase.goals.join(', ')}  
**交付物**: ${phase.deliverables.join(', ')}
`).join('')}
        `;
    }
}

// 輔助接口
interface SuggestionRule {
    id: string;
    condition: (projectInfo: ProjectInfo, qualityReport: CodeQualityReport) => boolean;
    suggestion: Omit<ProjectSuggestion, 'id' | 'timestamp'>;
}

interface BestPractice {
    id: string;
    category: SuggestionCategory;
    title: string;
    description: string;
    applicableProjectTypes: string[];
    indicators: string[];
}
