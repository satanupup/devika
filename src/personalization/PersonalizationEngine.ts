import * as vscode from 'vscode';
import { LearningEngine, UserPreference, CodingPattern } from '../learning/LearningEngine';
import { ConversationMemoryManager, ConversationType } from '../memory/ConversationMemoryManager';
import { CodeUnderstandingEngine } from '../ai/CodeUnderstandingEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 建議類型
 */
export enum SuggestionType {
  CODE_STYLE = 'code_style',
  REFACTORING = 'refactoring',
  BEST_PRACTICE = 'best_practice',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  DEPENDENCY = 'dependency',
  WORKFLOW = 'workflow',
  LEARNING = 'learning'
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
 * 個性化建議
 */
export interface PersonalizedSuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  actionable: boolean;
  context: SuggestionContext;
  actions: SuggestionAction[];
  metadata: {
    learnedFrom: string[];
    frequency: number;
    effectiveness: number;
    lastSeen: Date;
    userFeedback?: 'positive' | 'negative' | 'neutral';
  };
}

/**
 * 建議上下文
 */
export interface SuggestionContext {
  fileUri: vscode.Uri;
  language: string;
  projectType?: string;
  codeRange?: vscode.Range;
  relatedFiles: vscode.Uri[];
  dependencies: string[];
  userPreferences: UserPreference[];
  recentPatterns: CodingPattern[];
  conversationHistory: string[];
}

/**
 * 建議行動
 */
export interface SuggestionAction {
  id: string;
  label: string;
  description: string;
  command?: string;
  arguments?: any[];
  codeEdit?: {
    range: vscode.Range;
    newText: string;
  };
  fileOperation?: {
    type: 'create' | 'delete' | 'rename';
    source?: vscode.Uri;
    target: vscode.Uri;
    content?: string;
  };
}

/**
 * 用戶行為模式
 */
export interface UserBehaviorPattern {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  frequency: number;
  confidence: number;
  lastObserved: Date;
  associatedSuggestions: string[];
}

/**
 * 個性化配置
 */
export interface PersonalizationConfig {
  enabledSuggestionTypes: SuggestionType[];
  minConfidenceThreshold: number;
  maxSuggestionsPerContext: number;
  learningRate: number;
  adaptationSpeed: number;
  privacyLevel: 'minimal' | 'balanced' | 'comprehensive';
}

/**
 * 個性化引擎
 * 基於用戶習慣和歷史行為提供個性化建議
 */
export class PersonalizationEngine {
  private static instance: PersonalizationEngine;
  private learningEngine: LearningEngine;
  private memoryManager: ConversationMemoryManager;
  private codeEngine: CodeUnderstandingEngine;
  private userBehaviorPatterns: Map<string, UserBehaviorPattern> = new Map();
  private suggestionHistory: Map<string, PersonalizedSuggestion> = new Map();
  private config!: PersonalizationConfig;

  private constructor() {
    this.learningEngine = LearningEngine.getInstance();
    this.memoryManager = ConversationMemoryManager.getInstance();
    this.codeEngine = CodeUnderstandingEngine.getInstance();
    this.loadConfiguration();
    this.initializeBehaviorPatterns();
  }

  static getInstance(): PersonalizationEngine {
    if (!PersonalizationEngine.instance) {
      PersonalizationEngine.instance = new PersonalizationEngine();
    }
    return PersonalizationEngine.instance;
  }

  /**
   * 生成個性化建議
   */
  async generatePersonalizedSuggestions(
    document: vscode.TextDocument,
    position?: vscode.Position,
    context?: Partial<SuggestionContext>
  ): Promise<PersonalizedSuggestion[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const fullContext = await this.buildSuggestionContext(document, position, context);
        const suggestions: PersonalizedSuggestion[] = [];

        // 基於代碼風格的建議
        const stylesuggestions = await this.generateStyleSuggestions(fullContext);
        suggestions.push(...stylesuggestions);

        // 基於最佳實踐的建議
        const practicesuggestions = await this.generateBestPracticeSuggestions(fullContext);
        suggestions.push(...practicesuggestions);

        // 基於性能的建議
        const performancesuggestions = await this.generatePerformanceSuggestions(fullContext);
        suggestions.push(...performancesuggestions);

        // 基於學習模式的建議
        const learningSuggestions = await this.generateLearningSuggestions(fullContext);
        suggestions.push(...learningSuggestions);

        // 基於用戶行為的建議
        const behaviorSuggestions = await this.generateBehaviorBasedSuggestions(fullContext);
        suggestions.push(...behaviorSuggestions);

        // 排序和過濾建議
        return this.rankAndFilterSuggestions(suggestions, fullContext);
      },
      '生成個性化建議',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : []));
  }

  /**
   * 記錄用戶反饋
   */
  async recordUserFeedback(
    suggestionId: string,
    feedback: 'positive' | 'negative' | 'neutral',
    action?: 'accepted' | 'rejected' | 'modified'
  ): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const suggestion = this.suggestionHistory.get(suggestionId);
        if (!suggestion) {
          throw new Error(`找不到建議: ${suggestionId}`);
        }

        suggestion.metadata.userFeedback = feedback;

        // 更新學習引擎
        await this.learningEngine.learnUserPreference(
          'suggestion',
          suggestion.type,
          {
            feedback,
            action,
            suggestion: suggestion.title
          },
          [suggestion.context.language],
          feedback === 'positive' ? 0.8 : 0.2
        );

        // 更新建議效果
        if (feedback === 'positive') {
          suggestion.metadata.effectiveness = Math.min(1, suggestion.metadata.effectiveness + 0.1);
        } else if (feedback === 'negative') {
          suggestion.metadata.effectiveness = Math.max(0, suggestion.metadata.effectiveness - 0.1);
        }

        // 更新行為模式
        await this.updateBehaviorPatterns(suggestion, feedback, action);

        console.log(`用戶反饋已記錄: ${suggestionId} - ${feedback}`);
      },
      '記錄用戶反饋',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 獲取用戶偏好摘要
   */
  async getUserPreferenceSummary(): Promise<{
    preferredSuggestionTypes: SuggestionType[];
    avoidedSuggestionTypes: SuggestionType[];
    preferredLanguages: string[];
    commonPatterns: string[];
    learningAreas: string[];
  }> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const preferences = this.learningEngine.getUserPreferences();
        const suggestionPrefs = preferences.filter(p => p.category === 'suggestion');

        const preferredTypes: SuggestionType[] = [];
        const avoidedTypes: SuggestionType[] = [];

        suggestionPrefs.forEach(pref => {
          if (pref.value.feedback === 'positive' && pref.confidence > 0.6) {
            preferredTypes.push(pref.name as SuggestionType);
          } else if (pref.value.feedback === 'negative' && pref.confidence > 0.6) {
            avoidedTypes.push(pref.name as SuggestionType);
          }
        });

        const patterns = this.learningEngine.getLearnedPatterns();
        const commonPatterns = patterns
          .filter(p => p.frequency > 3)
          .map(p => p.name)
          .slice(0, 10);

        const languagePrefs = preferences
          .filter(p => p.category === 'style')
          .map(p => p.context)
          .flat()
          .filter((lang, index, arr) => arr.indexOf(lang) === index)
          .slice(0, 5);

        return {
          preferredSuggestionTypes: preferredTypes,
          avoidedSuggestionTypes: avoidedTypes,
          preferredLanguages: languagePrefs,
          commonPatterns,
          learningAreas: this.identifyLearningAreas()
        };
      },
      '獲取用戶偏好摘要',
      { logError: true, showToUser: false }
    ).then(result =>
      result.success
        ? result.data!
        : {
            preferredSuggestionTypes: [],
            avoidedSuggestionTypes: [],
            preferredLanguages: [],
            commonPatterns: [],
            learningAreas: []
          }
    );
  }

  /**
   * 構建建議上下文
   */
  private async buildSuggestionContext(
    document: vscode.TextDocument,
    position?: vscode.Position,
    partialContext?: Partial<SuggestionContext>
  ): Promise<SuggestionContext> {
    const userPreferences = this.learningEngine.getUserPreferences();
    const recentPatterns = this.learningEngine.getLearnedPatterns(document.languageId);

    // 獲取相關對話歷史
    const memoryResult = await this.memoryManager.getRelevantMemory(`${document.languageId} code suggestions`, {
      currentFile: document.uri
    });

    const context: SuggestionContext = {
      fileUri: document.uri,
      language: document.languageId,
      projectType: await this.detectProjectType(document.uri),
      codeRange: position ? new vscode.Range(position, position) : undefined,
      relatedFiles: await this.getRelatedFiles(document.uri),
      dependencies: await this.getProjectDependencies(document.uri),
      userPreferences,
      recentPatterns,
      conversationHistory: memoryResult.relatedMessages.map(m => m.content),
      ...partialContext
    };

    return context;
  }

  /**
   * 生成代碼風格建議
   */
  private async generateStyleSuggestions(context: SuggestionContext): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // 基於用戶偏好的風格建議
    const stylePrefs = context.userPreferences.filter(p => p.category === 'style');

    for (const pref of stylePrefs) {
      if (pref.confidence > 0.7) {
        const suggestion = await this.createStyleSuggestion(pref, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions;
  }

  /**
   * 生成最佳實踐建議
   */
  private async generateBestPracticeSuggestions(context: SuggestionContext): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // 基於語言和項目類型的最佳實踐
    const bestPractices = this.getBestPracticesForContext(context);

    for (const practice of bestPractices) {
      const suggestion = await this.createBestPracticeSuggestion(practice, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * 生成性能建議
   */
  private async generatePerformanceSuggestions(context: SuggestionContext): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // 分析代碼性能問題
    const performanceIssues = await this.analyzePerformanceIssues(context);

    for (const issue of performanceIssues) {
      const suggestion = await this.createPerformanceSuggestion(issue, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * 生成學習建議
   */
  private async generateLearningSuggestions(context: SuggestionContext): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // 基於用戶學習歷史的建議
    const learningAreas = this.identifyLearningAreas();

    for (const area of learningAreas) {
      const suggestion = await this.createLearningSuggestion(area, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * 生成基於行為的建議
   */
  private async generateBehaviorBasedSuggestions(context: SuggestionContext): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // 基於用戶行為模式的建議
    const relevantPatterns = Array.from(this.userBehaviorPatterns.values()).filter(pattern =>
      this.isPatternRelevant(pattern, context)
    );

    for (const pattern of relevantPatterns) {
      const suggestion = await this.createBehaviorBasedSuggestion(pattern, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * 排序和過濾建議
   */
  private rankAndFilterSuggestions(
    suggestions: PersonalizedSuggestion[],
    context: SuggestionContext
  ): PersonalizedSuggestion[] {
    // 過濾低信心度的建議
    let filtered = suggestions.filter(s => s.confidence >= this.config.minConfidenceThreshold);

    // 根據用戶偏好過濾
    filtered = this.filterByUserPreferences(filtered, context);

    // 排序建議
    filtered.sort((a, b) => {
      // 優先級權重
      const priorityWeight = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority);

      // 信心度權重
      const confidenceWeight = (b.confidence - a.confidence) * 0.3;

      // 效果權重
      const effectivenessWeight = (b.metadata.effectiveness - a.metadata.effectiveness) * 0.2;

      return priorityWeight + confidenceWeight + effectivenessWeight;
    });

    // 限制建議數量
    return filtered.slice(0, this.config.maxSuggestionsPerContext);
  }

  /**
   * 輔助方法
   */
  private loadConfiguration(): void {
    this.config = {
      enabledSuggestionTypes: Object.values(SuggestionType),
      minConfidenceThreshold: 0.5,
      maxSuggestionsPerContext: 10,
      learningRate: 0.1,
      adaptationSpeed: 0.05,
      privacyLevel: 'balanced'
    };
  }

  private initializeBehaviorPatterns(): void {
    // 初始化常見的用戶行為模式
    const patterns: UserBehaviorPattern[] = [
      {
        id: 'frequent-refactoring',
        name: '頻繁重構',
        description: '用戶經常進行代碼重構',
        triggers: ['refactor', 'extract', 'rename'],
        frequency: 0,
        confidence: 0.5,
        lastObserved: new Date(),
        associatedSuggestions: [SuggestionType.REFACTORING]
      },
      {
        id: 'testing-focused',
        name: '測試導向',
        description: '用戶重視測試覆蓋率',
        triggers: ['test', 'spec', 'mock'],
        frequency: 0,
        confidence: 0.5,
        lastObserved: new Date(),
        associatedSuggestions: [SuggestionType.TESTING]
      }
    ];

    patterns.forEach(pattern => {
      this.userBehaviorPatterns.set(pattern.id, pattern);
    });
  }

  private async detectProjectType(uri: vscode.Uri): Promise<string | undefined> {
    // 簡化的項目類型檢測
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {return undefined;}

      const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
      const packageJson = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageData = JSON.parse(packageJson.toString());

      if (packageData.dependencies?.react) {return 'react';}
      if (packageData.dependencies?.vue) {return 'vue';}
      if (packageData.dependencies?.angular) {return 'angular';}
      if (packageData.dependencies?.express) {return 'express';}

      return 'javascript';
    } catch {
      return undefined;
    }
  }

  private async getRelatedFiles(uri: vscode.Uri): Promise<vscode.Uri[]> {
    // 獲取相關文件的邏輯
    return [];
  }

  private async getProjectDependencies(uri: vscode.Uri): Promise<string[]> {
    // 獲取項目依賴的邏輯
    return [];
  }

  private async createStyleSuggestion(
    pref: UserPreference,
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion | null> {
    // 創建風格建議的邏輯
    return null;
  }

  private getBestPracticesForContext(context: SuggestionContext): any[] {
    // 獲取最佳實踐的邏輯
    return [];
  }

  private async createBestPracticeSuggestion(
    practice: any,
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion | null> {
    // 創建最佳實踐建議的邏輯
    return null;
  }

  private async analyzePerformanceIssues(context: SuggestionContext): Promise<any[]> {
    // 分析性能問題的邏輯
    return [];
  }

  private async createPerformanceSuggestion(
    issue: any,
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion | null> {
    // 創建性能建議的邏輯
    return null;
  }

  private identifyLearningAreas(): string[] {
    // 識別學習領域的邏輯
    return ['typescript', 'react', 'testing'];
  }

  private async createLearningSuggestion(
    area: string,
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion | null> {
    // 創建學習建議的邏輯
    return null;
  }

  private isPatternRelevant(pattern: UserBehaviorPattern, context: SuggestionContext): boolean {
    // 檢查模式相關性的邏輯
    return pattern.confidence > 0.6;
  }

  private async createBehaviorBasedSuggestion(
    pattern: UserBehaviorPattern,
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion | null> {
    // 創建基於行為的建議的邏輯
    return null;
  }

  private filterByUserPreferences(
    suggestions: PersonalizedSuggestion[],
    context: SuggestionContext
  ): PersonalizedSuggestion[] {
    // 根據用戶偏好過濾建議的邏輯
    return suggestions;
  }

  private getPriorityWeight(priority: SuggestionPriority): number {
    switch (priority) {
      case SuggestionPriority.CRITICAL:
        return 4;
      case SuggestionPriority.HIGH:
        return 3;
      case SuggestionPriority.MEDIUM:
        return 2;
      case SuggestionPriority.LOW:
        return 1;
      default:
        return 0;
    }
  }

  private async updateBehaviorPatterns(
    suggestion: PersonalizedSuggestion,
    feedback: string,
    action?: string
  ): Promise<void> {
    // 更新行為模式的邏輯
  }

  private generateSuggestionId(): string {
    return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
