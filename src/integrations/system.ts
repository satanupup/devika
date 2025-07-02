import * as vscode from 'vscode';
import { IntegrationCommandProvider } from './IntegrationCommandProvider';
import { IntegrationType } from './IntegrationEngine';
import { IntegrationManager } from './IntegrationManager';

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
