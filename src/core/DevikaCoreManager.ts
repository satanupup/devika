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
    private initializationPromise: Promise<void>;

    constructor(private context: vscode.ExtensionContext) {
        this.configManager = ConfigManager.getInstance();
        this.llmService = new LLMService(this.configManager);
        this.uiManager = new UIManager(context);
        this.taskManager = new TaskManager(context);
        this.gitService = new GitService();
        this.codeContextService = new CodeContextService();
        this.codeParser = new CodeParser();

        this.initializationPromise = this.initialize();
    }

    async waitForInitialization(): Promise<void> {
        return this.initializationPromise;
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
            const analysisResponse = await this.llmService.generateCompletion(prompt);
            const analysis = analysisResponse.content;

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
            const refactorResponse = await this.llmService.generateCompletion(prompt);
            const refactorSuggestion = refactorResponse.content;

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
            const testResponse = await this.llmService.generateCompletion(prompt);
            const testCode = testResponse.content;

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
            const summaryResponse = await this.llmService.generateCompletion(prompt);
            const summary = summaryResponse.content;

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
            const commitResponse = await this.llmService.generateCompletion(prompt);
            const commitMessage = commitResponse.content;

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

    // 上下文管理方法
    async addCodeSnippetToContext(
        code: string,
        filePath: string,
        startLine: number,
        endLine: number
    ): Promise<void> {
        const snippet = {
            code,
            filePath,
            startLine,
            endLine,
            timestamp: new Date().toISOString()
        };

        // 添加到上下文服务
        await this.codeContextService.addCodeSnippet(snippet);

        // 可选：保存到工作区状态
        const existingSnippets = this.context.workspaceState.get<any[]>('codeSnippets', []);
        existingSnippets.push(snippet);
        await this.context.workspaceState.update('codeSnippets', existingSnippets);
    }

    async showContextManager(): Promise<void> {
        const snippets = this.context.workspaceState.get<any[]>('codeSnippets', []);

        if (snippets.length === 0) {
            vscode.window.showInformationMessage('上下文中沒有代碼片段');
            return;
        }

        const items = snippets.map((snippet, index) => ({
            label: `$(file-code) ${snippet.filePath.split('/').pop()}`,
            description: `第 ${snippet.startLine}-${snippet.endLine} 行`,
            detail: snippet.code.substring(0, 100) + (snippet.code.length > 100 ? '...' : ''),
            snippet,
            index
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇要查看或移除的代碼片段',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const action = await vscode.window.showQuickPick([
                { label: '$(eye) 查看完整代碼', action: 'view' },
                { label: '$(go-to-file) 跳轉到文件', action: 'goto' },
                { label: '$(trash) 從上下文移除', action: 'remove' }
            ], {
                placeHolder: '選擇操作'
            });

            if (action) {
                switch (action.action) {
                    case 'view':
                        await this.showCodeSnippetPreview(selected.snippet);
                        break;
                    case 'goto':
                        await this.gotoCodeSnippet(selected.snippet);
                        break;
                    case 'remove':
                        await this.removeCodeSnippetFromContext(selected.index);
                        break;
                }
            }
        }
    }

    async clearContext(): Promise<void> {
        await this.context.workspaceState.update('codeSnippets', []);
        this.codeContextService.clearContext();
    }

    private async showCodeSnippetPreview(snippet: any): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'codeSnippetPreview',
            `代碼片段預覽: ${snippet.filePath.split('/').pop()}`,
            vscode.ViewColumn.Two,
            { enableScripts: false }
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .header {
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .code {
                        background-color: var(--vscode-textCodeBlock-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        padding: 15px;
                        white-space: pre-wrap;
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                        overflow-x: auto;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>📄 ${snippet.filePath}</h2>
                    <p>第 ${snippet.startLine}-${snippet.endLine} 行 | 添加時間: ${new Date(snippet.timestamp).toLocaleString()}</p>
                </div>
                <div class="code">${snippet.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </body>
            </html>
        `;
    }

    private async gotoCodeSnippet(snippet: any): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(snippet.filePath);
            const editor = await vscode.window.showTextDocument(document);

            const startPos = new vscode.Position(snippet.startLine - 1, 0);
            const endPos = new vscode.Position(snippet.endLine - 1, 0);
            const range = new vscode.Range(startPos, endPos);

            editor.selection = new vscode.Selection(startPos, endPos);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        } catch (error) {
            vscode.window.showErrorMessage(`無法打開文件: ${error}`);
        }
    }

    private async removeCodeSnippetFromContext(index: number): Promise<void> {
        const snippets = this.context.workspaceState.get<any[]>('codeSnippets', []);
        snippets.splice(index, 1);
        await this.context.workspaceState.update('codeSnippets', snippets);
        vscode.window.showInformationMessage('代碼片段已從上下文中移除');
    }

    dispose() {
        this.uiManager.dispose();
        this.taskManager.dispose();
    }
}
