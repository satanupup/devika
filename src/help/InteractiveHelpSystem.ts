import * as vscode from 'vscode';

export interface TutorialStep {
    id: string;
    title: string;
    description: string;
    action?: string;
    command?: string;
    highlight?: string;
    validation?: () => boolean;
    optional?: boolean;
}

export interface Tutorial {
    id: string;
    name: string;
    description: string;
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: number; // in minutes
    steps: TutorialStep[];
    prerequisites?: string[];
}

export interface HelpTopic {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    relatedCommands?: string[];
    relatedTopics?: string[];
}

export class InteractiveHelpSystem {
    private tutorials: Map<string, Tutorial> = new Map();
    private helpTopics: Map<string, HelpTopic> = new Map();
    private currentTutorial?: { tutorial: Tutorial; currentStep: number };
    private userProgress: Map<string, { completed: boolean; lastStep: number }> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.initializeDefaultTutorials();
        this.initializeHelpTopics();
        this.loadUserProgress();
    }

    private initializeDefaultTutorials(): void {
        // Getting Started Tutorial
        this.addTutorial({
            id: 'getting-started',
            name: '開始使用 Devika',
            description: '學習 Devika AI 助理的基本功能和操作',
            category: 'basics',
            difficulty: 'beginner',
            estimatedTime: 10,
            steps: [
                {
                    id: 'welcome',
                    title: '歡迎使用 Devika',
                    description: '歡迎使用 Devika AI 開發助理！讓我們開始一個簡短的導覽。',
                    action: '點擊下一步繼續'
                },
                {
                    id: 'open-chat',
                    title: '打開聊天面板',
                    description: '首先，讓我們打開 Devika 的聊天面板。',
                    command: 'devika.start',
                    action: '執行命令 "Devika: 啟動 AI 助理"',
                    validation: () => {
                        // Check if chat panel is open
                        return true; // Simplified for demo
                    }
                },
                {
                    id: 'first-message',
                    title: '發送第一條消息',
                    description: '在聊天面板中輸入 "Hello Devika" 並發送。',
                    action: '在聊天框中輸入消息並按 Enter'
                },
                {
                    id: 'code-analysis',
                    title: '代碼分析功能',
                    description: '選擇一些代碼，然後右鍵選擇 "Devika: 分析選取的程式碼"。',
                    action: '選擇代碼並使用右鍵菜單',
                    optional: true
                },
                {
                    id: 'completion',
                    title: '教程完成',
                    description: '恭喜！您已經學會了 Devika 的基本操作。',
                    action: '點擊完成'
                }
            ]
        });

        // Agent Mode Tutorial
        this.addTutorial({
            id: 'agent-mode',
            name: '代理模式使用',
            description: '學習如何使用 Devika 的高級代理模式功能',
            category: 'advanced',
            difficulty: 'intermediate',
            estimatedTime: 15,
            prerequisites: ['getting-started'],
            steps: [
                {
                    id: 'enable-agent',
                    title: '啟用代理模式',
                    description: '在設置中啟用代理模式功能。',
                    command: 'workbench.action.openSettings',
                    action: '搜索 "devika.agentMode.enabled" 並啟用'
                },
                {
                    id: 'create-task',
                    title: '創建任務計劃',
                    description: '描述一個開發任務，讓 AI 生成執行計劃。',
                    action: '在聊天中描述您想要完成的任務'
                },
                {
                    id: 'review-plan',
                    title: '審查任務計劃',
                    description: '查看 AI 生成的任務計劃並進行審查。',
                    action: '檢查每個步驟並選擇批准或修改'
                },
                {
                    id: 'execute-task',
                    title: '執行任務',
                    description: '批准計劃後，觀察 AI 執行任務。',
                    action: '監控任務執行進度'
                }
            ]
        });

        // Plugin Development Tutorial
        this.addTutorial({
            id: 'plugin-development',
            name: '插件開發',
            description: '學習如何為 Devika 開發自定義插件',
            category: 'development',
            difficulty: 'advanced',
            estimatedTime: 30,
            prerequisites: ['getting-started', 'agent-mode'],
            steps: [
                {
                    id: 'plugin-structure',
                    title: '了解插件結構',
                    description: '學習 Devika 插件的基本結構和要求。',
                    action: '查看現有插件代碼示例'
                },
                {
                    id: 'create-plugin',
                    title: '創建新插件',
                    description: '使用插件模板創建您的第一個插件。',
                    action: '使用 "devika.createPlugin" 命令'
                },
                {
                    id: 'test-plugin',
                    title: '測試插件',
                    description: '測試您的插件功能是否正常工作。',
                    action: '運行插件並檢查輸出'
                }
            ]
        });
    }

    private initializeHelpTopics(): void {
        this.addHelpTopic({
            id: 'api-keys',
            title: 'API 密鑰配置',
            content: `
# API 密鑰配置

Devika 支持多個 AI 提供商，您需要配置相應的 API 密鑰：

## OpenAI
1. 訪問 https://platform.openai.com/api-keys
2. 創建新的 API 密鑰
3. 在 VS Code 設置中設置 \`devika.openaiApiKey\`

## Anthropic Claude
1. 訪問 https://console.anthropic.com/
2. 獲取 API 密鑰
3. 在 VS Code 設置中設置 \`devika.claudeApiKey\`

## Google Gemini
1. 訪問 Google AI Studio
2. 獲取 API 密鑰
3. 在 VS Code 設置中設置 \`devika.geminiApiKey\`

**注意**: 請妥善保管您的 API 密鑰，不要分享給他人。
            `,
            category: 'configuration',
            tags: ['api', 'setup', 'security'],
            relatedCommands: ['workbench.action.openSettings']
        });

        this.addHelpTopic({
            id: 'agent-mode',
            title: '代理模式說明',
            content: `
# 代理模式

代理模式是 Devika 的高級功能，允許 AI 自動執行複雜的開發任務。

## 功能特點
- 多步驟任務規劃
- 交互式審查和批准
- 自動文件修改
- 檢查點和回滾

## 使用步驟
1. 啟用代理模式：\`devika.agentMode.enabled = true\`
2. 描述您的任務需求
3. 審查 AI 生成的執行計劃
4. 批准或修改計劃
5. 監控執行過程

## 安全提示
- 始終仔細審查執行計劃
- 建議在重要項目中先創建備份
- 可以隨時暫停或取消執行
            `,
            category: 'features',
            tags: ['agent', 'automation', 'advanced'],
            relatedTopics: ['checkpoints', 'file-management']
        });

        this.addHelpTopic({
            id: 'troubleshooting',
            title: '常見問題解決',
            content: `
# 常見問題解決

## API 連接問題
- 檢查 API 密鑰是否正確設置
- 確認網絡連接正常
- 檢查 API 配額是否用完

## 性能問題
- 啟用性能優化選項
- 清理不必要的文件排除規則
- 重啟 VS Code

## 插件不工作
- 檢查插件是否正確安裝
- 查看輸出面板的錯誤信息
- 嘗試重新加載窗口

## 獲取幫助
- 查看 GitHub Issues
- 聯繫技術支持
- 參與社區討論
            `,
            category: 'troubleshooting',
            tags: ['problems', 'solutions', 'support'],
            relatedCommands: ['developer.reload']
        });
    }

    addTutorial(tutorial: Tutorial): void {
        this.tutorials.set(tutorial.id, tutorial);
    }

    addHelpTopic(topic: HelpTopic): void {
        this.helpTopics.set(topic.id, topic);
    }

    async startTutorial(tutorialId: string): Promise<void> {
        const tutorial = this.tutorials.get(tutorialId);
        if (!tutorial) {
            vscode.window.showErrorMessage(`找不到教程: ${tutorialId}`);
            return;
        }

        // Check prerequisites
        if (tutorial.prerequisites) {
            for (const prereq of tutorial.prerequisites) {
                const progress = this.userProgress.get(prereq);
                if (!progress?.completed) {
                    const result = await vscode.window.showWarningMessage(
                        `此教程需要先完成: ${prereq}`,
                        '開始前置教程',
                        '繼續'
                    );
                    if (result === '開始前置教程') {
                        await this.startTutorial(prereq);
                        return;
                    }
                }
            }
        }

        this.currentTutorial = { tutorial, currentStep: 0 };
        await this.showTutorialStep();
    }

    private async showTutorialStep(): Promise<void> {
        if (!this.currentTutorial) return;

        const { tutorial, currentStep } = this.currentTutorial;
        const step = tutorial.steps[currentStep];

        if (!step) {
            await this.completeTutorial();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'tutorialStep',
            `${tutorial.name} - 步驟 ${currentStep + 1}`,
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.getTutorialStepHtml(tutorial, step, currentStep);

        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'next':
                        panel.dispose();
                        await this.nextStep();
                        break;
                    case 'previous':
                        panel.dispose();
                        await this.previousStep();
                        break;
                    case 'skip':
                        panel.dispose();
                        await this.skipStep();
                        break;
                    case 'exit':
                        panel.dispose();
                        this.exitTutorial();
                        break;
                    case 'executeCommand':
                        if (step.command) {
                            await vscode.commands.executeCommand(step.command);
                        }
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private getTutorialStepHtml(tutorial: Tutorial, step: TutorialStep, stepIndex: number): string {
        const progress = ((stepIndex + 1) / tutorial.steps.length) * 100;

        return `
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
                .tutorial-header {
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background-color: var(--vscode-progressBar-background);
                    border-radius: 4px;
                    margin: 10px 0;
                }
                .progress-fill {
                    height: 100%;
                    background-color: var(--vscode-progressBar-foreground);
                    border-radius: 4px;
                    width: ${progress}%;
                    transition: width 0.3s ease;
                }
                .step-content {
                    margin: 20px 0;
                    padding: 20px;
                    background: var(--vscode-textCodeBlock-background);
                    border-radius: 8px;
                }
                .step-actions {
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                    justify-content: space-between;
                }
                .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: inherit;
                }
                .btn-primary {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .btn:hover {
                    opacity: 0.9;
                }
                .command-button {
                    background-color: var(--vscode-textLink-foreground);
                    color: white;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="tutorial-header">
                <h1>${tutorial.name}</h1>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <p>步驟 ${stepIndex + 1} / ${tutorial.steps.length}</p>
            </div>

            <div class="step-content">
                <h2>${step.title}</h2>
                <p>${step.description}</p>
                
                ${step.action ? `<div><strong>操作:</strong> ${step.action}</div>` : ''}
                
                ${step.command ? `
                    <button class="btn command-button" onclick="executeCommand()">
                        執行命令
                    </button>
                ` : ''}
                
                ${step.optional ? '<p><em>此步驟是可選的，您可以跳過。</em></p>' : ''}
            </div>

            <div class="step-actions">
                <div>
                    ${stepIndex > 0 ? '<button class="btn btn-secondary" onclick="previous()">上一步</button>' : ''}
                    ${step.optional ? '<button class="btn btn-secondary" onclick="skip()">跳過</button>' : ''}
                </div>
                <div>
                    <button class="btn btn-secondary" onclick="exit()">退出教程</button>
                    <button class="btn btn-primary" onclick="next()">
                        ${stepIndex === tutorial.steps.length - 1 ? '完成' : '下一步'}
                    </button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function next() {
                    vscode.postMessage({ command: 'next' });
                }

                function previous() {
                    vscode.postMessage({ command: 'previous' });
                }

                function skip() {
                    vscode.postMessage({ command: 'skip' });
                }

                function exit() {
                    vscode.postMessage({ command: 'exit' });
                }

                function executeCommand() {
                    vscode.postMessage({ command: 'executeCommand' });
                }
            </script>
        </body>
        </html>
        `;
    }

    private async nextStep(): Promise<void> {
        if (!this.currentTutorial) return;

        this.currentTutorial.currentStep++;
        await this.showTutorialStep();
    }

    private async previousStep(): Promise<void> {
        if (!this.currentTutorial) return;

        this.currentTutorial.currentStep = Math.max(0, this.currentTutorial.currentStep - 1);
        await this.showTutorialStep();
    }

    private async skipStep(): Promise<void> {
        await this.nextStep();
    }

    private exitTutorial(): void {
        if (this.currentTutorial) {
            this.saveProgress(this.currentTutorial.tutorial.id, this.currentTutorial.currentStep, false);
            this.currentTutorial = undefined;
        }
    }

    private async completeTutorial(): Promise<void> {
        if (!this.currentTutorial) return;

        const tutorial = this.currentTutorial.tutorial;
        this.saveProgress(tutorial.id, tutorial.steps.length, true);
        this.currentTutorial = undefined;

        vscode.window.showInformationMessage(
            `🎉 恭喜完成教程: ${tutorial.name}！`,
            '查看更多教程'
        ).then(choice => {
            if (choice === '查看更多教程') {
                this.showTutorialList();
            }
        });
    }

    async showTutorialList(): Promise<void> {
        const tutorials = Array.from(this.tutorials.values());
        const items = tutorials.map(tutorial => {
            const progress = this.userProgress.get(tutorial.id);
            const status = progress?.completed ? '✅' : progress ? '🔄' : '⭕';
            
            return {
                label: `${status} ${tutorial.name}`,
                description: `${tutorial.difficulty} • ${tutorial.estimatedTime} 分鐘`,
                detail: tutorial.description,
                tutorial
            };
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇要開始的教程'
        });

        if (selected) {
            await this.startTutorial(selected.tutorial.id);
        }
    }

    async showHelpTopic(topicId: string): Promise<void> {
        const topic = this.helpTopics.get(topicId);
        if (!topic) {
            vscode.window.showErrorMessage(`找不到幫助主題: ${topicId}`);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'helpTopic',
            topic.title,
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
                    line-height: 1.6;
                }
                h1, h2, h3 { color: var(--vscode-textLink-foreground); }
                code {
                    background: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                pre {
                    background: var(--vscode-textCodeBlock-background);
                    padding: 10px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            ${this.markdownToHtml(topic.content)}
        </body>
        </html>
        `;
    }

    private markdownToHtml(markdown: string): string {
        // Simple markdown to HTML conversion
        return markdown
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/`([^`]+)`/gim, '<code>$1</code>')
            .replace(/\n/gim, '<br>');
    }

    private saveProgress(tutorialId: string, step: number, completed: boolean): void {
        this.userProgress.set(tutorialId, { completed, lastStep: step });
        this.context.globalState.update('tutorialProgress', Array.from(this.userProgress.entries()));
    }

    private loadUserProgress(): void {
        const saved = this.context.globalState.get<[string, any][]>('tutorialProgress', []);
        this.userProgress = new Map(saved);
    }

    async showQuickHelp(): Promise<void> {
        const items = [
            { label: '📚 查看教程', action: 'tutorials' },
            { label: '❓ 幫助主題', action: 'help' },
            { label: '⌨️ 快捷鍵指南', action: 'shortcuts' },
            { label: '🔧 配置幫助', action: 'config' },
            { label: '🐛 故障排除', action: 'troubleshooting' }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇幫助類型'
        });

        if (selected) {
            switch (selected.action) {
                case 'tutorials':
                    await this.showTutorialList();
                    break;
                case 'help':
                    await this.showHelpTopicList();
                    break;
                case 'shortcuts':
                    await this.showShortcutGuide();
                    break;
                case 'config':
                    await this.showHelpTopic('api-keys');
                    break;
                case 'troubleshooting':
                    await this.showHelpTopic('troubleshooting');
                    break;
            }
        }
    }

    private async showHelpTopicList(): Promise<void> {
        const topics = Array.from(this.helpTopics.values());
        const items = topics.map(topic => ({
            label: topic.title,
            description: topic.category,
            detail: topic.tags.join(', '),
            topic
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇幫助主題'
        });

        if (selected) {
            await this.showHelpTopic(selected.topic.id);
        }
    }

    private async showShortcutGuide(): Promise<void> {
        const shortcuts = [
            { key: 'Ctrl+Shift+P', description: '打開命令面板' },
            { key: 'Ctrl+Shift+D', description: '啟動 Devika' },
            { key: 'Ctrl+/', description: '分析選取的代碼' },
            { key: 'F1', description: '顯示快速幫助' }
        ];

        const content = shortcuts.map(s => `${s.key}: ${s.description}`).join('\n');
        
        vscode.window.showInformationMessage(
            '快捷鍵指南:\n' + content,
            { modal: true }
        );
    }
}
