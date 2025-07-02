import * as vscode from 'vscode';
import { ConversationMemoryManager, ConversationType } from './ConversationMemoryManager';
import { ConversationContextAnalyzer } from './ConversationContextAnalyzer';
import { ConversationPersistenceManager, ExportOptions } from './ConversationPersistenceManager';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 對話命令提供者
 * 提供與對話記憶系統相關的 VS Code 命令
 */
export class ConversationCommandProvider {
  private memoryManager: ConversationMemoryManager;
  private contextAnalyzer: ConversationContextAnalyzer;
  private persistenceManager: ConversationPersistenceManager;

  constructor() {
    this.memoryManager = ConversationMemoryManager.getInstance();
    this.contextAnalyzer = ConversationContextAnalyzer.getInstance();
    this.persistenceManager = ConversationPersistenceManager.getInstance();
  }

  /**
   * 註冊所有對話記憶相關命令
   */
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      // 會話管理命令
      vscode.commands.registerCommand('devika.conversation.startNew', () => this.startNewConversation()),
      vscode.commands.registerCommand('devika.conversation.endCurrent', () => this.endCurrentConversation()),
      vscode.commands.registerCommand('devika.conversation.resumeSession', () => this.resumeConversation()),
      vscode.commands.registerCommand('devika.conversation.switchSession', () => this.switchConversation()),

      // 記憶檢索命令
      vscode.commands.registerCommand('devika.conversation.searchMemory', () => this.searchConversationMemory()),
      vscode.commands.registerCommand('devika.conversation.getRelevantContext', () => this.getRelevantContext()),
      vscode.commands.registerCommand('devika.conversation.showHistory', () => this.showConversationHistory()),

      // 上下文分析命令
      vscode.commands.registerCommand('devika.conversation.analyzeContext', () => this.analyzeCurrentContext()),
      vscode.commands.registerCommand('devika.conversation.predictNextAction', () => this.predictNextAction()),
      vscode.commands.registerCommand('devika.conversation.identifyPattern', () => this.identifyConversationPattern()),

      // 數據管理命令
      vscode.commands.registerCommand('devika.conversation.exportData', () => this.exportConversationData()),
      vscode.commands.registerCommand('devika.conversation.importData', () => this.importConversationData()),
      vscode.commands.registerCommand('devika.conversation.createBackup', () => this.createBackup()),
      vscode.commands.registerCommand('devika.conversation.restoreBackup', () => this.restoreFromBackup()),
      vscode.commands.registerCommand('devika.conversation.showStats', () => this.showStorageStats()),
      vscode.commands.registerCommand('devika.conversation.cleanup', () => this.cleanupConversations()),

      // 調試命令
      vscode.commands.registerCommand('devika.conversation.debug.showCurrentSession', () => this.showCurrentSession()),
      vscode.commands.registerCommand('devika.conversation.debug.testMemoryRetrieval', () => this.testMemoryRetrieval())
    ];

    commands.forEach(command => context.subscriptions.push(command));
  }

  /**
   * 開始新對話
   */
  private async startNewConversation(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const typeOptions = [
          { label: '💬 一般聊天', description: '普通對話交流', value: ConversationType.CHAT },
          { label: '🔍 代碼審查', description: '代碼審查和建議', value: ConversationType.CODE_REVIEW },
          { label: '🐛 調試幫助', description: '調試和問題解決', value: ConversationType.DEBUGGING },
          { label: '🔧 代碼重構', description: '代碼重構和優化', value: ConversationType.REFACTORING },
          { label: '📚 學習輔導', description: '學習新技術和概念', value: ConversationType.LEARNING },
          { label: '📋 項目規劃', description: '項目規劃和設計', value: ConversationType.PLANNING }
        ];

        const selectedType = await vscode.window.showQuickPick(typeOptions, {
          placeHolder: '選擇對話類型',
          matchOnDescription: true
        });

        if (!selectedType) {
          return;
        }

        const title = await vscode.window.showInputBox({
          prompt: '輸入對話標題（可選）',
          placeHolder: '留空將自動生成標題'
        });

        const sessionId = await this.memoryManager.startNewSession(
          selectedType.value,
          title || undefined
        );

        vscode.window.showInformationMessage(`新對話已開始: ${sessionId}`);
      },
      '開始新對話',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 結束當前對話
   */
  private async endCurrentConversation(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const currentSession = this.memoryManager.getCurrentSession();
        if (!currentSession) {
          vscode.window.showWarningMessage('沒有活躍的對話會話');
          return;
        }

        const summary = await vscode.window.showInputBox({
          prompt: '輸入對話摘要（可選）',
          placeHolder: '留空將自動生成摘要'
        });

        await this.memoryManager.endSession(currentSession.id, summary || undefined);
        vscode.window.showInformationMessage('對話已結束');
      },
      '結束當前對話',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 恢復對話
   */
  private async resumeConversation(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const history = this.memoryManager.getSessionHistory(20);
        
        if (history.length === 0) {
          vscode.window.showInformationMessage('沒有可恢復的對話');
          return;
        }

        const items = history.map(session => ({
          label: session.title,
          description: `${session.type} | ${session.messages.length} 條消息`,
          detail: `最後活動: ${session.lastActivity.toLocaleString()}`,
          sessionId: session.id
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '選擇要恢復的對話',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          const success = await this.memoryManager.resumeSession(selected.sessionId);
          if (success) {
            vscode.window.showInformationMessage(`對話已恢復: ${selected.label}`);
          } else {
            vscode.window.showErrorMessage('恢復對話失敗');
          }
        }
      },
      '恢復對話',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 切換對話
   */
  private async switchConversation(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 獲取所有活躍會話
        const currentSession = this.memoryManager.getCurrentSession();
        // 這裡需要從 ConversationMemoryManager 獲取活躍會話列表
        // 由於當前實現中沒有公開方法，我們使用歷史記錄作為替代
        
        const history = this.memoryManager.getSessionHistory(10);
        
        if (history.length === 0) {
          vscode.window.showInformationMessage('沒有可切換的對話');
          return;
        }

        const items = history.map(session => ({
          label: session.title,
          description: `${session.type} | ${session.messages.length} 條消息`,
          detail: session.id === currentSession?.id ? '(當前會話)' : `最後活動: ${session.lastActivity.toLocaleString()}`,
          sessionId: session.id
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '選擇要切換到的對話',
          matchOnDescription: true
        });

        if (selected && selected.sessionId !== currentSession?.id) {
          const success = await this.memoryManager.resumeSession(selected.sessionId);
          if (success) {
            vscode.window.showInformationMessage(`已切換到對話: ${selected.label}`);
          }
        }
      },
      '切換對話',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 搜索對話記憶
   */
  private async searchConversationMemory(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const query = await vscode.window.showInputBox({
          prompt: '輸入搜索關鍵詞',
          placeHolder: '搜索對話內容、標題或標籤'
        });

        if (!query) {
          return;
        }

        const results = await this.memoryManager.searchConversations(query);
        
        if (results.length === 0) {
          vscode.window.showInformationMessage('沒有找到相關對話');
          return;
        }

        const items = results.map(session => ({
          label: session.title,
          description: `${session.type} | ${session.messages.length} 條消息`,
          detail: `${session.startTime.toLocaleDateString()} | 標籤: ${session.tags.join(', ')}`,
          session
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `找到 ${results.length} 個相關對話`,
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          await this.showSessionDetails(selected.session);
        }
      },
      '搜索對話記憶',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 獲取相關上下文
   */
  private async getRelevantContext(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('請先打開一個文件');
          return;
        }

        const selectedText = editor.document.getText(editor.selection);
        const query = selectedText || await vscode.window.showInputBox({
          prompt: '輸入查詢內容',
          placeHolder: '描述您需要的上下文信息'
        });

        if (!query) {
          return;
        }

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: '檢索相關上下文...',
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 0, message: '分析查詢...' });

          const result = await this.memoryManager.getRelevantMemory(query);

          progress.report({ increment: 100, message: '檢索完成' });

          await this.showMemoryRetrievalResult(result);
        });
      },
      '獲取相關上下文',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示對話歷史
   */
  private async showConversationHistory(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const history = this.memoryManager.getSessionHistory(50);
        
        if (history.length === 0) {
          vscode.window.showInformationMessage('沒有對話歷史');
          return;
        }

        // 創建 WebView 顯示歷史
        const panel = vscode.window.createWebviewPanel(
          'conversationHistory',
          '對話歷史',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = this.generateHistoryHTML(history);
      },
      '顯示對話歷史',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 分析當前上下文
   */
  private async analyzeCurrentContext(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const currentSession = this.memoryManager.getCurrentSession();
        if (!currentSession) {
          vscode.window.showWarningMessage('沒有活躍的對話會話');
          return;
        }

        const context = await this.contextAnalyzer.analyzeSessionContext(currentSession);
        await this.showContextAnalysis(context);
      },
      '分析當前上下文',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 預測下一步行動
   */
  private async predictNextAction(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const currentSession = this.memoryManager.getCurrentSession();
        if (!currentSession) {
          vscode.window.showWarningMessage('沒有活躍的對話會話');
          return;
        }

        const actions = await this.contextAnalyzer.predictNextAction(currentSession);
        
        if (actions.length === 0) {
          vscode.window.showInformationMessage('無法預測下一步行動');
          return;
        }

        const items = actions.map(action => ({
          label: action,
          description: '建議的下一步行動'
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '選擇要執行的行動',
          canPickMany: false
        });

        if (selected) {
          vscode.window.showInformationMessage(`建議執行: ${selected.label}`);
        }
      },
      '預測下一步行動',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 識別對話模式
   */
  private async identifyConversationPattern(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const currentSession = this.memoryManager.getCurrentSession();
        if (!currentSession) {
          vscode.window.showWarningMessage('沒有活躍的對話會話');
          return;
        }

        const pattern = await this.contextAnalyzer.identifyConversationPattern(currentSession);
        
        if (pattern) {
          vscode.window.showInformationMessage(
            `識別到對話模式: ${pattern.name} - ${pattern.description}`
          );
        } else {
          vscode.window.showInformationMessage('未識別到特定的對話模式');
        }
      },
      '識別對話模式',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導出對話數據
   */
  private async exportConversationData(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const format = await vscode.window.showQuickPick([
          { label: 'JSON', description: '結構化數據格式', value: 'json' },
          { label: 'Markdown', description: '可讀的文檔格式', value: 'markdown' },
          { label: 'CSV', description: '表格數據格式', value: 'csv' }
        ], {
          placeHolder: '選擇導出格式'
        });

        if (!format) {
          return;
        }

        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`conversations.${format.value}`),
          filters: {
            [format.label]: [format.value]
          }
        });

        if (uri) {
          const options: ExportOptions = {
            format: format.value as any,
            includeSessions: [], // 導出所有會話
            includeMetadata: true,
            anonymize: false
          };

          await this.persistenceManager.exportConversations(uri.fsPath, options);
          vscode.window.showInformationMessage(`對話數據已導出到 ${uri.fsPath}`);
        }
      },
      '導出對話數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導入對話數據
   */
  private async importConversationData(): Promise<void> {
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
          const result = await this.persistenceManager.restoreFromBackup(uris[0].fsPath);
          
          if (result.success) {
            vscode.window.showInformationMessage(
              `導入完成: ${result.importedSessions} 個會話已導入，${result.skippedSessions} 個會話被跳過`
            );
          } else {
            vscode.window.showErrorMessage('導入失敗');
          }
        }
      },
      '導入對話數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 創建備份
   */
  private async createBackup(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const backupPath = await this.persistenceManager.createBackup();
        vscode.window.showInformationMessage(`備份已創建: ${backupPath}`);
      },
      '創建對話備份',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 從備份恢復
   */
  private async restoreFromBackup(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: {
            'Backup Files': ['json']
          }
        });

        if (uris && uris.length > 0) {
          const result = await this.persistenceManager.restoreFromBackup(uris[0].fsPath);
          
          if (result.success) {
            vscode.window.showInformationMessage(
              `恢復完成: ${result.importedSessions} 個會話已恢復`
            );
          } else {
            vscode.window.showErrorMessage('恢復失敗');
          }
        }
      },
      '從備份恢復',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示存儲統計
   */
  private async showStorageStats(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const stats = await this.persistenceManager.getStorageStats();
        
        const panel = vscode.window.createWebviewPanel(
          'conversationStats',
          '對話統計',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = this.generateStatsHTML(stats);
      },
      '顯示存儲統計',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 清理對話
   */
  private async cleanupConversations(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const choice = await vscode.window.showWarningMessage(
          '確定要清理過期的對話嗎？此操作無法撤銷。',
          { modal: true },
          '確定',
          '取消'
        );

        if (choice === '確定') {
          const deletedCount = await this.persistenceManager.cleanupExpiredSessions();
          vscode.window.showInformationMessage(`已清理 ${deletedCount} 個過期對話`);
        }
      },
      '清理對話',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示當前會話（調試用）
   */
  private async showCurrentSession(): Promise<void> {
    const currentSession = this.memoryManager.getCurrentSession();
    if (currentSession) {
      await this.showSessionDetails(currentSession);
    } else {
      vscode.window.showInformationMessage('沒有活躍的對話會話');
    }
  }

  /**
   * 測試記憶檢索（調試用）
   */
  private async testMemoryRetrieval(): Promise<void> {
    const query = await vscode.window.showInputBox({
      prompt: '輸入測試查詢',
      placeHolder: '測試記憶檢索功能'
    });

    if (query) {
      const result = await this.memoryManager.getRelevantMemory(query);
      await this.showMemoryRetrievalResult(result);
    }
  }

  /**
   * 輔助方法
   */
  private async showSessionDetails(session: any): Promise<void> {
    // 顯示會話詳情的實現
    vscode.window.showInformationMessage(`會話: ${session.title} (${session.messages.length} 條消息)`);
  }

  private async showMemoryRetrievalResult(result: any): Promise<void> {
    // 顯示記憶檢索結果的實現
    vscode.window.showInformationMessage(`檢索結果: 信心度 ${(result.confidence * 100).toFixed(1)}%`);
  }

  private async showContextAnalysis(context: any): Promise<void> {
    // 顯示上下文分析的實現
    vscode.window.showInformationMessage('上下文分析完成');
  }

  private generateHistoryHTML(history: any[]): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>對話歷史</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .session { margin: 20px 0; padding: 15px; border: 1px solid #ccc; border-radius: 5px; }
          .session-title { font-weight: bold; font-size: 18px; margin-bottom: 10px; }
          .session-meta { color: #666; font-size: 14px; margin-bottom: 10px; }
          .message-count { color: #007ACC; }
        </style>
      </head>
      <body>
        <h1>對話歷史</h1>
        ${history.map(session => `
          <div class="session">
            <div class="session-title">${session.title}</div>
            <div class="session-meta">
              類型: ${session.type} | 
              開始時間: ${session.startTime.toLocaleString()} | 
              <span class="message-count">${session.messages.length} 條消息</span>
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
  }

  private generateStatsHTML(stats: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>對話統計</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .stat-item { margin: 10px 0; }
          .stat-value { font-weight: bold; color: #007ACC; }
        </style>
      </head>
      <body>
        <h1>對話統計</h1>
        <div class="stat-item">總會話數: <span class="stat-value">${stats.totalSessions}</span></div>
        <div class="stat-item">總消息數: <span class="stat-value">${stats.totalMessages}</span></div>
        <div class="stat-item">平均會話長度: <span class="stat-value">${stats.averageSessionLength.toFixed(1)}</span></div>
        <div class="stat-item">存儲大小: <span class="stat-value">${(stats.totalSize / 1024).toFixed(1)} KB</span></div>
        <div class="stat-item">最早會話: <span class="stat-value">${stats.oldestSession.toLocaleDateString()}</span></div>
        <div class="stat-item">最新會話: <span class="stat-value">${stats.newestSession.toLocaleDateString()}</span></div>
      </body>
      </html>
    `;
  }
}
