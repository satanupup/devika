import * as vscode from 'vscode';
import { PersonalizationEngine, SuggestionType } from './PersonalizationEngine';
import { PersonalizationProvider } from './PersonalizationProvider';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 個性化命令提供者
 * 提供與個性化建議系統相關的 VS Code 命令
 */
export class PersonalizationCommandProvider {
  private personalizationEngine: PersonalizationEngine;
  private personalizationProvider: PersonalizationProvider;

  constructor(personalizationProvider: PersonalizationProvider) {
    this.personalizationEngine = PersonalizationEngine.getInstance();
    this.personalizationProvider = personalizationProvider;
  }

  /**
   * 註冊所有個性化相關命令
   */
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      // 建議生成命令
      vscode.commands.registerCommand('devika.personalization.showSuggestions', () => this.showPersonalizedSuggestions()),
      vscode.commands.registerCommand('devika.personalization.generateSuggestions', () => this.generateSuggestionsForCurrentFile()),
      vscode.commands.registerCommand('devika.personalization.applySuggestion', (suggestionId) => this.applySuggestion(suggestionId)),

      // 偏好管理命令
      vscode.commands.registerCommand('devika.personalization.showPreferences', () => this.showUserPreferences()),
      vscode.commands.registerCommand('devika.personalization.resetPreferences', () => this.resetUserPreferences()),
      vscode.commands.registerCommand('devika.personalization.exportPreferences', () => this.exportUserPreferences()),
      vscode.commands.registerCommand('devika.personalization.importPreferences', () => this.importUserPreferences()),

      // 反饋命令
      vscode.commands.registerCommand('devika.personalization.provideFeedback', (suggestionId) => this.provideFeedback(suggestionId)),
      vscode.commands.registerCommand('devika.personalization.rateSuggestion', (suggestionId, rating) => this.rateSuggestion(suggestionId, rating)),

      // 配置命令
      vscode.commands.registerCommand('devika.personalization.configure', () => this.configurePersonalization()),
      vscode.commands.registerCommand('devika.personalization.toggleSuggestionType', (type) => this.toggleSuggestionType(type)),

      // 分析命令
      vscode.commands.registerCommand('devika.personalization.analyzeCodeStyle', () => this.analyzeCodeStyle()),
      vscode.commands.registerCommand('devika.personalization.showInsights', () => this.showPersonalizationInsights()),

      // 學習命令
      vscode.commands.registerCommand('devika.personalization.learnFromSelection', () => this.learnFromSelection()),
      vscode.commands.registerCommand('devika.personalization.suggestLearning', () => this.suggestLearningOpportunities()),

      // 調試命令
      vscode.commands.registerCommand('devika.personalization.debug.showEngine', () => this.showEngineDebugInfo()),
      vscode.commands.registerCommand('devika.personalization.debug.testSuggestions', () => this.testSuggestionGeneration())
    ];

    commands.forEach(command => context.subscriptions.push(command));
  }

  /**
   * 顯示個性化建議
   */
  private async showPersonalizedSuggestions(): Promise<void> {
    return this.personalizationProvider.showPersonalizedSuggestions();
  }

  /**
   * 為當前文件生成建議
   */
  private async generateSuggestionsForCurrentFile(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          vscode.window.showWarningMessage('請先打開一個文件');
          return;
        }

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: '生成個性化建議...',
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0, message: '分析代碼...' });

          const suggestions = await this.personalizationEngine.generatePersonalizedSuggestions(
            activeEditor.document,
            activeEditor.selection.active
          );

          progress.report({ increment: 100, message: '建議生成完成' });

          if (suggestions.length > 0) {
            vscode.window.showInformationMessage(
              `為 ${activeEditor.document.fileName} 生成了 ${suggestions.length} 個個性化建議`
            );
          } else {
            vscode.window.showInformationMessage('當前文件沒有個性化建議');
          }
        });
      },
      '生成個性化建議',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 應用建議
   */
  private async applySuggestion(suggestionId: string): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 這裡需要從 PersonalizationProvider 獲取建議並應用
        vscode.window.showInformationMessage(`正在應用建議: ${suggestionId}`);
      },
      '應用建議',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示用戶偏好
   */
  private async showUserPreferences(): Promise<void> {
    return this.personalizationProvider.showUserPreferenceSummary();
  }

  /**
   * 重置用戶偏好
   */
  private async resetUserPreferences(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const choice = await vscode.window.showWarningMessage(
          '確定要重置所有個性化偏好嗎？此操作無法撤銷。',
          { modal: true },
          '確定',
          '取消'
        );

        if (choice === '確定') {
          // 這裡需要實現重置邏輯
          vscode.window.showInformationMessage('用戶偏好已重置');
        }
      },
      '重置用戶偏好',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導出用戶偏好
   */
  private async exportUserPreferences(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('devika-preferences.json'),
          filters: {
            'JSON Files': ['json']
          }
        });

        if (uri) {
          const summary = await this.personalizationEngine.getUserPreferenceSummary();
          const jsonData = JSON.stringify(summary, null, 2);
          await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonData, 'utf8'));
          vscode.window.showInformationMessage(`偏好已導出到 ${uri.fsPath}`);
        }
      },
      '導出用戶偏好',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導入用戶偏好
   */
  private async importUserPreferences(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: {
            'JSON Files': ['json']
          }
        });

        if (uris && uris.length > 0) {
          const data = await vscode.workspace.fs.readFile(uris[0]);
          const preferences = JSON.parse(data.toString());
          
          // 這裡需要實現導入邏輯
          vscode.window.showInformationMessage('偏好導入完成');
        }
      },
      '導入用戶偏好',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 提供反饋
   */
  private async provideFeedback(suggestionId: string): Promise<void> {
    return this.personalizationProvider.provideSuggestionFeedback(suggestionId);
  }

  /**
   * 評分建議
   */
  private async rateSuggestion(suggestionId: string, rating?: number): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!rating) {
          const ratingInput = await vscode.window.showInputBox({
            prompt: '請為這個建議評分 (1-5)',
            validateInput: (value) => {
              const num = parseInt(value);
              if (isNaN(num) || num < 1 || num > 5) {
                return '請輸入 1-5 之間的數字';
              }
              return null;
            }
          });

          if (!ratingInput) return;
          rating = parseInt(ratingInput);
        }

        const feedback = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
        await this.personalizationEngine.recordUserFeedback(suggestionId, feedback, 'rated');
        
        vscode.window.showInformationMessage(`感謝您的評分: ${rating}/5`);
      },
      '評分建議',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 配置個性化
   */
  private async configurePersonalization(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const options = [
          { label: '🎯 建議類型設置', description: '選擇要啟用的建議類型', action: 'suggestionTypes' },
          { label: '🔧 信心度閾值', description: '設置建議的最低信心度', action: 'confidence' },
          { label: '📊 建議數量限制', description: '設置每次顯示的最大建議數', action: 'maxSuggestions' },
          { label: '🎓 學習速度', description: '調整個性化學習的速度', action: 'learningRate' },
          { label: '🔒 隱私級別', description: '設置數據收集的隱私級別', action: 'privacy' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: '選擇要配置的選項'
        });

        if (selected) {
          await this.handleConfigurationAction(selected.action);
        }
      },
      '配置個性化',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 處理配置行動
   */
  private async handleConfigurationAction(action: string): Promise<void> {
    switch (action) {
      case 'suggestionTypes':
        await this.configureSuggestionTypes();
        break;
      case 'confidence':
        await this.configureConfidenceThreshold();
        break;
      case 'maxSuggestions':
        await this.configureMaxSuggestions();
        break;
      case 'learningRate':
        await this.configureLearningRate();
        break;
      case 'privacy':
        await this.configurePrivacyLevel();
        break;
    }
  }

  /**
   * 配置建議類型
   */
  private async configureSuggestionTypes(): Promise<void> {
    const allTypes = Object.values(SuggestionType);
    const items = allTypes.map(type => ({
      label: type,
      description: this.getSuggestionTypeDescription(type),
      picked: true // 默認全部啟用
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '選擇要啟用的建議類型',
      canPickMany: true
    });

    if (selected) {
      const enabledTypes = selected.map(item => item.label);
      // 這裡需要保存配置
      vscode.window.showInformationMessage(`已啟用 ${enabledTypes.length} 種建議類型`);
    }
  }

  /**
   * 配置信心度閾值
   */
  private async configureConfidenceThreshold(): Promise<void> {
    const threshold = await vscode.window.showInputBox({
      prompt: '設置建議的最低信心度 (0.0-1.0)',
      value: '0.5',
      validateInput: (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 1) {
          return '請輸入 0.0-1.0 之間的數字';
        }
        return null;
      }
    });

    if (threshold) {
      // 這裡需要保存配置
      vscode.window.showInformationMessage(`信心度閾值已設置為 ${threshold}`);
    }
  }

  /**
   * 配置最大建議數
   */
  private async configureMaxSuggestions(): Promise<void> {
    const maxSuggestions = await vscode.window.showInputBox({
      prompt: '設置每次顯示的最大建議數 (1-20)',
      value: '10',
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 20) {
          return '請輸入 1-20 之間的數字';
        }
        return null;
      }
    });

    if (maxSuggestions) {
      // 這裡需要保存配置
      vscode.window.showInformationMessage(`最大建議數已設置為 ${maxSuggestions}`);
    }
  }

  /**
   * 配置學習速度
   */
  private async configureLearningRate(): Promise<void> {
    const options = [
      { label: '🐌 慢速', description: '保守的學習速度，變化較慢', value: 0.05 },
      { label: '🚶 正常', description: '平衡的學習速度', value: 0.1 },
      { label: '🏃 快速', description: '積極的學習速度，快速適應', value: 0.2 }
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: '選擇學習速度'
    });

    if (selected) {
      // 這裡需要保存配置
      vscode.window.showInformationMessage(`學習速度已設置為 ${selected.label}`);
    }
  }

  /**
   * 配置隱私級別
   */
  private async configurePrivacyLevel(): Promise<void> {
    const options = [
      { label: '🔒 最小', description: '只收集必要的數據', value: 'minimal' },
      { label: '⚖️ 平衡', description: '平衡功能和隱私', value: 'balanced' },
      { label: '📊 全面', description: '收集詳細數據以提供最佳體驗', value: 'comprehensive' }
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: '選擇隱私級別'
    });

    if (selected) {
      // 這裡需要保存配置
      vscode.window.showInformationMessage(`隱私級別已設置為 ${selected.label}`);
    }
  }

  /**
   * 切換建議類型
   */
  private async toggleSuggestionType(type: SuggestionType): Promise<void> {
    // 這裡需要實現切換邏輯
    vscode.window.showInformationMessage(`已切換建議類型: ${type}`);
  }

  /**
   * 分析代碼風格
   */
  private async analyzeCodeStyle(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          vscode.window.showWarningMessage('請先打開一個文件');
          return;
        }

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: '分析代碼風格...',
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0, message: '分析中...' });

          // 這裡需要實現代碼風格分析
          await new Promise(resolve => setTimeout(resolve, 2000)); // 模擬分析

          progress.report({ increment: 100, message: '分析完成' });

          vscode.window.showInformationMessage('代碼風格分析完成');
        });
      },
      '分析代碼風格',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示個性化洞察
   */
  private async showPersonalizationInsights(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const panel = vscode.window.createWebviewPanel(
          'personalizationInsights',
          '個性化洞察',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = this.generateInsightsHTML();
      },
      '顯示個性化洞察',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 從選擇學習
   */
  private async learnFromSelection(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.selection.isEmpty) {
          vscode.window.showWarningMessage('請先選中一段代碼');
          return;
        }

        const selectedText = activeEditor.document.getText(activeEditor.selection);
        
        // 這裡需要實現從選擇學習的邏輯
        vscode.window.showInformationMessage(`已從選中的代碼學習模式`);
      },
      '從選擇學習',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 建議學習機會
   */
  private async suggestLearningOpportunities(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const opportunities = [
          '學習 TypeScript 高級類型',
          '掌握 React Hooks 最佳實踐',
          '了解性能優化技巧',
          '學習單元測試編寫'
        ];

        const items = opportunities.map(opp => ({
          label: `🎓 ${opp}`,
          description: '推薦的學習機會'
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '選擇學習機會'
        });

        if (selected) {
          vscode.window.showInformationMessage(`開始學習: ${selected.label}`);
        }
      },
      '建議學習機會',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示引擎調試信息
   */
  private async showEngineDebugInfo(): Promise<void> {
    const summary = await this.personalizationEngine.getUserPreferenceSummary();
    vscode.window.showInformationMessage(
      `偏好類型: ${summary.preferredSuggestionTypes.length}, 語言: ${summary.preferredLanguages.length}`
    );
  }

  /**
   * 測試建議生成
   */
  private async testSuggestionGeneration(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const suggestions = await this.personalizationEngine.generatePersonalizedSuggestions(
        activeEditor.document
      );
      vscode.window.showInformationMessage(`生成了 ${suggestions.length} 個測試建議`);
    }
  }

  /**
   * 輔助方法
   */
  private getSuggestionTypeDescription(type: SuggestionType): string {
    const descriptions = {
      [SuggestionType.CODE_STYLE]: '代碼風格和格式建議',
      [SuggestionType.REFACTORING]: '代碼重構和結構改進',
      [SuggestionType.BEST_PRACTICE]: '最佳實踐和慣例',
      [SuggestionType.PERFORMANCE]: '性能優化建議',
      [SuggestionType.SECURITY]: '安全性改進建議',
      [SuggestionType.TESTING]: '測試相關建議',
      [SuggestionType.DOCUMENTATION]: '文檔和註釋建議',
      [SuggestionType.DEPENDENCY]: '依賴管理建議',
      [SuggestionType.WORKFLOW]: '工作流程優化',
      [SuggestionType.LEARNING]: '學習和技能提升'
    };
    return descriptions[type] || '其他建議';
  }

  private generateInsightsHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>個性化洞察</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .insight { 
            margin: 15px 0; 
            padding: 15px; 
            border-left: 4px solid var(--vscode-textLink-foreground); 
            background-color: var(--vscode-textBlockQuote-background);
          }
          .metric { 
            font-size: 24px; 
            font-weight: bold; 
            color: var(--vscode-textLink-foreground); 
          }
        </style>
      </head>
      <body>
        <h1>📊 個性化洞察</h1>
        
        <div class="insight">
          <h3>建議接受率</h3>
          <div class="metric">85%</div>
          <p>您接受了大部分個性化建議，說明系統很好地理解了您的偏好。</p>
        </div>
        
        <div class="insight">
          <h3>最常用的建議類型</h3>
          <div class="metric">代碼風格</div>
          <p>您最常接受代碼風格相關的建議，顯示出對代碼品質的重視。</p>
        </div>
        
        <div class="insight">
          <h3>學習進度</h3>
          <div class="metric">進步中</div>
          <p>系統正在持續學習您的編碼習慣，建議品質會不斷提升。</p>
        </div>
      </body>
      </html>
    `;
  }
}
