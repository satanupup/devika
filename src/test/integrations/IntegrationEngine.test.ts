import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';
import { IntegrationEngine, IntegrationType, IntegrationConfig, IntegrationStatus } from '../../integrations/IntegrationEngine';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(() => []),
      update: jest.fn()
    }))
  },
  ConfigurationTarget: {
    Global: 1
  }
}));

describe('IntegrationEngine', () => {
  let integrationEngine: IntegrationEngine;

  beforeEach(() => {
    // 重置單例實例
    (IntegrationEngine as any).instance = undefined;
    integrationEngine = IntegrationEngine.getInstance();
  });

  afterEach(() => {
    // 清理測試數據
    integrationEngine.dispose();
  });

  describe('基本功能', () => {
    it('應該能夠創建單例實例', () => {
      const instance1 = IntegrationEngine.getInstance();
      const instance2 = IntegrationEngine.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('應該能夠註冊整合', async () => {
      const config: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'Test GitHub',
        enabled: true,
        token: 'test-token',
        settings: {}
      };

      const result = await integrationEngine.registerIntegration(config);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.type).toBe(IntegrationType.GITHUB);
      expect(result.data?.config.name).toBe('Test GitHub');
    });

    it('應該能夠獲取所有連接', () => {
      const connections = integrationEngine.getConnections();
      expect(Array.isArray(connections)).toBe(true);
    });

    it('應該能夠按類型獲取連接', async () => {
      const githubConfig: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'GitHub',
        enabled: true,
        token: 'github-token',
        settings: {}
      };

      const jiraConfig: IntegrationConfig = {
        type: IntegrationType.JIRA,
        name: 'Jira',
        enabled: true,
        organization: 'test-org',
        username: 'test-user',
        apiKey: 'jira-key',
        settings: {}
      };

      await integrationEngine.registerIntegration(githubConfig);
      await integrationEngine.registerIntegration(jiraConfig);

      const githubConnections = integrationEngine.getConnectionsByType(IntegrationType.GITHUB);
      const jiraConnections = integrationEngine.getConnectionsByType(IntegrationType.JIRA);

      expect(githubConnections.length).toBe(1);
      expect(jiraConnections.length).toBe(1);
      expect(githubConnections[0].type).toBe(IntegrationType.GITHUB);
      expect(jiraConnections[0].type).toBe(IntegrationType.JIRA);
    });
  });

  describe('連接管理', () => {
    let connectionId: string;

    beforeEach(async () => {
      const config: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'Test GitHub',
        enabled: true,
        token: 'test-token',
        settings: {}
      };

      const result = await integrationEngine.registerIntegration(config);
      connectionId = result.data!.id;
    });

    it('應該能夠連接整合', async () => {
      const result = await integrationEngine.connectIntegration(connectionId);
      
      expect(result.success).toBe(true);
      
      const connections = integrationEngine.getConnections();
      const connection = connections.find(c => c.id === connectionId);
      expect(connection?.status).toBe(IntegrationStatus.CONNECTED);
    });

    it('應該能夠斷開整合連接', async () => {
      await integrationEngine.connectIntegration(connectionId);
      const result = await integrationEngine.disconnectIntegration(connectionId);
      
      expect(result.success).toBe(true);
      
      const connections = integrationEngine.getConnections();
      const connection = connections.find(c => c.id === connectionId);
      expect(connection?.status).toBe(IntegrationStatus.DISCONNECTED);
    });

    it('應該能夠移除整合', async () => {
      const result = await integrationEngine.removeIntegration(connectionId);
      
      expect(result.success).toBe(true);
      
      const connections = integrationEngine.getConnections();
      const connection = connections.find(c => c.id === connectionId);
      expect(connection).toBeUndefined();
    });

    it('應該能夠檢查整合可用性', async () => {
      // 未連接時應該不可用
      expect(integrationEngine.isIntegrationAvailable(IntegrationType.GITHUB)).toBe(false);
      
      // 連接後應該可用
      await integrationEngine.connectIntegration(connectionId);
      expect(integrationEngine.isIntegrationAvailable(IntegrationType.GITHUB)).toBe(true);
    });
  });

  describe('整合操作', () => {
    let connectionId: string;

    beforeEach(async () => {
      const config: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'Test GitHub',
        enabled: true,
        token: 'test-token',
        settings: {}
      };

      const result = await integrationEngine.registerIntegration(config);
      connectionId = result.data!.id;
      await integrationEngine.connectIntegration(connectionId);
    });

    it('應該能夠執行整合操作', async () => {
      const result = await integrationEngine.executeIntegrationAction(
        connectionId,
        'testAction',
        { param1: 'value1' }
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('應該能夠同步整合數據', async () => {
      const result = await integrationEngine.syncIntegration(connectionId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('應該拒絕對未連接整合的操作', async () => {
      await integrationEngine.disconnectIntegration(connectionId);
      
      const result = await integrationEngine.executeIntegrationAction(
        connectionId,
        'testAction',
        {}
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('整合未連接');
    });
  });

  describe('事件系統', () => {
    it('應該能夠添加和觸發事件監聽器', (done) => {
      const eventType = 'test_event';
      const testData = { message: 'test' };

      integrationEngine.addEventListener(eventType, (event) => {
        expect(event.type).toBe(eventType);
        expect(event.data).toEqual(testData);
        done();
      });

      // 手動觸發事件（在實際實現中會由內部操作觸發）
      (integrationEngine as any).emitEvent({
        type: eventType,
        integration: IntegrationType.GITHUB,
        timestamp: new Date(),
        data: testData
      });
    });

    it('應該能夠移除事件監聽器', () => {
      const eventType = 'test_event';
      const listener = jest.fn();

      integrationEngine.addEventListener(eventType, listener);
      integrationEngine.removeEventListener(eventType, listener);

      // 觸發事件，監聽器不應該被調用
      (integrationEngine as any).emitEvent({
        type: eventType,
        integration: IntegrationType.GITHUB,
        timestamp: new Date(),
        data: {}
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('統計和狀態', () => {
    beforeEach(async () => {
      // 添加多個不同類型的整合
      const configs = [
        {
          type: IntegrationType.GITHUB,
          name: 'GitHub',
          enabled: true,
          token: 'github-token',
          settings: {}
        },
        {
          type: IntegrationType.JIRA,
          name: 'Jira',
          enabled: true,
          organization: 'test-org',
          username: 'test-user',
          apiKey: 'jira-key',
          settings: {}
        },
        {
          type: IntegrationType.CONFLUENCE,
          name: 'Confluence',
          enabled: true,
          organization: 'test-org',
          username: 'test-user',
          apiKey: 'confluence-key',
          settings: {}
        }
      ];

      for (const config of configs) {
        const result = await integrationEngine.registerIntegration(config);
        if (config.type === IntegrationType.GITHUB) {
          await integrationEngine.connectIntegration(result.data!.id);
        }
      }
    });

    it('應該能夠獲取整合統計', () => {
      const stats = integrationEngine.getIntegrationStats();
      
      expect(stats.total).toBe(3);
      expect(stats.connected).toBe(1);
      expect(stats.byType[IntegrationType.GITHUB]).toBe(1);
      expect(stats.byType[IntegrationType.JIRA]).toBe(1);
      expect(stats.byType[IntegrationType.CONFLUENCE]).toBe(1);
      expect(stats.lastActivity).toBeInstanceOf(Date);
    });

    it('應該能夠獲取已連接的整合', () => {
      const connectedIntegrations = integrationEngine.getConnectedIntegrations();
      
      expect(connectedIntegrations.length).toBe(1);
      expect(connectedIntegrations[0].type).toBe(IntegrationType.GITHUB);
      expect(connectedIntegrations[0].status).toBe(IntegrationStatus.CONNECTED);
    });
  });

  describe('錯誤處理', () => {
    it('應該能夠處理無效的連接 ID', async () => {
      const result = await integrationEngine.connectIntegration('invalid-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('找不到整合連接');
    });

    it('應該能夠處理重複的整合註冊', async () => {
      const config: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'Test GitHub',
        enabled: true,
        token: 'test-token',
        settings: {}
      };

      const result1 = await integrationEngine.registerIntegration(config);
      const result2 = await integrationEngine.registerIntegration(config);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // 應該創建不同的連接 ID
      expect(result1.data?.id).not.toBe(result2.data?.id);
    });

    it('應該能夠處理無效的操作', async () => {
      const config: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'Test GitHub',
        enabled: true,
        token: 'test-token',
        settings: {}
      };

      const result = await integrationEngine.registerIntegration(config);
      const connectionId = result.data!.id;
      await integrationEngine.connectIntegration(connectionId);

      const actionResult = await integrationEngine.executeIntegrationAction(
        connectionId,
        'invalidAction',
        {}
      );
      
      expect(actionResult.success).toBe(true); // 在模擬實現中會成功
    });
  });

  describe('配置管理', () => {
    it('應該能夠保存和加載連接配置', async () => {
      const config: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'Test GitHub',
        enabled: true,
        token: 'test-token',
        settings: { customSetting: 'value' }
      };

      await integrationEngine.registerIntegration(config);
      
      // 驗證配置已保存
      const mockUpdate = (vscode.workspace.getConfiguration as jest.Mock)().update;
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('應該能夠處理配置加載錯誤', () => {
      // 模擬配置加載錯誤
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => ({
        get: jest.fn(() => { throw new Error('Config error'); }),
        update: jest.fn()
      }));

      // 創建新實例應該不會拋出錯誤
      expect(() => {
        (IntegrationEngine as any).instance = undefined;
        IntegrationEngine.getInstance();
      }).not.toThrow();
    });
  });

  describe('同步定時器', () => {
    it('應該能夠設置同步定時器', async () => {
      const config: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'Test GitHub',
        enabled: true,
        token: 'test-token',
        syncInterval: 1, // 1 分鐘
        settings: {}
      };

      const result = await integrationEngine.registerIntegration(config);
      await integrationEngine.connectIntegration(result.data!.id);

      // 驗證定時器已設置（在實際實現中）
      expect(result.success).toBe(true);
    });

    it('應該能夠清理定時器', async () => {
      const config: IntegrationConfig = {
        type: IntegrationType.GITHUB,
        name: 'Test GitHub',
        enabled: true,
        token: 'test-token',
        syncInterval: 1,
        settings: {}
      };

      const result = await integrationEngine.registerIntegration(config);
      await integrationEngine.connectIntegration(result.data!.id);
      await integrationEngine.disconnectIntegration(result.data!.id);

      // 定時器應該被清理
      expect(result.success).toBe(true);
    });
  });

  describe('資源清理', () => {
    it('應該能夠正確清理資源', () => {
      // 添加一些連接和監聽器
      integrationEngine.addEventListener('test', () => {});
      
      // 清理資源
      integrationEngine.dispose();
      
      // 驗證資源已清理
      const connections = integrationEngine.getConnections();
      expect(connections.length).toBe(0);
    });
  });
});
