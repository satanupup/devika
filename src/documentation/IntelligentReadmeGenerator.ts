import * as vscode from 'vscode';
import * as path from 'path';
import { MultiProjectAnalyzer, ProjectInfo, ProjectType } from '../agent/MultiProjectAnalyzer';
import { AdvancedFileSystemService } from '../filesystem/AdvancedFileSystemService';
import { LLMService } from '../llm/LLMService';

export interface ReadmeSection {
    title: string;
    content: string;
    order: number;
    required: boolean;
}

export interface ReadmeTemplate {
    name: string;
    description: string;
    sections: ReadmeSection[];
    projectTypes: ProjectType[];
}

export interface ReadmeGenerationOptions {
    template?: string;
    language?: 'zh-TW' | 'zh-CN' | 'en';
    includeBadges?: boolean;
    includeTableOfContents?: boolean;
    includeInstallation?: boolean;
    includeUsage?: boolean;
    includeContributing?: boolean;
    includeLicense?: boolean;
    includeScreenshots?: boolean;
    customSections?: ReadmeSection[];
}

export class IntelligentReadmeGenerator {
    private multiProjectAnalyzer: MultiProjectAnalyzer;
    private fileSystemService: AdvancedFileSystemService;
    private llmService: LLMService;
    private templates: Map<string, ReadmeTemplate>;

    constructor(llmService: LLMService) {
        this.multiProjectAnalyzer = new MultiProjectAnalyzer();
        this.fileSystemService = new AdvancedFileSystemService();
        this.llmService = llmService;
        this.templates = new Map();
        this.initializeTemplates();
    }

    /**
     * 生成智能 README
     */
    async generateReadme(
        workspaceUri: vscode.Uri,
        options: ReadmeGenerationOptions = {}
    ): Promise<string> {
        // 分析項目結構
        const projectStructure = await this.multiProjectAnalyzer.analyzeWorkspace();

        // 選擇合適的模板
        const template = this.selectTemplate(projectStructure, options.template);

        // 生成各個章節
        const sections = await this.generateSections(projectStructure, template, options);

        // 組合最終的 README
        return this.assembleReadme(sections, options);
    }

    /**
     * 選擇合適的模板
     */
    private selectTemplate(projectStructure: any, templateName?: string): ReadmeTemplate {
        if (templateName && this.templates.has(templateName)) {
            return this.templates.get(templateName)!;
        }

        // 根據項目類型自動選擇模板
        if (projectStructure.projects.length > 1) {
            return this.templates.get('multi-project')!;
        }

        const mainProject = projectStructure.projects[0];
        if (mainProject) {
            switch (mainProject.type) {
                case ProjectType.ANDROID_APP:
                    return this.templates.get('android')!;
                case ProjectType.WEB_APP:
                    return this.templates.get('web-app')!;
                case ProjectType.LIBRARY:
                    return this.templates.get('library')!;
                case ProjectType.BACKEND_API:
                    return this.templates.get('api')!;
                default:
                    return this.templates.get('general')!;
            }
        }

        return this.templates.get('general')!;
    }

    /**
     * 生成各個章節
     */
    private async generateSections(
        projectStructure: any,
        template: ReadmeTemplate,
        options: ReadmeGenerationOptions
    ): Promise<ReadmeSection[]> {
        const sections: ReadmeSection[] = [];

        for (const templateSection of template.sections) {
            let content = '';

            switch (templateSection.title.toLowerCase()) {
                case 'title':
                    content = await this.generateTitle(projectStructure, options);
                    break;
                case 'description':
                    content = await this.generateDescription(projectStructure, options);
                    break;
                case 'badges':
                    if (options.includeBadges !== false) {
                        content = await this.generateBadges(projectStructure, options);
                    }
                    break;
                case 'table of contents':
                    if (options.includeTableOfContents !== false) {
                        content = this.generateTableOfContents(template.sections, options);
                    }
                    break;
                case 'installation':
                    if (options.includeInstallation !== false) {
                        content = await this.generateInstallation(projectStructure, options);
                    }
                    break;
                case 'usage':
                    if (options.includeUsage !== false) {
                        content = await this.generateUsage(projectStructure, options);
                    }
                    break;
                case 'features':
                    content = await this.generateFeatures(projectStructure, options);
                    break;
                case 'project structure':
                    content = await this.generateProjectStructure(projectStructure, options);
                    break;
                case 'contributing':
                    if (options.includeContributing !== false) {
                        content = await this.generateContributing(options);
                    }
                    break;
                case 'license':
                    if (options.includeLicense !== false) {
                        content = await this.generateLicense(projectStructure, options);
                    }
                    break;
                default:
                    content = templateSection.content;
            }

            if (content.trim()) {
                sections.push({
                    ...templateSection,
                    content
                });
            }
        }

        // 添加自定義章節
        if (options.customSections) {
            sections.push(...options.customSections);
        }

        return sections.sort((a, b) => a.order - b.order);
    }

    /**
     * 生成標題
     */
    private async generateTitle(projectStructure: any, options: ReadmeGenerationOptions): Promise<string> {
        const projectName = projectStructure.workspaceName || 'Project';

        if (projectStructure.projects.length === 1) {
            const project = projectStructure.projects[0];
            const description = project.description || '';
            return `# ${projectName}\n\n${description}`;
        } else {
            return `# ${projectName}\n\n多項目工作區，包含 ${projectStructure.projects.length} 個子項目。`;
        }
    }

    /**
     * 生成描述
     */
    private async generateDescription(projectStructure: any, options: ReadmeGenerationOptions): Promise<string> {
        const prompt = `
基於以下項目分析結果，生成一個專業的項目描述：

項目信息：
${JSON.stringify(projectStructure, null, 2)}

要求：
1. 用${options.language === 'en' ? '英文' : '中文'}撰寫
2. 描述要簡潔明瞭，突出項目的主要功能和特色
3. 包含技術棧信息
4. 適合放在 README 的描述部分

請生成一個 2-3 段的項目描述。
        `;

        try {
            const response = await this.llmService.generateCompletion(prompt);
            return response.content;
        } catch (error) {
            // 後備方案
            return this.generateFallbackDescription(projectStructure, options);
        }
    }

    /**
     * 生成徽章
     */
    private async generateBadges(projectStructure: any, options: ReadmeGenerationOptions): Promise<string> {
        const badges: string[] = [];

        // 語言徽章
        const languages = new Set<string>();
        projectStructure.projects.forEach((project: ProjectInfo) => {
            project.language.forEach(lang => languages.add(lang));
        });

        languages.forEach(lang => {
            const color = this.getLanguageColor(lang);
            badges.push(`![${lang}](https://img.shields.io/badge/${lang}-${color}?style=flat-square&logo=${lang.toLowerCase()})`);
        });

        // 項目類型徽章
        const types = new Set<string>();
        projectStructure.projects.forEach((project: ProjectInfo) => {
            types.add(project.type);
        });

        types.forEach(type => {
            badges.push(`![${type}](https://img.shields.io/badge/Type-${type.replace(' ', '%20')}-blue?style=flat-square)`);
        });

        // 通用徽章
        badges.push('![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)');
        badges.push('![Maintenance](https://img.shields.io/badge/Maintained-yes-green?style=flat-square)');

        return badges.join(' ');
    }

    /**
     * 生成目錄
     */
    private generateTableOfContents(sections: ReadmeSection[], options: ReadmeGenerationOptions): string {
        const toc = sections
            .filter(section => section.title.toLowerCase() !== 'table of contents')
            .map(section => {
                const anchor = section.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                return `- [${section.title}](#${anchor})`;
            })
            .join('\n');

        return `## 目錄\n\n${toc}`;
    }

    /**
     * 生成安裝說明
     */
    private async generateInstallation(projectStructure: any, options: ReadmeGenerationOptions): Promise<string> {
        let installation = '## 安裝\n\n';

        for (const project of projectStructure.projects) {
            if (project.type === ProjectType.WEB_APP || project.type === ProjectType.LIBRARY) {
                installation += '### Node.js 項目\n\n';
                installation += '```bash\n';
                installation += 'npm install\n';
                installation += '# 或\n';
                installation += 'yarn install\n';
                installation += '```\n\n';
            } else if (project.type === ProjectType.ANDROID_APP) {
                installation += '### Android 項目\n\n';
                installation += '1. 確保已安裝 Android Studio\n';
                installation += '2. 打開項目並同步 Gradle\n';
                installation += '3. 連接設備或啟動模擬器\n';
                installation += '4. 運行項目\n\n';
            }
        }

        return installation;
    }

    /**
     * 生成使用說明
     */
    private async generateUsage(projectStructure: any, options: ReadmeGenerationOptions): Promise<string> {
        const prompt = `
基於以下項目信息，生成使用說明：

${JSON.stringify(projectStructure, null, 2)}

請生成包含代碼示例的使用說明，用${options.language === 'en' ? '英文' : '中文'}撰寫。
        `;

        try {
            const response = await this.llmService.generateCompletion(prompt);
            return `## 使用方法\n\n${response.content}`;
        } catch (error) {
            return this.generateFallbackUsage(projectStructure, options);
        }
    }

    /**
     * 生成功能列表
     */
    private async generateFeatures(projectStructure: any, options: ReadmeGenerationOptions): Promise<string> {
        const features: string[] = [];

        projectStructure.projects.forEach((project: ProjectInfo) => {
            if (project.type === ProjectType.ANDROID_APP) {
                features.push('📱 Android 原生應用');
                features.push('🎨 Material Design 界面');
            } else if (project.type === ProjectType.WEB_APP) {
                features.push('🌐 響應式網頁應用');
                features.push('⚡ 現代化前端框架');
            } else if (project.type === ProjectType.LIBRARY) {
                features.push('📚 可重用的程式庫');
                features.push('🔧 易於整合');
            }
        });

        // 通用功能
        features.push('🚀 高性能');
        features.push('🔒 安全可靠');
        features.push('📖 完整文檔');
        features.push('🧪 全面測試');

        const featureList = features.map(feature => `- ${feature}`).join('\n');
        return `## 功能特色\n\n${featureList}`;
    }

    /**
     * 生成項目結構
     */
    private async generateProjectStructure(projectStructure: any, options: ReadmeGenerationOptions): Promise<string> {
        let structure = '## 項目結構\n\n';

        if (projectStructure.projects.length > 1) {
            structure += '```\n';
            structure += `${projectStructure.workspaceName}/\n`;

            projectStructure.projects.forEach((project: ProjectInfo, index: number) => {
                const isLast = index === projectStructure.projects.length - 1;
                const prefix = isLast ? '└── ' : '├── ';
                structure += `${prefix}${project.name}/ (${project.type})\n`;
            });

            structure += '```\n\n';

            // 詳細描述每個項目
            projectStructure.projects.forEach((project: ProjectInfo) => {
                structure += `### ${project.name}\n\n`;
                structure += `- **類型**: ${project.type}\n`;
                structure += `- **語言**: ${project.language.join(', ')}\n`;
                structure += `- **源文件**: ${project.sourceFiles} 個\n`;
                if (project.description) {
                    structure += `- **描述**: ${project.description}\n`;
                }
                structure += '\n';
            });
        }

        return structure;
    }

    /**
     * 組合最終的 README
     */
    private assembleReadme(sections: ReadmeSection[], options: ReadmeGenerationOptions): string {
        return sections.map(section => section.content).join('\n\n');
    }

    /**
     * 獲取語言顏色
     */
    private getLanguageColor(language: string): string {
        const colors: { [key: string]: string } = {
            'JavaScript': 'f7df1e',
            'TypeScript': '3178c6',
            'Python': '3776ab',
            'Java': 'ed8b00',
            'Kotlin': '7f52ff',
            'Swift': 'fa7343',
            'C++': '00599c',
            'C#': '239120',
            'Go': '00add8',
            'Rust': '000000'
        };
        return colors[language] || '666666';
    }

    /**
     * 後備描述生成
     */
    private generateFallbackDescription(projectStructure: any, options: ReadmeGenerationOptions): string {
        if (projectStructure.projects.length === 1) {
            const project = projectStructure.projects[0];
            return `這是一個 ${project.type} 項目，使用 ${project.language.join(', ')} 開發。`;
        } else {
            return `這是一個多項目工作區，包含 ${projectStructure.projects.length} 個子項目，涵蓋不同的技術棧和應用類型。`;
        }
    }

    /**
     * 後備使用說明生成
     */
    private generateFallbackUsage(projectStructure: any, options: ReadmeGenerationOptions): string {
        return '## 使用方法\n\n請參考各個子項目的具體文檔了解詳細的使用方法。';
    }

    /**
     * 生成貢獻指南
     */
    private async generateContributing(options: ReadmeGenerationOptions): Promise<string> {
        return `## 貢獻

歡迎貢獻代碼！請遵循以下步驟：

1. Fork 這個項目
2. 創建您的功能分支 (\`git checkout -b feature/AmazingFeature\`)
3. 提交您的更改 (\`git commit -m 'Add some AmazingFeature'\`)
4. 推送到分支 (\`git push origin feature/AmazingFeature\`)
5. 打開一個 Pull Request`;
    }

    /**
     * 生成許可證信息
     */
    private async generateLicense(projectStructure: any, options: ReadmeGenerationOptions): Promise<string> {
        return `## 許可證

本項目採用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。`;
    }

    /**
     * 初始化模板
     */
    private initializeTemplates(): void {
        // 通用模板
        this.templates.set('general', {
            name: 'General',
            description: '通用項目模板',
            projectTypes: [ProjectType.UNKNOWN],
            sections: [
                { title: 'Title', content: '', order: 1, required: true },
                { title: 'Badges', content: '', order: 2, required: false },
                { title: 'Description', content: '', order: 3, required: true },
                { title: 'Table of Contents', content: '', order: 4, required: false },
                { title: 'Features', content: '', order: 5, required: true },
                { title: 'Installation', content: '', order: 6, required: true },
                { title: 'Usage', content: '', order: 7, required: true },
                { title: 'Contributing', content: '', order: 8, required: false },
                { title: 'License', content: '', order: 9, required: false }
            ]
        });

        // 多項目模板
        this.templates.set('multi-project', {
            name: 'Multi-Project',
            description: '多項目工作區模板',
            projectTypes: [],
            sections: [
                { title: 'Title', content: '', order: 1, required: true },
                { title: 'Badges', content: '', order: 2, required: false },
                { title: 'Description', content: '', order: 3, required: true },
                { title: 'Table of Contents', content: '', order: 4, required: false },
                { title: 'Project Structure', content: '', order: 5, required: true },
                { title: 'Installation', content: '', order: 6, required: true },
                { title: 'Usage', content: '', order: 7, required: true },
                { title: 'Contributing', content: '', order: 8, required: false },
                { title: 'License', content: '', order: 9, required: false }
            ]
        });

        // 其他模板...
    }
}
