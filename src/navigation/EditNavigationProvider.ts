import * as vscode from 'vscode';
import { EditNavigationEngine, EditPlan, EditStep, EditStepStatus } from './EditNavigationEngine';
import { EditStepGenerator, EditContext, EditTaskType } from './EditStepGenerator';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 編輯導航提供者
 * 提供編輯導航的用戶界面和交互功能
 */
export class EditNavigationProvider implements vscode.TreeDataProvider<EditNavigationItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<EditNavigationItem | undefined | null | void> =
    new vscode.EventEmitter<EditNavigationItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<EditNavigationItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private navigationEngine: EditNavigationEngine;
  private stepGenerator: EditStepGenerator;
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.navigationEngine = EditNavigationEngine.getInstance();
    this.stepGenerator = EditStepGenerator.getInstance();
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

    this.setupEventListeners();
    this.updateStatusBar();
  }

  /**
   * TreeDataProvider 實現
   */
  getTreeItem(element: EditNavigationItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: EditNavigationItem): Thenable<EditNavigationItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    return Promise.resolve([]);
  }

  private async getRootItems(): Promise<EditNavigationItem[]> {
    const activePlan = this.navigationEngine.getActivePlan();
    if (!activePlan) {
      return [new EditNavigationItem('沒有活躍的編輯計劃', vscode.TreeItemCollapsibleState.None, 'no-plan')];
    }

    const items: EditNavigationItem[] = [];

    // 計劃信息
    items.push(
      new EditNavigationItem(`📋 ${activePlan.title}`, vscode.TreeItemCollapsibleState.None, 'plan-info', {
        command: 'devika.editNavigation.showPlanDetails',
        title: '顯示計劃詳情',
        arguments: [activePlan.id]
      })
    );

    // 進度信息
    const progress = this.navigationEngine.getProgress();
    items.push(
      new EditNavigationItem(
        `📊 進度: ${progress.currentStep}/${progress.totalSteps} (${progress.percentage.toFixed(1)}%)`,
        vscode.TreeItemCollapsibleState.None,
        'progress'
      )
    );

    // 當前步驟
    const currentStep = this.navigationEngine.getCurrentStep();
    if (currentStep) {
      items.push(
        new EditNavigationItem(`▶️ 當前: ${currentStep.title}`, vscode.TreeItemCollapsibleState.None, 'current-step', {
          command: 'devika.editNavigation.showStepDetails',
          title: '顯示步驟詳情',
          arguments: [currentStep.id]
        })
      );
    }

    // 步驟列表
    for (let i = 0; i < activePlan.steps.length; i++) {
      const step = activePlan.steps[i];
      const isCurrent = i === activePlan.currentStepIndex;
      const icon = this.getStepIcon(step.status, isCurrent);
      const label = `${icon} ${step.title}`;

      const item = new EditNavigationItem(label, vscode.TreeItemCollapsibleState.None, `step-${step.status}`, {
        command: 'devika.editNavigation.showStepDetails',
        title: '顯示步驟詳情',
        arguments: [step.id]
      });

      item.tooltip = `${step.description}\n狀態: ${step.status}\n預估時間: ${step.estimatedTime} 分鐘`;

      items.push(item);
    }

    return items;
  }

  /**
   * 刷新樹視圖
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * 創建新的編輯計劃
   */
  async createEditPlan(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 獲取用戶輸入
        const title = await vscode.window.showInputBox({
          prompt: '輸入編輯計劃標題',
          placeHolder: '例如: 實現用戶登錄功能'
        });

        if (!title) return;

        const description = await vscode.window.showInputBox({
          prompt: '輸入編輯計劃描述（可選）',
          placeHolder: '詳細描述編輯目標和需求'
        });

        const userGoal = await vscode.window.showInputBox({
          prompt: '描述您想要實現的目標',
          placeHolder: '例如: 創建一個安全的用戶認證系統'
        });

        if (!userGoal) return;

        // 選擇任務類型
        const taskTypeItems = [
          { label: '🚀 功能實現', description: '實現新功能', value: EditTaskType.FEATURE_IMPLEMENTATION },
          { label: '🐛 Bug 修復', description: '修復現有問題', value: EditTaskType.BUG_FIX },
          { label: '🔧 代碼重構', description: '改進代碼結構', value: EditTaskType.REFACTORING },
          { label: '🧪 添加測試', description: '創建或改進測試', value: EditTaskType.TESTING },
          { label: '📚 更新文檔', description: '改進文檔', value: EditTaskType.DOCUMENTATION }
        ];

        const selectedTaskType = await vscode.window.showQuickPick(taskTypeItems, {
          placeHolder: '選擇編輯任務類型'
        });

        if (!selectedTaskType) return;

        // 檢測當前上下文
        const activeEditor = vscode.window.activeTextEditor;
        const targetFiles = activeEditor ? [activeEditor.document.uri] : [];
        const language = activeEditor?.document.languageId || 'typescript';

        // 創建編輯上下文
        const editContext: EditContext = {
          taskType: selectedTaskType.value,
          targetFiles,
          language,
          dependencies: [],
          existingCode: activeEditor?.document.getText() || '',
          userRequirement: userGoal,
          preferences: {
            testingFramework: 'jest',
            codeStyle: 'typescript'
          }
        };

        // 創建計劃
        const plan = await this.navigationEngine.createEditPlan(title, description || '', userGoal, { language });

        // 生成步驟
        const steps = await this.stepGenerator.generateEditSteps(editContext);

        // 添加步驟到計劃
        for (const stepData of steps) {
          await this.navigationEngine.addEditStep(stepData);
        }

        this.refresh();
        this.updateStatusBar();

        vscode.window.showInformationMessage(`編輯計劃 "${title}" 已創建，包含 ${steps.length} 個步驟`);
      },
      '創建編輯計劃',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 開始執行計劃
   */
  async startExecution(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activePlan = this.navigationEngine.getActivePlan();
        if (!activePlan) {
          vscode.window.showWarningMessage('沒有活躍的編輯計劃');
          return;
        }

        if (activePlan.steps.length === 0) {
          vscode.window.showWarningMessage('編輯計劃沒有步驟');
          return;
        }

        const choice = await vscode.window.showInformationMessage(
          `開始執行編輯計劃 "${activePlan.title}"？`,
          { modal: true },
          '開始執行',
          '取消'
        );

        if (choice === '開始執行') {
          await this.navigationEngine.startExecution();
          this.refresh();
          this.updateStatusBar();
        }
      },
      '開始執行編輯計劃',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 下一步
   */
  async nextStep(): Promise<void> {
    await this.navigationEngine.nextStep();
    this.refresh();
    this.updateStatusBar();
  }

  /**
   * 上一步
   */
  async previousStep(): Promise<void> {
    await this.navigationEngine.previousStep();
    this.refresh();
    this.updateStatusBar();
  }

  /**
   * 跳過當前步驟
   */
  async skipCurrentStep(): Promise<void> {
    const choice = await vscode.window.showWarningMessage('確定要跳過當前步驟嗎？', '跳過', '取消');

    if (choice === '跳過') {
      await this.navigationEngine.skipCurrentStep();
      this.refresh();
      this.updateStatusBar();
    }
  }

  /**
   * 執行當前步驟
   */
  async executeCurrentStep(): Promise<void> {
    await this.navigationEngine.executeCurrentStep();
    this.refresh();
    this.updateStatusBar();
  }

  /**
   * 顯示計劃詳情
   */
  async showPlanDetails(planId?: string): Promise<void> {
    const activePlan = this.navigationEngine.getActivePlan();
    if (!activePlan) {
      vscode.window.showWarningMessage('沒有活躍的編輯計劃');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'editPlanDetails',
      `編輯計劃: ${activePlan.title}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this.generatePlanDetailsHTML(activePlan);
  }

  /**
   * 顯示步驟詳情
   */
  async showStepDetails(stepId: string): Promise<void> {
    const activePlan = this.navigationEngine.getActivePlan();
    if (!activePlan) return;

    const step = activePlan.steps.find(s => s.id === stepId);
    if (!step) return;

    const panel = vscode.window.createWebviewPanel(
      'editStepDetails',
      `編輯步驟: ${step.title}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this.generateStepDetailsHTML(step);

    // 處理 WebView 消息
    panel.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'executeStep':
          await this.executeCurrentStep();
          break;
        case 'skipStep':
          await this.skipCurrentStep();
          break;
        case 'editStep':
          await this.editStep(stepId);
          break;
      }
    });
  }

  /**
   * 編輯步驟
   */
  async editStep(stepId: string): Promise<void> {
    // 實現步驟編輯功能
    vscode.window.showInformationMessage('步驟編輯功能即將推出');
  }

  /**
   * 私有方法
   */
  private setupEventListeners(): void {
    this.navigationEngine.onEvent(event => {
      this.refresh();
      this.updateStatusBar();

      // 根據事件類型顯示通知
      switch (event.type) {
        case 'step_completed':
          vscode.window.showInformationMessage(`✅ 步驟完成: ${event.step?.title}`);
          break;
        case 'step_failed':
          vscode.window.showErrorMessage(`❌ 步驟失敗: ${event.step?.title}`);
          break;
        case 'plan_completed':
          vscode.window.showInformationMessage(`🎉 編輯計劃完成: ${event.plan.title}`);
          break;
      }
    });
  }

  private updateStatusBar(): void {
    const activePlan = this.navigationEngine.getActivePlan();

    if (!activePlan) {
      this.statusBarItem.text = '$(edit) 編輯導航';
      this.statusBarItem.tooltip = '點擊創建編輯計劃';
      this.statusBarItem.command = 'devika.editNavigation.createPlan';
    } else {
      const progress = this.navigationEngine.getProgress();
      this.statusBarItem.text = `$(edit) ${progress.currentStep}/${progress.totalSteps}`;
      this.statusBarItem.tooltip = `編輯計劃: ${activePlan.title}\n進度: ${progress.percentage.toFixed(1)}%`;
      this.statusBarItem.command = 'devika.editNavigation.showProgress';
    }

    this.statusBarItem.show();
  }

  private getStepIcon(status: EditStepStatus, isCurrent: boolean): string {
    if (isCurrent) {
      return '▶️';
    }

    switch (status) {
      case EditStepStatus.COMPLETED:
        return '✅';
      case EditStepStatus.FAILED:
        return '❌';
      case EditStepStatus.SKIPPED:
        return '⏭️';
      case EditStepStatus.IN_PROGRESS:
        return '🔄';
      default:
        return '⏸️';
    }
  }

  private generatePlanDetailsHTML(plan: EditPlan): string {
    const progress = this.navigationEngine.getProgress();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>編輯計劃詳情</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .progress-bar {
            width: 100%;
            height: 20px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
          }
          .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-foreground);
            transition: width 0.3s ease;
          }
          .step {
            margin: 10px 0;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
          }
          .step.current {
            background-color: var(--vscode-list-activeSelectionBackground);
          }
          .step.completed {
            opacity: 0.7;
          }
          .step-title {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .step-meta {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 ${plan.title}</h1>
          <p>${plan.description}</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress.percentage}%"></div>
          </div>
          <p>進度: ${progress.currentStep}/${progress.totalSteps} (${progress.percentage.toFixed(1)}%)</p>
          <p>預估剩餘時間: ${progress.estimatedTimeRemaining} 分鐘</p>
        </div>

        <h2>編輯步驟</h2>
        ${plan.steps
          .map(
            (step, index) => `
          <div class="step ${index === plan.currentStepIndex ? 'current' : ''} ${step.status === 'completed' ? 'completed' : ''}">
            <div class="step-title">
              ${this.getStepIcon(step.status, index === plan.currentStepIndex)} ${step.title}
            </div>
            <div>${step.description}</div>
            <div class="step-meta">
              狀態: ${step.status} | 預估時間: ${step.estimatedTime} 分鐘 | 目標文件: ${step.targetFile.fsPath}
            </div>
          </div>
        `
          )
          .join('')}
      </body>
      </html>
    `;
  }

  private generateStepDetailsHTML(step: EditStep): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>編輯步驟詳情</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
          }
          .code-block {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 10px;
            border-radius: 3px;
            font-family: monospace;
            white-space: pre-wrap;
          }
          button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            margin: 5px;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${this.getStepIcon(step.status, false)} ${step.title}</h1>
          <p>${step.description}</p>
          <p><strong>狀態:</strong> ${step.status}</p>
          <p><strong>優先級:</strong> ${step.priority}</p>
          <p><strong>預估時間:</strong> ${step.estimatedTime} 分鐘</p>
          <p><strong>目標文件:</strong> ${step.targetFile.fsPath}</p>
        </div>

        <div class="section">
          <div class="section-title">執行指令</div>
          <p>${step.instructions}</p>
        </div>

        ${
          step.codeChanges
            ? `
          <div class="section">
            <div class="section-title">代碼變更</div>
            ${
              step.codeChanges.before
                ? `
              <h4>變更前:</h4>
              <div class="code-block">${step.codeChanges.before}</div>
            `
                : ''
            }
            <h4>變更後:</h4>
            <div class="code-block">${step.codeChanges.after}</div>
          </div>
        `
            : ''
        }

        ${
          step.validation
            ? `
          <div class="section">
            <div class="section-title">驗證規則</div>
            <ul>
              ${step.validation.rules.map(rule => `<li>${rule}</li>`).join('')}
            </ul>
            <p><strong>預期結果:</strong> ${step.validation.expectedOutcome}</p>
          </div>
        `
            : ''
        }

        <div class="section">
          <div class="section-title">操作</div>
          <button onclick="executeStep()">執行步驟</button>
          <button onclick="skipStep()">跳過步驟</button>
          <button onclick="editStep()">編輯步驟</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          function executeStep() {
            vscode.postMessage({ command: 'executeStep' });
          }

          function skipStep() {
            vscode.postMessage({ command: 'skipStep' });
          }

          function editStep() {
            vscode.postMessage({ command: 'editStep' });
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}

/**
 * 編輯導航樹項目
 */
class EditNavigationItem extends vscode.TreeItem {
  constructor(
    public override readonly label: string,
    public override readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public override readonly contextValue?: string,
    public override readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
  }
}
