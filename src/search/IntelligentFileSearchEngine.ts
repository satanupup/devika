import * as vscode from 'vscode';
import * as path from 'path';

export interface SearchOptions {
    includePatterns?: string[];
    excludePatterns?: string[];
    fileTypes?: string[];
    maxResults?: number;
    caseSensitive?: boolean;
    useRegex?: boolean;
    searchContent?: boolean;
    maxFileSize?: number;
}

export interface SearchResult {
    uri: vscode.Uri;
    fileName: string;
    relativePath: string;
    fileType: string;
    size: number;
    lastModified: Date;
    matches?: ContentMatch[];
    relevanceScore: number;
}

export interface ContentMatch {
    line: number;
    column: number;
    text: string;
    context: string;
    matchLength: number;
}

export interface SearchStats {
    totalFiles: number;
    searchedFiles: number;
    matchedFiles: number;
    totalMatches: number;
    searchTime: number;
    skippedFiles: number;
}

export class IntelligentFileSearchEngine {
    private readonly fs: vscode.FileSystem;
    private searchHistory: string[] = [];
    private readonly maxHistorySize = 100;

    constructor() {
        this.fs = vscode.workspace.fs;
    }

    /**
     * 智能文件搜索
     */
    async searchFiles(
        query: string,
        rootUri: vscode.Uri,
        options: SearchOptions = {}
    ): Promise<{ results: SearchResult[]; stats: SearchStats }> {
        const startTime = Date.now();
        const stats: SearchStats = {
            totalFiles: 0,
            searchedFiles: 0,
            matchedFiles: 0,
            totalMatches: 0,
            searchTime: 0,
            skippedFiles: 0
        };

        // 添加到搜索歷史
        this.addToSearchHistory(query);

        // 構建搜索模式
        const searchPattern = this.buildSearchPattern(query, options);

        // 獲取文件列表
        const files = await this.getFileList(rootUri, options);
        stats.totalFiles = files.length;

        const results: SearchResult[] = [];

        for (const fileUri of files) {
            try {
                const result = await this.searchInFile(fileUri, searchPattern, options);
                stats.searchedFiles++;

                if (result) {
                    results.push(result);
                    stats.matchedFiles++;
                    stats.totalMatches += result.matches?.length || 1;
                }
            } catch (error) {
                stats.skippedFiles++;
                console.warn(`跳過文件 ${fileUri.fsPath}: ${error}`);
            }
        }

        // 按相關性排序
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // 限制結果數量
        const maxResults = options.maxResults || 100;
        const limitedResults = results.slice(0, maxResults);

        stats.searchTime = Date.now() - startTime;

        return { results: limitedResults, stats };
    }

    /**
     * 在單個文件中搜索
     */
    private async searchInFile(
        fileUri: vscode.Uri,
        searchPattern: RegExp,
        options: SearchOptions
    ): Promise<SearchResult | null> {
        try {
            // 獲取文件信息
            const fileStat = await this.fs.stat(fileUri);
            const fileName = path.basename(fileUri.fsPath);
            const fileType = path.extname(fileName).toLowerCase();

            // 檢查文件大小限制
            if (options.maxFileSize && fileStat.size > options.maxFileSize) {
                return null;
            }

            // 檢查文件名匹配
            const fileNameMatch = searchPattern.test(fileName);
            let contentMatches: ContentMatch[] = [];
            let relevanceScore = 0;

            // 如果需要搜索內容
            if (options.searchContent && this.isTextFile(fileType)) {
                try {
                    const content = await this.fs.readFile(fileUri);
                    const text = Buffer.from(content).toString('utf8');
                    contentMatches = this.findContentMatches(text, searchPattern);
                } catch (error) {
                    // 無法讀取文件內容，只匹配文件名
                }
            }

            // 計算相關性分數
            if (fileNameMatch) {
                relevanceScore += 10;
            }
            relevanceScore += contentMatches.length * 5;

            // 如果沒有匹配，返回 null
            if (!fileNameMatch && contentMatches.length === 0) {
                return null;
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
            const relativePath = workspaceFolder
                ? path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath)
                : fileUri.fsPath;

            return {
                uri: fileUri,
                fileName,
                relativePath,
                fileType,
                size: fileStat.size,
                lastModified: new Date(fileStat.mtime),
                matches: contentMatches.length > 0 ? contentMatches : undefined,
                relevanceScore
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 在文本中查找匹配
     */
    private findContentMatches(text: string, pattern: RegExp): ContentMatch[] {
        const matches: ContentMatch[] = [];
        const lines = text.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            let match;

            // 重置正則表達式的 lastIndex
            pattern.lastIndex = 0;

            while ((match = pattern.exec(line)) !== null) {
                const contextStart = Math.max(0, lineIndex - 2);
                const contextEnd = Math.min(lines.length - 1, lineIndex + 2);
                const context = lines.slice(contextStart, contextEnd + 1).join('\n');

                matches.push({
                    line: lineIndex + 1,
                    column: match.index + 1,
                    text: match[0],
                    context,
                    matchLength: match[0].length
                });

                // 避免無限循環
                if (!pattern.global) {
                    break;
                }
            }
        }

        return matches;
    }

    /**
     * 構建搜索模式
     */
    private buildSearchPattern(query: string, options: SearchOptions): RegExp {
        let pattern = query;

        if (!options.useRegex) {
            // 轉義特殊字符
            pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        const flags = options.caseSensitive ? 'g' : 'gi';
        return new RegExp(pattern, flags);
    }

    /**
     * 獲取文件列表
     */
    private async getFileList(rootUri: vscode.Uri, options: SearchOptions): Promise<vscode.Uri[]> {
        const includePattern = options.includePatterns?.join(',') || '**/*';
        const excludePattern = options.excludePatterns?.join(',') ||
            '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.vscode/**}';

        try {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(rootUri, includePattern),
                new vscode.RelativePattern(rootUri, excludePattern)
            );

            // 按文件類型過濾
            if (options.fileTypes && options.fileTypes.length > 0) {
                return files.filter(uri => {
                    const ext = path.extname(uri.fsPath).toLowerCase();
                    return options.fileTypes!.includes(ext);
                });
            }

            return files;
        } catch (error) {
            console.error('獲取文件列表失敗:', error);
            return [];
        }
    }

    /**
     * 檢查是否為文本文件
     */
    private isTextFile(extension: string): boolean {
        const textExtensions = [
            '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp',
            '.h', '.hpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt',
            '.html', '.css', '.scss', '.less', '.xml', '.json', '.yaml', '.yml',
            '.toml', '.ini', '.cfg', '.conf', '.log', '.sql', '.sh', '.bat',
            '.ps1', '.dockerfile', '.gitignore', '.gitattributes'
        ];

        return textExtensions.includes(extension.toLowerCase());
    }

    /**
     * 智能搜索建議
     */
    async getSearchSuggestions(partialQuery: string): Promise<string[]> {
        const suggestions: string[] = [];

        // 從搜索歷史中獲取建議
        const historyMatches = this.searchHistory.filter(query =>
            query.toLowerCase().includes(partialQuery.toLowerCase())
        );

        suggestions.push(...historyMatches.slice(0, 5));

        // 添加常用搜索模式建議
        const commonPatterns = [
            '*.js',
            '*.ts',
            '*.md',
            '*.json',
            'README*',
            'package.json',
            'tsconfig.json',
            '.gitignore'
        ];

        const patternMatches = commonPatterns.filter(pattern =>
            pattern.toLowerCase().includes(partialQuery.toLowerCase())
        );

        suggestions.push(...patternMatches);

        // 去重並限制數量
        return [...new Set(suggestions)].slice(0, 10);
    }

    /**
     * 搜索文件內容
     */
    async searchInContent(
        query: string,
        fileTypes: string[] = [],
        options: {
            caseSensitive?: boolean;
            wholeWord?: boolean;
            useRegex?: boolean;
            maxResults?: number;
        } = {}
    ): Promise<SearchResult[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const searchOptions: SearchOptions = {
            searchContent: true,
            fileTypes: fileTypes.length > 0 ? fileTypes : undefined,
            maxResults: options.maxResults || 50,
            caseSensitive: options.caseSensitive || false,
            useRegex: options.useRegex || false
        };

        const allResults: SearchResult[] = [];

        for (const folder of workspaceFolders) {
            const { results } = await this.searchFiles(query, folder.uri, searchOptions);
            allResults.push(...results);
        }

        // 按相關性重新排序
        allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return allResults.slice(0, searchOptions.maxResults);
    }

    /**
     * 快速文件查找
     */
    async quickFind(fileName: string): Promise<SearchResult[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const searchOptions: SearchOptions = {
            searchContent: false,
            maxResults: 20,
            caseSensitive: false
        };

        const allResults: SearchResult[] = [];

        for (const folder of workspaceFolders) {
            const { results } = await this.searchFiles(fileName, folder.uri, searchOptions);
            allResults.push(...results);
        }

        return allResults.slice(0, 20);
    }

    /**
     * 添加到搜索歷史
     */
    private addToSearchHistory(query: string): void {
        // 移除重複項
        const index = this.searchHistory.indexOf(query);
        if (index > -1) {
            this.searchHistory.splice(index, 1);
        }

        // 添加到開頭
        this.searchHistory.unshift(query);

        // 限制歷史大小
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
        }
    }

    /**
     * 獲取搜索歷史
     */
    getSearchHistory(): readonly string[] {
        return [...this.searchHistory];
    }

    /**
     * 清除搜索歷史
     */
    clearSearchHistory(): void {
        this.searchHistory = [];
    }
}
