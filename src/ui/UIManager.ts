import * as vscode from 'vscode';
import { Task } from '../tasks/TaskManager';

export class UIManager {
    private context: vscode.ExtensionContext;
    private mainPanel: vscode.WebviewPanel | undefined;
    private taskPanel: vscode.WebviewPanel | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async showMainPanel(): Promise<void> {
        if (this.mainPanel) {
            this.mainPanel.reveal();
            return;
        }

        this.mainPanel = vscode.window.createWebviewPanel(
            'devika.main',
            'Devika AI 助理',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media')
                ]
            }
        );

        this.mainPanel.webview.html = this.getMainPanelHtml();

        this.mainPanel.onDidDispose(() => {
            this.mainPanel = undefined;
        });

        // 處理來自 webview 的訊息
        this.mainPanel.webview.onDidReceiveMessage(
            message => this.handleMainPanelMessage(message),
            undefined,
            this.context.subscriptions
        );
    }

    async showTaskPanel(tasks: Task[]): Promise<void> {
        if (this.taskPanel) {
            this.taskPanel.reveal();
            this.updateTaskPanel(tasks);
            return;
        }

        this.taskPanel = vscode.window.createWebviewPanel(
            'devika.tasks',
            'Devika 任務列表',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.taskPanel.webview.html = this.getTaskPanelHtml(tasks);

        this.taskPanel.onDidDispose(() => {
            this.taskPanel = undefined;
        });

        // 處理來自 webview 的訊息
        this.taskPanel.webview.onDidReceiveMessage(
            message => this.handleTaskPanelMessage(message),
            undefined,
            this.context.subscriptions
        );
    }

    async showAnalysisResult(analysis: string, tasks: any[]): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'devika.analysis',
            '程式碼分析結果',
            vscode.ViewColumn.Two,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getAnalysisResultHtml(analysis, tasks);
    }

    async showRefactorResult(suggestion: string, tasks: any[]): Promise<boolean> {
        const panel = vscode.window.createWebviewPanel(
            'devika.refactor',
            '重構建議',
            vscode.ViewColumn.Two,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getRefactorResultHtml(suggestion, tasks);

        return new Promise((resolve) => {
            panel.webview.onDidReceiveMessage(
                message => {
                    if (message.command === 'apply') {
                        resolve(true);
                        panel.dispose();
                    } else if (message.command === 'cancel') {
                        resolve(false);
                        panel.dispose();
                    }
                }
            );

            panel.onDidDispose(() => {
                resolve(false);
            });
        });
    }

    async showTestGenerationResult(testCode: string, task: any): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'devika.test',
            '測試生成結果',
            vscode.ViewColumn.Two,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getTestGenerationResultHtml(testCode, task);
    }

    async showGitSummary(summary: string, changes: string[]): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'devika.gitSummary',
            'Git 變更總結',
            vscode.ViewColumn.Two,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getGitSummaryHtml(summary, changes);
    }

    async showCommitMessage(commitMessage: string): Promise<boolean> {
        const result = await vscode.window.showInformationMessage(
            `建議的 Commit 訊息：\n\n${commitMessage}`,
            { modal: true },
            '提交',
            '取消'
        );

        return result === '提交';
    }

    private updateTaskPanel(tasks: Task[]): void {
        if (this.taskPanel) {
            this.taskPanel.webview.html = this.getTaskPanelHtml(tasks);
        }
    }

    private async handleMainPanelMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'analyzeCode':
                await vscode.commands.executeCommand('devika.analyzeCode');
                break;
            case 'refactorCode':
                await vscode.commands.executeCommand('devika.refactorCode');
                break;
            case 'generateTests':
                await vscode.commands.executeCommand('devika.generateTests');
                break;
            case 'scanTodos':
                await vscode.commands.executeCommand('devika.scanTodos');
                break;
            case 'showTasks':
                await vscode.commands.executeCommand('devika.showTasks');
                break;
            case 'chat':
                await this.handleChatMessage(message.message);
                break;
            case 'stopChat':
                await this.handleStopChat();
                break;
        }
    }

    private async handleTaskPanelMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'completeTask':
                // 處理完成任務
                break;
            case 'deleteTask':
                // 處理刪除任務
                break;
            case 'editTask':
                // 處理編輯任務
                break;
        }
    }

    private currentChatAbortController: AbortController | undefined;

    private async handleChatMessage(message: string): Promise<void> {
        try {
            // Create abort controller for this chat request
            this.currentChatAbortController = new AbortController();

            // Import LLMService and ConfigManager dynamically to avoid circular dependencies
            const { LLMService } = await import('../llm/LLMService');
            const { ConfigManager } = await import('../config/ConfigManager');
            const configManager = ConfigManager.getInstance();
            const llmService = new LLMService(configManager);

            // Generate response
            const result = await llmService.generateCompletion(
                `作為一個 AI 程式開發助理，請回答以下問題：${message}`
            );
            const response = result.content;

            // Send response back to webview
            if (this.mainPanel) {
                this.mainPanel.webview.postMessage({
                    command: 'chatResponse',
                    content: response
                });
            }

        } catch (error: any) {
            // Handle abort
            if (error.name === 'AbortError') {
                return;
            }

            // Send error back to webview
            if (this.mainPanel) {
                this.mainPanel.webview.postMessage({
                    command: 'chatError',
                    error: error.message || '未知錯誤'
                });
            }
        } finally {
            this.currentChatAbortController = undefined;
        }
    }

    private async handleStopChat(): Promise<void> {
        if (this.currentChatAbortController) {
            this.currentChatAbortController.abort();
            this.currentChatAbortController = undefined;
        }
    }

    private getMainPanelHtml(): string {
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Devika AI 助理</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 2em;
                    margin-bottom: 10px;
                }
                .actions {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .action-card {
                    background: var(--vscode-button-background);
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 8px;
                    padding: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .action-card:hover {
                    background: var(--vscode-button-hoverBackground);
                    transform: translateY(-2px);
                }
                .action-title {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: var(--vscode-button-foreground);
                }
                .action-description {
                    font-size: 0.9em;
                    opacity: 0.8;
                    color: var(--vscode-button-foreground);
                }
                .status {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                    padding: 15px;
                    margin-top: 20px;
                }
                .chat-container {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    margin-top: 20px;
                    height: 400px;
                    display: flex;
                    flex-direction: column;
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    scroll-behavior: smooth;
                }
                .chat-message {
                    margin-bottom: 15px;
                    padding: 10px;
                    border-radius: 6px;
                    max-width: 80%;
                }
                .chat-message.user {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    margin-left: auto;
                }
                .chat-message.assistant {
                    background: var(--vscode-textCodeBlock-background);
                    color: var(--vscode-editor-foreground);
                }
                .chat-input-container {
                    border-top: 1px solid var(--vscode-panel-border);
                    padding: 15px;
                    display: flex;
                    gap: 10px;
                }
                .chat-input {
                    flex: 1;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-family: inherit;
                }
                .chat-send-btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .chat-send-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .chat-send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .chat-stop-btn {
                    background: var(--vscode-errorForeground);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: none;
                }
                .chat-stop-btn:hover {
                    background: var(--vscode-errorForeground);
                    opacity: 0.8;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">🤖 Devika AI 助理</div>
                <p>智能程式開發助理，讓編程更輕鬆</p>
            </div>

            <div class="actions">
                <div class="action-card" onclick="sendMessage('analyzeCode')">
                    <div class="action-title">🔍 分析程式碼</div>
                    <div class="action-description">分析選取的程式碼並提供改進建議</div>
                </div>

                <div class="action-card" onclick="sendMessage('refactorCode')">
                    <div class="action-title">🔧 重構程式碼</div>
                    <div class="action-description">重構程式碼以提高可讀性和效能</div>
                </div>

                <div class="action-card" onclick="sendMessage('generateTests')">
                    <div class="action-title">🧪 生成測試</div>
                    <div class="action-description">為選取的程式碼生成單元測試</div>
                </div>

                <div class="action-card" onclick="sendMessage('scanTodos')">
                    <div class="action-title">📝 掃描 TODO</div>
                    <div class="action-description">掃描專案中的 TODO 和 FIXME 項目</div>
                </div>

                <div class="action-card" onclick="sendMessage('showTasks')">
                    <div class="action-title">📋 任務列表</div>
                    <div class="action-description">檢視和管理所有任務</div>
                </div>
            </div>

            <div class="status">
                <strong>💡 使用提示：</strong>
                <ul>
                    <li>選取程式碼後使用右鍵選單快速存取功能</li>
                    <li>在 Git 面板中可以生成 Commit 訊息</li>
                    <li>任務會自動儲存並在重啟後恢復</li>
                </ul>
            </div>

            <div class="chat-container">
                <div class="chat-messages" id="chatMessages">
                    <div class="chat-message assistant">
                        <strong>🤖 Devika:</strong> 您好！我是您的 AI 程式開發助理。有什麼可以幫助您的嗎？
                    </div>
                </div>
                <div class="chat-input-container">
                    <input type="text" class="chat-input" id="chatInput" placeholder="輸入您的問題或指令..." />
                    <button class="chat-send-btn" id="chatSendBtn" onclick="sendChatMessage()">發送</button>
                    <button class="chat-stop-btn" id="chatStopBtn" onclick="stopChatResponse()">停止</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let isGenerating = false;

                function sendMessage(command) {
                    vscode.postMessage({ command: command });
                }

                function sendChatMessage() {
                    const input = document.getElementById('chatInput');
                    const message = input.value.trim();
                    if (!message || isGenerating) return;

                    // Add user message to chat
                    addChatMessage('user', message);
                    input.value = '';

                    // Show loading state
                    setGeneratingState(true);

                    // Send to extension
                    vscode.postMessage({
                        command: 'chat',
                        message: message
                    });
                }

                function stopChatResponse() {
                    if (isGenerating) {
                        vscode.postMessage({ command: 'stopChat' });
                        setGeneratingState(false);
                    }
                }

                function addChatMessage(sender, content) {
                    const messagesContainer = document.getElementById('chatMessages');
                    const messageDiv = document.createElement('div');
                    messageDiv.className = \`chat-message \${sender}\`;

                    if (sender === 'user') {
                        messageDiv.innerHTML = \`<strong>👤 您:</strong> \${content}\`;
                    } else {
                        messageDiv.innerHTML = \`<strong>🤖 Devika:</strong> \${content}\`;
                    }

                    messagesContainer.appendChild(messageDiv);

                    // Auto-scroll to bottom
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                function setGeneratingState(generating) {
                    isGenerating = generating;
                    const sendBtn = document.getElementById('chatSendBtn');
                    const stopBtn = document.getElementById('chatStopBtn');
                    const input = document.getElementById('chatInput');

                    sendBtn.disabled = generating;
                    stopBtn.style.display = generating ? 'block' : 'none';
                    input.disabled = generating;

                    if (generating) {
                        sendBtn.textContent = '生成中...';
                    } else {
                        sendBtn.textContent = '發送';
                    }
                }

                // Handle Enter key in chat input
                document.getElementById('chatInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChatMessage();
                    }
                });

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'chatResponse':
                            addChatMessage('assistant', message.content);
                            setGeneratingState(false);
                            break;
                        case 'chatError':
                            addChatMessage('assistant', '❌ 抱歉，發生錯誤：' + message.error);
                            setGeneratingState(false);
                            break;
                    }
                });
            </script>
        </body>
        </html>
        `;
    }

    private getTaskPanelHtml(tasks: Task[]): string {
        const taskItems = tasks.map(task => `
            <div class="task-item ${task.status}">
                <div class="task-header">
                    <span class="task-title">${task.description}</span>
                    <span class="task-status">${this.getStatusText(task.status)}</span>
                </div>
                <div class="task-meta">
                    <span class="task-type">${this.getTypeText(task.type)}</span>
                    <span class="task-priority">${this.getPriorityText(task.priority)}</span>
                    ${task.filePath ? `<span class="task-file">${task.filePath}</span>` : ''}
                </div>
                <div class="task-actions">
                    <button onclick="completeTask('${task.id}')">完成</button>
                    <button onclick="deleteTask('${task.id}')">刪除</button>
                </div>
            </div>
        `).join('');

        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Devika 任務列表</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .task-item {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 10px;
                    border-left: 4px solid var(--vscode-button-background);
                }
                .task-item.completed {
                    opacity: 0.6;
                    border-left-color: #28a745;
                }
                .task-item.in-progress {
                    border-left-color: #ffc107;
                }
                .task-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .task-title {
                    font-weight: bold;
                }
                .task-status {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.8em;
                }
                .task-meta {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                    font-size: 0.9em;
                    opacity: 0.8;
                }
                .task-actions {
                    display: flex;
                    gap: 8px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 4px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8em;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <h2>📋 任務列表</h2>
            <div class="tasks">
                ${taskItems}
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function completeTask(taskId) {
                    vscode.postMessage({ command: 'completeTask', taskId: taskId });
                }

                function deleteTask(taskId) {
                    vscode.postMessage({ command: 'deleteTask', taskId: taskId });
                }
            </script>
        </body>
        </html>
        `;
    }

    private getAnalysisResultHtml(analysis: string, tasks: any[]): string {
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>程式碼分析結果</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                }
                .analysis {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                pre {
                    background: var(--vscode-textCodeBlock-background);
                    padding: 15px;
                    border-radius: 4px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <h2>🔍 程式碼分析結果</h2>
            <div class="analysis">
                <pre>${analysis}</pre>
            </div>
        </body>
        </html>
        `;
    }

    private getRefactorResultHtml(suggestion: string, tasks: any[]): string {
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>重構建議</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                }
                .suggestion {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .apply-btn {
                    background: #28a745;
                }
                .cancel-btn {
                    background: #6c757d;
                }
                pre {
                    background: var(--vscode-textCodeBlock-background);
                    padding: 15px;
                    border-radius: 4px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <h2>🔧 重構建議</h2>
            <div class="suggestion">
                <pre>${suggestion}</pre>
            </div>
            <div class="actions">
                <button class="apply-btn" onclick="apply()">應用重構</button>
                <button class="cancel-btn" onclick="cancel()">取消</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function apply() {
                    vscode.postMessage({ command: 'apply' });
                }

                function cancel() {
                    vscode.postMessage({ command: 'cancel' });
                }
            </script>
        </body>
        </html>
        `;
    }

    private getTestGenerationResultHtml(testCode: string, task: any): string {
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>測試生成結果</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                }
                .test-code {
                    background: var(--vscode-textCodeBlock-background);
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                pre {
                    margin: 0;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <h2>🧪 測試生成結果</h2>
            <div class="test-code">
                <pre><code>${testCode}</code></pre>
            </div>
        </body>
        </html>
        `;
    }

    private getGitSummaryHtml(summary: string, changes: string[]): string {
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Git 變更總結</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                }
                .summary {
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .changes {
                    background: var(--vscode-textCodeBlock-background);
                    border-radius: 8px;
                    padding: 20px;
                }
                pre {
                    margin: 0;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <h2>📊 Git 變更總結</h2>
            <div class="summary">
                <h3>總結</h3>
                <p>${summary}</p>
            </div>
            <div class="changes">
                <h3>變更詳情</h3>
                <pre>${changes.join('\n\n')}</pre>
            </div>
        </body>
        </html>
        `;
    }

    private getStatusText(status: string): string {
        const statusMap: { [key: string]: string } = {
            'pending': '待處理',
            'in-progress': '進行中',
            'completed': '已完成',
            'cancelled': '已取消'
        };
        return statusMap[status] || status;
    }

    private getTypeText(type: string): string {
        const typeMap: { [key: string]: string } = {
            'analysis': '分析',
            'refactor': '重構',
            'test': '測試',
            'todo': 'TODO',
            'fix': '修復',
            'feature': '功能'
        };
        return typeMap[type] || type;
    }

    private getPriorityText(priority: string): string {
        const priorityMap: { [key: string]: string } = {
            'low': '低',
            'medium': '中',
            'high': '高',
            'urgent': '緊急'
        };
        return priorityMap[priority] || priority;
    }

    async showPreview(fileName: string, content: string, message: string): Promise<boolean> {
        const previewPanel = vscode.window.createWebviewPanel(
            'devika.preview',
            `預覽: ${fileName}`,
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: false
            }
        );

        previewPanel.webview.html = this.getPreviewHtml(fileName, content, message);

        return new Promise((resolve) => {
            previewPanel.webview.onDidReceiveMessage(
                message => {
                    if (message.command === 'confirm') {
                        resolve(true);
                        previewPanel.dispose();
                    } else if (message.command === 'cancel') {
                        resolve(false);
                        previewPanel.dispose();
                    }
                },
                undefined,
                this.context.subscriptions
            );

            previewPanel.onDidDispose(() => {
                resolve(false);
            });
        });
    }

    private getPreviewHtml(fileName: string, content: string, message: string): string {
        const escapedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        return `<!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>預覽 ${fileName}</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .message {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    padding: 10px 15px;
                    margin-bottom: 20px;
                }
                .content {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 20px;
                    white-space: pre-wrap;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    overflow-x: auto;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    padding-top: 15px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                }
                .btn-primary {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .btn-primary:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .btn-secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .file-name {
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>📄 檔案預覽: <span class="file-name">${fileName}</span></h2>
            </div>

            <div class="message">
                <p>${message}</p>
            </div>

            <div class="content">${escapedContent}</div>

            <div class="actions">
                <button class="btn btn-secondary" onclick="cancel()">❌ 取消</button>
                <button class="btn btn-primary" onclick="confirm()">✅ 確認建立</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function confirm() {
                    vscode.postMessage({ command: 'confirm' });
                }

                function cancel() {
                    vscode.postMessage({ command: 'cancel' });
                }
            </script>
        </body>
        </html>`;
    }

    dispose(): void {
        if (this.mainPanel) {
            this.mainPanel.dispose();
        }
        if (this.taskPanel) {
            this.taskPanel.dispose();
        }
    }
}
