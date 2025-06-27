import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ProjectInfo {
    name: string;
    type: ProjectType;
    rootPath: string;
    configFiles: string[];
    dependencies: ProjectDependency[];
    scripts: { [key: string]: string };
    metadata: ProjectMetadata;
    subProjects: ProjectInfo[];
    health: ProjectHealth;
}

export interface ProjectDependency {
    name: string;
    version: string;
    type: 'production' | 'development' | 'peer' | 'optional';
    source: string; // package.json, requirements.txt, etc.
    vulnerabilities?: SecurityVulnerability[];
}

export interface ProjectMetadata {
    version: string;
    description: string;
    author: string;
    license: string;
    repository?: string;
    homepage?: string;
    keywords: string[];
    lastModified: Date;
    size: number;
    fileCount: number;
    lineCount: number;
}

export interface ProjectHealth {
    score: number; // 0-100
    issues: HealthIssue[];
    recommendations: string[];
    lastAnalyzed: Date;
}

export interface HealthIssue {
    type: 'error' | 'warning' | 'info';
    category: 'security' | 'performance' | 'maintainability' | 'compatibility';
    message: string;
    file?: string;
    line?: number;
    severity: number; // 1-10
}

export interface SecurityVulnerability {
    id: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
    description: string;
    affectedVersions: string;
    patchedVersions?: string;
    references: string[];
}

export enum ProjectType {
    NodeJS = 'nodejs',
    Python = 'python',
    Java = 'java',
    CSharp = 'csharp',
    Go = 'go',
    Rust = 'rust',
    PHP = 'php',
    Ruby = 'ruby',
    Swift = 'swift',
    Kotlin = 'kotlin',
    Dart = 'dart',
    React = 'react',
    Vue = 'vue',
    Angular = 'angular',
    Flutter = 'flutter',
    ReactNative = 'react-native',
    Electron = 'electron',
    VSCodeExtension = 'vscode-extension',
    Unknown = 'unknown'
}

export class EnhancedMultiProjectAnalyzer {
    private projectCache: Map<string, ProjectInfo> = new Map();
    private analysisInProgress: Set<string> = new Set();

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * 分析工作區中的所有項目
     */
    async analyzeWorkspace(): Promise<ProjectInfo[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const projects: ProjectInfo[] = [];

        for (const folder of workspaceFolders) {
            const projectInfo = await this.analyzeProject(folder.uri.fsPath);
            if (projectInfo) {
                projects.push(projectInfo);
            }
        }

        return projects;
    }

    /**
     * 分析單個項目
     */
    async analyzeProject(rootPath: string): Promise<ProjectInfo | null> {
        // 檢查緩存
        const cached = this.projectCache.get(rootPath);
        if (cached && this.isCacheValid(cached)) {
            return cached;
        }

        // 防止重複分析
        if (this.analysisInProgress.has(rootPath)) {
            return null;
        }

        this.analysisInProgress.add(rootPath);

        try {
            const projectInfo = await this.performProjectAnalysis(rootPath);
            
            if (projectInfo) {
                this.projectCache.set(rootPath, projectInfo);
            }

            return projectInfo;

        } finally {
            this.analysisInProgress.delete(rootPath);
        }
    }

    /**
     * 執行項目分析
     */
    private async performProjectAnalysis(rootPath: string): Promise<ProjectInfo | null> {
        try {
            // 檢測項目類型
            const projectType = await this.detectProjectType(rootPath);
            if (projectType === ProjectType.Unknown) {
                return null;
            }

            // 獲取項目名稱
            const projectName = path.basename(rootPath);

            // 分析配置文件
            const configFiles = await this.findConfigFiles(rootPath, projectType);

            // 分析依賴
            const dependencies = await this.analyzeDependencies(rootPath, projectType);

            // 分析腳本
            const scripts = await this.analyzeScripts(rootPath, projectType);

            // 獲取項目元數據
            const metadata = await this.getProjectMetadata(rootPath, projectType);

            // 分析子項目
            const subProjects = await this.analyzeSubProjects(rootPath, projectType);

            // 健康檢查
            const health = await this.performHealthCheck(rootPath, projectType, dependencies);

            return {
                name: projectName,
                type: projectType,
                rootPath,
                configFiles,
                dependencies,
                scripts,
                metadata,
                subProjects,
                health
            };

        } catch (error) {
            console.error(`分析項目失敗: ${rootPath}`, error);
            return null;
        }
    }

    /**
     * 檢測項目類型
     */
    private async detectProjectType(rootPath: string): Promise<ProjectType> {
        const files = await this.getDirectoryFiles(rootPath);
        const fileSet = new Set(files.map(f => f.toLowerCase()));

        // 檢測順序很重要，從最具體到最一般
        if (fileSet.has('package.json')) {
            const packageJson = await this.readPackageJson(rootPath);
            
            // VS Code 擴展
            if (packageJson?.engines?.vscode) {
                return ProjectType.VSCodeExtension;
            }
            
            // Electron
            if (packageJson?.main && (
                packageJson.dependencies?.electron || 
                packageJson.devDependencies?.electron
            )) {
                return ProjectType.Electron;
            }

            // React Native
            if (packageJson?.dependencies?.['react-native'] || 
                packageJson?.devDependencies?.['react-native']) {
                return ProjectType.ReactNative;
            }

            // React
            if (packageJson?.dependencies?.react || 
                packageJson?.devDependencies?.react) {
                return ProjectType.React;
            }

            // Vue
            if (packageJson?.dependencies?.vue || 
                packageJson?.devDependencies?.vue) {
                return ProjectType.Vue;
            }

            // Angular
            if (packageJson?.dependencies?.['@angular/core'] || 
                packageJson?.devDependencies?.['@angular/core']) {
                return ProjectType.Angular;
            }

            return ProjectType.NodeJS;
        }

        // Python
        if (fileSet.has('requirements.txt') || 
            fileSet.has('setup.py') || 
            fileSet.has('pyproject.toml') ||
            fileSet.has('pipfile')) {
            return ProjectType.Python;
        }

        // Java
        if (fileSet.has('pom.xml') || 
            fileSet.has('build.gradle') || 
            fileSet.has('build.gradle.kts')) {
            return ProjectType.Java;
        }

        // C#
        if (files.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) {
            return ProjectType.CSharp;
        }

        // Go
        if (fileSet.has('go.mod') || fileSet.has('go.sum')) {
            return ProjectType.Go;
        }

        // Rust
        if (fileSet.has('cargo.toml')) {
            return ProjectType.Rust;
        }

        // PHP
        if (fileSet.has('composer.json')) {
            return ProjectType.PHP;
        }

        // Ruby
        if (fileSet.has('gemfile') || fileSet.has('gemfile.lock')) {
            return ProjectType.Ruby;
        }

        // Flutter/Dart
        if (fileSet.has('pubspec.yaml')) {
            const pubspec = await this.readYamlFile(path.join(rootPath, 'pubspec.yaml'));
            if (pubspec?.dependencies?.flutter) {
                return ProjectType.Flutter;
            }
            return ProjectType.Dart;
        }

        // Swift
        if (fileSet.has('package.swift') || 
            files.some(f => f.endsWith('.xcodeproj'))) {
            return ProjectType.Swift;
        }

        // Kotlin
        if (files.some(f => f.endsWith('.kt') || f.endsWith('.kts'))) {
            return ProjectType.Kotlin;
        }

        return ProjectType.Unknown;
    }

    /**
     * 查找配置文件
     */
    private async findConfigFiles(rootPath: string, projectType: ProjectType): Promise<string[]> {
        const configFiles: string[] = [];
        const commonConfigs = [
            '.gitignore', '.gitattributes', 'README.md', 'LICENSE',
            '.editorconfig', '.prettierrc', '.eslintrc.json'
        ];

        const typeSpecificConfigs: { [key in ProjectType]: string[] } = {
            [ProjectType.NodeJS]: ['package.json', 'package-lock.json', 'yarn.lock', 'tsconfig.json'],
            [ProjectType.Python]: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
            [ProjectType.Java]: ['pom.xml', 'build.gradle', 'gradle.properties'],
            [ProjectType.CSharp]: ['*.csproj', '*.sln', 'nuget.config'],
            [ProjectType.Go]: ['go.mod', 'go.sum'],
            [ProjectType.Rust]: ['Cargo.toml', 'Cargo.lock'],
            [ProjectType.PHP]: ['composer.json', 'composer.lock'],
            [ProjectType.Ruby]: ['Gemfile', 'Gemfile.lock'],
            [ProjectType.Swift]: ['Package.swift'],
            [ProjectType.Kotlin]: ['build.gradle.kts'],
            [ProjectType.Dart]: ['pubspec.yaml', 'pubspec.lock'],
            [ProjectType.React]: ['package.json', 'tsconfig.json', 'webpack.config.js'],
            [ProjectType.Vue]: ['package.json', 'vue.config.js'],
            [ProjectType.Angular]: ['package.json', 'angular.json', 'tsconfig.json'],
            [ProjectType.Flutter]: ['pubspec.yaml', 'analysis_options.yaml'],
            [ProjectType.ReactNative]: ['package.json', 'metro.config.js'],
            [ProjectType.Electron]: ['package.json', 'electron-builder.json'],
            [ProjectType.VSCodeExtension]: ['package.json', 'tsconfig.json', 'webpack.config.js'],
            [ProjectType.Unknown]: []
        };

        const allConfigs = [...commonConfigs, ...typeSpecificConfigs[projectType]];

        for (const config of allConfigs) {
            const configPath = path.join(rootPath, config);
            if (await this.fileExists(configPath)) {
                configFiles.push(config);
            }
        }

        return configFiles;
    }

    /**
     * 分析依賴
     */
    private async analyzeDependencies(rootPath: string, projectType: ProjectType): Promise<ProjectDependency[]> {
        const dependencies: ProjectDependency[] = [];

        switch (projectType) {
            case ProjectType.NodeJS:
            case ProjectType.React:
            case ProjectType.Vue:
            case ProjectType.Angular:
            case ProjectType.ReactNative:
            case ProjectType.Electron:
            case ProjectType.VSCodeExtension:
                const packageJson = await this.readPackageJson(rootPath);
                if (packageJson) {
                    dependencies.push(...this.parseNodeDependencies(packageJson));
                }
                break;

            case ProjectType.Python:
                dependencies.push(...await this.parsePythonDependencies(rootPath));
                break;

            case ProjectType.Java:
                dependencies.push(...await this.parseJavaDependencies(rootPath));
                break;

            case ProjectType.CSharp:
                dependencies.push(...await this.parseCSharpDependencies(rootPath));
                break;

            case ProjectType.Go:
                dependencies.push(...await this.parseGoDependencies(rootPath));
                break;

            case ProjectType.Rust:
                dependencies.push(...await this.parseRustDependencies(rootPath));
                break;

            case ProjectType.PHP:
                dependencies.push(...await this.parsePHPDependencies(rootPath));
                break;

            case ProjectType.Ruby:
                dependencies.push(...await this.parseRubyDependencies(rootPath));
                break;

            case ProjectType.Dart:
            case ProjectType.Flutter:
                dependencies.push(...await this.parseDartDependencies(rootPath));
                break;
        }

        return dependencies;
    }

    /**
     * 解析 Node.js 依賴
     */
    private parseNodeDependencies(packageJson: any): ProjectDependency[] {
        const dependencies: ProjectDependency[] = [];

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
                        source: 'package.json'
                    });
                }
            }
        }

        return dependencies;
    }

    /**
     * 分析腳本
     */
    private async analyzeScripts(rootPath: string, projectType: ProjectType): Promise<{ [key: string]: string }> {
        const scripts: { [key: string]: string } = {};

        switch (projectType) {
            case ProjectType.NodeJS:
            case ProjectType.React:
            case ProjectType.Vue:
            case ProjectType.Angular:
            case ProjectType.ReactNative:
            case ProjectType.Electron:
            case ProjectType.VSCodeExtension:
                const packageJson = await this.readPackageJson(rootPath);
                if (packageJson?.scripts) {
                    Object.assign(scripts, packageJson.scripts);
                }
                break;

            case ProjectType.Python:
                // 檢查 setup.py 或 pyproject.toml 中的腳本
                break;

            case ProjectType.Java:
                // 檢查 Maven 或 Gradle 任務
                break;
        }

        return scripts;
    }

    /**
     * 獲取項目元數據
     */
    private async getProjectMetadata(rootPath: string, projectType: ProjectType): Promise<ProjectMetadata> {
        const stats = await this.getDirectoryStats(rootPath);
        
        let metadata: Partial<ProjectMetadata> = {
            lastModified: stats.lastModified,
            size: stats.size,
            fileCount: stats.fileCount,
            lineCount: stats.lineCount
        };

        // 從配置文件中獲取元數據
        switch (projectType) {
            case ProjectType.NodeJS:
            case ProjectType.React:
            case ProjectType.Vue:
            case ProjectType.Angular:
            case ProjectType.ReactNative:
            case ProjectType.Electron:
            case ProjectType.VSCodeExtension:
                const packageJson = await this.readPackageJson(rootPath);
                if (packageJson) {
                    metadata = {
                        ...metadata,
                        version: packageJson.version || '0.0.0',
                        description: packageJson.description || '',
                        author: packageJson.author || '',
                        license: packageJson.license || '',
                        repository: packageJson.repository?.url || packageJson.repository,
                        homepage: packageJson.homepage,
                        keywords: packageJson.keywords || []
                    };
                }
                break;
        }

        return {
            version: metadata.version || '0.0.0',
            description: metadata.description || '',
            author: metadata.author || '',
            license: metadata.license || '',
            repository: metadata.repository,
            homepage: metadata.homepage,
            keywords: metadata.keywords || [],
            lastModified: metadata.lastModified!,
            size: metadata.size!,
            fileCount: metadata.fileCount!,
            lineCount: metadata.lineCount!
        };
    }

    /**
     * 分析子項目
     */
    private async analyzeSubProjects(rootPath: string, projectType: ProjectType): Promise<ProjectInfo[]> {
        const subProjects: ProjectInfo[] = [];

        // 查找可能的子項目目錄
        const subdirs = await this.getSubdirectories(rootPath);
        
        for (const subdir of subdirs) {
            // 跳過常見的非項目目錄
            if (this.shouldSkipDirectory(subdir)) {
                continue;
            }

            const subProjectPath = path.join(rootPath, subdir);
            const subProject = await this.analyzeProject(subProjectPath);
            
            if (subProject) {
                subProjects.push(subProject);
            }
        }

        return subProjects;
    }

    /**
     * 執行健康檢查
     */
    private async performHealthCheck(
        rootPath: string, 
        projectType: ProjectType, 
        dependencies: ProjectDependency[]
    ): Promise<ProjectHealth> {
        const issues: HealthIssue[] = [];
        const recommendations: string[] = [];

        // 檢查過時的依賴
        const outdatedDeps = await this.checkOutdatedDependencies(dependencies);
        issues.push(...outdatedDeps);

        // 檢查安全漏洞
        const securityIssues = await this.checkSecurityVulnerabilities(dependencies);
        issues.push(...securityIssues);

        // 檢查配置問題
        const configIssues = await this.checkConfigurationIssues(rootPath, projectType);
        issues.push(...configIssues);

        // 計算健康分數
        const score = this.calculateHealthScore(issues);

        // 生成建議
        if (score < 70) {
            recommendations.push('項目健康狀況需要改善');
        }
        if (issues.some(i => i.category === 'security')) {
            recommendations.push('建議修復安全漏洞');
        }
        if (issues.some(i => i.category === 'performance')) {
            recommendations.push('考慮性能優化');
        }

        return {
            score,
            issues,
            recommendations,
            lastAnalyzed: new Date()
        };
    }

    /**
     * 計算健康分數
     */
    private calculateHealthScore(issues: HealthIssue[]): number {
        let score = 100;

        for (const issue of issues) {
            const penalty = issue.severity * (issue.type === 'error' ? 3 : issue.type === 'warning' ? 2 : 1);
            score -= penalty;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * 輔助方法
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private async readPackageJson(rootPath: string): Promise<any> {
        try {
            const packagePath = path.join(rootPath, 'package.json');
            const content = await fs.promises.readFile(packagePath, 'utf8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    private async readYamlFile(filePath: string): Promise<any> {
        // 簡化的 YAML 讀取，實際應該使用 yaml 庫
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            // 這裡應該使用適當的 YAML 解析器
            return {};
        } catch {
            return null;
        }
    }

    private async getDirectoryFiles(dirPath: string): Promise<string[]> {
        try {
            return await fs.promises.readdir(dirPath);
        } catch {
            return [];
        }
    }

    private async getSubdirectories(dirPath: string): Promise<string[]> {
        try {
            const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return items.filter(item => item.isDirectory()).map(item => item.name);
        } catch {
            return [];
        }
    }

    private shouldSkipDirectory(dirname: string): boolean {
        const skipDirs = [
            'node_modules', '.git', '.vscode', 'dist', 'build', 'target',
            '__pycache__', '.pytest_cache', 'venv', 'env', '.env'
        ];
        return skipDirs.includes(dirname) || dirname.startsWith('.');
    }

    private async getDirectoryStats(dirPath: string): Promise<{
        lastModified: Date;
        size: number;
        fileCount: number;
        lineCount: number;
    }> {
        // 簡化實作，實際應該遞歸計算
        const stats = await fs.promises.stat(dirPath);
        return {
            lastModified: stats.mtime,
            size: stats.size,
            fileCount: 0,
            lineCount: 0
        };
    }

    private isCacheValid(projectInfo: ProjectInfo): boolean {
        const cacheAge = Date.now() - projectInfo.health.lastAnalyzed.getTime();
        return cacheAge < 30 * 60 * 1000; // 30 分鐘緩存
    }

    // 佔位符方法，需要實際實作
    private async parsePythonDependencies(rootPath: string): Promise<ProjectDependency[]> { return []; }
    private async parseJavaDependencies(rootPath: string): Promise<ProjectDependency[]> { return []; }
    private async parseCSharpDependencies(rootPath: string): Promise<ProjectDependency[]> { return []; }
    private async parseGoDependencies(rootPath: string): Promise<ProjectDependency[]> { return []; }
    private async parseRustDependencies(rootPath: string): Promise<ProjectDependency[]> { return []; }
    private async parsePHPDependencies(rootPath: string): Promise<ProjectDependency[]> { return []; }
    private async parseRubyDependencies(rootPath: string): Promise<ProjectDependency[]> { return []; }
    private async parseDartDependencies(rootPath: string): Promise<ProjectDependency[]> { return []; }
    private async checkOutdatedDependencies(deps: ProjectDependency[]): Promise<HealthIssue[]> { return []; }
    private async checkSecurityVulnerabilities(deps: ProjectDependency[]): Promise<HealthIssue[]> { return []; }
    private async checkConfigurationIssues(rootPath: string, type: ProjectType): Promise<HealthIssue[]> { return []; }
}
