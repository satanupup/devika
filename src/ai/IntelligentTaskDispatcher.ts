import * as vscode from 'vscode';
import { LLMService } from '../llm/LLMService';
import { ConfigManager } from '../config/ConfigManager';
import { ProjectAnalyzer } from '../agent/ProjectAnalyzer';
import { GitService } from '../git/GitService';
import { CodeContextService } from '../context/CodeContextService';
import { SmartCodeAnalyzer } from './SmartCodeAnalyzer';

export interface UserIntent {
    type: 'code_analysis' | 'project_overview' | 'git_history' | 'file_search' | 'refactor' | 'debug' | 'general';
    confidence: number;
    parameters: any;
    requiredActions: string[];
}

export interface TaskResult {
    success: boolean;
    data: any;
    message: string;
    nextSuggestions?: string[];
}

export class IntelligentTaskDispatcher {
    private llmService: LLMService;
    private projectAnalyzer: ProjectAnalyzer;
    private gitService: GitService;
    private codeContextService: CodeContextService;
    private smartCodeAnalyzer: SmartCodeAnalyzer;
    private projectIndexed: boolean = false;

    constructor(
        llmService: LLMService,
        codeContextService: CodeContextService
    ) {
        this.llmService = llmService;
        this.projectAnalyzer = new ProjectAnalyzer();
        this.gitService = new GitService();
        this.codeContextService = codeContextService;
        this.smartCodeAnalyzer = new SmartCodeAnalyzer(llmService);
    }

    async processUserQuery(query: string): Promise<string> {
        try {
            console.log('🔍 處理用戶查詢:', query);

            // 1. 確保項目已索引
            await this.ensureProjectIndexed();

            // 2. 分析用戶意圖
            const intent = await this.analyzeUserIntent(query);
            console.log('🎯 分析意圖結果:', intent);

            // 3. 自動執行相應任務
            const result = await this.executeTasksForIntent(intent, query);
            console.log('⚡ 任務執行結果:', result);

            // 4. 生成智能回應
            const response = await this.generateIntelligentResponse(query, intent, result);
            console.log('💬 生成回應:', response.substring(0, 100) + '...');

            return response;

        } catch (error) {
            console.error('❌ 處理用戶查詢失敗:', error);
            return `抱歉，處理您的請求時遇到問題：${error}`;
        }
    }

    private async ensureProjectIndexed(): Promise<void> {
        if (this.projectIndexed) {
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        // 顯示索引進度
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "🧠 Devika 正在理解您的項目...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "建立代碼索引..." });

            // 索引所有工作區
            for (let i = 0; i < workspaceFolders.length; i++) {
                const folder = workspaceFolders[i];
                await this.codeContextService.indexWorkspace(folder);
                progress.report({ 
                    increment: (i + 1) / workspaceFolders.length * 50, 
                    message: `索引工作區 ${i + 1}/${workspaceFolders.length}...` 
                });
            }

            progress.report({ increment: 75, message: "分析項目結構..." });
            // 分析項目結構（但不顯示UI）
            await this.projectAnalyzer.analyzeProject();

            progress.report({ increment: 100, message: "完成！" });
        });

        this.projectIndexed = true;
        vscode.window.showInformationMessage("✅ Devika 已準備就緒！現在我完全理解您的項目了。");
    }

    private async analyzeUserIntent(query: string): Promise<UserIntent> {
        const prompt = `
分析以下用戶查詢的意圖，並返回JSON格式的結果：

用戶查詢: "${query}"

請分析用戶想要做什麼，並分類為以下類型之一：
- code_analysis: 分析代碼、查找問題、代碼審查
- project_overview: 了解項目結構、統計信息、整體概覽
- git_history: 查看提交歷史、變更記錄、版本信息
- file_search: 查找文件、搜索代碼、定位功能
- refactor: 重構代碼、優化結構、改進設計
- debug: 調試問題、查找bug、錯誤分析
- general: 一般對話、幫助信息

返回格式：
{
  "type": "分類類型",
  "confidence": 0.8,
  "parameters": {
    "具體參數": "值"
  },
  "requiredActions": ["需要執行的動作列表"]
}
        `;

        try {
            const response = await this.llmService.generateCompletion(prompt);
            const intent = JSON.parse(response.content);
            return intent;
        } catch (error) {
            // 如果AI分析失敗，使用關鍵詞匹配作為後備
            return this.fallbackIntentAnalysis(query);
        }
    }

    private fallbackIntentAnalysis(query: string): UserIntent {
        const lowerQuery = query.toLowerCase();

        // 項目相關關鍵詞 (中英文)
        if (lowerQuery.includes('項目') || lowerQuery.includes('結構') || lowerQuery.includes('概覽') ||
            lowerQuery.includes('project') || lowerQuery.includes('structure') || lowerQuery.includes('overview') ||
            lowerQuery.includes('專案') || lowerQuery.includes('分析整個') || lowerQuery.includes('建立請讀我')) {
            return {
                type: 'project_overview',
                confidence: 0.8,
                parameters: {},
                requiredActions: ['analyze_project_structure']
            };
        }

        // Git 相關關鍵詞
        if (lowerQuery.includes('git') || lowerQuery.includes('提交') || lowerQuery.includes('歷史') ||
            lowerQuery.includes('commit') || lowerQuery.includes('history') || lowerQuery.includes('變更')) {
            return {
                type: 'git_history',
                confidence: 0.8,
                parameters: {},
                requiredActions: ['get_git_history']
            };
        }

        // 代碼分析相關
        if (lowerQuery.includes('代碼') || lowerQuery.includes('分析') || lowerQuery.includes('函數') ||
            lowerQuery.includes('code') || lowerQuery.includes('analyze') || lowerQuery.includes('function') ||
            lowerQuery.includes('程式碼') || lowerQuery.includes('方法')) {
            return {
                type: 'code_analysis',
                confidence: 0.8,
                parameters: {},
                requiredActions: ['analyze_code_context']
            };
        }

        // 文件搜索相關
        if (lowerQuery.includes('文件') || lowerQuery.includes('搜索') || lowerQuery.includes('查找') ||
            lowerQuery.includes('file') || lowerQuery.includes('search') || lowerQuery.includes('find')) {
            return {
                type: 'file_search',
                confidence: 0.8,
                parameters: { searchTerm: query },
                requiredActions: ['search_files']
            };
        }

        // 問候和身份相關
        if (lowerQuery.includes('你好') || lowerQuery.includes('hello') || lowerQuery.includes('hi') ||
            lowerQuery.includes('哪家公司') || lowerQuery.includes('什麼') || lowerQuery.includes('who') ||
            lowerQuery.includes('what') || lowerQuery.includes('你是')) {
            return {
                type: 'general',
                confidence: 0.9,
                parameters: { isGreeting: true },
                requiredActions: ['general_response']
            };
        }

        return {
            type: 'general',
            confidence: 0.6,
            parameters: {},
            requiredActions: ['general_response']
        };
    }

    private async executeTasksForIntent(intent: UserIntent, originalQuery: string): Promise<TaskResult> {
        const results: any = {};

        try {
            for (const action of intent.requiredActions) {
                switch (action) {
                    case 'analyze_project_structure':
                        results.projectStructure = await this.projectAnalyzer.analyzeProject();
                        break;

                    case 'get_git_history':
                        results.gitHistory = await this.gitService.getCommitHistory(10);
                        break;

                    case 'analyze_code_context':
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            results.codeAnalysis = await this.smartCodeAnalyzer.analyzeCode(editor.document);
                        }
                        break;

                    case 'search_files':
                        results.searchResults = await this.searchInProject(intent.parameters.searchTerm);
                        break;

                    case 'general_response':
                        // 對於一般查詢，收集基本項目信息
                        results.projectInfo = await this.getBasicProjectInfo();
                        break;
                }
            }

            return {
                success: true,
                data: results,
                message: '任務執行成功',
                nextSuggestions: this.generateNextSuggestions(intent)
            };

        } catch (error) {
            return {
                success: false,
                data: {},
                message: `執行任務時出錯: ${error}`
            };
        }
    }

    private async generateIntelligentResponse(
        originalQuery: string, 
        intent: UserIntent, 
        result: TaskResult
    ): Promise<string> {
        const prompt = `
用戶問題: "${originalQuery}"
意圖類型: ${intent.type}
執行結果: ${JSON.stringify(result.data, null, 2)}

請基於以上信息生成一個智能、有用的回應。要求：
1. 直接回答用戶的問題
2. 提供具體的數據和見解
3. 如果適當，提供後續建議
4. 使用友好、專業的語調
5. 用繁體中文回應

如果有具體的數據，請整理成易讀的格式。
        `;

        try {
            console.log('🤖 調用 LLM 服務...');
            const response = await this.llmService.generateCompletion(prompt);
            console.log('✅ LLM 回應成功');
            return response.content;
        } catch (error) {
            console.error('❌ LLM 調用失敗:', error);
            console.log('🔄 使用後備回應');
            return this.generateFallbackResponse(intent, result);
        }
    }

    private generateFallbackResponse(intent: UserIntent, result: TaskResult): string {
        if (!result.success) {
            return `抱歉，處理您的請求時遇到問題：${result.message}`;
        }

        switch (intent.type) {
            case 'project_overview':
                const project = result.data.projectStructure;
                return `📊 **項目概覽**\n\n` +
                       `• 總文件數: ${project?.files?.length || 0}\n` +
                       `• 目錄數: ${project?.directories?.length || 0}\n` +
                       `• 依賴項: ${project?.dependencies?.length || 0}\n` +
                       `• 總行數: ${project?.metrics?.totalLines || 0}`;

            case 'git_history':
                const history = result.data.gitHistory;
                return `📜 **最近的提交記錄**\n\n` +
                       history?.slice(0, 5).map((commit: any) =>
                           `• ${commit.hash.substring(0, 8)}: ${commit.message}`
                       ).join('\n') || '沒有找到 Git 歷史記錄';

            case 'code_analysis':
                return `🔍 **代碼分析**\n\n我已經分析了相關的代碼內容。請告訴我您想了解代碼的哪個方面？`;

            case 'file_search':
                const searchResults = result.data.searchResults;
                return `🔍 **搜索結果**\n\n找到 ${searchResults?.count || 0} 個相關項目。`;

            default:
                // 對於一般查詢，嘗試直接使用 LLM 回應
                return this.handleGeneralQuery(intent, result);
        }
    }

    private handleGeneralQuery(intent: UserIntent, result: TaskResult): string {
        // 處理問候和身份相關問題
        if (intent.parameters?.isGreeting) {
            return `👋 您好！我是 Devika AI 助理。\n\n` +
                   `我是基於多種先進 AI 模型的智能開發助理，包括：\n` +
                   `• 🤖 OpenAI GPT 系列\n` +
                   `• 🧠 Anthropic Claude 系列\n` +
                   `• 💎 Google Gemini 系列\n\n` +
                   `我專門幫助您進行程式開發，可以：\n` +
                   `• 📊 分析項目結構和代碼\n` +
                   `• 🔍 搜索和理解代碼邏輯\n` +
                   `• 📜 查看 Git 歷史和變更\n` +
                   `• 🛠️ 提供重構和優化建議\n\n` +
                   `您可以直接問我任何開發相關的問題！`;
        }

        // 如果有項目信息，提供基本的項目狀態
        if (result.data.projectInfo) {
            const info = result.data.projectInfo;
            return `📁 **當前工作區**: ${info.workspaceName || '未知'}\n` +
                   `📄 **打開的文件**: ${info.openFiles || 0} 個\n\n` +
                   `我已經準備好幫助您分析這個項目。請告訴我您想了解什麼？\n\n` +
                   `💡 **建議**：\n` +
                   `• "分析整個項目結構"\n` +
                   `• "查看最近的 Git 變更"\n` +
                   `• "有什麼 TODO 需要處理？"\n` +
                   `• "這個項目是做什麼的？"`;
        }

        return `👋 您好！我是 Devika AI 助理，專門幫助您進行程式開發。\n\n` +
               `我可以協助您：\n` +
               `• 📊 分析項目結構\n` +
               `• 🔍 理解和分析代碼\n` +
               `• 📜 查看 Git 歷史\n` +
               `• 🛠️ 提供重構建議\n\n` +
               `請告訴我您需要什麼幫助？`;
    }

    private async searchInProject(searchTerm: string): Promise<any> {
        // 實現項目內搜索
        const symbols = this.codeContextService.searchSymbols(searchTerm);
        return { symbols, count: symbols.length };
    }

    private async getBasicProjectInfo(): Promise<any> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return {};

        return {
            workspaceName: workspaceFolders[0].name,
            workspacePath: workspaceFolders[0].uri.fsPath,
            openFiles: vscode.workspace.textDocuments.length
        };
    }

    private generateNextSuggestions(intent: UserIntent): string[] {
        switch (intent.type) {
            case 'project_overview':
                return [
                    "查看最近的 Git 提交記錄",
                    "分析代碼質量和複雜度",
                    "搜索特定的函數或類"
                ];
            case 'git_history':
                return [
                    "分析最近變更的影響",
                    "查看特定文件的歷史",
                    "生成變更總結報告"
                ];
            case 'code_analysis':
                return [
                    "獲取重構建議",
                    "查找相關的代碼片段",
                    "分析代碼依賴關係"
                ];
            default:
                return [
                    "告訴我這個項目的結構",
                    "查看最近的代碼變更",
                    "幫我分析這段代碼"
                ];
        }
    }
}
