import * as vscode from 'vscode';
import {
  IntegrationEngine,
  IntegrationType,
  IntegrationConfig,
  IntegrationConnection,
  IntegrationResult
} from './IntegrationEngine';
import { GitHubIntegration } from './providers/GitHubIntegration';
import { JiraIntegration } from './providers/JiraIntegration';
import { ConfluenceIntegration } from './providers/ConfluenceIntegration';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 整合提供者介面
 */
export interface IntegrationProvider {
  testConnection(): Promise<IntegrationResult<boolean>>;
  [key: string]: any;
}

/**
 * 整合管理器
 * 統一管理所有第三方工具整合
 */
export class IntegrationManager {
  private static instance: IntegrationManager;
  private integrationEngine: IntegrationEngine;
  private providers: Map<string, IntegrationProvider> = new Map();

  private constructor() {
    this.integrationEngine = IntegrationEngine.getInstance();
    this.setupEventListeners();
  }

  static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  /**
   * 初始化整合管理器
   */
  async initialize(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 加載已保存的連接
        const connections = this.integrationEngine.getConnections();

        // 為每個連接創建提供者實例
        for (const connection of connections) {
          await this.createProvider(connection);
        }

        console.log(`整合管理器已初始化，載入 ${connections.length} 個連接`);
      },
      '初始化整合管理器',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 添加新的整合
   */
  async addIntegration(config: IntegrationConfig): Promise<IntegrationResult<IntegrationConnection>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 註冊整合
        const registerResult = await this.integrationEngine.registerIntegration(config);
        if (!registerResult.success || !registerResult.data) {
          throw new Error('註冊整合失敗');
        }

        const connection = registerResult.data;

        // 創建提供者實例
        await this.createProvider(connection);

        // 嘗試連接
        const connectResult = await this.integrationEngine.connectIntegration(connection.id);
        if (!connectResult.success) {
          console.warn(`連接整合失敗: ${connection.type}`);
        }

        return connection;
      },
      '添加整合',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '添加整合失敗' };
    }
  }

  /**
   * 移除整合
   */
  async removeIntegration(connectionId: string): Promise<IntegrationResult<boolean>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 移除提供者實例
        this.providers.delete(connectionId);

        // 從引擎中移除
        return await this.integrationEngine.removeIntegration(connectionId);
      },
      '移除整合',
      { logError: true, showToUser: false }
    );

    if (opResult.success && opResult.data) {
      return opResult.data;
    } else {
      return { success: false, error: opResult.error?.message || '移除整合失敗' };
    }
  }

  /**
   * 獲取整合提供者
   */
  getProvider<T extends IntegrationProvider>(connectionId: string): T | null {
    return (this.providers.get(connectionId) as T) || null;
  }

  /**
   * 獲取特定類型的提供者
   */
  getProvidersByType<T extends IntegrationProvider>(type: IntegrationType): T[] {
    const connections = this.integrationEngine.getConnectionsByType(type);
    return connections.map(conn => this.getProvider<T>(conn.id)).filter(provider => provider !== null) as T[];
  }

  /**
   * 獲取所有連接
   */
  getConnections(): IntegrationConnection[] {
    return this.integrationEngine.getConnections();
  }

  /**
   * 獲取已連接的整合
   */
  getConnectedIntegrations(): IntegrationConnection[] {
    return this.integrationEngine.getConnectedIntegrations();
  }

  /**
   * 檢查整合是否可用
   */
  isIntegrationAvailable(type: IntegrationType): boolean {
    return this.integrationEngine.isIntegrationAvailable(type);
  }

  /**
   * 執行整合操作
   */
  async executeAction(connectionId: string, action: string, params: any = {}): Promise<IntegrationResult<any>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const provider = this.getProvider(connectionId);
        if (!provider) {
          throw new Error(`找不到整合提供者: ${connectionId}`);
        }

        // 檢查提供者是否有該方法
        if (typeof provider[action] !== 'function') {
          throw new Error(`提供者不支援操作: ${action}`);
        }

        // 執行操作
        const result = await provider[action](...(Array.isArray(params) ? params : [params]));

        // 記錄操作到引擎
        await this.integrationEngine.executeIntegrationAction(connectionId, action, params);

        return result;
      },
      '執行整合操作',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '執行整合操作失敗' };
    }
  }

  /**
   * 同步所有整合
   */
  async syncAllIntegrations(): Promise<IntegrationResult<any[]>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const connectedIntegrations = this.getConnectedIntegrations();
        const syncResults: any[] = [];

        for (const connection of connectedIntegrations) {
          try {
            const result = await this.integrationEngine.syncIntegration(connection.id);
            syncResults.push({
              connectionId: connection.id,
              type: connection.type,
              success: result.success,
              data: result.data,
              error: result.error
            });
          } catch (error) {
            syncResults.push({
              connectionId: connection.id,
              type: connection.type,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        return syncResults;
      },
      '同步所有整合',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '同步所有整合失敗' };
    }
  }

  /**
   * 測試整合連接
   */
  async testIntegration(connectionId: string): Promise<IntegrationResult<boolean>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const provider = this.getProvider(connectionId);
        if (!provider) {
          throw new Error(`找不到整合提供者: ${connectionId}`);
        }

        return await provider.testConnection();
      },
      '測試整合連接',
      { logError: true, showToUser: false }
    );

    if (opResult.success && opResult.data) {
      return opResult.data;
    } else {
      return { success: false, error: opResult.error?.message || '測試整合連接失敗' };
    }
  }

  /**
   * 獲取整合統計
   */
  getIntegrationStats(): {
    total: number;
    connected: number;
    byType: Record<IntegrationType, number>;
    lastActivity: Date | null;
  } {
    return this.integrationEngine.getIntegrationStats();
  }

  /**
   * GitHub 相關便捷方法
   */
  async getGitHubRepositories(connectionId?: string): Promise<IntegrationResult<any[]>> {
    return this.executeGitHubAction(connectionId, 'getRepositories');
  }

  async getGitHubIssues(connectionId: string, owner: string, repo: string): Promise<IntegrationResult<any[]>> {
    return this.executeGitHubAction(connectionId, 'getIssues', [owner, repo]);
  }

  async createGitHubIssue(
    connectionId: string,
    owner: string,
    repo: string,
    title: string,
    body?: string
  ): Promise<IntegrationResult<any>> {
    return this.executeGitHubAction(connectionId, 'createIssue', [owner, repo, title, body]);
  }

  /**
   * Jira 相關便捷方法
   */
  async getJiraProjects(connectionId?: string): Promise<IntegrationResult<any[]>> {
    return this.executeJiraAction(connectionId, 'getProjects');
  }

  async searchJiraIssues(connectionId: string, jql: string): Promise<IntegrationResult<any>> {
    return this.executeJiraAction(connectionId, 'searchIssues', [jql]);
  }

  async createJiraIssue(connectionId: string, issueData: any): Promise<IntegrationResult<any>> {
    return this.executeJiraAction(connectionId, 'createIssue', [issueData]);
  }

  /**
   * Confluence 相關便捷方法
   */
  async getConfluenceSpaces(connectionId?: string): Promise<IntegrationResult<any[]>> {
    return this.executeConfluenceAction(connectionId, 'getSpaces');
  }

  async searchConfluenceContent(connectionId: string, query: string): Promise<IntegrationResult<any>> {
    return this.executeConfluenceAction(connectionId, 'searchContent', [query]);
  }

  async createConfluencePage(connectionId: string, pageData: any): Promise<IntegrationResult<any>> {
    return this.executeConfluenceAction(connectionId, 'createPage', [pageData]);
  }

  /**
   * 私有方法
   */
  private async createProvider(connection: IntegrationConnection): Promise<void> {
    try {
      let provider: IntegrationProvider;

      switch (connection.type) {
        case IntegrationType.GITHUB:
          provider = new GitHubIntegration(connection.config);
          break;
        case IntegrationType.JIRA:
          provider = new JiraIntegration(connection.config);
          break;
        case IntegrationType.CONFLUENCE:
          provider = new ConfluenceIntegration(connection.config);
          break;
        default:
          console.warn(`不支援的整合類型: ${connection.type}`);
          return;
      }

      this.providers.set(connection.id, provider);
    } catch (error) {
      console.error(`創建整合提供者失敗 ${connection.type}:`, error);
    }
  }

  private setupEventListeners(): void {
    this.integrationEngine.addEventListener('integration_connected', event => {
      console.log(`整合已連接: ${event.integration}`);
    });

    this.integrationEngine.addEventListener('integration_disconnected', event => {
      console.log(`整合已斷開: ${event.integration}`);
    });

    this.integrationEngine.addEventListener('integration_error', event => {
      console.error(`整合錯誤: ${event.integration}`, event.data);
    });
  }

  private async executeGitHubAction(
    connectionId: string | undefined,
    action: string,
    params: any[] = []
  ): Promise<IntegrationResult<any>> {
    if (!connectionId) {
      const githubConnections = this.integrationEngine.getConnectionsByType(IntegrationType.GITHUB);
      const connectedGitHub = githubConnections.find(conn => conn.status === 'connected');

      if (!connectedGitHub) {
        return { success: false, error: '沒有可用的 GitHub 連接' };
      }

      connectionId = connectedGitHub.id;
    }

    return this.executeAction(connectionId, action, params);
  }

  private async executeJiraAction(
    connectionId: string | undefined,
    action: string,
    params: any[] = []
  ): Promise<IntegrationResult<any>> {
    if (!connectionId) {
      const jiraConnections = this.integrationEngine.getConnectionsByType(IntegrationType.JIRA);
      const connectedJira = jiraConnections.find(conn => conn.status === 'connected');

      if (!connectedJira) {
        return { success: false, error: '沒有可用的 Jira 連接' };
      }

      connectionId = connectedJira.id;
    }

    return this.executeAction(connectionId, action, params);
  }

  private async executeConfluenceAction(
    connectionId: string | undefined,
    action: string,
    params: any[] = []
  ): Promise<IntegrationResult<any>> {
    if (!connectionId) {
      const confluenceConnections = this.integrationEngine.getConnectionsByType(IntegrationType.CONFLUENCE);
      const connectedConfluence = confluenceConnections.find(conn => conn.status === 'connected');

      if (!connectedConfluence) {
        return { success: false, error: '沒有可用的 Confluence 連接' };
      }

      connectionId = connectedConfluence.id;
    }

    return this.executeAction(connectionId, action, params);
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.providers.clear();
    this.integrationEngine.dispose();
  }
}
