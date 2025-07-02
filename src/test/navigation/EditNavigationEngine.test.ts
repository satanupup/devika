import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { 
  EditNavigationEngine, 
  EditStep, 
  EditStepType, 
  EditStepPriority, 
  EditStepStatus 
} from '../../navigation/EditNavigationEngine';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key, defaultValue) => defaultValue)
    })),
    workspaceFolders: [{
      uri: { fsPath: '/test/workspace' }
    }],
    fs: {
      writeFile: jest.fn(),
      stat: jest.fn(() => Promise.resolve({ type: 1 })), // FileType.File
      delete: jest.fn()
    },
    openTextDocument: jest.fn(() => Promise.resolve({
      getText: jest.fn(() => 'test content'),
      positionAt: jest.fn(() => ({ line: 0, character: 0 }))
    })),
    applyEdit: jest.fn(() => Promise.resolve(true))
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn()
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
    joinPath: jest.fn((base, ...paths) => ({ 
      fsPath: `${base.fsPath}/${paths.join('/')}` 
    }))
  },
  Range: jest.fn(),
  Position: jest.fn(),
  WorkspaceEdit: jest.fn(() => ({
    replace: jest.fn(),
    insert: jest.fn()
  })),
  EventEmitter: jest.fn(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn()
  })),
  FileType: {
    File: 1
  }
}));

describe('EditNavigationEngine', () => {
  let navigationEngine: EditNavigationEngine;

  beforeEach(() => {
    // 重置單例實例
    (EditNavigationEngine as any).instance = undefined;
    navigationEngine = EditNavigationEngine.getInstance();
  });

  afterEach(() => {
    // 清理測試數據
    navigationEngine.dispose();
  });

  describe('基本功能', () => {
    it('應該能夠創建單例實例', () => {
      const instance1 = EditNavigationEngine.getInstance();
      const instance2 = EditNavigationEngine.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('應該能夠創建編輯計劃', async () => {
      const plan = await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      expect(plan.title).toBe('測試計劃');
      expect(plan.description).toBe('測試描述');
      expect(plan.context.userGoal).toBe('測試目標');
      expect(plan.context.language).toBe('typescript');
      expect(plan.status).toBe('planning');
      expect(plan.steps).toHaveLength(0);
    });

    it('應該能夠添加編輯步驟', async () => {
      await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      const stepData = {
        type: EditStepType.CREATE_FILE,
        title: '創建測試文件',
        description: '創建一個測試文件',
        priority: EditStepPriority.HIGH,
        targetFile: vscode.Uri.file('/test/file.ts'),
        dependencies: [],
        estimatedTime: 10,
        instructions: '創建文件',
        codeChanges: {
          after: 'console.log("Hello World");'
        }
      };

      const step = await navigationEngine.addEditStep(stepData);

      expect(step.title).toBe('創建測試文件');
      expect(step.type).toBe(EditStepType.CREATE_FILE);
      expect(step.status).toBe(EditStepStatus.PENDING);
      expect(step.id).toBeDefined();
      expect(step.metadata.createdAt).toBeInstanceOf(Date);
    });

    it('應該能夠獲取活躍計劃', async () => {
      const plan = await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      const activePlan = navigationEngine.getActivePlan();
      expect(activePlan).toBe(plan);
    });

    it('應該能夠獲取當前步驟', async () => {
      await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      // 沒有步驟時應該返回 null
      expect(navigationEngine.getCurrentStep()).toBeNull();

      // 添加步驟後應該返回第一個步驟
      const stepData = {
        type: EditStepType.CREATE_FILE,
        title: '創建測試文件',
        description: '創建一個測試文件',
        priority: EditStepPriority.HIGH,
        targetFile: vscode.Uri.file('/test/file.ts'),
        dependencies: [],
        estimatedTime: 10,
        instructions: '創建文件'
      };

      const step = await navigationEngine.addEditStep(stepData);
      const currentStep = navigationEngine.getCurrentStep();
      expect(currentStep).toBe(step);
    });
  });

  describe('計劃執行', () => {
    let plan: any;
    let step: EditStep;

    beforeEach(async () => {
      plan = await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      const stepData = {
        type: EditStepType.CREATE_FILE,
        title: '創建測試文件',
        description: '創建一個測試文件',
        priority: EditStepPriority.HIGH,
        targetFile: vscode.Uri.file('/test/file.ts'),
        dependencies: [],
        estimatedTime: 10,
        instructions: '創建文件',
        codeChanges: {
          after: 'console.log("Hello World");'
        }
      };

      step = await navigationEngine.addEditStep(stepData);
    });

    it('應該能夠開始執行計劃', async () => {
      await navigationEngine.startExecution();

      const activePlan = navigationEngine.getActivePlan();
      expect(activePlan?.status).toBe('executing');
      expect(activePlan?.currentStepIndex).toBe(0);
    });

    it('應該能夠執行當前步驟', async () => {
      await navigationEngine.startExecution();
      
      // 步驟應該被標記為進行中
      const currentStep = navigationEngine.getCurrentStep();
      expect(currentStep?.status).toBe(EditStepStatus.IN_PROGRESS);
    });

    it('應該能夠跳過當前步驟', async () => {
      await navigationEngine.startExecution();
      await navigationEngine.skipCurrentStep();

      const activePlan = navigationEngine.getActivePlan();
      expect(activePlan?.currentStepIndex).toBe(1);
      
      const skippedStep = activePlan?.steps[0];
      expect(skippedStep?.status).toBe(EditStepStatus.SKIPPED);
    });

    it('應該能夠前進到下一步', async () => {
      // 添加第二個步驟
      const stepData2 = {
        type: EditStepType.MODIFY_FILE,
        title: '修改測試文件',
        description: '修改測試文件內容',
        priority: EditStepPriority.MEDIUM,
        targetFile: vscode.Uri.file('/test/file.ts'),
        dependencies: [],
        estimatedTime: 5,
        instructions: '修改文件'
      };

      await navigationEngine.addEditStep(stepData2);
      await navigationEngine.startExecution();

      // 手動完成第一個步驟
      const firstStep = navigationEngine.getCurrentStep();
      if (firstStep) {
        firstStep.status = EditStepStatus.COMPLETED;
      }

      await navigationEngine.nextStep();

      const activePlan = navigationEngine.getActivePlan();
      expect(activePlan?.currentStepIndex).toBe(1);
    });

    it('應該能夠回到上一步', async () => {
      // 添加第二個步驟
      const stepData2 = {
        type: EditStepType.MODIFY_FILE,
        title: '修改測試文件',
        description: '修改測試文件內容',
        priority: EditStepPriority.MEDIUM,
        targetFile: vscode.Uri.file('/test/file.ts'),
        dependencies: [],
        estimatedTime: 5,
        instructions: '修改文件'
      };

      await navigationEngine.addEditStep(stepData2);
      await navigationEngine.startExecution();

      // 前進到第二步
      await navigationEngine.nextStep();
      expect(navigationEngine.getActivePlan()?.currentStepIndex).toBe(1);

      // 回到第一步
      await navigationEngine.previousStep();
      expect(navigationEngine.getActivePlan()?.currentStepIndex).toBe(0);
    });
  });

  describe('進度追蹤', () => {
    beforeEach(async () => {
      await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      // 添加多個步驟
      const stepTypes = [
        EditStepType.CREATE_FILE,
        EditStepType.MODIFY_FILE,
        EditStepType.ADD_FUNCTION,
        EditStepType.ADD_TEST
      ];

      for (let i = 0; i < stepTypes.length; i++) {
        const stepData = {
          type: stepTypes[i],
          title: `步驟 ${i + 1}`,
          description: `測試步驟 ${i + 1}`,
          priority: EditStepPriority.MEDIUM,
          targetFile: vscode.Uri.file(`/test/file${i}.ts`),
          dependencies: [],
          estimatedTime: 10,
          instructions: `執行步驟 ${i + 1}`
        };

        await navigationEngine.addEditStep(stepData);
      }
    });

    it('應該能夠獲取正確的進度信息', () => {
      const progress = navigationEngine.getProgress();

      expect(progress.totalSteps).toBe(4);
      expect(progress.currentStep).toBe(1);
      expect(progress.completedSteps).toBe(0);
      expect(progress.percentage).toBe(0);
      expect(progress.estimatedTimeRemaining).toBe(40); // 4 * 10 分鐘
    });

    it('應該能夠正確計算完成進度', async () => {
      await navigationEngine.startExecution();

      // 完成第一個步驟
      const activePlan = navigationEngine.getActivePlan();
      if (activePlan) {
        activePlan.steps[0].status = EditStepStatus.COMPLETED;
        await navigationEngine.nextStep();
      }

      const progress = navigationEngine.getProgress();
      expect(progress.completedSteps).toBe(1);
      expect(progress.percentage).toBe(25);
      expect(progress.estimatedTimeRemaining).toBe(30); // 3 * 10 分鐘
    });

    it('應該能夠獲取步驟歷史', async () => {
      await navigationEngine.startExecution();

      // 完成第一個步驟
      const activePlan = navigationEngine.getActivePlan();
      if (activePlan) {
        const firstStep = activePlan.steps[0];
        firstStep.status = EditStepStatus.COMPLETED;
        firstStep.metadata.completedAt = new Date();
      }

      await navigationEngine.nextStep();

      const history = navigationEngine.getStepHistory();
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe(EditStepStatus.COMPLETED);
    });
  });

  describe('步驟執行', () => {
    it('應該能夠執行創建文件步驟', async () => {
      await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      const stepData = {
        type: EditStepType.CREATE_FILE,
        title: '創建測試文件',
        description: '創建一個測試文件',
        priority: EditStepPriority.HIGH,
        targetFile: vscode.Uri.file('/test/new-file.ts'),
        dependencies: [],
        estimatedTime: 10,
        instructions: '創建文件',
        codeChanges: {
          after: 'console.log("Hello World");'
        }
      };

      await navigationEngine.addEditStep(stepData);
      await navigationEngine.startExecution();

      // 驗證文件寫入被調用
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('應該能夠執行修改文件步驟', async () => {
      await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      const stepData = {
        type: EditStepType.MODIFY_FILE,
        title: '修改測試文件',
        description: '修改測試文件內容',
        priority: EditStepPriority.HIGH,
        targetFile: vscode.Uri.file('/test/existing-file.ts'),
        dependencies: [],
        estimatedTime: 10,
        instructions: '修改文件',
        codeChanges: {
          after: 'console.log("Modified content");'
        }
      };

      await navigationEngine.addEditStep(stepData);
      await navigationEngine.startExecution();

      // 驗證文檔打開和編輯被調用
      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('應該能夠執行刪除文件步驟', async () => {
      await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      const stepData = {
        type: EditStepType.DELETE_FILE,
        title: '刪除測試文件',
        description: '刪除測試文件',
        priority: EditStepPriority.HIGH,
        targetFile: vscode.Uri.file('/test/delete-file.ts'),
        dependencies: [],
        estimatedTime: 5,
        instructions: '刪除文件'
      };

      await navigationEngine.addEditStep(stepData);
      await navigationEngine.startExecution();

      // 驗證文件刪除被調用
      expect(vscode.workspace.fs.delete).toHaveBeenCalled();
    });
  });

  describe('事件系統', () => {
    it('應該能夠監聽計劃創建事件', (done) => {
      const disposable = navigationEngine.onEvent((event) => {
        if (event.type === 'plan_created') {
          expect(event.plan.title).toBe('測試計劃');
          disposable.dispose();
          done();
        }
      });

      navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );
    });

    it('應該能夠監聽步驟添加事件', (done) => {
      let eventCount = 0;
      const disposable = navigationEngine.onEvent((event) => {
        eventCount++;
        if (event.type === 'step_added' && eventCount === 2) { // 第二個事件是步驟添加
          expect(event.step?.title).toBe('測試步驟');
          disposable.dispose();
          done();
        }
      });

      navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      ).then(() => {
        const stepData = {
          type: EditStepType.CREATE_FILE,
          title: '測試步驟',
          description: '測試步驟描述',
          priority: EditStepPriority.MEDIUM,
          targetFile: vscode.Uri.file('/test/file.ts'),
          dependencies: [],
          estimatedTime: 10,
          instructions: '測試指令'
        };

        navigationEngine.addEditStep(stepData);
      });
    });

    it('應該能夠監聽執行開始事件', (done) => {
      let eventCount = 0;
      const disposable = navigationEngine.onEvent((event) => {
        eventCount++;
        if (event.type === 'execution_started') {
          expect(event.plan.status).toBe('executing');
          disposable.dispose();
          done();
        }
      });

      navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      ).then(async () => {
        const stepData = {
          type: EditStepType.CREATE_FILE,
          title: '測試步驟',
          description: '測試步驟描述',
          priority: EditStepPriority.MEDIUM,
          targetFile: vscode.Uri.file('/test/file.ts'),
          dependencies: [],
          estimatedTime: 10,
          instructions: '測試指令'
        };

        await navigationEngine.addEditStep(stepData);
        await navigationEngine.startExecution();
      });
    });
  });

  describe('錯誤處理', () => {
    it('應該能夠處理沒有活躍計劃的情況', async () => {
      // 沒有創建計劃就嘗試開始執行
      await navigationEngine.startExecution();
      
      // 應該顯示錯誤消息
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('應該能夠處理沒有步驟的計劃', async () => {
      await navigationEngine.createEditPlan(
        '空計劃',
        '沒有步驟的計劃',
        '測試目標',
        { language: 'typescript' }
      );

      await navigationEngine.startExecution();
      
      // 應該顯示錯誤消息
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('應該能夠處理步驟執行失敗', async () => {
      // Mock 文件寫入失敗
      (vscode.workspace.fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error('寫入失敗'));

      await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      const stepData = {
        type: EditStepType.CREATE_FILE,
        title: '創建測試文件',
        description: '創建一個測試文件',
        priority: EditStepPriority.HIGH,
        targetFile: vscode.Uri.file('/test/file.ts'),
        dependencies: [],
        estimatedTime: 10,
        instructions: '創建文件',
        codeChanges: {
          after: 'console.log("Hello World");'
        }
      };

      await navigationEngine.addEditStep(stepData);
      await navigationEngine.startExecution();

      // 步驟應該被標記為失敗
      const currentStep = navigationEngine.getCurrentStep();
      expect(currentStep?.status).toBe(EditStepStatus.FAILED);
      expect(currentStep?.metadata.lastError).toContain('寫入失敗');
    });
  });

  describe('配置管理', () => {
    it('應該能夠加載默認配置', () => {
      // 配置應該從 vscode.workspace.getConfiguration 加載
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('devika.editNavigation');
    });

    it('應該能夠使用配置控制行為', async () => {
      // Mock 配置返回 autoAdvance: false
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key, defaultValue) => {
          if (key === 'autoAdvance') return false;
          return defaultValue;
        })
      });

      // 重新創建實例以加載新配置
      (EditNavigationEngine as any).instance = undefined;
      navigationEngine = EditNavigationEngine.getInstance();

      await navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      const stepData = {
        type: EditStepType.CREATE_FILE,
        title: '創建測試文件',
        description: '創建一個測試文件',
        priority: EditStepPriority.HIGH,
        targetFile: vscode.Uri.file('/test/file.ts'),
        dependencies: [],
        estimatedTime: 10,
        instructions: '創建文件'
      };

      await navigationEngine.addEditStep(stepData);
      await navigationEngine.startExecution();

      // 由於 autoAdvance 為 false，步驟完成後不應該自動前進
      const activePlan = navigationEngine.getActivePlan();
      expect(activePlan?.currentStepIndex).toBe(0);
    });
  });

  describe('資源清理', () => {
    it('應該能夠正確清理資源', () => {
      // 創建一些數據
      navigationEngine.createEditPlan(
        '測試計劃',
        '測試描述',
        '測試目標',
        { language: 'typescript' }
      );

      // 清理資源
      navigationEngine.dispose();

      // 驗證事件發射器被清理
      // 這裡我們無法直接測試，但可以確保 dispose 方法被調用
      expect(() => navigationEngine.dispose()).not.toThrow();
    });
  });
});
