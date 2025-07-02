/**
 * 文件系統操作優化器
 * 提供高效的文件掃描、批量處理和並行操作
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Worker } from 'worker_threads';

/**
 * 文件掃描選項
 */
export interface ScanOptions {
    include?: string[];
    exclude?: string[];
    maxDepth?: number;
    maxFiles?: number;
    followSymlinks?: boolean;
    includeHidden?: boolean;
    batchSize?: number;
    maxConcurrency?: number;
}

/**
 * 文件信息
 */
export interface FileInfo {
    uri: vscode.Uri;
    name: string;
    size: number;
    lastModified: Date;
    isDirectory: boolean;
    extension: string;
    relativePath: string;
}

/**
 * 掃描結果
 */
export interface ScanResult {
    files: FileInfo[];
    totalFiles: number;
    totalSize: number;
    scanTime: number;
    skippedFiles: number;
}

/**
 * 批量操作結果
 */
export interface BatchOperationResult<T> {
    successful: T[];
    failed: Array<{ file: FileInfo; error: Error }>;
    totalProcessed: number;
    processingTime: number;
}

/**
 * 文件系統優化器
 */
export class FileSystemOptimizer {
    private static instance: FileSystemOptimizer;
    private scanCache = new Map<string, { result: ScanResult; timestamp: number }>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

    private constructor() {}

    static getInstance(): FileSystemOptimizer {
        if (!FileSystemOptimizer.instance) {
            FileSystemOptimizer.instance = new FileSystemOptimizer();
        }
        return FileSystemOptimizer.instance;
    }

    /**
     * 優化的文件掃描
     */
    async scanFiles(
        workspaceFolder: vscode.WorkspaceFolder,
        options: ScanOptions = {}
    ): Promise<ScanResult> {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(workspaceFolder.uri.fsPath, options);

        // 檢查快取
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            return cached;
        }

        const {
            include = ['**/*'],
            exclude = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
            maxDepth = 10,
            maxFiles = 10000,
            followSymlinks = false,
            includeHidden = false,
            batchSize = 100,
            maxConcurrency = 4
        } = options;

        try {
            const files: FileInfo[] = [];
            let totalSize = 0;
            let skippedFiles = 0;

            // 使用 VS Code 的文件搜索 API
            const includePattern = include.join(',');
            const excludePattern = exclude.join(',');

            const foundFiles = await vscode.workspace.findFiles(
                includePattern,
                excludePattern,
                maxFiles
            );

            // 並行處理文件信息
            const batches = this.createBatches(foundFiles, batchSize);
            const concurrencyLimit = Math.min(maxConcurrency, batches.length);

            await this.processBatchesConcurrently(
                batches,
                concurrencyLimit,
                async (batch) => {
                    const batchResults = await Promise.allSettled(
                        batch.map(uri => this.getFileInfo(uri, workspaceFolder.uri))
                    );

                    for (const result of batchResults) {
                        if (result.status === 'fulfilled' && result.value) {
                            const fileInfo = result.value;
                            
                            // 應用過濾條件
                            if (this.shouldIncludeFile(fileInfo, options)) {
                                files.push(fileInfo);
                                totalSize += fileInfo.size;
                            } else {
                                skippedFiles++;
                            }
                        } else {
                            skippedFiles++;
                        }
                    }
                }
            );

            const scanTime = Date.now() - startTime;
            const result: ScanResult = {
                files,
                totalFiles: files.length,
                totalSize,
                scanTime,
                skippedFiles
            };

            // 快取結果
            this.setCachedResult(cacheKey, result);

            return result;

        } catch (error) {
            throw new Error(`文件掃描失敗: ${error}`);
        }
    }

    /**
     * 批量文件操作
     */
    async batchOperation<T>(
        files: FileInfo[],
        operation: (file: FileInfo) => Promise<T>,
        options: {
            batchSize?: number;
            maxConcurrency?: number;
            onProgress?: (processed: number, total: number) => void;
            continueOnError?: boolean;
        } = {}
    ): Promise<BatchOperationResult<T>> {
        const startTime = Date.now();
        const {
            batchSize = 50,
            maxConcurrency = 3,
            onProgress,
            continueOnError = true
        } = options;

        const successful: T[] = [];
        const failed: Array<{ file: FileInfo; error: Error }> = [];
        let processed = 0;

        const batches = this.createBatches(files, batchSize);

        await this.processBatchesConcurrently(
            batches,
            maxConcurrency,
            async (batch) => {
                const batchResults = await Promise.allSettled(
                    batch.map(async (file) => {
                        try {
                            const result = await operation(file);
                            return { file, result, success: true };
                        } catch (error) {
                            return { 
                                file, 
                                error: error instanceof Error ? error : new Error(String(error)), 
                                success: false 
                            };
                        }
                    })
                );

                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        const { file, result: opResult, error, success } = result.value;
                        
                        if (success) {
                            successful.push(opResult);
                        } else {
                            failed.push({ file, error: error! });
                            
                            if (!continueOnError) {
                                throw error;
                            }
                        }
                    }
                    
                    processed++;
                    if (onProgress) {
                        onProgress(processed, files.length);
                    }
                }
            }
        );

        return {
            successful,
            failed,
            totalProcessed: processed,
            processingTime: Date.now() - startTime
        };
    }

    /**
     * 智能文件監視
     */
    createSmartFileWatcher(
        workspaceFolder: vscode.WorkspaceFolder,
        options: {
            include?: string[];
            exclude?: string[];
            debounceMs?: number;
            batchChanges?: boolean;
        } = {}
    ): vscode.FileSystemWatcher {
        const {
            include = ['**/*'],
            exclude = ['**/node_modules/**', '**/dist/**', '**/.git/**'],
            debounceMs = 500,
            batchChanges = true
        } = options;

        const pattern = new vscode.RelativePattern(workspaceFolder, include.join(','));
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        if (batchChanges) {
            // 批量處理變更事件
            const changeQueue = new Set<vscode.Uri>();
            let debounceTimer: NodeJS.Timeout | null = null;

            const processChanges = () => {
                if (changeQueue.size > 0) {
                    const changes = Array.from(changeQueue);
                    changeQueue.clear();
                    
                    // 觸發批量變更事件
                    this.onBatchFileChanges?.(changes);
                }
            };

            const scheduleProcessing = () => {
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                debounceTimer = setTimeout(processChanges, debounceMs);
            };

            watcher.onDidChange(uri => {
                if (!this.isExcluded(uri, exclude)) {
                    changeQueue.add(uri);
                    scheduleProcessing();
                }
            });

            watcher.onDidCreate(uri => {
                if (!this.isExcluded(uri, exclude)) {
                    changeQueue.add(uri);
                    scheduleProcessing();
                }
            });

            watcher.onDidDelete(uri => {
                if (!this.isExcluded(uri, exclude)) {
                    changeQueue.add(uri);
                    scheduleProcessing();
                }
            });
        }

        return watcher;
    }

    /**
     * 並行讀取多個文件
     */
    async readFilesParallel(
        files: vscode.Uri[],
        options: {
            encoding?: string;
            maxConcurrency?: number;
            onProgress?: (completed: number, total: number) => void;
        } = {}
    ): Promise<Map<string, string>> {
        const { maxConcurrency = 5, onProgress } = options;
        const results = new Map<string, string>();
        let completed = 0;

        const batches = this.createBatches(files, maxConcurrency);

        for (const batch of batches) {
            const batchResults = await Promise.allSettled(
                batch.map(async (uri) => {
                    const document = await vscode.workspace.openTextDocument(uri);
                    return { uri: uri.fsPath, content: document.getText() };
                })
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.set(result.value.uri, result.value.content);
                }
                
                completed++;
                if (onProgress) {
                    onProgress(completed, files.length);
                }
            }
        }

        return results;
    }

    /**
     * 獲取文件信息
     */
    private async getFileInfo(uri: vscode.Uri, workspaceUri: vscode.Uri): Promise<FileInfo | null> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const relativePath = path.relative(workspaceUri.fsPath, uri.fsPath);
            
            return {
                uri,
                name: path.basename(uri.fsPath),
                size: stat.size,
                lastModified: new Date(stat.mtime),
                isDirectory: stat.type === vscode.FileType.Directory,
                extension: path.extname(uri.fsPath),
                relativePath
            };
        } catch {
            return null;
        }
    }

    /**
     * 檢查文件是否應該包含
     */
    private shouldIncludeFile(fileInfo: FileInfo, options: ScanOptions): boolean {
        // 檢查隱藏文件
        if (!options.includeHidden && fileInfo.name.startsWith('.')) {
            return false;
        }

        // 檢查深度
        if (options.maxDepth) {
            const depth = fileInfo.relativePath.split(path.sep).length;
            if (depth > options.maxDepth) {
                return false;
            }
        }

        return true;
    }

    /**
     * 檢查文件是否被排除
     */
    private isExcluded(uri: vscode.Uri, excludePatterns: string[]): boolean {
        const filePath = uri.fsPath;
        return excludePatterns.some(pattern => {
            // 簡單的模式匹配
            const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
            return regex.test(filePath);
        });
    }

    /**
     * 創建批次
     */
    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * 並行處理批次
     */
    private async processBatchesConcurrently<T>(
        batches: T[][],
        maxConcurrency: number,
        processor: (batch: T[]) => Promise<void>
    ): Promise<void> {
        const semaphore = new Array(maxConcurrency).fill(null);
        let batchIndex = 0;

        const processBatch = async (): Promise<void> => {
            while (batchIndex < batches.length) {
                const currentBatch = batches[batchIndex++];
                await processor(currentBatch);
            }
        };

        await Promise.all(semaphore.map(() => processBatch()));
    }

    /**
     * 生成快取鍵
     */
    private generateCacheKey(workspacePath: string, options: ScanOptions): string {
        return `${workspacePath}-${JSON.stringify(options)}`;
    }

    /**
     * 獲取快取結果
     */
    private getCachedResult(key: string): ScanResult | null {
        const cached = this.scanCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.result;
        }
        return null;
    }

    /**
     * 設置快取結果
     */
    private setCachedResult(key: string, result: ScanResult): void {
        this.scanCache.set(key, { result, timestamp: Date.now() });
    }

    /**
     * 清除快取
     */
    clearCache(): void {
        this.scanCache.clear();
    }

    /**
     * 批量文件變更事件處理器
     */
    private onBatchFileChanges?: (changes: vscode.Uri[]) => void;

    /**
     * 設置批量變更事件處理器
     */
    setBatchChangeHandler(handler: (changes: vscode.Uri[]) => void): void {
        this.onBatchFileChanges = handler;
    }
}

// 導出單例實例
export const fileSystemOptimizer = FileSystemOptimizer.getInstance();
