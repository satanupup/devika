import * as vscode from 'vscode';
import {
  ConversationMessage,
  ConversationSession,
  ConversationContext,
  ConversationType
} from './ConversationMemoryManager';
import { CodeUnderstandingEngine, SymbolType } from '../ai/CodeUnderstandingEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 上下文分析結果
 */
export interface ContextAnalysisResult {
  intent: string;
  entities: string[];
  topics: string[];
  codeReferences: CodeReference[];
  sentiment: 'positive' | 'negative' | 'neutral';
  complexity: number;
  confidence: number;
  suggestions: string[];
}

/**
 * 代碼引用
 */
export interface CodeReference {
  type: 'function' | 'class' | 'variable' | 'file' | 'module';
  name: string;
  location?: vscode.Location;
  context: string;
  confidence: number;
}

/**
 * 對話模式
 */
export interface ConversationPattern {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  responses: string[];
  frequency: number;
  effectiveness: number;
}

/**
 * 上下文繼承規則
 */
export interface ContextInheritanceRule {
  sourceType: ConversationType;
  targetType: ConversationType;
  inheritanceWeight: number;
  contextFields: string[];
  conditions: string[];
}

/**
 * 對話上下文分析器
 * 分析對話內容，提取意圖、實體和上下文信息
 */
export class ConversationContextAnalyzer {
  private static instance: ConversationContextAnalyzer;
  private codeEngine: CodeUnderstandingEngine;
  private conversationPatterns: Map<string, ConversationPattern> = new Map();
  private inheritanceRules: ContextInheritanceRule[] = [];

  private constructor() {
    this.codeEngine = CodeUnderstandingEngine.getInstance();
    this.initializePatterns();
    this.initializeInheritanceRules();
  }

  static getInstance(): ConversationContextAnalyzer {
    if (!ConversationContextAnalyzer.instance) {
      ConversationContextAnalyzer.instance = new ConversationContextAnalyzer();
    }
    return ConversationContextAnalyzer.instance;
  }

  /**
   * 分析對話消息
   */
  async analyzeMessage(message: ConversationMessage, session: ConversationSession): Promise<ContextAnalysisResult> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const content = message.content.toLowerCase();

        // 意圖識別
        const intent = await this.identifyIntent(content, session.type);

        // 實體提取
        const entities = this.extractEntities(content);

        // 主題識別
        const topics = this.identifyTopics(content, session.context);

        // 代碼引用分析
        const codeReferences = await this.analyzeCodeReferences(content, session.context);

        // 情感分析
        const sentiment = this.analyzeSentiment(content);

        // 複雜度評估
        const complexity = this.assessComplexity(content, codeReferences);

        // 信心度計算
        const confidence = this.calculateConfidence(intent, entities, topics, codeReferences);

        // 生成建議
        const suggestions = await this.generateSuggestions(intent, entities, topics, codeReferences, session);

        return {
          intent,
          entities,
          topics,
          codeReferences,
          sentiment,
          complexity,
          confidence,
          suggestions
        };
      },
      '分析對話消息',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : this.getDefaultAnalysisResult()));
  }

  /**
   * 分析會話上下文
   */
  async analyzeSessionContext(session: ConversationSession): Promise<ConversationContext> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const context = { ...session.context };

        // 分析最近的消息
        const recentMessages = session.messages.slice(-10);
        const analysisResults = await Promise.all(recentMessages.map(msg => this.analyzeMessage(msg, session)));

        // 聚合分析結果
        context.relatedTopics = this.aggregateTopics(analysisResults);
        context.codeSymbols = this.aggregateCodeSymbols(analysisResults);
        context.userIntent = this.inferUserIntent(analysisResults);
        context.conversationGoal = this.inferConversationGoal(session, analysisResults);

        // 更新依賴項目
        if (context.workspaceFolder) {
          context.dependencies = await this.analyzeDependencies(context.workspaceFolder);
        }

        return context;
      },
      '分析會話上下文',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : session.context));
  }

  /**
   * 繼承上下文
   */
  async inheritContext(
    sourceSession: ConversationSession,
    targetType: ConversationType,
    currentContext: ConversationContext
  ): Promise<ConversationContext> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let inheritedContext = { ...currentContext };

        // 查找適用的繼承規則
        const applicableRules = this.inheritanceRules.filter(
          rule => rule.sourceType === sourceSession.type && rule.targetType === targetType
        );

        for (const rule of applicableRules) {
          // 檢查條件
          if (this.checkInheritanceConditions(rule, sourceSession, currentContext)) {
            // 應用繼承
            inheritedContext = this.applyInheritanceRule(rule, sourceSession.context, inheritedContext);
          }
        }

        // 繼承相關主題
        const sourceTopics = sourceSession.context.relatedTopics || [];
        const currentTopics = inheritedContext.relatedTopics || [];
        inheritedContext.relatedTopics = this.mergeTopics(sourceTopics, currentTopics);

        // 繼承代碼符號
        const sourceSymbols = sourceSession.context.codeSymbols || [];
        const currentSymbols = inheritedContext.codeSymbols || [];
        inheritedContext.codeSymbols = this.mergeSymbols(sourceSymbols, currentSymbols);

        return inheritedContext;
      },
      '繼承對話上下文',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : currentContext));
  }

  /**
   * 識別對話模式
   */
  async identifyConversationPattern(session: ConversationSession): Promise<ConversationPattern | null> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const messages = session.messages.slice(-5); // 分析最近 5 條消息
        const content = messages
          .map(m => m.content)
          .join(' ')
          .toLowerCase();

        for (const pattern of this.conversationPatterns.values()) {
          const matchScore = this.calculatePatternMatch(content, pattern);
          if (matchScore > 0.7) {
            // 更新模式統計
            pattern.frequency++;
            return pattern;
          }
        }

        return null;
      },
      '識別對話模式',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : null));
  }

  /**
   * 預測下一步行動
   */
  async predictNextAction(session: ConversationSession): Promise<string[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const pattern = await this.identifyConversationPattern(session);
        const context = await this.analyzeSessionContext(session);

        const actions: string[] = [];

        // 基於模式的預測
        if (pattern) {
          actions.push(...pattern.responses);
        }

        // 基於上下文的預測
        if (context.userIntent) {
          actions.push(...this.getActionsForIntent(context.userIntent));
        }

        // 基於會話類型的預測
        actions.push(...this.getActionsForType(session.type));

        // 去重並排序
        return [...new Set(actions)].slice(0, 5);
      },
      '預測下一步行動',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : []));
  }

  /**
   * 意圖識別
   */
  private async identifyIntent(content: string, sessionType: ConversationType): Promise<string> {
    const intentKeywords = {
      help: ['help', 'how', 'what', 'explain', 'show me'],
      debug: ['error', 'bug', 'issue', 'problem', 'fix', 'debug'],
      refactor: ['refactor', 'improve', 'optimize', 'clean', 'restructure'],
      implement: ['create', 'add', 'implement', 'build', 'make'],
      review: ['review', 'check', 'analyze', 'examine', 'look at'],
      learn: ['learn', 'understand', 'teach', 'explain', 'tutorial']
    };

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return intent;
      }
    }

    // 基於會話類型的默認意圖
    switch (sessionType) {
      case ConversationType.DEBUGGING:
        return 'debug';
      case ConversationType.CODE_REVIEW:
        return 'review';
      case ConversationType.REFACTORING:
        return 'refactor';
      case ConversationType.LEARNING:
        return 'learn';
      default:
        return 'help';
    }
  }

  /**
   * 實體提取
   */
  private extractEntities(content: string): string[] {
    const entities: string[] = [];

    // 提取文件名
    const filePattern = /\b[\w-]+\.(ts|js|py|java|cpp|c|cs|go|rs|php|rb)\b/g;
    const fileMatches = content.match(filePattern);
    if (fileMatches) {
      entities.push(...fileMatches);
    }

    // 提取函數名
    const functionPattern = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/g;
    const functionMatches = content.match(functionPattern);
    if (functionMatches) {
      entities.push(...functionMatches.map(m => m.replace('(', '')));
    }

    // 提取類名
    const classPattern = /\bclass\s+([A-Z][a-zA-Z0-9_]*)/g;
    const classMatches = content.match(classPattern);
    if (classMatches) {
      entities.push(...classMatches.map(m => m.replace('class ', '')));
    }

    return [...new Set(entities)];
  }

  /**
   * 主題識別
   */
  private identifyTopics(content: string, context: ConversationContext): string[] {
    const topics: string[] = [];

    // 技術主題
    const techTopics = {
      react: ['react', 'jsx', 'component', 'hook', 'state'],
      typescript: ['typescript', 'type', 'interface', 'generic'],
      nodejs: ['node', 'express', 'npm', 'package'],
      database: ['database', 'sql', 'query', 'table', 'schema'],
      testing: ['test', 'unit', 'integration', 'mock', 'jest'],
      performance: ['performance', 'optimize', 'speed', 'memory', 'cache']
    };

    for (const [topic, keywords] of Object.entries(techTopics)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        topics.push(topic);
      }
    }

    // 基於項目類型添加主題
    if (context.projectType) {
      topics.push(context.projectType);
    }

    return topics;
  }

  /**
   * 代碼引用分析
   */
  private async analyzeCodeReferences(content: string, context: ConversationContext): Promise<CodeReference[]> {
    const references: CodeReference[] = [];

    // 如果有當前文件，分析其中的符號
    if (context.currentFile) {
      try {
        const document = await vscode.workspace.openTextDocument(context.currentFile);
        const symbols = await this.codeEngine.getDocumentSymbols(document);

        for (const symbol of symbols) {
          if (content.includes(symbol.name)) {
            references.push({
              type: this.mapSymbolTypeToCodeReferenceType(symbol.type),
              name: symbol.name,
              location: new vscode.Location(symbol.uri, symbol.range),
              context: `Found in ${context.currentFile.fsPath}`,
              confidence: 0.8
            });
          }
        }
      } catch (error) {
        console.warn('分析代碼引用失敗:', error);
      }
    }

    return references;
  }

  /**
   * 情感分析
   */
  private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['good', 'great', 'excellent', 'perfect', 'thanks', 'helpful'];
    const negativeWords = ['bad', 'wrong', 'error', 'problem', 'issue', 'broken'];

    const positiveCount = positiveWords.filter(word => content.includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * 複雜度評估
   */
  private assessComplexity(content: string, codeReferences: CodeReference[]): number {
    let complexity = 0;

    // 基於內容長度
    complexity += Math.min(content.length / 1000, 1) * 0.3;

    // 基於代碼引用數量
    complexity += Math.min(codeReferences.length / 10, 1) * 0.4;

    // 基於技術術語數量
    const techTerms = ['function', 'class', 'interface', 'async', 'await', 'promise'];
    const techTermCount = techTerms.filter(term => content.includes(term)).length;
    complexity += Math.min(techTermCount / 5, 1) * 0.3;

    return Math.min(complexity, 1);
  }

  /**
   * 信心度計算
   */
  private calculateConfidence(
    intent: string,
    entities: string[],
    topics: string[],
    codeReferences: CodeReference[]
  ): number {
    let confidence = 0.5; // 基礎信心度

    if (intent !== 'help') confidence += 0.2;
    if (entities.length > 0) confidence += 0.1;
    if (topics.length > 0) confidence += 0.1;
    if (codeReferences.length > 0) confidence += 0.1;

    return Math.min(confidence, 1);
  }

  /**
   * 生成建議
   */
  private async generateSuggestions(
    intent: string,
    entities: string[],
    topics: string[],
    codeReferences: CodeReference[],
    session: ConversationSession
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // 基於意圖的建議
    switch (intent) {
      case 'debug':
        suggestions.push('檢查錯誤日誌', '添加調試斷點', '檢查變數值');
        break;
      case 'refactor':
        suggestions.push('提取函數', '重命名變數', '優化算法');
        break;
      case 'implement':
        suggestions.push('創建新文件', '添加測試', '更新文檔');
        break;
    }

    // 基於代碼引用的建議
    if (codeReferences.length > 0) {
      suggestions.push('查看相關代碼', '檢查函數簽名', '分析依賴關係');
    }

    return suggestions.slice(0, 5);
  }

  /**
   * 初始化對話模式
   */
  private initializePatterns(): void {
    const patterns: ConversationPattern[] = [
      {
        id: 'debug-help',
        name: '調試幫助',
        description: '用戶尋求調試幫助的模式',
        triggers: ['error', 'bug', 'not working', 'issue'],
        responses: ['檢查錯誤信息', '添加日誌', '檢查變數值'],
        frequency: 0,
        effectiveness: 0.8
      },
      {
        id: 'code-review',
        name: '代碼審查',
        description: '代碼審查和改進建議',
        triggers: ['review', 'improve', 'better way', 'optimize'],
        responses: ['檢查代碼風格', '優化性能', '改進可讀性'],
        frequency: 0,
        effectiveness: 0.9
      }
    ];

    patterns.forEach(pattern => {
      this.conversationPatterns.set(pattern.id, pattern);
    });
  }

  /**
   * 初始化繼承規則
   */
  private initializeInheritanceRules(): void {
    this.inheritanceRules = [
      {
        sourceType: ConversationType.DEBUGGING,
        targetType: ConversationType.REFACTORING,
        inheritanceWeight: 0.8,
        contextFields: ['currentFile', 'codeSymbols', 'relatedTopics'],
        conditions: ['same_file', 'related_symbols']
      },
      {
        sourceType: ConversationType.CODE_REVIEW,
        targetType: ConversationType.REFACTORING,
        inheritanceWeight: 0.9,
        contextFields: ['currentFile', 'codeSymbols', 'userIntent'],
        conditions: ['same_file']
      }
    ];
  }

  /**
   * 輔助方法
   */
  private getDefaultAnalysisResult(): ContextAnalysisResult {
    return {
      intent: 'help',
      entities: [],
      topics: [],
      codeReferences: [],
      sentiment: 'neutral',
      complexity: 0.5,
      confidence: 0.5,
      suggestions: []
    };
  }

  private aggregateTopics(results: ContextAnalysisResult[]): string[] {
    const allTopics = results.flatMap(r => r.topics);
    return [...new Set(allTopics)];
  }

  private aggregateCodeSymbols(results: ContextAnalysisResult[]): string[] {
    const allSymbols = results.flatMap(r => r.codeReferences.map(ref => ref.name));
    return [...new Set(allSymbols)];
  }

  private inferUserIntent(results: ContextAnalysisResult[]): string | undefined {
    const intents = results.map(r => r.intent);
    const intentCounts = intents.reduce(
      (acc, intent) => {
        acc[intent] = (acc[intent] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const mostCommonIntent = Object.entries(intentCounts).sort(([, a], [, b]) => b - a)[0];

    return mostCommonIntent?.[0];
  }

  private inferConversationGoal(session: ConversationSession, results: ContextAnalysisResult[]): string | undefined {
    // 基於會話類型和分析結果推斷對話目標
    switch (session.type) {
      case ConversationType.DEBUGGING:
        return '解決代碼問題';
      case ConversationType.REFACTORING:
        return '改進代碼品質';
      case ConversationType.LEARNING:
        return '學習新技術';
      default:
        return undefined;
    }
  }

  private async analyzeDependencies(workspaceUri: vscode.Uri): Promise<string[]> {
    try {
      const packageJsonUri = vscode.Uri.joinPath(workspaceUri, 'package.json');
      const packageJson = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageData = JSON.parse(packageJson.toString());

      return Object.keys({
        ...packageData.dependencies,
        ...packageData.devDependencies
      });
    } catch {
      return [];
    }
  }

  private calculatePatternMatch(content: string, pattern: ConversationPattern): number {
    const triggerMatches = pattern.triggers.filter(trigger => content.includes(trigger)).length;
    return triggerMatches / pattern.triggers.length;
  }

  private checkInheritanceConditions(
    rule: ContextInheritanceRule,
    sourceSession: ConversationSession,
    currentContext: ConversationContext
  ): boolean {
    return rule.conditions.every(condition => {
      switch (condition) {
        case 'same_file':
          return sourceSession.context.currentFile?.fsPath === currentContext.currentFile?.fsPath;
        case 'related_symbols':
          const sourceSymbols = sourceSession.context.codeSymbols || [];
          const currentSymbols = currentContext.codeSymbols || [];
          return sourceSymbols.some(symbol => currentSymbols.includes(symbol));
        default:
          return true;
      }
    });
  }

  private applyInheritanceRule(
    rule: ContextInheritanceRule,
    sourceContext: ConversationContext,
    targetContext: ConversationContext
  ): ConversationContext {
    const inherited = { ...targetContext };

    rule.contextFields.forEach(field => {
      if (sourceContext[field as keyof ConversationContext]) {
        (inherited as any)[field] = (sourceContext as any)[field];
      }
    });

    return inherited;
  }

  private mergeTopics(sourceTopics: string[], currentTopics: string[]): string[] {
    return [...new Set([...currentTopics, ...sourceTopics])];
  }

  private mergeSymbols(sourceSymbols: string[], currentSymbols: string[]): string[] {
    return [...new Set([...currentSymbols, ...sourceSymbols])];
  }

  private getActionsForIntent(intent: string): string[] {
    const intentActions: Record<string, string[]> = {
      debug: ['檢查錯誤', '添加日誌', '運行測試'],
      refactor: ['提取函數', '重命名變數', '優化結構'],
      implement: ['創建文件', '添加功能', '編寫測試'],
      review: ['檢查代碼', '提供建議', '標記問題']
    };

    return intentActions[intent] || [];
  }

  private getActionsForType(type: ConversationType): string[] {
    const typeActions: Record<ConversationType, string[]> = {
      [ConversationType.DEBUGGING]: ['檢查錯誤', '分析日誌'],
      [ConversationType.REFACTORING]: ['改進代碼', '優化性能'],
      [ConversationType.CODE_REVIEW]: ['審查代碼', '提供反饋'],
      [ConversationType.LEARNING]: ['解釋概念', '提供範例'],
      [ConversationType.PLANNING]: ['制定計劃', '分析需求'],
      [ConversationType.CHAT]: ['回答問題', '提供幫助'],
      [ConversationType.GENERAL]: ['提供建議', '解決問題']
    };

    return typeActions[type] || [];
  }

  private mapSymbolTypeToCodeReferenceType(type: SymbolType): CodeReference['type'] {
    switch (type) {
      case SymbolType.FUNCTION:
      case SymbolType.METHOD:
        return 'function';
      case SymbolType.CLASS:
        return 'class';
      case SymbolType.VARIABLE:
      case SymbolType.PROPERTY:
        return 'variable';
      case SymbolType.IMPORT:
      case SymbolType.EXPORT:
        return 'module';
      default:
        return 'variable';
    }
  }
}
