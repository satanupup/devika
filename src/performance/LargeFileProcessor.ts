import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';
import { FileOperationUtils } from '../utils/FileOperationUtils';

/**
 * 文件處理選項
 */
export interface FileProcessingOptions {
    chunkSize: number;
    maxFileSize: number;
    encoding: BufferEncoding;
    progressCallback?: (progress: number, total: number) => void;
    cancellationToken?: vscode.CancellationToken;
}

/**
 * 流式處理結果
 */
export interface StreamProcessingResult<T> {
    success: boolean;
    data?: T;
    processedBytes: number;
    totalBytes: number;
    chunks: number;
    duration: number;
    error?: Error;
}

/**
 * 大型文件處理器
 * 實現分塊處理和流式讀取大型文件
 */
export class LargeFileProcessor {
    private static instance: LargeFileProcessor;
    private readonly defaultOptions: FileProcessingOptions = {
        chunkSize: 64 * 1024, // 64KB
        maxFileSize: 100 * 1024 * 1024, // 100MB
        encoding: 'utf8'
    };

    private constructor() {}

    static getInstance(): LargeFileProcessor {
        if (!LargeFileProcessor.instance) {
            LargeFileProcessor.instance = new LargeFileProcessor();
        }
        return LargeFileProcessor.instance;
    }

    /**
     * 流式讀取大型文件
     */
    async streamReadFile<T>(
        uri: vscode.Uri,
        processor: (chunk: string, index: number) => Promise<T | null>,
        options: Partial<FileProcessingOptions> = {}
    ): Promise<StreamProcessingResult<T[]>> {
        const opts = { ...this.defaultOptions, ...options };
        const startTime = Date.now();
        
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                // 檢查文件大小
                const stats = await fs.promises.stat(uri.fsPath);
                if (stats.size > opts.maxFileSize) {
                    throw new Error(`文件過大: ${stats.size} bytes (最大: ${opts.maxFileSize} bytes)`);
                }

                const results: T[] = [];
                let processedBytes = 0;
                let chunkIndex = 0;

                // 創建讀取流
                const stream = fs.createReadStream(uri.fsPath, {
                    encoding: opts.encoding,
                    highWaterMark: opts.chunkSize
                });

                return new Promise<StreamProcessingResult<T[]>>((resolve, reject) => {
                    stream.on('data', async (chunk: string) => {
                        try {
                            // 檢查取消令牌
                            if (opts.cancellationToken?.isCancellationRequested) {
                                stream.destroy();
                                reject(new Error('操作已取消'));
                                return;
                            }

                            // 處理塊
                            const result = await processor(chunk, chunkIndex++);
                            if (result !== null) {
                                results.push(result);
                            }

                            processedBytes += Buffer.byteLength(chunk, opts.encoding);
                            
                            // 報告進度
                            opts.progressCallback?.(processedBytes, stats.size);

                        } catch (error) {
                            stream.destroy();
                            reject(error);
                        }
                    });

                    stream.on('end', () => {
                        resolve({
                            success: true,
                            data: results,
                            processedBytes,
                            totalBytes: stats.size,
                            chunks: chunkIndex,
                            duration: Date.now() - startTime
                        });
                    });

                    stream.on('error', (error) => {
                        reject(error);
                    });
                });
            },
            `流式讀取文件 ${uri.fsPath}`,
            { logError: true, showToUser: false }
        ).then(result => {
            if (result.success) {
                return result.data!;
            } else {
                return {
                    success: false,
                    processedBytes: 0,
                    totalBytes: 0,
                    chunks: 0,
                    duration: Date.now() - startTime,
                    error: result.error
                };
            }
        });
    }

    /**
     * 分塊處理大型文件
     */
    async processFileInChunks<T>(
        uri: vscode.Uri,
        processor: (content: string, startLine: number, endLine: number) => Promise<T>,
        options: Partial<FileProcessingOptions> = {}
    ): Promise<StreamProcessingResult<T[]>> {
        const opts = { ...this.defaultOptions, ...options };
        const startTime = Date.now();

        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const content = await FileOperationUtils.readFile(uri);
                if (!content) {
                    throw new Error('無法讀取文件內容');
                }

                const lines = content.split('\n');
                const totalLines = lines.length;
                const linesPerChunk = Math.ceil(opts.chunkSize / 100); // 假設每行平均100字符
                
                const results: T[] = [];
                let processedLines = 0;

                for (let i = 0; i < totalLines; i += linesPerChunk) {
                    // 檢查取消令牌
                    if (opts.cancellationToken?.isCancellationRequested) {
                        throw new Error('操作已取消');
                    }

                    const endLine = Math.min(i + linesPerChunk, totalLines);
                    const chunkLines = lines.slice(i, endLine);
                    const chunkContent = chunkLines.join('\n');

                    // 處理塊
                    const result = await processor(chunkContent, i, endLine - 1);
                    results.push(result);

                    processedLines = endLine;
                    
                    // 報告進度
                    opts.progressCallback?.(processedLines, totalLines);
                }

                return {
                    success: true,
                    data: results,
                    processedBytes: Buffer.byteLength(content, opts.encoding),
                    totalBytes: Buffer.byteLength(content, opts.encoding),
                    chunks: Math.ceil(totalLines / linesPerChunk),
                    duration: Date.now() - startTime
                };
            },
            `分塊處理文件 ${uri.fsPath}`,
            { logError: true, showToUser: false }
        ).then(result => {
            if (result.success) {
                return result.data!;
            } else {
                return {
                    success: false,
                    processedBytes: 0,
                    totalBytes: 0,
                    chunks: 0,
                    duration: Date.now() - startTime,
                    error: result.error
                };
            }
        });
    }

    /**
     * 並行處理多個文件
     */
    async processMultipleFiles<T>(
        uris: vscode.Uri[],
        processor: (uri: vscode.Uri, content: string) => Promise<T>,
        options: Partial<FileProcessingOptions & { maxConcurrency: number }> = {}
    ): Promise<StreamProcessingResult<T[]>> {
        const opts = { ...this.defaultOptions, maxConcurrency: 3, ...options };
        const startTime = Date.now();

        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const results: T[] = [];
                let processedFiles = 0;
                let totalBytes = 0;
                let processedBytes = 0;

                // 計算總大小
                for (const uri of uris) {
                    const stats = await fs.promises.stat(uri.fsPath);
                    totalBytes += stats.size;
                }

                // 並行處理文件
                const semaphore = new Semaphore(opts.maxConcurrency);
                
                const promises = uris.map(async (uri) => {
                    await semaphore.acquire();
                    
                    try {
                        // 檢查取消令牌
                        if (opts.cancellationToken?.isCancellationRequested) {
                            throw new Error('操作已取消');
                        }

                        const content = await FileOperationUtils.readFile(uri);
                        if (!content) {
                            throw new Error(`無法讀取文件: ${uri.fsPath}`);
                        }

                        const result = await processor(uri, content);
                        results.push(result);

                        processedFiles++;
                        processedBytes += Buffer.byteLength(content, opts.encoding);
                        
                        // 報告進度
                        opts.progressCallback?.(processedFiles, uris.length);

                        return result;
                    } finally {
                        semaphore.release();
                    }
                });

                await Promise.all(promises);

                return {
                    success: true,
                    data: results,
                    processedBytes,
                    totalBytes,
                    chunks: uris.length,
                    duration: Date.now() - startTime
                };
            },
            `並行處理 ${uris.length} 個文件`,
            { logError: true, showToUser: false }
        ).then(result => {
            if (result.success) {
                return result.data!;
            } else {
                return {
                    success: false,
                    processedBytes: 0,
                    totalBytes: 0,
                    chunks: 0,
                    duration: Date.now() - startTime,
                    error: result.error
                };
            }
        });
    }

    /**
     * 搜索大型文件中的模式
     */
    async searchInLargeFile(
        uri: vscode.Uri,
        pattern: string | RegExp,
        options: Partial<FileProcessingOptions & { maxMatches: number }> = {}
    ): Promise<StreamProcessingResult<vscode.Range[]>> {
        const opts = { ...this.defaultOptions, maxMatches: 1000, ...options };
        const matches: vscode.Range[] = [];
        let lineNumber = 0;

        const result = await this.streamReadFile(
            uri,
            async (chunk: string, chunkIndex: number) => {
                const lines = chunk.split('\n');
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'g') : pattern;
                    
                    let match;
                    while ((match = regex.exec(line)) !== null) {
                        if (matches.length >= opts.maxMatches) {
                            return null;
                        }

                        const startPos = new vscode.Position(lineNumber, match.index);
                        const endPos = new vscode.Position(lineNumber, match.index + match[0].length);
                        matches.push(new vscode.Range(startPos, endPos));
                    }
                    
                    lineNumber++;
                }
                
                return null;
            },
            opts
        );

        return {
            ...result,
            data: matches
        };
    }

    /**
     * 計算大型文件的統計信息
     */
    async calculateFileStats(
        uri: vscode.Uri,
        options: Partial<FileProcessingOptions> = {}
    ): Promise<StreamProcessingResult<FileStats>> {
        const opts = { ...this.defaultOptions, ...options };
        const stats: FileStats = {
            lines: 0,
            characters: 0,
            words: 0,
            bytes: 0,
            encoding: opts.encoding
        };

        const result = await this.streamReadFile(
            uri,
            async (chunk: string) => {
                stats.characters += chunk.length;
                stats.bytes += Buffer.byteLength(chunk, opts.encoding);
                stats.lines += (chunk.match(/\n/g) || []).length;
                stats.words += (chunk.match(/\S+/g) || []).length;
                return null;
            },
            opts
        );

        return {
            ...result,
            data: stats
        };
    }
}

/**
 * 文件統計信息
 */
export interface FileStats {
    lines: number;
    characters: number;
    words: number;
    bytes: number;
    encoding: BufferEncoding;
}

/**
 * 信號量類（用於控制並發）
 */
class Semaphore {
    private permits: number;
    private waitQueue: Array<() => void> = [];

    constructor(permits: number) {
        this.permits = permits;
    }

    async acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--;
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.waitQueue.push(resolve);
        });
    }

    release(): void {
        this.permits++;
        
        if (this.waitQueue.length > 0) {
            const resolve = this.waitQueue.shift()!;
            this.permits--;
            resolve();
        }
    }
}
