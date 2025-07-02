/**
 * 下一步編輯導航系統模組
 * 
 * 此模組實現了 Devika VS Code Extension 的智能編輯導航功能，
 * 提供逐步編輯指導、自動化編輯執行和進度追蹤。
 */

import * as vscode from 'vscode';

// 核心編輯導航引擎
export {
  EditNavigationEngine,
  EditStep,
  EditStepType,
  EditStepStatus,
  EditStepPriority,
  EditPlan,
  EditNavigationConfig,
  EditNavigationEvent
} from './EditNavigationEngine';

// 編輯步驟生成器
export {
  EditStepGenerator,
  EditTaskType,
  EditContext
} from './EditStepGenerator';

// 編輯導航提供者
export {
  EditNavigationProvider
} from './EditNavigationProvider';

// 編輯導航命令提供者
export {
  EditNavigationCommandProvider
} from './EditNavigationCommandProvider';

/**
 * 初始化下一步編輯導航系統
 * 
 * @param context VS Code 擴展上下文
 * @returns Promise<void>
 */
export async function initializeEditNavigationSystem(context: vscode.ExtensionContext): Promise<void> {
  try {
    // 創建編輯導航提供者
    const navigationProvider = new EditNavigationProvider();
    
    // 註冊樹視圖
    const treeView = vscode.window.createTreeView('devika.editNavigation', {
      treeDataProvider: navigationProvider,
      showCollapseAll: true,
      canSelectMany: false
    });
    
    // 創建命令提供者
    const commandProvider = new EditNavigationCommandProvider(navigationProvider);
    
    // 註冊命令
    commandProvider.registerCommands(context);
    
    // 設置清理回調
    context.subscriptions.push(
      treeView,
      navigationProvider,
      {
        dispose: () => {
          EditNavigationEngine.getInstance().dispose();
        }
      }
    );
    
    console.log('下一步編輯導航系統初始化完成');
  } catch (error) {
    console.error('下一步編輯導航系統初始化失敗:', error);
    throw error;
  }
}

/**
 * 編輯導航系統配置
 */
export interface EditNavigationSystemConfig {
  /** 是否啟用編輯導航 */
  enabled: boolean;
  
  /** 是否自動前進到下一步 */
  autoAdvance: boolean;
  
  /** 是否顯示預覽 */
  showPreview: boolean;
  
  /** 執行前是否確認 */
  confirmBeforeExecute: boolean;
  
  /** 是否跳過可選步驟 */
  skipOptionalSteps: boolean;
  
  /** 最大重試次數 */
  maxRetries: number;
  
  /** 超時時間（秒） */
  timeoutSeconds: number;
  
  /** 是否啟用驗證 */
  enableValidation: boolean;
  
  /** 是否顯示預估時間 */
  showEstimatedTime: boolean;
  
  /** 是否啟用智能建議 */
  enableSmartSuggestions: boolean;
  
  /** 是否自動保存進度 */
  autoSaveProgress: boolean;
}

/**
 * 默認編輯導航配置
 */
export const DEFAULT_EDIT_NAVIGATION_CONFIG: EditNavigationSystemConfig = {
  enabled: true,
  autoAdvance: true,
  showPreview: true,
  confirmBeforeExecute: true,
  skipOptionalSteps: false,
  maxRetries: 3,
  timeoutSeconds: 30,
  enableValidation: true,
  showEstimatedTime: true,
  enableSmartSuggestions: true,
  autoSaveProgress: true
};

/**
 * 編輯導航系統狀態
 */
export interface EditNavigationSystemStatus {
  /** 是否已初始化 */
  initialized: boolean;
  
  /** 是否啟用 */
  enabled: boolean;
  
  /** 是否有活躍計劃 */
  hasActivePlan: boolean;
  
  /** 當前計劃標題 */
  currentPlanTitle?: string;
  
  /** 當前步驟索引 */
  currentStepIndex: number;
  
  /** 總步驟數 */
  totalSteps: number;
  
  /** 已完成步驟數 */
  completedSteps: number;
  
  /** 進度百分比 */
  progressPercentage: number;
  
  /** 預估剩餘時間（分鐘） */
  estimatedTimeRemaining: number;
  
  /** 執行狀態 */
  executionStatus: 'planning' | 'executing' | 'completed' | 'cancelled' | 'paused';
  
  /** 最後活動時間 */
  lastActivity: Date | null;
  
  /** 錯誤信息 */
  errors: string[];
}

/**
 * 獲取編輯導航系統狀態
 */
export function getEditNavigationSystemStatus(): EditNavigationSystemStatus {
  try {
    const navigationEngine = EditNavigationEngine.getInstance();
    const activePlan = navigationEngine.getActivePlan();
    const progress = navigationEngine.getProgress();
    
    return {
      initialized: true,
      enabled: true, // 從配置獲取
      hasActivePlan: activePlan !== null,
      currentPlanTitle: activePlan?.title,
      currentStepIndex: progress.currentStep,
      totalSteps: progress.totalSteps,
      completedSteps: progress.completedSteps,
      progressPercentage: progress.percentage,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
      executionStatus: activePlan?.status || 'planning',
      lastActivity: activePlan?.updatedAt || null,
      errors: []
    };
  } catch (error) {
    return {
      initialized: false,
      enabled: false,
      hasActivePlan: false,
      currentStepIndex: 0,
      totalSteps: 0,
      completedSteps: 0,
      progressPercentage: 0,
      estimatedTimeRemaining: 0,
      executionStatus: 'planning',
      lastActivity: null,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * 編輯導航事件類型
 */
export enum EditNavigationEventType {
  PLAN_CREATED = 'plan_created',
  PLAN_STARTED = 'plan_started',
  PLAN_COMPLETED = 'plan_completed',
  PLAN_CANCELLED = 'plan_cancelled',
  STEP_STARTED = 'step_started',
  STEP_COMPLETED = 'step_completed',
  STEP_FAILED = 'step_failed',
  STEP_SKIPPED = 'step_skipped',
  PROGRESS_UPDATED = 'progress_updated'
}

/**
 * 編輯導航事件監聽器
 */
export type EditNavigationEventListener = (event: EditNavigationEvent) => void;

/**
 * 編輯導航工具函數
 */
export class EditNavigationUtils {
  /**
   * 格式化步驟狀態
   */
  static formatStepStatus(status: EditStepStatus): string {
    const statusMap = {
      [EditStepStatus.PENDING]: '⏸️ 待執行',
      [EditStepStatus.IN_PROGRESS]: '🔄 執行中',
      [EditStepStatus.COMPLETED]: '✅ 已完成',
      [EditStepStatus.SKIPPED]: '⏭️ 已跳過',
      [EditStepStatus.FAILED]: '❌ 失敗'
    };
    return statusMap[status] || '❓ 未知';
  }
  
  /**
   * 格式化步驟類型
   */
  static formatStepType(type: EditStepType): string {
    const typeMap = {
      [EditStepType.CREATE_FILE]: '📄 創建文件',
      [EditStepType.MODIFY_FILE]: '✏️ 修改文件',
      [EditStepType.DELETE_FILE]: '🗑️ 刪除文件',
      [EditStepType.RENAME_FILE]: '📝 重命名文件',
      [EditStepType.ADD_IMPORT]: '📥 添加導入',
      [EditStepType.REMOVE_IMPORT]: '📤 移除導入',
      [EditStepType.ADD_FUNCTION]: '⚡ 添加函數',
      [EditStepType.MODIFY_FUNCTION]: '🔧 修改函數',
      [EditStepType.DELETE_FUNCTION]: '❌ 刪除函數',
      [EditStepType.ADD_CLASS]: '🏗️ 添加類',
      [EditStepType.MODIFY_CLASS]: '🔨 修改類',
      [EditStepType.DELETE_CLASS]: '💥 刪除類',
      [EditStepType.ADD_VARIABLE]: '📊 添加變數',
      [EditStepType.MODIFY_VARIABLE]: '📈 修改變數',
      [EditStepType.DELETE_VARIABLE]: '📉 刪除變數',
      [EditStepType.REFACTOR]: '🔄 重構',
      [EditStepType.FIX_ERROR]: '🐛 修復錯誤',
      [EditStepType.ADD_TEST]: '🧪 添加測試',
      [EditStepType.UPDATE_CONFIG]: '⚙️ 更新配置'
    };
    return typeMap[type] || '❓ 未知類型';
  }
  
  /**
   * 格式化優先級
   */
  static formatPriority(priority: EditStepPriority): string {
    const priorityMap = {
      [EditStepPriority.LOW]: '🟢 低',
      [EditStepPriority.MEDIUM]: '🟡 中',
      [EditStepPriority.HIGH]: '🟠 高',
      [EditStepPriority.CRITICAL]: '🔴 緊急'
    };
    return priorityMap[priority] || '❓ 未知';
  }
  
  /**
   * 計算預估完成時間
   */
  static calculateEstimatedCompletion(steps: EditStep[], currentIndex: number): Date {
    const remainingSteps = steps.slice(currentIndex);
    const totalMinutes = remainingSteps.reduce((sum, step) => sum + step.estimatedTime, 0);
    
    const now = new Date();
    return new Date(now.getTime() + totalMinutes * 60 * 1000);
  }
  
  /**
   * 生成進度報告
   */
  static generateProgressReport(plan: EditPlan, progress: any): string {
    const completionTime = this.calculateEstimatedCompletion(plan.steps, plan.currentStepIndex);
    
    return `
編輯導航進度報告
================
計劃: ${plan.title}
創建時間: ${plan.createdAt.toLocaleString()}
當前狀態: ${plan.status}

進度統計:
- 總步驟: ${progress.totalSteps}
- 已完成: ${progress.completedSteps}
- 當前步驟: ${progress.currentStep}
- 完成度: ${progress.percentage.toFixed(1)}%

時間估算:
- 總預估時間: ${plan.totalEstimatedTime} 分鐘
- 剩餘時間: ${progress.estimatedTimeRemaining} 分鐘
- 預計完成: ${completionTime.toLocaleString()}

最後更新: ${plan.updatedAt.toLocaleString()}
    `.trim();
  }
  
  /**
   * 驗證編輯計劃
   */
  static validateEditPlan(plan: EditPlan): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // 檢查基本信息
    if (!plan.title || plan.title.trim().length === 0) {
      issues.push('計劃標題不能為空');
    }
    
    if (!plan.steps || plan.steps.length === 0) {
      issues.push('計劃必須包含至少一個步驟');
    }
    
    // 檢查步驟
    plan.steps.forEach((step, index) => {
      if (!step.title || step.title.trim().length === 0) {
        issues.push(`步驟 ${index + 1} 標題不能為空`);
      }
      
      if (!step.targetFile) {
        issues.push(`步驟 ${index + 1} 必須指定目標文件`);
      }
      
      if (step.estimatedTime <= 0) {
        issues.push(`步驟 ${index + 1} 預估時間必須大於 0`);
      }
    });
    
    // 檢查依賴關係
    plan.steps.forEach((step, index) => {
      step.dependencies.forEach(depId => {
        const depExists = plan.steps.some(s => s.id === depId);
        if (!depExists) {
          issues.push(`步驟 ${index + 1} 依賴的步驟 ${depId} 不存在`);
        }
      });
    });
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * 優化編輯計劃
   */
  static optimizeEditPlan(plan: EditPlan): EditPlan {
    // 創建計劃副本
    const optimizedPlan = { ...plan };
    
    // 按依賴關係和優先級重新排序步驟
    optimizedPlan.steps = this.sortStepsByDependencies(plan.steps);
    
    // 重新計算總預估時間
    optimizedPlan.totalEstimatedTime = optimizedPlan.steps.reduce(
      (sum, step) => sum + step.estimatedTime, 
      0
    );
    
    // 更新時間戳
    optimizedPlan.updatedAt = new Date();
    
    return optimizedPlan;
  }
  
  /**
   * 按依賴關係排序步驟
   */
  private static sortStepsByDependencies(steps: EditStep[]): EditStep[] {
    const sorted: EditStep[] = [];
    const remaining = [...steps];
    
    while (remaining.length > 0) {
      const canExecute = remaining.filter(step => 
        step.dependencies.every(depId => 
          sorted.some(s => s.id === depId)
        )
      );
      
      if (canExecute.length === 0) {
        // 如果沒有可執行的步驟，說明有循環依賴，直接添加剩餘步驟
        sorted.push(...remaining);
        break;
      }
      
      // 按優先級排序可執行的步驟
      canExecute.sort((a, b) => {
        const priorityOrder = {
          [EditStepPriority.CRITICAL]: 4,
          [EditStepPriority.HIGH]: 3,
          [EditStepPriority.MEDIUM]: 2,
          [EditStepPriority.LOW]: 1
        };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      // 添加第一個可執行的步驟
      const nextStep = canExecute[0];
      sorted.push(nextStep);
      remaining.splice(remaining.indexOf(nextStep), 1);
    }
    
    return sorted;
  }
  
  /**
   * 生成步驟摘要
   */
  static generateStepSummary(step: EditStep): string {
    return `
步驟摘要: ${step.title}
===================
類型: ${this.formatStepType(step.type)}
狀態: ${this.formatStepStatus(step.status)}
優先級: ${this.formatPriority(step.priority)}
預估時間: ${step.estimatedTime} 分鐘
目標文件: ${step.targetFile.fsPath}

描述:
${step.description}

執行指令:
${step.instructions}

${step.codeChanges ? `
代碼變更:
${step.codeChanges.after}
` : ''}

創建時間: ${step.metadata.createdAt.toLocaleString()}
更新時間: ${step.metadata.updatedAt.toLocaleString()}
嘗試次數: ${step.metadata.attempts}
${step.metadata.lastError ? `最後錯誤: ${step.metadata.lastError}` : ''}
    `.trim();
  }
}
