import * as vscode from 'vscode';
import { CodeUnderstandingEngine, CodeSymbol, CodeAnalysis } from './CodeUnderstandingEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';
import { FileOperationUtils } from '../utils/FileOperationUtils';

/**
 * 聊天消息類型
 */
export enum MessageType {
    USER = 'user',
    ASSISTANT = 'assistant',
    SYSTEM = 'system',
    CODE = 'code',
    ERROR = 'error'
}

/**
 * 聊天消息接口
 */
export interface ChatMessage {
    id: string;
    type: MessageType;
    content: string;
    timestamp: Date;
    context?: ChatContext;
    metadata?: Record<string, any>;
}

/**
 * 聊天上下文接口
 */
export interface ChatContext {
    currentFile?: vscode.Uri;
    selectedText?: string;
    selectedRange?: vscode.Range;
    workspaceSymbols?: CodeSymbol[];
    recentFiles?: vscode.Uri[];
    activeProject?: string;
    userIntent?: string;
}

/**
 * 聊天會話接口
 */
export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    context: ChatContext;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
}

/**
 * 智能回應接口
 */
export interface IntelligentResponse {
    content: string;
    confidence: number;
    sources: string[];
    suggestions: string[];
    codeExamples?: CodeExample[];
    relatedSymbols?: CodeSymbol[];
}

/**
 * 代碼示例接口
 */
export interface CodeExample {
    title: string;
    code: string;
    language: string;
    explanation: string;
    uri?: vscode.Uri;
    range?: vscode.Range;
}

/**
 * 智能聊天系統
 * 提供上下文感知的代碼問答和技術支援
 */
export class IntelligentChatSystem {
    private static instance: IntelligentChatSystem;
    private codeEngine: CodeUnderstandingEngine;
    private sessions: Map<string, ChatSession> = new Map();
    private currentSession: ChatSession | null = null;
    private webviewPanel: vscode.WebviewPanel | null = null;
    private messageHistory: ChatMessage[] = [];

    private constructor() {
        this.codeEngine = CodeUnderstandingEngine.getInstance();
        this.initializeDefaultSession();
    }

    static getInstance(): IntelligentChatSystem {
        if (!IntelligentChatSystem.instance) {
            IntelligentChatSystem.instance = new IntelligentChatSystem();
        }
        return IntelligentChatSystem.instance;
    }

    /**
     * 初始化默認會話
     */
    private initializeDefaultSession(): void {
        this.currentSession = {
            id: this.generateSessionId(),
            title: '新對話',
            messages: [],
            context: this.getCurrentContext(),
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: []
        };
        
        this.sessions.set(this.currentSession.id, this.currentSession);
    }

    /**
     * 啟動聊天界面
     */
    async startChat(): Promise<void> {
        if (this.webviewPanel) {
            this.webviewPanel.reveal();
            return;
        }

        this.webviewPanel = vscode.window.createWebviewPanel(
            'devikaChat',
            'Devika AI 助理',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        this.webviewPanel.webview.html = this.getChatHTML();
        this.setupWebviewMessageHandling();

        this.webviewPanel.onDidDispose(() => {
            this.webviewPanel = null;
        });

        // 發送歡迎消息
        await this.sendWelcomeMessage();
    }

    /**
     * 處理用戶消息
     */
    async handleUserMessage(content: string, context?: ChatContext): Promise<void> {
        if (!this.currentSession) {
            this.initializeDefaultSession();
        }

        // 添加用戶消息
        const userMessage: ChatMessage = {
            id: this.generateMessageId(),
            type: MessageType.USER,
            content,
            timestamp: new Date(),
            context: context || this.getCurrentContext()
        };

        this.currentSession!.messages.push(userMessage);
        this.updateWebview();

        // 生成智能回應
        const response = await this.generateIntelligentResponse(content, userMessage.context!);
        
        // 添加助理回應
        const assistantMessage: ChatMessage = {
            id: this.generateMessageId(),
            type: MessageType.ASSISTANT,
            content: response.content,
            timestamp: new Date(),
            metadata: {
                confidence: response.confidence,
                sources: response.sources,
                suggestions: response.suggestions,
                codeExamples: response.codeExamples,
                relatedSymbols: response.relatedSymbols
            }
        };

        this.currentSession!.messages.push(assistantMessage);
        this.currentSession!.updatedAt = new Date();
        this.updateWebview();
    }

    /**
     * 生成智能回應
     */
    private async generateIntelligentResponse(
        userInput: string,
        context: ChatContext
    ): Promise<IntelligentResponse> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                // 分析用戶意圖
                const intent = this.analyzeUserIntent(userInput);
                
                // 根據意圖生成回應
                switch (intent) {
                    case 'code_explanation':
                        return this.explainCode(userInput, context);
                    case 'code_generation':
                        return this.generateCode(userInput, context);
                    case 'debugging':
                        return this.helpDebug(userInput, context);
                    case 'refactoring':
                        return this.suggestRefactoring(userInput, context);
                    case 'documentation':
                        return this.generateDocumentation(userInput, context);
                    case 'testing':
                        return this.suggestTests(userInput, context);
                    default:
                        return this.generateGeneralResponse(userInput, context);
                }
            },
            '生成智能回應',
            { logError: true, showToUser: false }
        );

        return result.success ? result.data! : this.createErrorResponse();
    }

    /**
     * 分析用戶意圖
     */
    private analyzeUserIntent(input: string): string {
        const lowerInput = input.toLowerCase();
        
        if (lowerInput.includes('explain') || lowerInput.includes('what does') || lowerInput.includes('how does')) {
            return 'code_explanation';
        }
        if (lowerInput.includes('generate') || lowerInput.includes('create') || lowerInput.includes('write')) {
            return 'code_generation';
        }
        if (lowerInput.includes('debug') || lowerInput.includes('error') || lowerInput.includes('fix')) {
            return 'debugging';
        }
        if (lowerInput.includes('refactor') || lowerInput.includes('improve') || lowerInput.includes('optimize')) {
            return 'refactoring';
        }
        if (lowerInput.includes('document') || lowerInput.includes('comment')) {
            return 'documentation';
        }
        if (lowerInput.includes('test') || lowerInput.includes('unit test')) {
            return 'testing';
        }
        
        return 'general';
    }

    /**
     * 解釋代碼
     */
    private async explainCode(input: string, context: ChatContext): Promise<IntelligentResponse> {
        const codeToExplain = context.selectedText || '';
        const currentFile = context.currentFile;
        
        if (!codeToExplain || !currentFile) {
            return {
                content: '請選擇要解釋的代碼片段。',
                confidence: 0.9,
                sources: [],
                suggestions: ['選擇代碼片段後再次詢問']
            };
        }

        const analysis = await this.codeEngine.analyzeFile(currentFile);
        const explanation = this.generateCodeExplanation(codeToExplain, analysis);
        
        return {
            content: explanation,
            confidence: 0.8,
            sources: [currentFile.fsPath],
            suggestions: [
                '需要更詳細的解釋嗎？',
                '想了解相關的設計模式嗎？',
                '需要重構建議嗎？'
            ],
            relatedSymbols: analysis.symbols.slice(0, 5)
        };
    }

    /**
     * 生成代碼
     */
    private async generateCode(input: string, context: ChatContext): Promise<IntelligentResponse> {
        const codeExample = this.createCodeExample(input, context);
        
        return {
            content: `基於您的需求，我為您生成了以下代碼：`,
            confidence: 0.7,
            sources: [],
            suggestions: [
                '需要修改這個實現嗎？',
                '想添加錯誤處理嗎？',
                '需要單元測試嗎？'
            ],
            codeExamples: [codeExample]
        };
    }

    /**
     * 調試幫助
     */
    private async helpDebug(input: string, context: ChatContext): Promise<IntelligentResponse> {
        const currentFile = context.currentFile;
        
        if (!currentFile) {
            return {
                content: '請打開要調試的文件。',
                confidence: 0.9,
                sources: [],
                suggestions: ['打開文件後再次詢問']
            };
        }

        const analysis = await this.codeEngine.analyzeFile(currentFile);
        const debugSuggestions = this.generateDebugSuggestions(analysis);
        
        return {
            content: debugSuggestions,
            confidence: 0.75,
            sources: [currentFile.fsPath],
            suggestions: [
                '需要查看具體的錯誤日誌嗎？',
                '想了解調試技巧嗎？',
                '需要添加日誌語句嗎？'
            ]
        };
    }

    /**
     * 重構建議
     */
    private async suggestRefactoring(input: string, context: ChatContext): Promise<IntelligentResponse> {
        const currentFile = context.currentFile;
        
        if (!currentFile) {
            return {
                content: '請打開要重構的文件。',
                confidence: 0.9,
                sources: [],
                suggestions: ['打開文件後再次詢問']
            };
        }

        const analysis = await this.codeEngine.analyzeFile(currentFile);
        const refactoringSuggestions = this.generateRefactoringSuggestions(analysis);
        
        return {
            content: refactoringSuggestions,
            confidence: 0.8,
            sources: [currentFile.fsPath],
            suggestions: [
                '需要具體的重構步驟嗎？',
                '想了解設計模式嗎？',
                '需要性能優化建議嗎？'
            ]
        };
    }

    /**
     * 生成文檔
     */
    private async generateDocumentation(input: string, context: ChatContext): Promise<IntelligentResponse> {
        const selectedCode = context.selectedText || '';
        const documentation = this.generateCodeDocumentation(selectedCode);
        
        return {
            content: documentation,
            confidence: 0.85,
            sources: [],
            suggestions: [
                '需要更詳細的文檔嗎？',
                '想添加使用示例嗎？',
                '需要 JSDoc 格式嗎？'
            ]
        };
    }

    /**
     * 測試建議
     */
    private async suggestTests(input: string, context: ChatContext): Promise<IntelligentResponse> {
        const selectedCode = context.selectedText || '';
        const testSuggestions = this.generateTestSuggestions(selectedCode);
        
        return {
            content: testSuggestions,
            confidence: 0.8,
            sources: [],
            suggestions: [
                '需要具體的測試代碼嗎？',
                '想了解測試策略嗎？',
                '需要模擬對象嗎？'
            ]
        };
    }

    /**
     * 一般回應
     */
    private async generateGeneralResponse(input: string, context: ChatContext): Promise<IntelligentResponse> {
        return {
            content: `我理解您的問題。基於當前的代碼上下文，我可以幫助您：\n\n` +
                    `• 解釋代碼功能\n` +
                    `• 生成代碼片段\n` +
                    `• 調試問題\n` +
                    `• 重構建議\n` +
                    `• 編寫文檔\n` +
                    `• 測試建議\n\n` +
                    `請告訴我您具體需要什麼幫助？`,
            confidence: 0.6,
            sources: [],
            suggestions: [
                '解釋選中的代碼',
                '生成單元測試',
                '重構建議',
                '調試幫助'
            ]
        };
    }

    /**
     * 獲取當前上下文
     */
    private getCurrentContext(): ChatContext {
        const activeEditor = vscode.window.activeTextEditor;
        
        return {
            currentFile: activeEditor?.document.uri,
            selectedText: activeEditor?.document.getText(activeEditor.selection),
            selectedRange: activeEditor?.selection,
            workspaceSymbols: [],
            recentFiles: [],
            activeProject: vscode.workspace.name
        };
    }

    /**
     * 輔助方法
     */
    private generateSessionId(): string {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateMessageId(): string {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateCodeExplanation(code: string, analysis: CodeAnalysis): string {
        return `這段代碼的功能是：\n\n${code}\n\n` +
               `複雜度：${analysis.complexity}\n` +
               `可維護性指數：${analysis.maintainabilityIndex}\n` +
               `發現的問題：${analysis.issues.length} 個`;
    }

    private createCodeExample(input: string, context: ChatContext): CodeExample {
        return {
            title: '生成的代碼示例',
            code: `// 基於您的需求生成的代碼\nfunction example() {\n    // TODO: 實現具體邏輯\n}`,
            language: 'typescript',
            explanation: '這是一個基本的函數模板，您可以根據需要進行修改。'
        };
    }

    private generateDebugSuggestions(analysis: CodeAnalysis): string {
        const issues = analysis.issues;
        if (issues.length === 0) {
            return '代碼看起來沒有明顯的問題。建議檢查：\n• 變量初始化\n• 邊界條件\n• 異常處理';
        }
        
        return `發現 ${issues.length} 個潛在問題：\n` +
               issues.slice(0, 3).map(issue => `• ${issue.message}`).join('\n');
    }

    private generateRefactoringSuggestions(analysis: CodeAnalysis): string {
        return `重構建議：\n` +
               `• 複雜度：${analysis.complexity} ${analysis.complexity > 10 ? '(建議簡化)' : '(良好)'}\n` +
               `• 可維護性：${analysis.maintainabilityIndex} ${analysis.maintainabilityIndex < 50 ? '(需要改進)' : '(良好)'}\n` +
               `• 建議提取重複代碼到共用函數\n` +
               `• 考慮使用設計模式簡化結構`;
    }

    private generateCodeDocumentation(code: string): string {
        return `/**\n * 函數描述\n * @param {type} param - 參數描述\n * @returns {type} 返回值描述\n */\n${code}`;
    }

    private generateTestSuggestions(code: string): string {
        return `測試建議：\n` +
               `• 測試正常情況\n` +
               `• 測試邊界條件\n` +
               `• 測試錯誤情況\n` +
               `• 測試性能\n\n` +
               `建議使用 Jest 或 Mocha 框架進行單元測試。`;
    }

    private createErrorResponse(): IntelligentResponse {
        return {
            content: '抱歉，處理您的請求時出現了問題。請稍後重試。',
            confidence: 0,
            sources: [],
            suggestions: ['重新提問', '檢查網絡連接']
        };
    }

    private async sendWelcomeMessage(): Promise<void> {
        const welcomeMessage: ChatMessage = {
            id: this.generateMessageId(),
            type: MessageType.SYSTEM,
            content: '歡迎使用 Devika AI 助理！我可以幫助您：\n\n' +
                    '• 解釋和分析代碼\n' +
                    '• 生成代碼片段\n' +
                    '• 調試和修復問題\n' +
                    '• 重構和優化建議\n' +
                    '• 編寫文檔和測試\n\n' +
                    '請告訴我您需要什麼幫助？',
            timestamp: new Date()
        };

        this.currentSession!.messages.push(welcomeMessage);
        this.updateWebview();
    }

    private setupWebviewMessageHandling(): void {
        this.webviewPanel!.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this.handleUserMessage(message.content);
                    break;
                case 'clearChat':
                    this.clearCurrentSession();
                    break;
            }
        });
    }

    private getChatHTML(): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Devika AI 助理</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .chat-container { max-width: 800px; margin: 0 auto; }
                .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
                .user { background-color: #e3f2fd; text-align: right; }
                .assistant { background-color: #f5f5f5; }
                .system { background-color: #fff3e0; font-style: italic; }
                .input-container { position: fixed; bottom: 0; left: 0; right: 0; padding: 20px; background: white; border-top: 1px solid #ccc; }
                .input-box { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 5px; }
                .send-button { margin-top: 10px; padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div id="messages"></div>
            </div>
            <div class="input-container">
                <input type="text" id="messageInput" class="input-box" placeholder="輸入您的問題...">
                <button onclick="sendMessage()" class="send-button">發送</button>
            </div>
            <script>
                function sendMessage() {
                    const input = document.getElementById('messageInput');
                    const message = input.value.trim();
                    if (message) {
                        vscode.postMessage({ command: 'sendMessage', content: message });
                        input.value = '';
                    }
                }
                
                document.getElementById('messageInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            </script>
        </body>
        </html>`;
    }

    private updateWebview(): void {
        if (this.webviewPanel && this.currentSession) {
            // 更新 webview 內容
            // 這裡需要實現具體的消息更新邏輯
        }
    }

    private clearCurrentSession(): void {
        if (this.currentSession) {
            this.currentSession.messages = [];
            this.updateWebview();
        }
    }
}
