import * as vscode from 'vscode';
import * as path from 'path';

export interface FileOperation {
    type: 'create' | 'read' | 'write' | 'delete' | 'copy' | 'move';
    source: vscode.Uri;
    target?: vscode.Uri;
    content?: string | Uint8Array;
    options?: any;
}

export interface BatchOperationResult {
    success: boolean;
    completed: FileOperation[];
    failed: Array<{ operation: FileOperation; error: Error }>;
    totalTime: number;
}

export interface FileSystemStats {
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    fileTypes: Map<string, number>;
    lastModified: Date;
}

export class AdvancedFileSystemService {
    private readonly fs: vscode.FileSystem;
    private operationHistory: FileOperation[] = [];
    private readonly maxHistorySize = 1000;

    constructor() {
        this.fs = vscode.workspace.fs;
    }

    /**
     * 批量執行文件操作
     */
    async executeBatchOperations(
        operations: FileOperation[],
        options: {
            parallel?: boolean;
            maxConcurrency?: number;
            continueOnError?: boolean;
            progressCallback?: (progress: number, operation: FileOperation) => void;
        } = {}
    ): Promise<BatchOperationResult> {
        const startTime = Date.now();
        const completed: FileOperation[] = [];
        const failed: Array<{ operation: FileOperation; error: Error }> = [];

        const {
            parallel = true,
            maxConcurrency = 5,
            continueOnError = true,
            progressCallback
        } = options;

        if (parallel) {
            // 並行執行操作
            const chunks = this.chunkArray(operations, maxConcurrency);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const promises = chunk.map(async (operation) => {
                    try {
                        await this.executeOperation(operation);
                        completed.push(operation);
                        this.addToHistory(operation);

                        if (progressCallback) {
                            progressCallback(
                                (completed.length + failed.length) / operations.length * 100,
                                operation
                            );
                        }
                    } catch (error) {
                        failed.push({ operation, error: error as Error });
                        if (!continueOnError) {
                            throw error;
                        }
                    }
                });

                await Promise.all(promises);
            }
        } else {
            // 順序執行操作
            for (let i = 0; i < operations.length; i++) {
                const operation = operations[i];
                try {
                    await this.executeOperation(operation);
                    completed.push(operation);
                    this.addToHistory(operation);
                } catch (error) {
                    failed.push({ operation, error: error as Error });
                    if (!continueOnError) {
                        break;
                    }
                }

                if (progressCallback) {
                    progressCallback((i + 1) / operations.length * 100, operation);
                }
            }
        }

        return {
            success: failed.length === 0,
            completed,
            failed,
            totalTime: Date.now() - startTime
        };
    }

    /**
     * 執行單個文件操作
     */
    private async executeOperation(operation: FileOperation): Promise<void> {
        switch (operation.type) {
            case 'create':
                await this.createFile(operation.source, operation.content as string | Uint8Array);
                break;
            case 'read':
                await this.readFile(operation.source);
                break;
            case 'write':
                await this.writeFile(operation.source, operation.content as string | Uint8Array);
                break;
            case 'delete':
                await this.deleteFile(operation.source, operation.options);
                break;
            case 'copy':
                await this.copyFile(operation.source, operation.target!);
                break;
            case 'move':
                await this.moveFile(operation.source, operation.target!);
                break;
            default:
                throw new Error(`Unsupported operation type: ${operation.type}`);
        }
    }

    /**
     * 創建文件
     */
    async createFile(uri: vscode.Uri, content: string | Uint8Array = ''): Promise<void> {
        try {
            // 確保目錄存在
            await this.ensureDirectoryExists(path.dirname(uri.fsPath));

            const data = typeof content === 'string'
                ? Buffer.from(content, 'utf8')
                : content;

            await this.fs.writeFile(uri, data);
        } catch (error) {
            throw new Error(`Failed to create file ${uri.fsPath}: ${error}`);
        }
    }

    /**
     * 讀取文件
     */
    async readFile(uri: vscode.Uri): Promise<string> {
        try {
            const data = await this.fs.readFile(uri);
            return Buffer.from(data).toString('utf8');
        } catch (error) {
            throw new Error(`Failed to read file ${uri.fsPath}: ${error}`);
        }
    }

    /**
     * 寫入文件
     */
    async writeFile(uri: vscode.Uri, content: string | Uint8Array): Promise<void> {
        try {
            const data = typeof content === 'string'
                ? Buffer.from(content, 'utf8')
                : content;

            await this.fs.writeFile(uri, data);
        } catch (error) {
            throw new Error(`Failed to write file ${uri.fsPath}: ${error}`);
        }
    }

    /**
     * 刪除文件或目錄
     */
    async deleteFile(uri: vscode.Uri, options: { recursive?: boolean; useTrash?: boolean } = {}): Promise<void> {
        try {
            await this.fs.delete(uri, options);
        } catch (error) {
            throw new Error(`Failed to delete ${uri.fsPath}: ${error}`);
        }
    }

    /**
     * 複製文件
     */
    async copyFile(source: vscode.Uri, target: vscode.Uri): Promise<void> {
        try {
            await this.ensureDirectoryExists(path.dirname(target.fsPath));
            await this.fs.copy(source, target, { overwrite: true });
        } catch (error) {
            throw new Error(`Failed to copy ${source.fsPath} to ${target.fsPath}: ${error}`);
        }
    }

    /**
     * 移動文件
     */
    async moveFile(source: vscode.Uri, target: vscode.Uri): Promise<void> {
        try {
            await this.copyFile(source, target);
            await this.deleteFile(source);
        } catch (error) {
            throw new Error(`Failed to move ${source.fsPath} to ${target.fsPath}: ${error}`);
        }
    }

    /**
     * 確保目錄存在
     */
    async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(dirPath);
            await this.fs.createDirectory(uri);
        } catch (error) {
            // 目錄可能已存在，忽略錯誤
        }
    }

    /**
     * 獲取文件統計信息
     */
    async getFileSystemStats(rootUri: vscode.Uri): Promise<FileSystemStats> {
        const stats: FileSystemStats = {
            totalFiles: 0,
            totalDirectories: 0,
            totalSize: 0,
            fileTypes: new Map(),
            lastModified: new Date(0)
        };

        await this.collectStats(rootUri, stats);
        return stats;
    }

    /**
     * 遞歸收集統計信息
     */
    private async collectStats(uri: vscode.Uri, stats: FileSystemStats): Promise<void> {
        try {
            const entries = await this.fs.readDirectory(uri);

            for (const [name, type] of entries) {
                const childUri = vscode.Uri.joinPath(uri, name);

                if (type === vscode.FileType.Directory) {
                    stats.totalDirectories++;
                    await this.collectStats(childUri, stats);
                } else if (type === vscode.FileType.File) {
                    stats.totalFiles++;

                    try {
                        const fileStat = await this.fs.stat(childUri);
                        stats.totalSize += fileStat.size;

                        if (fileStat.mtime > stats.lastModified.getTime()) {
                            stats.lastModified = new Date(fileStat.mtime);
                        }

                        const ext = path.extname(name).toLowerCase();
                        stats.fileTypes.set(ext, (stats.fileTypes.get(ext) || 0) + 1);
                    } catch (error) {
                        // 忽略無法讀取的文件
                    }
                }
            }
        } catch (error) {
            // 忽略無法讀取的目錄
        }
    }

    /**
     * 備份文件
     */
    async backupFile(uri: vscode.Uri, backupDir?: vscode.Uri): Promise<vscode.Uri> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = path.basename(uri.fsPath);
        const backupFileName = `${fileName}.backup.${timestamp}`;

        const backupUri = backupDir
            ? vscode.Uri.joinPath(backupDir, backupFileName)
            : vscode.Uri.file(path.join(path.dirname(uri.fsPath), backupFileName));

        await this.copyFile(uri, backupUri);
        return backupUri;
    }

    /**
     * 恢復文件操作
     */
    async undoLastOperation(): Promise<boolean> {
        if (this.operationHistory.length === 0) {
            return false;
        }

        const lastOperation = this.operationHistory.pop()!;

        try {
            // 實現撤銷邏輯
            switch (lastOperation.type) {
                case 'create':
                    await this.deleteFile(lastOperation.source);
                    break;
                case 'delete':
                    // 無法撤銷刪除操作，除非有備份
                    return false;
                case 'move':
                    await this.moveFile(lastOperation.target!, lastOperation.source);
                    break;
                // 其他操作的撤銷邏輯...
            }
            return true;
        } catch (error) {
            // 撤銷失敗，重新加入歷史
            this.operationHistory.push(lastOperation);
            return false;
        }
    }

    /**
     * 添加操作到歷史記錄
     */
    private addToHistory(operation: FileOperation): void {
        this.operationHistory.push(operation);

        // 限制歷史記錄大小
        if (this.operationHistory.length > this.maxHistorySize) {
            this.operationHistory.shift();
        }
    }

    /**
     * 將數組分塊
     */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * 清理歷史記錄
     */
    clearHistory(): void {
        this.operationHistory = [];
    }

    /**
     * 獲取操作歷史
     */
    getHistory(): readonly FileOperation[] {
        return [...this.operationHistory];
    }
}
