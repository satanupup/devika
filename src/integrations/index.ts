/**
 * 原生工具整合系統模組
 * 
 * 此模組實現了 Devika VS Code Extension 與第三方工具的整合功能，
 * 包括 GitHub、Jira、Confluence、Slack 等常用開發工具的整合。
 */

// 核心整合引擎
export {
  IntegrationEngine,
  IntegrationType,
  IntegrationStatus,
  IntegrationConfig,
  IntegrationConnection,
  IntegrationResult,
  IntegrationEvent,
  IntegrationCapability
} from './IntegrationEngine';

// 整合管理器
export {
  IntegrationManager,
  IntegrationProvider
} from './IntegrationManager';

// 整合命令提供者
export {
  IntegrationCommandProvider
} from './IntegrationCommandProvider';

// 整合提供者
export {
  GitHubIntegration,
  GitHubRepository,
  GitHubIssue,
  GitHubPullRequest,
  GitHubUser,
  GitHubLabel,
  GitHubMilestone,
  GitHubCommit
} from './providers/GitHubIntegration';

export {
  JiraIntegration,
  JiraProject,
  JiraIssue,
  JiraUser,
  JiraIssueType,
  JiraStatus,
  JiraPriority,
  JiraComponent,
  JiraVersion,
  JiraSprint,
  JiraBoard
} from './providers/JiraIntegration';

export {
  ConfluenceIntegration,
  ConfluenceSpace,
  ConfluencePage,
  ConfluenceUser,
  ConfluenceContent,
  ConfluenceSearchResult
} from './providers/ConfluenceIntegration';

/**
 * 初始化原生工具整合系統
 * 
 * @param context VS Code 擴展上下文
 * @returns Promise<void>
 */
export async function initializeIntegrationSystem(context: vscode.ExtensionContext): Promise<void> {
  try {
    // 初始化整合管理器
    const integrationManager = IntegrationManager.getInstance();
    await integrationManager.initialize();
    
    // 註冊命令
    const commandProvider = new IntegrationCommandProvider();
    commandProvider.registerCommands(context);
    
    // 設置清理回調
    context.subscriptions.push({
      dispose: () => {
        integrationManager.dispose();
      }
    });
    
    console.log('原生工具整合系統初始化完成');
  } catch (error) {
    console.error('原生工具整合系統初始化失敗:', error);
    throw error;
  }
}

/**
 * 整合系統配置
 */
export interface IntegrationSystemConfig {
  /** 是否啟用整合系統 */
  enabled: boolean;
  
  /** 啟用的整合類型 */
  enabledIntegrations: IntegrationType[];
  
  /** 自動同步間隔（分鐘） */
  autoSyncInterval: number;
  
  /** 是否啟用自動同步 */
  autoSyncEnabled: boolean;
  
  /** 連接超時時間（秒） */
  connectionTimeout: number;
  
  /** 最大重試次數 */
  maxRetries: number;
  
  /** 是否啟用通知 */
  notificationsEnabled: boolean;
  
  /** 是否啟用快取 */
  cacheEnabled: boolean;
  
  /** 快取過期時間（分鐘） */
  cacheExpiration: number;
}

/**
 * 默認整合系統配置
 */
export const DEFAULT_INTEGRATION_CONFIG: IntegrationSystemConfig = {
  enabled: true,
  enabledIntegrations: [
    IntegrationType.GITHUB,
    IntegrationType.JIRA,
    IntegrationType.CONFLUENCE
  ],
  autoSyncInterval: 30,
  autoSyncEnabled: true,
  connectionTimeout: 30,
  maxRetries: 3,
  notificationsEnabled: true,
  cacheEnabled: true,
  cacheExpiration: 15
};

/**
 * 整合系統狀態
 */
export interface IntegrationSystemStatus {
  /** 是否已初始化 */
  initialized: boolean;
  
  /** 是否啟用 */
  enabled: boolean;
  
  /** 總整合數 */
  totalIntegrations: number;
  
  /** 已連接的整合數 */
  connectedIntegrations: number;
  
  /** 按類型分組的整合數 */
  integrationsByType: Record<IntegrationType, number>;
  
  /** 最後同步時間 */
  lastSyncTime: Date | null;
  
  /** 最後活動時間 */
  lastActivity: Date | null;
  
  /** 錯誤信息 */
  errors: string[];
}

/**
 * 獲取整合系統狀態
 */
export function getIntegrationSystemStatus(): IntegrationSystemStatus {
  try {
    const integrationManager = IntegrationManager.getInstance();
    const stats = integrationManager.getIntegrationStats();
    
    return {
      initialized: true,
      enabled: true, // 從配置獲取
      totalIntegrations: stats.total,
      connectedIntegrations: stats.connected,
      integrationsByType: stats.byType,
      lastSyncTime: null, // 需要從管理器獲取
      lastActivity: stats.lastActivity,
      errors: []
    };
  } catch (error) {
    return {
      initialized: false,
      enabled: false,
      totalIntegrations: 0,
      connectedIntegrations: 0,
      integrationsByType: {} as Record<IntegrationType, number>,
      lastSyncTime: null,
      lastActivity: null,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * 整合事件類型
 */
export enum IntegrationEventType {
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_LOST = 'connection_lost',
  DATA_SYNCED = 'data_synced',
  ACTION_EXECUTED = 'action_executed',
  ERROR_OCCURRED = 'error_occurred',
  CONFIG_CHANGED = 'config_changed'
}

/**
 * 整合事件監聽器
 */
export type IntegrationEventListener = (event: IntegrationEvent) => void;

/**
 * 整合事件管理器
 */
class IntegrationEventManager {
  private listeners: Map<IntegrationEventType, IntegrationEventListener[]> = new Map();
  
  /**
   * 添加事件監聽器
   */
  addEventListener(type: IntegrationEventType, listener: IntegrationEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }
  
  /**
   * 移除事件監聽器
   */
  removeEventListener(type: IntegrationEventType, listener: IntegrationEventListener): void {
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
  dispatchEvent(event: IntegrationEvent): void {
    const listeners = this.listeners.get(event.type as IntegrationEventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('整合事件監聽器錯誤:', error);
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
 * 全局整合事件管理器實例
 */
export const integrationEventManager = new IntegrationEventManager();

/**
 * 整合工具函數
 */
export class IntegrationUtils {
  /**
   * 驗證整合配置
   */
  static validateIntegrationConfig(config: IntegrationConfig): boolean {
    // 檢查必需字段
    if (!config.type || !config.name) {
      return false;
    }
    
    // 根據類型檢查特定字段
    switch (config.type) {
      case IntegrationType.GITHUB:
        return !!(config.token || (config.username && config.apiKey));
      case IntegrationType.JIRA:
      case IntegrationType.CONFLUENCE:
        return !!(config.organization && config.username && config.apiKey);
      default:
        return true;
    }
  }
  
  /**
   * 格式化整合狀態
   */
  static formatIntegrationStatus(status: IntegrationStatus): string {
    const statusMap = {
      [IntegrationStatus.CONNECTED]: '✅ 已連接',
      [IntegrationStatus.DISCONNECTED]: '❌ 未連接',
      [IntegrationStatus.CONNECTING]: '🔄 連接中',
      [IntegrationStatus.ERROR]: '⚠️ 錯誤',
      [IntegrationStatus.EXPIRED]: '⏰ 已過期'
    };
    return statusMap[status] || '❓ 未知';
  }
  
  /**
   * 獲取整合圖標
   */
  static getIntegrationIcon(type: IntegrationType): string {
    const icons = {
      [IntegrationType.GITHUB]: '🐙',
      [IntegrationType.GITLAB]: '🦊',
      [IntegrationType.JIRA]: '📋',
      [IntegrationType.CONFLUENCE]: '📚',
      [IntegrationType.SLACK]: '💬',
      [IntegrationType.TEAMS]: '👥',
      [IntegrationType.TRELLO]: '📌',
      [IntegrationType.NOTION]: '📝',
      [IntegrationType.LINEAR]: '📐',
      [IntegrationType.FIGMA]: '🎨'
    };
    return icons[type] || '🔗';
  }
  
  /**
   * 生成整合統計報告
   */
  static generateIntegrationReport(connections: IntegrationConnection[]): string {
    const total = connections.length;
    const connected = connections.filter(c => c.status === IntegrationStatus.CONNECTED).length;
    const byType = connections.reduce((acc, conn) => {
      acc[conn.type] = (acc[conn.type] || 0) + 1;
      return acc;
    }, {} as Record<IntegrationType, number>);
    
    const typeStats = Object.entries(byType)
      .map(([type, count]) => `  ${IntegrationUtils.getIntegrationIcon(type as IntegrationType)} ${type}: ${count}`)
      .join('\n');
    
    return `
整合系統報告
===========
總整合數: ${total}
已連接: ${connected}
連接率: ${total > 0 ? Math.round((connected / total) * 100) : 0}%

按類型分布:
${typeStats}

最後更新: ${new Date().toLocaleString()}
    `.trim();
  }
  
  /**
   * 檢查整合健康狀態
   */
  static checkIntegrationHealth(connection: IntegrationConnection): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 檢查連接狀態
    if (connection.status !== IntegrationStatus.CONNECTED) {
      issues.push(`整合未連接: ${connection.status}`);
      recommendations.push('檢查認證信息並重新連接');
    }
    
    // 檢查最後活動時間
    const lastActivity = new Date(connection.lastActivity);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceActivity > 7) {
      issues.push('長時間無活動');
      recommendations.push('考慮同步或測試連接');
    }
    
    // 檢查錯誤信息
    if (connection.errorMessage) {
      issues.push(`錯誤: ${connection.errorMessage}`);
      recommendations.push('查看錯誤詳情並修復問題');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    };
  }
  
  /**
   * 清理過期的整合數據
   */
  static cleanupExpiredIntegrations(connections: IntegrationConnection[], maxAge: number = 90): IntegrationConnection[] {
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    
    return connections.filter(connection => {
      const lastActivity = new Date(connection.lastActivity);
      return lastActivity > cutoffDate || connection.status === IntegrationStatus.CONNECTED;
    });
  }
}

// 重新導出 vscode 類型以便使用
import * as vscode from 'vscode';
