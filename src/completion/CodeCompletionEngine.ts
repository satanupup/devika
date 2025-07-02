import * as vscode from 'vscode';
import { CodeUnderstandingEngine } from '../ai/CodeUnderstandingEngine';
import { ContextManager } from '../context/ContextManager';
import { LearningEngine } from '../learning/LearningEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 代碼完成類型
 */
export enum CompletionType {
  VARIABLE = 'variable',
  FUNCTION = 'function',
  CLASS = 'class',
  INTERFACE = 'interface',
  ENUM = 'enum',
  IMPORT = 'import',
  PROPERTY = 'property',
  METHOD = 'method',
  PARAMETER = 'parameter',
  TYPE = 'type',
  KEYWORD = 'keyword',
  SNIPPET = 'snippet',
  TEMPLATE = 'template',
  SMART_SUGGESTION = 'smart_suggestion'
}

/**
 * 代碼完成項目
 */
export interface CodeCompletionItem {
  id: string;
  label: string;
  detail?: string;
  documentation?: string | vscode.MarkdownString;
  insertText: string | vscode.SnippetString;
  kind: vscode.CompletionItemKind;
  type: CompletionType;
  priority: number;
  confidence: number;
  source: 'builtin' | 'workspace' | 'dependencies' | 'ai' | 'learned';
  metadata: {
    language: string;
    framework?: string;
    context: string[];
    usage: number;
    lastUsed: Date;
    userPreference: number;
  };
  filterText?: string;
  sortText?: string;
  preselect?: boolean;
  commitCharacters?: string[];
  command?: vscode.Command;
  additionalTextEdits?: vscode.TextEdit[];
}

/**
 * 完成上下文
 */
export interface CompletionContext {
  document: vscode.TextDocument;
  position: vscode.Position;
  triggerCharacter?: string;
  triggerKind: vscode.CompletionTriggerKind;
  currentLine: string;
  currentWord: string;
  precedingText: string;
  followingText: string;
  indentation: string;
  scope: {
    function?: string;
    class?: string;
    namespace?: string;
    imports: string[];
    variables: string[];
    types: string[];
  };
  semanticContext: {
    expectedType?: string;
    isInFunction: boolean;
    isInClass: boolean;
    isInComment: boolean;
    isInString: boolean;
    isAfterDot: boolean;
    isAfterNew: boolean;
    isAfterReturn: boolean;
    isAfterImport: boolean;
  };
}

/**
 * 完成配置
 */
export interface CompletionConfig {
  enabled: boolean;
  maxSuggestions: number;
  enableAISuggestions: boolean;
  enableLearning: boolean;
  enableSnippets: boolean;
  enableImportSuggestions: boolean;
  enableTypeInference: boolean;
  enableContextualSuggestions: boolean;
  prioritizeRecentlyUsed: boolean;
  showDocumentation: boolean;
  autoImport: boolean;
  suggestionDelay: number;
  confidenceThreshold: number;
  languages: string[];
  excludePatterns: string[];
}

/**
 * 智能代碼完成引擎
 * 提供個性化的內聯代碼完成功能
 */
export class CodeCompletionEngine implements vscode.CompletionItemProvider {
  private static instance: CodeCompletionEngine;
  private codeEngine: CodeUnderstandingEngine;
  private contextManager: ContextManager;
  private learningEngine: LearningEngine;
  private context: vscode.ExtensionContext;
  private config: CompletionConfig;
  private completionCache: Map<string, CodeCompletionItem[]> = new Map();
  private usageStats: Map<string, number> = new Map();
  private recentCompletions: CodeCompletionItem[] = [];

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.codeEngine = CodeUnderstandingEngine.getInstance();
    this.contextManager = new ContextManager(context);
    this.learningEngine = LearningEngine.getInstance();
    this.config = {} as CompletionConfig; // Initialize with a default value
    this.loadConfiguration();
  }

  static getInstance(context: vscode.ExtensionContext): CodeCompletionEngine {
    if (!CodeCompletionEngine.instance) {
      CodeCompletionEngine.instance = new CodeCompletionEngine(context);
    }
    return CodeCompletionEngine.instance;
  }

  /**
   * VS Code CompletionItemProvider 實現
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!this.config.enabled) {
          return [];
        }

        // 構建完成上下文
        const completionContext = await this.buildCompletionContext(document, position, context);

        // 檢查快取
        const cacheKey = this.generateCacheKey(completionContext);
        if (this.completionCache.has(cacheKey)) {
          return this.formatCompletionItems(this.completionCache.get(cacheKey)!);
        }

        // 生成完成建議
        const completions = await this.generateCompletions(completionContext, token);

        // 快取結果
        this.completionCache.set(cacheKey, completions);

        // 清理過期快取
        this.cleanupCache();

        return this.formatCompletionItems(completions);
      },
      '提供代碼完成',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 解析完成項目
   */
  async resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 添加詳細文檔
        if (this.config.showDocumentation && !item.documentation) {
          const documentation = await this.generateDocumentation(item);
          if (documentation) {
            item.documentation = documentation;
          }
        }

        // 添加額外的文本編輯
        if (this.config.autoImport && item.kind === vscode.CompletionItemKind.Function) {
          const additionalEdits = await this.generateImportEdits(item);
          if (additionalEdits.length > 0) {
            item.additionalTextEdits = additionalEdits;
          }
        }

        return item;
      },
      '解析完成項目',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : item);
  }

  /**
   * 生成完成建議
   */
  private async generateCompletions(
    context: CompletionContext,
    token: vscode.CancellationToken
  ): Promise<CodeCompletionItem[]> {
    const completions: CodeCompletionItem[] = [];

    // 並行生成不同類型的完成建議
    const generators = [
      this.generateBuiltinCompletions(context),
      this.generateWorkspaceCompletions(context),
      this.generateDependencyCompletions(context),
      this.generateSnippetCompletions(context),
      this.generateAICompletions(context),
      this.generateLearnedCompletions(context)
    ];

    const results = await Promise.allSettled(generators);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        completions.push(...result.value);
      } else {
        console.warn(`完成生成器 ${index} 失敗:`, result.reason);
      }
    });

    // 排序和過濾
    return this.rankAndFilterCompletions(completions, context);
  }

  /**
   * 生成內建完成建議
   */
  private async generateBuiltinCompletions(context: CompletionContext): Promise<CodeCompletionItem[]> {
    const completions: CodeCompletionItem[] = [];
    const language = context.document.languageId;

    // JavaScript/TypeScript 內建建議
    if (language === 'javascript' || language === 'typescript') {
      completions.push(...this.getJavaScriptBuiltins(context));
    }

    // Python 內建建議
    if (language === 'python') {
      completions.push(...this.getPythonBuiltins(context));
    }

    // 通用關鍵字
    completions.push(...this.getLanguageKeywords(language, context));

    return completions;
  }

  /**
   * 生成工作區完成建議
   */
  private async generateWorkspaceCompletions(context: CompletionContext): Promise<CodeCompletionItem[]> {
    const completions: CodeCompletionItem[] = [];

    try {
      // 獲取工作區符號
      const symbols = await this.codeEngine.getWorkspaceSymbols(context.currentWord);

      for (const symbol of symbols) {
        const completion = await this.createCompletionFromSymbol(symbol, context);
        if (completion) {
          completions.push(completion);
        }
      }

      // 獲取當前文件的局部符號
      const localSymbols = await this.codeEngine.getDocumentSymbols(context.document);
      for (const symbol of localSymbols) {
        const completion = await this.createCompletionFromLocalSymbol(symbol, context);
        if (completion) {
          completions.push(completion);
        }
      }

    } catch (error) {
      console.warn('生成工作區完成建議失敗:', error);
    }

    return completions;
  }

  /**
   * 生成依賴項完成建議
   */
  private async generateDependencyCompletions(context: CompletionContext): Promise<CodeCompletionItem[]> {
    const completions: CodeCompletionItem[] = [];

    try {
      // 分析導入語句
      const imports = context.scope.imports;

      // 為每個導入生成完成建議
      for (const importPath of imports) {
        const dependencyCompletions = await this.getDependencyCompletions(importPath, context);
        completions.push(...dependencyCompletions);
      }

      // 建議新的導入
      if (context.semanticContext.isAfterImport || context.currentWord.length > 2) {
        const importSuggestions = await this.getImportSuggestions(context);
        completions.push(...importSuggestions);
      }

    } catch (error) {
      console.warn('生成依賴項完成建議失敗:', error);
    }

    return completions;
  }

  /**
   * 生成代碼片段完成建議
   */
  private async generateSnippetCompletions(context: CompletionContext): Promise<CodeCompletionItem[]> {
    if (!this.config.enableSnippets) {
      return [];
    }

    const completions: CodeCompletionItem[] = [];
    const language = context.document.languageId;

    try {
      // 獲取語言特定的代碼片段
      const snippets = await this.getLanguageSnippets(language, context);
      completions.push(...snippets);

      // 獲取框架特定的代碼片段
      const framework = await this.detectFramework(context.document);
      if (framework) {
        const frameworkSnippets = await this.getFrameworkSnippets(framework, context);
        completions.push(...frameworkSnippets);
      }

      // 獲取用戶自定義代碼片段
      const userSnippets = await this.getUserSnippets(language, context);
      completions.push(...userSnippets);

    } catch (error) {
      console.warn('生成代碼片段完成建議失敗:', error);
    }

    return completions;
  }

  /**
   * 生成 AI 完成建議
   */
  private async generateAICompletions(context: CompletionContext): Promise<CodeCompletionItem[]> {
    if (!this.config.enableAISuggestions) {
      return [];
    }

    const completions: CodeCompletionItem[] = [];

    try {
      // 使用 AI 生成智能建議
      const aiSuggestions = await this.codeEngine.generateSmartSuggestions(
        context.document,
        context.position,
        {
          maxSuggestions: 5,
          includeDocumentation: true,
          contextWindow: 100
        }
      );

      for (const suggestion of aiSuggestions) {
        const completion = this.createAICompletion(suggestion, context);
        if (completion) {
          completions.push(completion);
        }
      }

    } catch (error) {
      console.warn('生成 AI 完成建議失敗:', error);
    }

    return completions;
  }

  /**
   * 生成學習型完成建議
   */
  private async generateLearnedCompletions(context: CompletionContext): Promise<CodeCompletionItem[]> {
    if (!this.config.enableLearning) {
      return [];
    }

    const completions: CodeCompletionItem[] = [];

    try {
      // 獲取用戶習慣的完成模式
      const learnedPatterns = await this.learningEngine.getCompletionPatterns(
        context.document.languageId,
        context.currentWord
      );

      for (const pattern of learnedPatterns) {
        const completion = this.createLearnedCompletion(pattern, context);
        if (completion) {
          completions.push(completion);
        }
      }

      // 獲取最近使用的完成項目
      const recentCompletions = this.getRecentCompletions(context);
      completions.push(...recentCompletions);

    } catch (error) {
      console.warn('生成學習型完成建議失敗:', error);
    }

    return completions;
  }

  /**
   * 排序和過濾完成建議
   */
  private rankAndFilterCompletions(
    completions: CodeCompletionItem[],
    context: CompletionContext
  ): CodeCompletionItem[] {
    // 去重
    const uniqueCompletions = this.deduplicateCompletions(completions);

    // 過濾低信心度的建議
    const filteredCompletions = uniqueCompletions.filter(
      completion => completion.confidence >= this.config.confidenceThreshold
    );

    // 排序
    const sortedCompletions = filteredCompletions.sort((a, b) => {
      // 優先級排序
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // 信心度排序
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // 使用頻率排序
      if (this.config.prioritizeRecentlyUsed) {
        const aUsage = this.usageStats.get(a.id) || 0;
        const bUsage = this.usageStats.get(b.id) || 0;
        if (aUsage !== bUsage) {
          return bUsage - aUsage;
        }
      }

      // 字母順序排序
      return a.label.localeCompare(b.label);
    });

    // 限制數量
    return sortedCompletions.slice(0, this.config.maxSuggestions);
  }

  /**
   * 構建完成上下文
   */
  private async buildCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.CompletionContext
  ): Promise<CompletionContext> {
    const line = document.lineAt(position);
    const currentLine = line.text;
    const currentWord = this.getCurrentWord(document, position);
    const precedingText = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const followingText = document.getText(new vscode.Range(position, new vscode.Position(document.lineCount, 0)));

    // 分析語義上下文
    const semanticContext = await this.analyzeSemanticContext(document, position, currentLine);

    // 分析作用域
    const scope = await this.analyzeScope(document, position);

    return {
      document,
      position,
      triggerCharacter: context.triggerCharacter,
      triggerKind: context.triggerKind,
      currentLine,
      currentWord,
      precedingText,
      followingText,
      indentation: this.getIndentation(currentLine),
      scope,
      semanticContext
    };
  }

  /**
   * 分析語義上下文
   */
  private async analyzeSemanticContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    currentLine: string
  ): Promise<CompletionContext['semanticContext']> {
    const linePrefix = currentLine.substring(0, position.character);
    const lineSuffix = currentLine.substring(position.character);

    return {
      isInFunction: await this.isInFunction(document, position),
      isInClass: await this.isInClass(document, position),
      isInComment: this.isInComment(linePrefix),
      isInString: this.isInString(linePrefix),
      isAfterDot: /\.\s*$/.test(linePrefix),
      isAfterNew: /\bnew\s+$/.test(linePrefix),
      isAfterReturn: /\breturn\s+$/.test(linePrefix),
      isAfterImport: /\bimport\s+.*from\s+['"]?$/.test(linePrefix),
      expectedType: await this.inferExpectedType(document, position)
    };
  }

  /**
   * 分析作用域
   */
  private async analyzeScope(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<CompletionContext['scope']> {
    try {
      const symbols = await this.codeEngine.getDocumentSymbols(document);
      const currentScope = this.findCurrentScope(symbols, position);

      return {
        function: currentScope.function,
        class: currentScope.class,
        namespace: currentScope.namespace,
        imports: await this.extractImports(document),
        variables: await this.extractVariables(document, position),
        types: await this.extractTypes(document, position)
      };
    } catch (error) {
      console.warn('分析作用域失敗:', error);
      return {
        imports: [],
        variables: [],
        types: []
      };
    }
  }

  /**
   * 格式化完成項目
   */
  private formatCompletionItems(completions: CodeCompletionItem[]): vscode.CompletionItem[] {
    return completions.map(completion => {
      const item = new vscode.CompletionItem(completion.label, completion.kind);

      item.detail = completion.detail;
      item.documentation = completion.documentation;
      item.insertText = completion.insertText;
      item.filterText = completion.filterText;
      item.sortText = completion.sortText || this.generateSortText(completion);
      item.preselect = completion.preselect;
      item.commitCharacters = completion.commitCharacters;
      item.command = completion.command;
      item.additionalTextEdits = completion.additionalTextEdits;

      // 添加自定義數據
      // item.data = {
      //   id: completion.id,
      //   type: completion.type,
      //   source: completion.source,
      //   confidence: completion.confidence
      // };

      return item;
    });
  }

  /**
   * 記錄完成使用
   */
  recordCompletionUsage(completionId: string): void {
    const currentUsage = this.usageStats.get(completionId) || 0;
    this.usageStats.set(completionId, currentUsage + 1);

    // 更新最近使用列表
    const completion = this.findCompletionById(completionId);
    if (completion) {
      completion.metadata.usage++;
      completion.metadata.lastUsed = new Date();

      // 添加到最近使用列表
      this.recentCompletions = this.recentCompletions.filter(c => c.id !== completionId);
      this.recentCompletions.unshift(completion);

      // 限制最近使用列表大小
      if (this.recentCompletions.length > 50) {
        this.recentCompletions = this.recentCompletions.slice(0, 50);
      }
    }

    // 學習用戶偏好
    if (this.config.enableLearning) {
      this.learningEngine.recordCompletionUsage(completionId, new Date());
    }
  }

  /**
   * 獲取配置
   */
  getConfig(): CompletionConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CompletionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache();
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.completionCache.clear();
  }

  /**
   * 獲取統計信息
   */
  getStatistics(): {
    totalCompletions: number;
    cacheSize: number;
    usageStats: Map<string, number>;
    recentCompletions: number;
  } {
    return {
      totalCompletions: Array.from(this.usageStats.values()).reduce((sum, count) => sum + count, 0),
      cacheSize: this.completionCache.size,
      usageStats: new Map(this.usageStats),
      recentCompletions: this.recentCompletions.length
    };
  }

  /**
   * 私有輔助方法
   */
  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('devika.completion');
    this.config = {
      enabled: config.get('enabled', true),
      maxSuggestions: config.get('maxSuggestions', 20),
      enableAISuggestions: config.get('enableAISuggestions', true),
      enableLearning: config.get('enableLearning', true),
      enableSnippets: config.get('enableSnippets', true),
      enableImportSuggestions: config.get('enableImportSuggestions', true),
      enableTypeInference: config.get('enableTypeInference', true),
      enableContextualSuggestions: config.get('enableContextualSuggestions', true),
      prioritizeRecentlyUsed: config.get('prioritizeRecentlyUsed', true),
      showDocumentation: config.get('showDocumentation', true),
      autoImport: config.get('autoImport', true),
      suggestionDelay: config.get('suggestionDelay', 100),
      confidenceThreshold: config.get('confidenceThreshold', 0.3),
      languages: config.get('languages', ['javascript', 'typescript', 'python', 'java', 'csharp']),
      excludePatterns: config.get('excludePatterns', ['node_modules', '.git', 'dist', 'build'])
    };
  }

  private generateCacheKey(context: CompletionContext): string {
    return `${context.document.uri.toString()}-${context.position.line}-${context.position.character}-${context.currentWord}`;
  }

  private cleanupCache(): void {
    // 簡單的 LRU 快取清理
    if (this.completionCache.size > 100) {
      const keys = Array.from(this.completionCache.keys());
      const keysToDelete = keys.slice(0, 50);
      keysToDelete.forEach(key => this.completionCache.delete(key));
    }
  }

  private generateSortText(completion: CodeCompletionItem): string {
    // 生成排序文本，確保高優先級項目排在前面
    const priority = String(1000 - completion.priority).padStart(4, '0');
    const confidence = String(Math.round((1 - completion.confidence) * 1000)).padStart(4, '0');
    return `${priority}-${confidence}-${completion.label}`;
  }

  private deduplicateCompletions(completions: CodeCompletionItem[]): CodeCompletionItem[] {
    const seen = new Set<string>();
    return completions.filter(completion => {
      const key = `${completion.label}-${completion.kind}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private getCurrentWord(document: vscode.TextDocument, position: vscode.Position): string {
    const range = document.getWordRangeAtPosition(position);
    return range ? document.getText(range) : '';
  }

  private getIndentation(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
  }

  private isInComment(linePrefix: string): boolean {
    return /\/\/|\/\*|\*|#/.test(linePrefix.trim());
  }

  private isInString(linePrefix: string): boolean {
    const singleQuotes = (linePrefix.match(/'/g) || []).length;
    const doubleQuotes = (linePrefix.match(/"/g) || []).length;
    const backticks = (linePrefix.match(/`/g) || []).length;

    return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
  }

  private async isInFunction(document: vscode.TextDocument, position: vscode.Position): Promise<boolean> {
    try {
      const symbols = await this.codeEngine.getDocumentSymbols(document);
      return this.findCurrentScope(symbols, position).function !== undefined;
    } catch {
      return false;
    }
  }

  private async isInClass(document: vscode.TextDocument, position: vscode.Position): Promise<boolean> {
    try {
      const symbols = await this.codeEngine.getDocumentSymbols(document);
      return this.findCurrentScope(symbols, position).class !== undefined;
    } catch {
      return false;
    }
  }

  private async inferExpectedType(document: vscode.TextDocument, position: vscode.Position): Promise<string | undefined> {
    // 簡化的類型推斷實現
    const line = document.lineAt(position).text;
    const linePrefix = line.substring(0, position.character);

    // 檢查變數聲明
    const varMatch = linePrefix.match(/(?:let|const|var)\s+\w+\s*:\s*(\w+)\s*=\s*$/);
    if (varMatch) {
      return varMatch[1];
    }

    // 檢查函數參數
    const paramMatch = linePrefix.match(/\(\s*\w+\s*:\s*(\w+)\s*,?\s*$/);
    if (paramMatch) {
      return paramMatch[1];
    }

    // 檢查返回語句
    if (/\breturn\s+$/.test(linePrefix)) {
      const functionType = await this.getCurrentFunctionReturnType(document, position);
      return functionType;
    }

    return undefined;
  }

  private findCurrentScope(symbols: any[], position: vscode.Position): { function?: string; class?: string; namespace?: string } {
    // 簡化的作用域查找實現
    const result: { function?: string; class?: string; namespace?: string } = {};

    for (const symbol of symbols) {
      if (this.positionInRange(position, symbol.range)) {
        if (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Method) {
          result.function = symbol.name;
        } else if (symbol.kind === vscode.SymbolKind.Class) {
          result.class = symbol.name;
        } else if (symbol.kind === vscode.SymbolKind.Namespace) {
          result.namespace = symbol.name;
        }

        // 遞歸查找子符號
        if (symbol.children) {
          const childScope = this.findCurrentScope(symbol.children, position);
          Object.assign(result, childScope);
        }
      }
    }

    return result;
  }

  private positionInRange(position: vscode.Position, range: vscode.Range): boolean {
    return range.contains(position);
  }

  private async extractImports(document: vscode.TextDocument): Promise<string[]> {
    const imports: string[] = [];
    const text = document.getText();

    // JavaScript/TypeScript imports
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }

    // Python imports
    const pythonImportRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;
    while ((match = pythonImportRegex.exec(text)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  private async extractVariables(document: vscode.TextDocument, position: vscode.Position): Promise<string[]> {
    const variables: string[] = [];
    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    // JavaScript/TypeScript 變數聲明
    const varRegex = /(?:let|const|var)\s+(\w+)/g;
    let match;
    while ((match = varRegex.exec(text)) !== null) {
      variables.push(match[1]);
    }

    // 函數參數
    const paramRegex = /function\s+\w*\s*\(([^)]*)\)/g;
    while ((match = paramRegex.exec(text)) !== null) {
      const params = match[1].split(',').map(p => p.trim().split(/[:\s]/)[0]).filter(p => p);
      variables.push(...params);
    }

    return [...new Set(variables)];
  }

  private async extractTypes(document: vscode.TextDocument, position: vscode.Position): Promise<string[]> {
    const types: string[] = [];
    const text = document.getText();

    // TypeScript 類型聲明
    const typeRegex = /(?:type|interface)\s+(\w+)/g;
    let match;
    while ((match = typeRegex.exec(text)) !== null) {
      types.push(match[1]);
    }

    // 類聲明
    const classRegex = /class\s+(\w+)/g;
    while ((match = classRegex.exec(text)) !== null) {
      types.push(match[1]);
    }

    return [...new Set(types)];
  }

  private findCompletionById(id: string): CodeCompletionItem | undefined {
    for (const completions of this.completionCache.values()) {
      const found = completions.find(c => c.id === id);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  private async getCurrentFunctionReturnType(document: vscode.TextDocument, position: vscode.Position): Promise<string | undefined> {
    // 簡化實現 - 在實際應用中需要更複雜的 AST 分析
    return undefined;
  }

  // 佔位符方法 - 這些方法需要具體的實現
  private getJavaScriptBuiltins(context: CompletionContext): CodeCompletionItem[] {
    return [];
  }

  private getPythonBuiltins(context: CompletionContext): CodeCompletionItem[] {
    return [];
  }

  private getLanguageKeywords(language: string, context: CompletionContext): CodeCompletionItem[] {
    return [];
  }

  private async createCompletionFromSymbol(symbol: any, context: CompletionContext): Promise<CodeCompletionItem | null> {
    return null;
  }

  private async createCompletionFromLocalSymbol(symbol: any, context: CompletionContext): Promise<CodeCompletionItem | null> {
    return null;
  }

  private async getDependencyCompletions(importPath: string, context: CompletionContext): Promise<CodeCompletionItem[]> {
    return [];
  }

  private async getImportSuggestions(context: CompletionContext): Promise<CodeCompletionItem[]> {
    return [];
  }

  private async getLanguageSnippets(language: string, context: CompletionContext): Promise<CodeCompletionItem[]> {
    return [];
  }

  private async detectFramework(document: vscode.TextDocument): Promise<string | undefined> {
    return undefined;
  }

  private async getFrameworkSnippets(framework: string, context: CompletionContext): Promise<CodeCompletionItem[]> {
    return [];
  }

  private async getUserSnippets(language: string, context: CompletionContext): Promise<CodeCompletionItem[]> {
    return [];
  }

  private createAICompletion(suggestion: any, context: CompletionContext): CodeCompletionItem | null {
    return null;
  }

  private createLearnedCompletion(pattern: any, context: CompletionContext): CodeCompletionItem | null {
    return null;
  }

  private getRecentCompletions(context: CompletionContext): CodeCompletionItem[] {
    return this.recentCompletions.filter(completion =>
      completion.metadata.language === context.document.languageId
    ).slice(0, 5);
  }

  private async generateDocumentation(item: vscode.CompletionItem): Promise<vscode.MarkdownString | undefined> {
    return undefined;
  }

  private async generateImportEdits(item: vscode.CompletionItem): Promise<vscode.TextEdit[]> {
    return [];
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.completionCache.clear();
    this.usageStats.clear();
    this.recentCompletions = [];
  }
}
