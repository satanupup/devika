import * as vscode from 'vscode';

export interface TodoItem {
    text: string;
    type: 'TODO' | 'FIXME' | 'HACK' | 'NOTE';
    range: vscode.Range;
    line: number;
}

export interface ImportInfo {
    path: string;
    imports: string[];
    isDefault: boolean;
    range: vscode.Range;
}

export class CodeParser {
    private todoPatterns = [
        /\/\/\s*(TODO|FIXME|HACK|NOTE):?\s*(.+)/gi,
        /\/\*\s*(TODO|FIXME|HACK|NOTE):?\s*(.+?)\*\//gi,
        /#\s*(TODO|FIXME|HACK|NOTE):?\s*(.+)/gi,
        /<!--\s*(TODO|FIXME|HACK|NOTE):?\s*(.+?)\s*-->/gi
    ];

    async extractTodos(document: vscode.TextDocument): Promise<TodoItem[]> {
        const todos: TodoItem[] = [];
        const text = document.getText();

        for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
            const line = document.lineAt(lineIndex);
            const lineText = line.text;

            for (const pattern of this.todoPatterns) {
                pattern.lastIndex = 0; // 重設正則表達式
                let match;

                while ((match = pattern.exec(lineText)) !== null) {
                    const type = match[1].toUpperCase() as TodoItem['type'];
                    const text = match[2].trim();
                    
                    const startPos = new vscode.Position(lineIndex, match.index);
                    const endPos = new vscode.Position(lineIndex, match.index + match[0].length);
                    const range = new vscode.Range(startPos, endPos);

                    todos.push({
                        text,
                        type,
                        range,
                        line: lineIndex + 1
                    });
                }
            }
        }

        return todos;
    }

    async extractImports(document: vscode.TextDocument): Promise<string[]> {
        const imports: string[] = [];
        const text = document.getText();
        const language = document.languageId;

        const patterns = this.getImportPatterns(language);

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const importPath = match[1] || match[2];
                if (importPath) {
                    imports.push(importPath);
                }
            }
        }

        return [...new Set(imports)]; // 去重
    }

    private getImportPatterns(language: string): RegExp[] {
        switch (language) {
            case 'typescript':
            case 'javascript':
                return [
                    /import\s+.*from\s+['"`]([^'"`]+)['"`]/g,
                    /require\(['"`]([^'"`]+)['"`]\)/g,
                    /import\(['"`]([^'"`]+)['"`]\)/g
                ];

            case 'python':
                return [
                    /from\s+([^\s]+)\s+import/g,
                    /import\s+([^\s,]+)/g
                ];

            case 'java':
                return [
                    /import\s+([^;]+);/g
                ];

            case 'csharp':
                return [
                    /using\s+([^;]+);/g
                ];

            case 'go':
                return [
                    /import\s+"([^"]+)"/g,
                    /import\s+\(\s*"([^"]+)"/g
                ];

            case 'rust':
                return [
                    /use\s+([^;]+);/g
                ];

            default:
                return [];
        }
    }

    async extractFunctions(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            return this.filterFunctions(symbols || []);
        } catch (error) {
            console.error('提取函式失敗:', error);
            return [];
        }
    }

    private filterFunctions(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
        const functions: vscode.DocumentSymbol[] = [];

        for (const symbol of symbols) {
            if (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Method) {
                functions.push(symbol);
            }

            if (symbol.children) {
                functions.push(...this.filterFunctions(symbol.children));
            }
        }

        return functions;
    }

    async extractClasses(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            return this.filterClasses(symbols || []);
        } catch (error) {
            console.error('提取類別失敗:', error);
            return [];
        }
    }

    private filterClasses(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
        const classes: vscode.DocumentSymbol[] = [];

        for (const symbol of symbols) {
            if (symbol.kind === vscode.SymbolKind.Class || symbol.kind === vscode.SymbolKind.Interface) {
                classes.push(symbol);
            }

            if (symbol.children) {
                classes.push(...this.filterClasses(symbol.children));
            }
        }

        return classes;
    }

    async extractComments(document: vscode.TextDocument): Promise<{ text: string; range: vscode.Range }[]> {
        const comments: { text: string; range: vscode.Range }[] = [];
        const language = document.languageId;
        const text = document.getText();

        const patterns = this.getCommentPatterns(language);

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);

                comments.push({
                    text: match[0],
                    range
                });
            }
        }

        return comments;
    }

    private getCommentPatterns(language: string): RegExp[] {
        switch (language) {
            case 'typescript':
            case 'javascript':
            case 'java':
            case 'csharp':
            case 'cpp':
            case 'go':
            case 'rust':
                return [
                    /\/\/.*$/gm,
                    /\/\*[\s\S]*?\*\//g
                ];

            case 'python':
                return [
                    /#.*$/gm,
                    /"""[\s\S]*?"""/g,
                    /'''[\s\S]*?'''/g
                ];

            case 'html':
            case 'xml':
                return [
                    /<!--[\s\S]*?-->/g
                ];

            default:
                return [];
        }
    }

    async analyzeComplexity(document: vscode.TextDocument, range?: vscode.Range): Promise<{
        cyclomaticComplexity: number;
        linesOfCode: number;
        cognitiveComplexity: number;
    }> {
        const text = range ? document.getText(range) : document.getText();
        
        // 簡單的複雜度分析
        const cyclomaticComplexity = this.calculateCyclomaticComplexity(text);
        const linesOfCode = this.countLinesOfCode(text);
        const cognitiveComplexity = this.calculateCognitiveComplexity(text);

        return {
            cyclomaticComplexity,
            linesOfCode,
            cognitiveComplexity
        };
    }

    private calculateCyclomaticComplexity(code: string): number {
        // 計算圈複雜度
        const patterns = [
            /\bif\b/g,
            /\belse\b/g,
            /\bwhile\b/g,
            /\bfor\b/g,
            /\bswitch\b/g,
            /\bcase\b/g,
            /\bcatch\b/g,
            /\b&&\b/g,
            /\b\|\|\b/g,
            /\?\s*.*\s*:/g // 三元運算子
        ];

        let complexity = 1; // 基礎複雜度

        for (const pattern of patterns) {
            const matches = code.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }

        return complexity;
    }

    private countLinesOfCode(code: string): number {
        // 計算有效程式碼行數（排除空行和註解）
        const lines = code.split('\n');
        let loc = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
                loc++;
            }
        }

        return loc;
    }

    private calculateCognitiveComplexity(code: string): number {
        // 簡化的認知複雜度計算
        const patterns = [
            { pattern: /\bif\b/g, weight: 1 },
            { pattern: /\belse\s+if\b/g, weight: 1 },
            { pattern: /\belse\b/g, weight: 1 },
            { pattern: /\bswitch\b/g, weight: 1 },
            { pattern: /\bfor\b/g, weight: 1 },
            { pattern: /\bwhile\b/g, weight: 1 },
            { pattern: /\bcatch\b/g, weight: 1 },
            { pattern: /\b&&\b/g, weight: 1 },
            { pattern: /\b\|\|\b/g, weight: 1 },
            { pattern: /\?\s*.*\s*:/g, weight: 1 }
        ];

        let complexity = 0;

        for (const { pattern, weight } of patterns) {
            const matches = code.match(pattern);
            if (matches) {
                complexity += matches.length * weight;
            }
        }

        return complexity;
    }

    async extractVariables(document: vscode.TextDocument, range?: vscode.Range): Promise<string[]> {
        const text = range ? document.getText(range) : document.getText();
        const language = document.languageId;
        const variables: string[] = [];

        const patterns = this.getVariablePatterns(language);

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                if (match[1]) {
                    variables.push(match[1]);
                }
            }
        }

        return [...new Set(variables)]; // 去重
    }

    private getVariablePatterns(language: string): RegExp[] {
        switch (language) {
            case 'typescript':
            case 'javascript':
                return [
                    /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
                    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
                ];

            case 'python':
                return [
                    /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm,
                    /def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
                ];

            case 'java':
            case 'csharp':
                return [
                    /(?:public|private|protected|static)?\s*(?:final|readonly)?\s*[a-zA-Z_][a-zA-Z0-9_<>]*\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
                ];

            default:
                return [];
        }
    }

    isTestFile(document: vscode.TextDocument): boolean {
        const fileName = document.fileName.toLowerCase();
        const testPatterns = [
            /\.test\./,
            /\.spec\./,
            /_test\./,
            /test_.*\.py$/,
            /.*_test\.py$/,
            /.*Test\.java$/,
            /.*Tests\.cs$/
        ];

        return testPatterns.some(pattern => pattern.test(fileName));
    }

    getFileType(document: vscode.TextDocument): 'source' | 'test' | 'config' | 'documentation' {
        const fileName = document.fileName.toLowerCase();

        if (this.isTestFile(document)) {
            return 'test';
        }

        const configPatterns = [
            /package\.json$/,
            /tsconfig\.json$/,
            /\.config\./,
            /\.yml$/,
            /\.yaml$/,
            /\.toml$/,
            /\.ini$/
        ];

        if (configPatterns.some(pattern => pattern.test(fileName))) {
            return 'config';
        }

        const docPatterns = [
            /\.md$/,
            /\.txt$/,
            /readme/i,
            /changelog/i,
            /license/i
        ];

        if (docPatterns.some(pattern => pattern.test(fileName))) {
            return 'documentation';
        }

        return 'source';
    }
}
