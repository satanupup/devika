import * as vscode from 'vscode';
import { PersonalizationEngine, PersonalizedSuggestion, SuggestionType } from './PersonalizationEngine';
import { SuggestionGenerator } from './SuggestionGenerator';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 建議項目
 */
interface SuggestionQuickPickItem extends vscode.QuickPickItem {
  suggestion: PersonalizedSuggestion;
}

/**
 * 個性化提供者
 * 整合個性化建議系統與 VS Code UI
 */
export class PersonalizationProvider implements vscode.CodeActionProvider, vscode.CompletionItemProvider {
  private personalizationEngine: PersonalizationEngine;
  private suggestionGenerator: SuggestionGenerator;
  private activeSuggestions: Map<string, PersonalizedSuggestion> = new Map();

  constructor() {
    this.personalizationEngine = PersonalizationEngine.getInstance();
    this.suggestionGenerator = SuggestionGenerator.getInstance();
  }

  /**
   * 提供代碼行動建議
   */
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const suggestions = await this.personalizationEngine.generatePersonalizedSuggestions(
          document,
          range.start
        );

        const codeActions: vscode.CodeAction[] = [];

        for (const suggestion of suggestions) {
          if (suggestion.actionable) {
            const codeAction = this.createCodeAction(suggestion, document, range);
            if (codeAction) {
              codeActions.push(codeAction);
            }
          }
        }

        return codeActions;
      },
      '提供代碼行動建議',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 提供代碼完成建議
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const suggestions = await this.personalizationEngine.generatePersonalizedSuggestions(
          document,
          position
        );

        const completionItems: vscode.CompletionItem[] = [];

        for (const suggestion of suggestions) {
          if (suggestion.type === SuggestionType.CODE_STYLE || 
              suggestion.type === SuggestionType.BEST_PRACTICE) {
            const completionItem = this.createCompletionItem(suggestion);
            if (completionItem) {
              completionItems.push(completionItem);
            }
          }
        }

        return completionItems;
      },
      '提供代碼完成建議',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 顯示個性化建議面板
   */
  async showPersonalizedSuggestions(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          vscode.window.showWarningMessage('請先打開一個文件');
          return;
        }

        const suggestions = await this.personalizationEngine.generatePersonalizedSuggestions(
          activeEditor.document,
          activeEditor.selection.active
        );

        if (suggestions.length === 0) {
          vscode.window.showInformationMessage('當前沒有個性化建議');
          return;
        }

        const items: SuggestionQuickPickItem[] = suggestions.map(suggestion => ({
          label: `${this.getSuggestionIcon(suggestion.type)} ${suggestion.title}`,
          description: `${suggestion.priority} | 信心度: ${(suggestion.confidence * 100).toFixed(1)}%`,
          detail: suggestion.description,
          suggestion
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '選擇要應用的個性化建議',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          await this.applySuggestion(selected.suggestion, activeEditor);
        }
      },
      '顯示個性化建議',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示用戶偏好摘要
   */
  async showUserPreferenceSummary(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const summary = await this.personalizationEngine.getUserPreferenceSummary();
        
        const panel = vscode.window.createWebviewPanel(
          'userPreferences',
          '用戶偏好摘要',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        panel.webview.html = this.generatePreferenceSummaryHTML(summary);
      },
      '顯示用戶偏好摘要',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 提供建議反饋
   */
  async provideSuggestionFeedback(suggestionId: string): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const feedbackOptions = [
          { label: '👍 有用', description: '這個建議很有幫助', value: 'positive' },
          { label: '👎 無用', description: '這個建議沒有幫助', value: 'negative' },
          { label: '🤷 一般', description: '這個建議還可以', value: 'neutral' }
        ];

        const selected = await vscode.window.showQuickPick(feedbackOptions, {
          placeHolder: '請評價這個建議的有用性'
        });

        if (selected) {
          await this.personalizationEngine.recordUserFeedback(
            suggestionId,
            selected.value as any,
            'feedback'
          );
          
          vscode.window.showInformationMessage('感謝您的反饋！');
        }
      },
      '提供建議反饋',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 創建代碼行動
   */
  private createCodeAction(
    suggestion: PersonalizedSuggestion,
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction | null {
    const action = new vscode.CodeAction(
      suggestion.title,
      this.getCodeActionKind(suggestion.type)
    );

    action.detail = suggestion.description;
    action.diagnostics = [];

    // 設置命令
    if (suggestion.actions.length > 0) {
      const primaryAction = suggestion.actions[0];
      if (primaryAction.command) {
        action.command = {
          title: primaryAction.label,
          command: primaryAction.command,
          arguments: primaryAction.arguments || [document.uri, range]
        };
      } else if (primaryAction.codeEdit) {
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, primaryAction.codeEdit.range, primaryAction.codeEdit.newText);
      }
    }

    // 存儲建議以便後續反饋
    this.activeSuggestions.set(suggestion.id, suggestion);

    return action;
  }

  /**
   * 創建完成項目
   */
  private createCompletionItem(suggestion: PersonalizedSuggestion): vscode.CompletionItem | null {
    const item = new vscode.CompletionItem(
      suggestion.title,
      vscode.CompletionItemKind.Snippet
    );

    item.detail = suggestion.description;
    item.documentation = new vscode.MarkdownString(suggestion.reasoning);
    item.sortText = this.getSortText(suggestion);

    // 如果有代碼編輯，設置插入文本
    if (suggestion.actions.length > 0) {
      const primaryAction = suggestion.actions[0];
      if (primaryAction.codeEdit) {
        item.insertText = new vscode.SnippetString(primaryAction.codeEdit.newText);
      }
    }

    return item;
  }

  /**
   * 應用建議
   */
  private async applySuggestion(
    suggestion: PersonalizedSuggestion,
    editor: vscode.TextEditor
  ): Promise<void> {
    try {
      for (const action of suggestion.actions) {
        if (action.command) {
          await vscode.commands.executeCommand(action.command, ...(action.arguments || []));
        } else if (action.codeEdit) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(editor.document.uri, action.codeEdit.range, action.codeEdit.newText);
          await vscode.workspace.applyEdit(edit);
        } else if (action.fileOperation) {
          await this.performFileOperation(action.fileOperation);
        }
      }

      // 記錄正面反饋
      await this.personalizationEngine.recordUserFeedback(
        suggestion.id,
        'positive',
        'accepted'
      );

      vscode.window.showInformationMessage(`已應用建議: ${suggestion.title}`);
    } catch (error) {
      vscode.window.showErrorMessage(`應用建議失敗: ${error}`);
    }
  }

  /**
   * 執行文件操作
   */
  private async performFileOperation(operation: any): Promise<void> {
    switch (operation.type) {
      case 'create':
        if (operation.content) {
          await vscode.workspace.fs.writeFile(
            operation.target,
            Buffer.from(operation.content, 'utf8')
          );
        }
        break;
      case 'delete':
        await vscode.workspace.fs.delete(operation.target);
        break;
      case 'rename':
        if (operation.source) {
          await vscode.workspace.fs.rename(operation.source, operation.target);
        }
        break;
    }
  }

  /**
   * 獲取建議圖標
   */
  private getSuggestionIcon(type: SuggestionType): string {
    const icons = {
      [SuggestionType.CODE_STYLE]: '🎨',
      [SuggestionType.REFACTORING]: '🔧',
      [SuggestionType.BEST_PRACTICE]: '⭐',
      [SuggestionType.PERFORMANCE]: '⚡',
      [SuggestionType.SECURITY]: '🔒',
      [SuggestionType.TESTING]: '🧪',
      [SuggestionType.DOCUMENTATION]: '📚',
      [SuggestionType.DEPENDENCY]: '📦',
      [SuggestionType.WORKFLOW]: '🔄',
      [SuggestionType.LEARNING]: '🎓'
    };
    return icons[type] || '💡';
  }

  /**
   * 獲取代碼行動類型
   */
  private getCodeActionKind(type: SuggestionType): vscode.CodeActionKind {
    switch (type) {
      case SuggestionType.REFACTORING:
        return vscode.CodeActionKind.Refactor;
      case SuggestionType.CODE_STYLE:
        return vscode.CodeActionKind.QuickFix;
      case SuggestionType.PERFORMANCE:
        return vscode.CodeActionKind.RefactorRewrite;
      default:
        return vscode.CodeActionKind.QuickFix;
    }
  }

  /**
   * 獲取排序文本
   */
  private getSortText(suggestion: PersonalizedSuggestion): string {
    // 基於優先級和信心度計算排序
    const priorityWeight = {
      'critical': 1000,
      'high': 800,
      'medium': 600,
      'low': 400
    }[suggestion.priority] || 0;

    const confidenceWeight = Math.round(suggestion.confidence * 100);
    const totalWeight = priorityWeight + confidenceWeight;

    return String(10000 - totalWeight).padStart(5, '0');
  }

  /**
   * 生成偏好摘要 HTML
   */
  private generatePreferenceSummaryHTML(summary: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>用戶偏好摘要</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .section { 
            margin: 20px 0; 
            padding: 15px; 
            border: 1px solid var(--vscode-panel-border); 
            border-radius: 5px; 
          }
          .section-title { 
            font-weight: bold; 
            font-size: 18px; 
            margin-bottom: 10px; 
            color: var(--vscode-textLink-foreground);
          }
          .item { 
            margin: 5px 0; 
            padding: 5px 10px; 
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 3px;
          }
          .preferred { color: var(--vscode-gitDecoration-addedResourceForeground); }
          .avoided { color: var(--vscode-gitDecoration-deletedResourceForeground); }
        </style>
      </head>
      <body>
        <h1>🎯 用戶偏好摘要</h1>
        
        <div class="section">
          <div class="section-title">偏好的建議類型</div>
          ${summary.preferredSuggestionTypes.map((type: string) => 
            `<div class="item preferred">✅ ${type}</div>`
          ).join('')}
        </div>
        
        <div class="section">
          <div class="section-title">避免的建議類型</div>
          ${summary.avoidedSuggestionTypes.map((type: string) => 
            `<div class="item avoided">❌ ${type}</div>`
          ).join('')}
        </div>
        
        <div class="section">
          <div class="section-title">偏好的編程語言</div>
          ${summary.preferredLanguages.map((lang: string) => 
            `<div class="item">🔤 ${lang}</div>`
          ).join('')}
        </div>
        
        <div class="section">
          <div class="section-title">常用模式</div>
          ${summary.commonPatterns.map((pattern: string) => 
            `<div class="item">🔄 ${pattern}</div>`
          ).join('')}
        </div>
        
        <div class="section">
          <div class="section-title">學習領域</div>
          ${summary.learningAreas.map((area: string) => 
            `<div class="item">🎓 ${area}</div>`
          ).join('')}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 註冊提供者
   */
  static register(context: vscode.ExtensionContext): PersonalizationProvider {
    const provider = new PersonalizationProvider();

    // 註冊代碼行動提供者
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { scheme: 'file' },
        provider,
        {
          providedCodeActionKinds: [
            vscode.CodeActionKind.QuickFix,
            vscode.CodeActionKind.Refactor,
            vscode.CodeActionKind.RefactorRewrite
          ]
        }
      )
    );

    // 註冊完成提供者
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'file' },
        provider,
        '.'
      )
    );

    return provider;
  }
}
