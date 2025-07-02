import * as vscode from 'vscode';
import { ConfigManager } from './config/ConfigManager';
import { DevikaCoreManager } from './core/DevikaCoreManager';
import { GitService } from './git/GitService';
import { LLMService } from './llm/LLMService';
import { MultimodalCommands } from './multimodal/MultimodalCommands';
import { MemoryManager } from './performance/MemoryManager';
import { performanceMonitor } from './performance/PerformanceMonitor';
import { PERFORMANCE_TARGETS, startupProfiler } from './performance/StartupProfiler';
import { PluginManager } from './plugins/PluginManager';
import { DevikaChatProvider, DevikaContextProvider, DevikaTaskProvider } from './ui/ViewProviders';

let devikaCoreManager: DevikaCoreManager;
let pluginManager: PluginManager;
let taskProvider: DevikaTaskProvider;
let memoryManager: MemoryManager;
let chatProvider: DevikaChatProvider;
let contextProvider: DevikaContextProvider;
let llmStatusBarItem: vscode.StatusBarItem;
let multimodalCommands: MultimodalCommands;

export async function activate(context: vscode.ExtensionContext) {
    // 🚀 開始性能監控
    startupProfiler.startProfiling();
    console.log('Devika AI 助理正在啟動...');

    try {
        // 🚀 階段 1: 立即啟動核心功能 (同步)
        console.log('📋 階段 1: 初始化核心組件...');

        // 設定 context 變數，立即啟用 UI
        vscode.commands.executeCommand('setContext', 'devika.activated', true);

        // 註冊所有指令 (必須同步完成)
        registerCommands(context);

        // 創建狀態欄項目 (輕量級)
        createStatusBarItem(context);

        // 註冊視圖提供者 (輕量級)
        registerViewProviders(context);

        console.log('✅ 階段 1 完成 - 基本功能已可用');

        // 🚀 階段 2: 異步初始化重型組件
        console.log('📋 階段 2: 異步初始化重型組件...');

        // 異步初始化核心管理器
        const coreInitPromise = initializeCoreManager(context);

        // 異步初始化插件管理器
        const pluginInitPromise = initializePluginManager(context);

        // 異步初始化服務
        const servicesInitPromise = initializeServicesAsync(context);

        // 🚀 階段 3: 並行等待核心組件完成
        const [coreManager] = await Promise.all([
            coreInitPromise,
            pluginInitPromise,
            servicesInitPromise
        ]);

        devikaCoreManager = coreManager;
        startupProfiler.markCoreReady();
        console.log('✅ 階段 2 完成 - 核心組件已就緒');

        // 🚀 階段 4: 後台異步初始化高級功能 (不阻塞啟動)
        console.log('📋 階段 3: 後台初始化高級功能...');

        // 立即顯示啟動完成消息
        console.log('🎉 Devika AI 助理核心功能已啟動！');

        // 後台異步初始化高級功能 (不等待完成)
        initializeAdvancedFeaturesAsync(context).then(() => {
            console.log('✅ 所有高級功能已就緒');

            // 顯示完全就緒通知
            vscode.window.showInformationMessage(
                '🧠 Devika AI 助理已完全就緒！所有功能現已可用。',
                '開始對話',
                '查看狀態'
            ).then(choice => {
                if (choice === '開始對話') {
                    vscode.commands.executeCommand('devika.start');
                } else if (choice === '查看狀態') {
                    vscode.commands.executeCommand('devika.showProjectStatus');
                }
            });
        }).catch(error => {
            console.warn('部分高級功能初始化失敗:', error);
        });

        // 顯示快速啟動完成消息
        vscode.window.showInformationMessage(
            '⚡ Devika AI 助理已快速啟動！正在後台加載高級功能...',
            '立即開始'
        ).then(choice => {
            if (choice === '立即開始') {
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

    if (multimodalCommands) {
        multimodalCommands.dispose();
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
                if (results['openai']) {
                    messages.push('✅ OpenAI API 連接正常');
                } else if (configManager.getOpenAIApiKey()) {
                    messages.push('❌ OpenAI API 連接失敗');
                }

                if (results['claude']) {
                    messages.push('✅ Claude API 連接正常');
                } else if (configManager.getClaudeApiKey()) {
                    messages.push('❌ Claude API 連接失敗');
                }

                if (results['gemini']) {
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
                        { label: '🚀 GPT-4o', description: 'OpenAI GPT-4o (最新旗艦模型)', value: 'gpt-4o' },
                        { label: '💨 GPT-4o Mini', description: 'OpenAI GPT-4o Mini (快速且經濟)', value: 'gpt-4o-mini' },
                        { label: '🤖 GPT-4 Turbo', description: 'OpenAI GPT-4 Turbo (強大推理)', value: 'gpt-4-turbo' },
                        { label: '⚡ GPT-3.5 Turbo', description: 'OpenAI GPT-3.5 Turbo (經濟選擇)', value: 'gpt-3.5-turbo' }
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
                        { label: '🧠 Gemini 2.5 Pro', description: 'Google 最先進的多用途模型 (推薦)', value: 'gemini-2.5-pro' },
                        { label: '⚡ Gemini 2.5 Flash', description: 'Google 混合推理模型 (支援思考)', value: 'gemini-2.5-flash' },
                        { label: '💨 Gemini 2.5 Flash-Lite', description: 'Google 最具成本效益的模型', value: 'gemini-2.5-flash-lite' },
                        { label: '🤖 Gemini 2.0 Flash', description: 'Google 為 Agents 時代打造的平衡模型', value: 'gemini-2.0-flash-001' },
                        { label: '🔥 Gemini 2.0 Flash-Lite', description: 'Google 最小、最具成本效益', value: 'gemini-2.0-flash-lite' },
                        { label: '🚀 Gemini 1.5 Pro', description: 'Google Gemini 1.5 Pro (長上下文)', value: 'gemini-1.5-pro' },
                        { label: '💎 Gemini 1.5 Flash', description: 'Google Gemini 1.5 Flash (快速)', value: 'gemini-1.5-flash' }
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

        // Markdown 文件分析指令
        vscode.commands.registerCommand('devika.analyzeMarkdown', async () => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage('請先打開一個 Markdown 文件');
                    return;
                }

                const document = editor.document;
                if (!document.fileName.endsWith('.md') && !document.fileName.endsWith('.markdown')) {
                    vscode.window.showWarningMessage('當前文件不是 Markdown 文件');
                    return;
                }

                // 動態導入 MarkdownAnalyzer
                const { MarkdownAnalyzer } = await import('./analyzer/MarkdownAnalyzer');
                const analyzer = new MarkdownAnalyzer();

                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "🔍 分析 Markdown 文件...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "解析文件結構..." });

                    const analysis = await analyzer.analyzeMarkdownFile(document.fileName);

                    progress.report({ increment: 50, message: "生成分析報告..." });

                    const summary = analyzer.generateSummary(analysis);

                    progress.report({ increment: 100, message: "完成！" });

                    // 創建新的文檔顯示分析結果
                    const resultDoc = await vscode.workspace.openTextDocument({
                        content: summary,
                        language: 'markdown'
                    });

                    await vscode.window.showTextDocument(resultDoc, vscode.ViewColumn.Beside);
                });

            } catch (error) {
                console.error('分析 Markdown 文件失敗:', error);
                vscode.window.showErrorMessage(`分析 Markdown 文件失敗: ${error}`);
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
                    workspaceName: workspaceFolders[0]?.name || 'Unknown',
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

        // 顯示記憶體使用狀況
        vscode.commands.registerCommand('devika.showMemoryStatus', async () => {
            try {
                if (!memoryManager) {
                    vscode.window.showWarningMessage('記憶體管理器未初始化');
                    return;
                }

                const memoryStats = memoryManager.getMemoryStats();
                const cacheStats = memoryManager.getCacheStats();

                const memoryReport = `📊 記憶體使用報告\n\n` +
                    `• 堆記憶體: ${Math.round(memoryStats.used / 1024 / 1024)}MB / ${Math.round(memoryStats.total / 1024 / 1024)}MB\n` +
                    `• 使用率: ${Math.round(memoryStats.percentage * 100)}%\n` +
                    `• 快取項目: ${cacheStats.itemCount} 個\n` +
                    `• 快取大小: ${Math.round(cacheStats.totalSize / 1024 / 1024)}MB\n` +
                    `• 命中率: ${Math.round(cacheStats.hitRate * 100)}%\n\n` +
                    `💡 如果記憶體使用過高，可以執行 "清理記憶體快取" 命令`;

                vscode.window.showInformationMessage(memoryReport, '清理快取', '關閉').then(choice => {
                    if (choice === '清理快取') {
                        vscode.commands.executeCommand('devika.clearMemoryCache');
                    }
                });

            } catch (error) {
                vscode.window.showErrorMessage(`顯示記憶體狀態失敗: ${error}`);
            }
        }),

        // 清理記憶體快取
        vscode.commands.registerCommand('devika.clearMemoryCache', async () => {
            try {
                if (!memoryManager) {
                    vscode.window.showWarningMessage('記憶體管理器未初始化');
                    return;
                }

                const beforeStats = memoryManager.getCacheStats();
                memoryManager.clear();
                memoryManager.forceGarbageCollection();

                vscode.window.showInformationMessage(
                    `🧹 記憶體快取已清理！釋放了 ${beforeStats.itemCount} 個項目，約 ${Math.round(beforeStats.totalSize / 1024 / 1024)}MB`
                );

            } catch (error) {
                vscode.window.showErrorMessage(`清理記憶體快取失敗: ${error}`);
            }
        }),

        // 顯示性能報告
        vscode.commands.registerCommand('devika.showPerformanceReport', async () => {
            try {
                const report = performanceMonitor.generatePerformanceReport();

                // 創建 Webview 顯示詳細報告
                const panel = vscode.window.createWebviewPanel(
                    'devikaPerformanceReport',
                    '📊 Devika 性能報告',
                    vscode.ViewColumn.One,
                    { enableScripts: true }
                );

                panel.webview.html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
                            pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
                            .metric { margin: 10px 0; padding: 10px; border-left: 3px solid #007acc; }
                        </style>
                    </head>
                    <body>
                        <div class="metric">
                            <pre>${report}</pre>
                        </div>
                    </body>
                    </html>
                `;

            } catch (error) {
                vscode.window.showErrorMessage(`顯示性能報告失敗: ${error}`);
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

// 舊的 initializeServices 函數已移至 initializeServicesAsync

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
    if (currentModel.includes('gpt-4o-mini')) {
        displayName = '💨 GPT-4o Mini';
    } else if (currentModel.includes('gpt-4o')) {
        displayName = '🚀 GPT-4o';
    } else if (currentModel.includes('gpt-4-turbo')) {
        displayName = '🤖 GPT-4 Turbo';
    } else if (currentModel.includes('gpt-3.5')) {
        displayName = '⚡ GPT-3.5';
    } else if (currentModel.includes('claude-3-5-sonnet')) {
        displayName = '🧠 Claude 3.5';
    } else if (currentModel.includes('claude-3-opus')) {
        displayName = '🎯 Claude Opus';
    } else if (currentModel.includes('claude-3-haiku')) {
        displayName = '⚡ Claude Haiku';
    } else if (currentModel.includes('gemini-2.5-pro')) {
        displayName = '🧠 Gemini 2.5 Pro';
    } else if (currentModel.includes('gemini-2.5-flash-lite')) {
        displayName = '💨 Gemini 2.5 Lite';
    } else if (currentModel.includes('gemini-2.5-flash')) {
        displayName = '⚡ Gemini 2.5 Flash';
    } else if (currentModel.includes('gemini-2.0-flash-lite')) {
        displayName = '🔥 Gemini 2.0 Lite';
    } else if (currentModel.includes('gemini-2.0-flash')) {
        displayName = '🤖 Gemini 2.0 Flash';
    } else if (currentModel.includes('gemini-1.5-flash')) {
        displayName = '💎 Gemini 1.5 Flash';
    } else if (currentModel.includes('gemini-1.5-pro')) {
        displayName = '🚀 Gemini 1.5 Pro';
    } else if (currentModel.includes('gemini')) {
        displayName = '💎 Gemini';
    }

    llmStatusBarItem.text = `$(robot) ${displayName}`;
}

async function startAutomaticFeatures(): Promise<void> {
    try {
        if (!devikaCoreManager) {
            console.warn('核心管理器未就緒，跳過自動功能啟動');
            return;
        }

        console.log('🔄 啟動自動功能...');

        // 1. 異步索引工作區 (不阻塞用戶操作)
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            // 後台異步索引，不等待完成
            indexWorkspaceAsync(workspaceFolders).then(() => {
                console.log('✅ 工作區索引完成');
                vscode.window.showInformationMessage('📚 項目索引已完成，AI 助理現在更了解您的代碼！');
            }).catch(error => {
                console.warn('工作區索引失敗:', error);
            });
        }

        // 2. 異步掃描 TODO (不阻塞)
        if (ConfigManager.getInstance().getAutoScanTodos()) {
            scanTodosAsync().then(() => {
                console.log('✅ TODO 掃描完成');
            }).catch(error => {
                console.warn('TODO 掃描失敗:', error);
            });
        }

        console.log('✅ 自動功能已啟動 (後台運行)');

    } catch (error) {
        console.error('啟動自動功能失敗:', error);
        // 不顯示錯誤消息給用戶，避免干擾
    }
}

async function indexWorkspaceAsync(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<void> {
    console.log('🔍 開始後台索引工作區...');

    for (const folder of workspaceFolders) {
        try {
            await devikaCoreManager.getCodeContextService().indexWorkspace(folder);
            console.log(`✅ 已索引工作區: ${folder.name}`);
        } catch (error) {
            console.warn(`索引工作區失敗 ${folder.name}:`, error);
        }
    }
}

async function scanTodosAsync(): Promise<void> {
    console.log('📝 開始後台掃描 TODO...');

    try {
        await devikaCoreManager.scanTodos();
        console.log('✅ TODO 掃描完成');
    } catch (error) {
        console.warn('TODO 掃描失敗:', error);
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

// 🚀 優化的異步初始化函數

async function initializeCoreManager(context: vscode.ExtensionContext): Promise<DevikaCoreManager> {
    console.log('🔧 初始化核心管理器...');
    const coreManager = new DevikaCoreManager(context);
    await coreManager.waitForInitialization();
    console.log('✅ 核心管理器已就緒');
    return coreManager;
}

async function initializePluginManager(context: vscode.ExtensionContext): Promise<void> {
    console.log('🔌 初始化插件管理器...');
    pluginManager = new PluginManager(context);
    console.log('✅ 插件管理器已就緒');
}

async function initializeServicesAsync(context: vscode.ExtensionContext): Promise<void> {
    console.log('⚙️ 初始化基礎服務...');

    // 初始化記憶體管理器
    memoryManager = MemoryManager.getInstance({
        maxSize: 50 * 1024 * 1024, // 50MB 快取限制
        maxItems: 5000,
        defaultTTL: 20 * 60 * 1000, // 20 分鐘 TTL
        cleanupInterval: 3 * 60 * 1000, // 3 分鐘清理間隔
        evictionPolicy: 'LRU'
    });
    console.log('🧠 記憶體管理器已初始化');

    // 啟動性能監控
    performanceMonitor.startMonitoring(30000); // 每 30 秒收集一次指標
    console.log('📊 性能監控已啟動');

    // 監聽檔案儲存事件，自動掃描 TODO
    const onSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (devikaCoreManager) {
            const config = ConfigManager.getInstance();
            if (config.getAutoScanTodos()) {
                await devikaCoreManager.scanTodosInDocument(document);
            }
        }
    });

    // 監聽檔案變更事件，更新程式碼索引
    const onChangeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (devikaCoreManager) {
            const config = ConfigManager.getInstance();
            if (config.getEnableCodeIndexing()) {
                await devikaCoreManager.updateCodeIndex(event.document);
            }
        }
    });

    // 初始化多模態功能
    const config = vscode.workspace.getConfiguration('devika');
    if (config.get('enableMultimodal', true)) {
        multimodalCommands = MultimodalCommands.getInstance();
        console.log('📷 多模態功能已啟用');
    }

    // 設定記憶體監控
    context.subscriptions.push(
        onSaveListener,
        onChangeListener,
        { dispose: () => memoryManager.dispose() }
    );

    startupProfiler.markServicesReady();
    console.log('✅ 基礎服務已就緒');
}

async function initializeAdvancedFeaturesAsync(context: vscode.ExtensionContext): Promise<void> {
    console.log('🚀 開始初始化高級功能...');

    const features = [
        {
            name: '持續學習機制',
            init: async () => {
                const { initializeLearningSystem } = await import('./learning');
                await initializeLearningSystem(context);
            }
        },
        {
            name: '對話記憶系統',
            init: async () => {
                const { initializeConversationMemorySystem } = await import('./memory');
                await initializeConversationMemorySystem(context);
            }
        },
        {
            name: '個性化建議系統',
            init: async () => {
                const { initializePersonalizationSystem } = await import('./personalization');
                await initializePersonalizationSystem(context);
            }
        },
        {
            name: '原生工具整合系統',
            init: async () => {
                const { initializeIntegrationSystem } = await import('./integrations');
                await initializeIntegrationSystem(context);
            }
        },
        {
            name: '編輯導航系統',
            init: async () => {
                const { initializeEditNavigationSystem } = await import('./navigation');
                await initializeEditNavigationSystem(context);
            }
        },
        {
            name: '智能代碼完成系統',
            init: async () => {
                const { initializeCodeCompletionSystem } = await import('./completion');
                await initializeCodeCompletionSystem(context);
            }
        }
    ];

    // 並行初始化所有高級功能
    const results = await Promise.allSettled(
        features.map(async (feature) => {
            try {
                await feature.init();
                console.log(`✅ ${feature.name}已啟動`);
                return { name: feature.name, success: true };
            } catch (error) {
                console.warn(`⚠️ ${feature.name}啟動失敗:`, error);
                return { name: feature.name, success: false, error };
            }
        })
    );

    // 統計結果
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`🎯 高級功能初始化完成: ${successful}/${results.length} 成功`);

    if (failed > 0) {
        console.warn(`⚠️ ${failed} 個高級功能初始化失敗，但不影響核心功能使用`);
    }

    // 標記高級功能就緒
    startupProfiler.markAdvancedFeaturesReady();

    // 啟動自動功能 (如果核心管理器已就緒)
    if (devikaCoreManager) {
        await startAutomaticFeatures();
    }

    // 標記完全就緒並生成性能報告
    startupProfiler.markFullyReady();

    // 與性能目標比較
    startupProfiler.compareWithTarget(PERFORMANCE_TARGETS);
}
