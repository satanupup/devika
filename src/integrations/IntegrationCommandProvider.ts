import * as vscode from 'vscode';
import { IntegrationManager } from './IntegrationManager';
import { IntegrationType, IntegrationConfig } from './IntegrationEngine';
import { GitHubIntegration } from './providers/GitHubIntegration';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 整合命令提供者
 * 提供與第三方工具整合相關的 VS Code 命令
 */
export class IntegrationCommandProvider {
  private integrationManager: IntegrationManager;

  constructor() {
    this.integrationManager = IntegrationManager.getInstance();
  }

  /**
   * 註冊所有整合相關命令
   */
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      // 整合管理命令
      vscode.commands.registerCommand('devika.integrations.showDashboard', () => this.showIntegrationDashboard()),
      vscode.commands.registerCommand('devika.integrations.addIntegration', () => this.addIntegration()),
      vscode.commands.registerCommand('devika.integrations.removeIntegration', () => this.removeIntegration()),
      vscode.commands.registerCommand('devika.integrations.testConnection', (connectionId) => this.testConnection(connectionId)),
      vscode.commands.registerCommand('devika.integrations.syncAll', () => this.syncAllIntegrations()),

      // GitHub 命令
      vscode.commands.registerCommand('devika.github.showRepositories', () => this.showGitHubRepositories()),
      vscode.commands.registerCommand('devika.github.showIssues', () => this.showGitHubIssues()),
      vscode.commands.registerCommand('devika.github.createIssue', () => this.createGitHubIssue()),
      vscode.commands.registerCommand('devika.github.showPullRequests', () => this.showGitHubPullRequests()),
      vscode.commands.registerCommand('devika.github.openInBrowser', (url) => this.openInBrowser(url)),

      // Jira 命令
      vscode.commands.registerCommand('devika.jira.showProjects', () => this.showJiraProjects()),
      vscode.commands.registerCommand('devika.jira.showIssues', () => this.showJiraIssues()),
      vscode.commands.registerCommand('devika.jira.createIssue', () => this.createJiraIssue()),
      vscode.commands.registerCommand('devika.jira.searchIssues', () => this.searchJiraIssues()),
      vscode.commands.registerCommand('devika.jira.showBoards', () => this.showJiraBoards()),

      // Confluence 命令
      vscode.commands.registerCommand('devika.confluence.showSpaces', () => this.showConfluenceSpaces()),
      vscode.commands.registerCommand('devika.confluence.searchContent', () => this.searchConfluenceContent()),
      vscode.commands.registerCommand('devika.confluence.createPage', () => this.createConfluencePage()),
      vscode.commands.registerCommand('devika.confluence.showRecentPages', () => this.showRecentConfluencePages()),

      // 快速操作命令
      vscode.commands.registerCommand('devika.integrations.quickAction', () => this.showQuickActions()),
      vscode.commands.registerCommand('devika.integrations.linkCurrentFile', () => this.linkCurrentFileToIssue()),
      vscode.commands.registerCommand('devika.integrations.createIssueFromSelection', () => this.createIssueFromSelection()),

      // 設置命令
      vscode.commands.registerCommand('devika.integrations.configure', () => this.configureIntegrations()),
      vscode.commands.registerCommand('devika.integrations.showStats', () => this.showIntegrationStats())
    ];

    commands.forEach(command => context.subscriptions.push(command));
  }

  /**
   * 顯示整合儀表板
   */
  private async showIntegrationDashboard(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const panel = vscode.window.createWebviewPanel(
          'integrationDashboard',
          '整合儀表板',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );

        const connections = this.integrationManager.getConnections();
        const stats = this.integrationManager.getIntegrationStats();

        panel.webview.html = this.generateDashboardHTML(connections, stats);

        // 處理 WebView 消息
        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'testConnection':
              await this.testConnection(message.connectionId);
              break;
            case 'removeConnection':
              await this.removeIntegration(message.connectionId);
              break;
          }
        });
      },
      '顯示整合儀表板',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 添加整合
   */
  private async addIntegration(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const integrationTypes = [
          { label: '🐙 GitHub', description: 'GitHub 倉庫和 Issues 管理', value: IntegrationType.GITHUB },
          { label: '📋 Jira', description: 'Jira 項目和 Issues 管理', value: IntegrationType.JIRA },
          { label: '📚 Confluence', description: 'Confluence 文檔和知識庫', value: IntegrationType.CONFLUENCE },
          { label: '💬 Slack', description: 'Slack 團隊溝通', value: IntegrationType.SLACK },
          { label: '👥 Teams', description: 'Microsoft Teams', value: IntegrationType.TEAMS }
        ];

        const selectedType = await vscode.window.showQuickPick(integrationTypes, {
          placeHolder: '選擇要添加的整合類型'
        });

        if (!selectedType) {return;}

        await this.configureIntegration(selectedType.value);
      },
      '添加整合',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 配置整合
   */
  private async configureIntegration(type: IntegrationType): Promise<void> {
    switch (type) {
      case IntegrationType.GITHUB:
        await this.configureGitHubIntegration();
        break;
      case IntegrationType.JIRA:
        await this.configureJiraIntegration();
        break;
      case IntegrationType.CONFLUENCE:
        await this.configureConfluenceIntegration();
        break;
      default:
        vscode.window.showInformationMessage(`${type} 整合配置即將推出`);
    }
  }

  /**
   * 配置 GitHub 整合
   */
  private async configureGitHubIntegration(): Promise<void> {
    const token = await vscode.window.showInputBox({
      prompt: '輸入 GitHub Personal Access Token',
      password: true,
      placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxx'
    });

    if (!token) {return;}

    const config: IntegrationConfig = {
      type: IntegrationType.GITHUB,
      name: 'GitHub',
      enabled: true,
      token,
      settings: {}
    };

    const result = await this.integrationManager.addIntegration(config);
    if (result.success) {
      vscode.window.showInformationMessage('GitHub 整合已添加');
    } else {
      vscode.window.showErrorMessage(`添加 GitHub 整合失敗: ${result.error}`);
    }
  }

  /**
   * 配置 Jira 整合
   */
  private async configureJiraIntegration(): Promise<void> {
    const organization = await vscode.window.showInputBox({
      prompt: '輸入 Jira 組織名稱',
      placeHolder: 'your-organization'
    });

    if (!organization) {return;}

    const username = await vscode.window.showInputBox({
      prompt: '輸入 Jira 用戶名',
      placeHolder: 'your-email@example.com'
    });

    if (!username) {return;}

    const apiKey = await vscode.window.showInputBox({
      prompt: '輸入 Jira API Token',
      password: true,
      placeHolder: 'your-api-token'
    });

    if (!apiKey) {return;}

    const config: IntegrationConfig = {
      type: IntegrationType.JIRA,
      name: 'Jira',
      enabled: true,
      organization,
      username,
      apiKey,
      settings: {}
    };

    const result = await this.integrationManager.addIntegration(config);
    if (result.success) {
      vscode.window.showInformationMessage('Jira 整合已添加');
    } else {
      vscode.window.showErrorMessage(`添加 Jira 整合失敗: ${result.error}`);
    }
  }

  /**
   * 配置 Confluence 整合
   */
  private async configureConfluenceIntegration(): Promise<void> {
    const organization = await vscode.window.showInputBox({
      prompt: '輸入 Confluence 組織名稱',
      placeHolder: 'your-organization'
    });

    if (!organization) {return;}

    const username = await vscode.window.showInputBox({
      prompt: '輸入 Confluence 用戶名',
      placeHolder: 'your-email@example.com'
    });

    if (!username) {return;}

    const apiKey = await vscode.window.showInputBox({
      prompt: '輸入 Confluence API Token',
      password: true,
      placeHolder: 'your-api-token'
    });

    if (!apiKey) {return;}

    const config: IntegrationConfig = {
      type: IntegrationType.CONFLUENCE,
      name: 'Confluence',
      enabled: true,
      organization,
      username,
      apiKey,
      settings: {}
    };

    const result = await this.integrationManager.addIntegration(config);
    if (result.success) {
      vscode.window.showInformationMessage('Confluence 整合已添加');
    } else {
      vscode.window.showErrorMessage(`添加 Confluence 整合失敗: ${result.error}`);
    }
  }

  /**
   * 移除整合
   */
  private async removeIntegration(connectionId?: string): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!connectionId) {
          const connections = this.integrationManager.getConnections();
          if (connections.length === 0) {
            vscode.window.showInformationMessage('沒有可移除的整合');
            return;
          }

          const items = connections.map(conn => ({
            label: `${this.getIntegrationIcon(conn.type)} ${conn.config.name}`,
            description: `${conn.type} | ${conn.status}`,
            connectionId: conn.id
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇要移除的整合'
          });

          if (!selected) {return;}
          connectionId = selected.connectionId;
        }

        const choice = await vscode.window.showWarningMessage(
          '確定要移除此整合嗎？',
          { modal: true },
          '確定',
          '取消'
        );

        if (choice === '確定') {
          const result = await this.integrationManager.removeIntegration(connectionId);
          if (result.success) {
            vscode.window.showInformationMessage('整合已移除');
          } else {
            vscode.window.showErrorMessage(`移除整合失敗: ${result.error}`);
          }
        }
      },
      '移除整合',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 測試連接
   */
  private async testConnection(connectionId?: string): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!connectionId) {
          const connections = this.integrationManager.getConnections();
          if (connections.length === 0) {
            vscode.window.showInformationMessage('沒有可測試的整合');
            return;
          }

          const items = connections.map(conn => ({
            label: `${this.getIntegrationIcon(conn.type)} ${conn.config.name}`,
            description: `${conn.type} | ${conn.status}`,
            connectionId: conn.id
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇要測試的整合'
          });

          if (!selected) {return;}
          connectionId = selected.connectionId;
        }

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: '測試整合連接...',
          cancellable: false
        }, async (progress) => {
          const result = await this.integrationManager.testIntegration(connectionId!);

          if (result.success && result.data) {
            vscode.window.showInformationMessage('整合連接測試成功');
          } else {
            vscode.window.showErrorMessage(`整合連接測試失敗: ${result.error}`);
          }
        });
      },
      '測試整合連接',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 同步所有整合
   */
  private async syncAllIntegrations(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: '同步所有整合...',
          cancellable: false
        }, async (progress) => {
          const result = await this.integrationManager.syncAllIntegrations();

          if (result.success && result.data) {
            const successCount = result.data.filter((r: any) => r.success).length;
            const totalCount = result.data.length;

            vscode.window.showInformationMessage(
              `同步完成: ${successCount}/${totalCount} 個整合同步成功`
            );
          } else {
            vscode.window.showErrorMessage(`同步失敗: ${result.error}`);
          }
        });
      },
      '同步所有整合',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示 GitHub 倉庫
   */
  private async showGitHubRepositories(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!this.integrationManager.isIntegrationAvailable(IntegrationType.GITHUB)) {
          vscode.window.showWarningMessage('請先配置 GitHub 整合');
          return;
        }

        const result = await this.integrationManager.getGitHubRepositories();
        if (result.success && result.data) {
          const items = result.data.map((repo: any) => ({
            label: `📁 ${repo.name}`,
            description: repo.description || '',
            detail: `${repo.language || 'Unknown'} | ⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count}`,
            repo
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇 GitHub 倉庫',
            matchOnDescription: true,
            matchOnDetail: true
          });

          if (selected) {
            await this.openInBrowser(selected.repo.html_url);
          }
        } else {
          vscode.window.showErrorMessage(`獲取 GitHub 倉庫失敗: ${result.error}`);
        }
      },
      '顯示 GitHub 倉庫',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 顯示 GitHub Issues
   */
  private async showGitHubIssues(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 嘗試從當前工作區獲取倉庫信息
        const repoInfo = await GitHubIntegration.getCurrentWorkspaceRepository();

        if (!repoInfo) {
          vscode.window.showWarningMessage('無法檢測到當前工作區的 GitHub 倉庫');
          return;
        }

        const result = await this.integrationManager.getGitHubIssues('', repoInfo.owner, repoInfo.repo);
        if (result.success && result.data) {
          const items = result.data.map((issue: any) => ({
            label: `#${issue.number} ${issue.title}`,
            description: issue.state,
            detail: `由 ${issue.user.login} 創建於 ${new Date(issue.created_at).toLocaleDateString()}`,
            issue
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `${repoInfo.owner}/${repoInfo.repo} 的 Issues`,
            matchOnDescription: true
          });

          if (selected) {
            await this.openInBrowser(selected.issue.html_url);
          }
        } else {
          vscode.window.showErrorMessage(`獲取 GitHub Issues 失敗: ${result.error}`);
        }
      },
      '顯示 GitHub Issues',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 創建 GitHub Issue
   */
  private async createGitHubIssue(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const repoInfo = await GitHubIntegration.getCurrentWorkspaceRepository();

        if (!repoInfo) {
          vscode.window.showWarningMessage('無法檢測到當前工作區的 GitHub 倉庫');
          return;
        }

        const title = await vscode.window.showInputBox({
          prompt: '輸入 Issue 標題',
          placeHolder: 'Issue 標題'
        });

        if (!title) {return;}

        const body = await vscode.window.showInputBox({
          prompt: '輸入 Issue 描述（可選）',
          placeHolder: 'Issue 描述'
        });

        const result = await this.integrationManager.createGitHubIssue('', repoInfo.owner, repoInfo.repo, title, body);
        if (result.success && result.data) {
          const choice = await vscode.window.showInformationMessage(
            `Issue #${result.data.number} 已創建`,
            '在瀏覽器中打開'
          );

          if (choice) {
            await this.openInBrowser(result.data.html_url);
          }
        } else {
          vscode.window.showErrorMessage(`創建 GitHub Issue 失敗: ${result.error}`);
        }
      },
      '創建 GitHub Issue',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 輔助方法
   */
  private getIntegrationIcon(type: IntegrationType): string {
    const icons = {
      [IntegrationType.GITHUB]: '🐙',
      [IntegrationType.GITLAB]: '🦊',
      [IntegrationType.JIRA]: '📋',
      [IntegrationType.CONFLUENCE]: '📚',
      [IntegrationType.SLACK]: '💬',
      [IntegrationType.TEAMS]: '👥',
      [IntegrationType.TRELLO]: '📌',
      [IntegrationType.NOTION]: '📝',
      [IntegrationType.LINEAR]: '📐',
      [IntegrationType.FIGMA]: '🎨'
    };
    return icons[type] || '🔗';
  }

  private async openInBrowser(url: string): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private generateDashboardHTML(connections: any[], stats: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>整合儀表板</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .stats { 
            display: flex; 
            gap: 20px; 
            margin-bottom: 30px; 
          }
          .stat-card { 
            padding: 15px; 
            border: 1px solid var(--vscode-panel-border); 
            border-radius: 5px; 
            flex: 1;
          }
          .stat-value { 
            font-size: 24px; 
            font-weight: bold; 
            color: var(--vscode-textLink-foreground); 
          }
          .connection { 
            margin: 15px 0; 
            padding: 15px; 
            border: 1px solid var(--vscode-panel-border); 
            border-radius: 5px; 
          }
          .connection-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
          }
          .status-connected { color: var(--vscode-gitDecoration-addedResourceForeground); }
          .status-disconnected { color: var(--vscode-gitDecoration-deletedResourceForeground); }
          .status-error { color: var(--vscode-errorForeground); }
          button { 
            background: var(--vscode-button-background); 
            color: var(--vscode-button-foreground); 
            border: none; 
            padding: 5px 10px; 
            border-radius: 3px; 
            cursor: pointer; 
          }
        </style>
      </head>
      <body>
        <h1>🔗 整合儀表板</h1>
        
        <div class="stats">
          <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div>總整合數</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.connected}</div>
            <div>已連接</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.lastActivity ? stats.lastActivity.toLocaleDateString() : 'N/A'}</div>
            <div>最後活動</div>
          </div>
        </div>
        
        <h2>整合連接</h2>
        ${connections.map(conn => `
          <div class="connection">
            <div class="connection-header">
              <div>
                <strong>${this.getIntegrationIcon(conn.type)} ${conn.config.name}</strong>
                <span class="status-${conn.status}">${conn.status}</span>
              </div>
              <div>
                <button onclick="testConnection('${conn.id}')">測試</button>
                <button onclick="removeConnection('${conn.id}')">移除</button>
              </div>
            </div>
            <div>類型: ${conn.type}</div>
            <div>最後活動: ${conn.lastActivity.toLocaleString()}</div>
            ${conn.errorMessage ? `<div style="color: var(--vscode-errorForeground);">錯誤: ${conn.errorMessage}</div>` : ''}
          </div>
        `).join('')}
        
        <script>
          const vscode = acquireVsCodeApi();
          
          function testConnection(connectionId) {
            vscode.postMessage({ command: 'testConnection', connectionId });
          }
          
          function removeConnection(connectionId) {
            vscode.postMessage({ command: 'removeConnection', connectionId });
          }
        </script>
      </body>
      </html>
    `;
  }

  // 其他方法的簡化實現
  private async showGitHubPullRequests(): Promise<void> {
    vscode.window.showInformationMessage('GitHub Pull Requests 功能即將推出');
  }

  private async showJiraProjects(): Promise<void> {
    vscode.window.showInformationMessage('Jira Projects 功能即將推出');
  }

  private async showJiraIssues(): Promise<void> {
    vscode.window.showInformationMessage('Jira Issues 功能即將推出');
  }

  private async createJiraIssue(): Promise<void> {
    vscode.window.showInformationMessage('創建 Jira Issue 功能即將推出');
  }

  private async searchJiraIssues(): Promise<void> {
    vscode.window.showInformationMessage('搜索 Jira Issues 功能即將推出');
  }

  private async showJiraBoards(): Promise<void> {
    vscode.window.showInformationMessage('Jira Boards 功能即將推出');
  }

  private async showConfluenceSpaces(): Promise<void> {
    vscode.window.showInformationMessage('Confluence Spaces 功能即將推出');
  }

  private async searchConfluenceContent(): Promise<void> {
    vscode.window.showInformationMessage('搜索 Confluence 內容功能即將推出');
  }

  private async createConfluencePage(): Promise<void> {
    vscode.window.showInformationMessage('創建 Confluence 頁面功能即將推出');
  }

  private async showRecentConfluencePages(): Promise<void> {
    vscode.window.showInformationMessage('最近 Confluence 頁面功能即將推出');
  }

  private async showQuickActions(): Promise<void> {
    vscode.window.showInformationMessage('快速操作功能即將推出');
  }

  private async linkCurrentFileToIssue(): Promise<void> {
    vscode.window.showInformationMessage('鏈接文件到 Issue 功能即將推出');
  }

  private async createIssueFromSelection(): Promise<void> {
    vscode.window.showInformationMessage('從選擇創建 Issue 功能即將推出');
  }

  private async configureIntegrations(): Promise<void> {
    await this.addIntegration();
  }

  private async showIntegrationStats(): Promise<void> {
    const stats = this.integrationManager.getIntegrationStats();
    vscode.window.showInformationMessage(
      `整合統計: ${stats.connected}/${stats.total} 已連接`
    );
  }
}
