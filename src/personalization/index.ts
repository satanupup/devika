/**
 * 個性化建議系統模組
 * 
 * 此模組實現了 Devika VS Code Extension 的個性化建議功能，
 * 基於用戶習慣和歷史行為提供個性化的代碼建議和改進建議。
 */

// 核心個性化引擎
export {
  PersonalizationEngine,
  PersonalizedSuggestion,
  SuggestionType,
  SuggestionPriority,
  SuggestionContext,
  SuggestionAction,
  UserBehaviorPattern,
  PersonalizationConfig
} from './PersonalizationEngine';

// 建議生成器
export {
  SuggestionGenerator
} from './SuggestionGenerator';

// 個性化提供者
export {
  PersonalizationProvider
} from './PersonalizationProvider';

// 個性化命令提供者
export {
  PersonalizationCommandProvider
} from './PersonalizationCommandProvider';

/**
 * 初始化個性化建議系統
 * 
 * @param context VS Code 擴展上下文
 * @returns Promise<void>
 */
export async function initializePersonalizationSystem(context: vscode.ExtensionContext): Promise<void> {
  try {
    // 初始化個性化引擎
    const personalizationEngine = PersonalizationEngine.getInstance();
    
    // 初始化建議生成器
    const suggestionGenerator = SuggestionGenerator.getInstance();
    
    // 註冊個性化提供者
    const personalizationProvider = PersonalizationProvider.register(context);
    
    // 註冊命令
    const commandProvider = new PersonalizationCommandProvider(personalizationProvider);
    commandProvider.registerCommands(context);
    
    console.log('個性化建議系統初始化完成');
  } catch (error) {
    console.error('個性化建議系統初始化失敗:', error);
    throw error;
  }
}

/**
 * 個性化系統配置
 */
export interface PersonalizationSystemConfig {
  /** 是否啟用個性化建議 */
  enabled: boolean;
  
  /** 啟用的建議類型 */
  enabledSuggestionTypes: SuggestionType[];
  
  /** 最低信心度閾值 */
  minConfidenceThreshold: number;
  
  /** 每次顯示的最大建議數 */
  maxSuggestionsPerContext: number;
  
  /** 學習速度 */
  learningRate: number;
  
  /** 適應速度 */
  adaptationSpeed: number;
  
  /** 隱私級別 */
  privacyLevel: 'minimal' | 'balanced' | 'comprehensive';
  
  /** 是否啟用自動建議 */
  autoSuggestions: boolean;
  
  /** 建議顯示延遲（毫秒） */
  suggestionDelay: number;
}

/**
 * 默認個性化系統配置
 */
export const DEFAULT_PERSONALIZATION_CONFIG: PersonalizationSystemConfig = {
  enabled: true,
  enabledSuggestionTypes: Object.values(SuggestionType),
  minConfidenceThreshold: 0.5,
  maxSuggestionsPerContext: 10,
  learningRate: 0.1,
  adaptationSpeed: 0.05,
  privacyLevel: 'balanced',
  autoSuggestions: true,
  suggestionDelay: 1000
};

/**
 * 個性化系統狀態
 */
export interface PersonalizationSystemStatus {
  /** 是否已初始化 */
  initialized: boolean;
  
  /** 是否啟用 */
  enabled: boolean;
  
  /** 當前配置 */
  config: PersonalizationSystemConfig;
  
  /** 統計信息 */
  stats: {
    totalSuggestions: number;
    acceptedSuggestions: number;
    rejectedSuggestions: number;
    averageConfidence: number;
    learnedPatterns: number;
    userPreferences: number;
  };
  
  /** 最後更新時間 */
  lastUpdated: Date;
  
  /** 錯誤信息 */
  errors: string[];
}

/**
 * 獲取個性化系統狀態
 */
export function getPersonalizationSystemStatus(): PersonalizationSystemStatus {
  try {
    const personalizationEngine = PersonalizationEngine.getInstance();
    
    return {
      initialized: true,
      enabled: true, // 從配置獲取
      config: DEFAULT_PERSONALIZATION_CONFIG,
      stats: {
        totalSuggestions: 0, // 從引擎獲取
        acceptedSuggestions: 0,
        rejectedSuggestions: 0,
        averageConfidence: 0.7,
        learnedPatterns: 0,
        userPreferences: 0
      },
      lastUpdated: new Date(),
      errors: []
    };
  } catch (error) {
    return {
      initialized: false,
      enabled: false,
      config: DEFAULT_PERSONALIZATION_CONFIG,
      stats: {
        totalSuggestions: 0,
        acceptedSuggestions: 0,
        rejectedSuggestions: 0,
        averageConfidence: 0,
        learnedPatterns: 0,
        userPreferences: 0
      },
      lastUpdated: new Date(),
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * 個性化事件類型
 */
export enum PersonalizationEventType {
  SUGGESTION_GENERATED = 'suggestion_generated',
  SUGGESTION_ACCEPTED = 'suggestion_accepted',
  SUGGESTION_REJECTED = 'suggestion_rejected',
  PREFERENCE_LEARNED = 'preference_learned',
  PATTERN_IDENTIFIED = 'pattern_identified',
  CONFIG_CHANGED = 'config_changed'
}

/**
 * 個性化事件
 */
export interface PersonalizationEvent {
  type: PersonalizationEventType;
  timestamp: Date;
  data: any;
  context?: {
    fileUri?: vscode.Uri;
    language?: string;
    suggestionType?: SuggestionType;
  };
}

/**
 * 個性化事件監聽器
 */
export type PersonalizationEventListener = (event: PersonalizationEvent) => void;

/**
 * 個性化事件管理器
 */
class PersonalizationEventManager {
  private listeners: Map<PersonalizationEventType, PersonalizationEventListener[]> = new Map();
  
  /**
   * 添加事件監聽器
   */
  addEventListener(type: PersonalizationEventType, listener: PersonalizationEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }
  
  /**
   * 移除事件監聽器
   */
  removeEventListener(type: PersonalizationEventType, listener: PersonalizationEventListener): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  /**
   * 觸發事件
   */
  dispatchEvent(event: PersonalizationEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('個性化事件監聽器錯誤:', error);
        }
      });
    }
  }
  
  /**
   * 清除所有監聽器
   */
  clearAllListeners(): void {
    this.listeners.clear();
  }
}

/**
 * 全局個性化事件管理器實例
 */
export const personalizationEventManager = new PersonalizationEventManager();

/**
 * 個性化工具函數
 */
export class PersonalizationUtils {
  /**
   * 計算建議相關性
   */
  static calculateSuggestionRelevance(
    suggestion: PersonalizedSuggestion,
    context: SuggestionContext
  ): number {
    let relevance = suggestion.confidence;
    
    // 基於語言匹配
    if (suggestion.context.language === context.language) {
      relevance += 0.1;
    }
    
    // 基於項目類型匹配
    if (suggestion.context.projectType === context.projectType) {
      relevance += 0.1;
    }
    
    // 基於用戶偏好匹配
    const preferenceMatch = context.userPreferences.some(pref => 
      pref.category === 'suggestion' && pref.name === suggestion.type
    );
    if (preferenceMatch) {
      relevance += 0.2;
    }
    
    return Math.min(relevance, 1);
  }
  
  /**
   * 格式化建議描述
   */
  static formatSuggestionDescription(suggestion: PersonalizedSuggestion): string {
    const icon = this.getSuggestionIcon(suggestion.type);
    const priority = this.getPriorityText(suggestion.priority);
    const confidence = Math.round(suggestion.confidence * 100);
    
    return `${icon} ${suggestion.title} (${priority}, ${confidence}% 信心度)`;
  }
  
  /**
   * 獲取建議圖標
   */
  static getSuggestionIcon(type: SuggestionType): string {
    const icons = {
      [SuggestionType.CODE_STYLE]: '🎨',
      [SuggestionType.REFACTORING]: '🔧',
      [SuggestionType.BEST_PRACTICE]: '⭐',
      [SuggestionType.PERFORMANCE]: '⚡',
      [SuggestionType.SECURITY]: '🔒',
      [SuggestionType.TESTING]: '🧪',
      [SuggestionType.DOCUMENTATION]: '📚',
      [SuggestionType.DEPENDENCY]: '📦',
      [SuggestionType.WORKFLOW]: '🔄',
      [SuggestionType.LEARNING]: '🎓'
    };
    return icons[type] || '💡';
  }
  
  /**
   * 獲取優先級文本
   */
  static getPriorityText(priority: SuggestionPriority): string {
    const texts = {
      [SuggestionPriority.CRITICAL]: '緊急',
      [SuggestionPriority.HIGH]: '高',
      [SuggestionPriority.MEDIUM]: '中',
      [SuggestionPriority.LOW]: '低'
    };
    return texts[priority] || '未知';
  }
  
  /**
   * 驗證建議數據
   */
  static validateSuggestion(suggestion: PersonalizedSuggestion): boolean {
    // 檢查必需字段
    if (!suggestion.id || !suggestion.type || !suggestion.title) {
      return false;
    }
    
    // 檢查信心度範圍
    if (suggestion.confidence < 0 || suggestion.confidence > 1) {
      return false;
    }
    
    // 檢查行動數組
    if (!Array.isArray(suggestion.actions)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 合併建議上下文
   */
  static mergeSuggestionContexts(
    context1: SuggestionContext,
    context2: Partial<SuggestionContext>
  ): SuggestionContext {
    return {
      ...context1,
      ...context2,
      relatedFiles: [...context1.relatedFiles, ...(context2.relatedFiles || [])],
      dependencies: [...context1.dependencies, ...(context2.dependencies || [])],
      userPreferences: [...context1.userPreferences, ...(context2.userPreferences || [])],
      recentPatterns: [...context1.recentPatterns, ...(context2.recentPatterns || [])],
      conversationHistory: [...context1.conversationHistory, ...(context2.conversationHistory || [])]
    };
  }
  
  /**
   * 生成建議摘要報告
   */
  static generateSuggestionSummary(suggestions: PersonalizedSuggestion[]): string {
    const typeCount = suggestions.reduce((acc, suggestion) => {
      acc[suggestion.type] = (acc[suggestion.type] || 0) + 1;
      return acc;
    }, {} as Record<SuggestionType, number>);
    
    const averageConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    const actionableCount = suggestions.filter(s => s.actionable).length;
    
    return `
個性化建議摘要
==============
總建議數: ${suggestions.length}
可執行建議: ${actionableCount}
平均信心度: ${(averageConfidence * 100).toFixed(1)}%

建議類型分布:
${Object.entries(typeCount)
  .map(([type, count]) => `  ${PersonalizationUtils.getSuggestionIcon(type as SuggestionType)} ${type}: ${count}`)
  .join('\n')}
    `.trim();
  }
}

// 重新導出 vscode 類型以便使用
import * as vscode from 'vscode';
