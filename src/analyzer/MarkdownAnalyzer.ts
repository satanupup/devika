import * as vscode from 'vscode';
import * as path from 'path';

export interface MarkdownSection {
    level: number;
    title: string;
    content: string;
    lineStart: number;
    lineEnd: number;
    subsections: MarkdownSection[];
}

export interface MarkdownElement {
    type: 'header' | 'paragraph' | 'list' | 'code' | 'quote' | 'table' | 'image' | 'link' | 'badge';
    content: string;
    line: number;
    metadata?: any;
}

export interface MarkdownAnalysis {
    fileName: string;
    filePath: string;
    title: string;
    description: string;
    tableOfContents: MarkdownSection[];
    elements: MarkdownElement[];
    statistics: {
        totalLines: number;
        totalWords: number;
        totalCharacters: number;
        headerCount: number;
        codeBlockCount: number;
        imageCount: number;
        linkCount: number;
        badgeCount: number;
        listCount: number;
        tableCount: number;
    };
    structure: {
        hasTableOfContents: boolean;
        hasImages: boolean;
        hasBadges: boolean;
        hasCodeBlocks: boolean;
        hasTables: boolean;
        maxHeaderLevel: number;
        sections: string[];
    };
    quality: {
        score: number;
        issues: string[];
        suggestions: string[];
    };
}

export class MarkdownAnalyzer {
    
    async analyzeMarkdownFile(filePath: string): Promise<MarkdownAnalysis> {
        const document = await vscode.workspace.openTextDocument(filePath);
        const content = document.getText();
        const lines = content.split('\n');
        
        const analysis: MarkdownAnalysis = {
            fileName: path.basename(filePath),
            filePath,
            title: '',
            description: '',
            tableOfContents: [],
            elements: [],
            statistics: {
                totalLines: lines.length,
                totalWords: 0,
                totalCharacters: content.length,
                headerCount: 0,
                codeBlockCount: 0,
                imageCount: 0,
                linkCount: 0,
                badgeCount: 0,
                listCount: 0,
                tableCount: 0
            },
            structure: {
                hasTableOfContents: false,
                hasImages: false,
                hasBadges: false,
                hasCodeBlocks: false,
                hasTables: false,
                maxHeaderLevel: 0,
                sections: []
            },
            quality: {
                score: 0,
                issues: [],
                suggestions: []
            }
        };

        await this.parseContent(lines, analysis);
        this.calculateStatistics(analysis);
        this.analyzeStructure(analysis);
        this.assessQuality(analysis);

        return analysis;
    }

    private async parseContent(lines: string[], analysis: MarkdownAnalysis): Promise<void> {
        let currentSection: MarkdownSection | null = null;
        let sectionStack: MarkdownSection[] = [];
        let inCodeBlock = false;
        let codeBlockStart = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // 檢測代碼塊
            if (trimmedLine.startsWith('```')) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    codeBlockStart = i;
                } else {
                    inCodeBlock = false;
                    analysis.elements.push({
                        type: 'code',
                        content: lines.slice(codeBlockStart, i + 1).join('\n'),
                        line: codeBlockStart,
                        metadata: { language: lines[codeBlockStart].replace('```', '') }
                    });
                    analysis.statistics.codeBlockCount++;
                }
                continue;
            }

            if (inCodeBlock) continue;

            // 檢測標題
            const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                const title = headerMatch[2];
                
                // 提取主標題
                if (level === 1 && !analysis.title) {
                    analysis.title = title;
                }

                const section: MarkdownSection = {
                    level,
                    title,
                    content: '',
                    lineStart: i,
                    lineEnd: i,
                    subsections: []
                };

                // 管理章節層級
                while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
                    sectionStack.pop();
                }

                if (sectionStack.length === 0) {
                    analysis.tableOfContents.push(section);
                } else {
                    sectionStack[sectionStack.length - 1].subsections.push(section);
                }

                sectionStack.push(section);
                currentSection = section;

                analysis.elements.push({
                    type: 'header',
                    content: title,
                    line: i,
                    metadata: { level }
                });

                analysis.statistics.headerCount++;
                analysis.structure.maxHeaderLevel = Math.max(analysis.structure.maxHeaderLevel, level);
                analysis.structure.sections.push(title);
                continue;
            }

            // 檢測圖片
            const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
            if (imageMatch) {
                imageMatch.forEach(match => {
                    const [, alt, src] = match.match(/!\[([^\]]*)\]\(([^)]+)\)/) || [];
                    analysis.elements.push({
                        type: 'image',
                        content: match,
                        line: i,
                        metadata: { alt, src }
                    });
                    analysis.statistics.imageCount++;
                });
            }

            // 檢測徽章
            const badgeMatch = line.match(/https:\/\/img\.shields\.io\/badge/g);
            if (badgeMatch) {
                analysis.statistics.badgeCount += badgeMatch.length;
                analysis.elements.push({
                    type: 'badge',
                    content: line,
                    line: i
                });
            }

            // 檢測連結
            const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
            if (linkMatch) {
                linkMatch.forEach(match => {
                    if (!match.startsWith('![')) { // 排除圖片
                        const [, text, url] = match.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
                        analysis.elements.push({
                            type: 'link',
                            content: match,
                            line: i,
                            metadata: { text, url }
                        });
                        analysis.statistics.linkCount++;
                    }
                });
            }

            // 檢測列表
            if (trimmedLine.match(/^[-*+]\s+/) || trimmedLine.match(/^\d+\.\s+/)) {
                analysis.elements.push({
                    type: 'list',
                    content: trimmedLine,
                    line: i
                });
                analysis.statistics.listCount++;
            }

            // 檢測引用
            if (trimmedLine.startsWith('>')) {
                analysis.elements.push({
                    type: 'quote',
                    content: trimmedLine,
                    line: i
                });
            }

            // 檢測表格
            if (trimmedLine.includes('|') && trimmedLine.split('|').length > 2) {
                analysis.elements.push({
                    type: 'table',
                    content: trimmedLine,
                    line: i
                });
                analysis.statistics.tableCount++;
            }

            // 添加內容到當前章節
            if (currentSection && trimmedLine) {
                currentSection.content += line + '\n';
                currentSection.lineEnd = i;
            }

            // 提取描述（第一個非標題段落）
            if (!analysis.description && trimmedLine && !headerMatch && !trimmedLine.startsWith('>') && !trimmedLine.startsWith('!') && !trimmedLine.startsWith('<')) {
                analysis.description = trimmedLine.substring(0, 200);
            }
        }
    }

    private calculateStatistics(analysis: MarkdownAnalysis): void {
        const content = analysis.elements
            .filter(el => el.type === 'paragraph')
            .map(el => el.content)
            .join(' ');
        
        analysis.statistics.totalWords = content.split(/\s+/).filter(word => word.length > 0).length;
    }

    private analyzeStructure(analysis: MarkdownAnalysis): void {
        analysis.structure.hasTableOfContents = analysis.tableOfContents.length > 0;
        analysis.structure.hasImages = analysis.statistics.imageCount > 0;
        analysis.structure.hasBadges = analysis.statistics.badgeCount > 0;
        analysis.structure.hasCodeBlocks = analysis.statistics.codeBlockCount > 0;
        analysis.structure.hasTables = analysis.statistics.tableCount > 0;

        // 檢測是否有目錄章節
        const tocSections = ['目錄', 'table of contents', 'contents', 'toc'];
        analysis.structure.hasTableOfContents = analysis.structure.sections.some(section => 
            tocSections.some(toc => section.toLowerCase().includes(toc))
        );
    }

    private assessQuality(analysis: MarkdownAnalysis): void {
        let score = 100;
        const issues: string[] = [];
        const suggestions: string[] = [];

        // 檢查基本結構
        if (!analysis.title) {
            score -= 20;
            issues.push('缺少主標題 (H1)');
            suggestions.push('添加一個主標題來明確文檔的主題');
        }

        if (!analysis.description) {
            score -= 15;
            issues.push('缺少描述段落');
            suggestions.push('在開頭添加一段描述來說明文檔的目的');
        }

        if (analysis.statistics.headerCount === 0) {
            score -= 25;
            issues.push('沒有任何標題結構');
            suggestions.push('使用標題來組織內容結構');
        }

        // 檢查內容豐富度
        if (analysis.statistics.totalWords < 100) {
            score -= 10;
            issues.push('內容過少');
            suggestions.push('增加更多詳細的內容說明');
        }

        if (analysis.statistics.codeBlockCount === 0 && analysis.fileName.toLowerCase().includes('readme')) {
            score -= 5;
            suggestions.push('考慮添加代碼示例來幫助理解');
        }

        // 檢查結構完整性
        if (analysis.structure.maxHeaderLevel > 3 && !analysis.structure.hasTableOfContents) {
            score -= 10;
            suggestions.push('文檔較長，建議添加目錄來改善導航');
        }

        if (analysis.statistics.linkCount === 0) {
            score -= 5;
            suggestions.push('考慮添加相關連結來提供更多資源');
        }

        // 檢查專業性
        if (analysis.structure.hasBadges) {
            score += 5; // 徽章表示專業性
        }

        if (analysis.structure.hasImages) {
            score += 5; // 圖片增加可讀性
        }

        analysis.quality.score = Math.max(0, Math.min(100, score));
        analysis.quality.issues = issues;
        analysis.quality.suggestions = suggestions;
    }

    generateSummary(analysis: MarkdownAnalysis): string {
        let summary = `📄 **${analysis.fileName} 分析報告**\n\n`;
        
        if (analysis.title) {
            summary += `📋 **標題**: ${analysis.title}\n`;
        }
        
        if (analysis.description) {
            summary += `📝 **描述**: ${analysis.description}\n`;
        }

        summary += `\n📊 **統計信息**:\n`;
        summary += `• 總行數: ${analysis.statistics.totalLines}\n`;
        summary += `• 總字數: ${analysis.statistics.totalWords}\n`;
        summary += `• 標題數: ${analysis.statistics.headerCount}\n`;
        summary += `• 代碼塊: ${analysis.statistics.codeBlockCount}\n`;
        summary += `• 圖片: ${analysis.statistics.imageCount}\n`;
        summary += `• 連結: ${analysis.statistics.linkCount}\n`;
        summary += `• 徽章: ${analysis.statistics.badgeCount}\n`;

        summary += `\n🏗️ **結構分析**:\n`;
        summary += `• 最大標題層級: H${analysis.structure.maxHeaderLevel}\n`;
        summary += `• 有目錄: ${analysis.structure.hasTableOfContents ? '✅' : '❌'}\n`;
        summary += `• 有圖片: ${analysis.structure.hasImages ? '✅' : '❌'}\n`;
        summary += `• 有代碼: ${analysis.structure.hasCodeBlocks ? '✅' : '❌'}\n`;
        summary += `• 有表格: ${analysis.structure.hasTables ? '✅' : '❌'}\n`;

        summary += `\n⭐ **質量評分**: ${analysis.quality.score}/100\n`;

        if (analysis.quality.issues.length > 0) {
            summary += `\n⚠️ **發現問題**:\n`;
            analysis.quality.issues.forEach(issue => {
                summary += `• ${issue}\n`;
            });
        }

        if (analysis.quality.suggestions.length > 0) {
            summary += `\n💡 **改進建議**:\n`;
            analysis.quality.suggestions.forEach(suggestion => {
                summary += `• ${suggestion}\n`;
            });
        }

        if (analysis.tableOfContents.length > 0) {
            summary += `\n📑 **章節結構**:\n`;
            this.addSectionsToSummary(analysis.tableOfContents, summary, 0);
        }

        return summary;
    }

    private addSectionsToSummary(sections: MarkdownSection[], summary: string, depth: number): string {
        sections.forEach(section => {
            const indent = '  '.repeat(depth);
            summary += `${indent}• ${section.title}\n`;
            if (section.subsections.length > 0) {
                summary = this.addSectionsToSummary(section.subsections, summary, depth + 1);
            }
        });
        return summary;
    }
}
