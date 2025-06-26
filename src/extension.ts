import * as vscode from 'vscode';
import { DevikaCoreManager } from './core/DevikaCoreManager';
import { UIManager } from './ui/UIManager';
import { ConfigManager } from './config/ConfigManager';
import { TaskManager } from './tasks/TaskManager';
import { GitService } from './git/GitService';
import { CodeContextService } from './context/CodeContextService';

let devikaCoreManager: DevikaCoreManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Devika AI 助理正在啟動...');

    // 初始化核心管理器
    devikaCoreManager = new DevikaCoreManager(context);

    // 設定 context 變數，用於控制 UI 顯示
    vscode.commands.executeCommand('setContext', 'devika.activated', true);

    // 註冊所有指令
    registerCommands(context);

    // 初始化服務
    initializeServices(context);

    console.log('Devika AI 助理已成功啟動！');
}

export function deactivate() {
    if (devikaCoreManager) {
        devikaCoreManager.dispose();
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    const commands = [
        // 主要指令
        vscode.commands.registerCommand('devika.start', () => {
            devikaCoreManager.showMainPanel();
        }),

        // 程式碼分析指令
        vscode.commands.registerCommand('devika.analyzeCode', async () => {
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
