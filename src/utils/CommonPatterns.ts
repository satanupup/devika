/**
 * 通用模式工具類
 * 消除代碼重複，提供統一的常用操作模式
 */

import * as vscode from 'vscode';
import { ErrorHandlingUtils, OperationResult } from './ErrorHandlingUtils';

/**
 * 代碼分析通用模式
 */
export interface CodeAnalysisPattern {
    selectedText: string;
    document: vscode.TextDocument;
    selection: vscode.Selection;
    contextLines?: number;
}

/**
 * LLM 調用通用模式
 */
export interface LLMCallPattern {
    prompt: string;
    options?: {
        maxTokens?: number;
        temperature?: number;
        stream?: boolean;
        onToken?: (token: string) => void;
    };
}

/**
 * 任務創建通用模式
 */
export interface TaskCreationPattern {
    title: string;
    description: string;
    fileUri?: vscode.Uri;
    selection?: vscode.Selection;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    tags?: string[];
}

/**
 * 通用模式工具類
 */
export class CommonPatterns {

    /**
     * 統一的代碼分析流程
     */
    static async executeCodeAnalysis<T>(
        pattern: CodeAnalysisPattern,
        analysisFunction: (context: any) => Promise<T>,
        options: {
            progressMessage?: string;
            successMessage?: string;
            errorMessage?: string;
        } = {}
    ): Promise<OperationResult<T>> {
        const {
            progressMessage = '正在分析程式碼...',
            successMessage = '分析完成',
            errorMessage: _errorMessage = '分析失敗'
        } = options;

        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                // 顯示進度消息
                vscode.window.showInformationMessage(progressMessage);

                // 獲取程式碼上下文
                const context = await this.getCodeContext(pattern);

                // 執行分析
                const result = await analysisFunction(context);

                // 顯示成功消息
                if (successMessage) {
                    vscode.window.showInformationMessage(successMessage);
                }

                return result;
            },
            `代碼分析: ${pattern.document.fileName}`,
            { logError: true, showToUser: true }
        );
    }

    /**
     * 統一的 LLM 調用流程
     */
    static async executeLLMCall<T>(
        pattern: LLMCallPattern,
        llmService: any,
        responseParser: (response: any) => T,
        options: {
            retryCount?: number;
            timeoutMs?: number;
            fallbackResponse?: T;
        } = {}
    ): Promise<OperationResult<T>> {
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                // 調用 LLM
                const response = await llmService.generateCompletion(
                    pattern.prompt,
                    pattern.options
                );

                // 解析回應
                return responseParser(response);
            },
            'LLM 調用',
            {
                retryCount: options.retryCount || 2,
                logError: true,
                showToUser: false
            }
        );
    }

    /**
     * 統一的任務創建流程
     */
    static async executeTaskCreation(
        patterns: TaskCreationPattern[],
        taskManager: any,
        options: {
            batchSize?: number;
            showProgress?: boolean;
            successMessage?: string;
        } = {}
    ): Promise<OperationResult<any[]>> {
        const {
            batchSize = 10,
            showProgress = true,
            successMessage = '任務創建完成'
        } = options;

        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const createdTasks = [];

                // 分批處理任務
                for (let i = 0; i < patterns.length; i += batchSize) {
                    const batch = patterns.slice(i, i + batchSize);

                    if (showProgress) {
                        vscode.window.showInformationMessage(
                            `正在創建任務 ${i + 1}-${Math.min(i + batchSize, patterns.length)} / ${patterns.length}`
                        );
                    }

                    // 並行創建批次任務
                    const batchTasks = await Promise.all(
                        batch.map(pattern => taskManager.addTask(pattern))
                    );

                    createdTasks.push(...batchTasks);
                }

                if (successMessage) {
                    vscode.window.showInformationMessage(
                        `${successMessage}: 已創建 ${createdTasks.length} 個任務`
                    );
                }

                return createdTasks;
            },
            '任務創建',
            { logError: true, showToUser: true }
        );
    }

    /**
     * 統一的文件操作流程
     */
    static async executeFileOperation<T>(
        fileUri: vscode.Uri,
        operation: (content: string) => Promise<T>,
        options: {
            encoding?: string;
            backup?: boolean;
            validateContent?: (content: string) => boolean;
        } = {}
    ): Promise<OperationResult<T>> {
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                // 讀取文件內容
                const document = await vscode.workspace.openTextDocument(fileUri);
                const content = document.getText();

                // 驗證內容
                if (options.validateContent && !options.validateContent(content)) {
                    throw new Error('文件內容驗證失敗');
                }

                // 創建備份
                if (options.backup) {
                    await this.createBackup(fileUri, content);
                }

                // 執行操作
                return await operation(content);
            },
            `文件操作: ${fileUri.fsPath}`,
            { logError: true, showToUser: false }
        );
    }

    /**
     * 統一的用戶選擇流程
     */
    static async executeUserSelection<T>(
        items: T[],
        options: {
            placeHolder?: string;
            canPickMany?: boolean;
            itemToLabel?: (item: T) => string;
            itemToDescription?: (item: T) => string;
            onSelectionChange?: (selection: T[]) => void;
        }
    ): Promise<T | T[] | undefined> {
        const quickPickItems = items.map(item => ({
            label: options.itemToLabel ? options.itemToLabel(item) : String(item),
            description: options.itemToDescription ? options.itemToDescription(item) : '',
            item
        }));

        if (options.canPickMany) {
            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: options.placeHolder,
                canPickMany: true
            });
            return selected ? (selected as any[]).map(s => s.item) : undefined;
        } else {
            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: options.placeHolder
            });
            return selected ? (selected as any).item : undefined;
        }
    }

    /**
     * 統一的進度顯示流程
     */
    static async executeWithProgress<T>(
        operation: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>,
        options: {
            title: string;
            location?: vscode.ProgressLocation;
            cancellable?: boolean;
        }
    ): Promise<T> {
        return vscode.window.withProgress(
            {
                location: options.location || vscode.ProgressLocation.Notification,
                title: options.title,
                cancellable: options.cancellable || false
            },
            operation
        );
    }

    /**
     * 統一的配置獲取流程
     */
    static getConfigValue<T>(
        key: string,
        defaultValue: T,
        scope?: vscode.ConfigurationScope
    ): T {
        const config = vscode.workspace.getConfiguration('devika', scope);
        return config.get<T>(key, defaultValue);
    }

    /**
     * 統一的配置設置流程
     */
    static async setConfigValue(
        key: string,
        value: any,
        target?: vscode.ConfigurationTarget
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('devika');
        await config.update(key, value, target || vscode.ConfigurationTarget.Global);
    }

    /**
     * 獲取代碼上下文
     */
    private static async getCodeContext(pattern: CodeAnalysisPattern): Promise<any> {
        const { document, selection, contextLines = 10 } = pattern;

        const startLine = Math.max(0, selection.start.line - contextLines);
        const endLine = Math.min(document.lineCount - 1, selection.end.line + contextLines);

        const contextRange = new vscode.Range(startLine, 0, endLine, 0);
        const contextText = document.getText(contextRange);

        return {
            selectedText: pattern.selectedText,
            contextText,
            fileName: document.fileName,
            language: document.languageId,
            selection,
            document
        };
    }

    /**
     * 創建文件備份
     */
    private static async createBackup(fileUri: vscode.Uri, content: string): Promise<void> {
        const backupUri = vscode.Uri.file(`${fileUri.fsPath}.backup.${Date.now()}`);
        await vscode.workspace.fs.writeFile(backupUri, Buffer.from(content, 'utf8'));
    }

    /**
     * 生成唯一 ID
     */
    static generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 格式化文件大小
     */
    static formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * 格式化時間差
     */
    static formatTimeDiff(startTime: number, endTime: number = Date.now()): string {
        const diff = endTime - startTime;

        if (diff < 1000) return `${diff}ms`;
        if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
        if (diff < 3600000) return `${(diff / 60000).toFixed(1)}m`;

        return `${(diff / 3600000).toFixed(1)}h`;
    }

    /**
     * 安全的 JSON 解析
     */
    static safeJsonParse<T>(json: string, defaultValue: T): T {
        try {
            return JSON.parse(json);
        } catch {
            return defaultValue;
        }
    }

    /**
     * 防抖函數
     */
    static debounce<T extends (...args: any[]) => any>(
        func: T,
        wait: number
    ): (...args: Parameters<T>) => void {
        let timeout: NodeJS.Timeout;

        return (...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    /**
     * 節流函數
     */
    static throttle<T extends (...args: any[]) => any>(
        func: T,
        limit: number
    ): (...args: Parameters<T>) => void {
        let inThrottle: boolean;

        return (...args: Parameters<T>) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}
