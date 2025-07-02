import * as vscode from 'vscode';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 支援的整合工具類型
 */
export enum IntegrationType {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  JIRA = 'jira',
  CONFLUENCE = 'confluence',
  SLACK = 'slack',
  TEAMS = 'teams',
  TRELLO = 'trello',
  NOTION = 'notion',
  LINEAR = 'linear',
  FIGMA = 'figma'
}

/**
 * 整合狀態
 */
export enum IntegrationStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  EXPIRED = 'expired'
}

/**
 * 整合配置
 */
export interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  token?: string;
  username?: string;
  organization?: string;
  project?: string;
  settings: Record<string, any>;
  lastSync?: Date;
  syncInterval?: number; // 分鐘
}

/**
 * 整合連接信息
 */
export interface IntegrationConnection {
  id: string;
  type: IntegrationType;
  status: IntegrationStatus;
  config: IntegrationConfig;
  lastActivity: Date;
  errorMessage?: string;
  capabilities: string[];
  metadata: Record<string, any>;
}

/**
 * 整合操作結果
 */
export interface IntegrationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 整合事件
 */
export interface IntegrationEvent {
  type: string;
  integration: IntegrationType;
  timestamp: Date;
  data: any;
  source?: string;
}

/**
 * 整合能力
 */
export interface IntegrationCapability {
  name: string;
  description: string;
  methods: string[];
  permissions: string[];
  dependencies?: string[];
}

/**
 * 整合引擎
 * 管理所有第三方工具的整合和連接
 */
export class IntegrationEngine {
  private static instance: IntegrationEngine;
  private connections: Map<string, IntegrationConnection> = new Map();
  private eventListeners: Map<string, ((event: IntegrationEvent) => void)[]> = new Map();
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.loadSavedConnections();
  }

  static getInstance(): IntegrationEngine {
    if (!IntegrationEngine.instance) {
      IntegrationEngine.instance = new IntegrationEngine();
    }
    return IntegrationEngine.instance;
  }

  /**
   * 註冊整合連接
   */
  async registerIntegration(config: IntegrationConfig): Promise<IntegrationResult<IntegrationConnection>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const connectionId = this.generateConnectionId(config.type, config.organization || 'default');
        
        const connection: IntegrationConnection = {
          id: connectionId,
          type: config.type,
          status: IntegrationStatus.DISCONNECTED,
          config,
          lastActivity: new Date(),
          capabilities: this.getIntegrationCapabilities(config.type),
          metadata: {}
        };

        this.connections.set(connectionId, connection);
        await this.saveConnections();

        this.emitEvent({
          type: 'integration_registered',
          integration: config.type,
          timestamp: new Date(),
          data: { connectionId, config }
        });

        return { success: true, data: connection };
      },
      '註冊整合連接',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 連接到整合服務
   */
  async connectIntegration(connectionId: string): Promise<IntegrationResult<boolean>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const connection = this.connections.get(connectionId);
        if (!connection) {
          throw new Error(`找不到整合連接: ${connectionId}`);
        }

        connection.status = IntegrationStatus.CONNECTING;
        this.emitEvent({
          type: 'integration_connecting',
          integration: connection.type,
          timestamp: new Date(),
          data: { connectionId }
        });

        // 根據整合類型執行連接邏輯
        const success = await this.performConnection(connection);
        
        if (success) {
          connection.status = IntegrationStatus.CONNECTED;
          connection.lastActivity = new Date();
          
          // 設置同步定時器
          if (connection.config.syncInterval) {
            this.setupSyncTimer(connection);
          }

          this.emitEvent({
            type: 'integration_connected',
            integration: connection.type,
            timestamp: new Date(),
            data: { connectionId }
          });
        } else {
          connection.status = IntegrationStatus.ERROR;
          connection.errorMessage = '連接失敗';
        }

        await this.saveConnections();
        return { success, data: success };
      },
      '連接整合服務',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 斷開整合連接
   */
  async disconnectIntegration(connectionId: string): Promise<IntegrationResult<boolean>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const connection = this.connections.get(connectionId);
        if (!connection) {
          throw new Error(`找不到整合連接: ${connectionId}`);
        }

        // 清除同步定時器
        const timer = this.syncTimers.get(connectionId);
        if (timer) {
          clearInterval(timer);
          this.syncTimers.delete(connectionId);
        }

        connection.status = IntegrationStatus.DISCONNECTED;
        connection.lastActivity = new Date();
        connection.errorMessage = undefined;

        await this.saveConnections();

        this.emitEvent({
          type: 'integration_disconnected',
          integration: connection.type,
          timestamp: new Date(),
          data: { connectionId }
        });

        return { success: true, data: true };
      },
      '斷開整合連接',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 移除整合連接
   */
  async removeIntegration(connectionId: string): Promise<IntegrationResult<boolean>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        await this.disconnectIntegration(connectionId);
        
        const connection = this.connections.get(connectionId);
        if (connection) {
          this.connections.delete(connectionId);
          await this.saveConnections();

          this.emitEvent({
            type: 'integration_removed',
            integration: connection.type,
            timestamp: new Date(),
            data: { connectionId }
          });
        }

        return { success: true, data: true };
      },
      '移除整合連接',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取所有整合連接
   */
  getConnections(): IntegrationConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 獲取特定類型的連接
   */
  getConnectionsByType(type: IntegrationType): IntegrationConnection[] {
    return this.getConnections().filter(conn => conn.type === type);
  }

  /**
   * 獲取已連接的整合
   */
  getConnectedIntegrations(): IntegrationConnection[] {
    return this.getConnections().filter(conn => conn.status === IntegrationStatus.CONNECTED);
  }

  /**
   * 檢查整合是否可用
   */
  isIntegrationAvailable(type: IntegrationType): boolean {
    const connections = this.getConnectionsByType(type);
    return connections.some(conn => conn.status === IntegrationStatus.CONNECTED);
  }

  /**
   * 執行整合操作
   */
  async executeIntegrationAction(
    connectionId: string,
    action: string,
    params: any = {}
  ): Promise<IntegrationResult<any>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const connection = this.connections.get(connectionId);
        if (!connection) {
          throw new Error(`找不到整合連接: ${connectionId}`);
        }

        if (connection.status !== IntegrationStatus.CONNECTED) {
          throw new Error(`整合未連接: ${connection.type}`);
        }

        // 根據整合類型和操作執行相應的邏輯
        const result = await this.performAction(connection, action, params);
        
        connection.lastActivity = new Date();
        await this.saveConnections();

        this.emitEvent({
          type: 'integration_action_executed',
          integration: connection.type,
          timestamp: new Date(),
          data: { connectionId, action, params, result }
        });

        return { success: true, data: result };
      },
      '執行整合操作',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 同步整合數據
   */
  async syncIntegration(connectionId: string): Promise<IntegrationResult<any>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const connection = this.connections.get(connectionId);
        if (!connection) {
          throw new Error(`找不到整合連接: ${connectionId}`);
        }

        if (connection.status !== IntegrationStatus.CONNECTED) {
          throw new Error(`整合未連接: ${connection.type}`);
        }

        const syncResult = await this.performSync(connection);
        
        connection.config.lastSync = new Date();
        connection.lastActivity = new Date();
        await this.saveConnections();

        this.emitEvent({
          type: 'integration_synced',
          integration: connection.type,
          timestamp: new Date(),
          data: { connectionId, syncResult }
        });

        return { success: true, data: syncResult };
      },
      '同步整合數據',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 添加事件監聽器
   */
  addEventListener(eventType: string, listener: (event: IntegrationEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * 移除事件監聽器
   */
  removeEventListener(eventType: string, listener: (event: IntegrationEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
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
    const connections = this.getConnections();
    const connected = connections.filter(c => c.status === IntegrationStatus.CONNECTED);
    
    const byType = connections.reduce((acc, conn) => {
      acc[conn.type] = (acc[conn.type] || 0) + 1;
      return acc;
    }, {} as Record<IntegrationType, number>);

    const lastActivity = connections.length > 0 
      ? new Date(Math.max(...connections.map(c => c.lastActivity.getTime())))
      : null;

    return {
      total: connections.length,
      connected: connected.length,
      byType,
      lastActivity
    };
  }

  /**
   * 私有方法
   */
  private async loadSavedConnections(): Promise<void> {
    try {
      // 從 VS Code 設置或存儲中加載連接
      const config = vscode.workspace.getConfiguration('devika.integrations');
      const savedConnections = config.get<any[]>('connections', []);
      
      for (const connData of savedConnections) {
        this.connections.set(connData.id, connData);
      }
    } catch (error) {
      console.warn('加載整合連接失敗:', error);
    }
  }

  private async saveConnections(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('devika.integrations');
      const connections = Array.from(this.connections.values());
      await config.update('connections', connections, vscode.ConfigurationTarget.Global);
    } catch (error) {
      console.warn('保存整合連接失敗:', error);
    }
  }

  private generateConnectionId(type: IntegrationType, organization: string): string {
    return `${type}-${organization}-${Date.now()}`;
  }

  private getIntegrationCapabilities(type: IntegrationType): string[] {
    const capabilities: Record<IntegrationType, string[]> = {
      [IntegrationType.GITHUB]: ['repositories', 'issues', 'pull_requests', 'commits', 'releases'],
      [IntegrationType.GITLAB]: ['projects', 'issues', 'merge_requests', 'pipelines'],
      [IntegrationType.JIRA]: ['projects', 'issues', 'sprints', 'boards'],
      [IntegrationType.CONFLUENCE]: ['spaces', 'pages', 'search'],
      [IntegrationType.SLACK]: ['channels', 'messages', 'users'],
      [IntegrationType.TEAMS]: ['channels', 'messages', 'meetings'],
      [IntegrationType.TRELLO]: ['boards', 'lists', 'cards'],
      [IntegrationType.NOTION]: ['databases', 'pages', 'blocks'],
      [IntegrationType.LINEAR]: ['teams', 'issues', 'projects'],
      [IntegrationType.FIGMA]: ['files', 'projects', 'comments']
    };
    return capabilities[type] || [];
  }

  private async performConnection(connection: IntegrationConnection): Promise<boolean> {
    // 這裡會根據不同的整合類型實現具體的連接邏輯
    // 暫時返回 true 作為示例
    return true;
  }

  private async performAction(connection: IntegrationConnection, action: string, params: any): Promise<any> {
    // 這裡會根據不同的整合類型和操作實現具體的邏輯
    return { action, params, timestamp: new Date() };
  }

  private async performSync(connection: IntegrationConnection): Promise<any> {
    // 這裡會根據不同的整合類型實現具體的同步邏輯
    return { synced: true, timestamp: new Date() };
  }

  private setupSyncTimer(connection: IntegrationConnection): void {
    if (!connection.config.syncInterval) return;

    const timer = setInterval(async () => {
      try {
        await this.syncIntegration(connection.id);
      } catch (error) {
        console.error(`同步整合失敗 ${connection.id}:`, error);
      }
    }, connection.config.syncInterval * 60 * 1000);

    this.syncTimers.set(connection.id, timer);
  }

  private emitEvent(event: IntegrationEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('整合事件監聽器錯誤:', error);
      }
    });
  }

  /**
   * 清理資源
   */
  dispose(): void {
    // 清除所有定時器
    this.syncTimers.forEach(timer => clearInterval(timer));
    this.syncTimers.clear();
    
    // 清除事件監聽器
    this.eventListeners.clear();
  }
}
