import * as vscode from 'vscode';
import { CodeUnderstandingEngine } from '../ai/CodeUnderstandingEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';
import { EditStep, EditStepPriority, EditStepStatus, EditStepType } from './EditNavigationEngine';

/**
 * 編輯任務類型
 */
export enum EditTaskType {
  FEATURE_IMPLEMENTATION = 'feature_implementation',
  BUG_FIX = 'bug_fix',
  REFACTORING = 'refactoring',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  CONFIGURATION = 'configuration',
  DEPENDENCY_UPDATE = 'dependency_update',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  SECURITY_FIX = 'security_fix',
  CODE_CLEANUP = 'code_cleanup'
}

/**
 * 編輯上下文
 */
export interface EditContext {
  taskType: EditTaskType;
  targetFiles: vscode.Uri[];
  language: string;
  framework?: string;
  dependencies: string[];
  existingCode: string;
  userRequirement: string;
  constraints?: string[];
  preferences?: {
    codeStyle?: string;
    testingFramework?: string;
    documentationStyle?: string;
  };
}

/**
 * 步驟模板
 */
interface StepTemplate {
  type: EditStepType;
  title: string;
  description: string;
  priority: EditStepPriority;
  estimatedTime: number;
  dependencies: string[];
  conditions: (context: EditContext) => boolean;
  generator: (context: EditContext) => Partial<EditStep>;
}

/**
 * 編輯步驟生成器
 * 基於用戶需求和代碼上下文智能生成編輯步驟
 */
export class EditStepGenerator {
  private static instance: EditStepGenerator;
  private codeEngine: CodeUnderstandingEngine;
  private stepTemplates: Map<string, StepTemplate> = new Map();

  private constructor() {
    this.codeEngine = CodeUnderstandingEngine.getInstance();
    this.initializeStepTemplates();
  }

  static getInstance(): EditStepGenerator {
    if (!EditStepGenerator.instance) {
      EditStepGenerator.instance = new EditStepGenerator();
    }
    return EditStepGenerator.instance;
  }

  /**
   * 生成編輯步驟
   */
  async generateEditSteps(context: EditContext): Promise<EditStep[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const steps: EditStep[] = [];

        // 分析代碼結構
        const codeAnalysis = await this.analyzeCodeStructure(context);

        // 根據任務類型生成步驟
        switch (context.taskType) {
          case EditTaskType.FEATURE_IMPLEMENTATION:
            steps.push(...(await this.generateFeatureImplementationSteps(context, codeAnalysis)));
            break;
          case EditTaskType.BUG_FIX:
            steps.push(...(await this.generateBugFixSteps(context, codeAnalysis)));
            break;
          case EditTaskType.REFACTORING:
            steps.push(...(await this.generateRefactoringSteps(context, codeAnalysis)));
            break;
          case EditTaskType.TESTING:
            steps.push(...(await this.generateTestingSteps(context, codeAnalysis)));
            break;
          case EditTaskType.DOCUMENTATION:
            steps.push(...(await this.generateDocumentationSteps(context, codeAnalysis)));
            break;
          default:
            steps.push(...(await this.generateGenericSteps(context, codeAnalysis)));
        }

        // 排序和優化步驟
        return this.optimizeSteps(steps);
      },
      '生成編輯步驟',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : []));
  }

  /**
   * 生成功能實現步驟
   */
  private async generateFeatureImplementationSteps(context: EditContext, analysis: CodeAnalysis): Promise<EditStep[]> {
    const steps: EditStep[] = [];

    // 1. 分析需求和設計
    steps.push(
      this.createStep({
        type: EditStepType.CREATE_FILE,
        title: '創建功能規格文檔',
        description: '分析需求並創建功能規格文檔',
        priority: EditStepPriority.HIGH,
        estimatedTime: 10,
        targetFile: vscode.Uri.joinPath(analysis.workspaceRoot, 'docs', 'feature-spec.md'),
        instructions: '創建詳細的功能規格文檔，包括需求分析、設計方案和實現計劃',
        codeChanges: {
          after: this.generateFeatureSpecTemplate(context)
        }
      })
    );

    // 2. 創建或修改主要文件
    if (analysis.needsNewFile) {
      steps.push(
        this.createStep({
          type: EditStepType.CREATE_FILE,
          title: '創建主要功能文件',
          description: `創建 ${analysis.suggestedFileName}`,
          priority: EditStepPriority.HIGH,
          estimatedTime: 15,
          targetFile: vscode.Uri.joinPath(analysis.workspaceRoot, analysis.suggestedFileName),
          instructions: '創建主要功能實現文件',
          codeChanges: {
            after: this.generateFeatureFileTemplate(context, analysis)
          }
        })
      );
    }

    // 3. 添加必要的導入
    if (analysis.requiredImports.length > 0) {
      steps.push(
        this.createStep({
          type: EditStepType.ADD_IMPORT,
          title: '添加必要的導入',
          description: '添加功能實現所需的導入語句',
          priority: EditStepPriority.MEDIUM,
          estimatedTime: 5,
          targetFile: context.targetFiles[0],
          instructions: '添加所有必要的導入語句',
          codeChanges: {
            after: analysis.requiredImports.join('\n')
          }
        })
      );
    }

    // 4. 實現核心功能
    steps.push(
      this.createStep({
        type: EditStepType.ADD_FUNCTION,
        title: '實現核心功能',
        description: '實現主要的功能邏輯',
        priority: EditStepPriority.CRITICAL,
        estimatedTime: 30,
        targetFile: context.targetFiles[0],
        instructions: '實現核心功能邏輯，確保符合需求規格',
        codeChanges: {
          after: this.generateCoreFeatureCode(context, analysis)
        }
      })
    );

    // 5. 添加錯誤處理
    steps.push(
      this.createStep({
        type: EditStepType.MODIFY_FUNCTION,
        title: '添加錯誤處理',
        description: '為功能添加適當的錯誤處理機制',
        priority: EditStepPriority.HIGH,
        estimatedTime: 10,
        targetFile: context.targetFiles[0],
        instructions: '添加錯誤處理和異常管理',
        codeChanges: {
          after: this.generateErrorHandlingCode(context)
        }
      })
    );

    // 6. 創建測試文件
    if (context.preferences?.testingFramework) {
      steps.push(
        this.createStep({
          type: EditStepType.CREATE_FILE,
          title: '創建測試文件',
          description: '為新功能創建單元測試',
          priority: EditStepPriority.MEDIUM,
          estimatedTime: 20,
          targetFile: this.getTestFilePath(context.targetFiles[0]),
          instructions: '創建全面的單元測試',
          codeChanges: {
            after: this.generateTestCode(context, analysis)
          }
        })
      );
    }

    // 7. 更新文檔
    steps.push(
      this.createStep({
        type: EditStepType.MODIFY_FILE,
        title: '更新 README',
        description: '更新項目文檔以包含新功能',
        priority: EditStepPriority.LOW,
        estimatedTime: 5,
        targetFile: vscode.Uri.joinPath(analysis.workspaceRoot, 'README.md'),
        instructions: '在 README 中添加新功能的說明',
        codeChanges: {
          after: this.generateReadmeUpdate(context)
        }
      })
    );

    return steps;
  }

  /**
   * 生成 Bug 修復步驟
   */
  private async generateBugFixSteps(context: EditContext, analysis: CodeAnalysis): Promise<EditStep[]> {
    const steps: EditStep[] = [];

    // 1. 分析問題
    steps.push(
      this.createStep({
        type: EditStepType.CREATE_FILE,
        title: '創建問題分析報告',
        description: '分析 Bug 的根本原因',
        priority: EditStepPriority.HIGH,
        estimatedTime: 15,
        targetFile: vscode.Uri.joinPath(analysis.workspaceRoot, 'docs', 'bug-analysis.md'),
        instructions: '詳細分析 Bug 的原因和影響範圍',
        codeChanges: {
          after: this.generateBugAnalysisTemplate(context)
        }
      })
    );

    // 2. 創建重現測試
    steps.push(
      this.createStep({
        type: EditStepType.CREATE_FILE,
        title: '創建 Bug 重現測試',
        description: '創建能重現 Bug 的測試案例',
        priority: EditStepPriority.HIGH,
        estimatedTime: 10,
        targetFile: this.getTestFilePath(context.targetFiles[0], 'bug'),
        instructions: '創建能穩定重現 Bug 的測試',
        codeChanges: {
          after: this.generateBugReproductionTest(context)
        }
      })
    );

    // 3. 修復 Bug
    steps.push(
      this.createStep({
        type: EditStepType.MODIFY_FUNCTION,
        title: '修復 Bug',
        description: '實施 Bug 修復方案',
        priority: EditStepPriority.CRITICAL,
        estimatedTime: 20,
        targetFile: context.targetFiles[0],
        instructions: '根據分析結果修復 Bug',
        codeChanges: {
          after: this.generateBugFixCode(context, analysis)
        }
      })
    );

    // 4. 驗證修復
    steps.push(
      this.createStep({
        type: EditStepType.MODIFY_FILE,
        title: '驗證修復效果',
        description: '運行測試確認 Bug 已修復',
        priority: EditStepPriority.HIGH,
        estimatedTime: 5,
        targetFile: this.getTestFilePath(context.targetFiles[0]),
        instructions: '運行所有相關測試確認修復效果',
        codeChanges: {
          after: this.generateVerificationTest(context)
        }
      })
    );

    return steps;
  }

  /**
   * 生成重構步驟
   */
  private async generateRefactoringSteps(context: EditContext, analysis: CodeAnalysis): Promise<EditStep[]> {
    const steps: EditStep[] = [];

    // 1. 創建重構計劃
    steps.push(
      this.createStep({
        type: EditStepType.CREATE_FILE,
        title: '創建重構計劃',
        description: '制定詳細的重構計劃',
        priority: EditStepPriority.MEDIUM,
        estimatedTime: 10,
        targetFile: vscode.Uri.joinPath(analysis.workspaceRoot, 'docs', 'refactoring-plan.md'),
        instructions: '制定安全的重構計劃',
        codeChanges: {
          after: this.generateRefactoringPlan(context, analysis)
        }
      })
    );

    // 2. 確保測試覆蓋
    steps.push(
      this.createStep({
        type: EditStepType.ADD_TEST,
        title: '確保測試覆蓋',
        description: '為重構目標添加測試',
        priority: EditStepPriority.HIGH,
        estimatedTime: 15,
        targetFile: this.getTestFilePath(context.targetFiles[0]),
        instructions: '確保重構前有足夠的測試覆蓋',
        codeChanges: {
          after: this.generateRefactoringTests(context, analysis)
        }
      })
    );

    // 3. 執行重構
    steps.push(
      this.createStep({
        type: EditStepType.REFACTOR,
        title: '執行重構',
        description: '按計劃執行代碼重構',
        priority: EditStepPriority.CRITICAL,
        estimatedTime: 25,
        targetFile: context.targetFiles[0],
        instructions: '小步驟、安全地執行重構',
        codeChanges: {
          after: this.generateRefactoredCode(context, analysis)
        }
      })
    );

    // 4. 驗證重構結果
    steps.push(
      this.createStep({
        type: EditStepType.MODIFY_FILE,
        title: '驗證重構結果',
        description: '運行測試確認重構成功',
        priority: EditStepPriority.HIGH,
        estimatedTime: 5,
        targetFile: this.getTestFilePath(context.targetFiles[0]),
        instructions: '運行所有測試確認重構沒有破壞功能',
        codeChanges: {
          after: '// 運行測試驗證重構結果'
        }
      })
    );

    return steps;
  }

  /**
   * 生成測試步驟
   */
  private async generateTestingSteps(context: EditContext, analysis: CodeAnalysis): Promise<EditStep[]> {
    const steps: EditStep[] = [];

    // 1. 分析測試需求
    steps.push(
      this.createStep({
        type: EditStepType.CREATE_FILE,
        title: '分析測試需求',
        description: '分析需要測試的功能和場景',
        priority: EditStepPriority.MEDIUM,
        estimatedTime: 10,
        targetFile: vscode.Uri.joinPath(analysis.workspaceRoot, 'docs', 'test-plan.md'),
        instructions: '制定全面的測試計劃',
        codeChanges: {
          after: this.generateTestPlan(context, analysis)
        }
      })
    );

    // 2. 創建單元測試
    steps.push(
      this.createStep({
        type: EditStepType.CREATE_FILE,
        title: '創建單元測試',
        description: '為核心功能創建單元測試',
        priority: EditStepPriority.HIGH,
        estimatedTime: 20,
        targetFile: this.getTestFilePath(context.targetFiles[0]),
        instructions: '創建全面的單元測試',
        codeChanges: {
          after: this.generateUnitTests(context, analysis)
        }
      })
    );

    // 3. 創建整合測試
    if (analysis.hasIntegrationPoints) {
      steps.push(
        this.createStep({
          type: EditStepType.CREATE_FILE,
          title: '創建整合測試',
          description: '測試組件間的整合',
          priority: EditStepPriority.MEDIUM,
          estimatedTime: 15,
          targetFile: this.getTestFilePath(context.targetFiles[0], 'integration'),
          instructions: '創建整合測試',
          codeChanges: {
            after: this.generateIntegrationTests(context, analysis)
          }
        })
      );
    }

    return steps;
  }

  /**
   * 生成文檔步驟
   */
  private async generateDocumentationSteps(context: EditContext, analysis: CodeAnalysis): Promise<EditStep[]> {
    const steps: EditStep[] = [];

    // 1. 更新 API 文檔
    steps.push(
      this.createStep({
        type: EditStepType.MODIFY_FILE,
        title: '更新 API 文檔',
        description: '更新 API 文檔和註釋',
        priority: EditStepPriority.MEDIUM,
        estimatedTime: 15,
        targetFile: context.targetFiles[0],
        instructions: '添加或更新 JSDoc 註釋',
        codeChanges: {
          after: this.generateApiDocumentation(context, analysis)
        }
      })
    );

    // 2. 更新 README
    steps.push(
      this.createStep({
        type: EditStepType.MODIFY_FILE,
        title: '更新 README',
        description: '更新項目 README 文檔',
        priority: EditStepPriority.LOW,
        estimatedTime: 10,
        targetFile: vscode.Uri.joinPath(analysis.workspaceRoot, 'README.md'),
        instructions: '更新 README 以反映最新變更',
        codeChanges: {
          after: this.generateReadmeUpdate(context)
        }
      })
    );

    return steps;
  }

  /**
   * 生成通用步驟
   */
  private async generateGenericSteps(context: EditContext, analysis: CodeAnalysis): Promise<EditStep[]> {
    const steps: EditStep[] = [];

    // 基於上下文生成適當的步驟
    steps.push(
      this.createStep({
        type: EditStepType.MODIFY_FILE,
        title: '執行代碼變更',
        description: '根據需求執行代碼變更',
        priority: EditStepPriority.HIGH,
        estimatedTime: 15,
        targetFile: context.targetFiles[0],
        instructions: context.userRequirement,
        codeChanges: {
          after: '// 根據用戶需求生成的代碼'
        }
      })
    );

    return steps;
  }

  /**
   * 輔助方法
   */
  private async analyzeCodeStructure(context: EditContext): Promise<CodeAnalysis> {
    // 簡化的代碼分析
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder?.uri || vscode.Uri.file('');

    return {
      workspaceRoot,
      language: context.language,
      framework: context.framework,
      needsNewFile: context.targetFiles.length === 0,
      suggestedFileName: this.suggestFileName(context),
      requiredImports: this.analyzeRequiredImports(context),
      hasIntegrationPoints: context.dependencies.length > 0,
      complexity: 'medium'
    };
  }

  private suggestFileName(context: EditContext): string {
    const baseName = context.userRequirement
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const extension = context.language === 'typescript' ? '.ts' : '.js';
    return `src/${baseName}${extension}`;
  }

  private analyzeRequiredImports(context: EditContext): string[] {
    const imports: string[] = [];

    // 基於框架添加常用導入
    if (context.framework === 'react') {
      imports.push("import React from 'react';");
    }

    if (context.framework === 'vue') {
      imports.push("import { defineComponent } from 'vue';");
    }

    return imports;
  }

  private optimizeSteps(steps: EditStep[]): EditStep[] {
    // 按依賴關係和優先級排序
    return steps.sort((a, b) => {
      // 首先按優先級排序
      const priorityOrder = {
        [EditStepPriority.CRITICAL]: 4,
        [EditStepPriority.HIGH]: 3,
        [EditStepPriority.MEDIUM]: 2,
        [EditStepPriority.LOW]: 1
      };

      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {return priorityDiff;}

      // 然後按類型排序（創建文件優先）
      const typeOrder: { [key in EditStepType]?: number } = {
        // File operations
        [EditStepType.CREATE_FILE]: 1,
        [EditStepType.RENAME_FILE]: 2,
        [EditStepType.DELETE_FILE]: 3,

        // Imports
        [EditStepType.ADD_IMPORT]: 10,
        [EditStepType.REMOVE_IMPORT]: 11,

        // Class/Function/Variable additions/deletions
        [EditStepType.ADD_CLASS]: 20,
        [EditStepType.ADD_FUNCTION]: 21,
        [EditStepType.ADD_VARIABLE]: 22,
        [EditStepType.DELETE_CLASS]: 23,
        [EditStepType.DELETE_FUNCTION]: 24,
        [EditStepType.DELETE_VARIABLE]: 25,

        // Modifications and refactoring
        [EditStepType.MODIFY_CLASS]: 30,
        [EditStepType.MODIFY_FUNCTION]: 31,
        [EditStepType.MODIFY_VARIABLE]: 32,
        [EditStepType.REFACTOR]: 33,
        [EditStepType.FIX_ERROR]: 34,

        // Testing and configuration
        [EditStepType.ADD_TEST]: 40,
        [EditStepType.UPDATE_CONFIG]: 41,

        // Generic file modification as a fallback
        [EditStepType.MODIFY_FILE]: 50
      };

      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });
  }

  private createStep(
    stepData: Partial<EditStep> & {
      type: EditStepType;
      title: string;
      targetFile: vscode.Uri;
    }
  ): EditStep {
    return {
      id: this.generateStepId(),
      type: stepData.type,
      title: stepData.title,
      description: stepData.description || '',
      priority: stepData.priority || EditStepPriority.MEDIUM,
      status: EditStepStatus.PENDING,
      targetFile: stepData.targetFile,
      targetRange: stepData.targetRange,
      dependencies: stepData.dependencies || [],
      estimatedTime: stepData.estimatedTime || 10,
      instructions: stepData.instructions || '',
      codeChanges: stepData.codeChanges,
      validation: stepData.validation,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0
      }
    };
  }

  private getTestFilePath(sourceFile: vscode.Uri, type: string = 'unit'): vscode.Uri {
    const baseName = sourceFile.fsPath.replace(/\.[^.]+$/, '');
    const extension = sourceFile.fsPath.includes('.ts') ? '.test.ts' : '.test.js';
    return vscode.Uri.file(`${baseName}.${type}${extension}`);
  }

  private generateStepId(): string {
    return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 代碼生成方法（簡化實現）
  private generateFeatureSpecTemplate(context: EditContext): string {
    return `# 功能規格: ${context.userRequirement}

## 需求描述
${context.userRequirement}

## 技術規格
- 語言: ${context.language}
- 框架: ${context.framework || 'N/A'}

## 實現計劃
1. 分析現有代碼結構
2. 設計新功能接口
3. 實現核心邏輯
4. 添加測試
5. 更新文檔
`;
  }

  private generateFeatureFileTemplate(context: EditContext, analysis: CodeAnalysis): string {
    return `// ${context.userRequirement} 實現
// 自動生成於 ${new Date().toISOString()}

${analysis.requiredImports.join('\n')}

/**
 * ${context.userRequirement}
 */
export class FeatureImplementation {
  // TODO: 實現功能邏輯
}
`;
  }

  private generateCoreFeatureCode(context: EditContext, analysis: CodeAnalysis): string {
    return `
/**
 * 核心功能實現
 */
export function implementFeature() {
  // TODO: 根據需求實現核心邏輯
  console.log('實現功能: ${context.userRequirement}');
}
`;
  }

  private generateErrorHandlingCode(context: EditContext): string {
    return `
try {
  // 功能實現
} catch (error) {
  console.error('功能執行失敗:', error);
  throw error;
}
`;
  }

  private generateTestCode(context: EditContext, analysis: CodeAnalysis): string {
    const framework = context.preferences?.testingFramework || 'jest';
    return `
import { ${framework === 'jest' ? 'describe, it, expect' : 'test'} } from '${framework}';

describe('${context.userRequirement}', () => {
  it('應該正確實現功能', () => {
    // TODO: 添加測試邏輯
    expect(true).toBe(true);
  });
});
`;
  }

  private generateReadmeUpdate(context: EditContext): string {
    return `
## 新功能: ${context.userRequirement}

${context.userRequirement} 的詳細說明和使用方法。

### 使用方法
\`\`\`${context.language}
// 使用範例
\`\`\`
`;
  }

  private generateBugAnalysisTemplate(context: EditContext): string {
    return `# Bug 分析報告

## 問題描述
${context.userRequirement}

## 根本原因分析
TODO: 分析 Bug 的根本原因

## 修復方案
TODO: 制定修復方案

## 影響範圍
TODO: 評估修復的影響範圍
`;
  }

  private generateBugReproductionTest(context: EditContext): string {
    return `
// Bug 重現測試
describe('Bug 重現', () => {
  it('應該重現報告的 Bug', () => {
    // TODO: 創建能重現 Bug 的測試
  });
});
`;
  }

  private generateBugFixCode(context: EditContext, analysis: CodeAnalysis): string {
    return `
// Bug 修復實現
// 修復: ${context.userRequirement}
`;
  }

  private generateVerificationTest(context: EditContext): string {
    return `
// 修復驗證測試
describe('Bug 修復驗證', () => {
  it('應該確認 Bug 已修復', () => {
    // TODO: 驗證 Bug 已修復
  });
});
`;
  }

  private generateRefactoringPlan(context: EditContext, analysis: CodeAnalysis): string {
    return `# 重構計劃

## 重構目標
${context.userRequirement}

## 重構步驟
1. 確保測試覆蓋
2. 小步驟重構
3. 驗證功能完整性

## 風險評估
- 低風險: 有充分測試覆蓋
- 中風險: 部分測試覆蓋
- 高風險: 缺少測試覆蓋
`;
  }

  private generateRefactoringTests(context: EditContext, analysis: CodeAnalysis): string {
    return `
// 重構前的測試覆蓋
describe('重構目標測試', () => {
  // TODO: 確保重構前有足夠的測試覆蓋
});
`;
  }

  private generateRefactoredCode(context: EditContext, analysis: CodeAnalysis): string {
    return `
// 重構後的代碼
// 重構: ${context.userRequirement}
`;
  }

  private generateTestPlan(context: EditContext, analysis: CodeAnalysis): string {
    return `# 測試計劃

## 測試目標
為 ${context.userRequirement} 創建全面的測試

## 測試類型
- 單元測試
- 整合測試
- 端到端測試

## 測試覆蓋率目標
- 代碼覆蓋率: 90%+
- 分支覆蓋率: 85%+
`;
  }

  private generateUnitTests(context: EditContext, analysis: CodeAnalysis): string {
    return `
// 單元測試
describe('單元測試', () => {
  // TODO: 添加單元測試
});
`;
  }

  private generateIntegrationTests(context: EditContext, analysis: CodeAnalysis): string {
    return `
// 整合測試
describe('整合測試', () => {
  // TODO: 添加整合測試
});
`;
  }

  private generateApiDocumentation(context: EditContext, analysis: CodeAnalysis): string {
    return `
/**
 * API 文檔
 * @description ${context.userRequirement}
 */
`;
  }

  private initializeStepTemplates(): void {
    // 初始化步驟模板
    // 這裡可以添加預定義的步驟模板
  }
}

/**
 * 代碼分析結果
 */
interface CodeAnalysis {
  workspaceRoot: vscode.Uri;
  language: string;
  framework?: string;
  needsNewFile: boolean;
  suggestedFileName: string;
  requiredImports: string[];
  hasIntegrationPoints: boolean;
  complexity: 'low' | 'medium' | 'high';
}
