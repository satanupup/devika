/**
 * 持續學習機制模組
 * 
 * 此模組實現了 Devika VS Code Extension 的持續學習功能，
 * 包括用戶編碼模式識別、偏好學習、適應性建議等功能。
 */

// 核心學習引擎
export {
  LearningEngine,
  LearningEventType,
  LearningEvent,
  LearningContext,
  CodingPattern,
  UserPreference,
  LearningStats
} from './LearningEngine';

// 模式識別器
export {
  PatternRecognizer,
  PatternType,
  IdentifiedPattern
} from './PatternRecognizer';

// 適應性建議系統
export {
  AdaptiveSuggestionSystem,
  SuggestionType,
  AdaptiveSuggestion,
  SuggestionContext,
  SuggestionFeedback
} from './AdaptiveSuggestionSystem';

// 學習數據管理器
export {
  LearningDataManager,
  LearningData,
  ExportOptions
} from './LearningDataManager';

// 學習命令提供者
export {
  LearningCommandProvider
} from './LearningCommandProvider';

/**
 * 初始化持續學習機制
 * 
 * @param context VS Code 擴展上下文
 * @returns Promise<void>
 */
export async function initializeLearningSystem(context: vscode.ExtensionContext): Promise<void> {
  try {
    // 初始化學習引擎
    const learningEngine = LearningEngine.getInstance();
    
    // 初始化模式識別器
    const patternRecognizer = PatternRecognizer.getInstance();
    
    // 初始化適應性建議系統
    const adaptiveSuggestions = AdaptiveSuggestionSystem.getInstance();
    
    // 初始化數據管理器
    const dataManager = LearningDataManager.getInstance();
    
    // 加載學習數據
    await dataManager.loadLearningData();
    
    // 註冊命令
    const commandProvider = new LearningCommandProvider();
    commandProvider.registerCommands(context);
    
    // 設置清理回調
    context.subscriptions.push({
      dispose: () => {
        dataManager.dispose();
      }
    });
    
    console.log('持續學習機制初始化完成');
  } catch (error) {
    console.error('持續學習機制初始化失敗:', error);
    throw error;
  }
}

/**
 * 學習系統配置
 */
export interface LearningSystemConfig {
  /** 是否啟用學習 */
  enabled: boolean;
  
  /** 自動保存間隔（分鐘） */
  autoSaveInterval: number;
  
  /** 最大事件數量 */
  maxEvents: number;
  
  /** 最小信心度閾值 */
  minConfidenceThreshold: number;
  
  /** 是否啟用模式識別 */
  enablePatternRecognition: boolean;
  
  /** 是否啟用適應性建議 */
  enableAdaptiveSuggestions: boolean;
  
  /** 數據保留天數 */
  dataRetentionDays: number;
}

/**
 * 默認學習系統配置
 */
export const DEFAULT_LEARNING_CONFIG: LearningSystemConfig = {
  enabled: true,
  autoSaveInterval: 5,
  maxEvents: 10000,
  minConfidenceThreshold: 0.5,
  enablePatternRecognition: true,
  enableAdaptiveSuggestions: true,
  dataRetentionDays: 90
};

/**
 * 學習系統狀態
 */
export interface LearningSystemStatus {
  /** 是否已初始化 */
  initialized: boolean;
  
  /** 是否啟用 */
  enabled: boolean;
  
  /** 學習統計 */
  stats: LearningStats;
  
  /** 最後更新時間 */
  lastUpdated: Date;
  
  /** 錯誤信息 */
  errors: string[];
}

/**
 * 獲取學習系統狀態
 */
export function getLearningSystemStatus(): LearningSystemStatus {
  try {
    const learningEngine = LearningEngine.getInstance();
    const stats = learningEngine.getLearningStats();
    
    return {
      initialized: true,
      enabled: true, // 從配置獲取
      stats,
      lastUpdated: new Date(),
      errors: []
    };
  } catch (error) {
    return {
      initialized: false,
      enabled: false,
      stats: {
        totalEvents: 0,
        eventsByType: {} as any,
        patternsLearned: 0,
        preferencesIdentified: 0,
        averageConfidence: 0,
        learningRate: 0,
        lastLearningSession: new Date()
      },
      lastUpdated: new Date(),
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * 學習事件監聽器類型
 */
export type LearningEventListener = (event: LearningEvent) => void;

/**
 * 學習事件管理器
 */
class LearningEventManager {
  private listeners: Map<LearningEventType, LearningEventListener[]> = new Map();
  
  /**
   * 添加事件監聽器
   */
  addEventListener(type: LearningEventType, listener: LearningEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }
  
  /**
   * 移除事件監聽器
   */
  removeEventListener(type: LearningEventType, listener: LearningEventListener): void {
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
  dispatchEvent(event: LearningEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('學習事件監聽器錯誤:', error);
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
 * 全局學習事件管理器實例
 */
export const learningEventManager = new LearningEventManager();

/**
 * 學習系統工具函數
 */
export class LearningUtils {
  /**
   * 計算代碼相似度
   */
  static calculateCodeSimilarity(code1: string, code2: string): number {
    // 簡單的相似度計算
    const words1 = code1.split(/\W+/).filter(w => w.length > 0);
    const words2 = code2.split(/\W+/).filter(w => w.length > 0);
    
    const intersection = words1.filter(w => words2.includes(w));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }
  
  /**
   * 提取代碼特徵
   */
  static extractCodeFeatures(code: string, language: string): Record<string, any> {
    const features: Record<string, any> = {
      length: code.length,
      lines: code.split('\n').length,
      language,
      hasAsync: code.includes('async'),
      hasAwait: code.includes('await'),
      hasPromise: code.includes('Promise'),
      hasTryCatch: code.includes('try') && code.includes('catch'),
      hasArrowFunction: code.includes('=>'),
      hasClass: code.includes('class'),
      hasInterface: code.includes('interface'),
      hasImport: code.includes('import'),
      hasExport: code.includes('export')
    };
    
    // 計算複雜度指標
    features.cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
    features.nestingDepth = this.calculateNestingDepth(code);
    
    return features;
  }
  
  /**
   * 計算圈複雜度
   */
  static calculateCyclomaticComplexity(code: string): number {
    const keywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?'];
    let complexity = 1; // 基礎複雜度
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }
  
  /**
   * 計算嵌套深度
   */
  static calculateNestingDepth(code: string): number {
    let depth = 0;
    let maxDepth = 0;
    
    for (const char of code) {
      if (char === '{') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (char === '}') {
        depth--;
      }
    }
    
    return maxDepth;
  }
  
  /**
   * 格式化學習統計
   */
  static formatLearningStats(stats: LearningStats): string {
    return `
學習統計報告
===========
總事件數: ${stats.totalEvents}
學習模式數: ${stats.patternsLearned}
用戶偏好數: ${stats.preferencesIdentified}
平均信心度: ${(stats.averageConfidence * 100).toFixed(1)}%
學習率: ${stats.learningRate.toFixed(2)} 事件/天
最後學習: ${stats.lastLearningSession.toLocaleString()}

事件類型分布:
${Object.entries(stats.eventsByType)
  .map(([type, count]) => `  ${type}: ${count}`)
  .join('\n')}
    `.trim();
  }
}

// 重新導出 vscode 類型以便使用
import * as vscode from 'vscode';
