import { IntegrationConnection, IntegrationStatus, IntegrationType } from './IntegrationEngine';

/**
 * 整合工具函數
 */
export class IntegrationUtils {
  /**
   * 驗證整合配置
   */
  static validateIntegrationConfig(config: any): boolean {
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
    const icons: Record<IntegrationType, string> = {
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
    const byType = connections.reduce((acc: Record<IntegrationType, number>, conn: IntegrationConnection) => {
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
