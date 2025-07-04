import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ProjectAnalysis {
    name: string;
    type: string;
    description: string;
    version: string;
    author: string;
    license: string;
    repository?: string;
    homepage?: string;
    keywords: string[];
    dependencies: DependencyInfo[];
    scripts: ScriptInfo[];
    features: FeatureInfo[];
    structure: ProjectStructure;
    installation: InstallationInfo;
    usage: UsageInfo;
    api: APIInfo[];
    testing: TestingInfo;
    deployment: DeploymentInfo;
    contributing: ContributingInfo;
}

export interface DependencyInfo {
    name: string;
    version: string;
    type: 'production' | 'development' | 'peer' | 'optional';
    description?: string;
    purpose?: string;
}

export interface ScriptInfo {
    name: string;
    command: string;
    description: string;
    category: 'build' | 'test' | 'dev' | 'deploy' | 'lint' | 'other';
}

export interface FeatureInfo {
    name: string;
    description: string;
    category: string;
    status: 'stable' | 'beta' | 'experimental' | 'deprecated';
    examples?: string[];
}

export interface ProjectStructure {
    directories: DirectoryInfo[];
    importantFiles: FileInfo[];
    conventions: string[];
}

export interface DirectoryInfo {
    name: string;
    path: string;
    purpose: string;
    fileCount: number;
    importance: 'high' | 'medium' | 'low';
}

export interface FileInfo {
    name: string;
    path: string;
    purpose: string;
    type: 'config' | 'source' | 'doc' | 'test' | 'build' | 'other';
}

export interface InstallationInfo {
    prerequisites: string[];
    steps: InstallationStep[];
    troubleshooting: TroubleshootingItem[];
}

export interface InstallationStep {
    step: number;
    title: string;
    command?: string;
    description: string;
    platform?: 'all' | 'windows' | 'macos' | 'linux';
}

export interface TroubleshootingItem {
    problem: string;
    solution: string;
    platform?: string;
}

export interface UsageInfo {
    quickStart: QuickStartInfo;
    examples: ExampleInfo[];
    configuration: ConfigurationInfo[];
}

export interface QuickStartInfo {
    steps: string[];
    code: string;
    expectedOutput?: string;
}

export interface ExampleInfo {
    title: string;
    description: string;
    code: string;
    output?: string;
    category: string;
}

export interface ConfigurationInfo {
    name: string;
    description: string;
    type: string;
    default?: any;
    required: boolean;
    example?: any;
}

export interface APIInfo {
    name: string;
    type: 'function' | 'class' | 'interface' | 'type' | 'constant';
    description: string;
    signature: string;
    parameters?: ParameterInfo[];
    returns?: string;
    examples?: string[];
    category: string;
}

export interface ParameterInfo {
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: any;
}

export interface TestingInfo {
    framework: string;
    coverage: number;
    commands: string[];
    structure: string;
    guidelines: string[];
}

export interface DeploymentInfo {
    platforms: string[];
    requirements: string[];
    steps: string[];
    environments: EnvironmentInfo[];
}

export interface EnvironmentInfo {
    name: string;
    description: string;
    url?: string;
    variables: { [key: string]: string };
}

export interface ContributingInfo {
    guidelines: string[];
    codeStyle: string;
    pullRequestProcess: string[];
    issueTemplate: string;
    developmentSetup: string[];
}

export interface READMETemplate {
    sections: READMESection[];
    style: 'minimal' | 'standard' | 'comprehensive' | 'enterprise';
    language: 'en' | 'zh' | 'auto';
    includeEmojis: boolean;
    includeBadges: boolean;
    includeTableOfContents: boolean;
}

export interface READMESection {
    name: string;
    title: string;
    content: string;
    order: number;
    required: boolean;
    template: string;
}

export class SmartREADMEGenerator {
    private templates: Map<string, READMETemplate> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.initializeTemplates();
    }

    /**
     * 生成智能 README
     */
    async generateREADME(projectPath: string, options?: {
        style?: 'minimal' | 'standard' | 'comprehensive' | 'enterprise';
        language?: 'en' | 'zh' | 'auto';
        includeEmojis?: boolean;
        includeBadges?: boolean;
        includeTableOfContents?: boolean;
        customSections?: string[];
    }): Promise<string> {
        try {
            // 分析項目
            const analysis = await this.analyzeProject(projectPath);

            // 選擇模板
            const template = this.selectTemplate(analysis, options);

            // 生成內容
            const content = await this.generateContent(analysis, template);

            return content;

        } catch (error) {
            console.error('生成 README 失敗:', error);
            throw error;
        }
    }

    /**
     * 分析項目
     */
    private async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
        const packageJsonPath = path.join(projectPath, 'package.json');
        let packageJson: any = {};

        // 讀取 package.json
        try {
            const content = await fs.promises.readFile(packageJsonPath, 'utf8');
            packageJson = JSON.parse(content);
        } catch (error) {
            console.warn('無法讀取 package.json:', error);
        }

        // 分析項目結構
        const structure = await this.analyzeProjectStructure(projectPath);

        // 分析依賴
        const dependencies = await this.analyzeDependencies(packageJson);

        // 分析腳本
        const scripts = await this.analyzeScripts(packageJson);

        // 分析功能
        const features = await this.analyzeFeatures(projectPath, packageJson);

        // 分析 API
        const api = await this.analyzeAPI(projectPath);

        // 分析測試
        const testing = await this.analyzeTesting(projectPath, packageJson);

        return {
            name: packageJson.name || path.basename(projectPath),
            type: this.detectProjectType(projectPath, packageJson),
            description: packageJson.description || '',
            version: packageJson.version || '1.0.0',
            author: packageJson.author || '',
            license: packageJson.license || 'MIT',
            repository: packageJson.repository?.url,
            homepage: packageJson.homepage,
            keywords: packageJson.keywords || [],
            dependencies,
            scripts,
            features,
            structure,
            installation: await this.generateInstallationInfo(projectPath, packageJson),
            usage: await this.generateUsageInfo(projectPath, packageJson),
            api,
            testing,
            deployment: await this.generateDeploymentInfo(projectPath, packageJson),
            contributing: await this.generateContributingInfo(projectPath)
        };
    }

    /**
     * 分析項目結構
     */
    private async analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
        const directories: DirectoryInfo[] = [];
        const importantFiles: FileInfo[] = [];

        try {
            const items = await fs.promises.readdir(projectPath, { withFileTypes: true });

            for (const item of items) {
                if (item.isDirectory() && !this.shouldIgnoreDirectory(item.name)) {
                    const dirPath = path.join(projectPath, item.name);
                    const files = await this.countFiles(dirPath);

                    directories.push({
                        name: item.name,
                        path: item.name,
                        purpose: this.getDirectoryPurpose(item.name),
                        fileCount: files,
                        importance: this.getDirectoryImportance(item.name)
                    });
                } else if (item.isFile() && this.isImportantFile(item.name)) {
                    importantFiles.push({
                        name: item.name,
                        path: item.name,
                        purpose: this.getFilePurpose(item.name),
                        type: this.getFileType(item.name)
                    });
                }
            }
        } catch (error) {
            console.error('分析項目結構失敗:', error);
        }

        return {
            directories: directories.sort((a, b) => {
                const importanceOrder = { high: 3, medium: 2, low: 1 };
                return importanceOrder[b.importance] - importanceOrder[a.importance];
            }),
            importantFiles,
            conventions: this.detectConventions(directories, importantFiles)
        };
    }

    /**
     * 分析依賴
     */
    private async analyzeDependencies(packageJson: any): Promise<DependencyInfo[]> {
        const dependencies: DependencyInfo[] = [];

        const depTypes = [
            { deps: packageJson.dependencies, type: 'production' as const },
            { deps: packageJson.devDependencies, type: 'development' as const },
            { deps: packageJson.peerDependencies, type: 'peer' as const },
            { deps: packageJson.optionalDependencies, type: 'optional' as const }
        ];

        for (const { deps, type } of depTypes) {
            if (deps) {
                for (const [name, version] of Object.entries(deps)) {
                    dependencies.push({
                        name,
                        version: version as string,
                        type,
                        description: await this.getDependencyDescription(name),
                        purpose: this.guessDependencyPurpose(name, type)
                    });
                }
            }
        }

        return dependencies;
    }

    /**
     * 分析腳本
     */
    private async analyzeScripts(packageJson: any): Promise<ScriptInfo[]> {
        const scripts: ScriptInfo[] = [];

        if (packageJson.scripts) {
            for (const [name, command] of Object.entries(packageJson.scripts)) {
                scripts.push({
                    name,
                    command: command as string,
                    description: this.generateScriptDescription(name, command as string),
                    category: this.categorizeScript(name)
                });
            }
        }

        return scripts;
    }

    /**
     * 生成內容
     */
    private async generateContent(analysis: ProjectAnalysis, template: READMETemplate): Promise<string> {
        let content = '';

        // 生成標題
        content += this.generateTitle(analysis, template);

        // 生成徽章
        if (template.includeBadges) {
            content += this.generateBadges(analysis);
        }

        // 生成目錄
        if (template.includeTableOfContents) {
            content += this.generateTableOfContents(template.sections);
        }

        // 生成各個部分
        for (const section of template.sections.sort((a, b) => a.order - b.order)) {
            content += await this.generateSection(section, analysis, template);
        }

        return content;
    }

    /**
     * 生成標題
     */
    private generateTitle(analysis: ProjectAnalysis, template: READMETemplate): string {
        const emoji = template.includeEmojis ? this.getProjectEmoji(analysis.type) : '';
        return `# ${emoji} ${analysis.name}\n\n${analysis.description}\n\n`;
    }

    /**
     * 生成徽章
     */
    private generateBadges(analysis: ProjectAnalysis): string {
        const badges: string[] = [];

        // 版本徽章
        if (analysis.version) {
            badges.push(`![Version](https://img.shields.io/badge/version-${analysis.version}-blue.svg)`);
        }

        // 許可證徽章
        if (analysis.license) {
            badges.push(`![License](https://img.shields.io/badge/license-${analysis.license}-green.svg)`);
        }

        // Node.js 版本徽章
        const nodeDep = analysis.dependencies.find(d => d.name === 'node');
        if (nodeDep) {
            badges.push(`![Node](https://img.shields.io/badge/node-${nodeDep.version}-brightgreen.svg)`);
        }

        return badges.length > 0 ? badges.join(' ') + '\n\n' : '';
    }

    /**
     * 初始化模板
     */
    private initializeTemplates(): void {
        // 標準模板
        this.templates.set('standard', {
            sections: [
                { name: 'description', title: '描述', content: '', order: 1, required: true, template: 'description' },
                { name: 'features', title: '功能特性', content: '', order: 2, required: true, template: 'features' },
                { name: 'installation', title: '安裝', content: '', order: 3, required: true, template: 'installation' },
                { name: 'usage', title: '使用方法', content: '', order: 4, required: true, template: 'usage' },
                { name: 'api', title: 'API 文檔', content: '', order: 5, required: false, template: 'api' },
                { name: 'contributing', title: '貢獻指南', content: '', order: 6, required: false, template: 'contributing' },
                { name: 'license', title: '許可證', content: '', order: 7, required: true, template: 'license' }
            ],
            style: 'standard',
            language: 'auto',
            includeEmojis: true,
            includeBadges: true,
            includeTableOfContents: true
        });
    }

    /**
     * 輔助方法
     */
    private selectTemplate(analysis: ProjectAnalysis, options?: any): READMETemplate {
        const style = options?.style || 'standard';
        return this.templates.get(style) || this.templates.get('standard')!;
    }

    private detectProjectType(projectPath: string, packageJson: any): string {
        if (packageJson.engines?.vscode) {return 'vscode-extension';}
        if (packageJson.dependencies?.react) {return 'react';}
        if (packageJson.dependencies?.vue) {return 'vue';}
        if (packageJson.dependencies?.angular) {return 'angular';}
        if (packageJson.dependencies?.express) {return 'express';}
        return 'nodejs';
    }

    private shouldIgnoreDirectory(name: string): boolean {
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', '.idea'];
        return ignoreDirs.includes(name) || name.startsWith('.');
    }

    private async countFiles(dirPath: string): Promise<number> {
        try {
            const items = await fs.promises.readdir(dirPath);
            return items.length;
        } catch {
            return 0;
        }
    }

    private getDirectoryPurpose(name: string): string {
        const purposes: { [key: string]: string } = {
            'src': '源代碼',
            'lib': '庫文件',
            'test': '測試文件',
            'tests': '測試文件',
            'docs': '文檔',
            'examples': '示例代碼',
            'scripts': '腳本文件',
            'config': '配置文件',
            'public': '公共資源',
            'assets': '資源文件',
            'components': '組件',
            'utils': '工具函數',
            'types': '類型定義'
        };
        return purposes[name] || '其他文件';
    }

    private getDirectoryImportance(name: string): 'high' | 'medium' | 'low' {
        const highImportance = ['src', 'lib', 'components'];
        const mediumImportance = ['test', 'tests', 'docs', 'examples'];

        if (highImportance.includes(name)) {return 'high';}
        if (mediumImportance.includes(name)) {return 'medium';}
        return 'low';
    }

    private isImportantFile(name: string): boolean {
        const importantFiles = [
            'package.json', 'README.md', 'LICENSE', 'CHANGELOG.md',
            'tsconfig.json', '.gitignore', 'webpack.config.js',
            'babel.config.js', 'jest.config.js', 'eslint.config.js'
        ];
        return importantFiles.includes(name);
    }

    private getFilePurpose(name: string): string {
        const purposes: { [key: string]: string } = {
            'package.json': '項目配置和依賴管理',
            'README.md': '項目說明文檔',
            'LICENSE': '許可證文件',
            'CHANGELOG.md': '變更日誌',
            'tsconfig.json': 'TypeScript 配置',
            '.gitignore': 'Git 忽略規則',
            'webpack.config.js': 'Webpack 構建配置',
            'babel.config.js': 'Babel 轉譯配置',
            'jest.config.js': 'Jest 測試配置',
            'eslint.config.js': 'ESLint 代碼檢查配置'
        };
        return purposes[name] || '配置文件';
    }

    private getFileType(name: string): FileInfo['type'] {
        if (name.endsWith('.md')) {return 'doc';}
        if (name.endsWith('.json') || name.endsWith('.js') || name.endsWith('.ts')) {return 'config';}
        if (name.includes('test') || name.includes('spec')) {return 'test';}
        return 'other';
    }

    private detectConventions(directories: DirectoryInfo[], files: FileInfo[]): string[] {
        const conventions: string[] = [];

        if (directories.some(d => d.name === 'src')) {
            conventions.push('使用 src/ 目錄存放源代碼');
        }

        if (files.some(f => f.name === 'tsconfig.json')) {
            conventions.push('使用 TypeScript 開發');
        }

        if (files.some(f => f.name.includes('jest'))) {
            conventions.push('使用 Jest 進行測試');
        }

        return conventions;
    }

    private async getDependencyDescription(name: string): Promise<string | undefined> {
        // 這裡可以從 npm registry 獲取包的描述
        return undefined;
    }

    private guessDependencyPurpose(name: string, type: string): string | undefined {
        const purposes: { [key: string]: string } = {
            'react': '用戶界面庫',
            'express': 'Web 應用框架',
            'lodash': '實用工具庫',
            'axios': 'HTTP 客戶端',
            'jest': '測試框架',
            'webpack': '模組打包工具',
            'babel': 'JavaScript 編譯器',
            'eslint': '代碼檢查工具',
            'typescript': 'TypeScript 編譯器'
        };
        return purposes[name];
    }

    private generateScriptDescription(name: string, command: string): string {
        const descriptions: { [key: string]: string } = {
            'start': '啟動應用程序',
            'build': '構建生產版本',
            'test': '運行測試',
            'dev': '啟動開發服務器',
            'lint': '檢查代碼質量',
            'format': '格式化代碼'
        };
        return descriptions[name] || `執行 ${command}`;
    }

    private categorizeScript(name: string): ScriptInfo['category'] {
        if (name.includes('build')) {return 'build';}
        if (name.includes('test')) {return 'test';}
        if (name.includes('dev') || name.includes('start')) {return 'dev';}
        if (name.includes('deploy')) {return 'deploy';}
        if (name.includes('lint') || name.includes('format')) {return 'lint';}
        return 'other';
    }

    private getProjectEmoji(type: string): string {
        const emojis: { [key: string]: string } = {
            'vscode-extension': '🔧',
            'react': '⚛️',
            'vue': '💚',
            'angular': '🅰️',
            'express': '🚀',
            'nodejs': '📦'
        };
        return emojis[type] || '📁';
    }

    private generateTableOfContents(sections: READMESection[]): string {
        let toc = '## 目錄\n\n';
        for (const section of sections.sort((a, b) => a.order - b.order)) {
            toc += `- [${section.title}](#${section.title.toLowerCase().replace(/\s+/g, '-')})\n`;
        }
        return toc + '\n';
    }

    private async generateSection(section: READMESection, analysis: ProjectAnalysis, template: READMETemplate): Promise<string> {
        // 根據 section.template 生成對應的內容
        // 這裡是簡化實作
        return `## ${section.title}\n\n${section.content || '待完善...'}\n\n`;
    }

    // 其他生成方法的佔位符
    private async analyzeFeatures(projectPath: string, packageJson: any): Promise<FeatureInfo[]> { return []; }
    private async analyzeAPI(projectPath: string): Promise<APIInfo[]> { return []; }
    private async analyzeTesting(projectPath: string, packageJson: any): Promise<TestingInfo> {
        return { framework: 'jest', coverage: 0, commands: [], structure: '', guidelines: [] };
    }
    private async generateInstallationInfo(projectPath: string, packageJson: any): Promise<InstallationInfo> {
        return { prerequisites: [], steps: [], troubleshooting: [] };
    }
    private async generateUsageInfo(projectPath: string, packageJson: any): Promise<UsageInfo> {
        return { quickStart: { steps: [], code: '' }, examples: [], configuration: [] };
    }
    private async generateDeploymentInfo(projectPath: string, packageJson: any): Promise<DeploymentInfo> {
        return { platforms: [], requirements: [], steps: [], environments: [] };
    }
    private async generateContributingInfo(projectPath: string): Promise<ContributingInfo> {
        return { guidelines: [], codeStyle: '', pullRequestProcess: [], issueTemplate: '', developmentSetup: [] };
    }
}
