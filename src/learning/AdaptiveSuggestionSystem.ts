import * as vscode from 'vscode';
import { LearningEngine, LearningEventType, UserPreference } from './LearningEngine';
import { PatternRecognizer, PatternType } from './PatternRecognizer';
import { IntelligentSuggestionSystem } from '../ai/IntelligentSuggestionSystem';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 建議類型
 */
export enum SuggestionType {
  CODE_COMPLETION = 'code_completion',
  REFACTORING = 'refactoring',
  STYLE_IMPROVEMENT = 'style_improvement',
  PATTERN_SUGGESTION = 'pattern_suggestion',
  ERROR_FIX = 'error_fix',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  BEST_PRACTICE = 'best_practice'
}

/**
 * 適應性建議
 */
export interface AdaptiveSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  code: string;
  replacement?: string;
  confidence: number;
  priority: number;
  reasoning: string;
  learnedFrom: string[];
  context: SuggestionContext;
  metadata: Record<string, any>;
}

/**
 * 建議上下文
 */
export interface SuggestionContext {
  language: string;
  fileUri: vscode.Uri;
  position: vscode.Position;
  surroundingCode: string;
  userPreferences: UserPreference[];
  recentPatterns: string[];
  projectType?: string;
}

/**
 * 建議反饋
 */
export interface SuggestionFeedback {
  suggestionId: string;
  action: 'accept' | 'reject' | 'modify';
  reason?: string;
  modification?: string;
  timestamp: Date;
}

/**
 * 適應性建議系統
 * 基於學習到的用戶偏好和模式提供個性化建議
 */
export class AdaptiveSuggestionSystem {
  private static instance: AdaptiveSuggestionSystem;
  private learningEngine: LearningEngine;
  private patternRecognizer: PatternRecognizer;
  private intelligentSuggestions: IntelligentSuggestionSystem;
  private suggestionHistory: Map<string, AdaptiveSuggestion> = new Map();
  private feedbackHistory: Map<string, SuggestionFeedback[]> = new Map();

  private constructor() {
    this.learningEngine = LearningEngine.getInstance();
    this.patternRecognizer = PatternRecognizer.getInstance();
    this.intelligentSuggestions = IntelligentSuggestionSystem.getInstance();
  }

  static getInstance(): AdaptiveSuggestionSystem {
    if (!AdaptiveSuggestionSystem.instance) {
      AdaptiveSuggestionSystem.instance = new AdaptiveSuggestionSystem();
    }
    return AdaptiveSuggestionSystem.instance;
  }

  /**
   * 生成適應性建議
   */
  async generateSuggestions(
    document: vscode.TextDocument,
    position: vscode.Position,
    context?: Partial<SuggestionContext>
  ): Promise<AdaptiveSuggestion[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const fullContext = await this.buildContext(document, position, context);
        const suggestions: AdaptiveSuggestion[] = [];

        // 獲取基礎建議
        const baseSuggestions = await this.intelligentSuggestions.generateSuggestions(
          document,
          position
        );

        // 根據用戶偏好調整建議
        for (const baseSuggestion of baseSuggestions) {
          const adaptedSuggestion = await this.adaptSuggestion(baseSuggestion, fullContext);
          if (adaptedSuggestion) {
            suggestions.push(adaptedSuggestion);
          }
        }

        // 生成基於模式的建議
        const patternSuggestions = await this.generatePatternBasedSuggestions(fullContext);
        suggestions.push(...patternSuggestions);

        // 生成風格改進建議
        const styleSuggestions = await this.generateStyleSuggestions(fullContext);
        suggestions.push(...styleSuggestions);

        // 排序建議
        return this.rankSuggestions(suggestions, fullContext);
      },
      '生成適應性建議',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 記錄建議反饋
   */
  async recordFeedback(feedback: SuggestionFeedback): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const suggestion = this.suggestionHistory.get(feedback.suggestionId);
        if (!suggestion) {
          throw new Error(`找不到建議: ${feedback.suggestionId}`);
        }

        // 記錄反饋
        const existingFeedback = this.feedbackHistory.get(feedback.suggestionId) || [];
        existingFeedback.push(feedback);
        this.feedbackHistory.set(feedback.suggestionId, existingFeedback);

        // 記錄學習事件
        const eventType = feedback.action === 'accept' 
          ? LearningEventType.SUGGESTION_ACCEPT 
          : LearningEventType.SUGGESTION_REJECT;

        await this.learningEngine.recordEvent(
          eventType,
          {
            fileUri: suggestion.context.fileUri,
            language: suggestion.context.language,
            sessionId: 'current'
          },
          {
            suggestion: suggestion,
            feedback: feedback,
            reason: feedback.reason
          },
          feedback.action === 'accept' ? 'positive' : 'negative'
        );

        // 更新用戶偏好
        await this.updatePreferencesFromFeedback(suggestion, feedback);
      },
      '記錄建議反饋',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 獲取個性化的代碼完成建議
   */
  async getPersonalizedCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    triggerCharacter?: string
  ): Promise<vscode.CompletionItem[]> {
    const suggestions = await this.generateSuggestions(document, position);
    const completions: vscode.CompletionItem[] = [];

    for (const suggestion of suggestions) {
      if (suggestion.type === SuggestionType.CODE_COMPLETION) {
        const completion = new vscode.CompletionItem(
          suggestion.title,
          vscode.CompletionItemKind.Snippet
        );

        completion.detail = suggestion.description;
        completion.documentation = new vscode.MarkdownString(suggestion.reasoning);
        completion.insertText = new vscode.SnippetString(suggestion.replacement || suggestion.code);
        completion.sortText = this.getSortText(suggestion.priority);

        completions.push(completion);
      }
    }

    return completions;
  }

  /**
   * 構建建議上下文
   */
  private async buildContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    partialContext?: Partial<SuggestionContext>
  ): Promise<SuggestionContext> {
    const surroundingCode = this.getSurroundingCode(document, position);
    const userPreferences = this.learningEngine.getUserPreferences(
      undefined, // 所有類別
      0.5 // 最小信心度
    );

    // 獲取最近的模式
    const recentPatterns = this.patternRecognizer.getAllPatterns()
      .filter(p => p.language === document.languageId)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map(p => p.pattern);

    return {
      language: document.languageId,
      fileUri: document.uri,
      position,
      surroundingCode,
      userPreferences,
      recentPatterns,
      projectType: await this.detectProjectType(document.uri),
      ...partialContext
    };
  }

  /**
   * 適應基礎建議
   */
  private async adaptSuggestion(
    baseSuggestion: any,
    context: SuggestionContext
  ): Promise<AdaptiveSuggestion | null> {
    // 檢查是否符合用戶偏好
    const relevantPreferences = context.userPreferences.filter(pref =>
      this.isPreferenceRelevant(pref, baseSuggestion, context)
    );

    if (relevantPreferences.length === 0) {
      return null; // 不符合用戶偏好，跳過
    }

    // 調整建議以符合用戶風格
    const adaptedCode = await this.adaptCodeToUserStyle(
      baseSuggestion.code,
      context,
      relevantPreferences
    );

    const suggestion: AdaptiveSuggestion = {
      id: this.generateSuggestionId(),
      type: this.mapToSuggestionType(baseSuggestion.type),
      title: baseSuggestion.title,
      description: baseSuggestion.description,
      code: baseSuggestion.code,
      replacement: adaptedCode,
      confidence: this.calculateAdaptedConfidence(baseSuggestion.confidence, relevantPreferences),
      priority: this.calculatePriority(baseSuggestion, relevantPreferences),
      reasoning: this.generateReasoning(baseSuggestion, relevantPreferences),
      learnedFrom: relevantPreferences.map(p => p.name),
      context,
      metadata: {
        originalSuggestion: baseSuggestion,
        adaptations: relevantPreferences.map(p => p.name)
      }
    };

    this.suggestionHistory.set(suggestion.id, suggestion);
    return suggestion;
  }

  /**
   * 生成基於模式的建議
   */
  private async generatePatternBasedSuggestions(
    context: SuggestionContext
  ): Promise<AdaptiveSuggestion[]> {
    const suggestions: AdaptiveSuggestion[] = [];
    const patterns = this.patternRecognizer.getAllPatterns()
      .filter(p => p.language === context.language && p.confidence > 0.7);

    for (const pattern of patterns) {
      // 檢查模式是否適用於當前上下文
      if (this.isPatternApplicable(pattern, context)) {
        const suggestion = await this.createPatternSuggestion(pattern, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions;
  }

  /**
   * 生成風格建議
   */
  private async generateStyleSuggestions(
    context: SuggestionContext
  ): Promise<AdaptiveSuggestion[]> {
    const suggestions: AdaptiveSuggestion[] = [];
    const stylePreferences = this.learningEngine.getUserPreferences('style', 0.6);

    for (const preference of stylePreferences) {
      const styleSuggestion = await this.createStyleSuggestion(preference, context);
      if (styleSuggestion) {
        suggestions.push(styleSuggestion);
      }
    }

    return suggestions;
  }

  /**
   * 排序建議
   */
  private rankSuggestions(
    suggestions: AdaptiveSuggestion[],
    context: SuggestionContext
  ): AdaptiveSuggestion[] {
    return suggestions.sort((a, b) => {
      // 優先級權重
      const priorityWeight = (b.priority - a.priority) * 0.4;
      
      // 信心度權重
      const confidenceWeight = (b.confidence - a.confidence) * 0.3;
      
      // 用戶偏好匹配權重
      const preferenceWeight = this.calculatePreferenceMatch(b, context) - 
                              this.calculatePreferenceMatch(a, context);
      
      return priorityWeight + confidenceWeight + preferenceWeight * 0.3;
    });
  }

  /**
   * 更新用戶偏好
   */
  private async updatePreferencesFromFeedback(
    suggestion: AdaptiveSuggestion,
    feedback: SuggestionFeedback
  ): Promise<void> {
    const confidence = feedback.action === 'accept' ? 0.8 : 0.2;
    
    await this.learningEngine.learnUserPreference(
      'pattern',
      suggestion.type,
      {
        accepted: feedback.action === 'accept',
        suggestion: suggestion.title,
        reason: feedback.reason
      },
      [suggestion.context.language],
      confidence
    );
  }

  /**
   * 檢查偏好是否相關
   */
  private isPreferenceRelevant(
    preference: UserPreference,
    suggestion: any,
    context: SuggestionContext
  ): boolean {
    // 檢查語言匹配
    if (!preference.context.includes(context.language)) {
      return false;
    }

    // 檢查類別匹配
    if (preference.category === 'style' && suggestion.type === 'style') {
      return true;
    }

    if (preference.category === 'pattern' && suggestion.type === 'refactor') {
      return true;
    }

    return false;
  }

  /**
   * 適應代碼風格
   */
  private async adaptCodeToUserStyle(
    code: string,
    context: SuggestionContext,
    preferences: UserPreference[]
  ): Promise<string> {
    let adaptedCode = code;

    for (const preference of preferences) {
      switch (preference.name) {
        case 'arrow_function':
          if (preference.value.preference > 0.7) {
            adaptedCode = this.convertToArrowFunction(adaptedCode);
          }
          break;
        case 'camelCase':
          if (preference.value.preference > 0.7) {
            adaptedCode = this.convertToCamelCase(adaptedCode);
          }
          break;
        case 'async_await':
          if (preference.value.preference > 0.7) {
            adaptedCode = this.convertToAsyncAwait(adaptedCode);
          }
          break;
      }
    }

    return adaptedCode;
  }

  /**
   * 獲取周圍代碼
   */
  private getSurroundingCode(document: vscode.TextDocument, position: vscode.Position): string {
    const startLine = Math.max(0, position.line - 5);
    const endLine = Math.min(document.lineCount - 1, position.line + 5);
    
    let code = '';
    for (let i = startLine; i <= endLine; i++) {
      code += document.lineAt(i).text + '\n';
    }
    
    return code;
  }

  /**
   * 檢測項目類型
   */
  private async detectProjectType(uri: vscode.Uri): Promise<string | undefined> {
    // 簡單的項目類型檢測邏輯
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) return undefined;

    try {
      const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
      const packageJson = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageData = JSON.parse(packageJson.toString());
      
      if (packageData.dependencies?.react) return 'react';
      if (packageData.dependencies?.vue) return 'vue';
      if (packageData.dependencies?.angular) return 'angular';
      if (packageData.dependencies?.express) return 'express';
      
      return 'javascript';
    } catch {
      return undefined;
    }
  }

  /**
   * 輔助方法
   */
  private generateSuggestionId(): string {
    return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapToSuggestionType(type: string): SuggestionType {
    switch (type) {
      case 'completion': return SuggestionType.CODE_COMPLETION;
      case 'refactor': return SuggestionType.REFACTORING;
      case 'style': return SuggestionType.STYLE_IMPROVEMENT;
      default: return SuggestionType.BEST_PRACTICE;
    }
  }

  private calculateAdaptedConfidence(baseConfidence: number, preferences: UserPreference[]): number {
    const avgPreferenceConfidence = preferences.reduce((sum, p) => sum + p.confidence, 0) / preferences.length;
    return (baseConfidence + avgPreferenceConfidence) / 2;
  }

  private calculatePriority(suggestion: any, preferences: UserPreference[]): number {
    const basePriority = suggestion.priority || 0.5;
    const preferenceBoost = preferences.length * 0.1;
    return Math.min(1, basePriority + preferenceBoost);
  }

  private generateReasoning(suggestion: any, preferences: UserPreference[]): string {
    const baseReason = suggestion.reasoning || '基於代碼分析的建議';
    const learnedReasons = preferences.map(p => `學習到您偏好 ${p.name}`);
    return `${baseReason}。${learnedReasons.join('，')}。`;
  }

  private isPatternApplicable(pattern: any, context: SuggestionContext): boolean {
    // 簡單的模式適用性檢查
    return pattern.confidence > 0.7 && pattern.frequency > 2;
  }

  private async createPatternSuggestion(pattern: any, context: SuggestionContext): Promise<AdaptiveSuggestion | null> {
    // 創建基於模式的建議
    return null; // 簡化實現
  }

  private async createStyleSuggestion(preference: UserPreference, context: SuggestionContext): Promise<AdaptiveSuggestion | null> {
    // 創建風格建議
    return null; // 簡化實現
  }

  private calculatePreferenceMatch(suggestion: AdaptiveSuggestion, context: SuggestionContext): number {
    return suggestion.learnedFrom.length * 0.1;
  }

  private getSortText(priority: number): string {
    return String(Math.round((1 - priority) * 1000)).padStart(4, '0');
  }

  // 代碼轉換輔助方法
  private convertToArrowFunction(code: string): string {
    return code.replace(/function\s+(\w+)\s*\(([^)]*)\)\s*{/, 'const $1 = ($2) => {');
  }

  private convertToCamelCase(code: string): string {
    return code.replace(/(\w+)_(\w+)/g, (match, p1, p2) => p1 + p2.charAt(0).toUpperCase() + p2.slice(1));
  }

  private convertToAsyncAwait(code: string): string {
    return code.replace(/\.then\(([^)]+)\)/g, 'await $1');
  }
}
