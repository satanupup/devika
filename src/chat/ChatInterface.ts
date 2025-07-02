import * as vscode from 'vscode';
import { LLMService } from '../llm/LLMService';
import { ToolManager } from '../tools/ToolManager';
import { ModeManager } from '../modes/ModeManager';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: {
        mode?: string;
        toolCalls?: ToolCall[];
        tokens?: number;
        model?: string;
        error?: string;
    };
}

export interface ToolCall {
    id: string;
    name: string;
    parameters: any;
    result?: any;
    error?: string;
    approved?: boolean;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
    mode: string;
    context?: {
        workspaceFolder?: string;
        activeFile?: string;
        selectedText?: string;
    };
}

export class ChatInterface {
    private panel: vscode.WebviewPanel | undefined;
    private currentSession: ChatSession | undefined;
    private sessions: Map<string, ChatSession> = new Map();
    private llmService: LLMService;
    private toolManager: ToolManager;
    private modeManager: ModeManager;

    private onMessageEmitter = new vscode.EventEmitter<ChatMessage>();
    public readonly onMessage = this.onMessageEmitter.event;

    constructor(
        private context: vscode.ExtensionContext,
        llmService: LLMService,
        toolManager: ToolManager,
        modeManager: ModeManager
    ) {
        this.llmService = llmService;
        this.toolManager = toolManager;
        this.modeManager = modeManager;
        this.loadSessions();
    }

    /**
     * 顯示聊天界面
     */
    async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'devikaChat',
            'Devika AI Assistant',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'out')
                ]
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.setupWebviewMessageHandling();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // 如果沒有當前會話，創建新會話
        if (!this.currentSession) {
            await this.createNewSession();
        }

        // 發送初始數據到 webview
        await this.sendToWebview('init', {
            sessions: Array.from(this.sessions.values()),
            currentSession: this.currentSession,
            modes: this.modeManager.getAllModes(),
            currentMode: this.modeManager.getCurrentMode()
        });
    }

    /**
     * 創建新的聊天會話
     */
    async createNewSession(title?: string): Promise<ChatSession> {
        const session: ChatSession = {
            id: this.generateId(),
            title: title || `會話 ${this.sessions.size + 1}`,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            mode: this.modeManager.getCurrentMode().id,
            context: this.getCurrentContext()
        };

        this.sessions.set(session.id, session);
        this.currentSession = session;
        await this.saveSessions();

        return session;
    }

    /**
     * 切換到指定會話
     */
    async switchToSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.currentSession = session;
            await this.sendToWebview('sessionChanged', session);
        }
    }

    /**
     * 發送用戶消息
     */
    async sendUserMessage(content: string): Promise<void> {
        if (!this.currentSession) {
            await this.createNewSession();
        }

        const userMessage: ChatMessage = {
            id: this.generateId(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
            metadata: {
                mode: this.modeManager.getCurrentMode().id
            }
        };

        this.currentSession!.messages.push(userMessage);
        this.currentSession!.updatedAt = new Date();

        // 更新會話標題（如果是第一條消息）
        if (this.currentSession!.messages.length === 1) {
            this.currentSession!.title = this.generateSessionTitle(content);
        }

        await this.sendToWebview('messageAdded', userMessage);
        this.onMessageEmitter.fire(userMessage);

        // 處理 AI 回應
        await this.processAIResponse(content);
    }

    /**
     * 處理 AI 回應
     */
    private async processAIResponse(userInput: string): Promise<void> {
        if (!this.currentSession) return;

        const currentMode = this.modeManager.getCurrentMode();

        // 顯示正在輸入指示器
        await this.sendToWebview('typingStart', {});

        try {
            // 構建對話上下文
            const conversationHistory = this.buildConversationHistory();

            // 根據當前模式構建提示
            const prompt = await this.buildPrompt(userInput, currentMode, conversationHistory);

            // 調用 LLM
            const response = await this.llmService.generateCompletion(prompt);

            // 解析回應中的工具調用
            const { content, toolCalls } = await this.parseResponse(response.content);

            // 創建助手消息
            const assistantMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: content,
                timestamp: new Date(),
                metadata: {
                    mode: currentMode.id,
                    toolCalls: toolCalls,
                    model: response.model
                }
            };

            this.currentSession.messages.push(assistantMessage);
            this.currentSession.updatedAt = new Date();

            await this.sendToWebview('messageAdded', assistantMessage);
            this.onMessageEmitter.fire(assistantMessage);

            // 執行工具調用
            if (toolCalls && toolCalls.length > 0) {
                await this.executeToolCalls(toolCalls, assistantMessage);
            }

        } catch (error) {
            const errorMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: `抱歉，處理您的請求時發生錯誤：${error}`,
                timestamp: new Date(),
                metadata: {
                    mode: currentMode.id,
                    error: String(error)
                }
            };

            this.currentSession.messages.push(errorMessage);
            await this.sendToWebview('messageAdded', errorMessage);
            this.onMessageEmitter.fire(errorMessage);

        } finally {
            await this.sendToWebview('typingEnd', {});
            await this.saveSessions();
        }
    }

    /**
     * 構建對話歷史
     */
    private buildConversationHistory(): string {
        if (!this.currentSession) return '';

        const recentMessages = this.currentSession.messages.slice(-10); // 最近10條消息
        return recentMessages.map(msg =>
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
    }

    /**
     * 構建提示
     */
    private async buildPrompt(userInput: string, mode: any, conversationHistory: string): Promise<string> {
        const context = this.getCurrentContext();

        let prompt = `${mode.systemPrompt}\n\n`;

        if (context) {
            if (context.workspaceFolder) {
                prompt += `當前工作區: ${context.workspaceFolder}\n`;
            }

            if (context.activeFile) {
                prompt += `當前文件: ${context.activeFile}\n`;
            }

            if (context.selectedText) {
                prompt += `選中的文本:\n${context.selectedText}\n`;
            }
        }

        if (conversationHistory) {
            prompt += `\n對話歷史:\n${conversationHistory}\n\n`;
        }

        prompt += `用戶請求: ${userInput}\n\n`;
        prompt += `請根據當前模式 (${mode.name}) 的要求回應用戶。如果需要執行操作，請使用適當的工具。`;

        return prompt;
    }

    /**
     * 解析 AI 回應中的工具調用
     */
    private async parseResponse(content: string): Promise<{ content: string; toolCalls?: ToolCall[] }> {
        // 簡化的工具調用解析
        const toolCallRegex = /<tool_call name="([^"]+)" parameters="([^"]+)">([^<]*)<\/tool_call>/g;
        const toolCalls: ToolCall[] = [];
        let cleanContent = content;

        let match;
        while ((match = toolCallRegex.exec(content)) !== null) {
            const [fullMatch, toolName, parametersStr, description] = match;

            try {
                const parameters = JSON.parse(parametersStr);
                toolCalls.push({
                    id: this.generateId(),
                    name: toolName,
                    parameters,
                    approved: false
                });

                // 從內容中移除工具調用標記
                cleanContent = cleanContent.replace(fullMatch, `[將執行: ${toolName}]`);
            } catch (error) {
                console.error('解析工具調用參數失敗:', error);
            }
        }

        return { content: cleanContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    }

    /**
     * 執行工具調用
     */
    private async executeToolCalls(toolCalls: ToolCall[], message: ChatMessage): Promise<void> {
        for (const toolCall of toolCalls) {
            try {
                // 檢查是否需要用戶批准
                const tool = this.toolManager.getTool(toolCall.name);
                if (tool && tool.requiresApproval) {
                    const approved = await this.requestToolApproval(toolCall);
                    if (!approved) {
                        toolCall.error = '用戶拒絕執行此操作';
                        continue;
                    }
                }

                // 執行工具
                const result = await this.toolManager.executeTool(toolCall.name, toolCall.parameters);
                toolCall.result = result;
                toolCall.approved = true;

                // 發送工具執行結果到 webview
                await this.sendToWebview('toolExecuted', { toolCall, result });

            } catch (error) {
                toolCall.error = String(error);
                await this.sendToWebview('toolError', { toolCall, error: String(error) });
            }
        }

        // 更新消息的工具調用狀態
        message.metadata!.toolCalls = toolCalls;
        await this.sendToWebview('messageUpdated', message);
    }

    /**
     * 請求工具執行批准
     */
    private async requestToolApproval(toolCall: ToolCall): Promise<boolean> {
        const action = await vscode.window.showWarningMessage(
            `AI 想要執行 "${toolCall.name}" 操作。是否允許？`,
            { modal: true },
            '允許',
            '拒絕'
        );

        return action === '允許';
    }

    /**
     * 設置 Webview 消息處理
     */
    private setupWebviewMessageHandling(): void {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'sendMessage':
                    await this.sendUserMessage(message.content);
                    break;

                case 'switchSession':
                    await this.switchToSession(message.sessionId);
                    break;

                case 'newSession':
                    await this.createNewSession();
                    await this.sendToWebview('sessionChanged', this.currentSession);
                    break;

                case 'deleteSession':
                    await this.deleteSession(message.sessionId);
                    break;

                case 'switchMode':
                    await this.modeManager.switchMode(message.modeId);
                    await this.sendToWebview('modeChanged', this.modeManager.getCurrentMode());
                    break;

                case 'clearSession':
                    if (this.currentSession) {
                        this.currentSession.messages = [];
                        await this.sendToWebview('sessionCleared', {});
                    }
                    break;

                case 'exportSession':
                    await this.exportSession(message.sessionId);
                    break;
            }
        });
    }

    /**
     * 發送消息到 Webview
     */
    private async sendToWebview(type: string, data: any): Promise<void> {
        if (this.panel) {
            await this.panel.webview.postMessage({ type, data });
        }
    }

    /**
     * 獲取當前上下文
     */
    private getCurrentContext(): ChatSession['context'] {
        const activeEditor = vscode.window.activeTextEditor;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        return {
            workspaceFolder: workspaceFolder?.uri.fsPath,
            activeFile: activeEditor?.document.fileName,
            selectedText: activeEditor?.document.getText(activeEditor.selection)
        };
    }

    /**
     * 生成會話標題
     */
    private generateSessionTitle(firstMessage: string): string {
        const words = firstMessage.split(' ').slice(0, 5);
        return words.join(' ') + (firstMessage.split(' ').length > 5 ? '...' : '');
    }

    /**
     * 刪除會話
     */
    private async deleteSession(sessionId: string): Promise<void> {
        this.sessions.delete(sessionId);

        if (this.currentSession?.id === sessionId) {
            // 切換到其他會話或創建新會話
            const remainingSessions = Array.from(this.sessions.values());
            if (remainingSessions.length > 0) {
                this.currentSession = remainingSessions[0];
            } else {
                await this.createNewSession();
            }
            await this.sendToWebview('sessionChanged', this.currentSession);
        }

        await this.saveSessions();
        await this.sendToWebview('sessionDeleted', { sessionId });
    }

    /**
     * 導出會話
     */
    private async exportSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const content = this.generateSessionExport(session);

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${session.title}.md`),
            filters: {
                'Markdown': ['md'],
                'Text': ['txt']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage(`會話已導出到 ${uri.fsPath}`);
        }
    }

    /**
     * 生成會話導出內容
     */
    private generateSessionExport(session: ChatSession): string {
        let content = `# ${session.title}\n\n`;
        content += `**創建時間**: ${session.createdAt.toLocaleString()}\n`;
        content += `**模式**: ${session.mode}\n\n`;

        for (const message of session.messages) {
            const role = message.role === 'user' ? '👤 用戶' : '🤖 助手';
            content += `## ${role} (${message.timestamp.toLocaleString()})\n\n`;
            content += `${message.content}\n\n`;

            if (message.metadata?.toolCalls) {
                content += `**執行的操作**:\n`;
                for (const toolCall of message.metadata.toolCalls) {
                    content += `- ${toolCall.name}: ${JSON.stringify(toolCall.parameters)}\n`;
                }
                content += '\n';
            }
        }

        return content;
    }

    /**
     * 保存會話
     */
    private async saveSessions(): Promise<void> {
        const sessionsData = Array.from(this.sessions.values());
        await this.context.globalState.update('chatSessions', sessionsData);
    }

    /**
     * 載入會話
     */
    private loadSessions(): void {
        const sessionsData = this.context.globalState.get<ChatSession[]>('chatSessions', []);

        for (const session of sessionsData) {
            // 恢復日期對象
            session.createdAt = new Date(session.createdAt);
            session.updatedAt = new Date(session.updatedAt);
            session.messages.forEach(msg => {
                msg.timestamp = new Date(msg.timestamp);
            });

            this.sessions.set(session.id, session);
        }

        // 設置最近的會話為當前會話
        if (sessionsData.length > 0) {
            const mostRecent = sessionsData.reduce((latest, session) =>
                session.updatedAt > latest.updatedAt ? session : latest
            );
            this.currentSession = this.sessions.get(mostRecent.id);
        }
    }

    /**
     * 生成唯一 ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 獲取 Webview HTML 內容
     */
    private getWebviewContent(): string {
        // 這裡會返回完整的 HTML 內容
        // 由於內容較長，我們將在下一個文件中實作
        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Devika AI Assistant</title>
            <style>
                /* 基本樣式，完整樣式將在 ChatWebview.html 中實作 */
                body {
                    font-family: var(--vscode-font-family);
                    margin: 0;
                    padding: 20px;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .chat-container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                .message {
                    margin: 10px 0;
                    padding: 10px;
                    border-radius: 8px;
                }
                .user-message {
                    background: var(--vscode-button-background);
                    margin-left: 20%;
                }
                .assistant-message {
                    background: var(--vscode-editor-selectionBackground);
                    margin-right: 20%;
                }
                .input-container {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 20px;
                    background: var(--vscode-editor-background);
                    border-top: 1px solid var(--vscode-panel-border);
                }
                .input-box {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--vscode-input-border);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div id="messages"></div>
            </div>
            <div class="input-container">
                <input type="text" id="messageInput" class="input-box" placeholder="輸入您的消息..." />
            </div>
            <script>
                // 基本 JavaScript，完整腳本將在 ChatWebview.js 中實作
                const vscode = acquireVsCodeApi();

                document.getElementById('messageInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        const message = this.value.trim();
                        if (message) {
                            vscode.postMessage({ type: 'sendMessage', content: message });
                            this.value = '';
                        }
                    }
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'messageAdded':
                            addMessage(message.data);
                            break;
                        case 'typingStart':
                            showTyping();
                            break;
                        case 'typingEnd':
                            hideTyping();
                            break;
                    }
                });

                function addMessage(message) {
                    const messagesDiv = document.getElementById('messages');
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message ' + (message.role === 'user' ? 'user-message' : 'assistant-message');
                    messageDiv.textContent = message.content;
                    messagesDiv.appendChild(messageDiv);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }

                function showTyping() {
                    // 顯示正在輸入指示器
                }

                function hideTyping() {
                    // 隱藏正在輸入指示器
                }
            </script>
        </body>
        </html>`;
    }

    /**
     * 清理資源
     */
    dispose(): void {
        this.onMessageEmitter.dispose();
        if (this.panel) {
            this.panel.dispose();
        }
    }
}
