import * as vscode from 'vscode';
import * as path from 'path';

export interface ContextInfo {
    workspace: WorkspaceContext;
    editor: EditorContext;
    selection: SelectionContext;
    git: GitContext;
    project: ProjectContext;
    environment: EnvironmentContext;
    timestamp: Date;
}

export interface WorkspaceContext {
    folders: WorkspaceFolder[];
    activeFolder?: WorkspaceFolder;
    totalFiles: number;
    totalSize: number;
    languages: string[];
    recentFiles: string[];
}

export interface WorkspaceFolder {
    name: string;
    path: string;
    uri: vscode.Uri;
    isRoot: boolean;
    fileCount: number;
    size: number;
}

export interface EditorContext {
    activeFile?: FileContext;
    openFiles: FileContext[];
    visibleEditors: number;
    activeGroup: number;
    totalGroups: number;
    layout: 'single' | 'split' | 'grid';
}

export interface FileContext {
    path: string;
    relativePath: string;
    uri: vscode.Uri;
    language: string;
    encoding: string;
    lineCount: number;
    size: number;
    isModified: boolean;
    isUntitled: boolean;
    lastModified?: Date;
    gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'staged';
}

export interface SelectionContext {
    hasSelection: boolean;
    selectedText?: string;
    selectionRange?: vscode.Range;
    selectionLength: number;
    cursorPosition: vscode.Position;
    wordAtCursor?: string;
    lineAtCursor: string;
    indentLevel: number;
    surroundingContext: SurroundingContext;
}

export interface SurroundingContext {
    beforeCursor: string;
    afterCursor: string;
    currentFunction?: string;
    currentClass?: string;
    currentNamespace?: string;
    imports: string[];
    nearbySymbols: string[];
}

export interface GitContext {
    isRepository: boolean;
    branch?: string;
    hasChanges: boolean;
    stagedFiles: number;
    modifiedFiles: number;
    untrackedFiles: number;
    ahead: number;
    behind: number;
    lastCommit?: CommitInfo;
    remoteUrl?: string;
}

export interface CommitInfo {
    hash: string;
    message: string;
    author: string;
    date: Date;
}

export interface ProjectContext {
    type: string;
    name: string;
    version?: string;
    dependencies: string[];
    scripts: string[];
    configFiles: string[];
    buildTool?: string;
    packageManager?: string;
    framework?: string;
    testFramework?: string;
}

export interface EnvironmentContext {
    platform: string;
    architecture: string;
    nodeVersion?: string;
    vscodeVersion: string;
    extensionVersion: string;
    activeExtensions: string[];
    settings: RelevantSettings;
    terminal: TerminalContext;
}

export interface RelevantSettings {
    tabSize: number;
    insertSpaces: boolean;
    autoSave: string;
    formatOnSave: boolean;
    theme: string;
    fontSize: number;
    fontFamily: string;
}

export interface TerminalContext {
    activeTerminals: number;
    currentDirectory?: string;
    shell: string;
    lastCommand?: string;
}

export class ContextManager {
    private contextHistory: ContextInfo[] = [];
    private maxHistorySize = 100;
    private contextUpdateInterval?: NodeJS.Timeout;

    private onContextChangedEmitter = new vscode.EventEmitter<ContextInfo>();
    public readonly onContextChanged = this.onContextChangedEmitter.event;

    constructor(private context: vscode.ExtensionContext) {
        this.setupEventListeners();
        this.startContextMonitoring();
    }

    /**
     * 獲取當前完整上下文
     */
    async getCurrentContext(): Promise<ContextInfo> {
        const contextInfo: ContextInfo = {
            workspace: await this.getWorkspaceContext(),
            editor: await this.getEditorContext(),
            selection: await this.getSelectionContext(),
            git: await this.getGitContext(),
            project: await this.getProjectContext(),
            environment: await this.getEnvironmentContext(),
            timestamp: new Date()
        };

        // 添加到歷史
        this.addToHistory(contextInfo);

        return contextInfo;
    }

    /**
     * 獲取工作區上下文
     */
    private async getWorkspaceContext(): Promise<WorkspaceContext> {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const folders: WorkspaceFolder[] = [];
        let totalFiles = 0;
        let totalSize = 0;
        const languages = new Set<string>();

        for (const folder of workspaceFolders) {
            try {
                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folder, '**/*'),
                    '**/node_modules/**'
                );

                let folderSize = 0;
                for (const file of files) {
                    try {
                        const stat = await vscode.workspace.fs.stat(file);
                        folderSize += stat.size;
                        
                        // 獲取語言
                        const doc = await vscode.workspace.openTextDocument(file);
                        languages.add(doc.languageId);
                    } catch (error) {
                        // 忽略無法訪問的文件
                    }
                }

                folders.push({
                    name: folder.name,
                    path: folder.uri.fsPath,
                    uri: folder.uri,
                    isRoot: folder.index === 0,
                    fileCount: files.length,
                    size: folderSize
                });

                totalFiles += files.length;
                totalSize += folderSize;

            } catch (error) {
                console.error(`獲取工作區文件夾信息失敗: ${folder.uri.fsPath}`, error);
            }
        }

        // 獲取最近打開的文件
        const recentFiles = await this.getRecentFiles();

        return {
            folders,
            activeFolder: folders.find(f => f.isRoot),
            totalFiles,
            totalSize,
            languages: Array.from(languages),
            recentFiles
        };
    }

    /**
     * 獲取編輯器上下文
     */
    private async getEditorContext(): Promise<EditorContext> {
        const activeEditor = vscode.window.activeTextEditor;
        const visibleEditors = vscode.window.visibleTextEditors;
        const tabGroups = vscode.window.tabGroups;

        const openFiles: FileContext[] = [];
        
        // 獲取所有打開的文件
        for (const group of tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    const fileContext = await this.createFileContext(tab.input.uri);
                    if (fileContext) {
                        openFiles.push(fileContext);
                    }
                }
            }
        }

        let activeFile: FileContext | undefined;
        if (activeEditor) {
            activeFile = await this.createFileContext(activeEditor.document.uri);
        }

        return {
            activeFile,
            openFiles,
            visibleEditors: visibleEditors.length,
            activeGroup: tabGroups.activeTabGroup.viewColumn || 1,
            totalGroups: tabGroups.all.length,
            layout: this.determineEditorLayout(tabGroups.all.length)
        };
    }

    /**
     * 獲取選擇上下文
     */
    private async getSelectionContext(): Promise<SelectionContext> {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor) {
            return {
                hasSelection: false,
                selectionLength: 0,
                cursorPosition: new vscode.Position(0, 0),
                lineAtCursor: '',
                indentLevel: 0,
                surroundingContext: {
                    beforeCursor: '',
                    afterCursor: '',
                    imports: [],
                    nearbySymbols: []
                }
            };
        }

        const document = activeEditor.document;
        const selection = activeEditor.selection;
        const position = selection.active;
        
        const hasSelection = !selection.isEmpty;
        const selectedText = hasSelection ? document.getText(selection) : undefined;
        const lineAtCursor = document.lineAt(position.line).text;
        const wordAtCursor = this.getWordAtPosition(document, position);
        
        // 獲取縮進級別
        const indentLevel = this.getIndentLevel(lineAtCursor);
        
        // 獲取周圍上下文
        const surroundingContext = await this.getSurroundingContext(document, position);

        return {
            hasSelection,
            selectedText,
            selectionRange: hasSelection ? selection : undefined,
            selectionLength: selectedText?.length || 0,
            cursorPosition: position,
            wordAtCursor,
            lineAtCursor,
            indentLevel,
            surroundingContext
        };
    }

    /**
     * 獲取 Git 上下文
     */
    private async getGitContext(): Promise<GitContext> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) {
                return { isRepository: false, hasChanges: false, stagedFiles: 0, modifiedFiles: 0, untrackedFiles: 0, ahead: 0, behind: 0 };
            }

            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories[0];
            
            if (!repo) {
                return { isRepository: false, hasChanges: false, stagedFiles: 0, modifiedFiles: 0, untrackedFiles: 0, ahead: 0, behind: 0 };
            }

            const state = repo.state;
            const head = state.HEAD;

            return {
                isRepository: true,
                branch: head?.name,
                hasChanges: state.workingTreeChanges.length > 0 || state.indexChanges.length > 0,
                stagedFiles: state.indexChanges.length,
                modifiedFiles: state.workingTreeChanges.length,
                untrackedFiles: state.workingTreeChanges.filter((c: any) => c.status === 7).length,
                ahead: head?.ahead || 0,
                behind: head?.behind || 0,
                lastCommit: head?.commit ? {
                    hash: head.commit.hash,
                    message: head.commit.message,
                    author: head.commit.authorName || '',
                    date: new Date(head.commit.authorDate || Date.now())
                } : undefined,
                remoteUrl: repo.state.remotes[0]?.fetchUrl
            };

        } catch (error) {
            console.error('獲取 Git 上下文失敗:', error);
            return { isRepository: false, hasChanges: false, stagedFiles: 0, modifiedFiles: 0, untrackedFiles: 0, ahead: 0, behind: 0 };
        }
    }

    /**
     * 獲取項目上下文
     */
    private async getProjectContext(): Promise<ProjectContext> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return {
                type: 'unknown',
                name: 'No Workspace',
                dependencies: [],
                scripts: [],
                configFiles: []
            };
        }

        const projectPath = workspaceFolder.uri.fsPath;
        const projectName = path.basename(projectPath);

        // 檢測項目類型和配置
        const projectType = await this.detectProjectType(projectPath);
        const configFiles = await this.findConfigFiles(projectPath);
        const dependencies = await this.getProjectDependencies(projectPath, projectType);
        const scripts = await this.getProjectScripts(projectPath, projectType);

        return {
            type: projectType,
            name: projectName,
            dependencies,
            scripts,
            configFiles,
            buildTool: this.detectBuildTool(projectType, configFiles),
            packageManager: this.detectPackageManager(projectType, configFiles),
            framework: this.detectFramework(dependencies),
            testFramework: this.detectTestFramework(dependencies)
        };
    }

    /**
     * 獲取環境上下文
     */
    private async getEnvironmentContext(): Promise<EnvironmentContext> {
        const config = vscode.workspace.getConfiguration();
        const extensions = vscode.extensions.all.filter(ext => ext.isActive);

        return {
            platform: process.platform,
            architecture: process.arch,
            nodeVersion: process.version,
            vscodeVersion: vscode.version,
            extensionVersion: this.context.extension.packageJSON.version,
            activeExtensions: extensions.map(ext => ext.id),
            settings: {
                tabSize: config.get('editor.tabSize', 4),
                insertSpaces: config.get('editor.insertSpaces', true),
                autoSave: config.get('files.autoSave', 'off'),
                formatOnSave: config.get('editor.formatOnSave', false),
                theme: config.get('workbench.colorTheme', 'Default Dark+'),
                fontSize: config.get('editor.fontSize', 14),
                fontFamily: config.get('editor.fontFamily', 'Consolas')
            },
            terminal: await this.getTerminalContext()
        };
    }

    /**
     * 獲取終端上下文
     */
    private async getTerminalContext(): Promise<TerminalContext> {
        const terminals = vscode.window.terminals;
        const activeTerminal = vscode.window.activeTerminal;

        return {
            activeTerminals: terminals.length,
            currentDirectory: activeTerminal?.creationOptions.cwd?.toString(),
            shell: activeTerminal?.creationOptions.shellPath || process.env.SHELL || 'cmd',
            lastCommand: undefined // 無法直接獲取最後執行的命令
        };
    }

    /**
     * 創建文件上下文
     */
    private async createFileContext(uri: vscode.Uri): Promise<FileContext | null> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const stat = await vscode.workspace.fs.stat(uri);

            return {
                path: uri.fsPath,
                relativePath: vscode.workspace.asRelativePath(uri),
                uri,
                language: document.languageId,
                encoding: document.getText().length > 0 ? 'utf8' : 'unknown',
                lineCount: document.lineCount,
                size: stat.size,
                isModified: document.isDirty,
                isUntitled: document.isUntitled,
                lastModified: new Date(stat.mtime)
            };

        } catch (error) {
            console.error(`創建文件上下文失敗: ${uri.fsPath}`, error);
            return null;
        }
    }

    /**
     * 獲取周圍上下文
     */
    private async getSurroundingContext(document: vscode.TextDocument, position: vscode.Position): Promise<SurroundingContext> {
        const lineCount = document.lineCount;
        const currentLine = position.line;
        
        // 獲取前後文本
        const beforeRange = new vscode.Range(
            Math.max(0, currentLine - 5),
            0,
            position.line,
            position.character
        );
        const afterRange = new vscode.Range(
            position.line,
            position.character,
            Math.min(lineCount - 1, currentLine + 5),
            document.lineAt(Math.min(lineCount - 1, currentLine + 5)).text.length
        );

        const beforeCursor = document.getText(beforeRange);
        const afterCursor = document.getText(afterRange);

        // 獲取符號信息
        const symbols = await this.getDocumentSymbols(document);
        const currentFunction = this.findContainingSymbol(symbols, position, vscode.SymbolKind.Function);
        const currentClass = this.findContainingSymbol(symbols, position, vscode.SymbolKind.Class);
        const currentNamespace = this.findContainingSymbol(symbols, position, vscode.SymbolKind.Namespace);

        // 獲取導入語句
        const imports = this.extractImports(document);

        // 獲取附近的符號
        const nearbySymbols = this.getNearbySymbols(symbols, position);

        return {
            beforeCursor,
            afterCursor,
            currentFunction,
            currentClass,
            currentNamespace,
            imports,
            nearbySymbols
        };
    }

    /**
     * 設置事件監聽器
     */
    private setupEventListeners(): void {
        // 監聽文檔變更
        vscode.workspace.onDidChangeTextDocument(() => {
            this.scheduleContextUpdate();
        });

        // 監聽選擇變更
        vscode.window.onDidChangeTextEditorSelection(() => {
            this.scheduleContextUpdate();
        });

        // 監聽活動編輯器變更
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.scheduleContextUpdate();
        });

        // 監聽工作區變更
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.scheduleContextUpdate();
        });
    }

    /**
     * 開始上下文監控
     */
    private startContextMonitoring(): void {
        // 每30秒更新一次上下文
        this.contextUpdateInterval = setInterval(async () => {
            const context = await this.getCurrentContext();
            this.onContextChangedEmitter.fire(context);
        }, 30000);
    }

    /**
     * 計劃上下文更新
     */
    private scheduleContextUpdate(): void {
        // 防抖更新
        if (this.contextUpdateInterval) {
            clearTimeout(this.contextUpdateInterval);
        }

        this.contextUpdateInterval = setTimeout(async () => {
            const context = await this.getCurrentContext();
            this.onContextChangedEmitter.fire(context);
        }, 1000);
    }

    /**
     * 添加到歷史記錄
     */
    private addToHistory(contextInfo: ContextInfo): void {
        this.contextHistory.unshift(contextInfo);
        
        if (this.contextHistory.length > this.maxHistorySize) {
            this.contextHistory = this.contextHistory.slice(0, this.maxHistorySize);
        }
    }

    /**
     * 獲取上下文歷史
     */
    getContextHistory(): ContextInfo[] {
        return [...this.contextHistory];
    }

    /**
     * 輔助方法
     */
    private getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
        const range = document.getWordRangeAtPosition(position);
        return range ? document.getText(range) : undefined;
    }

    private getIndentLevel(line: string): number {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }

    private determineEditorLayout(groupCount: number): 'single' | 'split' | 'grid' {
        if (groupCount === 1) return 'single';
        if (groupCount === 2) return 'split';
        return 'grid';
    }

    private async getRecentFiles(): Promise<string[]> {
        // 簡化實作，實際應該從 VS Code 設置中獲取
        return [];
    }

    private async detectProjectType(projectPath: string): Promise<string> {
        // 簡化實作
        return 'unknown';
    }

    private async findConfigFiles(projectPath: string): Promise<string[]> {
        // 簡化實作
        return [];
    }

    private async getProjectDependencies(projectPath: string, projectType: string): Promise<string[]> {
        // 簡化實作
        return [];
    }

    private async getProjectScripts(projectPath: string, projectType: string): Promise<string[]> {
        // 簡化實作
        return [];
    }

    private detectBuildTool(projectType: string, configFiles: string[]): string | undefined {
        // 簡化實作
        return undefined;
    }

    private detectPackageManager(projectType: string, configFiles: string[]): string | undefined {
        // 簡化實作
        return undefined;
    }

    private detectFramework(dependencies: string[]): string | undefined {
        // 簡化實作
        return undefined;
    }

    private detectTestFramework(dependencies: string[]): string | undefined {
        // 簡化實作
        return undefined;
    }

    private async getDocumentSymbols(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );
            return symbols || [];
        } catch {
            return [];
        }
    }

    private findContainingSymbol(symbols: vscode.DocumentSymbol[], position: vscode.Position, kind: vscode.SymbolKind): string | undefined {
        // 簡化實作
        return undefined;
    }

    private extractImports(document: vscode.TextDocument): string[] {
        // 簡化實作
        return [];
    }

    private getNearbySymbols(symbols: vscode.DocumentSymbol[], position: vscode.Position): string[] {
        // 簡化實作
        return [];
    }

    /**
     * 清理資源
     */
    dispose(): void {
        if (this.contextUpdateInterval) {
            clearInterval(this.contextUpdateInterval);
        }
        this.onContextChangedEmitter.dispose();
    }
}
