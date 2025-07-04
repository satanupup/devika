import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface QualityReport {
    filePath: string;
    score: number;
    issues: QualityIssue[];
    suggestions: QualitySuggestion[];
    metrics: QualityMetrics;
    timestamp: Date;
}

export interface QualityIssue {
    type: 'structure' | 'content' | 'formatting' | 'accessibility' | 'seo' | 'links';
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
    suggestion?: string;
    rule: string;
}

export interface QualitySuggestion {
    category: 'improvement' | 'best_practice' | 'optimization';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    examples?: string[];
}

export interface QualityMetrics {
    readabilityScore: number;
    completenessScore: number;
    structureScore: number;
    accessibilityScore: number;
    seoScore: number;
    wordCount: number;
    readingTime: number;
    headingStructure: HeadingAnalysis;
    linkAnalysis: LinkAnalysis;
    imageAnalysis: ImageAnalysis;
}

export interface HeadingAnalysis {
    hasH1: boolean;
    headingCount: { [level: string]: number };
    structureValid: boolean;
    missingLevels: number[];
}

export interface LinkAnalysis {
    totalLinks: number;
    internalLinks: number;
    externalLinks: number;
    brokenLinks: string[];
    missingAltText: string[];
}

export interface ImageAnalysis {
    totalImages: number;
    missingAltText: number;
    oversizedImages: string[];
    missingImages: string[];
}

export class DocumentationQualityChecker {
    private qualityRules: QualityRule[] = [];
    private customRules: Map<string, QualityRule> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.initializeDefaultRules();
        this.loadCustomRules();
    }

    /**
     * 檢查文檔品質
     */
    async checkDocumentQuality(filePath: string): Promise<QualityReport> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const issues: QualityIssue[] = [];
            const suggestions: QualitySuggestion[] = [];

            // 執行所有品質規則
            for (const rule of this.qualityRules) {
                const ruleResults = await rule.check(content, filePath);
                issues.push(...ruleResults.issues);
                suggestions.push(...ruleResults.suggestions);
            }

            // 計算指標
            const metrics = await this.calculateMetrics(content, filePath);

            // 計算總分
            const score = this.calculateOverallScore(metrics, issues);

            return {
                filePath,
                score,
                issues,
                suggestions,
                metrics,
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`檢查文檔品質失敗: ${error}`);
        }
    }

    /**
     * 批量檢查文檔
     */
    async checkMultipleDocuments(filePaths: string[]): Promise<QualityReport[]> {
        const reports: QualityReport[] = [];

        for (const filePath of filePaths) {
            try {
                const report = await this.checkDocumentQuality(filePath);
                reports.push(report);
            } catch (error) {
                console.error(`檢查文檔失敗: ${filePath}`, error);
            }
        }

        return reports;
    }

    /**
     * 自動修復問題
     */
    async autoFixIssues(filePath: string, issueTypes?: string[]): Promise<number> {
        const report = await this.checkDocumentQuality(filePath);
        const content = await fs.promises.readFile(filePath, 'utf8');
        let fixedContent = content;
        let fixedCount = 0;

        const fixableIssues = report.issues.filter(issue =>
            issue.suggestion &&
            (!issueTypes || issueTypes.includes(issue.type))
        );

        for (const issue of fixableIssues) {
            const fixedResult = this.applyFix(fixedContent, issue);
            if (fixedResult.success) {
                fixedContent = fixedResult.content;
                fixedCount++;
            }
        }

        if (fixedCount > 0) {
            await fs.promises.writeFile(filePath, fixedContent, 'utf8');
        }

        return fixedCount;
    }

    /**
     * 計算指標
     */
    private async calculateMetrics(content: string, filePath: string): Promise<QualityMetrics> {
        const lines = content.split('\n');
        const wordCount = this.countWords(content);
        const readingTime = Math.ceil(wordCount / 200); // 假設每分鐘讀200字

        return {
            readabilityScore: this.calculateReadabilityScore(content),
            completenessScore: this.calculateCompletenessScore(content),
            structureScore: this.calculateStructureScore(content),
            accessibilityScore: this.calculateAccessibilityScore(content),
            seoScore: this.calculateSEOScore(content),
            wordCount,
            readingTime,
            headingStructure: this.analyzeHeadingStructure(content),
            linkAnalysis: await this.analyzeLinkStructure(content),
            imageAnalysis: this.analyzeImageStructure(content)
        };
    }

    /**
     * 分析標題結構
     */
    private analyzeHeadingStructure(content: string): HeadingAnalysis {
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const headings: { level: number; text: string }[] = [];
        let match;

        while ((match = headingRegex.exec(content)) !== null) {
            headings.push({
                level: match[1].length,
                text: match[2].trim()
            });
        }

        const headingCount: { [level: string]: number } = {};
        for (let i = 1; i <= 6; i++) {
            headingCount[`h${i}`] = headings.filter(h => h.level === i).length;
        }

        const hasH1 = headingCount.h1 > 0;
        const structureValid = this.validateHeadingStructure(headings);
        const missingLevels = this.findMissingHeadingLevels(headings);

        return {
            hasH1,
            headingCount,
            structureValid,
            missingLevels
        };
    }

    /**
     * 分析連結結構
     */
    private async analyzeLinkStructure(content: string): Promise<LinkAnalysis> {
        const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
        const links: string[] = [];
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
            links.push(match[2]);
        }

        const internalLinks = links.filter(link =>
            link.startsWith('#') ||
            link.startsWith('./') ||
            link.startsWith('../') ||
            !link.includes('://')
        );

        const externalLinks = links.filter(link =>
            link.includes('://') &&
            !link.startsWith('#') &&
            !link.startsWith('./')
        );

        // 檢查斷鏈（簡化實作）
        const brokenLinks: string[] = [];
        for (const link of internalLinks) {
            if (link.startsWith('#')) {continue;} // 跳過錨點連結

            try {
                const linkPath = path.resolve(path.dirname(''), link);
                await fs.promises.access(linkPath);
            } catch {
                brokenLinks.push(link);
            }
        }

        return {
            totalLinks: links.length,
            internalLinks: internalLinks.length,
            externalLinks: externalLinks.length,
            brokenLinks,
            missingAltText: [] // 簡化實作
        };
    }

    /**
     * 分析圖片結構
     */
    private analyzeImageStructure(content: string): ImageAnalysis {
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const images: { alt: string; src: string }[] = [];
        let match;

        while ((match = imageRegex.exec(content)) !== null) {
            images.push({
                alt: match[1],
                src: match[2]
            });
        }

        const missingAltText = images.filter(img => !img.alt.trim()).length;
        const oversizedImages: string[] = []; // 需要實際檢查圖片大小
        const missingImages: string[] = []; // 需要檢查圖片是否存在

        return {
            totalImages: images.length,
            missingAltText,
            oversizedImages,
            missingImages
        };
    }

    /**
     * 計算各種分數
     */
    private calculateReadabilityScore(content: string): number {
        // 簡化的可讀性評分
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = this.countWords(content);
        const avgWordsPerSentence = words / sentences.length;

        // 基於平均句子長度的簡單評分
        if (avgWordsPerSentence <= 15) {return 90;}
        if (avgWordsPerSentence <= 20) {return 80;}
        if (avgWordsPerSentence <= 25) {return 70;}
        return 60;
    }

    private calculateCompletenessScore(content: string): number {
        const requiredSections = [
            /^#\s+/m, // 標題
            /installation|安裝/i,
            /usage|使用/i,
            /example|範例/i
        ];

        const presentSections = requiredSections.filter(regex => regex.test(content));
        return Math.round((presentSections.length / requiredSections.length) * 100);
    }

    private calculateStructureScore(content: string): number {
        const headingAnalysis = this.analyzeHeadingStructure(content);
        let score = 100;

        if (!headingAnalysis.hasH1) {score -= 20;}
        if (!headingAnalysis.structureValid) {score -= 15;}
        if (headingAnalysis.missingLevels.length > 0) {score -= 10;}

        return Math.max(0, score);
    }

    private calculateAccessibilityScore(content: string): number {
        const imageAnalysis = this.analyzeImageStructure(content);
        let score = 100;

        if (imageAnalysis.missingAltText > 0) {
            score -= (imageAnalysis.missingAltText / imageAnalysis.totalImages) * 30;
        }

        return Math.max(0, Math.round(score));
    }

    private calculateSEOScore(content: string): number {
        let score = 100;
        const headingAnalysis = this.analyzeHeadingStructure(content);

        if (!headingAnalysis.hasH1) {score -= 25;}
        if (headingAnalysis.headingCount.h1 > 1) {score -= 15;}
        if (this.countWords(content) < 300) {score -= 20;}

        return Math.max(0, score);
    }

    /**
     * 計算總分
     */
    private calculateOverallScore(metrics: QualityMetrics, issues: QualityIssue[]): number {
        const weights = {
            readability: 0.2,
            completeness: 0.25,
            structure: 0.2,
            accessibility: 0.15,
            seo: 0.2
        };

        const baseScore =
            metrics.readabilityScore * weights.readability +
            metrics.completenessScore * weights.completeness +
            metrics.structureScore * weights.structure +
            metrics.accessibilityScore * weights.accessibility +
            metrics.seoScore * weights.seo;

        // 根據問題扣分
        const errorPenalty = issues.filter(i => i.severity === 'error').length * 5;
        const warningPenalty = issues.filter(i => i.severity === 'warning').length * 2;

        return Math.max(0, Math.round(baseScore - errorPenalty - warningPenalty));
    }

    /**
     * 初始化默認規則
     */
    private initializeDefaultRules(): void {
        // 標題結構規則
        this.qualityRules.push({
            name: 'heading-structure',
            description: '檢查標題結構',
            check: async (content: string) => {
                const issues: QualityIssue[] = [];
                const suggestions: QualitySuggestion[] = [];

                const headingAnalysis = this.analyzeHeadingStructure(content);

                if (!headingAnalysis.hasH1) {
                    issues.push({
                        type: 'structure',
                        severity: 'error',
                        message: '文檔缺少主標題 (H1)',
                        suggestion: '添加一個 # 主標題',
                        rule: 'heading-structure'
                    });
                }

                if (headingAnalysis.headingCount.h1 > 1) {
                    issues.push({
                        type: 'structure',
                        severity: 'warning',
                        message: '文檔有多個 H1 標題',
                        suggestion: '只保留一個主標題，其他改為 H2 或更低級別',
                        rule: 'heading-structure'
                    });
                }

                return { issues, suggestions };
            }
        });

        // 內容長度規則
        this.qualityRules.push({
            name: 'content-length',
            description: '檢查內容長度',
            check: async (content: string) => {
                const issues: QualityIssue[] = [];
                const suggestions: QualitySuggestion[] = [];

                const wordCount = this.countWords(content);

                if (wordCount < 100) {
                    issues.push({
                        type: 'content',
                        severity: 'warning',
                        message: '文檔內容過短',
                        suggestion: '增加更多詳細說明和範例',
                        rule: 'content-length'
                    });
                }

                if (wordCount > 5000) {
                    suggestions.push({
                        category: 'improvement',
                        title: '考慮拆分長文檔',
                        description: '文檔較長，考慮拆分為多個部分',
                        impact: 'medium',
                        effort: 'medium'
                    });
                }

                return { issues, suggestions };
            }
        });
    }

    // 輔助方法
    private countWords(text: string): number {
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }

    private validateHeadingStructure(headings: { level: number; text: string }[]): boolean {
        for (let i = 1; i < headings.length; i++) {
            const current = headings[i];
            const previous = headings[i - 1];

            // 檢查是否跳過了標題級別
            if (current.level > previous.level + 1) {
                return false;
            }
        }
        return true;
    }

    private findMissingHeadingLevels(headings: { level: number; text: string }[]): number[] {
        const usedLevels = [...new Set(headings.map(h => h.level))].sort();
        const missing: number[] = [];

        for (let i = 1; i < usedLevels.length; i++) {
            const current = usedLevels[i];
            const previous = usedLevels[i - 1];

            for (let level = previous + 1; level < current; level++) {
                missing.push(level);
            }
        }

        return missing;
    }

    private applyFix(content: string, issue: QualityIssue): { success: boolean; content: string } {
        // 簡化的自動修復實作
        if (issue.type === 'structure' && issue.message.includes('缺少主標題')) {
            const lines = content.split('\n');
            if (lines.length > 0 && !lines[0].startsWith('#')) {
                lines.unshift('# 文檔標題\n');
                return { success: true, content: lines.join('\n') };
            }
        }

        return { success: false, content };
    }

    private loadCustomRules(): void {
        const rules = this.context.globalState.get<any[]>('customQualityRules', []);
        for (const rule of rules) {
            this.customRules.set(rule.name, rule);
        }
    }

    private async saveCustomRules(): Promise<void> {
        const rules = Array.from(this.customRules.values());
        await this.context.globalState.update('customQualityRules', rules);
    }

    /**
     * 生成品質報告
     */
    async generateQualityReport(reports: QualityReport[]): Promise<string> {
        const totalScore = reports.reduce((sum, r) => sum + r.score, 0) / reports.length;
        const totalIssues = reports.reduce((sum, r) => sum + r.issues.length, 0);

        let report = `# 文檔品質報告\n\n`;
        report += `**總體評分**: ${Math.round(totalScore)}/100\n`;
        report += `**檢查文檔數**: ${reports.length}\n`;
        report += `**發現問題數**: ${totalIssues}\n\n`;

        report += `## 詳細結果\n\n`;

        for (const docReport of reports) {
            report += `### ${path.basename(docReport.filePath)}\n`;
            report += `- **評分**: ${docReport.score}/100\n`;
            report += `- **字數**: ${docReport.metrics.wordCount}\n`;
            report += `- **閱讀時間**: ${docReport.metrics.readingTime} 分鐘\n`;

            if (docReport.issues.length > 0) {
                report += `- **問題**: ${docReport.issues.length} 個\n`;
                for (const issue of docReport.issues.slice(0, 3)) {
                    report += `  - ${issue.message}\n`;
                }
            }

            report += '\n';
        }

        return report;
    }

    /**
     * 清理資源
     */
    dispose(): void {
        // 清理資源
    }
}

interface QualityRule {
    name: string;
    description: string;
    check: (content: string, filePath?: string) => Promise<{
        issues: QualityIssue[];
        suggestions: QualitySuggestion[];
    }>;
}
