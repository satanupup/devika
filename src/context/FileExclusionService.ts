import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ExclusionRule {
    pattern: string;
    source: 'gitignore' | 'aiexclude' | 'user';
    enabled: boolean;
}

export class FileExclusionService {
    private exclusionRules: ExclusionRule[] = [];
    private gitignoreWatcher: vscode.FileSystemWatcher | undefined;
    private aiexcludeWatcher: vscode.FileSystemWatcher | undefined;

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.loadGitignoreRules();
        await this.loadAiexcludeRules();
        this.setupFileWatchers();
    }

    private async loadGitignoreRules(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {return;}

        for (const folder of workspaceFolders) {
            const gitignorePath = path.join(folder.uri.fsPath, '.gitignore');
            try {
                if (fs.existsSync(gitignorePath)) {
                    const content = fs.readFileSync(gitignorePath, 'utf8');
                    const rules = this.parseIgnoreFile(content, 'gitignore');
                    this.exclusionRules.push(...rules);
                }
            } catch (error) {
                console.warn(`Failed to load .gitignore: ${error}`);
            }
        }
    }

    private async loadAiexcludeRules(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {return;}

        for (const folder of workspaceFolders) {
            const aiexcludePath = path.join(folder.uri.fsPath, '.aiexclude');
            try {
                if (fs.existsSync(aiexcludePath)) {
                    const content = fs.readFileSync(aiexcludePath, 'utf8');
                    const rules = this.parseIgnoreFile(content, 'aiexclude');
                    this.exclusionRules.push(...rules);
                }
            } catch (error) {
                console.warn(`Failed to load .aiexclude: ${error}`);
            }
        }
    }

    private parseIgnoreFile(content: string, source: 'gitignore' | 'aiexclude'): ExclusionRule[] {
        const rules: ExclusionRule[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }

            rules.push({
                pattern: trimmed,
                source,
                enabled: true
            });
        }

        return rules;
    }

    private setupFileWatchers(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {return;}

        // Watch .gitignore files
        this.gitignoreWatcher = vscode.workspace.createFileSystemWatcher('**/.gitignore');
        this.gitignoreWatcher.onDidChange(() => this.reloadGitignoreRules());
        this.gitignoreWatcher.onDidCreate(() => this.reloadGitignoreRules());
        this.gitignoreWatcher.onDidDelete(() => this.reloadGitignoreRules());

        // Watch .aiexclude files
        this.aiexcludeWatcher = vscode.workspace.createFileSystemWatcher('**/.aiexclude');
        this.aiexcludeWatcher.onDidChange(() => this.reloadAiexcludeRules());
        this.aiexcludeWatcher.onDidCreate(() => this.reloadAiexcludeRules());
        this.aiexcludeWatcher.onDidDelete(() => this.reloadAiexcludeRules());
    }

    private async reloadGitignoreRules(): Promise<void> {
        // Remove existing gitignore rules
        this.exclusionRules = this.exclusionRules.filter(rule => rule.source !== 'gitignore');
        await this.loadGitignoreRules();
    }

    private async reloadAiexcludeRules(): Promise<void> {
        // Remove existing aiexclude rules
        this.exclusionRules = this.exclusionRules.filter(rule => rule.source !== 'aiexclude');
        await this.loadAiexcludeRules();
    }

    public isFileExcluded(filePath: string): boolean {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {return false;}

        // Convert absolute path to relative path
        let relativePath = filePath;
        for (const folder of workspaceFolders) {
            if (filePath.startsWith(folder.uri.fsPath)) {
                relativePath = path.relative(folder.uri.fsPath, filePath);
                break;
            }
        }

        // Normalize path separators
        relativePath = relativePath.replace(/\\/g, '/');

        // Check against all enabled exclusion rules
        for (const rule of this.exclusionRules) {
            if (!rule.enabled) {continue;}

            if (this.matchesPattern(relativePath, rule.pattern)) {
                return true;
            }
        }

        return false;
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Handle negation patterns (starting with !)
        if (pattern.startsWith('!')) {
            return !this.matchesPattern(filePath, pattern.substring(1));
        }

        // Convert gitignore pattern to regex
        let regexPattern = pattern
            .replace(/\./g, '\\.')  // Escape dots
            .replace(/\*/g, '[^/]*')  // * matches anything except /
            .replace(/\*\*/g, '.*')   // ** matches anything including /
            .replace(/\?/g, '[^/]');  // ? matches single character except /

        // Handle directory patterns (ending with /)
        if (pattern.endsWith('/')) {
            regexPattern = regexPattern.slice(0, -1) + '(/.*)?$';
        } else {
            regexPattern = '^' + regexPattern + '$';
        }

        try {
            const regex = new RegExp(regexPattern);
            return regex.test(filePath) || regex.test(path.basename(filePath));
        } catch (error) {
            console.warn(`Invalid pattern: ${pattern}`);
            return false;
        }
    }

    public getExclusionRules(): ExclusionRule[] {
        return [...this.exclusionRules];
    }

    public addUserRule(pattern: string): void {
        this.exclusionRules.push({
            pattern,
            source: 'user',
            enabled: true
        });
    }

    public removeUserRule(pattern: string): void {
        this.exclusionRules = this.exclusionRules.filter(
            rule => !(rule.source === 'user' && rule.pattern === pattern)
        );
    }

    public toggleRule(pattern: string, source: string): void {
        const rule = this.exclusionRules.find(r => r.pattern === pattern && r.source === source);
        if (rule) {
            rule.enabled = !rule.enabled;
        }
    }

    public getFilteredFiles(files: vscode.Uri[]): vscode.Uri[] {
        return files.filter(file => !this.isFileExcluded(file.fsPath));
    }

    public async scanWorkspaceFiles(includePattern?: string): Promise<vscode.Uri[]> {
        const pattern = includePattern || '**/*';
        const files = await vscode.workspace.findFiles(pattern);
        return this.getFilteredFiles(files);
    }

    public dispose(): void {
        if (this.gitignoreWatcher) {
            this.gitignoreWatcher.dispose();
        }
        if (this.aiexcludeWatcher) {
            this.aiexcludeWatcher.dispose();
        }
    }
}
