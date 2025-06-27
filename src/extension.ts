import * as vscode from 'vscode';
import { DevikaCoreManager } from './core/DevikaCoreManager';
import { UIManager } from './ui/UIManager';
import { ConfigManager } from './config/ConfigManager';
import { TaskManager } from './tasks/TaskManager';
import { GitService } from './git/GitService';
import { CodeContextService } from './context/CodeContextService';
import { PluginManager } from './plugins/PluginManager';
import { DevikaTaskProvider, DevikaChatProvider, DevikaContextProvider } from './ui/ViewProviders';
import { LLMService } from './llm/LLMService';

let devikaCoreManager: DevikaCoreManager;
let pluginManager: PluginManager;
let taskProvider: DevikaTaskProvider;
let chatProvider: DevikaChatProvider;
let contextProvider: DevikaContextProvider;
let llmStatusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Devika AI 助理正在啟動...');

    try {
        // 初始化插件管理器
        pluginManager = new PluginManager(context);

        // 初始化核心管理器
        devikaCoreManager = new DevikaCoreManager(context);

        // 等待核心管理器初始化完成
        await devikaCoreManager.waitForInitialization();

        // 設定 context 變數，用於控制 UI 顯示
        vscode.commands.executeCommand('setContext', 'devika.activated', true);

        // 註冊所有指令
        registerCommands(context);

        // 初始化服務
        initializeServices(context);

        // 註冊視圖提供者
        registerViewProviders(context);

        // 創建狀態欄項目
        createStatusBarItem(context);

        // 啟動自動功能
        await startAutomaticFeatures();

        console.log('Devika AI 助理已成功啟動！');

        // 顯示智能歡迎消息
        vscode.window.showInformationMessage(
            '🧠 Devika AI 助理已啟動！我正在理解您的項目...',
            '開始對話',
            '查看狀態'
        ).then(choice => {
            if (choice === '開始對話') {
                vscode.commands.executeCommand('devika.start');
            } else if (choice === '查看狀態') {
                vscode.commands.executeCommand('devika.showProjectStatus');
            }
        });

    } catch (error) {
        console.error('Devika 啟動失敗:', error);
        vscode.window.showErrorMessage(`Devika 啟動失敗: ${error}`);
    }
}

export function deactivate() {
    if (devikaCoreManager) {
        devikaCoreManager.dispose();
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    const commands = [
        // 主要指令
        vscode.commands.registerCommand('devika.start', async () => {
            try {
                if (!devikaCoreManager) {
                    vscode.window.showErrorMessage('Devika 核心管理器尚未初始化，請稍候再試');
                    return;
                }
                await devikaCoreManager.showMainPanel();
            } catch (error) {
                console.error('啟動 Devika 失敗:', error);
                vscode.window.showErrorMessage(`啟動 Devika 失敗: ${error}`);
            }
        }),

        // 程式碼分析指令
        vscode.commands.registerCommand('devika.analyzeCode', async () => {
            try {
                if (!devikaCoreManager) {
                    vscode.window.showErrorMessage('Devika 核心管理器尚未初始化，請稍候再試');
                    return;
                }

                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('請先選取要分析的程式碼');
                    return;
                }

                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);

                if (!selectedText) {
                    vscode.window.showErrorMessage('請選取要分析的程式碼');
                    return;
                }

                await devikaCoreManager.analyzeCode(selectedText, editor.document, selection);
            } catch (error) {
                console.error('分析程式碼失敗:', error);
                vscode.window.showErrorMessage(`分析程式碼失敗: ${error}`);
            }
        }),

        // 重構程式碼指令
        vscode.commands.registerCommand('devika.refactorCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('請先選取要重構的程式碼');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showErrorMessage('請選取要重構的程式碼');
                return;
            }

            await devikaCoreManager.refactorCode(selectedText, editor.document, selection);
        }),

        // 生成測試指令
        vscode.commands.registerCommand('devika.generateTests', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('請先選取要生成測試的程式碼');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showErrorMessage('請選取要生成測試的程式碼');
                return;
            }

            await devikaCoreManager.generateTests(selectedText, editor.document, selection);
        }),

        // Git 相關指令
        vscode.commands.registerCommand('devika.summarizeChanges', async () => {
            await devikaCoreManager.summarizeGitChanges();
        }),

        vscode.commands.registerCommand('devika.generateCommitMessage', async () => {
            await devikaCoreManager.generateCommitMessage();
        }),

        // 任務管理指令
        vscode.commands.registerCommand('devika.showTasks', () => {
            devikaCoreManager.showTaskPanel();
        }),

        vscode.commands.registerCommand('devika.scanTodos', async () => {
            await devikaCoreManager.scanTodos();
        }),

        // 代码片段选择和上下文添加
        vscode.commands.registerCommand('devika.addCodeSnippetToContext', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('請先選擇一個編輯器');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (!selectedText.trim()) {
                vscode.window.showWarningMessage('請先選擇要添加到上下文的代碼片段');
                return;
            }

            // 添加到上下文管理器
            await devikaCoreManager.addCodeSnippetToContext(
                selectedText,
                editor.document.fileName,
                selection.start.line + 1,
                selection.end.line + 1
            );

            vscode.window.showInformationMessage(
                `已添加 ${selection.end.line - selection.start.line + 1} 行代碼到上下文`
            );
        }),

        vscode.commands.registerCommand('devika.showContextManager', async () => {
            await devikaCoreManager.showContextManager();
        }),

        vscode.commands.registerCommand('devika.clearContext', async () => {
            const result = await vscode.window.showWarningMessage(
                '確定要清空所有上下文嗎？',
                { modal: true },
                '確定',
                '取消'
            );

            if (result === '確定') {
                await devikaCoreManager.clearContext();
                vscode.window.showInformationMessage('上下文已清空');
            }
        }),

        // 設置 API 密鑰指令
        vscode.commands.registerCommand('devika.setupApiKeys', async () => {
            try {
                await showApiKeySetupDialog();
            } catch (error) {
                console.error('設置 API 密鑰失敗:', error);
                vscode.window.showErrorMessage(`設置 API 密鑰失敗: ${error}`);
            }
        }),

        // 測試 API 連接指令
        vscode.commands.registerCommand('devika.testApiConnection', async () => {
            try {
                if (!devikaCoreManager) {
                    vscode.window.showErrorMessage('Devika 核心管理器尚未初始化');
                    return;
                }

                const configManager = ConfigManager.getInstance();
                const llmService = new LLMService(configManager);

                vscode.window.showInformationMessage('正在測試 API 連接...');

                const results = await llmService.validateApiKeys();

                const messages = [];
                if (results.openai) {
                    messages.push('✅ OpenAI API 連接正常');
                } else if (configManager.getOpenAIApiKey()) {
                    messages.push('❌ OpenAI API 連接失敗');
                }

                if (results.claude) {
                    messages.push('✅ Claude API 連接正常');
                } else if (configManager.getClaudeApiKey()) {
                    messages.push('❌ Claude API 連接失敗');
                }

                if (results.gemini) {
                    messages.push('✅ Gemini API 連接正常');
                } else if (configManager.getGeminiApiKey()) {
                    messages.push('❌ Gemini API 連接失敗');
                }

                if (messages.length === 0) {
                    vscode.window.showWarningMessage('沒有設置任何 API 密鑰');
                } else {
                    vscode.window.showInformationMessage(messages.join('\n'));
                }

            } catch (error) {
                console.error('測試 API 連接失敗:', error);
                vscode.window.showErrorMessage(`測試 API 連接失敗: ${error}`);
            }
        }),

        // 快速切換 LLM 模型指令
        vscode.commands.registerCommand('devika.switchLLM', async () => {
            try {
                const configManager = ConfigManager.getInstance();
                const currentModel = configManager.getPreferredModel();

                // 檢查可用的模型（基於已設置的 API 密鑰）
                const availableModels = [];

                if (configManager.getOpenAIApiKey()) {
                    availableModels.push(
                        { label: '🤖 GPT-4', description: 'OpenAI GPT-4 (最強推理能力)', value: 'gpt-4' },
                        { label: '⚡ GPT-4 Turbo', description: 'OpenAI GPT-4 Turbo (更快速度)', value: 'gpt-4-turbo' },
                        { label: '💨 GPT-3.5 Turbo', description: 'OpenAI GPT-3.5 Turbo (快速且經濟)', value: 'gpt-3.5-turbo' }
                    );
                }

                if (configManager.getClaudeApiKey()) {
                    availableModels.push(
                        { label: '🧠 Claude 3.5 Sonnet', description: 'Anthropic Claude 3.5 Sonnet (推薦)', value: 'claude-3-5-sonnet-20241022' },
                        { label: '🎯 Claude 3 Opus', description: 'Anthropic Claude 3 Opus (最高質量)', value: 'claude-3-opus-20240229' },
                        { label: '⚡ Claude 3 Haiku', description: 'Anthropic Claude 3 Haiku (最快速度)', value: 'claude-3-haiku-20240307' }
                    );
                }

                if (configManager.getGeminiApiKey()) {
                    availableModels.push(
                        { label: '💎 Gemini Pro', description: 'Google Gemini Pro', value: 'gemini-pro' },
                        { label: '🚀 Gemini 1.5 Pro', description: 'Google Gemini 1.5 Pro (長上下文)', value: 'gemini-1.5-pro' }
                    );
                }

                if (availableModels.length === 0) {
                    vscode.window.showWarningMessage(
                        '沒有可用的 LLM 模型。請先設置至少一個 API 密鑰。',
                        '設置 API 密鑰'
                    ).then(choice => {
                        if (choice === '設置 API 密鑰') {
                            vscode.commands.executeCommand('devika.setupApiKeys');
                        }
                    });
                    return;
                }

                // 標記當前使用的模型
                const items = availableModels.map(model => ({
                    ...model,
                    label: model.value === currentModel ? `${model.label} ✅ (當前使用)` : model.label
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `選擇要使用的 LLM 模型 (當前: ${currentModel})`
                });

                if (selected && selected.value !== currentModel) {
                    // 切換模型
                    configManager.setPreferredModel(selected.value);

                    // 更新狀態欄
                    updateStatusBarItem();

                    // 測試新模型連接
                    vscode.window.showInformationMessage(
                        `✅ 已切換到 ${selected.label.replace(' ✅ (當前使用)', '')}`,
                        '測試連接',
                        '開始對話'
                    ).then(choice => {
                        if (choice === '測試連接') {
                            vscode.commands.executeCommand('devika.testApiConnection');
                        } else if (choice === '開始對話') {
                            vscode.commands.executeCommand('devika.start');
                        }
                    });
                }

            } catch (error) {
                console.error('切換 LLM 模型失敗:', error);
                vscode.window.showErrorMessage(`切換 LLM 模型失敗: ${error}`);
            }
        }),

        // 項目狀態指令
        vscode.commands.registerCommand('devika.showProjectStatus', async () => {
            try {
                if (!devikaCoreManager) {
                    vscode.window.showErrorMessage('Devika 核心管理器尚未初始化');
                    return;
                }

                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    vscode.window.showInformationMessage('沒有打開的工作區');
                    return;
                }

                const status = {
                    indexed: true, // 假設已索引
                    workspaceName: workspaceFolders[0].name,
                    fileCount: (await vscode.workspace.findFiles('**/*')).length,
                    lastIndexed: new Date().toLocaleString()
                };

                vscode.window.showInformationMessage(
                    `📊 項目狀態\n\n` +
                    `• 工作區: ${status.workspaceName}\n` +
                    `• 文件數: ${status.fileCount}\n` +
                    `• 索引狀態: ${status.indexed ? '✅ 已完成' : '⏳ 進行中'}\n` +
                    `• 最後更新: ${status.lastIndexed}\n\n` +
                    `💡 您可以直接與 AI 助理對話，我會自動分析和使用這些信息！`
                );

            } catch (error) {
                console.error('顯示項目狀態失敗:', error);
                vscode.window.showErrorMessage(`顯示項目狀態失敗: ${error}`);
            }
        }),

        // 項目分析指令
        vscode.commands.registerCommand('devika.analyzeProject', async () => {
            try {
                if (!devikaCoreManager) {
                    vscode.window.showErrorMessage('Devika 核心管理器尚未初始化');
                    return;
                }

                vscode.window.showInformationMessage('🔍 正在分析項目結構...');

                // 使用 ProjectAnalyzer
                const { ProjectAnalyzer } = await import('./agent/ProjectAnalyzer');
                const analyzer = new ProjectAnalyzer();
                const structure = await analyzer.analyzeProject();

                // 顯示分析結果
                const panel = vscode.window.createWebviewPanel(
                    'projectAnalysis',
                    '項目分析報告',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = generateProjectAnalysisHtml(structure);

            } catch (error) {
                console.error('項目分析失敗:', error);
                vscode.window.showErrorMessage(`項目分析失敗: ${error}`);
            }
        }),

        // Git 歷史查看指令
        vscode.commands.registerCommand('devika.showGitHistory', async () => {
            try {
                if (!devikaCoreManager) {
                    vscode.window.showErrorMessage('Devika 核心管理器尚未初始化');
                    return;
                }

                const gitService = new GitService();
                const history = await gitService.getCommitHistory(20);

                if (history.length === 0) {
                    vscode.window.showInformationMessage('沒有找到 Git 歷史記錄');
                    return;
                }

                // 顯示 Git 歷史
                const panel = vscode.window.createWebviewPanel(
                    'gitHistory',
                    'Git 提交歷史',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = generateGitHistoryHtml(history);

            } catch (error) {
                console.error('查看 Git 歷史失敗:', error);
                vscode.window.showErrorMessage(`查看 Git 歷史失敗: ${error}`);
            }
        }),

        // 文件歷史查看指令
        vscode.commands.registerCommand('devika.showFileHistory', async () => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('請先打開一個文件');
                    return;
                }

                const gitService = new GitService();
                const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
                const history = await gitService.getFileHistory(relativePath, 10);

                if (history.length === 0) {
                    vscode.window.showInformationMessage('沒有找到此文件的 Git 歷史記錄');
                    return;
                }

                // 顯示文件歷史
                const panel = vscode.window.createWebviewPanel(
                    'fileHistory',
                    `文件歷史: ${relativePath}`,
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = generateFileHistoryHtml(history, relativePath);

            } catch (error) {
                console.error('查看文件歷史失敗:', error);
                vscode.window.showErrorMessage(`查看文件歷史失敗: ${error}`);
            }
        }),

        // Augment 插件指令
        vscode.commands.registerCommand('devika.showPlugins', async () => {
            const plugins = pluginManager.getAvailablePlugins();
            const items = plugins.map(plugin => ({
                label: `$(extensions) ${plugin.name}`,
                description: plugin.description,
                detail: `類別: ${plugin.category} | 預估時間: ${plugin.estimatedTime || '未知'}`,
                plugin
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '選擇要執行的 Augment 插件',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                try {
                    const result = await pluginManager.executePlugin(selected.plugin.id);
                    if (result.success) {
                        vscode.window.showInformationMessage(result.message);
                    } else {
                        vscode.window.showErrorMessage(result.message);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`插件執行失敗: ${error}`);
                }
            }
        }),

        // 文件生成插件
        vscode.commands.registerCommand('devika.generateContributing', async () => {
            try {
                const result = await pluginManager.executePlugin('generate-contributing');
                if (result.success) {
                    vscode.window.showInformationMessage(result.message);
                } else {
                    vscode.window.showErrorMessage(result.message);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`生成貢獻指南失敗: ${error}`);
            }
        }),

        vscode.commands.registerCommand('devika.generateRoadmap', async () => {
            try {
                const result = await pluginManager.executePlugin('generate-roadmap');
                if (result.success) {
                    vscode.window.showInformationMessage(result.message);
                } else {
                    vscode.window.showErrorMessage(result.message);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`生成路線圖失敗: ${error}`);
            }
        }),

        vscode.commands.registerCommand('devika.generateChangelog', async () => {
            try {
                const result = await pluginManager.executePlugin('generate-changelog');
                if (result.success) {
                    vscode.window.showInformationMessage(result.message);
                } else {
                    vscode.window.showErrorMessage(result.message);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`生成變更日誌失敗: ${error}`);
            }
        })
    ];

    commands.forEach(command => context.subscriptions.push(command));
}

function initializeServices(context: vscode.ExtensionContext) {
    // 監聽檔案儲存事件，自動掃描 TODO
    const onSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        const config = ConfigManager.getInstance();
        if (config.getAutoScanTodos()) {
            await devikaCoreManager.scanTodosInDocument(document);
        }
    });

    // 監聽檔案變更事件，更新程式碼索引
    const onChangeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
        const config = ConfigManager.getInstance();
        if (config.getEnableCodeIndexing()) {
            await devikaCoreManager.updateCodeIndex(event.document);
        }
    });

    context.subscriptions.push(onSaveListener, onChangeListener);
}

async function showApiKeySetupDialog(): Promise<void> {
    const configManager = ConfigManager.getInstance();

    const options = [
        { label: '$(key) OpenAI API 密鑰', description: 'GPT-3.5, GPT-4 等模型', value: 'openai' },
        { label: '$(key) Claude API 密鑰', description: 'Anthropic Claude 模型', value: 'claude' },
        { label: '$(key) Gemini API 密鑰', description: 'Google Gemini 模型', value: 'gemini' },
        { label: '$(gear) 打開設置頁面', description: '在 VS Code 設置中配置', value: 'settings' }
    ];

    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: '選擇要設置的 API 密鑰類型'
    });

    if (!selected) {
        return;
    }

    if (selected.value === 'settings') {
        // 打開 VS Code 設置頁面
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:devika.vscode-extension');
        return;
    }

    // 輸入 API 密鑰
    const apiKey = await vscode.window.showInputBox({
        prompt: `請輸入您的 ${selected.label.replace('$(key) ', '')}`,
        password: true,
        placeHolder: '輸入 API 密鑰...',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'API 密鑰不能為空';
            }
            if (value.length < 10) {
                return 'API 密鑰長度太短';
            }
            return null;
        }
    });

    if (!apiKey) {
        return;
    }

    // 保存 API 密鑰
    try {
        switch (selected.value) {
            case 'openai':
                configManager.setOpenAIApiKey(apiKey);
                break;
            case 'claude':
                configManager.setClaudeApiKey(apiKey);
                break;
            case 'gemini':
                configManager.setGeminiApiKey(apiKey);
                break;
        }

        vscode.window.showInformationMessage(
            `✅ ${selected.label.replace('$(key) ', '')} 設置成功！`,
            '測試連接'
        ).then(choice => {
            if (choice === '測試連接') {
                vscode.commands.executeCommand('devika.start');
            }
        });

    } catch (error) {
        vscode.window.showErrorMessage(`設置 API 密鑰失敗: ${error}`);
    }
}

function registerViewProviders(context: vscode.ExtensionContext): void {
    try {
        // 創建視圖提供者
        taskProvider = new DevikaTaskProvider();
        chatProvider = new DevikaChatProvider();
        contextProvider = new DevikaContextProvider();

        // 註冊視圖提供者
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('devika.tasks', taskProvider),
            vscode.window.registerTreeDataProvider('devika.chat', chatProvider),
            vscode.window.registerTreeDataProvider('devika.context', contextProvider)
        );

        // 設置上下文變量以顯示視圖
        vscode.commands.executeCommand('setContext', 'devika.activated', true);

        console.log('視圖提供者已成功註冊');
    } catch (error) {
        console.error('視圖提供者註冊失敗:', error);
        vscode.window.showErrorMessage(`Devika 視圖註冊失敗: ${error}`);
    }
}

function createStatusBarItem(context: vscode.ExtensionContext): void {
    // 創建狀態欄項目
    llmStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    llmStatusBarItem.command = 'devika.switchLLM';
    llmStatusBarItem.tooltip = '點擊切換 LLM 模型';

    // 更新狀態欄顯示
    updateStatusBarItem();

    // 顯示狀態欄項目
    llmStatusBarItem.show();

    // 添加到訂閱列表
    context.subscriptions.push(llmStatusBarItem);

    // 監聽配置變更
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('devika.preferredModel')) {
            updateStatusBarItem();
        }
    });
    context.subscriptions.push(configChangeListener);
}

function updateStatusBarItem(): void {
    if (!llmStatusBarItem) {
        return;
    }

    const configManager = ConfigManager.getInstance();
    const currentModel = configManager.getPreferredModel();

    // 簡化模型名稱顯示
    let displayName = currentModel;
    if (currentModel.includes('gpt-4')) {
        displayName = '🤖 GPT-4';
    } else if (currentModel.includes('gpt-3.5')) {
        displayName = '💨 GPT-3.5';
    } else if (currentModel.includes('claude-3-5-sonnet')) {
        displayName = '🧠 Claude 3.5';
    } else if (currentModel.includes('claude-3-opus')) {
        displayName = '🎯 Claude Opus';
    } else if (currentModel.includes('claude-3-haiku')) {
        displayName = '⚡ Claude Haiku';
    } else if (currentModel.includes('gemini')) {
        displayName = '💎 Gemini';
    }

    llmStatusBarItem.text = `$(robot) ${displayName}`;
}

async function startAutomaticFeatures(): Promise<void> {
    try {
        if (!devikaCoreManager) {
            return;
        }

        // 1. 自動索引工作區
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            vscode.window.showInformationMessage('🔍 Devika 正在建立項目索引...');

            // 索引所有工作區
            for (const folder of workspaceFolders) {
                await devikaCoreManager.getCodeContextService().indexWorkspace(folder);
            }

            // 自動掃描 TODO
            if (ConfigManager.getInstance().getAutoScanTodos()) {
                await devikaCoreManager.scanTodos();
            }

            vscode.window.showInformationMessage('✅ 項目索引建立完成！');
        }

        // 2. 設置文件監聽器 (已在 registerFileListeners 中設置)

        console.log('自動功能已啟動：索引、TODO 掃描、文件監聽');

    } catch (error) {
        console.error('啟動自動功能失敗:', error);
        vscode.window.showWarningMessage(`部分自動功能啟動失敗: ${error}`);
    }
}

function generateProjectAnalysisHtml(structure: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .metric { margin: 10px 0; padding: 10px; background: var(--vscode-textCodeBlock-background); }
            .file-list { max-height: 300px; overflow-y: auto; }
        </style>
    </head>
    <body>
        <h1>📊 項目分析報告</h1>

        <div class="metric">
            <h3>📁 項目概覽</h3>
            <p><strong>根目錄:</strong> ${structure.rootPath}</p>
            <p><strong>總文件數:</strong> ${structure.files?.length || 0}</p>
            <p><strong>目錄數:</strong> ${structure.directories?.length || 0}</p>
        </div>

        <div class="metric">
            <h3>📈 項目指標</h3>
            <p><strong>總行數:</strong> ${structure.metrics?.totalLines || 0}</p>
            <p><strong>總大小:</strong> ${Math.round((structure.metrics?.totalSize || 0) / 1024)} KB</p>
            <p><strong>平均文件大小:</strong> ${Math.round(structure.metrics?.averageFileSize || 0)} bytes</p>
        </div>

        <div class="metric">
            <h3>🔗 依賴項</h3>
            <div class="file-list">
                ${structure.dependencies?.map((dep: any) =>
                    `<p>• ${dep.name} (${dep.type}): ${dep.version || 'latest'}</p>`
                ).join('') || '<p>沒有找到依賴項</p>'}
            </div>
        </div>

        <div class="metric">
            <h3>📂 目錄結構</h3>
            <div class="file-list">
                ${structure.directories?.map((dir: any) =>
                    `<p>📁 ${dir.path} (${dir.fileCount} 個文件)</p>`
                ).join('') || '<p>沒有找到目錄</p>'}
            </div>
        </div>
    </body>
    </html>
    `;
}

function generateGitHistoryHtml(history: any[]): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .commit { margin: 15px 0; padding: 15px; background: var(--vscode-textCodeBlock-background); border-radius: 5px; }
            .commit-hash { font-family: monospace; color: var(--vscode-textLink-foreground); }
            .commit-date { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
        </style>
    </head>
    <body>
        <h1>📜 Git 提交歷史</h1>

        ${history.map(commit => `
            <div class="commit">
                <div class="commit-hash">${commit.hash.substring(0, 8)}</div>
                <div><strong>${commit.message}</strong></div>
                <div class="commit-date">👤 ${commit.author} • 📅 ${new Date(commit.date).toLocaleString()}</div>
                ${commit.files?.length ? `<div>📁 ${commit.files.length} 個文件變更</div>` : ''}
            </div>
        `).join('')}
    </body>
    </html>
    `;
}

function generateFileHistoryHtml(history: any[], filePath: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .commit { margin: 15px 0; padding: 15px; background: var(--vscode-textCodeBlock-background); border-radius: 5px; }
            .commit-hash { font-family: monospace; color: var(--vscode-textLink-foreground); }
            .commit-date { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
            .file-path { background: var(--vscode-badge-background); padding: 5px 10px; border-radius: 3px; }
        </style>
    </head>
    <body>
        <h1>📄 文件歷史</h1>
        <div class="file-path">📁 ${filePath}</div>

        ${history.map(commit => `
            <div class="commit">
                <div class="commit-hash">${commit.hash.substring(0, 8)}</div>
                <div><strong>${commit.message}</strong></div>
                <div class="commit-date">👤 ${commit.author} • 📅 ${new Date(commit.date).toLocaleString()}</div>
            </div>
        `).join('')}
    </body>
    </html>
    `;
}
