import * as vscode from 'vscode';
import { LearningEngine, LearningEventType } from './LearningEngine';
import { PatternRecognizer } from './PatternRecognizer';
import { AdaptiveSuggestionSystem } from './AdaptiveSuggestionSystem';
import { LearningDataManager } from './LearningDataManager';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 學習命令提供者
 * 提供與持續學習機制相關的 VS Code 命令
 */
export class LearningCommandProvider {
  private learningEngine: LearningEngine;
  private patternRecognizer: PatternRecognizer;
  private adaptiveSuggestions: AdaptiveSuggestionSystem;
  private dataManager: LearningDataManager;

  constructor() {
    this.learningEngine = LearningEngine.getInstance();
    this.patternRecognizer = PatternRecognizer.getInstance();
    this.adaptiveSuggestions = AdaptiveSuggestionSystem.getInstance();
    this.dataManager = LearningDataManager.getInstance();
  }

  /**
   * 註冊所有學習相關命令
   */
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      // 學習控制命令
      vscode.commands.registerCommand('devika.learning.enable', () => this.enableLearning()),
      vscode.commands.registerCommand('devika.learning.disable', () => this.disableLearning()),
      vscode.commands.registerCommand('devika.learning.reset', () => this.resetLearning()),

      // 模式分析命令
      vscode.commands.registerCommand('devika.learning.analyzeCurrentFile', () => this.analyzeCurrentFile()),
      vscode.commands.registerCommand('devika.learning.analyzeSelection', () => this.analyzeSelection()),
      vscode.commands.registerCommand('devika.learning.showPatterns', () => this.showLearnedPatterns()),

      // 偏好管理命令
      vscode.commands.registerCommand('devika.learning.showPreferences', () => this.showUserPreferences()),
      vscode.commands.registerCommand('devika.learning.exportPreferences', () => this.exportPreferences()),
      vscode.commands.registerCommand('devika.learning.importPreferences', () => this.importPreferences()),

      // 建議系統命令
      vscode.commands.registerCommand('devika.learning.getSuggestions', () => this.getAdaptiveSuggestions()),
      vscode.commands.registerCommand('devika.learning.trainFromFeedback', () => this.trainFromFeedback()),

      // 數據管理命令
      vscode.commands.registerCommand('devika.learning.showStats', () => this.showLearningStats()),
      vscode.commands.registerCommand('devika.learning.exportData', () => this.exportLearningData()),
      vscode.commands.registerCommand('devika.learning.importData', () => this.importLearningData()),
      vscode.commands.registerCommand('devika.learning.backup', () => this.createBackup()),
      vscode.commands.registerCommand('devika.learning.cleanup', () => this.cleanupData()),

      // 調試命令
      vscode.commands.registerCommand('devika.learning.debug.showEvents', () => this.showRecentEvents()),
      vscode.commands.registerCommand('devika.learning.debug.testPattern', () => this.testPatternRecognition())
    ];

    commands.forEach(command => context.subscriptions.push(command));
  }

  /**
   * 啟用學習
   */
  private async enableLearning(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        this.learningEngine.setLearningEnabled(true);
        vscode.window.showInformationMessage('持續學習機制已啟用');
      },
      '啟用學習機制',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 禁用學習
   */
  private async disableLearning(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        this.learningEngine.setLearningEnabled(false);
        vscode.window.showInformationMessage('持續學習機制已禁用');
      },
      '禁用學習機制',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 重置學習數據
   */
  private async resetLearning(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const choice = await vscode.window.showWarningMessage(
          '確定要重置所有學習數據嗎？此操作無法撤銷。',
          { modal: true },
          '確定',
          '取消'
        );

        if (choice === '確定') {
          // 創建備份
          await this.dataManager.createBackup();
          
          // 清除數據
          this.learningEngine.clearLearningData();
          this.patternRecognizer.clearPatterns();
          
          vscode.window.showInformationMessage('學習數據已重置');
        }
      },
      '重置學習數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 分析當前文件
   */
  private async analyzeCurrentFile(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('請先打開一個文件');
          return;
        }

        const document = editor.document;
        const code = document.getText();
        const language = document.languageId;

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: '分析代碼模式...',
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0, message: '正在分析...' });

          const patterns = await this.patternRecognizer.analyzeCode(
            code,
            language,
            'file_analysis'
          );

          progress.report({ increment: 100, message: '分析完成' });

          if (patterns.length > 0) {
            const message = `發現 ${patterns.length} 個編碼模式`;
            const choice = await vscode.window.showInformationMessage(
              message,
              '查看詳情',
              '關閉'
            );

            if (choice === '查看詳情') {
              await this.showPatternDetails(patterns);
            }
          } else {
            vscode.window.showInformationMessage('未發現新的編碼模式');
          }
        });
      },
      '分析當前文件',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 分析選中代碼
   */
  private async analyzeSelection(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('請先打開一個文件');
          return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
          vscode.window.showWarningMessage('請先選中一段代碼');
          return;
        }

        const code = editor.document.getText(selection);
        const language = editor.document.languageId;

        const patterns = await this.patternRecognizer.analyzeCode(
          code,
          language,
          'selection_analysis'
        );

        if (patterns.length > 0) {
          await this.showPatternDetails(patterns);
        } else {
          vscode.window.showInformationMessage('選中的代碼中未發現特殊模式');
        }
      },
      '分析選中代碼',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示學習到的模式
   */
  private async showLearnedPatterns(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const patterns = this.learningEngine.getLearnedPatterns();
        
        if (patterns.length === 0) {
          vscode.window.showInformationMessage('尚未學習到任何編碼模式');
          return;
        }

        const items = patterns.map(pattern => ({
          label: pattern.name,
          description: `${pattern.language} | 信心度: ${(pattern.confidence * 100).toFixed(1)}%`,
          detail: `使用頻率: ${pattern.frequency} | 效果: ${(pattern.effectiveness * 100).toFixed(1)}%`,
          pattern
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '選擇要查看的模式',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          await this.showPatternDetail(selected.pattern);
        }
      },
      '顯示學習模式',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示用戶偏好
   */
  private async showUserPreferences(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const preferences = this.learningEngine.getUserPreferences();
        
        if (preferences.length === 0) {
          vscode.window.showInformationMessage('尚未識別到用戶偏好');
          return;
        }

        const items = preferences.map(pref => ({
          label: pref.name,
          description: `${pref.category} | 信心度: ${(pref.confidence * 100).toFixed(1)}%`,
          detail: `使用頻率: ${pref.frequency} | 上下文: ${pref.context.join(', ')}`,
          preference: pref
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '選擇要查看的偏好',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          await this.showPreferenceDetail(selected.preference);
        }
      },
      '顯示用戶偏好',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 獲取適應性建議
   */
  private async getAdaptiveSuggestions(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('請先打開一個文件');
          return;
        }

        const document = editor.document;
        const position = editor.selection.active;

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: '生成個性化建議...',
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0, message: '分析代碼...' });

          const suggestions = await this.adaptiveSuggestions.generateSuggestions(
            document,
            position
          );

          progress.report({ increment: 100, message: '建議生成完成' });

          if (suggestions.length > 0) {
            await this.showSuggestions(suggestions);
          } else {
            vscode.window.showInformationMessage('當前位置沒有適合的建議');
          }
        });
      },
      '獲取適應性建議',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示學習統計
   */
  private async showLearningStats(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const stats = this.learningEngine.getLearningStats();
        const dataStats = await this.dataManager.getDataStatistics();

        const panel = vscode.window.createWebviewPanel(
          'learningStats',
          '學習統計',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = this.generateStatsHTML(stats, dataStats);
      },
      '顯示學習統計',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導出學習數據
   */
  private async exportLearningData(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('learning-data.json'),
          filters: {
            'JSON Files': ['json']
          }
        });

        if (uri) {
          await this.dataManager.exportLearningData(uri.fsPath);
          vscode.window.showInformationMessage(`學習數據已導出到 ${uri.fsPath}`);
        }
      },
      '導出學習數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導入學習數據
   */
  private async importLearningData(): Promise<void> {
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
          const choice = await vscode.window.showQuickPick(
            ['合併數據', '替換數據'],
            { placeHolder: '選擇導入方式' }
          );

          if (choice) {
            const merge = choice === '合併數據';
            await this.dataManager.importLearningData(uris[0].fsPath, merge);
            vscode.window.showInformationMessage('學習數據導入完成');
          }
        }
      },
      '導入學習數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 創建備份
   */
  private async createBackup(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const backupPath = await this.dataManager.createBackup();
        vscode.window.showInformationMessage(`備份已創建: ${backupPath}`);
      },
      '創建學習數據備份',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 清理數據
   */
  private async cleanupData(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const options = await vscode.window.showQuickPick([
          { label: '清理舊事件', description: '移除 30 天前的學習事件', value: 'events' },
          { label: '清理未使用模式', description: '移除使用頻率低的模式', value: 'patterns' },
          { label: '清理低信心偏好', description: '移除信心度低的偏好', value: 'preferences' },
          { label: '全面清理', description: '執行所有清理操作', value: 'all' }
        ], {
          placeHolder: '選擇清理選項',
          canPickMany: true
        });

        if (options && options.length > 0) {
          const cleanupOptions = {
            removeOldEvents: options.some(o => o.value === 'events' || o.value === 'all'),
            removeUnusedPatterns: options.some(o => o.value === 'patterns' || o.value === 'all'),
            removeLowConfidencePreferences: options.some(o => o.value === 'preferences' || o.value === 'all'),
            daysToKeep: 30
          };

          await this.dataManager.cleanupLearningData(cleanupOptions);
          vscode.window.showInformationMessage('數據清理完成');
        }
      },
      '清理學習數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示最近事件（調試用）
   */
  private async showRecentEvents(): Promise<void> {
    // 調試功能實現
    vscode.window.showInformationMessage('調試功能：顯示最近學習事件');
  }

  /**
   * 測試模式識別（調試用）
   */
  private async testPatternRecognition(): Promise<void> {
    // 調試功能實現
    vscode.window.showInformationMessage('調試功能：測試模式識別');
  }

  /**
   * 輔助方法
   */
  private async showPatternDetails(patterns: any[]): Promise<void> {
    // 顯示模式詳情的實現
  }

  private async showPatternDetail(pattern: any): Promise<void> {
    // 顯示單個模式詳情的實現
  }

  private async showPreferenceDetail(preference: any): Promise<void> {
    // 顯示偏好詳情的實現
  }

  private async showSuggestions(suggestions: any[]): Promise<void> {
    // 顯示建議的實現
  }

  private generateStatsHTML(stats: any, dataStats: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>學習統計</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .stat-item { margin: 10px 0; }
          .stat-value { font-weight: bold; color: #007ACC; }
        </style>
      </head>
      <body>
        <h1>學習統計</h1>
        <div class="stat-item">總事件數: <span class="stat-value">${stats.totalEvents}</span></div>
        <div class="stat-item">學習模式數: <span class="stat-value">${stats.patternsLearned}</span></div>
        <div class="stat-item">用戶偏好數: <span class="stat-value">${stats.preferencesIdentified}</span></div>
        <div class="stat-item">平均信心度: <span class="stat-value">${(stats.averageConfidence * 100).toFixed(1)}%</span></div>
        <div class="stat-item">學習率: <span class="stat-value">${stats.learningRate.toFixed(2)} 事件/天</span></div>
        <div class="stat-item">數據文件大小: <span class="stat-value">${(dataStats.fileSize / 1024).toFixed(1)} KB</span></div>
        <div class="stat-item">備份數量: <span class="stat-value">${dataStats.backupsCount}</span></div>
      </body>
      </html>
    `;
  }

  private async exportPreferences(): Promise<void> {
    // 導出偏好的實現
  }

  private async importPreferences(): Promise<void> {
    // 導入偏好的實現
  }

  private async trainFromFeedback(): Promise<void> {
    // 從反饋訓練的實現
  }
}
