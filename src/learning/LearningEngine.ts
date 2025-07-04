import * as vscode from 'vscode';
import { MemorySystem, MemoryType } from '../ai/MemorySystem';
import { CodeUnderstandingEngine } from '../ai/CodeUnderstandingEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 學習事件類型
 */
export enum LearningEventType {
  CODE_EDIT = 'code_edit',
  COMMAND_USAGE = 'command_usage',
  REFACTOR_ACCEPT = 'refactor_accept',
  REFACTOR_REJECT = 'refactor_reject',
  SUGGESTION_ACCEPT = 'suggestion_accept',
  SUGGESTION_REJECT = 'suggestion_reject',
  ERROR_ENCOUNTER = 'error_encounter',
  PATTERN_USAGE = 'pattern_usage',
  STYLE_PREFERENCE = 'style_preference'
}

/**
 * 學習事件
 */
export interface LearningEvent {
  id: string;
  type: LearningEventType;
  timestamp: Date;
  context: LearningContext;
  data: Record<string, any>;
  outcome?: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

/**
 * 學習上下文
 */
export interface LearningContext {
  fileUri: vscode.Uri;
  language: string;
  projectType?: string;
  framework?: string;
  codeContext?: string;
  userAction?: string;
  sessionId: string;
}

/**
 * 編碼模式
 */
export interface CodingPattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  language: string;
  frequency: number;
  confidence: number;
  lastSeen: Date;
  examples: string[];
  contexts: string[];
  effectiveness: number;
}

/**
 * 用戶偏好
 */
export interface UserPreference {
  id: string;
  category: 'style' | 'pattern' | 'tool' | 'workflow' | 'suggestion';
  name: string;
  value: any;
  confidence: number;
  frequency: number;
  lastUpdated: Date;
  context: string[];
}

/**
 * 學習統計
 */
export interface LearningStats {
  totalEvents: number;
  eventsByType: Record<LearningEventType, number>;
  patternsLearned: number;
  preferencesIdentified: number;
  averageConfidence: number;
  learningRate: number;
  lastLearningSession: Date;
}

/**
 * 持續學習引擎
 * 自動學習用戶編碼風格和模式
 */
export class LearningEngine {
  private static instance: LearningEngine;
  private memorySystem: MemorySystem;
  private codeEngine: CodeUnderstandingEngine;
  private events: Map<string, LearningEvent> = new Map();
  private patterns: Map<string, CodingPattern> = new Map();
  private preferences: Map<string, UserPreference> = new Map();
  private sessionId: string;
  private isLearningEnabled = true;

  private constructor() {
    this.memorySystem = MemorySystem.getInstance();
    this.codeEngine = CodeUnderstandingEngine.getInstance();
    this.sessionId = this.generateSessionId();
    this.setupEventListeners();
    this.loadLearningData();
  }

  static getInstance(): LearningEngine {
    if (!LearningEngine.instance) {
      LearningEngine.instance = new LearningEngine();
    }
    return LearningEngine.instance;
  }

  /**
   * 記錄學習事件
   */
  async recordEvent(
    type: LearningEventType,
    context: LearningContext,
    data: Record<string, any>,
    outcome?: 'positive' | 'negative' | 'neutral'
  ): Promise<void> {
    if (!this.isLearningEnabled) {return;}

    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const event: LearningEvent = {
          id: this.generateEventId(),
          type,
          timestamp: new Date(),
          context,
          data,
          outcome,
          confidence: this.calculateEventConfidence(type, data, outcome)
        };

        this.events.set(event.id, event);

        // 分析事件並更新學習模型
        await this.analyzeEvent(event);

        // 保存到記憶系統
        await this.memorySystem.addMemory(
          MemoryType.WORKFLOW,
          `Learning event: ${type}`,
          {
            context: context.language,
            confidence: event.confidence,
            triggers: [type, context.language]
          },
          event.confidence
        );
      },
      `記錄學習事件 ${type}`,
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 學習編碼模式
   */
  async learnCodingPattern(
    code: string,
    language: string,
    context: string,
    effectiveness: number = 0.5
  ): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const patternId = this.generatePatternId(code, language);
        const existing = this.patterns.get(patternId);

        if (existing) {
          // 更新現有模式
          existing.frequency++;
          existing.effectiveness = (existing.effectiveness + effectiveness) / 2;
          existing.lastSeen = new Date();
          existing.contexts.push(context);
          existing.confidence = Math.min(1, existing.confidence + 0.1);
        } else {
          // 創建新模式
          const pattern: CodingPattern = {
            id: patternId,
            name: this.generatePatternName(code, language),
            description: `Coding pattern in ${language}`,
            pattern: code,
            language,
            frequency: 1,
            confidence: 0.5,
            lastSeen: new Date(),
            examples: [code],
            contexts: [context],
            effectiveness
          };
          this.patterns.set(patternId, pattern);
        }

        // 保存到記憶系統
        await this.memorySystem.learnCodePattern(code, language, effectiveness);
      },
      '學習編碼模式',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 學習用戶偏好
   */
  async learnUserPreference(
    category: 'style' | 'pattern' | 'tool' | 'workflow' | 'suggestion',
    name: string,
    value: any,
    context: string[],
    confidence: number = 0.5
  ): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const prefId = `${category}-${name}`;
        const existing = this.preferences.get(prefId);

        if (existing) {
          // 更新現有偏好
          existing.frequency++;
          existing.confidence = (existing.confidence + confidence) / 2;
          existing.lastUpdated = new Date();
          existing.context.push(...context);
        } else {
          // 創建新偏好
          const preference: UserPreference = {
            id: prefId,
            category,
            name,
            value,
            confidence,
            frequency: 1,
            lastUpdated: new Date(),
            context
          };
          this.preferences.set(prefId, preference);
        }

        // 保存到記憶系統
        await this.memorySystem.learnUserPreference(
          `${category}:${name}`,
          context.join(','),
          confidence > 0.5 ? 'positive' : 'negative'
        );
      },
      '學習用戶偏好',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 獲取學習到的模式
   */
  getLearnedPatterns(language?: string, minConfidence: number = 0.5): CodingPattern[] {
    let patterns = Array.from(this.patterns.values());

    if (language) {
      patterns = patterns.filter(p => p.language === language);
    }

    return patterns.filter(p => p.confidence >= minConfidence).sort((a, b) => b.effectiveness - a.effectiveness);
  }

  /**
   * 獲取用戶偏好
   */
  getUserPreferences(category?: string, minConfidence: number = 0.5): UserPreference[] {
    let preferences = Array.from(this.preferences.values());

    if (category) {
      preferences = preferences.filter(p => p.category === category);
    }

    return preferences.filter(p => p.confidence >= minConfidence).sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * 獲取學習統計
   */
  getLearningStats(): LearningStats {
    const events = Array.from(this.events.values());
    const eventsByType: Record<LearningEventType, number> = {} as any;

    // 初始化計數器
    Object.values(LearningEventType).forEach(type => {
      eventsByType[type] = 0;
    });

    // 計算事件統計
    events.forEach(event => {
      eventsByType[event.type]++;
    });

    const totalConfidence = events.reduce((sum, event) => sum + event.confidence, 0);
    const averageConfidence = events.length > 0 ? totalConfidence / events.length : 0;

    // 計算學習率（最近一週的事件數量）
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter(e => e.timestamp > oneWeekAgo);
    const learningRate = recentEvents.length / 7; // 每天平均事件數

    return {
      totalEvents: events.length,
      eventsByType,
      patternsLearned: this.patterns.size,
      preferencesIdentified: this.preferences.size,
      averageConfidence,
      learningRate,
      lastLearningSession: events.length > 0 ? events[events.length - 1].timestamp : new Date()
    };
  }

  /**
   * 分析事件並更新學習模型
   */
  private async analyzeEvent(event: LearningEvent): Promise<void> {
    switch (event.type) {
      case LearningEventType.CODE_EDIT:
        await this.analyzeCodeEdit(event);
        break;
      case LearningEventType.REFACTOR_ACCEPT:
      case LearningEventType.SUGGESTION_ACCEPT:
        await this.analyzePositiveFeedback(event);
        break;
      case LearningEventType.REFACTOR_REJECT:
      case LearningEventType.SUGGESTION_REJECT:
        await this.analyzeNegativeFeedback(event);
        break;
      case LearningEventType.PATTERN_USAGE:
        await this.analyzePatternUsage(event);
        break;
      case LearningEventType.STYLE_PREFERENCE:
        await this.analyzeStylePreference(event);
        break;
    }
  }

  /**
   * 分析代碼編輯事件
   */
  private async analyzeCodeEdit(event: LearningEvent): Promise<void> {
    const { code, language } = event.data;
    if (code && language) {
      await this.learnCodingPattern(code, language, event.context.projectType || 'general', event.confidence);
    }
  }

  /**
   * 分析正面反饋
   */
  private async analyzePositiveFeedback(event: LearningEvent): Promise<void> {
    const { suggestion, pattern } = event.data;
    if (suggestion) {
      await this.learnUserPreference(
        'pattern',
        suggestion.type || 'general',
        suggestion,
        [event.context.language],
        0.8
      );
    }
  }

  /**
   * 分析負面反饋
   */
  private async analyzeNegativeFeedback(event: LearningEvent): Promise<void> {
    const { suggestion, reason } = event.data;
    if (suggestion) {
      await this.learnUserPreference(
        'pattern',
        suggestion.type || 'general',
        { rejected: true, reason },
        [event.context.language],
        0.2
      );
    }
  }

  /**
   * 分析模式使用
   */
  private async analyzePatternUsage(event: LearningEvent): Promise<void> {
    const { pattern, frequency } = event.data;
    if (pattern) {
      await this.learnCodingPattern(
        pattern,
        event.context.language,
        event.context.projectType || 'general',
        frequency || 0.7
      );
    }
  }

  /**
   * 分析風格偏好
   */
  private async analyzeStylePreference(event: LearningEvent): Promise<void> {
    const { style, preference } = event.data;
    if (style && preference) {
      await this.learnUserPreference('style', style, preference, [event.context.language], event.confidence);
    }
  }

  /**
   * 設置事件監聽器
   */
  private setupEventListeners(): void {
    // 監聽文件變更
    vscode.workspace.onDidChangeTextDocument(async event => {
      if (this.isLearningEnabled) {
        await this.recordEvent(
          LearningEventType.CODE_EDIT,
          {
            fileUri: event.document.uri,
            language: event.document.languageId,
            sessionId: this.sessionId
          },
          {
            changes: event.contentChanges.length,
            code: event.contentChanges[0]?.text
          }
        );
      }
    });

    // 監聽命令執行
    // 注意：VS Code 沒有直接的命令監聽 API，這裡是示例
  }

  /**
   * 計算事件信心度
   */
  private calculateEventConfidence(type: LearningEventType, data: Record<string, any>, outcome?: string): number {
    let baseConfidence = 0.5;

    // 根據事件類型調整信心度
    switch (type) {
      case LearningEventType.REFACTOR_ACCEPT:
      case LearningEventType.SUGGESTION_ACCEPT:
        baseConfidence = 0.9;
        break;
      case LearningEventType.REFACTOR_REJECT:
      case LearningEventType.SUGGESTION_REJECT:
        baseConfidence = 0.8;
        break;
      case LearningEventType.CODE_EDIT:
        baseConfidence = 0.6;
        break;
      default:
        baseConfidence = 0.5;
    }

    // 根據結果調整
    if (outcome === 'positive') {
      baseConfidence += 0.2;
    } else if (outcome === 'negative') {
      baseConfidence -= 0.2;
    }

    return Math.max(0, Math.min(1, baseConfidence));
  }

  /**
   * 生成會話 ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成事件 ID
   */
  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成模式 ID
   */
  private generatePatternId(code: string, language: string): string {
    const hash = this.simpleHash(code + language);
    return `pattern-${language}-${hash}`;
  }

  /**
   * 生成模式名稱
   */
  private generatePatternName(code: string, language: string): string {
    // 簡單的模式名稱生成邏輯
    if (code.includes('function')) {return 'Function Pattern';}
    if (code.includes('class')) {return 'Class Pattern';}
    if (code.includes('if')) {return 'Conditional Pattern';}
    if (code.includes('for') || code.includes('while')) {return 'Loop Pattern';}
    return 'Code Pattern';
  }

  /**
   * 簡單哈希函數
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 轉換為 32 位整數
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 加載學習數據
   */
  private async loadLearningData(): Promise<void> {
    // 從持久化存儲加載數據
    // 這裡可以從文件或數據庫加載
  }

  /**
   * 保存學習數據
   */
  async saveLearningData(): Promise<void> {
    // 保存到持久化存儲
    // 這裡可以保存到文件或數據庫
  }

  /**
   * 啟用/禁用學習
   */
  setLearningEnabled(enabled: boolean): void {
    this.isLearningEnabled = enabled;
  }

  /**
   * 清除學習數據
   */
  clearLearningData(): void {
    this.events.clear();
    this.patterns.clear();
    this.preferences.clear();
  }

  /**
   * 獲取完成模式
   */
  async getCompletionPatterns(languageId: string, currentWord: string): Promise<any[]> {
    // 佔位符實現
    console.log(`Getting completion patterns for ${languageId} with word ${currentWord}`);
    return [];
  }

  /**
   * 記錄完成使用情況
   */
  recordCompletionUsage(completionId: string, usageDate: Date): void {
    // 佔位符實現
    console.log(`Recording usage for completion ${completionId} at ${usageDate}`);
  }
}
