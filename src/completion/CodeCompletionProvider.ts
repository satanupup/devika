import * as vscode from 'vscode';
import { CodeCompletionEngine } from './CodeCompletionEngine';
import { SnippetManager } from './SnippetManager';
import { SmartSuggestionGenerator } from './SmartSuggestionGenerator';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 代碼完成提供者
 * 整合所有代碼完成功能的主要提供者
 */
export class CodeCompletionProvider implements vscode.CompletionItemProvider, vscode.Disposable {
  private completionEngine: CodeCompletionEngine;
  private snippetManager: SnippetManager;
  private smartSuggestionGenerator: SmartSuggestionGenerator;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.completionEngine = CodeCompletionEngine.getInstance(context);
    this.snippetManager = SnippetManager.getInstance();
    this.smartSuggestionGenerator = SmartSuggestionGenerator.getInstance(context);
  }

  /**
   * 註冊代碼完成提供者
   */
  static register(context: vscode.ExtensionContext): CodeCompletionProvider {
    const provider = new CodeCompletionProvider(context);

    // 註冊完成提供者
    const completionProvider = vscode.languages.registerCompletionItemProvider(
      [
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'python' },
        { scheme: 'file', language: 'java' },
        { scheme: 'file', language: 'csharp' },
        { scheme: 'file', language: 'go' },
        { scheme: 'file', language: 'rust' },
        { scheme: 'file', language: 'php' },
        { scheme: 'file', language: 'ruby' },
        { scheme: 'file', language: 'cpp' },
        { scheme: 'file', language: 'c' }
      ],
      provider,
      '.', // 觸發字符
      ':', // 類型註解
      '(', // 函數調用
      '[', // 數組訪問
      '"', // 字符串
      "'", // 字符串
      '/', // 路徑
      '@', // 裝飾器
      '#', // 註釋
      ' '  // 空格
    );

    provider.disposables.push(completionProvider);
    context.subscriptions.push(provider);

    // 註冊完成使用監聽器
    provider.registerCompletionUsageListener();

    // 註冊命令
    provider.registerCommands(context);

    return provider;
  }

  /**
   * 提供完成項目
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 檢查是否應該提供完成
        if (!this.shouldProvideCompletion(document, position, context)) {
          return [];
        }

        // 使用主要的完成引擎
        const completions = await this.completionEngine.provideCompletionItems(
          document,
          position,
          token,
          context
        );

        // 轉換為數組格式
        const completionItems = Array.isArray(completions) ? completions : completions.items;

        // 添加性能監控
        this.trackCompletionPerformance(completionItems.length);

        return completionItems;
      },
      '提供代碼完成',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 解析完成項目
   */
  async resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        return await this.completionEngine.resolveCompletionItem(item, token);
      },
      '解析完成項目',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : item);
  }

  /**
   * 手動觸發智能建議
   */
  async triggerSmartSuggestions(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('沒有活躍的編輯器');
      return;
    }

    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 手動觸發完成
        await vscode.commands.executeCommand('editor.action.triggerSuggest');

        vscode.window.showInformationMessage('智能建議已觸發');
      },
      '觸發智能建議',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 添加自定義代碼片段
   */
  async addCustomSnippet(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 獲取用戶輸入
        const name = await vscode.window.showInputBox({
          prompt: '輸入代碼片段名稱',
          placeHolder: '例如: My Custom Function'
        });

        if (!name) {return;}

        const prefix = await vscode.window.showInputBox({
          prompt: '輸入觸發前綴',
          placeHolder: '例如: mycustom'
        });

        if (!prefix) {return;}

        const description = await vscode.window.showInputBox({
          prompt: '輸入描述（可選）',
          placeHolder: '描述這個代碼片段的用途'
        });

        const body = await vscode.window.showInputBox({
          prompt: '輸入代碼片段內容',
          placeHolder: '使用 ${1:placeholder} 語法添加佔位符'
        });

        if (!body) {return;}

        // 獲取當前語言
        const editor = vscode.window.activeTextEditor;
        const language = editor?.document.languageId || 'javascript';

        // 添加代碼片段
        const snippetId = await this.snippetManager.addUserSnippet({
          name,
          prefix,
          body: body.split('\\n'),
          description: description || '',
          scope: [language],
          category: 'user',
          tags: ['custom', 'user-defined']
        });

        if (snippetId) {
          vscode.window.showInformationMessage(`代碼片段 "${name}" 已添加`);
        } else {
          vscode.window.showErrorMessage('添加代碼片段失敗');
        }
      },
      '添加自定義代碼片段',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 管理代碼片段
   */
  async manageSnippets(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const editor = vscode.window.activeTextEditor;
        const language = editor?.document.languageId || 'javascript';

        // 獲取當前語言的代碼片段
        const snippets = this.snippetManager.getLanguageSnippets(language);

        if (snippets.length === 0) {
          vscode.window.showInformationMessage('沒有找到代碼片段');
          return;
        }

        // 創建快速選擇項目
        const quickPickItems = snippets.map(snippet => ({
          label: snippet.prefix,
          description: snippet.name,
          detail: snippet.description,
          snippet
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
          placeHolder: '選擇要管理的代碼片段',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          await this.showSnippetActions(selected.snippet);
        }
      },
      '管理代碼片段',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示完成統計
   */
  async showCompletionStatistics(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const stats = this.completionEngine.getStatistics();

        const message = `
代碼完成統計
============
總完成次數: ${stats.totalCompletions}
快取大小: ${stats.cacheSize}
最近完成: ${stats.recentCompletions}
        `.trim();

        vscode.window.showInformationMessage(message);
      },
      '顯示完成統計',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 清除完成快取
   */
  async clearCompletionCache(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        this.completionEngine.clearCache();
        vscode.window.showInformationMessage('代碼完成快取已清除');
      },
      '清除完成快取',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 配置代碼完成
   */
  async configureCompletion(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'devika.completion');
  }

  /**
   * 私有方法
   */
  private shouldProvideCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.CompletionContext
  ): boolean {
    // 檢查文件類型
    const config = vscode.workspace.getConfiguration('devika.completion');
    const supportedLanguages: string[] = config.get('languages', []);

    if (supportedLanguages.length > 0 && !supportedLanguages.includes(document.languageId)) {
      return false;
    }

    // 檢查排除模式
    const excludePatterns = config.get('excludePatterns', []);
    const filePath = document.uri.fsPath;

    for (const pattern of excludePatterns) {
      if (filePath.includes(pattern)) {
        return false;
      }
    }

    // 檢查是否在註釋中
    const line = document.lineAt(position);
    const linePrefix = line.text.substring(0, position.character);

    if (this.isInComment(linePrefix) && !config.get('enableInComments', false)) {
      return false;
    }

    return true;
  }

  private isInComment(linePrefix: string): boolean {
    return /\/\/|\/\*|\*|#/.test(linePrefix.trim());
  }

  private registerCompletionUsageListener(): void {
    // 監聽文檔變更以記錄完成使用
    const disposable = vscode.workspace.onDidChangeTextDocument(event => {
      // 簡化的使用記錄邏輯
      // 在實際實現中需要更複雜的邏輯來檢測完成使用
    });

    this.disposables.push(disposable);
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      vscode.commands.registerCommand('devika.completion.triggerSmart', () => this.triggerSmartSuggestions()),
      vscode.commands.registerCommand('devika.completion.addSnippet', () => this.addCustomSnippet()),
      vscode.commands.registerCommand('devika.completion.manageSnippets', () => this.manageSnippets()),
      vscode.commands.registerCommand('devika.completion.showStatistics', () => this.showCompletionStatistics()),
      vscode.commands.registerCommand('devika.completion.clearCache', () => this.clearCompletionCache()),
      vscode.commands.registerCommand('devika.completion.configure', () => this.configureCompletion())
    ];

    commands.forEach(command => {
      this.disposables.push(command);
      context.subscriptions.push(command);
    });
  }

  private async showSnippetActions(snippet: any): Promise<void> {
    const actions = [
      { label: '$(eye) 預覽', action: 'preview' },
      { label: '$(edit) 編輯', action: 'edit' },
      { label: '$(trash) 刪除', action: 'delete' },
      { label: '$(copy) 複製', action: 'copy' }
    ];

    const selected = await vscode.window.showQuickPick(actions, {
      placeHolder: `選擇對 "${snippet.name}" 的操作`
    });

    if (selected) {
      switch (selected.action) {
        case 'preview':
          await this.previewSnippet(snippet);
          break;
        case 'edit':
          await this.editSnippet(snippet);
          break;
        case 'delete':
          await this.deleteSnippet(snippet);
          break;
        case 'copy':
          await this.copySnippet(snippet);
          break;
      }
    }
  }

  private async previewSnippet(snippet: any): Promise<void> {
    const content = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;

    const document = await vscode.workspace.openTextDocument({
      content,
      language: snippet.scope[0] || 'plaintext'
    });

    await vscode.window.showTextDocument(document, { preview: true });
  }

  private async editSnippet(snippet: any): Promise<void> {
    vscode.window.showInformationMessage('編輯代碼片段功能即將推出');
  }

  private async deleteSnippet(snippet: any): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `確定要刪除代碼片段 "${snippet.name}" 嗎？`,
      { modal: true },
      '刪除'
    );

    if (confirm === '刪除') {
      const success = await this.snippetManager.removeUserSnippet(snippet.id);
      if (success) {
        vscode.window.showInformationMessage(`代碼片段 "${snippet.name}" 已刪除`);
      } else {
        vscode.window.showErrorMessage('刪除代碼片段失敗');
      }
    }
  }

  private async copySnippet(snippet: any): Promise<void> {
    const content = Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body;
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage('代碼片段已複製到剪貼板');
  }

  private trackCompletionPerformance(completionCount: number): void {
    // 簡化的性能追蹤
    if (completionCount > 100) {
      console.warn(`代碼完成項目數量過多: ${completionCount}`);
    }
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];

    this.completionEngine.dispose();
    this.snippetManager.dispose();
    this.smartSuggestionGenerator.dispose();
  }
}
