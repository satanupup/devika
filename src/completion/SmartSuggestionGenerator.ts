import * as vscode from 'vscode';
import { CodeCompletionItem, CompletionType, CompletionContext } from './CodeCompletionEngine';
import { CodeUnderstandingEngine } from '../ai/CodeUnderstandingEngine';
import { ContextManager } from '../context/ContextManager';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 智能建議類型
 */
export enum SmartSuggestionType {
  VARIABLE_NAME = 'variable_name',
  FUNCTION_NAME = 'function_name',
  PARAMETER_NAME = 'parameter_name',
  IMPORT_SUGGESTION = 'import_suggestion',
  TYPE_ANNOTATION = 'type_annotation',
  ERROR_FIX = 'error_fix',
  REFACTORING = 'refactoring',
  PATTERN_COMPLETION = 'pattern_completion',
  API_USAGE = 'api_usage',
  BEST_PRACTICE = 'best_practice'
}

/**
 * 智能建議項目
 */
export interface SmartSuggestion {
  id: string;
  type: SmartSuggestionType;
  title: string;
  description: string;
  insertText: string | vscode.SnippetString;
  confidence: number;
  reasoning: string;
  examples?: string[];
  documentation?: vscode.MarkdownString;
  additionalEdits?: vscode.TextEdit[];
  command?: vscode.Command;
}

/**
 * 建議上下文
 */
export interface SuggestionContext {
  document: vscode.TextDocument;
  position: vscode.Position;
  currentWord: string;
  currentLine: string;
  precedingCode: string;
  followingCode: string;
  semanticInfo: {
    inFunction: boolean;
    inClass: boolean;
    inInterface: boolean;
    expectedType?: string;
    availableVariables: string[];
    availableFunctions: string[];
    availableTypes: string[];
  };
  codePatterns: {
    recentPatterns: string[];
    commonPatterns: string[];
    userPreferences: string[];
  };
}

/**
 * 智能建議生成器
 * 基於代碼分析和 AI 生成智能建議
 */
export class SmartSuggestionGenerator {
  private static instance: SmartSuggestionGenerator;
  private codeEngine: CodeUnderstandingEngine;
  private contextManager: ContextManager;
  private suggestionCache: Map<string, SmartSuggestion[]> = new Map();
  private patternDatabase: Map<string, string[]> = new Map();

  private constructor() {
    this.codeEngine = CodeUnderstandingEngine.getInstance();
    this.contextManager = ContextManager.getInstance();
    this.initializePatternDatabase();
  }

  static getInstance(): SmartSuggestionGenerator {
    if (!SmartSuggestionGenerator.instance) {
      SmartSuggestionGenerator.instance = new SmartSuggestionGenerator();
    }
    return SmartSuggestionGenerator.instance;
  }

  /**
   * 生成智能建議
   */
  async generateSmartSuggestions(
    context: CompletionContext,
    maxSuggestions: number = 10
  ): Promise<CodeCompletionItem[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 構建建議上下文
        const suggestionContext = await this.buildSuggestionContext(context);
        
        // 檢查快取
        const cacheKey = this.generateCacheKey(suggestionContext);
        if (this.suggestionCache.has(cacheKey)) {
          return this.convertToCompletionItems(this.suggestionCache.get(cacheKey)!);
        }

        // 生成不同類型的智能建議
        const suggestions: SmartSuggestion[] = [];

        // 並行生成各種建議
        const generators = [
          this.generateVariableNameSuggestions(suggestionContext),
          this.generateFunctionNameSuggestions(suggestionContext),
          this.generateImportSuggestions(suggestionContext),
          this.generateTypeAnnotationSuggestions(suggestionContext),
          this.generatePatternCompletions(suggestionContext),
          this.generateAPIUsageSuggestions(suggestionContext),
          this.generateBestPracticeSuggestions(suggestionContext),
          this.generateErrorFixSuggestions(suggestionContext)
        ];

        const results = await Promise.allSettled(generators);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            suggestions.push(...result.value);
          } else {
            console.warn(`智能建議生成器 ${index} 失敗:`, result.reason);
          }
        });

        // 排序和過濾
        const rankedSuggestions = this.rankSuggestions(suggestions, suggestionContext);
        const topSuggestions = rankedSuggestions.slice(0, maxSuggestions);

        // 快取結果
        this.suggestionCache.set(cacheKey, topSuggestions);

        return this.convertToCompletionItems(topSuggestions);
      },
      '生成智能建議',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 生成變數名建議
   */
  private async generateVariableNameSuggestions(context: SuggestionContext): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    try {
      // 分析當前上下文中的變數命名模式
      const namingPatterns = this.analyzeNamingPatterns(context);
      
      // 基於類型推斷建議變數名
      if (context.semanticInfo.expectedType) {
        const typeBasedNames = this.generateTypeBasedNames(context.semanticInfo.expectedType);
        
        for (const name of typeBasedNames) {
          suggestions.push({
            id: `var-${name}`,
            type: SmartSuggestionType.VARIABLE_NAME,
            title: name,
            description: `基於類型 ${context.semanticInfo.expectedType} 的變數名建議`,
            insertText: name,
            confidence: 0.8,
            reasoning: `根據預期類型 ${context.semanticInfo.expectedType} 生成的語義化變數名`
          });
        }
      }

      // 基於上下文建議變數名
      const contextualNames = this.generateContextualNames(context);
      for (const name of contextualNames) {
        suggestions.push({
          id: `ctx-var-${name}`,
          type: SmartSuggestionType.VARIABLE_NAME,
          title: name,
          description: '基於上下文的變數名建議',
          insertText: name,
          confidence: 0.7,
          reasoning: '根據周圍代碼上下文生成的變數名'
        });
      }

    } catch (error) {
      console.warn('生成變數名建議失敗:', error);
    }

    return suggestions;
  }

  /**
   * 生成函數名建議
   */
  private async generateFunctionNameSuggestions(context: SuggestionContext): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    try {
      // 分析函數用途
      const functionPurpose = this.analyzeFunctionPurpose(context);
      
      if (functionPurpose) {
        const functionNames = this.generateFunctionNames(functionPurpose);
        
        for (const name of functionNames) {
          suggestions.push({
            id: `func-${name}`,
            type: SmartSuggestionType.FUNCTION_NAME,
            title: name,
            description: `基於功能用途的函數名建議`,
            insertText: name,
            confidence: 0.75,
            reasoning: `根據函數用途 "${functionPurpose}" 生成的函數名`
          });
        }
      }

    } catch (error) {
      console.warn('生成函數名建議失敗:', error);
    }

    return suggestions;
  }

  /**
   * 生成導入建議
   */
  private async generateImportSuggestions(context: SuggestionContext): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    try {
      // 分析未解析的符號
      const unresolvedSymbols = await this.findUnresolvedSymbols(context);
      
      for (const symbol of unresolvedSymbols) {
        const importSuggestions = await this.suggestImportsForSymbol(symbol, context);
        suggestions.push(...importSuggestions);
      }

      // 建議常用庫的導入
      const commonImports = this.getCommonImports(context.document.languageId);
      for (const importSuggestion of commonImports) {
        suggestions.push({
          id: `import-${importSuggestion.module}`,
          type: SmartSuggestionType.IMPORT_SUGGESTION,
          title: `import ${importSuggestion.name}`,
          description: `從 ${importSuggestion.module} 導入 ${importSuggestion.name}`,
          insertText: new vscode.SnippetString(importSuggestion.statement),
          confidence: 0.6,
          reasoning: `常用的 ${importSuggestion.module} 庫導入`,
          additionalEdits: importSuggestion.edits
        });
      }

    } catch (error) {
      console.warn('生成導入建議失敗:', error);
    }

    return suggestions;
  }

  /**
   * 生成類型註解建議
   */
  private async generateTypeAnnotationSuggestions(context: SuggestionContext): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    try {
      if (context.document.languageId === 'typescript') {
        // 分析需要類型註解的位置
        const typeAnnotationNeeded = this.analyzeTypeAnnotationNeeds(context);
        
        if (typeAnnotationNeeded) {
          const inferredType = await this.inferType(context);
          
          if (inferredType) {
            suggestions.push({
              id: `type-${inferredType}`,
              type: SmartSuggestionType.TYPE_ANNOTATION,
              title: `: ${inferredType}`,
              description: `添加類型註解 ${inferredType}`,
              insertText: `: ${inferredType}`,
              confidence: 0.85,
              reasoning: `基於代碼分析推斷的類型 ${inferredType}`
            });
          }
        }
      }

    } catch (error) {
      console.warn('生成類型註解建議失敗:', error);
    }

    return suggestions;
  }

  /**
   * 生成模式完成建議
   */
  private async generatePatternCompletions(context: SuggestionContext): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    try {
      // 檢測常見的代碼模式
      const detectedPatterns = this.detectCodePatterns(context);
      
      for (const pattern of detectedPatterns) {
        const completion = this.getPatternCompletion(pattern, context);
        if (completion) {
          suggestions.push({
            id: `pattern-${pattern}`,
            type: SmartSuggestionType.PATTERN_COMPLETION,
            title: completion.title,
            description: completion.description,
            insertText: new vscode.SnippetString(completion.template),
            confidence: 0.7,
            reasoning: `檢測到 ${pattern} 模式，建議完成代碼`,
            examples: completion.examples
          });
        }
      }

    } catch (error) {
      console.warn('生成模式完成建議失敗:', error);
    }

    return suggestions;
  }

  /**
   * 生成 API 使用建議
   */
  private async generateAPIUsageSuggestions(context: SuggestionContext): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    try {
      // 分析當前使用的 API
      const currentAPI = this.analyzeCurrentAPI(context);
      
      if (currentAPI) {
        const apiSuggestions = await this.getAPISuggestions(currentAPI, context);
        suggestions.push(...apiSuggestions);
      }

    } catch (error) {
      console.warn('生成 API 使用建議失敗:', error);
    }

    return suggestions;
  }

  /**
   * 生成最佳實踐建議
   */
  private async generateBestPracticeSuggestions(context: SuggestionContext): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    try {
      // 檢查代碼品質問題
      const qualityIssues = this.analyzeCodeQuality(context);
      
      for (const issue of qualityIssues) {
        const bestPractice = this.getBestPracticeForIssue(issue);
        if (bestPractice) {
          suggestions.push({
            id: `bp-${issue.type}`,
            type: SmartSuggestionType.BEST_PRACTICE,
            title: bestPractice.title,
            description: bestPractice.description,
            insertText: new vscode.SnippetString(bestPractice.fix),
            confidence: 0.6,
            reasoning: bestPractice.reasoning,
            documentation: new vscode.MarkdownString(bestPractice.documentation)
          });
        }
      }

    } catch (error) {
      console.warn('生成最佳實踐建議失敗:', error);
    }

    return suggestions;
  }

  /**
   * 生成錯誤修復建議
   */
  private async generateErrorFixSuggestions(context: SuggestionContext): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    try {
      // 獲取當前文件的診斷信息
      const diagnostics = vscode.languages.getDiagnostics(context.document.uri);
      
      for (const diagnostic of diagnostics) {
        if (this.isNearPosition(diagnostic.range, context.position)) {
          const fix = this.generateErrorFix(diagnostic, context);
          if (fix) {
            suggestions.push({
              id: `fix-${diagnostic.code}`,
              type: SmartSuggestionType.ERROR_FIX,
              title: fix.title,
              description: fix.description,
              insertText: fix.insertText,
              confidence: 0.9,
              reasoning: fix.reasoning,
              additionalEdits: fix.edits
            });
          }
        }
      }

    } catch (error) {
      console.warn('生成錯誤修復建議失敗:', error);
    }

    return suggestions;
  }

  /**
   * 私有輔助方法
   */
  private async buildSuggestionContext(context: CompletionContext): Promise<SuggestionContext> {
    const semanticInfo = await this.analyzeSemanticInfo(context);
    const codePatterns = await this.analyzeCodePatterns(context);

    return {
      document: context.document,
      position: context.position,
      currentWord: context.currentWord,
      currentLine: context.currentLine,
      precedingCode: context.precedingText,
      followingCode: context.followingText,
      semanticInfo,
      codePatterns
    };
  }

  private async analyzeSemanticInfo(context: CompletionContext): Promise<SuggestionContext['semanticInfo']> {
    return {
      inFunction: context.semanticContext.isInFunction,
      inClass: context.semanticContext.isInClass,
      inInterface: false, // 需要實現
      expectedType: context.semanticContext.expectedType,
      availableVariables: context.scope.variables,
      availableFunctions: [], // 需要實現
      availableTypes: context.scope.types
    };
  }

  private async analyzeCodePatterns(context: CompletionContext): Promise<SuggestionContext['codePatterns']> {
    return {
      recentPatterns: [], // 需要實現
      commonPatterns: [], // 需要實現
      userPreferences: [] // 需要實現
    };
  }

  private generateCacheKey(context: SuggestionContext): string {
    return `${context.document.uri.toString()}-${context.position.line}-${context.position.character}-${context.currentWord}`;
  }

  private rankSuggestions(suggestions: SmartSuggestion[], context: SuggestionContext): SmartSuggestion[] {
    return suggestions.sort((a, b) => {
      // 按信心度排序
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      
      // 按類型優先級排序
      const typePriority = {
        [SmartSuggestionType.ERROR_FIX]: 10,
        [SmartSuggestionType.TYPE_ANNOTATION]: 9,
        [SmartSuggestionType.IMPORT_SUGGESTION]: 8,
        [SmartSuggestionType.PATTERN_COMPLETION]: 7,
        [SmartSuggestionType.VARIABLE_NAME]: 6,
        [SmartSuggestionType.FUNCTION_NAME]: 5,
        [SmartSuggestionType.API_USAGE]: 4,
        [SmartSuggestionType.BEST_PRACTICE]: 3,
        [SmartSuggestionType.PARAMETER_NAME]: 2,
        [SmartSuggestionType.REFACTORING]: 1
      };
      
      return (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
    });
  }

  private convertToCompletionItems(suggestions: SmartSuggestion[]): CodeCompletionItem[] {
    return suggestions.map(suggestion => ({
      id: suggestion.id,
      label: suggestion.title,
      detail: suggestion.description,
      documentation: suggestion.documentation,
      insertText: suggestion.insertText,
      kind: this.getCompletionItemKind(suggestion.type),
      type: CompletionType.SMART_SUGGESTION,
      priority: Math.round(suggestion.confidence * 100),
      confidence: suggestion.confidence,
      source: 'ai',
      metadata: {
        language: suggestion.type,
        context: [suggestion.reasoning],
        usage: 0,
        lastUsed: new Date(),
        userPreference: 0
      },
      additionalTextEdits: suggestion.additionalEdits,
      command: suggestion.command
    }));
  }

  private getCompletionItemKind(type: SmartSuggestionType): vscode.CompletionItemKind {
    const kindMap = {
      [SmartSuggestionType.VARIABLE_NAME]: vscode.CompletionItemKind.Variable,
      [SmartSuggestionType.FUNCTION_NAME]: vscode.CompletionItemKind.Function,
      [SmartSuggestionType.PARAMETER_NAME]: vscode.CompletionItemKind.Variable,
      [SmartSuggestionType.IMPORT_SUGGESTION]: vscode.CompletionItemKind.Module,
      [SmartSuggestionType.TYPE_ANNOTATION]: vscode.CompletionItemKind.TypeParameter,
      [SmartSuggestionType.ERROR_FIX]: vscode.CompletionItemKind.Issue,
      [SmartSuggestionType.REFACTORING]: vscode.CompletionItemKind.Reference,
      [SmartSuggestionType.PATTERN_COMPLETION]: vscode.CompletionItemKind.Snippet,
      [SmartSuggestionType.API_USAGE]: vscode.CompletionItemKind.Method,
      [SmartSuggestionType.BEST_PRACTICE]: vscode.CompletionItemKind.Text
    };
    
    return kindMap[type] || vscode.CompletionItemKind.Text;
  }

  private initializePatternDatabase(): void {
    // 初始化常見代碼模式數據庫
    this.patternDatabase.set('error-handling', [
      'try-catch',
      'promise-catch',
      'async-await-try'
    ]);
    
    this.patternDatabase.set('async-patterns', [
      'promise-chain',
      'async-await',
      'callback-pattern'
    ]);
    
    this.patternDatabase.set('react-patterns', [
      'useEffect-hook',
      'useState-hook',
      'component-lifecycle'
    ]);
  }

  // 佔位符方法 - 需要具體實現
  private analyzeNamingPatterns(context: SuggestionContext): any { return {}; }
  private generateTypeBasedNames(type: string): string[] { return []; }
  private generateContextualNames(context: SuggestionContext): string[] { return []; }
  private analyzeFunctionPurpose(context: SuggestionContext): string | null { return null; }
  private generateFunctionNames(purpose: string): string[] { return []; }
  private async findUnresolvedSymbols(context: SuggestionContext): Promise<string[]> { return []; }
  private async suggestImportsForSymbol(symbol: string, context: SuggestionContext): Promise<SmartSuggestion[]> { return []; }
  private getCommonImports(language: string): any[] { return []; }
  private analyzeTypeAnnotationNeeds(context: SuggestionContext): boolean { return false; }
  private async inferType(context: SuggestionContext): Promise<string | null> { return null; }
  private detectCodePatterns(context: SuggestionContext): string[] { return []; }
  private getPatternCompletion(pattern: string, context: SuggestionContext): any { return null; }
  private analyzeCurrentAPI(context: SuggestionContext): string | null { return null; }
  private async getAPISuggestions(api: string, context: SuggestionContext): Promise<SmartSuggestion[]> { return []; }
  private analyzeCodeQuality(context: SuggestionContext): any[] { return []; }
  private getBestPracticeForIssue(issue: any): any { return null; }
  private isNearPosition(range: vscode.Range, position: vscode.Position): boolean { return false; }
  private generateErrorFix(diagnostic: vscode.Diagnostic, context: SuggestionContext): any { return null; }

  /**
   * 清理資源
   */
  dispose(): void {
    this.suggestionCache.clear();
    this.patternDatabase.clear();
  }
}
