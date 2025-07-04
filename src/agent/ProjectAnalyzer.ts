import * as vscode from 'vscode';
import * as path from 'path';

export interface ProjectStructure {
    rootPath: string;
    directories: DirectoryInfo[];
    files: FileInfo[];
    dependencies: DependencyInfo[];
    patterns: CodingPattern[];
    metrics: ProjectMetrics;
}

export interface DirectoryInfo {
    path: string;
    name: string;
    type: 'source' | 'test' | 'config' | 'docs' | 'assets' | 'build' | 'other';
    fileCount: number;
    subdirectories: string[];
}

export interface FileInfo {
    path: string;
    name: string;
    extension: string;
    language: string;
    size: number;
    lines: number;
    type: 'source' | 'test' | 'config' | 'docs' | 'asset';
    lastModified: string;
}

export interface DependencyInfo {
    name: string;
    version?: string;
    type: 'production' | 'development' | 'peer' | 'optional';
    source: 'package.json' | 'requirements.txt' | 'pom.xml' | 'Cargo.toml' | 'other';
}

export interface CodingPattern {
    type: 'architecture' | 'naming' | 'structure' | 'style';
    pattern: string;
    description: string;
    examples: string[];
    confidence: number; // 0-1
    files: string[];
}

export interface ProjectMetrics {
    totalFiles: number;
    totalLines: number;
    totalSize: number;
    languageDistribution: { [language: string]: number };
    fileTypeDistribution: { [type: string]: number };
    averageFileSize: number;
    averageLinesPerFile: number;
    testCoverage?: number;
    complexity?: number;
}

export class ProjectAnalyzer {
    private workspaceRoot: string;
    private analysisCache: Map<string, any> = new Map();

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        this.workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
    }

    async analyzeProject(): Promise<ProjectStructure> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        const [directories, files, dependencies] = await Promise.all([
            this.analyzeDirectories(),
            this.analyzeFiles(),
            this.analyzeDependencies()
        ]);

        const patterns = await this.identifyCodingPatterns(files);
        const metrics = this.calculateMetrics(files);

        return {
            rootPath: this.workspaceRoot,
            directories,
            files,
            dependencies,
            patterns,
            metrics
        };
    }

    private async analyzeDirectories(): Promise<DirectoryInfo[]> {
        const directories: DirectoryInfo[] = [];
        const excludePatterns = ['node_modules', '.git', 'dist', 'build', '.vscode'];

        const scanDirectory = async (dirPath: string): Promise<void> => {
            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

                for (const [name, type] of entries) {
                    if (type === vscode.FileType.Directory && !excludePatterns.includes(name)) {
                        const fullPath = path.join(dirPath, name);
                        const relativePath = path.relative(this.workspaceRoot, fullPath);

                        const dirInfo: DirectoryInfo = {
                            path: relativePath,
                            name,
                            type: this.classifyDirectory(name, relativePath),
                            fileCount: 0,
                            subdirectories: []
                        };

                        // Count files and subdirectories
                        const subEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(fullPath));
                        for (const [subName, subType] of subEntries) {
                            if (subType === vscode.FileType.File) {
                                dirInfo.fileCount++;
                            } else if (subType === vscode.FileType.Directory) {
                                dirInfo.subdirectories.push(subName);
                            }
                        }

                        directories.push(dirInfo);

                        // Recursively scan subdirectories (limit depth)
                        if (relativePath.split(path.sep).length < 4) {
                            await scanDirectory(fullPath);
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to scan directory ${dirPath}:`, error);
            }
        };

        await scanDirectory(this.workspaceRoot);
        return directories;
    }

    private classifyDirectory(name: string, relativePath: string): DirectoryInfo['type'] {
        const lowerName = name.toLowerCase();
        const lowerPath = relativePath.toLowerCase();

        if (lowerName.includes('test') || lowerName.includes('spec') || lowerName.includes('__test__')) {
            return 'test';
        }
        if (lowerName.includes('config') || lowerName.includes('settings') || lowerName === '.vscode') {
            return 'config';
        }
        if (lowerName.includes('doc') || lowerName === 'docs' || lowerName === 'documentation') {
            return 'docs';
        }
        if (lowerName.includes('asset') || lowerName.includes('static') || lowerName.includes('public')) {
            return 'assets';
        }
        if (lowerName.includes('build') || lowerName.includes('dist') || lowerName.includes('out')) {
            return 'build';
        }
        if (lowerName.includes('src') || lowerName.includes('source') || lowerName.includes('lib')) {
            return 'source';
        }
        return 'other';
    }

    private async analyzeFiles(): Promise<FileInfo[]> {
        const files: FileInfo[] = [];
        const fileUris = await vscode.workspace.findFiles(
            '**/*',
            '{node_modules,dist,build,.git}/**',
            1000
        );

        for (const uri of fileUris) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                const relativePath = path.relative(this.workspaceRoot, uri.fsPath);
                const extension = path.extname(uri.fsPath);
                const name = path.basename(uri.fsPath);

                let lines = 0;
                let language = '';

                // For text files, count lines and determine language
                if (this.isTextFile(extension)) {
                    try {
                        const document = await vscode.workspace.openTextDocument(uri);
                        lines = document.lineCount;
                        language = document.languageId;
                    } catch {
                        // File might be binary or inaccessible
                    }
                }

                const fileInfo: FileInfo = {
                    path: relativePath,
                    name,
                    extension,
                    language,
                    size: stat.size,
                    lines,
                    type: this.classifyFile(name, extension),
                    lastModified: new Date(stat.mtime).toISOString()
                };

                files.push(fileInfo);
            } catch (error) {
                console.warn(`Failed to analyze file ${uri.fsPath}:`, error);
            }
        }

        return files;
    }

    private isTextFile(extension: string): boolean {
        const textExtensions = [
            '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.h',
            '.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml',
            '.md', '.txt', '.sql', '.sh', '.bat', '.ps1', '.php', '.rb', '.go',
            '.rs', '.kt', '.swift', '.dart', '.vue', '.svelte'
        ];
        return textExtensions.includes(extension.toLowerCase());
    }

    private classifyFile(name: string, extension: string): FileInfo['type'] {
        const lowerName = name.toLowerCase();
        const lowerExt = extension.toLowerCase();

        if (lowerName.includes('test') || lowerName.includes('spec') || lowerExt === '.test.js') {
            return 'test';
        }
        if (lowerName.includes('config') || lowerName.includes('setting') ||
            ['.json', '.yaml', '.yml', '.toml', '.ini'].includes(lowerExt)) {
            return 'config';
        }
        if (['.md', '.txt', '.rst', '.adoc'].includes(lowerExt)) {
            return 'docs';
        }
        if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.css', '.scss'].includes(lowerExt)) {
            return 'asset';
        }
        return 'source';
    }

    private async analyzeDependencies(): Promise<DependencyInfo[]> {
        const dependencies: DependencyInfo[] = [];

        // Analyze package.json
        await this.analyzePackageJson(dependencies);

        // Analyze requirements.txt
        await this.analyzeRequirementsTxt(dependencies);

        // Analyze other dependency files
        await this.analyzeOtherDependencyFiles(dependencies);

        return dependencies;
    }

    private async analyzePackageJson(dependencies: DependencyInfo[]): Promise<void> {
        try {
            const packageJsonUri = vscode.Uri.file(path.join(this.workspaceRoot, 'package.json'));
            const content = await vscode.workspace.fs.readFile(packageJsonUri);
            const packageJson = JSON.parse(Buffer.from(content).toString('utf8'));

            const addDeps = (deps: any, type: DependencyInfo['type']) => {
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
            };

            addDeps(packageJson.dependencies, 'production');
            addDeps(packageJson.devDependencies, 'development');
            addDeps(packageJson.peerDependencies, 'peer');
            addDeps(packageJson.optionalDependencies, 'optional');

        } catch (error) {
            // package.json doesn't exist or is invalid
        }
    }

    private async analyzeRequirementsTxt(dependencies: DependencyInfo[]): Promise<void> {
        try {
            const reqUri = vscode.Uri.file(path.join(this.workspaceRoot, 'requirements.txt'));
            const content = await vscode.workspace.fs.readFile(reqUri);
            const lines = Buffer.from(content).toString('utf8').split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const match = trimmed.match(/^([^>=<!\s]+)([>=<!\s].*)?$/);
                    if (match) {
                        dependencies.push({
                            name: match[1],
                            version: match[2]?.trim(),
                            type: 'production',
                            source: 'requirements.txt'
                        });
                    }
                }
            }
        } catch (error) {
            // requirements.txt doesn't exist
        }
    }

    private async analyzeOtherDependencyFiles(dependencies: DependencyInfo[]): Promise<void> {
        // Could add support for Cargo.toml, pom.xml, etc.
    }

    private async identifyCodingPatterns(files: FileInfo[]): Promise<CodingPattern[]> {
        const patterns: CodingPattern[] = [];

        // Analyze naming patterns
        patterns.push(...this.analyzeNamingPatterns(files));

        // Analyze architectural patterns
        patterns.push(...await this.analyzeArchitecturalPatterns(files));

        // Analyze code structure patterns
        patterns.push(...await this.analyzeStructurePatterns(files));

        return patterns;
    }

    private analyzeNamingPatterns(files: FileInfo[]): CodingPattern[] {
        const patterns: CodingPattern[] = [];
        const sourceFiles = files.filter(f => f.type === 'source');

        // Analyze file naming conventions
        const camelCaseFiles = sourceFiles.filter(f => /^[a-z][a-zA-Z0-9]*\.[a-z]+$/.test(f.name));
        const pascalCaseFiles = sourceFiles.filter(f => /^[A-Z][a-zA-Z0-9]*\.[a-z]+$/.test(f.name));
        const kebabCaseFiles = sourceFiles.filter(f => /^[a-z][a-z0-9-]*\.[a-z]+$/.test(f.name));

        if (camelCaseFiles.length > sourceFiles.length * 0.6) {
            patterns.push({
                type: 'naming',
                pattern: 'camelCase',
                description: 'Files use camelCase naming convention',
                examples: camelCaseFiles.slice(0, 3).map(f => f.name),
                confidence: camelCaseFiles.length / sourceFiles.length,
                files: camelCaseFiles.map(f => f.path)
            });
        }

        if (pascalCaseFiles.length > sourceFiles.length * 0.6) {
            patterns.push({
                type: 'naming',
                pattern: 'PascalCase',
                description: 'Files use PascalCase naming convention',
                examples: pascalCaseFiles.slice(0, 3).map(f => f.name),
                confidence: pascalCaseFiles.length / sourceFiles.length,
                files: pascalCaseFiles.map(f => f.path)
            });
        }

        return patterns;
    }

    private async analyzeArchitecturalPatterns(files: FileInfo[]): Promise<CodingPattern[]> {
        const patterns: CodingPattern[] = [];

        // Check for common architectural patterns
        const hasControllers = files.some(f => f.name.toLowerCase().includes('controller'));
        const hasServices = files.some(f => f.name.toLowerCase().includes('service'));
        const hasModels = files.some(f => f.name.toLowerCase().includes('model'));
        const hasViews = files.some(f => f.name.toLowerCase().includes('view') || f.name.toLowerCase().includes('component'));

        if (hasControllers && hasServices && hasModels) {
            patterns.push({
                type: 'architecture',
                pattern: 'MVC',
                description: 'Model-View-Controller architecture pattern detected',
                examples: [
                    files.find(f => f.name.toLowerCase().includes('controller'))?.name || '',
                    files.find(f => f.name.toLowerCase().includes('service'))?.name || '',
                    files.find(f => f.name.toLowerCase().includes('model'))?.name || ''
                ].filter(Boolean),
                confidence: 0.8,
                files: files.filter(f =>
                    f.name.toLowerCase().includes('controller') ||
                    f.name.toLowerCase().includes('service') ||
                    f.name.toLowerCase().includes('model')
                ).map(f => f.path)
            });
        }

        return patterns;
    }

    private async analyzeStructurePatterns(files: FileInfo[]): Promise<CodingPattern[]> {
        const patterns: CodingPattern[] = [];

        // Analyze directory structure patterns
        const srcFiles = files.filter(f => f.path.includes('src/'));
        const testFiles = files.filter(f => f.type === 'test');

        if (srcFiles.length > files.length * 0.5) {
            patterns.push({
                type: 'structure',
                pattern: 'src-directory',
                description: 'Source code organized in src/ directory',
                examples: srcFiles.slice(0, 3).map(f => f.path),
                confidence: srcFiles.length / files.length,
                files: srcFiles.map(f => f.path)
            });
        }

        if (testFiles.length > 0) {
            patterns.push({
                type: 'structure',
                pattern: 'test-organization',
                description: 'Dedicated test files present',
                examples: testFiles.slice(0, 3).map(f => f.path),
                confidence: Math.min(testFiles.length / (files.length * 0.2), 1),
                files: testFiles.map(f => f.path)
            });
        }

        return patterns;
    }

    private calculateMetrics(files: FileInfo[]): ProjectMetrics {
        const totalFiles = files.length;
        const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);

        const languageDistribution: { [language: string]: number } = {};
        const fileTypeDistribution: { [type: string]: number } = {};

        for (const file of files) {
            if (file.language) {
                languageDistribution[file.language] = (languageDistribution[file.language] || 0) + 1;
            }
            fileTypeDistribution[file.type] = (fileTypeDistribution[file.type] || 0) + 1;
        }

        return {
            totalFiles,
            totalLines,
            totalSize,
            languageDistribution,
            fileTypeDistribution,
            averageFileSize: totalFiles > 0 ? totalSize / totalFiles : 0,
            averageLinesPerFile: totalFiles > 0 ? totalLines / totalFiles : 0
        };
    }

    async generateDependencyGraph(): Promise<string> {
        const structure = await this.analyzeProject();

        // Generate a simple text-based dependency graph
        let graph = '# Project Dependency Graph\n\n';

        graph += '## Dependencies\n';
        for (const dep of structure.dependencies) {
            graph += `- ${dep.name} (${dep.type}): ${dep.version || 'latest'}\n`;
        }

        graph += '\n## File Structure\n';
        for (const dir of structure.directories) {
            graph += `- ${dir.path}/ (${dir.type}, ${dir.fileCount} files)\n`;
        }

        return graph;
    }
}
