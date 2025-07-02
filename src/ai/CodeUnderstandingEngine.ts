import * as vscode from 'vscode';
import * as ts from 'typescript';
import * as path from 'path';
import { FileOperationUtils } from '../utils/FileOperationUtils';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 代碼符號類型
 */
export enum SymbolType {
    CLASS = 'class',
    INTERFACE = 'interface',
    FUNCTION = 'function',
    METHOD = 'method',
    PROPERTY = 'property',
    VARIABLE = 'variable',
    ENUM = 'enum',
    TYPE = 'type',
    IMPORT = 'import',
    EXPORT = 'export'
}

/**
 * 代碼符號接口
 */
export interface CodeSymbol {
    name: string;
    type: SymbolType;
    uri: vscode.Uri;
    range: vscode.Range;
    detail?: string;
    documentation?: string;
    signature?: string;
    returnType?: string;
    parameters?: Parameter[];
    dependencies?: string[];
    usages?: CodeReference[];
    complexity?: number;
}

/**
 * 參數接口
 */
export interface Parameter {
    name: string;
    type: string;
    optional: boolean;
    defaultValue?: string;
}

/**
 * 代碼引用接口
 */
export interface CodeReference {
    uri: vscode.Uri;
    range: vscode.Range;
    context: string;
}

/**
 * 代碼關係接口
 */
export interface CodeRelationship {
    from: CodeSymbol;
    to: CodeSymbol;
    type: 'extends' | 'implements' | 'uses' | 'calls' | 'imports';
    strength: number;
}

/**
 * 代碼分析結果
 */
export interface CodeAnalysis {
    symbols: CodeSymbol[];
    relationships: CodeRelationship[];
    complexity: number;
    maintainabilityIndex: number;
    testCoverage?: number;
    issues: CodeIssue[];
    dependencies?: string[];
}

/**
 * 代碼問題接口
 */
export interface CodeIssue {
    type: 'error' | 'warning' | 'suggestion';
    message: string;
    uri: vscode.Uri;
    range: vscode.Range;
    severity: vscode.DiagnosticSeverity;
    fixable: boolean;
    suggestedFix?: string;
}

/**
 * 代碼理解引擎
 * 提供深度的代碼分析和理解功能
 */
export class CodeUnderstandingEngine {
    private static instance: CodeUnderstandingEngine;
    private symbolIndex: Map<string, CodeSymbol[]> = new Map();
    private relationshipGraph: Map<string, CodeRelationship[]> = new Map();
    private analysisCache: Map<string, CodeAnalysis> = new Map();
    private tsProgram: ts.Program | null = null;

    private constructor() {
        this.initializeTypeScriptProgram();
    }

    static getInstance(): CodeUnderstandingEngine {
        if (!CodeUnderstandingEngine.instance) {
            CodeUnderstandingEngine.instance = new CodeUnderstandingEngine();
        }
        return CodeUnderstandingEngine.instance;
    }

    /**
     * 初始化 TypeScript 程序
     */
    private async initializeTypeScriptProgram(): Promise<void> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) return;

            const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
            const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

            if (configFile.error) {
                console.warn('無法讀取 tsconfig.json:', configFile.error);
                return;
            }

            const parsedConfig = ts.parseJsonConfigFileContent(
                configFile.config,
                ts.sys,
                workspaceRoot
            );

            this.tsProgram = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
        } catch (error) {
            console.error('初始化 TypeScript 程序失敗:', error);
        }
    }

    /**
     * 分析文件
     */
    async analyzeFile(uri: vscode.Uri): Promise<CodeAnalysis> {
        const cacheKey = uri.toString();

        // 檢查緩存
        if (this.analysisCache.has(cacheKey)) {
            return this.analysisCache.get(cacheKey)!;
        }

        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const content = await FileOperationUtils.readFile(uri);
                if (!content) {
                    throw new Error('無法讀取文件內容');
                }

                const analysis = await this.performAnalysis(uri, content);
                this.analysisCache.set(cacheKey, analysis);
                return analysis;
            },
            `分析文件 ${uri.fsPath}`,
            { logError: true, showToUser: false }
        );

        return result.success ? result.data! : this.createEmptyAnalysis();
    }

    /**
     * 執行代碼分析
     */
    private async performAnalysis(uri: vscode.Uri, content: string): Promise<CodeAnalysis> {
        const symbols = await this.extractSymbols(uri, content);
        const relationships = await this.analyzeRelationships(symbols);
        const complexity = this.calculateComplexity(content);
        const maintainabilityIndex = this.calculateMaintainabilityIndex(content, complexity);
        const issues = await this.detectIssues(uri, content);

        return {
            symbols,
            relationships,
            complexity,
            maintainabilityIndex,
            issues
        };
    }

    /**
     * 提取代碼符號
     */
    private async extractSymbols(uri: vscode.Uri, content: string): Promise<CodeSymbol[]> {
        const symbols: CodeSymbol[] = [];

        try {
            const sourceFile = ts.createSourceFile(
                uri.fsPath,
                content,
                ts.ScriptTarget.Latest,
                true
            );

            const visit = (node: ts.Node) => {
                const symbol = this.nodeToSymbol(node, uri, sourceFile);
                if (symbol) {
                    symbols.push(symbol);
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        } catch (error) {
            console.error('提取符號失敗:', error);
        }

        return symbols;
    }

    /**
     * 將 AST 節點轉換為符號
     */
    private nodeToSymbol(node: ts.Node, uri: vscode.Uri, sourceFile: ts.SourceFile): CodeSymbol | null {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const range = new vscode.Range(start.line, start.character, end.line, end.character);

        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration:
                const classDecl = node as ts.ClassDeclaration;
                return {
                    name: classDecl.name?.text || 'anonymous',
                    type: SymbolType.CLASS,
                    uri,
                    range,
                    detail: this.getClassDetail(classDecl),
                    signature: this.getClassSignature(classDecl)
                };

            case ts.SyntaxKind.InterfaceDeclaration:
                const interfaceDecl = node as ts.InterfaceDeclaration;
                return {
                    name: interfaceDecl.name.text,
                    type: SymbolType.INTERFACE,
                    uri,
                    range,
                    detail: this.getInterfaceDetail(interfaceDecl),
                    signature: this.getInterfaceSignature(interfaceDecl)
                };

            case ts.SyntaxKind.FunctionDeclaration:
                const funcDecl = node as ts.FunctionDeclaration;
                return {
                    name: funcDecl.name?.text || 'anonymous',
                    type: SymbolType.FUNCTION,
                    uri,
                    range,
                    detail: this.getFunctionDetail(funcDecl),
                    signature: this.getFunctionSignature(funcDecl),
                    parameters: this.extractParameters(funcDecl.parameters),
                    complexity: this.calculateFunctionComplexity(funcDecl)
                };

            case ts.SyntaxKind.MethodDeclaration:
                const methodDecl = node as ts.MethodDeclaration;
                return {
                    name: (methodDecl.name as ts.Identifier).text,
                    type: SymbolType.METHOD,
                    uri,
                    range,
                    detail: this.getMethodDetail(methodDecl),
                    signature: this.getMethodSignature(methodDecl),
                    parameters: this.extractParameters(methodDecl.parameters),
                    complexity: this.calculateFunctionComplexity(methodDecl)
                };

            default:
                return null;
        }
    }

    /**
     * 分析代碼關係
     */
    private async analyzeRelationships(symbols: CodeSymbol[]): Promise<CodeRelationship[]> {
        const relationships: CodeRelationship[] = [];

        // 分析繼承關係
        // 分析依賴關係
        // 分析調用關係

        return relationships;
    }

    /**
     * 計算圈複雜度
     */
    private calculateComplexity(content: string): number {
        let complexity = 1; // 基礎複雜度

        // 計算決策點
        const decisionPoints = [
            /\bif\b/g,
            /\belse\b/g,
            /\bwhile\b/g,
            /\bfor\b/g,
            /\bswitch\b/g,
            /\bcase\b/g,
            /\bcatch\b/g,
            /\b\?\b/g, // 三元運算符
            /\b&&\b/g,
            /\b\|\|\b/g
        ];

        decisionPoints.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        });

        return complexity;
    }

    /**
     * 計算可維護性指數
     */
    private calculateMaintainabilityIndex(content: string, complexity: number): number {
        const linesOfCode = content.split('\n').length;
        const halsteadVolume = this.calculateHalsteadVolume(content);

        // 簡化的可維護性指數計算
        const maintainabilityIndex = Math.max(0,
            171 - 5.2 * Math.log(halsteadVolume) - 0.23 * complexity - 16.2 * Math.log(linesOfCode)
        );

        return Math.round(maintainabilityIndex);
    }

    /**
     * 計算 Halstead 體積
     */
    private calculateHalsteadVolume(content: string): number {
        // 簡化的 Halstead 體積計算
        const operators = content.match(/[+\-*/=<>!&|?:;,(){}[\]]/g) || [];
        const operands = content.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];

        const uniqueOperators = new Set(operators).size;
        const uniqueOperands = new Set(operands).size;
        const totalOperators = operators.length;
        const totalOperands = operands.length;

        const vocabulary = uniqueOperators + uniqueOperands;
        const length = totalOperators + totalOperands;

        return length * Math.log2(vocabulary || 1);
    }

    /**
     * 檢測代碼問題
     */
    private async detectIssues(uri: vscode.Uri, content: string): Promise<CodeIssue[]> {
        const issues: CodeIssue[] = [];

        // 檢測常見問題
        await this.detectComplexityIssues(uri, content, issues);
        await this.detectNamingIssues(uri, content, issues);
        await this.detectDuplicationIssues(uri, content, issues);

        return issues;
    }

    /**
     * 檢測複雜度問題
     */
    private async detectComplexityIssues(uri: vscode.Uri, content: string, issues: CodeIssue[]): Promise<void> {
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            if (line.length > 120) {
                issues.push({
                    type: 'warning',
                    message: '行長度超過 120 字符',
                    uri,
                    range: new vscode.Range(index, 0, index, line.length),
                    severity: vscode.DiagnosticSeverity.Warning,
                    fixable: false
                });
            }
        });
    }

    /**
     * 檢測命名問題
     */
    private async detectNamingIssues(uri: vscode.Uri, content: string, issues: CodeIssue[]): Promise<void> {
        // 檢測變量命名規範
        const variablePattern = /\b(var|let|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;

        while ((match = variablePattern.exec(content)) !== null) {
            const variableName = match[2];
            if (variableName.length < 3 && !['i', 'j', 'k', 'id'].includes(variableName)) {
                const position = this.getPositionFromIndex(content, match.index);
                issues.push({
                    type: 'suggestion',
                    message: `變量名 '${variableName}' 太短，建議使用更具描述性的名稱`,
                    uri,
                    range: new vscode.Range(position.line, position.character, position.line, position.character + variableName.length),
                    severity: vscode.DiagnosticSeverity.Information,
                    fixable: false
                });
            }
        }
    }

    /**
     * 檢測重複代碼
     */
    private async detectDuplicationIssues(uri: vscode.Uri, content: string, issues: CodeIssue[]): Promise<void> {
        // 簡化的重複代碼檢測
        const lines = content.split('\n');
        const lineMap = new Map<string, number[]>();

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine.length > 10) { // 忽略短行
                if (!lineMap.has(trimmedLine)) {
                    lineMap.set(trimmedLine, []);
                }
                lineMap.get(trimmedLine)!.push(index);
            }
        });

        lineMap.forEach((lineNumbers, line) => {
            if (lineNumbers.length > 1) {
                lineNumbers.forEach(lineNumber => {
                    issues.push({
                        type: 'suggestion',
                        message: '檢測到重複代碼',
                        uri,
                        range: new vscode.Range(lineNumber, 0, lineNumber, line.length),
                        severity: vscode.DiagnosticSeverity.Information,
                        fixable: false
                    });
                });
            }
        });
    }

    /**
     * 輔助方法
     */
    private getPositionFromIndex(content: string, index: number): vscode.Position {
        const lines = content.substring(0, index).split('\n');
        return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
    }

    private getClassDetail(node: ts.ClassDeclaration): string {
        return `Class with ${node.members.length} members`;
    }

    private getClassSignature(node: ts.ClassDeclaration): string {
        return `class ${node.name?.text || 'anonymous'}`;
    }

    private getInterfaceDetail(node: ts.InterfaceDeclaration): string {
        return `Interface with ${node.members.length} members`;
    }

    private getInterfaceSignature(node: ts.InterfaceDeclaration): string {
        return `interface ${node.name.text}`;
    }

    private getFunctionDetail(node: ts.FunctionDeclaration): string {
        return `Function with ${node.parameters.length} parameters`;
    }

    private getFunctionSignature(node: ts.FunctionDeclaration): string {
        const params = node.parameters.map(p => (p.name as ts.Identifier).text).join(', ');
        return `function ${node.name?.text || 'anonymous'}(${params})`;
    }

    private getMethodDetail(node: ts.MethodDeclaration): string {
        return `Method with ${node.parameters.length} parameters`;
    }

    private getMethodSignature(node: ts.MethodDeclaration): string {
        const params = node.parameters.map(p => (p.name as ts.Identifier).text).join(', ');
        return `${(node.name as ts.Identifier).text}(${params})`;
    }

    private extractParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>): Parameter[] {
        return parameters.map(param => ({
            name: (param.name as ts.Identifier).text,
            type: param.type ? param.type.getText() : 'any',
            optional: !!param.questionToken,
            defaultValue: param.initializer?.getText()
        }));
    }

    private calculateFunctionComplexity(node: ts.FunctionDeclaration | ts.MethodDeclaration): number {
        let complexity = 1;

        const visit = (node: ts.Node) => {
            switch (node.kind) {
                case ts.SyntaxKind.IfStatement:
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                case ts.SyntaxKind.SwitchStatement:
                case ts.SyntaxKind.CatchClause:
                case ts.SyntaxKind.ConditionalExpression:
                    complexity++;
                    break;
            }
            ts.forEachChild(node, visit);
        };

        visit(node);
        return complexity;
    }

    private createEmptyAnalysis(): CodeAnalysis {
        return {
            symbols: [],
            relationships: [],
            complexity: 0,
            maintainabilityIndex: 0,
            issues: []
        };
    }

    /**
     * 清理緩存
     */
    clearCache(): void {
        this.analysisCache.clear();
        this.symbolIndex.clear();
        this.relationshipGraph.clear();
    }

    /**
     * 獲取符號建議
     */
    async getSymbolSuggestions(query: string, uri: vscode.Uri): Promise<CodeSymbol[]> {
        const analysis = await this.analyzeFile(uri);
        return analysis.symbols.filter(symbol =>
            symbol.name.toLowerCase().includes(query.toLowerCase())
        );
    }

    /**
     * 獲取文件符號
     */
    async getDocumentSymbols(document: vscode.TextDocument): Promise<CodeSymbol[]> {
        const analysis = await this.analyzeFile(document.uri);
        return analysis.symbols;
    }

    /**
     * 獲取工作區符號
     */
    async getWorkspaceSymbols(query: string): Promise<CodeSymbol[]> {
        // 這是一個簡化的實現，實際應用中需要更高效的索引
        const allSymbols: CodeSymbol[] = [];
        for (const uriString of this.analysisCache.keys()) {
            const analysis = this.analysisCache.get(uriString)!;
            allSymbols.push(...analysis.symbols);
        }
        return allSymbols.filter(symbol =>
            symbol.name.toLowerCase().includes(query.toLowerCase())
        );
    }

    /**
     * 生成智能建議
     */
    async generateSmartSuggestions(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { maxSuggestions: number; includeDocumentation: boolean; contextWindow: number }
    ): Promise<any[]> {
        // 佔位符實現
        console.log('Generating smart suggestions for', document.uri.fsPath, 'at', position);
        return [];
    }
}
