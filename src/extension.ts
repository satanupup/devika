import * as vscode from 'vscode';
import { DevikaCoreManager } from './core/DevikaCoreManager';
import { UIManager } from './ui/UIManager';
import { ConfigManager } from './config/ConfigManager';
import { TaskManager } from './tasks/TaskManager';
import { GitService } from './git/GitService';
import { CodeContextService } from './context/CodeContextService';
import { PluginManager } from './plugins/PluginManager';
import { DevikaTaskProvider, DevikaChatProvider, DevikaContextProvider } from './ui/ViewProviders';

let devikaCoreManager: DevikaCoreManager;
let pluginManager: PluginManager;
let taskProvider: DevikaTaskProvider;
let chatProvider: DevikaChatProvider;
let contextProvider: DevikaContextProvider;

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

        console.log('Devika AI 助理已成功啟動！');

        // 顯示歡迎消息
        vscode.window.showInformationMessage(
            '🤖 Devika AI 助理已啟動！點擊側邊欄的 Devika 圖標開始使用。',
            '開始使用'
        ).then(choice => {
            if (choice === '開始使用') {
                vscode.commands.executeCommand('devika.start');
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
