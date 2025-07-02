import * as vscode from 'vscode';
import * as path from 'path';
import { ErrorHandlingUtils, OperationResult, BatchOperationResult } from './ErrorHandlingUtils';

/**
 * 文件操作選項
 */
export interface FileOperationOptions {
    overwrite?: boolean;
    ignoreIfExists?: boolean;
    ignoreIfNotExists?: boolean;
    recursive?: boolean;
    createDirectories?: boolean;
}

/**
 * 批量文件操作選項
 */
export interface BatchFileOperationOptions extends FileOperationOptions {
    continueOnError?: boolean;
    maxConcurrency?: number;
    progressCallback?: (completed: number, total: number, current: string) => void;
}

/**
 * 文件搜索選項
 */
export interface FileSearchOptions {
    include?: string | string[];
    exclude?: string | string[];
    maxResults?: number;
    useRegex?: boolean;
    caseSensitive?: boolean;
}

/**
 * 文件信息接口
 */
export interface FileInfo {
    uri: vscode.Uri;
    relativePath: string;
    size: number;
    lastModified: Date;
    type: 'file' | 'directory';
    exists: boolean;
}

/**
 * 統一的文件操作工具類
 * 提供安全、一致的文件系統操作
 */
export class FileOperationUtils {
    private static readonly fs = vscode.workspace.fs;

    /**
     * 安全執行文件操作
     */
    static async safeFileOperation<T>(
        uri: vscode.Uri,
        operation: (uri: vscode.Uri) => Promise<T>,
        fallback?: T,
        context?: string
    ): Promise<T | undefined> {
        const operationContext = context || `文件操作 ${uri.fsPath}`;
        
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            () => operation(uri),
            operationContext,
            { logError: true, showToUser: false }
        );

        return result.success ? result.data : fallback;
    }

    /**
     * 檢查文件是否存在
     */
    static async exists(uri: vscode.Uri): Promise<boolean> {
        return this.safeFileOperation(
            uri,
            async (uri) => {
                await this.fs.stat(uri);
                return true;
            },
            false,
            '檢查文件存在'
        ) ?? false;
    }

    /**
     * 獲取文件信息
     */
    static async getFileInfo(uri: vscode.Uri): Promise<FileInfo | null> {
        return this.safeFileOperation(
            uri,
            async (uri) => {
                const stat = await this.fs.stat(uri);
                return {
                    uri,
                    relativePath: vscode.workspace.asRelativePath(uri),
                    size: stat.size,
                    lastModified: new Date(stat.mtime),
                    type: stat.type === vscode.FileType.Directory ? 'directory' : 'file',
                    exists: true
                };
            },
            null,
            '獲取文件信息'
        );
    }

    /**
     * 安全讀取文件
     */
    static async readFile(uri: vscode.Uri, encoding: BufferEncoding = 'utf8'): Promise<string | null> {
        return this.safeFileOperation(
            uri,
            async (uri) => {
                const content = await this.fs.readFile(uri);
                return Buffer.from(content).toString(encoding);
            },
            null,
            '讀取文件'
        );
    }

    /**
     * 安全寫入文件
     */
    static async writeFile(
        uri: vscode.Uri,
        content: string,
        options: FileOperationOptions = {}
    ): Promise<boolean> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                // 確保目錄存在
                if (options.createDirectories) {
                    await this.ensureDirectoryExists(path.dirname(uri.fsPath));
                }

                // 檢查文件是否存在
                const exists = await this.exists(uri);
                if (exists && !options.overwrite && !options.ignoreIfExists) {
                    throw new Error(`文件已存在: ${uri.fsPath}`);
                }

                await this.fs.writeFile(uri, Buffer.from(content, 'utf8'));
                return true;
            },
            `寫入文件 ${uri.fsPath}`,
            { logError: true, showToUser: false }
        );

        return result.success;
    }

    /**
     * 安全複製文件
     */
    static async copyFile(
        source: vscode.Uri,
        target: vscode.Uri,
        options: FileOperationOptions = {}
    ): Promise<boolean> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                // 確保目標目錄存在
                if (options.createDirectories) {
                    await this.ensureDirectoryExists(path.dirname(target.fsPath));
                }

                await this.fs.copy(source, target, {
                    overwrite: options.overwrite ?? false
                });
                return true;
            },
            `複製文件 ${source.fsPath} 到 ${target.fsPath}`,
            { logError: true, showToUser: false }
        );

        return result.success;
    }

    /**
     * 安全移動文件
     */
    static async moveFile(
        source: vscode.Uri,
        target: vscode.Uri,
        options: FileOperationOptions = {}
    ): Promise<boolean> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                // 確保目標目錄存在
                if (options.createDirectories) {
                    await this.ensureDirectoryExists(path.dirname(target.fsPath));
                }

                await this.fs.rename(source, target);
                return true;
            },
            `移動文件 ${source.fsPath} 到 ${target.fsPath}`,
            { logError: true, showToUser: false }
        );

        return result.success;
    }

    /**
     * 安全刪除文件
     */
    static async deleteFile(
        uri: vscode.Uri,
        options: FileOperationOptions = {}
    ): Promise<boolean> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const exists = await this.exists(uri);
                if (!exists && options.ignoreIfNotExists) {
                    return true;
                }

                await this.fs.delete(uri, {
                    recursive: options.recursive ?? false,
                    useTrash: false
                });
                return true;
            },
            `刪除文件 ${uri.fsPath}`,
            { logError: true, showToUser: false }
        );

        return result.success;
    }

    /**
     * 確保目錄存在
     */
    static async ensureDirectoryExists(dirPath: string): Promise<boolean> {
        const uri = vscode.Uri.file(dirPath);
        
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const exists = await this.exists(uri);
                if (!exists) {
                    await this.fs.createDirectory(uri);
                }
                return true;
            },
            `創建目錄 ${dirPath}`,
            { logError: true, showToUser: false }
        );

        return result.success;
    }

    /**
     * 批量文件操作
     */
    static async batchFileOperation<T>(
        files: vscode.Uri[],
        operation: (uri: vscode.Uri, index: number) => Promise<T>,
        options: BatchFileOperationOptions = {}
    ): Promise<BatchOperationResult<T>> {
        const { maxConcurrency = 5, progressCallback } = options;
        
        return ErrorHandlingUtils.executeBatchWithErrorHandling(
            files,
            async (uri, index) => {
                progressCallback?.(index, files.length, uri.fsPath);
                return operation(uri, index);
            },
            '批量文件操作',
            { continueOnError: options.continueOnError }
        );
    }

    /**
     * 搜索文件
     */
    static async findFiles(
        pattern: string,
        options: FileSearchOptions = {}
    ): Promise<vscode.Uri[]> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const includePattern = Array.isArray(options.include) 
                    ? `{${options.include.join(',')}}` 
                    : options.include;
                
                const excludePattern = Array.isArray(options.exclude)
                    ? `{${options.exclude.join(',')}}`
                    : options.exclude;

                return vscode.workspace.findFiles(
                    pattern,
                    excludePattern,
                    options.maxResults
                );
            },
            `搜索文件 ${pattern}`,
            { logError: true, showToUser: false }
        );

        return result.success ? result.data || [] : [];
    }

    /**
     * 獲取目錄下所有文件
     */
    static async getDirectoryFiles(
        dirUri: vscode.Uri,
        recursive: boolean = false
    ): Promise<FileInfo[]> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const files: FileInfo[] = [];
                await this.collectFiles(dirUri, files, recursive);
                return files;
            },
            `獲取目錄文件 ${dirUri.fsPath}`,
            { logError: true, showToUser: false }
        );

        return result.success ? result.data || [] : [];
    }

    /**
     * 遞歸收集文件
     */
    private static async collectFiles(
        dirUri: vscode.Uri,
        files: FileInfo[],
        recursive: boolean
    ): Promise<void> {
        const entries = await this.fs.readDirectory(dirUri);
        
        for (const [name, type] of entries) {
            const uri = vscode.Uri.joinPath(dirUri, name);
            const fileInfo = await this.getFileInfo(uri);
            
            if (fileInfo) {
                files.push(fileInfo);
                
                if (recursive && type === vscode.FileType.Directory) {
                    await this.collectFiles(uri, files, recursive);
                }
            }
        }
    }

    /**
     * 計算目錄大小
     */
    static async getDirectorySize(dirUri: vscode.Uri): Promise<number> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const files = await this.getDirectoryFiles(dirUri, true);
                return files
                    .filter(f => f.type === 'file')
                    .reduce((total, file) => total + file.size, 0);
            },
            `計算目錄大小 ${dirUri.fsPath}`,
            { logError: true, showToUser: false }
        );

        return result.success ? result.data || 0 : 0;
    }

    /**
     * 清理空目錄
     */
    static async cleanEmptyDirectories(rootUri: vscode.Uri): Promise<number> {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                let cleanedCount = 0;
                const directories = await this.getDirectoryFiles(rootUri, true);
                
                // 按深度排序，從最深的開始清理
                const sortedDirs = directories
                    .filter(f => f.type === 'directory')
                    .sort((a, b) => b.relativePath.split('/').length - a.relativePath.split('/').length);

                for (const dir of sortedDirs) {
                    const entries = await this.fs.readDirectory(dir.uri);
                    if (entries.length === 0) {
                        await this.deleteFile(dir.uri);
                        cleanedCount++;
                    }
                }

                return cleanedCount;
            },
            `清理空目錄 ${rootUri.fsPath}`,
            { logError: true, showToUser: false }
        );

        return result.success ? result.data || 0 : 0;
    }
}
