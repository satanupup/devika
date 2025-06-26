import * as vscode from 'vscode';
import { LLMService } from '../llm/LLMService';
import { UIManager } from '../ui/UIManager';
import { ConfigManager } from '../config/ConfigManager';
import { TaskManager } from '../tasks/TaskManager';
import { GitService } from '../git/GitService';
import { CodeContextService } from '../context/CodeContextService';
import { CodeParser } from '../context/CodeParser';

export class DevikaCoreManager {
    private llmService: LLMService;
    private uiManager: UIManager;
    private configManager: ConfigManager;
    private taskManager: TaskManager;
    private gitService: GitService;
    private codeContextService: CodeContextService;
    private codeParser: CodeParser;

    constructor(private context: vscode.ExtensionContext) {
        this.configManager = ConfigManager.getInstance();
        this.llmService = new LLMService(this.configManager);
        this.uiManager = new UIManager(context);
        this.taskManager = new TaskManager(context);
        this.gitService = new GitService();
        this.codeContextService = new CodeContextService();
        this.codeParser = new CodeParser();

        this.initialize();
    }

    private async initialize() {
        // 初始化程式碼索引
        if (this.configManager.getEnableCodeIndexing()) {
            await this.buildInitialCodeIndex();
        }

        // 初始化任務管理器
        await this.taskManager.initialize();
    }

    async showMainPanel() {
        await this.uiManager.showMainPanel();
    }

    async showTaskPanel() {
        await this.uiManager.showTaskPanel(this.taskManager.getAllTasks());
    }

    async analyzeCode(
        selectedText: string, 
        document: vscode.TextDocument, 
        selection: vscode.Selection
    ) {
        try {
            vscode.window.showInformationMessage('正在分析程式碼...');

            // 獲取程式碼上下文
            const context = await this.codeContextService.getCodeContext(
                document, 
                selection, 
                this.configManager.getMaxContextLines()
            );

            // 構建分析提示
            const prompt = this.buildAnalysisPrompt(selectedText, context);

            // 呼叫 LLM
            const analysis = await this.llmService.generateCompletion(prompt);

            // 解析回應並建立任務
            const tasks = this.parseAnalysisResponse(analysis, document.uri, selection);
            
            // 新增任務到管理器
            for (const task of tasks) {
                await this.taskManager.addTask(task);
            }

            // 顯示結果
            await this.uiManager.showAnalysisResult(analysis, tasks);

        } catch (error) {
            vscode.window.showErrorMessage(`程式碼分析失敗: ${error}`);
        }
    }

    async refactorCode(
        selectedText: string, 
        document: vscode.TextDocument, 
        selection: vscode.Selection
    ) {
        try {
            vscode.window.showInformationMessage('正在重構程式碼...');

            // 獲取程式碼上下文
            const context = await this.codeContextService.getCodeContext(
                document, 
                selection, 
                this.configManager.getMaxContextLines()
            );

            // 構建重構提示
            const prompt = this.buildRefactorPrompt(selectedText, context);

            // 呼叫 LLM
            const refactorSuggestion = await this.llmService.generateCompletion(prompt);

            // 解析回應
            const refactorTasks = this.parseRefactorResponse(refactorSuggestion, document.uri, selection);

            // 新增任務
            for (const task of refactorTasks) {
                await this.taskManager.addTask(task);
            }

            // 顯示結果並詢問是否應用
            const shouldApply = await this.uiManager.showRefactorResult(refactorSuggestion, refactorTasks);
            
            if (shouldApply) {
                await this.applyRefactoring(refactorTasks, document, selection);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`程式碼重構失敗: ${error}`);
        }
    }

    async generateTests(
        selectedText: string, 
        document: vscode.TextDocument, 
        selection: vscode.Selection
    ) {
        try {
            vscode.window.showInformationMessage('正在生成測試...');

            // 獲取程式碼上下文
            const context = await this.codeContextService.getCodeContext(
                document, 
                selection, 
                this.configManager.getMaxContextLines()
            );

            // 構建測試生成提示
            const prompt = this.buildTestGenerationPrompt(selectedText, context);

            // 呼叫 LLM
            const testCode = await this.llmService.generateCompletion(prompt);

            // 建立測試檔案任務
            const testTask = this.createTestFileTask(testCode, document.uri);
            await this.taskManager.addTask(testTask);

            // 顯示結果
            await this.uiManager.showTestGenerationResult(testCode, testTask);

        } catch (error) {
            vscode.window.showErrorMessage(`測試生成失敗: ${error}`);
        }
    }

    async summarizeGitChanges() {
        try {
            const changes = await this.gitService.getStagedChanges();
            if (!changes || changes.length === 0) {
                vscode.window.showInformationMessage('沒有暫存的變更');
                return;
            }

            const prompt = this.buildGitSummaryPrompt(changes);
            const summary = await this.llmService.generateCompletion(prompt);

            await this.uiManager.showGitSummary(summary, changes);

        } catch (error) {
            vscode.window.showErrorMessage(`Git 變更總結失敗: ${error}`);
        }
    }

    async generateCommitMessage() {
        try {
            const changes = await this.gitService.getStagedChanges();
            if (!changes || changes.length === 0) {
                vscode.window.showInformationMessage('沒有暫存的變更');
                return;
            }

            const prompt = this.buildCommitMessagePrompt(changes);
            const commitMessage = await this.llmService.generateCompletion(prompt);

            const shouldCommit = await this.uiManager.showCommitMessage(commitMessage);
            
            if (shouldCommit) {
                await this.gitService.commit(commitMessage);
                vscode.window.showInformationMessage('已成功提交變更');
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Commit 訊息生成失敗: ${error}`);
        }
    }

    async scanTodos() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        for (const folder of workspaceFolders) {
            await this.scanTodosInWorkspace(folder);
        }
    }

    async scanTodosInDocument(document: vscode.TextDocument) {
        const todos = await this.codeParser.extractTodos(document);
        
        for (const todo of todos) {
            const task = {
                id: `todo-${Date.now()}-${Math.random()}`,
                description: todo.text,
                status: 'pending' as const,
                filePath: document.uri.fsPath,
                range: todo.range,
                type: 'todo' as const,
                createdAt: new Date()
            };
            
            await this.taskManager.addTask(task);
        }
    }

    async updateCodeIndex(document: vscode.TextDocument) {
        if (this.configManager.getEnableCodeIndexing()) {
            await this.codeContextService.updateIndex(document);
        }
    }

    private async buildInitialCodeIndex() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        for (const folder of workspaceFolders) {
            await this.codeContextService.indexWorkspace(folder);
        }
    }

    private buildAnalysisPrompt(code: string, context: any): string {
        return `請分析以下程式碼並提供改進建議：

程式碼：
\`\`\`
${code}
\`\`\`

上下文資訊：
${JSON.stringify(context, null, 2)}

請提供：
1. 程式碼品質評估
2. 潛在問題識別
3. 改進建議
4. 可執行的任務列表

請以 JSON 格式回應，包含 analysis 和 tasks 欄位。`;
    }

    private buildRefactorPrompt(code: string, context: any): string {
        return `請重構以下程式碼以提高可讀性和效能：

程式碼：
\`\`\`
${code}
\`\`\`

上下文資訊：
${JSON.stringify(context, null, 2)}

請提供重構後的程式碼和說明。`;
    }

    private buildTestGenerationPrompt(code: string, context: any): string {
        return `請為以下程式碼生成單元測試：

程式碼：
\`\`\`
${code}
\`\`\`

上下文資訊：
${JSON.stringify(context, null, 2)}

請生成完整的測試程式碼，包含多種測試案例。`;
    }

    private buildGitSummaryPrompt(changes: string[]): string {
        return `請總結以下 Git 變更：

變更內容：
${changes.join('\n\n')}

請提供簡潔的變更總結。`;
    }

    private buildCommitMessagePrompt(changes: string[]): string {
        return `請根據以下 Git 變更生成 commit 訊息：

變更內容：
${changes.join('\n\n')}

請生成簡潔且描述性的 commit 訊息。`;
    }

    private parseAnalysisResponse(response: string, uri: vscode.Uri, selection: vscode.Selection): any[] {
        // 解析 AI 回應並轉換為任務
        try {
            const parsed = JSON.parse(response);
            return parsed.tasks || [];
        } catch {
            return [];
        }
    }

    private parseRefactorResponse(response: string, uri: vscode.Uri, selection: vscode.Selection): any[] {
        // 解析重構建議並轉換為任務
        return [{
            id: `refactor-${Date.now()}`,
            description: '應用重構建議',
            status: 'pending' as const,
            filePath: uri.fsPath,
            range: selection,
            type: 'refactor' as const,
            createdAt: new Date(),
            refactorCode: response
        }];
    }

    private createTestFileTask(testCode: string, sourceUri: vscode.Uri): any {
        return {
            id: `test-${Date.now()}`,
            description: '建立測試檔案',
            status: 'pending' as const,
            filePath: sourceUri.fsPath,
            type: 'test' as const,
            createdAt: new Date(),
            testCode: testCode
        };
    }

    private async applyRefactoring(tasks: any[], document: vscode.TextDocument, selection: vscode.Selection) {
        // 應用重構變更
        const edit = new vscode.WorkspaceEdit();
        
        for (const task of tasks) {
            if (task.refactorCode) {
                edit.replace(document.uri, selection, task.refactorCode);
            }
        }

        await vscode.workspace.applyEdit(edit);
    }

    private async scanTodosInWorkspace(folder: vscode.WorkspaceFolder) {
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folder, '**/*.{ts,js,py,java,cpp,cs,go,rs}'),
            '**/node_modules/**'
        );

        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            await this.scanTodosInDocument(document);
        }
    }

    dispose() {
        this.uiManager.dispose();
        this.taskManager.dispose();
    }
}
