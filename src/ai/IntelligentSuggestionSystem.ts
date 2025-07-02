import * as vscode from 'vscode';
import { CodeUnderstandingEngine, CodeSymbol, CodeAnalysis } from './CodeUnderstandingEngine';
import { ContextAwareSystem, ContextType } from './ContextAwareSystem';
import { ComplexityAnalyzer, FunctionAnalysis } from '../refactoring/ComplexityAnalyzer';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 建議類型
 */
export enum SuggestionType {
    REFACTORING = 'refactoring',
    OPTIMIZATION = 'optimization',
    BUG_FIX = 'bug_fix',
    CODE_STYLE = 'code_style',
    DOCUMENTATION = 'documentation',
    TESTING = 'testing',
    SECURITY = 'security',
    PERFORMANCE = 'performance'
}

/**
 * 建議優先級
 */
export enum SuggestionPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * 智能建議接口
 */
export interface IntelligentSuggestion {
    id: string;
    type: SuggestionType;
    priority: SuggestionPriority;
    title: string;
    description: string;
    uri: vscode.Uri;
    range: vscode.Range;
    codeExample?: string;
    fixedCode?: string;
    reasoning: string;
    confidence: number;
    estimatedImpact: 'low' | 'medium' | 'high';
    estimatedEffort: 'small' | 'medium' | 'large';
    tags: string[];
    relatedSuggestions?: string[];
}

/**
 * 建議上下文
 */
export interface SuggestionContext {
    currentFile: vscode.Uri;
    selectedText?: string;
    selectedRange?: vscode.Range;
    recentChanges?: vscode.TextDocumentChangeEvent[];
    userIntent?: string;
    projectContext?: {
        language: string;
        framework?: string;
        testingFramework?: string;
    };
}

/**
 * 智能建議系統
 * 實現基於代碼分析的智能建議和重構提示
 */
export class IntelligentSuggestionSystem {
    private static instance: IntelligentSuggestionSystem;
    private codeEngine: CodeUnderstandingEngine;
    private contextSystem: ContextAwareSystem;
    private complexityAnalyzer: ComplexityAnalyzer;
    private suggestions: Map<string, IntelligentSuggestion> = new Map();
    private suggestionProviders: Map<SuggestionType, SuggestionProvider> = new Map();

    private constructor() {
        this.codeEngine = CodeUnderstandingEngine.getInstance();
        this.contextSystem = ContextAwareSystem.getInstance();
        this.complexityAnalyzer = ComplexityAnalyzer.getInstance();
        this.initializeSuggestionProviders();
    }

    static getInstance(): IntelligentSuggestionSystem {
        if (!IntelligentSuggestionSystem.instance) {
            IntelligentSuggestionSystem.instance = new IntelligentSuggestionSystem();
        }
        return IntelligentSuggestionSystem.instance;
    }

    /**
     * 生成智能建議
     */
    async generateSuggestions(context: SuggestionContext): Promise<IntelligentSuggestion[]> {
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const suggestions: IntelligentSuggestion[] = [];
                
                // 分析當前文件
                const analysis = await this.codeEngine.analyzeFile(context.currentFile);
                const complexityAnalysis = await this.complexityAnalyzer.analyzeFile(context.currentFile);
                
                // 並行生成不同類型的建議
                const suggestionPromises = Array.from(this.suggestionProviders.entries()).map(
                    async ([type, provider]) => {
                        try {
                            return await provider.generateSuggestions(context, analysis, complexityAnalysis);
                        } catch (error) {
                            console.warn(`建議提供者 ${type} 失敗:`, error);
                            return [];
                        }
                    }
                );

                const allSuggestions = await Promise.all(suggestionPromises);
                suggestions.push(...allSuggestions.flat());

                // 過濾和排序建議
                const filteredSuggestions = this.filterAndRankSuggestions(suggestions, context);
                
                // 緩存建議
                filteredSuggestions.forEach(suggestion => {
                    this.suggestions.set(suggestion.id, suggestion);
                });

                return filteredSuggestions;
            },
            '生成智能建議',
            { logError: true, showToUser: false }
        ).then(result => result.success ? result.data! : []);
    }

    /**
     * 獲取特定範圍的建議
     */
    async getSuggestionsForRange(
        uri: vscode.Uri,
        range: vscode.Range
    ): Promise<IntelligentSuggestion[]> {
        const context: SuggestionContext = {
            currentFile: uri,
            selectedRange: range,
            selectedText: await this.getTextInRange(uri, range)
        };

        return this.generateSuggestions(context);
    }

    /**
     * 應用建議
     */
    async applySuggestion(suggestionId: string): Promise<boolean> {
        const suggestion = this.suggestions.get(suggestionId);
        if (!suggestion || !suggestion.fixedCode) {
            return false;
        }

        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(suggestion.uri, suggestion.range, suggestion.fixedCode!);
                
                const success = await vscode.workspace.applyEdit(edit);
                
                if (success) {
                    // 添加到上下文
                    await this.contextSystem.addContext(
                        ContextType.TASK,
                        `Applied suggestion: ${suggestion.title}`,
                        {
                            uri: suggestion.uri,
                            range: suggestion.range,
                            tags: ['suggestion-applied', suggestion.type],
                            priority: 'medium'
                        }
                    );
                }
                
                return success;
            },
            `應用建議 ${suggestion.title}`,
            { logError: true, showToUser: true }
        ).then(result => result.success && result.data === true);
    }

    /**
     * 初始化建議提供者
     */
    private initializeSuggestionProviders(): void {
        this.suggestionProviders.set(SuggestionType.REFACTORING, new RefactoringSuggestionProvider());
        this.suggestionProviders.set(SuggestionType.OPTIMIZATION, new OptimizationSuggestionProvider());
        this.suggestionProviders.set(SuggestionType.BUG_FIX, new BugFixSuggestionProvider());
        this.suggestionProviders.set(SuggestionType.CODE_STYLE, new CodeStyleSuggestionProvider());
        this.suggestionProviders.set(SuggestionType.DOCUMENTATION, new DocumentationSuggestionProvider());
        this.suggestionProviders.set(SuggestionType.TESTING, new TestingSuggestionProvider());
        this.suggestionProviders.set(SuggestionType.SECURITY, new SecuritySuggestionProvider());
        this.suggestionProviders.set(SuggestionType.PERFORMANCE, new PerformanceSuggestionProvider());
    }

    /**
     * 過濾和排序建議
     */
    private filterAndRankSuggestions(
        suggestions: IntelligentSuggestion[],
        context: SuggestionContext
    ): IntelligentSuggestion[] {
        // 過濾低信心度的建議
        let filtered = suggestions.filter(s => s.confidence >= 0.6);

        // 去重
        filtered = this.deduplicateSuggestions(filtered);

        // 按優先級和信心度排序
        filtered.sort((a, b) => {
            const priorityOrder = {
                [SuggestionPriority.CRITICAL]: 4,
                [SuggestionPriority.HIGH]: 3,
                [SuggestionPriority.MEDIUM]: 2,
                [SuggestionPriority.LOW]: 1
            };

            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;

            return b.confidence - a.confidence;
        });

        // 限制數量
        return filtered.slice(0, 20);
    }

    /**
     * 去重建議
     */
    private deduplicateSuggestions(suggestions: IntelligentSuggestion[]): IntelligentSuggestion[] {
        const seen = new Set<string>();
        return suggestions.filter(suggestion => {
            const key = `${suggestion.type}-${suggestion.uri.fsPath}-${suggestion.range.start.line}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 獲取範圍內的文本
     */
    private async getTextInRange(uri: vscode.Uri, range: vscode.Range): Promise<string> {
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText(range);
    }

    /**
     * 生成建議 ID
     */
    private generateSuggestionId(): string {
        return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * 建議提供者基類
 */
abstract class SuggestionProvider {
    abstract generateSuggestions(
        context: SuggestionContext,
        analysis: CodeAnalysis,
        complexityAnalysis: FunctionAnalysis[]
    ): Promise<IntelligentSuggestion[]>;

    protected createSuggestion(
        type: SuggestionType,
        priority: SuggestionPriority,
        title: string,
        description: string,
        uri: vscode.Uri,
        range: vscode.Range,
        reasoning: string,
        confidence: number,
        options: Partial<IntelligentSuggestion> = {}
    ): IntelligentSuggestion {
        return {
            id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            priority,
            title,
            description,
            uri,
            range,
            reasoning,
            confidence,
            estimatedImpact: 'medium',
            estimatedEffort: 'medium',
            tags: [],
            ...options
        };
    }
}

/**
 * 重構建議提供者
 */
class RefactoringSuggestionProvider extends SuggestionProvider {
    async generateSuggestions(
        context: SuggestionContext,
        analysis: CodeAnalysis,
        complexityAnalysis: FunctionAnalysis[]
    ): Promise<IntelligentSuggestion[]> {
        const suggestions: IntelligentSuggestion[] = [];

        // 檢查複雜函數
        for (const func of complexityAnalysis) {
            if (func.riskLevel === 'high' || func.riskLevel === 'critical') {
                suggestions.push(this.createSuggestion(
                    SuggestionType.REFACTORING,
                    func.riskLevel === 'critical' ? SuggestionPriority.CRITICAL : SuggestionPriority.HIGH,
                    `重構複雜函數 ${func.name}`,
                    `函數 ${func.name} 的複雜度過高，建議拆分為多個小函數`,
                    context.currentFile,
                    func.range,
                    `圈複雜度: ${func.metrics.cyclomaticComplexity}, 代碼行數: ${func.metrics.linesOfCode}`,
                    0.9,
                    {
                        estimatedImpact: 'high',
                        estimatedEffort: 'large',
                        tags: ['complexity', 'maintainability']
                    }
                ));
            }
        }

        return suggestions;
    }
}

/**
 * 優化建議提供者
 */
class OptimizationSuggestionProvider extends SuggestionProvider {
    async generateSuggestions(
        context: SuggestionContext,
        analysis: CodeAnalysis,
        complexityAnalysis: FunctionAnalysis[]
    ): Promise<IntelligentSuggestion[]> {
        const suggestions: IntelligentSuggestion[] = [];

        // 檢查性能問題
        for (const issue of analysis.issues) {
            if (issue.message.includes('性能') || issue.message.includes('優化')) {
                suggestions.push(this.createSuggestion(
                    SuggestionType.OPTIMIZATION,
                    SuggestionPriority.MEDIUM,
                    '性能優化機會',
                    issue.message,
                    context.currentFile,
                    issue.range,
                    '檢測到潛在的性能問題',
                    0.7,
                    {
                        tags: ['performance']
                    }
                ));
            }
        }

        return suggestions;
    }
}

/**
 * Bug 修復建議提供者
 */
class BugFixSuggestionProvider extends SuggestionProvider {
    async generateSuggestions(
        context: SuggestionContext,
        analysis: CodeAnalysis,
        complexityAnalysis: FunctionAnalysis[]
    ): Promise<IntelligentSuggestion[]> {
        const suggestions: IntelligentSuggestion[] = [];

        // 檢查潛在的 bug
        for (const issue of analysis.issues) {
            if (issue.severity === vscode.DiagnosticSeverity.Error) {
                suggestions.push(this.createSuggestion(
                    SuggestionType.BUG_FIX,
                    SuggestionPriority.HIGH,
                    '修復潛在錯誤',
                    issue.message,
                    context.currentFile,
                    issue.range,
                    '檢測到可能導致運行時錯誤的代碼',
                    0.8,
                    {
                        estimatedImpact: 'high',
                        tags: ['bug', 'error']
                    }
                ));
            }
        }

        return suggestions;
    }
}

/**
 * 代碼風格建議提供者
 */
class CodeStyleSuggestionProvider extends SuggestionProvider {
    async generateSuggestions(): Promise<IntelligentSuggestion[]> {
        // 實現代碼風格建議
        return [];
    }
}

/**
 * 文檔建議提供者
 */
class DocumentationSuggestionProvider extends SuggestionProvider {
    async generateSuggestions(): Promise<IntelligentSuggestion[]> {
        // 實現文檔建議
        return [];
    }
}

/**
 * 測試建議提供者
 */
class TestingSuggestionProvider extends SuggestionProvider {
    async generateSuggestions(): Promise<IntelligentSuggestion[]> {
        // 實現測試建議
        return [];
    }
}

/**
 * 安全建議提供者
 */
class SecuritySuggestionProvider extends SuggestionProvider {
    async generateSuggestions(): Promise<IntelligentSuggestion[]> {
        // 實現安全建議
        return [];
    }
}

/**
 * 性能建議提供者
 */
class PerformanceSuggestionProvider extends SuggestionProvider {
    async generateSuggestions(): Promise<IntelligentSuggestion[]> {
        // 實現性能建議
        return [];
    }
}
