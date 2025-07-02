/**
 * 記憶系統模組
 * 
 * 此模組包含 Devika VS Code Extension 的記憶管理功能，
 * 包括基礎記憶系統和對話記憶系統。
 */

// 基礎記憶系統
export { MemorySystem, MemoryType } from './MemorySystem';

// 對話記憶系統
export {
  ConversationMemoryManager,
  ConversationType,
  ConversationMessage,
  ConversationSession,
  ConversationContext,
  MemoryRetrievalResult
} from './ConversationMemoryManager';

export {
  ConversationContextAnalyzer,
  ContextAnalysisResult,
  CodeReference,
  ConversationPattern,
  ContextInheritanceRule
} from './ConversationContextAnalyzer';

export {
  ConversationPersistenceManager,
  StorageConfig,
  ExportOptions,
  ImportResult,
  StorageStats
} from './ConversationPersistenceManager';

export {
  ConversationCommandProvider
} from './ConversationCommandProvider';

/**
 * 初始化對話記憶系統
 * 
 * @param context VS Code 擴展上下文
 * @returns Promise<void>
 */
export async function initializeConversationMemorySystem(context: vscode.ExtensionContext): Promise<void> {
  try {
    // 初始化對話記憶管理器
    const memoryManager = ConversationMemoryManager.getInstance();
    
    // 初始化上下文分析器
    const contextAnalyzer = ConversationContextAnalyzer.getInstance();
    
    // 初始化持久化管理器
    const persistenceManager = ConversationPersistenceManager.getInstance();
    
    // 加載歷史對話數據
    await persistenceManager.loadAllSessions();
    
    // 註冊命令
    const commandProvider = new ConversationCommandProvider();
    commandProvider.registerCommands(context);
    
    // 設置清理回調
    context.subscriptions.push({
      dispose: () => {
        memoryManager.dispose();
        persistenceManager.dispose();
      }
    });
    
    console.log('對話記憶系統初始化完成');
  } catch (error) {
    console.error('對話記憶系統初始化失敗:', error);
    throw error;
  }
}

/**
 * 對話記憶系統配置
 */
export interface ConversationMemoryConfig {
  /** 是否啟用對話記憶 */
  enabled: boolean;
  
  /** 最大活躍會話數 */
  maxActiveSessions: number;
  
  /** 最大歷史會話數 */
  maxHistorySessions: number;
  
  /** 上下文窗口大小 */
  contextWindow: number;
  
  /** 數據保留天數 */
  retentionDays: number;
  
  /** 是否啟用自動備份 */
  autoBackup: boolean;
  
  /** 備份間隔（小時） */
  backupInterval: number;
  
  /** 是否啟用上下文分析 */
  enableContextAnalysis: boolean;
  
  /** 是否啟用模式識別 */
  enablePatternRecognition: boolean;
}

/**
 * 默認對話記憶配置
 */
export const DEFAULT_CONVERSATION_MEMORY_CONFIG: ConversationMemoryConfig = {
  enabled: true,
  maxActiveSessions: 5,
  maxHistorySessions: 100,
  contextWindow: 50,
  retentionDays: 90,
  autoBackup: true,
  backupInterval: 24,
  enableContextAnalysis: true,
  enablePatternRecognition: true
};

/**
 * 對話記憶系統狀態
 */
export interface ConversationMemoryStatus {
  /** 是否已初始化 */
  initialized: boolean;
  
  /** 是否啟用 */
  enabled: boolean;
  
  /** 當前活躍會話數 */
  activeSessions: number;
  
  /** 歷史會話數 */
  historySessions: number;
  
  /** 當前會話 ID */
  currentSessionId: string | null;
  
  /** 最後更新時間 */
  lastUpdated: Date;
  
  /** 錯誤信息 */
  errors: string[];
}

/**
 * 獲取對話記憶系統狀態
 */
export function getConversationMemoryStatus(): ConversationMemoryStatus {
  try {
    const memoryManager = ConversationMemoryManager.getInstance();
    const currentSession = memoryManager.getCurrentSession();
    const history = memoryManager.getSessionHistory();
    
    return {
      initialized: true,
      enabled: true, // 從配置獲取
      activeSessions: 1, // 需要從 memoryManager 獲取活躍會話數
      historySessions: history.length,
      currentSessionId: currentSession?.id || null,
      lastUpdated: new Date(),
      errors: []
    };
  } catch (error) {
    return {
      initialized: false,
      enabled: false,
      activeSessions: 0,
      historySessions: 0,
      currentSessionId: null,
      lastUpdated: new Date(),
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * 對話記憶事件類型
 */
export enum ConversationMemoryEventType {
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended',
  MESSAGE_ADDED = 'message_added',
  CONTEXT_ANALYZED = 'context_analyzed',
  PATTERN_IDENTIFIED = 'pattern_identified',
  MEMORY_RETRIEVED = 'memory_retrieved'
}

/**
 * 對話記憶事件
 */
export interface ConversationMemoryEvent {
  type: ConversationMemoryEventType;
  sessionId: string;
  timestamp: Date;
  data: any;
}

/**
 * 對話記憶事件監聽器
 */
export type ConversationMemoryEventListener = (event: ConversationMemoryEvent) => void;

/**
 * 對話記憶事件管理器
 */
class ConversationMemoryEventManager {
  private listeners: Map<ConversationMemoryEventType, ConversationMemoryEventListener[]> = new Map();
  
  /**
   * 添加事件監聽器
   */
  addEventListener(type: ConversationMemoryEventType, listener: ConversationMemoryEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }
  
  /**
   * 移除事件監聽器
   */
  removeEventListener(type: ConversationMemoryEventType, listener: ConversationMemoryEventListener): void {
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
  dispatchEvent(event: ConversationMemoryEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('對話記憶事件監聽器錯誤:', error);
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
 * 全局對話記憶事件管理器實例
 */
export const conversationMemoryEventManager = new ConversationMemoryEventManager();

/**
 * 對話記憶工具函數
 */
export class ConversationMemoryUtils {
  /**
   * 計算對話相似度
   */
  static calculateConversationSimilarity(session1: ConversationSession, session2: ConversationSession): number {
    // 基於標籤相似度
    const tagSimilarity = this.calculateTagSimilarity(session1.tags, session2.tags);
    
    // 基於類型相似度
    const typeSimilarity = session1.type === session2.type ? 1 : 0;
    
    // 基於上下文相似度
    const contextSimilarity = this.calculateContextSimilarity(session1.context, session2.context);
    
    return (tagSimilarity * 0.4 + typeSimilarity * 0.3 + contextSimilarity * 0.3);
  }
  
  /**
   * 計算標籤相似度
   */
  static calculateTagSimilarity(tags1: string[], tags2: string[]): number {
    const intersection = tags1.filter(tag => tags2.includes(tag));
    const union = [...new Set([...tags1, ...tags2])];
    return union.length > 0 ? intersection.length / union.length : 0;
  }
  
  /**
   * 計算上下文相似度
   */
  static calculateContextSimilarity(context1: ConversationContext, context2: ConversationContext): number {
    let similarity = 0;
    let factors = 0;
    
    // 文件相似度
    if (context1.currentFile && context2.currentFile) {
      similarity += context1.currentFile.fsPath === context2.currentFile.fsPath ? 1 : 0;
      factors++;
    }
    
    // 項目類型相似度
    if (context1.projectType && context2.projectType) {
      similarity += context1.projectType === context2.projectType ? 1 : 0;
      factors++;
    }
    
    // 主題相似度
    if (context1.relatedTopics && context2.relatedTopics) {
      const topicSimilarity = this.calculateTagSimilarity(context1.relatedTopics, context2.relatedTopics);
      similarity += topicSimilarity;
      factors++;
    }
    
    return factors > 0 ? similarity / factors : 0;
  }
  
  /**
   * 提取對話摘要
   */
  static extractConversationSummary(session: ConversationSession, maxLength: number = 200): string {
    if (session.summary) {
      return session.summary.length > maxLength 
        ? session.summary.substring(0, maxLength) + '...'
        : session.summary;
    }
    
    // 基於消息內容生成摘要
    const userMessages = session.messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ');
    
    if (userMessages.length <= maxLength) {
      return userMessages;
    }
    
    return userMessages.substring(0, maxLength) + '...';
  }
  
  /**
   * 格式化對話統計
   */
  static formatConversationStats(stats: StorageStats): string {
    return `
對話記憶統計報告
==============
總會話數: ${stats.totalSessions}
總消息數: ${stats.totalMessages}
平均會話長度: ${stats.averageSessionLength.toFixed(1)} 條消息
存儲大小: ${(stats.totalSize / 1024).toFixed(1)} KB
時間範圍: ${stats.oldestSession.toLocaleDateString()} - ${stats.newestSession.toLocaleDateString()}

存儲使用情況:
  會話數據: ${(stats.storageUsage.sessions / 1024).toFixed(1)} KB
  消息數據: ${(stats.storageUsage.messages / 1024).toFixed(1)} KB
  元數據: ${(stats.storageUsage.metadata / 1024).toFixed(1)} KB
  備份文件: ${(stats.storageUsage.backups / 1024).toFixed(1)} KB
    `.trim();
  }
  
  /**
   * 驗證對話數據完整性
   */
  static validateConversationData(session: ConversationSession): boolean {
    // 檢查必需字段
    if (!session.id || !session.type || !session.title) {
      return false;
    }
    
    // 檢查時間戳
    if (!session.startTime || !session.lastActivity) {
      return false;
    }
    
    // 檢查消息格式
    if (!Array.isArray(session.messages)) {
      return false;
    }
    
    for (const message of session.messages) {
      if (!message.id || !message.role || !message.content || !message.timestamp) {
        return false;
      }
    }
    
    return true;
  }
}

// 重新導出 vscode 類型以便使用
import * as vscode from 'vscode';
