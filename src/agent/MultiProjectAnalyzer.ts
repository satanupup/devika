import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ProjectInfo {
    name: string;
    path: string;
    type: ProjectType;
    language: string[];
    description: string;
    dependencies: string[];
    buildFiles: string[];
    sourceFiles: number;
    testFiles: number;
    configFiles: string[];
    readmeContent?: string;
    packageInfo?: any;
}

export enum ProjectType {
    ANDROID_APP = 'Android App',
    IOS_APP = 'iOS App',
    WEB_APP = 'Web App',
    LIBRARY = 'Library/SDK',
    BACKEND_API = 'Backend API',
    DESKTOP_APP = 'Desktop App',
    GAME = 'Game',
    DOCUMENTATION = 'Documentation',
    UNKNOWN = 'Unknown'
}

export interface MultiProjectStructure {
    workspaceName: string;
    workspacePath: string;
    totalProjects: number;
    projects: ProjectInfo[];
    sharedFiles: string[];
    summary: string;
}

export class MultiProjectAnalyzer {
    private workspaceRoot: string;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        this.workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
    }

    async analyzeWorkspace(): Promise<MultiProjectStructure> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        console.log('🔍 開始分析多項目工作區:', this.workspaceRoot);

        const projects = await this.detectProjects();
        const sharedFiles = await this.findSharedFiles();
        const summary = this.generateSummary(projects);

        return {
            workspaceName: path.basename(this.workspaceRoot),
            workspacePath: this.workspaceRoot,
            totalProjects: projects.length,
            projects,
            sharedFiles,
            summary
        };
    }

    private async detectProjects(): Promise<ProjectInfo[]> {
        const projects: ProjectInfo[] = [];
        const rootEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this.workspaceRoot));

        // 檢查根目錄是否本身就是一個項目
        const rootProject = await this.analyzeDirectory(this.workspaceRoot, path.basename(this.workspaceRoot));
        if (rootProject.type !== ProjectType.UNKNOWN) {
            projects.push(rootProject);
        }

        // 檢查子目錄
        for (const [name, type] of rootEntries) {
            if (type === vscode.FileType.Directory && !this.isIgnoredDirectory(name)) {
                const dirPath = path.join(this.workspaceRoot, name);
                const project = await this.analyzeDirectory(dirPath, name);
                
                if (project.type !== ProjectType.UNKNOWN || project.sourceFiles > 5) {
                    projects.push(project);
                }
            }
        }

        return projects;
    }

    private async analyzeDirectory(dirPath: string, name: string): Promise<ProjectInfo> {
        const project: ProjectInfo = {
            name,
            path: dirPath,
            type: ProjectType.UNKNOWN,
            language: [],
            description: '',
            dependencies: [],
            buildFiles: [],
            sourceFiles: 0,
            testFiles: 0,
            configFiles: []
        };

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            const files = entries.filter(([_, type]) => type === vscode.FileType.File).map(([name]) => name);
            
            // 分析項目類型和特徵
            await this.analyzeProjectType(project, files, dirPath);
            await this.analyzeLanguages(project, dirPath);
            await this.countFiles(project, dirPath);
            await this.readProjectInfo(project, dirPath);

        } catch (error) {
            console.error(`分析目錄失敗 ${dirPath}:`, error);
        }

        return project;
    }

    private async analyzeProjectType(project: ProjectInfo, files: string[], dirPath: string): Promise<void> {
        // Android 項目檢測
        if (files.includes('build.gradle') || files.includes('build.gradle.kts') || 
            files.includes('AndroidManifest.xml') || files.includes('gradle.properties')) {
            project.type = ProjectType.ANDROID_APP;
            project.buildFiles.push(...files.filter(f => f.includes('gradle') || f.includes('manifest')));
        }
        
        // iOS 項目檢測
        else if (files.some(f => f.endsWith('.xcodeproj')) || files.includes('Podfile') || 
                 files.includes('Package.swift')) {
            project.type = ProjectType.IOS_APP;
            project.buildFiles.push(...files.filter(f => f.includes('Podfile') || f.includes('Package.swift')));
        }
        
        // Web 項目檢測
        else if (files.includes('package.json')) {
            const packagePath = path.join(dirPath, 'package.json');
            try {
                const packageContent = await fs.promises.readFile(packagePath, 'utf8');
                const packageJson = JSON.parse(packageContent);
                project.packageInfo = packageJson;
                
                if (packageJson.dependencies?.react || packageJson.dependencies?.vue || 
                    packageJson.dependencies?.angular) {
                    project.type = ProjectType.WEB_APP;
                } else if (packageJson.dependencies?.express || packageJson.dependencies?.fastify) {
                    project.type = ProjectType.BACKEND_API;
                } else {
                    project.type = ProjectType.LIBRARY;
                }
                
                project.description = packageJson.description || '';
                project.dependencies = Object.keys(packageJson.dependencies || {});
            } catch (error) {
                console.error('讀取 package.json 失敗:', error);
            }
        }
        
        // Python 項目檢測
        else if (files.includes('requirements.txt') || files.includes('setup.py') || 
                 files.includes('pyproject.toml') || files.includes('Pipfile')) {
            project.type = this.detectPythonProjectType(files);
            project.buildFiles.push(...files.filter(f => 
                ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'].includes(f)));
        }
        
        // Java 項目檢測
        else if (files.includes('pom.xml') || files.includes('build.gradle')) {
            project.type = ProjectType.BACKEND_API;
            project.buildFiles.push(...files.filter(f => f.includes('pom.xml') || f.includes('gradle')));
        }
        
        // 文檔項目檢測
        else if (files.some(f => f.toLowerCase().includes('readme')) || 
                 files.some(f => f.endsWith('.md')) && files.length < 10) {
            project.type = ProjectType.DOCUMENTATION;
        }

        // 配置文件檢測
        project.configFiles = files.filter(f => 
            f.endsWith('.json') || f.endsWith('.yml') || f.endsWith('.yaml') || 
            f.endsWith('.toml') || f.endsWith('.ini') || f.endsWith('.conf')
        );
    }

    private detectPythonProjectType(files: string[]): ProjectType {
        if (files.includes('manage.py') || files.includes('wsgi.py')) {
            return ProjectType.WEB_APP;
        }
        if (files.includes('setup.py') || files.includes('pyproject.toml')) {
            return ProjectType.LIBRARY;
        }
        return ProjectType.BACKEND_API;
    }

    private async analyzeLanguages(project: ProjectInfo, dirPath: string): Promise<void> {
        const languageMap: { [key: string]: string } = {
            '.ts': 'TypeScript',
            '.js': 'JavaScript',
            '.py': 'Python',
            '.java': 'Java',
            '.kt': 'Kotlin',
            '.swift': 'Swift',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.go': 'Go',
            '.rs': 'Rust',
            '.php': 'PHP',
            '.rb': 'Ruby'
        };

        const languageCount: { [key: string]: number } = {};

        const scanForLanguages = async (currentPath: string, depth: number = 0): Promise<void> => {
            if (depth > 3) return; // 限制掃描深度

            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(currentPath));
                
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.File) {
                        const ext = path.extname(name);
                        if (languageMap[ext]) {
                            languageCount[languageMap[ext]] = (languageCount[languageMap[ext]] || 0) + 1;
                        }
                    } else if (type === vscode.FileType.Directory && !this.isIgnoredDirectory(name)) {
                        await scanForLanguages(path.join(currentPath, name), depth + 1);
                    }
                }
            } catch (error) {
                // 忽略權限錯誤
            }
        };

        await scanForLanguages(dirPath);

        // 按文件數量排序，取前3種語言
        project.language = Object.entries(languageCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([lang]) => lang);
    }

    private async countFiles(project: ProjectInfo, dirPath: string): Promise<void> {
        const countFiles = async (currentPath: string, depth: number = 0): Promise<void> => {
            if (depth > 3) return;

            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(currentPath));
                
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.File) {
                        const ext = path.extname(name);
                        const isSourceFile = ['.ts', '.js', '.py', '.java', '.kt', '.swift', '.cpp', '.c'].includes(ext);
                        const isTestFile = name.includes('test') || name.includes('spec') || currentPath.includes('test');
                        
                        if (isSourceFile) {
                            if (isTestFile) {
                                project.testFiles++;
                            } else {
                                project.sourceFiles++;
                            }
                        }
                    } else if (type === vscode.FileType.Directory && !this.isIgnoredDirectory(name)) {
                        await countFiles(path.join(currentPath, name), depth + 1);
                    }
                }
            } catch (error) {
                // 忽略權限錯誤
            }
        };

        await countFiles(dirPath);
    }

    private async readProjectInfo(project: ProjectInfo, dirPath: string): Promise<void> {
        // 讀取 README 文件
        const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'README'];
        for (const readmeFile of readmeFiles) {
            try {
                const readmePath = path.join(dirPath, readmeFile);
                const content = await fs.promises.readFile(readmePath, 'utf8');
                project.readmeContent = content.substring(0, 500); // 只取前500字符
                
                // 從 README 中提取描述
                if (!project.description) {
                    const lines = content.split('\n');
                    for (const line of lines) {
                        if (line.trim() && !line.startsWith('#') && line.length > 10) {
                            project.description = line.trim().substring(0, 200);
                            break;
                        }
                    }
                }
                break;
            } catch (error) {
                // 文件不存在，繼續嘗試下一個
            }
        }
    }

    private async findSharedFiles(): Promise<string[]> {
        const sharedFiles: string[] = [];
        const rootFiles = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this.workspaceRoot));
        
        for (const [name, type] of rootFiles) {
            if (type === vscode.FileType.File) {
                const isSharedFile = name.toLowerCase().includes('readme') || 
                                   name.includes('LICENSE') || 
                                   name.includes('.gitignore') ||
                                   name.includes('docker') ||
                                   name.includes('makefile');
                if (isSharedFile) {
                    sharedFiles.push(name);
                }
            }
        }
        
        return sharedFiles;
    }

    private generateSummary(projects: ProjectInfo[]): string {
        if (projects.length === 0) {
            return '未檢測到任何項目結構';
        }

        const typeCount: { [key: string]: number } = {};
        const languages = new Set<string>();

        projects.forEach(project => {
            typeCount[project.type] = (typeCount[project.type] || 0) + 1;
            project.language.forEach(lang => languages.add(lang));
        });

        let summary = `檢測到 ${projects.length} 個項目：\n`;
        
        Object.entries(typeCount).forEach(([type, count]) => {
            summary += `• ${count} 個 ${type}\n`;
        });

        if (languages.size > 0) {
            summary += `\n主要使用語言：${Array.from(languages).join(', ')}`;
        }

        return summary;
    }

    private isIgnoredDirectory(name: string): boolean {
        const ignoredDirs = [
            'node_modules', '.git', 'dist', 'build', '.vscode', '.idea',
            '__pycache__', '.pytest_cache', 'venv', '.env', 'target',
            'bin', 'obj', '.gradle', '.next', '.nuxt'
        ];
        return ignoredDirs.includes(name) || name.startsWith('.');
    }
}
