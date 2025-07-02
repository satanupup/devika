import * as vscode from 'vscode';
import { ErrorHandlingUtils } from './ErrorHandlingUtils';

/**
 * 選擇項目接口
 */
export interface ChoiceItem {
    label: string;
    description?: string;
    detail?: string;
    action: () => void | Promise<void>;
}

/**
 * 進度選項
 */
export interface ProgressOptions {
    title: string;
    location?: vscode.ProgressLocation;
    cancellable?: boolean;
}

/**
 * 輸入選項
 */
export interface InputOptions extends vscode.InputBoxOptions {
    validateInput?: (value: string) => string | undefined;
}

/**
 * 快速選擇選項
 */
export interface QuickPickOptions extends vscode.QuickPickOptions {
    items: vscode.QuickPickItem[];
}

/**
 * VS Code API 工具類
 * 提供常用 VS Code API 的封裝和簡化
 */
export class VSCodeUtils {
    
    /**
     * 顯示選擇消息並執行對應動作
     */
    static async showChoiceMessage(
        message: string,
        choices: ChoiceItem[],
        messageType: 'info' | 'warning' | 'error' = 'info'
    ): Promise<void> {
        const labels = choices.map(c => c.label);
        
        let selectedLabel: string | undefined;
        
        switch (messageType) {
            case 'info':
                selectedLabel = await vscode.window.showInformationMessage(message, ...labels);
                break;
            case 'warning':
                selectedLabel = await vscode.window.showWarningMessage(message, ...labels);
                break;
            case 'error':
                selectedLabel = await vscode.window.showErrorMessage(message, ...labels);
                break;
        }
        
        const choice = choices.find(c => c.label === selectedLabel);
        if (choice) {
            await ErrorHandlingUtils.executeWithErrorHandling(
                () => Promise.resolve(choice.action()),
                `執行選擇動作: ${choice.label}`,
                { logError: true, showToUser: true }
            );
        }
    }

    /**
     * 顯示帶進度的操作
     */
    static async withProgress<T>(
        operation: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>,
        options: ProgressOptions
    ): Promise<T | undefined> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            () => vscode.window.withProgress({
                location: options.location ?? vscode.ProgressLocation.Notification,
                title: options.title,
                cancellable: options.cancellable ?? false
            }, operation),
            `進度操作: ${options.title}`,
            { logError: true, showToUser: true }
        );

        return result.success ? result.data : undefined;
    }

    /**
     * 安全的用戶輸入
     */
    static async getUserInput(
        options: InputOptions
    ): Promise<string | undefined> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const input = await vscode.window.showInputBox({
                    ...options,
                    validateInput: options.validateInput
                });
                
                if (input === undefined) {
                    throw new Error('用戶取消輸入');
                }
                
                return input;
            },
            '獲取用戶輸入',
            { logError: false, showToUser: false }
        );

        return result.success ? result.data : undefined;
    }

    /**
     * 快速選擇
     */
    static async showQuickPick<T extends vscode.QuickPickItem>(
        options: QuickPickOptions
    ): Promise<T | undefined> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const selected = await vscode.window.showQuickPick(options.items, options);
                if (!selected) {
                    throw new Error('用戶取消選擇');
                }
                return selected as T;
            },
            '快速選擇',
            { logError: false, showToUser: false }
        );

        return result.success ? result.data : undefined;
    }

    /**
     * 打開文件
     */
    static async openFile(
        uri: vscode.Uri,
        options: vscode.TextDocumentShowOptions = {}
    ): Promise<vscode.TextEditor | undefined> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const document = await vscode.workspace.openTextDocument(uri);
                return vscode.window.showTextDocument(document, options);
            },
            `打開文件 ${uri.fsPath}`,
            { logError: true, showToUser: true }
        );

        return result.success ? result.data : undefined;
    }

    /**
     * 創建並顯示輸出通道
     */
    static createOutputChannel(name: string): vscode.OutputChannel {
        return vscode.window.createOutputChannel(name);
    }

    /**
     * 安全執行命令
     */
    static async executeCommand<T = any>(
        command: string,
        ...args: any[]
    ): Promise<T | undefined> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            () => vscode.commands.executeCommand<T>(command, ...args),
            `執行命令: ${command}`,
            { logError: true, showToUser: false }
        );

        return result.success ? result.data : undefined;
    }

    /**
     * 註冊命令
     */
    static registerCommand(
        command: string,
        callback: (...args: any[]) => any,
        context: vscode.ExtensionContext
    ): void {
        const disposable = vscode.commands.registerCommand(command, async (...args) => {
            await ErrorHandlingUtils.executeWithErrorHandling(
                () => Promise.resolve(callback(...args)),
                `命令執行: ${command}`,
                { logError: true, showToUser: true }
            );
        });
        
        context.subscriptions.push(disposable);
    }

    /**
     * 創建狀態欄項目
     */
    static createStatusBarItem(
        alignment: vscode.StatusBarAlignment = vscode.StatusBarAlignment.Right,
        priority: number = 100
    ): vscode.StatusBarItem {
        return vscode.window.createStatusBarItem(alignment, priority);
    }

    /**
     * 獲取當前活動編輯器
     */
    static getActiveEditor(): vscode.TextEditor | undefined {
        return vscode.window.activeTextEditor;
    }

    /**
     * 獲取當前選擇的文本
     */
    static getSelectedText(): string | undefined {
        const editor = this.getActiveEditor();
        if (!editor) return undefined;

        const selection = editor.selection;
        if (selection.isEmpty) return undefined;

        return editor.document.getText(selection);
    }

    /**
     * 插入文本到當前位置
     */
    static async insertText(text: string): Promise<boolean> {
        const editor = this.getActiveEditor();
        if (!editor) return false;

        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                await editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, text);
                });
                return true;
            },
            '插入文本',
            { logError: true, showToUser: false }
        );

        return result.success;
    }

    /**
     * 替換選中的文本
     */
    static async replaceSelectedText(newText: string): Promise<boolean> {
        const editor = this.getActiveEditor();
        if (!editor) return false;

        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                await editor.edit(editBuilder => {
                    editBuilder.replace(editor.selection, newText);
                });
                return true;
            },
            '替換文本',
            { logError: true, showToUser: false }
        );

        return result.success;
    }

    /**
     * 獲取工作區配置
     */
    static getConfiguration(section?: string): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(section);
    }

    /**
     * 更新配置
     */
    static async updateConfiguration(
        section: string,
        key: string,
        value: any,
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
    ): Promise<boolean> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const config = this.getConfiguration(section);
                await config.update(key, value, target);
                return true;
            },
            `更新配置 ${section}.${key}`,
            { logError: true, showToUser: false }
        );

        return result.success;
    }

    /**
     * 獲取工作區文件夾
     */
    static getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] | undefined {
        return vscode.workspace.workspaceFolders;
    }

    /**
     * 獲取工作區根路徑
     */
    static getWorkspaceRoot(): string | undefined {
        const folders = this.getWorkspaceFolders();
        return folders?.[0]?.uri.fsPath;
    }

    /**
     * 顯示文檔
     */
    static async showDocument(
        uri: vscode.Uri,
        options?: vscode.TextDocumentShowOptions
    ): Promise<vscode.TextEditor | undefined> {
        return this.openFile(uri, options);
    }

    /**
     * 創建 WebView 面板
     */
    static createWebviewPanel(
        viewType: string,
        title: string,
        showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean },
        options?: vscode.WebviewPanelOptions & vscode.WebviewOptions
    ): vscode.WebviewPanel {
        return vscode.window.createWebviewPanel(viewType, title, showOptions, options);
    }

    /**
     * 註冊文件系統監視器
     */
    static createFileSystemWatcher(
        globPattern: vscode.GlobPattern,
        ignoreCreateEvents?: boolean,
        ignoreChangeEvents?: boolean,
        ignoreDeleteEvents?: boolean
    ): vscode.FileSystemWatcher {
        return vscode.workspace.createFileSystemWatcher(
            globPattern,
            ignoreCreateEvents,
            ignoreChangeEvents,
            ignoreDeleteEvents
        );
    }

    /**
     * 顯示保存對話框
     */
    static async showSaveDialog(
        options?: vscode.SaveDialogOptions
    ): Promise<vscode.Uri | undefined> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            () => vscode.window.showSaveDialog(options),
            '顯示保存對話框',
            { logError: true, showToUser: false }
        );

        return result.success ? result.data : undefined;
    }

    /**
     * 顯示打開對話框
     */
    static async showOpenDialog(
        options?: vscode.OpenDialogOptions
    ): Promise<vscode.Uri[] | undefined> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            () => vscode.window.showOpenDialog(options),
            '顯示打開對話框',
            { logError: true, showToUser: false }
        );

        return result.success ? result.data : undefined;
    }
}
