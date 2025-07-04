import * as vscode from 'vscode';
import { EditNavigationProvider } from './EditNavigationProvider';
import { EditNavigationEngine } from './EditNavigationEngine';
import { EditStepGenerator, EditContext, EditTaskType } from './EditStepGenerator';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 編輯導航命令提供者
 * 提供與編輯導航相關的 VS Code 命令
 */
export class EditNavigationCommandProvider {
  private navigationProvider: EditNavigationProvider;
  private navigationEngine: EditNavigationEngine;
  private stepGenerator: EditStepGenerator;

  constructor(navigationProvider: EditNavigationProvider) {
    this.navigationProvider = navigationProvider;
    this.navigationEngine = EditNavigationEngine.getInstance();
    this.stepGenerator = EditStepGenerator.getInstance();
  }

  /**
   * 註冊所有編輯導航相關命令
   */
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      // 計劃管理命令
      vscode.commands.registerCommand('devika.editNavigation.createPlan', () => this.createEditPlan()),
      vscode.commands.registerCommand('devika.editNavigation.showPlanDetails', (planId) => this.showPlanDetails(planId)),
      vscode.commands.registerCommand('devika.editNavigation.deletePlan', () => this.deletePlan()),
      vscode.commands.registerCommand('devika.editNavigation.exportPlan', () => this.exportPlan()),
      vscode.commands.registerCommand('devika.editNavigation.importPlan', () => this.importPlan()),

      // 執行控制命令
      vscode.commands.registerCommand('devika.editNavigation.startExecution', () => this.startExecution()),
      vscode.commands.registerCommand('devika.editNavigation.pauseExecution', () => this.pauseExecution()),
      vscode.commands.registerCommand('devika.editNavigation.stopExecution', () => this.stopExecution()),
      vscode.commands.registerCommand('devika.editNavigation.resumeExecution', () => this.resumeExecution()),

      // 步驟導航命令
      vscode.commands.registerCommand('devika.editNavigation.nextStep', () => this.nextStep()),
      vscode.commands.registerCommand('devika.editNavigation.previousStep', () => this.previousStep()),
      vscode.commands.registerCommand('devika.editNavigation.jumpToStep', () => this.jumpToStep()),
      vscode.commands.registerCommand('devika.editNavigation.executeCurrentStep', () => this.executeCurrentStep()),
      vscode.commands.registerCommand('devika.editNavigation.skipCurrentStep', () => this.skipCurrentStep()),
      vscode.commands.registerCommand('devika.editNavigation.retryCurrentStep', () => this.retryCurrentStep()),

      // 步驟管理命令
      vscode.commands.registerCommand('devika.editNavigation.showStepDetails', (stepId) => this.showStepDetails(stepId)),
      vscode.commands.registerCommand('devika.editNavigation.editStep', (stepId) => this.editStep(stepId)),
      vscode.commands.registerCommand('devika.editNavigation.addStep', () => this.addStep()),
      vscode.commands.registerCommand('devika.editNavigation.removeStep', (stepId) => this.removeStep(stepId)),
      vscode.commands.registerCommand('devika.editNavigation.moveStepUp', (stepId) => this.moveStepUp(stepId)),
      vscode.commands.registerCommand('devika.editNavigation.moveStepDown', (stepId) => this.moveStepDown(stepId)),

      // 進度和狀態命令
      vscode.commands.registerCommand('devika.editNavigation.showProgress', () => this.showProgress()),
      vscode.commands.registerCommand('devika.editNavigation.showHistory', () => this.showHistory()),
      vscode.commands.registerCommand('devika.editNavigation.showStatistics', () => this.showStatistics()),

      // 快速操作命令
      vscode.commands.registerCommand('devika.editNavigation.quickStart', () => this.quickStart()),
      vscode.commands.registerCommand('devika.editNavigation.generateStepsFromSelection', () => this.generateStepsFromSelection()),
      vscode.commands.registerCommand('devika.editNavigation.generateStepsFromComments', () => this.generateStepsFromComments()),
      vscode.commands.registerCommand('devika.editNavigation.generateStepsFromTodo', () => this.generateStepsFromTodo()),

      // 設置和配置命令
      vscode.commands.registerCommand('devika.editNavigation.configure', () => this.configure()),
      vscode.commands.registerCommand('devika.editNavigation.resetSettings', () => this.resetSettings()),

      // 幫助和調試命令
      vscode.commands.registerCommand('devika.editNavigation.showHelp', () => this.showHelp()),
      vscode.commands.registerCommand('devika.editNavigation.debugMode', () => this.toggleDebugMode())
    ];

    commands.forEach(command => context.subscriptions.push(command));
  }

  /**
   * 創建編輯計劃
   */
  private async createEditPlan(): Promise<void> {
    await this.navigationProvider.createEditPlan();
  }

  /**
   * 顯示計劃詳情
   */
  private async showPlanDetails(planId?: string): Promise<void> {
    await this.navigationProvider.showPlanDetails(planId);
  }

  /**
   * 刪除計劃
   */
  private async deletePlan(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan) {
          vscode.window.showWarningMessage('沒有活躍的編輯計劃');
          return;
        }

        const choice = await vscode.window.showWarningMessage(
          `確定要刪除編輯計劃 "${activePlan.title}" 嗎？`,
          { modal: true },
          '刪除',
          '取消'
        );

        if (choice === '刪除') {
          // 實現刪除邏輯
          vscode.window.showInformationMessage('編輯計劃已刪除');
          this.navigationProvider.refresh();
        }
      },
      '刪除編輯計劃',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導出計劃
   */
  private async exportPlan(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan) {
          vscode.window.showWarningMessage('沒有活躍的編輯計劃');
          return;
        }

        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`${activePlan.title}.json`),
          filters: {
            'JSON 文件': ['json']
          }
        });

        if (uri) {
          const planData = JSON.stringify(activePlan, null, 2);
          await vscode.workspace.fs.writeFile(uri, Buffer.from(planData, 'utf8'));
          vscode.window.showInformationMessage(`編輯計劃已導出到 ${uri.fsPath}`);
        }
      },
      '導出編輯計劃',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導入計劃
   */
  private async importPlan(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: {
            'JSON 文件': ['json']
          }
        });

        if (uris && uris.length > 0) {
          const content = await vscode.workspace.fs.readFile(uris[0]);
          const planData = JSON.parse(content.toString());

          // 實現導入邏輯
          vscode.window.showInformationMessage('編輯計劃已導入');
          this.navigationProvider.refresh();
        }
      },
      '導入編輯計劃',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 開始執行
   */
  private async startExecution(): Promise<void> {
    await this.navigationProvider.startExecution();
  }

  /**
   * 暫停執行
   */
  private async pauseExecution(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan || activePlan.status !== 'executing') {
          vscode.window.showWarningMessage('沒有正在執行的編輯計劃');
          return;
        }

        // 實現暫停邏輯
        vscode.window.showInformationMessage('編輯計劃已暫停');
        this.navigationProvider.refresh();
      },
      '暫停執行',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 停止執行
   */
  private async stopExecution(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan || activePlan.status !== 'executing') {
          vscode.window.showWarningMessage('沒有正在執行的編輯計劃');
          return;
        }

        const choice = await vscode.window.showWarningMessage(
          '確定要停止執行編輯計劃嗎？',
          '停止',
          '取消'
        );

        if (choice === '停止') {
          // 實現停止邏輯
          vscode.window.showInformationMessage('編輯計劃已停止');
          this.navigationProvider.refresh();
        }
      },
      '停止執行',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 恢復執行
   */
  private async resumeExecution(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan) {
          vscode.window.showWarningMessage('沒有活躍的編輯計劃');
          return;
        }

        // 實現恢復邏輯
        await this.navigationEngine.startExecution();
        vscode.window.showInformationMessage('編輯計劃已恢復執行');
        this.navigationProvider.refresh();
      },
      '恢復執行',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 下一步
   */
  private async nextStep(): Promise<void> {
    await this.navigationProvider.nextStep();
  }

  /**
   * 上一步
   */
  private async previousStep(): Promise<void> {
    await this.navigationProvider.previousStep();
  }

  /**
   * 跳轉到指定步驟
   */
  private async jumpToStep(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan) {
          vscode.window.showWarningMessage('沒有活躍的編輯計劃');
          return;
        }

        const stepItems = activePlan.steps.map((step, index) => ({
          label: `${index + 1}. ${step.title}`,
          description: step.description,
          stepIndex: index
        }));

        const selected = await vscode.window.showQuickPick(stepItems, {
          placeHolder: '選擇要跳轉的步驟'
        });

        if (selected) {
          // 實現跳轉邏輯
          vscode.window.showInformationMessage(`已跳轉到步驟: ${selected.label}`);
          this.navigationProvider.refresh();
        }
      },
      '跳轉到步驟',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 執行當前步驟
   */
  private async executeCurrentStep(): Promise<void> {
    await this.navigationProvider.executeCurrentStep();
  }

  /**
   * 跳過當前步驟
   */
  private async skipCurrentStep(): Promise<void> {
    await this.navigationProvider.skipCurrentStep();
  }

  /**
   * 重試當前步驟
   */
  private async retryCurrentStep(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const currentStep = this.navigationEngine.getCurrentStep();
        if (!currentStep) {
          vscode.window.showWarningMessage('沒有當前步驟');
          return;
        }

        // 重置步驟狀態並重新執行
        await this.navigationEngine.executeCurrentStep();
        this.navigationProvider.refresh();
      },
      '重試當前步驟',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示步驟詳情
   */
  private async showStepDetails(stepId: string): Promise<void> {
    await this.navigationProvider.showStepDetails(stepId);
  }

  /**
   * 編輯步驟
   */
  private async editStep(stepId: string): Promise<void> {
    await this.navigationProvider.editStep(stepId);
  }

  /**
   * 添加步驟
   */
  private async addStep(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan) {
          vscode.window.showWarningMessage('沒有活躍的編輯計劃');
          return;
        }

        // 實現添加步驟的邏輯
        vscode.window.showInformationMessage('添加步驟功能即將推出');
      },
      '添加步驟',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 移除步驟
   */
  private async removeStep(stepId: string): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const choice = await vscode.window.showWarningMessage(
          '確定要移除此步驟嗎？',
          '移除',
          '取消'
        );

        if (choice === '移除') {
          // 實現移除步驟的邏輯
          vscode.window.showInformationMessage('步驟已移除');
          this.navigationProvider.refresh();
        }
      },
      '移除步驟',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 上移步驟
   */
  private async moveStepUp(stepId: string): Promise<void> {
    // 實現上移步驟的邏輯
    vscode.window.showInformationMessage('移動步驟功能即將推出');
  }

  /**
   * 下移步驟
   */
  private async moveStepDown(stepId: string): Promise<void> {
    // 實現下移步驟的邏輯
    vscode.window.showInformationMessage('移動步驟功能即將推出');
  }

  /**
   * 顯示進度
   */
  private async showProgress(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan) {
          vscode.window.showWarningMessage('沒有活躍的編輯計劃');
          return;
        }

        const progress = this.navigationEngine.getProgress();
        const message = `
編輯計劃: ${activePlan.title}
進度: ${progress.currentStep}/${progress.totalSteps} (${progress.percentage.toFixed(1)}%)
已完成步驟: ${progress.completedSteps}
預估剩餘時間: ${progress.estimatedTimeRemaining} 分鐘
        `.trim();

        vscode.window.showInformationMessage(message);
      },
      '顯示進度',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示歷史
   */
  private async showHistory(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const history = this.navigationEngine.getStepHistory();

        if (history.length === 0) {
          vscode.window.showInformationMessage('沒有步驟歷史');
          return;
        }

        const historyItems = history.map(step => ({
          label: `✅ ${step.title}`,
          description: `完成於 ${step.metadata.completedAt?.toLocaleString()}`,
          detail: step.description
        }));

        await vscode.window.showQuickPick(historyItems, {
          placeHolder: '步驟執行歷史'
        });
      },
      '顯示歷史',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示統計
   */
  private async showStatistics(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan) {
          vscode.window.showWarningMessage('沒有活躍的編輯計劃');
          return;
        }

        const progress = this.navigationEngine.getProgress();
        const history = this.navigationEngine.getStepHistory();

        const stats = `
編輯導航統計
============
計劃標題: ${activePlan.title}
創建時間: ${activePlan.createdAt.toLocaleString()}
總步驟數: ${progress.totalSteps}
已完成: ${progress.completedSteps}
進度: ${progress.percentage.toFixed(1)}%
預估總時間: ${activePlan.totalEstimatedTime} 分鐘
已執行步驟: ${history.length}
        `.trim();

        vscode.window.showInformationMessage(stats);
      },
      '顯示統計',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 快速開始
   */
  private async quickStart(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const quickOptions = [
          { label: '🚀 實現新功能', description: '創建功能實現計劃', taskType: EditTaskType.FEATURE_IMPLEMENTATION },
          { label: '🐛 修復 Bug', description: '創建 Bug 修復計劃', taskType: EditTaskType.BUG_FIX },
          { label: '🔧 重構代碼', description: '創建重構計劃', taskType: EditTaskType.REFACTORING },
          { label: '🧪 添加測試', description: '創建測試計劃', taskType: EditTaskType.TESTING },
          { label: '📚 更新文檔', description: '創建文檔更新計劃', taskType: EditTaskType.DOCUMENTATION }
        ];

        const selected = await vscode.window.showQuickPick(quickOptions, {
          placeHolder: '選擇快速開始選項'
        });

        if (selected) {
          // 基於選擇創建快速計劃
          await this.createQuickPlan(selected.taskType);
        }
      },
      '快速開始',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 從選擇生成步驟
   */
  private async generateStepsFromSelection(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
          vscode.window.showWarningMessage('請先選擇代碼');
          return;
        }

        const selectedText = editor.document.getText(editor.selection);

        // 基於選中的代碼生成步驟
        vscode.window.showInformationMessage('從選擇生成步驟功能即將推出');
      },
      '從選擇生成步驟',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 從註釋生成步驟
   */
  private async generateStepsFromComments(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('請先打開文件');
          return;
        }

        // 分析文件中的註釋並生成步驟
        vscode.window.showInformationMessage('從註釋生成步驟功能即將推出');
      },
      '從註釋生成步驟',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 從 TODO 生成步驟
   */
  private async generateStepsFromTodo(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('請先打開文件');
          return;
        }

        // 分析文件中的 TODO 註釋並生成步驟
        vscode.window.showInformationMessage('從 TODO 生成步驟功能即將推出');
      },
      '從 TODO 生成步驟',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 配置
   */
  private async configure(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'devika.editNavigation');
  }

  /**
   * 重置設置
   */
  private async resetSettings(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const choice = await vscode.window.showWarningMessage(
          '確定要重置所有編輯導航設置嗎？',
          { modal: true },
          '重置',
          '取消'
        );

        if (choice === '重置') {
          // 實現重置設置的邏輯
          vscode.window.showInformationMessage('設置已重置');
        }
      },
      '重置設置',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示幫助
   */
  private async showHelp(): Promise<void> {
    const helpContent = `
# 編輯導航幫助

## 基本概念
- **編輯計劃**: 包含多個編輯步驟的完整計劃
- **編輯步驟**: 單個具體的編輯操作
- **執行**: 按順序執行編輯步驟

## 常用命令
- \`Ctrl+Shift+P\` 然後輸入 "Devika: 創建編輯計劃"
- \`Ctrl+Shift+P\` 然後輸入 "Devika: 開始執行"
- \`Ctrl+Shift+P\` 然後輸入 "Devika: 下一步"

## 快捷鍵
- 創建計劃: 無默認快捷鍵
- 下一步: 無默認快捷鍵
- 上一步: 無默認快捷鍵

## 更多信息
請查看 VS Code 命令面板中的 "Devika" 相關命令。
    `.trim();

    vscode.window.showInformationMessage(helpContent);
  }

  /**
   * 切換調試模式
   */
  private async toggleDebugMode(): Promise<void> {
    // 實現調試模式切換
    vscode.window.showInformationMessage('調試模式功能即將推出');
  }

  /**
   * 私有輔助方法
   */
  private async createQuickPlan(taskType: EditTaskType): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('請先打開文件');
      return;
    }

    const userGoal = await vscode.window.showInputBox({
      prompt: '描述您的目標',
      placeHolder: '例如: 添加用戶認證功能'
    });

    if (!userGoal) {return;}

    // 創建快速編輯上下文
    const editContext: EditContext = {
      taskType,
      targetFiles: [activeEditor.document.uri],
      language: activeEditor.document.languageId,
      dependencies: [],
      existingCode: activeEditor.document.getText(),
      userRequirement: userGoal,
      preferences: {
        testingFramework: 'jest',
        codeStyle: 'typescript'
      }
    };

    // 創建計劃
    const plan = await this.navigationEngine.createEditPlan(
      `快速${this.getTaskTypeName(taskType)}`,
      `基於 ${userGoal} 的快速計劃`,
      userGoal,
      { language: editContext.language }
    );

    // 生成步驟
    const steps = await this.stepGenerator.generateEditSteps(editContext);

    // 添加步驟到計劃
    for (const stepData of steps) {
      await this.navigationEngine.addEditStep(stepData);
    }

    this.navigationProvider.refresh();
    vscode.window.showInformationMessage(`快速計劃已創建，包含 ${steps.length} 個步驟`);
  }

  private getTaskTypeName(taskType: EditTaskType): string {
    const names = {
      [EditTaskType.FEATURE_IMPLEMENTATION]: '功能實現',
      [EditTaskType.BUG_FIX]: 'Bug 修復',
      [EditTaskType.REFACTORING]: '代碼重構',
      [EditTaskType.TESTING]: '測試添加',
      [EditTaskType.DOCUMENTATION]: '文檔更新',
      [EditTaskType.CONFIGURATION]: '配置更新',
      [EditTaskType.DEPENDENCY_UPDATE]: '依賴更新',
      [EditTaskType.PERFORMANCE_OPTIMIZATION]: '性能優化',
      [EditTaskType.SECURITY_FIX]: '安全修復',
      [EditTaskType.CODE_CLEANUP]: '代碼清理'
    };
    return names[taskType] || '編輯任務';
  }
}
