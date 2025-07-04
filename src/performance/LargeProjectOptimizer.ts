import * as vscode from 'vscode';
import * as path from 'path';

export interface IndexingProgress {
    totalFiles: number;
    processedFiles: number;
    currentFile: string;
    percentage: number;
    estimatedTimeRemaining: number;
}

export interface ProjectIndex {
    files: Map<string, FileIndexEntry>;
    lastUpdated: string;
    version: string;
    totalSize: number;
}

export interface FileIndexEntry {
    path: string;
    size: number;
    lastModified: string;
    hash: string;
    language: string;
    symbols?: SymbolInfo[];
    dependencies?: string[];
    indexed: boolean;
}

export interface SymbolInfo {
    name: string;
    kind: string;
    range: vscode.Range;
    detail?: string;
}

export class LargeProjectOptimizer {
    private index: ProjectIndex;
    private indexingInProgress = false;
    private progressCallback?: (progress: IndexingProgress) => void;
    private abortController?: AbortController;
    private readonly maxConcurrentFiles = 10;
    private readonly chunkSize = 100;
    private readonly maxMemoryUsage = 500 * 1024 * 1024; // 500MB

    constructor(private context: vscode.ExtensionContext) {
        this.index = {
            files: new Map(),
            lastUpdated: new Date().toISOString(),
            version: '1.0.0',
            totalSize: 0
        };
        this.loadIndex();
    }

    async optimizeForLargeProject(workspaceRoot: string): Promise<void> {
        if (this.indexingInProgress) {
            vscode.window.showWarningMessage('索引正在進行中，請稍候...');
            return;
        }

        this.indexingInProgress = true;
        this.abortController = new AbortController();

        try {
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在優化大型項目...',
                cancellable: true
            }, async (progress, token) => {
                token.onCancellationRequested(() => {
                    this.abortController?.abort();
                });

                await this.performIncrementalIndexing(workspaceRoot, progress);
            });

            vscode.window.showInformationMessage(
                `項目優化完成！索引了 ${this.index.files.size} 個文件`
            );

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                vscode.window.showInformationMessage('項目優化已取消');
            } else {
                vscode.window.showErrorMessage(`項目優化失敗: ${error}`);
            }
        } finally {
            this.indexingInProgress = false;
            this.abortController = undefined;
        }
    }

    private async performIncrementalIndexing(
        workspaceRoot: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<void> {
        // Get all files with smart filtering
        const allFiles = await this.getFilteredFiles(workspaceRoot);
        const filesToIndex = this.getFilesNeedingIndexing(allFiles);

        if (filesToIndex.length === 0) {
            progress.report({ message: '索引已是最新狀態' });
            return;
        }

        progress.report({ message: `準備索引 ${filesToIndex.length} 個文件...` });

        // Process files in chunks to manage memory
        const chunks = this.chunkArray(filesToIndex, this.chunkSize);
        let processedFiles = 0;

        for (let i = 0; i < chunks.length; i++) {
            if (this.abortController?.signal.aborted) {
                throw new Error('Indexing aborted');
            }

            const chunk = chunks[i];
            progress.report({
                message: `處理第 ${i + 1}/${chunks.length} 批文件...`,
                increment: (chunk.length / filesToIndex.length) * 100
            });

            await this.processFileChunk(chunk);
            processedFiles += chunk.length;

            // Memory management
            if (this.getMemoryUsage() > this.maxMemoryUsage) {
                await this.performGarbageCollection();
            }

            // Save progress periodically
            if (i % 5 === 0) {
                await this.saveIndex();
            }
        }

        // Final save
        await this.saveIndex();
    }

    private async getFilteredFiles(workspaceRoot: string): Promise<string[]> {
        const excludePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/out/**',
            '**/.git/**',
            '**/coverage/**',
            '**/*.log',
            '**/tmp/**',
            '**/temp/**'
        ];

        const includePatterns = [
            '**/*.ts',
            '**/*.js',
            '**/*.tsx',
            '**/*.jsx',
            '**/*.py',
            '**/*.java',
            '**/*.cs',
            '**/*.cpp',
            '**/*.c',
            '**/*.h',
            '**/*.go',
            '**/*.rs',
            '**/*.php',
            '**/*.rb',
            '**/*.swift',
            '**/*.kt',
            '**/*.dart',
            '**/*.vue',
            '**/*.svelte'
        ];

        const files: string[] = [];

        for (const pattern of includePatterns) {
            const foundFiles = await vscode.workspace.findFiles(
                pattern,
                `{${excludePatterns.join(',')}}`,
                50000 // Increased limit for large projects
            );

            files.push(...foundFiles.map(uri => uri.fsPath));
        }

        // Remove duplicates and sort
        return [...new Set(files)].sort();
    }

    private getFilesNeedingIndexing(allFiles: string[]): string[] {
        const needsIndexing: string[] = [];

        for (const filePath of allFiles) {
            const existingEntry = this.index.files.get(filePath);

            if (!existingEntry) {
                needsIndexing.push(filePath);
                continue;
            }

            // Check if file has been modified
            try {
                const stat = require('fs').statSync(filePath);
                const lastModified = stat.mtime.toISOString();

                if (lastModified !== existingEntry.lastModified) {
                    needsIndexing.push(filePath);
                }
            } catch (error) {
                // File might have been deleted
                this.index.files.delete(filePath);
            }
        }

        return needsIndexing;
    }

    private async processFileChunk(files: string[]): Promise<void> {
        const promises = files.map(filePath => this.indexFile(filePath));

        // Process with concurrency limit
        for (let i = 0; i < promises.length; i += this.maxConcurrentFiles) {
            const chunk = promises.slice(i, i + this.maxConcurrentFiles);
            await Promise.allSettled(chunk);
        }
    }

    private async indexFile(filePath: string): Promise<void> {
        try {
            const stat = require('fs').statSync(filePath);
            const content = require('fs').readFileSync(filePath, 'utf8');
            const hash = require('crypto').createHash('md5').update(content).digest('hex');

            const entry: FileIndexEntry = {
                path: filePath,
                size: stat.size,
                lastModified: stat.mtime.toISOString(),
                hash,
                language: this.detectLanguage(filePath),
                indexed: true
            };

            // Extract symbols for supported languages
            if (this.shouldExtractSymbols(entry.language)) {
                entry.symbols = await this.extractSymbols(filePath, content);
            }

            // Extract dependencies
            entry.dependencies = this.extractDependencies(content, entry.language);

            this.index.files.set(filePath, entry);
            this.index.totalSize += stat.size;

        } catch (error) {
            console.warn(`Failed to index file ${filePath}:`, error);
        }
    }

    private detectLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: { [key: string]: string } = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.java': 'java',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.dart': 'dart',
            '.vue': 'vue',
            '.svelte': 'svelte'
        };

        return languageMap[ext] || 'plaintext';
    }

    private shouldExtractSymbols(language: string): boolean {
        const supportedLanguages = [
            'typescript', 'typescriptreact', 'javascript', 'javascriptreact',
            'python', 'java', 'csharp', 'cpp', 'c', 'go', 'rust'
        ];
        return supportedLanguages.includes(language);
    }

    private async extractSymbols(filePath: string, content: string): Promise<SymbolInfo[]> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (!symbols) {return [];}

            return this.convertDocumentSymbols(symbols);
        } catch (error) {
            return [];
        }
    }

    private convertDocumentSymbols(symbols: vscode.DocumentSymbol[]): SymbolInfo[] {
        const result: SymbolInfo[] = [];

        for (const symbol of symbols) {
            result.push({
                name: symbol.name,
                kind: vscode.SymbolKind[symbol.kind],
                range: symbol.range,
                detail: symbol.detail
            });

            // Recursively process children
            if (symbol.children) {
                result.push(...this.convertDocumentSymbols(symbol.children));
            }
        }

        return result;
    }

    private extractDependencies(content: string, language: string): string[] {
        const dependencies: string[] = [];

        switch (language) {
            case 'typescript':
            case 'javascript':
            case 'typescriptreact':
            case 'javascriptreact':
                const importRegex = /(?:import.*from\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\))/g;
                let match;
                while ((match = importRegex.exec(content)) !== null) {
                    dependencies.push(match[1] || match[2]);
                }
                break;

            case 'python':
                const pythonImportRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
                while ((match = pythonImportRegex.exec(content)) !== null) {
                    dependencies.push(match[1] || match[2]);
                }
                break;
        }

        return dependencies;
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    private getMemoryUsage(): number {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        return 0;
    }

    private async performGarbageCollection(): Promise<void> {
        if (typeof global !== 'undefined' && global.gc) {
            global.gc();
        }

        // Clear some caches if memory is still high
        if (this.getMemoryUsage() > this.maxMemoryUsage * 0.8) {
            // Keep only essential index data
            for (const [path, entry] of this.index.files.entries()) {
                if (entry.symbols && entry.symbols.length > 100) {
                    // Keep only the most important symbols
                    entry.symbols = entry.symbols.slice(0, 50);
                }
            }
        }
    }

    async getProjectStatistics(): Promise<{
        totalFiles: number;
        indexedFiles: number;
        totalSize: string;
        languages: { [key: string]: number };
        lastUpdated: string;
    }> {
        const languages: { [key: string]: number } = {};
        let indexedFiles = 0;

        for (const entry of this.index.files.values()) {
            if (entry.indexed) {
                indexedFiles++;
            }
            languages[entry.language] = (languages[entry.language] || 0) + 1;
        }

        return {
            totalFiles: this.index.files.size,
            indexedFiles,
            totalSize: this.formatBytes(this.index.totalSize),
            languages,
            lastUpdated: this.index.lastUpdated
        };
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) {return '0 Bytes';}
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private async loadIndex(): Promise<void> {
        try {
            const saved = this.context.globalState.get<any>('projectIndex');
            if (saved) {
                this.index = {
                    files: new Map(saved.files),
                    lastUpdated: saved.lastUpdated,
                    version: saved.version,
                    totalSize: saved.totalSize
                };
            }
        } catch (error) {
            console.warn('Failed to load project index:', error);
        }
    }

    private async saveIndex(): Promise<void> {
        try {
            const toSave = {
                files: Array.from(this.index.files.entries()),
                lastUpdated: this.index.lastUpdated,
                version: this.index.version,
                totalSize: this.index.totalSize
            };
            await this.context.globalState.update('projectIndex', toSave);
        } catch (error) {
            console.warn('Failed to save project index:', error);
        }
    }

    async clearIndex(): Promise<void> {
        this.index = {
            files: new Map(),
            lastUpdated: new Date().toISOString(),
            version: '1.0.0',
            totalSize: 0
        };
        await this.saveIndex();
        vscode.window.showInformationMessage('項目索引已清除');
    }

    isIndexingInProgress(): boolean {
        return this.indexingInProgress;
    }

    getIndexedFile(filePath: string): FileIndexEntry | undefined {
        return this.index.files.get(filePath);
    }

    async searchSymbols(query: string): Promise<SymbolInfo[]> {
        const results: SymbolInfo[] = [];
        const lowerQuery = query.toLowerCase();

        for (const entry of this.index.files.values()) {
            if (entry.symbols) {
                for (const symbol of entry.symbols) {
                    if (symbol.name.toLowerCase().includes(lowerQuery)) {
                        results.push(symbol);
                    }
                }
            }
        }

        return results.slice(0, 100); // Limit results
    }
}
