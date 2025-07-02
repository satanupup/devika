import * as vscode from 'vscode';
import * as ts from 'typescript';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';
import { FileOperationUtils } from '../utils/FileOperationUtils';

/**
 * 函數複雜度指標
 */
export interface ComplexityMetrics {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    linesOfCode: number;
    parameters: number;
    nestingDepth: number;
    returnStatements: number;
    branches: number;
}

/**
 * 函數分析結果
 */
export interface FunctionAnalysis {
    name: string;
    range: vscode.Range;
    metrics: ComplexityMetrics;
    issues: ComplexityIssue[];
    suggestions: RefactoringSuggestion[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 複雜度問題
 */
export interface ComplexityIssue {
    type: 'high_complexity' | 'deep_nesting' | 'too_many_params' | 'too_long' | 'too_many_returns';
    message: string;
    severity: 'warning' | 'error';
    range: vscode.Range;
}

/**
 * 重構建議
 */
export interface RefactoringSuggestion {
    type: 'extract_method' | 'reduce_parameters' | 'simplify_conditions' | 'split_function' | 'use_early_return';
    description: string;
    priority: 'low' | 'medium' | 'high';
    estimatedEffort: 'small' | 'medium' | 'large';
    codeExample?: string;
}

/**
 * 複雜度分析器
 * 分解過於複雜的函數，改進代碼可讀性
 */
export class ComplexityAnalyzer {
    private static instance: ComplexityAnalyzer;
    private readonly thresholds = {
        cyclomaticComplexity: {
            warning: 10,
            error: 15
        },
        cognitiveComplexity: {
            warning: 15,
            error: 25
        },
        linesOfCode: {
            warning: 50,
            error: 100
        },
        parameters: {
            warning: 5,
            error: 8
        },
        nestingDepth: {
            warning: 3,
            error: 5
        },
        returnStatements: {
            warning: 3,
            error: 5
        }
    };

    private constructor() {}

    static getInstance(): ComplexityAnalyzer {
        if (!ComplexityAnalyzer.instance) {
            ComplexityAnalyzer.instance = new ComplexityAnalyzer();
        }
        return ComplexityAnalyzer.instance;
    }

    /**
     * 分析文件中的函數複雜度
     */
    async analyzeFile(uri: vscode.Uri): Promise<FunctionAnalysis[]> {
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const content = await FileOperationUtils.readFile(uri);
                if (!content) {
                    throw new Error('無法讀取文件內容');
                }

                const sourceFile = ts.createSourceFile(
                    uri.fsPath,
                    content,
                    ts.ScriptTarget.Latest,
                    true
                );

                const functions: FunctionAnalysis[] = [];
                this.visitNode(sourceFile, sourceFile, functions);

                return functions.sort((a, b) => 
                    this.calculateRiskScore(b.metrics) - this.calculateRiskScore(a.metrics)
                );
            },
            `分析文件複雜度 ${uri.fsPath}`,
            { logError: true, showToUser: false }
        ).then(result => result.success ? result.data! : []);
    }

    /**
     * 訪問 AST 節點
     */
    private visitNode(
        node: ts.Node,
        sourceFile: ts.SourceFile,
        functions: FunctionAnalysis[]
    ): void {
        if (this.isFunctionLike(node)) {
            const analysis = this.analyzeFunctionNode(node, sourceFile);
            if (analysis) {
                functions.push(analysis);
            }
        }

        ts.forEachChild(node, child => this.visitNode(child, sourceFile, functions));
    }

    /**
     * 檢查是否為函數類型節點
     */
    private isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
        return ts.isFunctionDeclaration(node) ||
               ts.isMethodDeclaration(node) ||
               ts.isArrowFunction(node) ||
               ts.isFunctionExpression(node) ||
               ts.isConstructorDeclaration(node) ||
               ts.isGetAccessorDeclaration(node) ||
               ts.isSetAccessorDeclaration(node);
    }

    /**
     * 分析函數節點
     */
    private analyzeFunctionNode(
        node: ts.FunctionLikeDeclaration,
        sourceFile: ts.SourceFile
    ): FunctionAnalysis | null {
        const name = this.getFunctionName(node);
        const range = this.getRange(node, sourceFile);
        const metrics = this.calculateMetrics(node, sourceFile);
        const issues = this.identifyIssues(metrics, range);
        const suggestions = this.generateSuggestions(metrics, node);
        const riskLevel = this.calculateRiskLevel(metrics);

        return {
            name,
            range,
            metrics,
            issues,
            suggestions,
            riskLevel
        };
    }

    /**
     * 獲取函數名稱
     */
    private getFunctionName(node: ts.FunctionLikeDeclaration): string {
        if (ts.isFunctionDeclaration(node) && node.name) {
            return node.name.text;
        }
        if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
            return node.name.text;
        }
        if (ts.isConstructorDeclaration(node)) {
            return 'constructor';
        }
        if (ts.isGetAccessorDeclaration(node) && ts.isIdentifier(node.name)) {
            return `get ${node.name.text}`;
        }
        if (ts.isSetAccessorDeclaration(node) && ts.isIdentifier(node.name)) {
            return `set ${node.name.text}`;
        }
        return 'anonymous';
    }

    /**
     * 獲取範圍
     */
    private getRange(node: ts.Node, sourceFile: ts.SourceFile): vscode.Range {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        return new vscode.Range(
            new vscode.Position(start.line, start.character),
            new vscode.Position(end.line, end.character)
        );
    }

    /**
     * 計算複雜度指標
     */
    private calculateMetrics(
        node: ts.FunctionLikeDeclaration,
        sourceFile: ts.SourceFile
    ): ComplexityMetrics {
        const metrics: ComplexityMetrics = {
            cyclomaticComplexity: 1, // 基礎複雜度
            cognitiveComplexity: 0,
            linesOfCode: 0,
            parameters: node.parameters.length,
            nestingDepth: 0,
            returnStatements: 0,
            branches: 0
        };

        // 計算行數
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        metrics.linesOfCode = end.line - start.line + 1;

        // 遍歷函數體計算其他指標
        if (node.body) {
            this.calculateComplexityMetrics(node.body, metrics, 0);
        }

        return metrics;
    }

    /**
     * 遞歸計算複雜度指標
     */
    private calculateComplexityMetrics(
        node: ts.Node,
        metrics: ComplexityMetrics,
        currentDepth: number
    ): void {
        metrics.nestingDepth = Math.max(metrics.nestingDepth, currentDepth);

        switch (node.kind) {
            case ts.SyntaxKind.IfStatement:
                metrics.cyclomaticComplexity++;
                metrics.cognitiveComplexity += 1 + currentDepth;
                metrics.branches++;
                break;

            case ts.SyntaxKind.WhileStatement:
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.DoStatement:
                metrics.cyclomaticComplexity++;
                metrics.cognitiveComplexity += 2 + currentDepth;
                break;

            case ts.SyntaxKind.SwitchStatement:
                const switchStmt = node as ts.SwitchStatement;
                metrics.cyclomaticComplexity += switchStmt.caseBlock.clauses.length;
                metrics.cognitiveComplexity += 1 + currentDepth;
                metrics.branches += switchStmt.caseBlock.clauses.length;
                break;

            case ts.SyntaxKind.CatchClause:
                metrics.cyclomaticComplexity++;
                metrics.cognitiveComplexity += 2 + currentDepth;
                break;

            case ts.SyntaxKind.ConditionalExpression:
                metrics.cyclomaticComplexity++;
                metrics.cognitiveComplexity += 1 + currentDepth;
                break;

            case ts.SyntaxKind.ReturnStatement:
                metrics.returnStatements++;
                break;

            case ts.SyntaxKind.BinaryExpression:
                const binaryExpr = node as ts.BinaryExpression;
                if (binaryExpr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
                    binaryExpr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
                    metrics.cyclomaticComplexity++;
                    metrics.cognitiveComplexity++;
                }
                break;
        }

        // 遞歸處理子節點
        const newDepth = this.shouldIncreaseDepth(node) ? currentDepth + 1 : currentDepth;
        ts.forEachChild(node, child => {
            this.calculateComplexityMetrics(child, metrics, newDepth);
        });
    }

    /**
     * 檢查是否應該增加嵌套深度
     */
    private shouldIncreaseDepth(node: ts.Node): boolean {
        return ts.isIfStatement(node) ||
               ts.isWhileStatement(node) ||
               ts.isForStatement(node) ||
               ts.isForInStatement(node) ||
               ts.isForOfStatement(node) ||
               ts.isDoStatement(node) ||
               ts.isSwitchStatement(node) ||
               ts.isTryStatement(node) ||
               ts.isCatchClause(node);
    }

    /**
     * 識別複雜度問題
     */
    private identifyIssues(metrics: ComplexityMetrics, range: vscode.Range): ComplexityIssue[] {
        const issues: ComplexityIssue[] = [];

        if (metrics.cyclomaticComplexity >= this.thresholds.cyclomaticComplexity.error) {
            issues.push({
                type: 'high_complexity',
                message: `圈複雜度過高 (${metrics.cyclomaticComplexity})，建議重構`,
                severity: 'error',
                range
            });
        } else if (metrics.cyclomaticComplexity >= this.thresholds.cyclomaticComplexity.warning) {
            issues.push({
                type: 'high_complexity',
                message: `圈複雜度較高 (${metrics.cyclomaticComplexity})，考慮重構`,
                severity: 'warning',
                range
            });
        }

        if (metrics.nestingDepth >= this.thresholds.nestingDepth.error) {
            issues.push({
                type: 'deep_nesting',
                message: `嵌套層次過深 (${metrics.nestingDepth})，建議使用早期返回`,
                severity: 'error',
                range
            });
        }

        if (metrics.parameters >= this.thresholds.parameters.error) {
            issues.push({
                type: 'too_many_params',
                message: `參數過多 (${metrics.parameters})，考慮使用對象參數`,
                severity: 'error',
                range
            });
        }

        if (metrics.linesOfCode >= this.thresholds.linesOfCode.error) {
            issues.push({
                type: 'too_long',
                message: `函數過長 (${metrics.linesOfCode} 行)，建議拆分`,
                severity: 'error',
                range
            });
        }

        if (metrics.returnStatements >= this.thresholds.returnStatements.error) {
            issues.push({
                type: 'too_many_returns',
                message: `返回語句過多 (${metrics.returnStatements})，考慮重構`,
                severity: 'error',
                range
            });
        }

        return issues;
    }

    /**
     * 生成重構建議
     */
    private generateSuggestions(
        metrics: ComplexityMetrics,
        node: ts.FunctionLikeDeclaration
    ): RefactoringSuggestion[] {
        const suggestions: RefactoringSuggestion[] = [];

        if (metrics.cyclomaticComplexity > 10) {
            suggestions.push({
                type: 'extract_method',
                description: '提取複雜邏輯到獨立方法',
                priority: 'high',
                estimatedEffort: 'medium',
                codeExample: '// 將複雜的條件邏輯提取到 isValidCondition() 方法'
            });
        }

        if (metrics.parameters > 5) {
            suggestions.push({
                type: 'reduce_parameters',
                description: '使用對象參數或配置對象',
                priority: 'medium',
                estimatedEffort: 'small',
                codeExample: '// function process(config: ProcessConfig) { ... }'
            });
        }

        if (metrics.nestingDepth > 3) {
            suggestions.push({
                type: 'use_early_return',
                description: '使用早期返回減少嵌套',
                priority: 'high',
                estimatedEffort: 'small',
                codeExample: '// if (!condition) return; // 早期返回'
            });
        }

        if (metrics.linesOfCode > 50) {
            suggestions.push({
                type: 'split_function',
                description: '將函數拆分為多個小函數',
                priority: 'high',
                estimatedEffort: 'large'
            });
        }

        if (metrics.branches > 5) {
            suggestions.push({
                type: 'simplify_conditions',
                description: '簡化條件邏輯，使用策略模式',
                priority: 'medium',
                estimatedEffort: 'medium'
            });
        }

        return suggestions.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * 計算風險等級
     */
    private calculateRiskLevel(metrics: ComplexityMetrics): 'low' | 'medium' | 'high' | 'critical' {
        const score = this.calculateRiskScore(metrics);
        
        if (score >= 80) return 'critical';
        if (score >= 60) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    /**
     * 計算風險分數
     */
    private calculateRiskScore(metrics: ComplexityMetrics): number {
        let score = 0;
        
        // 圈複雜度權重 30%
        score += Math.min(30, (metrics.cyclomaticComplexity / 20) * 30);
        
        // 認知複雜度權重 25%
        score += Math.min(25, (metrics.cognitiveComplexity / 30) * 25);
        
        // 代碼行數權重 20%
        score += Math.min(20, (metrics.linesOfCode / 100) * 20);
        
        // 嵌套深度權重 15%
        score += Math.min(15, (metrics.nestingDepth / 6) * 15);
        
        // 參數數量權重 10%
        score += Math.min(10, (metrics.parameters / 10) * 10);
        
        return Math.round(score);
    }

    /**
     * 生成重構報告
     */
    generateRefactoringReport(analyses: FunctionAnalysis[]): string {
        const criticalFunctions = analyses.filter(a => a.riskLevel === 'critical');
        const highRiskFunctions = analyses.filter(a => a.riskLevel === 'high');
        
        let report = '# 函數複雜度分析報告\n\n';
        
        report += `## 概覽\n`;
        report += `- 總函數數量: ${analyses.length}\n`;
        report += `- 高風險函數: ${criticalFunctions.length + highRiskFunctions.length}\n`;
        report += `- 需要立即重構: ${criticalFunctions.length}\n\n`;
        
        if (criticalFunctions.length > 0) {
            report += `## 🚨 緊急需要重構的函數\n\n`;
            criticalFunctions.forEach(func => {
                report += `### ${func.name}\n`;
                report += `- 圈複雜度: ${func.metrics.cyclomaticComplexity}\n`;
                report += `- 代碼行數: ${func.metrics.linesOfCode}\n`;
                report += `- 主要問題: ${func.issues.map(i => i.message).join(', ')}\n`;
                report += `- 建議: ${func.suggestions[0]?.description || '無'}\n\n`;
            });
        }
        
        return report;
    }
}
