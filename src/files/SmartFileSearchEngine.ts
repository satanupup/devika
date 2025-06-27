import * as vscode from 'vscode';
import * as path from 'path';

export interface SearchOptions {
    include?: string | string[];
    exclude?: string | string[];
    maxResults?: number;
    useRegex?: boolean;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    followSymlinks?: boolean;
    searchInBinary?: boolean;
}

export interface SearchResult {
    file: vscode.Uri;
    relativePath: string;
    matches: SearchMatch[];
    totalMatches: number;
}

export interface SearchMatch {
    line: number;
    column: number;
    text: string;
    preview: string;
    range: vscode.Range;
}

export interface FileSearchResult {
    file: vscode.Uri;
    relativePath: string;
    size: number;
    lastModified: Date;
    type: 'file' | 'directory';
}

export class SmartFileSearchEngine {
    private searchHistory: string[] = [];
    private maxHistorySize = 50;

    constructor(private context: vscode.ExtensionContext) {
        this.loadSearchHistory();
    }

    /**
     * 搜索文件內容
     */
    async searchInFiles(
        query: string,
        options: SearchOptions = {}
    ): Promise<SearchResult[]> {
        const {
            include = '**/*',
            exclude,
            maxResults = 1000,
            useRegex = false,
            caseSensitive = false,
            wholeWord = false
        } = options;

        this.addToHistory(query);

        try {
            // 構建搜索模式
            const searchPattern = this.buildSearchPattern(query, {
                useRegex,
                caseSensitive,
                wholeWord
            });

            // 執行文本搜索
            const textSearchResults = await vscode.workspace.findTextInFiles(
                searchPattern,
                {
                    include: Array.isArray(include) ? `{${include.join(',')}}` : include,
                    exclude: Array.isArray(exclude) ? `{${exclude.join(',')}}` : exclude,
                    maxResults,
                    followSymlinks: options.followSymlinks,
                    useDefaultExcludes: true,
                    useDefaultSearchExcludes: true,
                    useGlobalIgnoreFiles: true,
                    useParentIgnoreFiles: true
                }
            );

            // 轉換結果格式
            const results: SearchResult[] = [];
            for (const [uri, matches] of textSearchResults) {
                const relativePath = vscode.workspace.asRelativePath(uri);
                const searchMatches: SearchMatch[] = matches.map(match => ({
                    line: match.range.start.line + 1,
                    column: match.range.start.character + 1,
                    text: match.text,
                    preview: match.preview.text,
                    range: match.range
                }));

                results.push({
                    file: uri,
                    relativePath,
                    matches: searchMatches,
                    totalMatches: searchMatches.length
                });
            }

            return results.sort((a, b) => b.totalMatches - a.totalMatches);

        } catch (error) {
            console.error('文件內容搜索失敗:', error);
            throw new Error(`搜索失敗: ${error}`);
        }
    }

    /**
     * 搜索文件名
     */
    async searchFiles(
        pattern: string,
        options: SearchOptions = {}
    ): Promise<FileSearchResult[]> {
        const {
            include = '**/*',
            exclude,
            maxResults = 1000,
            useRegex = false,
            caseSensitive = false
        } = options;

        try {
            // 構建文件搜索模式
            let searchPattern: string;
            if (useRegex) {
                searchPattern = pattern;
            } else {
                // 轉換為 glob 模式
                searchPattern = this.convertToGlobPattern(pattern, caseSensitive);
            }

            // 執行文件搜索
            const files = await vscode.workspace.findFiles(
                searchPattern,
                Array.isArray(exclude) ? `{${exclude.join(',')}}` : exclude,
                maxResults
            );

            // 獲取文件詳細信息
            const results: FileSearchResult[] = [];
            for (const file of files) {
                try {
                    const stat = await vscode.workspace.fs.stat(file);
                    results.push({
                        file,
                        relativePath: vscode.workspace.asRelativePath(file),
                        size: stat.size,
                        lastModified: new Date(stat.mtime),
                        type: stat.type === vscode.FileType.Directory ? 'directory' : 'file'
                    });
                } catch (error) {
                    // 忽略無法訪問的文件
                    console.warn(`無法獲取文件信息: ${file.fsPath}`, error);
                }
            }

            return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

        } catch (error) {
            console.error('文件名搜索失敗:', error);
            throw new Error(`文件搜索失敗: ${error}`);
        }
    }

    /**
     * 高級搜索 - 結合文件名和內容搜索
     */
    async advancedSearch(
        contentQuery?: string,
        fileNamePattern?: string,
        options: SearchOptions = {}
    ): Promise<{
        contentResults: SearchResult[];
        fileResults: FileSearchResult[];
        combinedResults: SearchResult[];
    }> {
        const promises: Promise<any>[] = [];

        // 內容搜索
        let contentResults: SearchResult[] = [];
        if (contentQuery) {
            promises.push(
                this.searchInFiles(contentQuery, options).then(results => {
                    contentResults = results;
                })
            );
        }

        // 文件名搜索
        let fileResults: FileSearchResult[] = [];
        if (fileNamePattern) {
            promises.push(
                this.searchFiles(fileNamePattern, options).then(results => {
                    fileResults = results;
                })
            );
        }

        await Promise.all(promises);

        // 合併結果 - 找到既匹配文件名又有內容匹配的文件
        const combinedResults: SearchResult[] = [];
        if (contentQuery && fileNamePattern) {
            const fileResultPaths = new Set(fileResults.map(f => f.file.fsPath));
            combinedResults.push(
                ...contentResults.filter(cr => fileResultPaths.has(cr.file.fsPath))
            );
        }

        return {
            contentResults,
            fileResults,
            combinedResults
        };
    }

    /**
     * 搜索符號定義
     */
    async searchSymbols(
        query: string,
        symbolKind?: vscode.SymbolKind
    ): Promise<vscode.SymbolInformation[]> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                query
            );

            if (!symbols) return [];

            // 按符號類型過濾
            let filteredSymbols = symbols;
            if (symbolKind !== undefined) {
                filteredSymbols = symbols.filter(symbol => symbol.kind === symbolKind);
            }

            return filteredSymbols.sort((a, b) => a.name.localeCompare(b.name));

        } catch (error) {
            console.error('符號搜索失敗:', error);
            return [];
        }
    }

    /**
     * 搜索引用
     */
    async searchReferences(
        uri: vscode.Uri,
        position: vscode.Position
    ): Promise<vscode.Location[]> {
        try {
            const references = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                uri,
                position
            );

            return references || [];

        } catch (error) {
            console.error('引用搜索失敗:', error);
            return [];
        }
    }

    /**
     * 智能搜索建議
     */
    async getSearchSuggestions(
        partialQuery: string,
        searchType: 'content' | 'filename' | 'symbol' = 'content'
    ): Promise<string[]> {
        const suggestions: string[] = [];

        // 從搜索歷史中獲取建議
        const historySuggestions = this.searchHistory
            .filter(query => query.toLowerCase().includes(partialQuery.toLowerCase()))
            .slice(0, 5);
        suggestions.push(...historySuggestions);

        // 根據搜索類型提供特定建議
        switch (searchType) {
            case 'content':
                suggestions.push(
                    ...this.getContentSearchSuggestions(partialQuery)
                );
                break;
            case 'filename':
                suggestions.push(
                    ...this.getFilenameSearchSuggestions(partialQuery)
                );
                break;
            case 'symbol':
                suggestions.push(
                    ...this.getSymbolSearchSuggestions(partialQuery)
                );
                break;
        }

        // 去重並限制數量
        return [...new Set(suggestions)].slice(0, 10);
    }

    /**
     * 構建搜索模式
     */
    private buildSearchPattern(
        query: string,
        options: { useRegex: boolean; caseSensitive: boolean; wholeWord: boolean }
    ): vscode.TextSearchQuery {
        const { useRegex, caseSensitive, wholeWord } = options;

        if (useRegex) {
            return {
                pattern: query,
                isRegExp: true,
                isCaseSensitive: caseSensitive,
                isWordMatch: wholeWord
            };
        } else {
            return {
                pattern: query,
                isRegExp: false,
                isCaseSensitive: caseSensitive,
                isWordMatch: wholeWord
            };
        }
    }

    /**
     * 轉換為 Glob 模式
     */
    private convertToGlobPattern(pattern: string, caseSensitive: boolean): string {
        let globPattern = pattern;

        // 如果不區分大小寫，轉換為小寫
        if (!caseSensitive) {
            globPattern = globPattern.toLowerCase();
        }

        // 如果沒有包含通配符，添加通配符
        if (!globPattern.includes('*') && !globPattern.includes('?')) {
            globPattern = `**/*${globPattern}*`;
        }

        return globPattern;
    }

    /**
     * 獲取內容搜索建議
     */
    private getContentSearchSuggestions(partialQuery: string): string[] {
        const suggestions: string[] = [];

        // 常見的代碼搜索模式
        const codePatterns = [
            'function ',
            'class ',
            'interface ',
            'const ',
            'let ',
            'var ',
            'import ',
            'export ',
            'async ',
            'await ',
            'return ',
            'throw ',
            'catch ',
            'try ',
            'if ',
            'else ',
            'for ',
            'while ',
            'switch ',
            'case '
        ];

        suggestions.push(
            ...codePatterns
                .filter(pattern => pattern.startsWith(partialQuery.toLowerCase()))
                .map(pattern => pattern + partialQuery.substring(pattern.length))
        );

        return suggestions;
    }

    /**
     * 獲取文件名搜索建議
     */
    private getFilenameSearchSuggestions(partialQuery: string): string[] {
        const suggestions: string[] = [];

        // 常見的文件擴展名
        const extensions = [
            '.ts', '.js', '.tsx', '.jsx', '.vue', '.html', '.css', '.scss',
            '.json', '.md', '.txt', '.xml', '.yaml', '.yml', '.toml',
            '.py', '.java', '.c', '.cpp', '.h', '.cs', '.php', '.rb',
            '.go', '.rs', '.swift', '.kt', '.dart', '.sh', '.bat'
        ];

        // 如果查詢包含點，可能是在搜索擴展名
        if (partialQuery.includes('.')) {
            suggestions.push(
                ...extensions
                    .filter(ext => ext.startsWith(partialQuery.substring(partialQuery.lastIndexOf('.'))))
                    .map(ext => partialQuery.substring(0, partialQuery.lastIndexOf('.')) + ext)
            );
        } else {
            // 常見的文件名模式
            const patterns = [
                'index.*',
                'main.*',
                'app.*',
                'config.*',
                'package.json',
                'tsconfig.json',
                'README.md',
                '*.test.*',
                '*.spec.*'
            ];

            suggestions.push(
                ...patterns.filter(pattern => 
                    pattern.toLowerCase().includes(partialQuery.toLowerCase())
                )
            );
        }

        return suggestions;
    }

    /**
     * 獲取符號搜索建議
     */
    private getSymbolSearchSuggestions(partialQuery: string): string[] {
        // 這裡可以基於當前工作區的符號提供建議
        // 暫時返回空數組，實際實作中可以緩存工作區符號
        return [];
    }

    /**
     * 添加到搜索歷史
     */
    private addToHistory(query: string): void {
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

        // 保存到存儲
        this.saveSearchHistory();
    }

    /**
     * 獲取搜索歷史
     */
    getSearchHistory(): string[] {
        return [...this.searchHistory];
    }

    /**
     * 清除搜索歷史
     */
    clearSearchHistory(): void {
        this.searchHistory = [];
        this.saveSearchHistory();
    }

    /**
     * 保存搜索歷史
     */
    private saveSearchHistory(): void {
        this.context.globalState.update('searchHistory', this.searchHistory);
    }

    /**
     * 載入搜索歷史
     */
    private loadSearchHistory(): void {
        const history = this.context.globalState.get<string[]>('searchHistory', []);
        this.searchHistory = history;
    }

    /**
     * 導出搜索結果
     */
    async exportSearchResults(
        results: SearchResult[],
        format: 'json' | 'csv' | 'markdown' = 'json'
    ): Promise<string> {
        switch (format) {
            case 'json':
                return JSON.stringify(results, null, 2);

            case 'csv':
                return this.convertToCSV(results);

            case 'markdown':
                return this.convertToMarkdown(results);

            default:
                throw new Error(`不支援的格式: ${format}`);
        }
    }

    /**
     * 轉換為 CSV 格式
     */
    private convertToCSV(results: SearchResult[]): string {
        const headers = ['File', 'Line', 'Column', 'Match', 'Preview'];
        const rows = [headers.join(',')];

        for (const result of results) {
            for (const match of result.matches) {
                const row = [
                    `"${result.relativePath}"`,
                    match.line.toString(),
                    match.column.toString(),
                    `"${match.text.replace(/"/g, '""')}"`,
                    `"${match.preview.replace(/"/g, '""')}"`
                ];
                rows.push(row.join(','));
            }
        }

        return rows.join('\n');
    }

    /**
     * 轉換為 Markdown 格式
     */
    private convertToMarkdown(results: SearchResult[]): string {
        const lines = ['# 搜索結果\n'];

        for (const result of results) {
            lines.push(`## ${result.relativePath}`);
            lines.push(`總匹配數: ${result.totalMatches}\n`);

            for (const match of result.matches) {
                lines.push(`**第 ${match.line} 行, 第 ${match.column} 列:**`);
                lines.push('```');
                lines.push(match.preview);
                lines.push('```\n');
            }
        }

        return lines.join('\n');
    }
}
