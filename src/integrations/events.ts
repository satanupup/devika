import { IntegrationEvent } from './IntegrationEngine';

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
