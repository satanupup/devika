import * as vscode from 'vscode';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 編輯步驟類型
 */
export enum EditStepType {
  CREATE_FILE = 'create_file',
  MODIFY_FILE = 'modify_file',
  DELETE_FILE = 'delete_file',
  RENAME_FILE = 'rename_file',
  ADD_IMPORT = 'add_import',
  REMOVE_IMPORT = 'remove_import',
  ADD_FUNCTION = 'add_function',
  MODIFY_FUNCTION = 'modify_function',
  DELETE_FUNCTION = 'delete_function',
  ADD_CLASS = 'add_class',
  MODIFY_CLASS = 'modify_class',
  DELETE_CLASS = 'delete_class',
  ADD_VARIABLE = 'add_variable',
  MODIFY_VARIABLE = 'modify_variable',
  DELETE_VARIABLE = 'delete_variable',
  REFACTOR = 'refactor',
  FIX_ERROR = 'fix_error',
  ADD_TEST = 'add_test',
  UPDATE_CONFIG = 'update_config'
}

/**
 * 編輯步驟狀態
 */
export enum EditStepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed'
}

/**
 * 編輯步驟優先級
 */
export enum EditStepPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 編輯步驟
 */
export interface EditStep {
  id: string;
  type: EditStepType;
  title: string;
  description: string;
  priority: EditStepPriority;
  status: EditStepStatus;
  targetFile: vscode.Uri;
  targetRange?: vscode.Range;
  dependencies: string[];
  estimatedTime: number; // 分鐘
  instructions: string;
  codeChanges?: {
    before?: string;
    after: string;
    insertPosition?: vscode.Position;
    replaceRange?: vscode.Range;
  };
  validation?: {
    rules: string[];
    expectedOutcome: string;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    attempts: number;
    lastError?: string;
  };
}

/**
 * 編輯計劃
 */
export interface EditPlan {
  id: string;
  title: string;
  description: string;
  steps: EditStep[];
  totalEstimatedTime: number;
  currentStepIndex: number;
  status: 'planning' | 'executing' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  context: {
    workspaceFolder: vscode.Uri;
    language: string;
    framework?: string;
    relatedFiles: vscode.Uri[];
    userGoal: string;
  };
}

/**
 * 編輯導航配置
 */
export interface EditNavigationConfig {
  autoAdvance: boolean;
  showPreview: boolean;
  confirmBeforeExecute: boolean;
  skipOptionalSteps: boolean;
  maxRetries: number;
  timeoutSeconds: number;
  enableValidation: boolean;
  showEstimatedTime: boolean;
}

/**
 * 編輯導航引擎
 * 管理逐步編輯導航和執行
 */
export class EditNavigationEngine {
  private static instance: EditNavigationEngine;
  private activePlan: EditPlan | null = null;
  private config!: EditNavigationConfig;
  private stepHistory: EditStep[] = [];
  private eventEmitter = new vscode.EventEmitter<EditNavigationEvent>();

  private constructor() {
    this.loadConfiguration();
  }

  static getInstance(): EditNavigationEngine {
    if (!EditNavigationEngine.instance) {
      EditNavigationEngine.instance = new EditNavigationEngine();
    }
    return EditNavigationEngine.instance;
  }

  /**
   * 創建編輯計劃
   */
  async createEditPlan(
    title: string,
    description: string,
    userGoal: string,
    context: Partial<EditPlan['context']>
  ): Promise<EditPlan> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const workspaceFolder =
          context.workspaceFolder || vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file('');

        const plan: EditPlan = {
          id: this.generatePlanId(),
          title,
          description,
          steps: [],
          totalEstimatedTime: 0,
          currentStepIndex: 0,
          status: 'planning',
          createdAt: new Date(),
          updatedAt: new Date(),
          context: {
            workspaceFolder,
            language: context.language || 'typescript',
            framework: context.framework,
            relatedFiles: context.relatedFiles || [],
            userGoal
          }
        };

        this.activePlan = plan;
        this.emitEvent({
          type: 'plan_created',
          plan,
          timestamp: new Date()
        });

        return plan;
      },
      '創建編輯計劃',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : this.createEmptyPlan()));
  }

  /**
   * 添加編輯步驟
   */
  async addEditStep(step: Omit<EditStep, 'id' | 'metadata'>): Promise<EditStep> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!this.activePlan) {
          throw new Error('沒有活躍的編輯計劃');
        }

        const fullStep: EditStep = {
          ...step,
          id: this.generateStepId(),
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            attempts: 0
          }
        };

        this.activePlan.steps.push(fullStep);
        this.activePlan.totalEstimatedTime += step.estimatedTime;
        this.activePlan.updatedAt = new Date();

        this.emitEvent({
          type: 'step_added',
          plan: this.activePlan,
          step: fullStep,
          timestamp: new Date()
        });

        return fullStep;
      },
      '添加編輯步驟',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : this.createEmptyStep()));
  }

  /**
   * 開始執行計劃
   */
  async startExecution(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!this.activePlan) {
          throw new Error('沒有活躍的編輯計劃');
        }

        if (this.activePlan.steps.length === 0) {
          throw new Error('編輯計劃沒有步驟');
        }

        this.activePlan.status = 'executing';
        this.activePlan.currentStepIndex = 0;
        this.activePlan.updatedAt = new Date();

        this.emitEvent({
          type: 'execution_started',
          plan: this.activePlan,
          timestamp: new Date()
        });

        await this.executeCurrentStep();
      },
      '開始執行編輯計劃',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 執行當前步驟
   */
  async executeCurrentStep(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!this.activePlan) {
          throw new Error('沒有活躍的編輯計劃');
        }

        const currentStep = this.getCurrentStep();
        if (!currentStep) {
          await this.completePlan();
          return;
        }

        currentStep.status = EditStepStatus.IN_PROGRESS;
        currentStep.metadata.updatedAt = new Date();
        currentStep.metadata.attempts++;

        this.emitEvent({
          type: 'step_started',
          plan: this.activePlan,
          step: currentStep,
          timestamp: new Date()
        });

        try {
          await this.performStepAction(currentStep);

          if (await this.validateStep(currentStep)) {
            currentStep.status = EditStepStatus.COMPLETED;
            currentStep.metadata.completedAt = new Date();
            this.stepHistory.push(currentStep);

            this.emitEvent({
              type: 'step_completed',
              plan: this.activePlan,
              step: currentStep,
              timestamp: new Date()
            });

            if (this.config.autoAdvance) {
              await this.nextStep();
            }
          } else {
            throw new Error('步驟驗證失敗');
          }
        } catch (error) {
          currentStep.status = EditStepStatus.FAILED;
          currentStep.metadata.lastError = error instanceof Error ? error.message : String(error);

          this.emitEvent({
            type: 'step_failed',
            plan: this.activePlan,
            step: currentStep,
            error: currentStep.metadata.lastError,
            timestamp: new Date()
          });

          if (currentStep.metadata.attempts < this.config.maxRetries) {
            // 重試
            await this.retryCurrentStep();
          } else {
            // 跳過或停止
            await this.handleStepFailure(currentStep);
          }
        }
      },
      '執行當前步驟',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 下一步
   */
  async nextStep(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!this.activePlan) {
          throw new Error('沒有活躍的編輯計劃');
        }

        this.activePlan.currentStepIndex++;
        this.activePlan.updatedAt = new Date();

        if (this.activePlan.currentStepIndex >= this.activePlan.steps.length) {
          await this.completePlan();
        } else {
          this.emitEvent({
            type: 'step_advanced',
            plan: this.activePlan,
            timestamp: new Date()
          });

          if (this.activePlan.status === 'executing') {
            await this.executeCurrentStep();
          }
        }
      },
      '前進到下一步',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 上一步
   */
  async previousStep(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!this.activePlan) {
          throw new Error('沒有活躍的編輯計劃');
        }

        if (this.activePlan.currentStepIndex > 0) {
          this.activePlan.currentStepIndex--;
          this.activePlan.updatedAt = new Date();

          // 重置當前步驟狀態
          const currentStep = this.getCurrentStep();
          if (currentStep) {
            currentStep.status = EditStepStatus.PENDING;
            currentStep.metadata.updatedAt = new Date();
          }

          this.emitEvent({
            type: 'step_reverted',
            plan: this.activePlan,
            timestamp: new Date()
          });
        }
      },
      '回到上一步',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 跳過當前步驟
   */
  async skipCurrentStep(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const currentStep = this.getCurrentStep();
        if (currentStep) {
          currentStep.status = EditStepStatus.SKIPPED;
          currentStep.metadata.updatedAt = new Date();

          this.emitEvent({
            type: 'step_skipped',
            plan: this.activePlan!,
            step: currentStep,
            timestamp: new Date()
          });

          await this.nextStep();
        }
      },
      '跳過當前步驟',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 獲取當前步驟
   */
  getCurrentStep(): EditStep | null {
    if (!this.activePlan) return null;
    return this.activePlan.steps[this.activePlan.currentStepIndex] || null;
  }

  /**
   * 獲取活躍計劃
   */
  getActivePlan(): EditPlan | null {
    return this.activePlan;
  }

  /**
   * 獲取步驟歷史
   */
  getStepHistory(): EditStep[] {
    return [...this.stepHistory];
  }

  /**
   * 獲取進度信息
   */
  getProgress(): {
    currentStep: number;
    totalSteps: number;
    completedSteps: number;
    percentage: number;
    estimatedTimeRemaining: number;
  } {
    if (!this.activePlan) {
      return {
        currentStep: 0,
        totalSteps: 0,
        completedSteps: 0,
        percentage: 0,
        estimatedTimeRemaining: 0
      };
    }

    const completedSteps = this.activePlan.steps.filter(s => s.status === EditStepStatus.COMPLETED).length;
    const remainingSteps = this.activePlan.steps.slice(this.activePlan.currentStepIndex);
    const estimatedTimeRemaining = remainingSteps.reduce((sum, step) => sum + step.estimatedTime, 0);

    return {
      currentStep: this.activePlan.currentStepIndex + 1,
      totalSteps: this.activePlan.steps.length,
      completedSteps,
      percentage: this.activePlan.steps.length > 0 ? (completedSteps / this.activePlan.steps.length) * 100 : 0,
      estimatedTimeRemaining
    };
  }

  /**
   * 事件監聽
   */
  onEvent(listener: (event: EditNavigationEvent) => void): vscode.Disposable {
    return this.eventEmitter.event(listener);
  }

  /**
   * 私有方法
   */
  private async performStepAction(step: EditStep): Promise<void> {
    switch (step.type) {
      case EditStepType.CREATE_FILE:
        await this.createFile(step);
        break;
      case EditStepType.MODIFY_FILE:
        await this.modifyFile(step);
        break;
      case EditStepType.DELETE_FILE:
        await this.deleteFile(step);
        break;
      case EditStepType.RENAME_FILE:
        await this.renameFile(step);
        break;
      case EditStepType.ADD_IMPORT:
        await this.addImport(step);
        break;
      case EditStepType.REMOVE_IMPORT:
        await this.removeImport(step);
        break;
      case EditStepType.ADD_FUNCTION:
        await this.addFunction(step);
        break;
      case EditStepType.MODIFY_FUNCTION:
        await this.modifyFunction(step);
        break;
      case EditStepType.REFACTOR:
        await this.performRefactor(step);
        break;
      default:
        throw new Error(`不支援的步驟類型: ${step.type}`);
    }
  }

  private async validateStep(step: EditStep): Promise<boolean> {
    if (!this.config.enableValidation || !step.validation) {
      return true;
    }

    // 簡化的驗證邏輯
    try {
      // 檢查文件是否存在
      if (step.type === EditStepType.CREATE_FILE) {
        const stat = await vscode.workspace.fs.stat(step.targetFile);
        return stat.type === vscode.FileType.File;
      }

      // 檢查文件內容
      if (step.codeChanges?.after) {
        const document = await vscode.workspace.openTextDocument(step.targetFile);
        const content = document.getText();
        return content.includes(step.codeChanges.after);
      }

      return true;
    } catch {
      return false;
    }
  }

  private async createFile(step: EditStep): Promise<void> {
    const content = step.codeChanges?.after || '';
    await vscode.workspace.fs.writeFile(step.targetFile, Buffer.from(content, 'utf8'));
  }

  private async modifyFile(step: EditStep): Promise<void> {
    if (!step.codeChanges) return;

    const document = await vscode.workspace.openTextDocument(step.targetFile);
    const edit = new vscode.WorkspaceEdit();

    if (step.codeChanges.replaceRange) {
      edit.replace(step.targetFile, step.codeChanges.replaceRange, step.codeChanges.after);
    } else if (step.codeChanges.insertPosition) {
      edit.insert(step.targetFile, step.codeChanges.insertPosition, step.codeChanges.after);
    } else {
      // 替換整個文件
      const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
      edit.replace(step.targetFile, fullRange, step.codeChanges.after);
    }

    await vscode.workspace.applyEdit(edit);
  }

  private async deleteFile(step: EditStep): Promise<void> {
    await vscode.workspace.fs.delete(step.targetFile);
  }

  private async renameFile(step: EditStep): Promise<void> {
    // 需要從 step 中獲取新文件名
    // 這裡簡化實現
    console.log(`重命名文件: ${step.targetFile.fsPath}`);
  }

  private async addImport(step: EditStep): Promise<void> {
    // 添加 import 語句的邏輯
    await this.modifyFile(step);
  }

  private async removeImport(step: EditStep): Promise<void> {
    // 移除 import 語句的邏輯
    await this.modifyFile(step);
  }

  private async addFunction(step: EditStep): Promise<void> {
    // 添加函數的邏輯
    await this.modifyFile(step);
  }

  private async modifyFunction(step: EditStep): Promise<void> {
    // 修改函數的邏輯
    await this.modifyFile(step);
  }

  private async performRefactor(step: EditStep): Promise<void> {
    // 重構的邏輯
    await this.modifyFile(step);
  }

  private async retryCurrentStep(): Promise<void> {
    // 等待一段時間後重試
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.executeCurrentStep();
  }

  private async handleStepFailure(step: EditStep): Promise<void> {
    // 處理步驟失敗
    const choice = await vscode.window.showErrorMessage(
      `步驟 "${step.title}" 執行失敗: ${step.metadata.lastError}`,
      '跳過',
      '重試',
      '停止'
    );

    switch (choice) {
      case '跳過':
        await this.skipCurrentStep();
        break;
      case '重試':
        step.metadata.attempts = 0;
        await this.executeCurrentStep();
        break;
      case '停止':
        this.activePlan!.status = 'cancelled';
        break;
    }
  }

  private async completePlan(): Promise<void> {
    if (!this.activePlan) return;

    this.activePlan.status = 'completed';
    this.activePlan.completedAt = new Date();
    this.activePlan.updatedAt = new Date();

    this.emitEvent({
      type: 'plan_completed',
      plan: this.activePlan,
      timestamp: new Date()
    });
  }

  private emitEvent(event: EditNavigationEvent): void {
    this.eventEmitter.fire(event);
  }

  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('devika.editNavigation');
    this.config = {
      autoAdvance: config.get('autoAdvance', true),
      showPreview: config.get('showPreview', true),
      confirmBeforeExecute: config.get('confirmBeforeExecute', true),
      skipOptionalSteps: config.get('skipOptionalSteps', false),
      maxRetries: config.get('maxRetries', 3),
      timeoutSeconds: config.get('timeoutSeconds', 30),
      enableValidation: config.get('enableValidation', true),
      showEstimatedTime: config.get('showEstimatedTime', true)
    };
  }

  private generatePlanId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStepId(): string {
    return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEmptyPlan(): EditPlan {
    return {
      id: 'empty',
      title: 'Empty Plan',
      description: '',
      steps: [],
      totalEstimatedTime: 0,
      currentStepIndex: 0,
      status: 'planning',
      createdAt: new Date(),
      updatedAt: new Date(),
      context: {
        workspaceFolder: vscode.Uri.file(''),
        language: 'typescript',
        relatedFiles: [],
        userGoal: ''
      }
    };
  }

  private createEmptyStep(): EditStep {
    return {
      id: 'empty',
      type: EditStepType.MODIFY_FILE,
      title: 'Empty Step',
      description: '',
      priority: EditStepPriority.MEDIUM,
      status: EditStepStatus.PENDING,
      targetFile: vscode.Uri.file(''),
      dependencies: [],
      estimatedTime: 0,
      instructions: '',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0
      }
    };
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.eventEmitter.dispose();
  }
}

/**
 * 編輯導航事件
 */
export interface EditNavigationEvent {
  type:
    | 'plan_created'
    | 'plan_completed'
    | 'execution_started'
    | 'step_added'
    | 'step_started'
    | 'step_completed'
    | 'step_failed'
    | 'step_skipped'
    | 'step_advanced'
    | 'step_reverted';
  plan: EditPlan;
  step?: EditStep;
  error?: string;
  timestamp: Date;
}
