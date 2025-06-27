import * as vscode from 'vscode';
import * as path from 'path';

export interface FileChangeEvent {
    type: 'created' | 'changed' | 'deleted';
    uri: vscode.Uri;
    timestamp: Date;
    relativePath: string;
    size?: number;
    isDirectory: boolean;
}

export interface WatcherOptions {
    include?: string | string[];
    exclude?: string | string[];
    ignoreCreateEvents?: boolean;
    ignoreChangeEvents?: boolean;
    ignoreDeleteEvents?: boolean;
    debounceDelay?: number;
}

export interface FileWatcherStats {
    totalEvents: number;
    createdFiles: number;
    changedFiles: number;
    deletedFiles: number;
    watchedPaths: number;
    startTime: Date;
}

export class FileWatcherSystem {
    private watchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private eventHistory: FileChangeEvent[] = [];
    private maxHistorySize = 1000;
    private stats: FileWatcherStats;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    private onFileChangedEmitter = new vscode.EventEmitter<FileChangeEvent>();
    public readonly onFileChanged = this.onFileChangedEmitter.event;

    private onBatchChangesEmitter = new vscode.EventEmitter<FileChangeEvent[]>();
    public readonly onBatchChanges = this.onBatchChangesEmitter.event;

    constructor(private context: vscode.ExtensionContext) {
        this.stats = {
            totalEvents: 0,
            createdFiles: 0,
            changedFiles: 0,
            deletedFiles: 0,
            watchedPaths: 0,
            startTime: new Date()
        };

        this.loadEventHistory();
        this.setupDefaultWatchers();
    }

    /**
     * 創建文件監視器
     */
    createWatcher(
        pattern: string,
        options: WatcherOptions = {},
        watcherId?: string
    ): string {
        const id = watcherId || this.generateWatcherId();
        
        // 如果已存在相同 ID 的監視器，先銷毀它
        if (this.watchers.has(id)) {
            this.destroyWatcher(id);
        }

        const {
            ignoreCreateEvents = false,
            ignoreChangeEvents = false,
            ignoreDeleteEvents = false,
            debounceDelay = 100
        } = options;

        // 創建 VS Code 文件系統監視器
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        // 設置事件處理器
        if (!ignoreCreateEvents) {
            watcher.onDidCreate(uri => {
                this.handleFileEvent('created', uri, debounceDelay);
            });
        }

        if (!ignoreChangeEvents) {
            watcher.onDidChange(uri => {
                this.handleFileEvent('changed', uri, debounceDelay);
            });
        }

        if (!ignoreDeleteEvents) {
            watcher.onDidDelete(uri => {
                this.handleFileEvent('deleted', uri, debounceDelay);
            });
        }

        this.watchers.set(id, watcher);
        this.stats.watchedPaths++;

        console.log(`文件監視器已創建: ${id} (模式: ${pattern})`);
        return id;
    }

    /**
     * 銷毀文件監視器
     */
    destroyWatcher(watcherId: string): boolean {
        const watcher = this.watchers.get(watcherId);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(watcherId);
            this.stats.watchedPaths--;
            
            // 清除相關的防抖計時器
            const timersToRemove: string[] = [];
            for (const [key, timer] of this.debounceTimers) {
                if (key.startsWith(watcherId)) {
                    clearTimeout(timer);
                    timersToRemove.push(key);
                }
            }
            timersToRemove.forEach(key => this.debounceTimers.delete(key));

            console.log(`文件監視器已銷毀: ${watcherId}`);
            return true;
        }
        return false;
    }

    /**
     * 監視特定目錄
     */
    watchDirectory(
        directoryPath: string,
        options: WatcherOptions = {}
    ): string {
        const pattern = path.join(directoryPath, '**/*');
        return this.createWatcher(pattern, options);
    }

    /**
     * 監視特定文件類型
     */
    watchFileType(
        extension: string,
        options: WatcherOptions = {}
    ): string {
        const pattern = `**/*.${extension.replace(/^\./, '')}`;
        return this.createWatcher(pattern, options);
    }

    /**
     * 監視多個文件模式
     */
    watchMultiplePatterns(
        patterns: string[],
        options: WatcherOptions = {}
    ): string[] {
        return patterns.map(pattern => this.createWatcher(pattern, options));
    }

    /**
     * 處理文件事件
     */
    private async handleFileEvent(
        type: 'created' | 'changed' | 'deleted',
        uri: vscode.Uri,
        debounceDelay: number
    ): Promise<void> {
        const key = `${type}-${uri.fsPath}`;

        // 清除之前的防抖計時器
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // 設置新的防抖計時器
        const timer = setTimeout(async () => {
            this.debounceTimers.delete(key);
            await this.processFileEvent(type, uri);
        }, debounceDelay);

        this.debounceTimers.set(key, timer);
    }

    /**
     * 處理文件事件（防抖後）
     */
    private async processFileEvent(
        type: 'created' | 'changed' | 'deleted',
        uri: vscode.Uri
    ): Promise<void> {
        try {
            let size: number | undefined;
            let isDirectory = false;

            // 獲取文件信息（如果文件仍存在）
            if (type !== 'deleted') {
                try {
                    const stat = await vscode.workspace.fs.stat(uri);
                    size = stat.size;
                    isDirectory = stat.type === vscode.FileType.Directory;
                } catch (error) {
                    // 文件可能在檢查時被刪除
                    console.warn(`無法獲取文件信息: ${uri.fsPath}`, error);
                }
            }

            const event: FileChangeEvent = {
                type,
                uri,
                timestamp: new Date(),
                relativePath: vscode.workspace.asRelativePath(uri),
                size,
                isDirectory
            };

            // 更新統計
            this.updateStats(type);

            // 添加到歷史記錄
            this.addToHistory(event);

            // 觸發事件
            this.onFileChangedEmitter.fire(event);

            console.log(`文件事件: ${type} - ${event.relativePath}`);

        } catch (error) {
            console.error(`處理文件事件失敗: ${type} - ${uri.fsPath}`, error);
        }
    }

    /**
     * 獲取事件歷史
     */
    getEventHistory(
        filter?: {
            type?: 'created' | 'changed' | 'deleted';
            since?: Date;
            pattern?: string;
            limit?: number;
        }
    ): FileChangeEvent[] {
        let events = [...this.eventHistory];

        if (filter) {
            if (filter.type) {
                events = events.filter(event => event.type === filter.type);
            }

            if (filter.since) {
                events = events.filter(event => event.timestamp >= filter.since!);
            }

            if (filter.pattern) {
                const regex = new RegExp(filter.pattern, 'i');
                events = events.filter(event => regex.test(event.relativePath));
            }

            if (filter.limit) {
                events = events.slice(0, filter.limit);
            }
        }

        return events;
    }

    /**
     * 獲取統計信息
     */
    getStats(): FileWatcherStats {
        return { ...this.stats };
    }

    /**
     * 獲取活動監視器列表
     */
    getActiveWatchers(): string[] {
        return Array.from(this.watchers.keys());
    }

    /**
     * 暫停所有監視器
     */
    pauseAllWatchers(): void {
        for (const [id, watcher] of this.watchers) {
            watcher.dispose();
        }
        console.log('所有文件監視器已暫停');
    }

    /**
     * 恢復所有監視器
     */
    resumeAllWatchers(): void {
        // 注意：VS Code 的 FileSystemWatcher 一旦 dispose 就無法恢復
        // 這裡需要重新創建監視器
        console.log('文件監視器恢復功能需要重新創建監視器');
    }

    /**
     * 清除事件歷史
     */
    clearEventHistory(): void {
        this.eventHistory = [];
        this.saveEventHistory();
        console.log('文件事件歷史已清除');
    }

    /**
     * 導出事件歷史
     */
    async exportEventHistory(format: 'json' | 'csv' = 'json'): Promise<string> {
        switch (format) {
            case 'json':
                return JSON.stringify(this.eventHistory, null, 2);

            case 'csv':
                const headers = ['Type', 'Path', 'Timestamp', 'Size', 'IsDirectory'];
                const rows = [headers.join(',')];

                for (const event of this.eventHistory) {
                    const row = [
                        event.type,
                        `"${event.relativePath}"`,
                        event.timestamp.toISOString(),
                        event.size?.toString() || '',
                        event.isDirectory.toString()
                    ];
                    rows.push(row.join(','));
                }

                return rows.join('\n');

            default:
                throw new Error(`不支援的格式: ${format}`);
        }
    }

    /**
     * 設置默認監視器
     */
    private setupDefaultWatchers(): void {
        // 監視常見的配置文件
        this.createWatcher('**/package.json', {}, 'package-json-watcher');
        this.createWatcher('**/tsconfig.json', {}, 'tsconfig-watcher');
        this.createWatcher('**/.gitignore', {}, 'gitignore-watcher');

        // 監視源代碼文件
        this.createWatcher('**/*.{ts,js,tsx,jsx}', {}, 'source-code-watcher');

        // 監視文檔文件
        this.createWatcher('**/*.{md,txt}', {}, 'documentation-watcher');
    }

    /**
     * 生成監視器 ID
     */
    private generateWatcherId(): string {
        return `watcher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 更新統計信息
     */
    private updateStats(type: 'created' | 'changed' | 'deleted'): void {
        this.stats.totalEvents++;
        
        switch (type) {
            case 'created':
                this.stats.createdFiles++;
                break;
            case 'changed':
                this.stats.changedFiles++;
                break;
            case 'deleted':
                this.stats.deletedFiles++;
                break;
        }
    }

    /**
     * 添加到歷史記錄
     */
    private addToHistory(event: FileChangeEvent): void {
        this.eventHistory.unshift(event);

        // 限制歷史記錄大小
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
        }

        // 定期保存到存儲
        if (this.eventHistory.length % 10 === 0) {
            this.saveEventHistory();
        }
    }

    /**
     * 保存事件歷史
     */
    private saveEventHistory(): void {
        // 只保存最近的 100 個事件到持久存儲
        const eventsToSave = this.eventHistory.slice(0, 100);
        this.context.globalState.update('fileEventHistory', eventsToSave);
    }

    /**
     * 載入事件歷史
     */
    private loadEventHistory(): void {
        const history = this.context.globalState.get<FileChangeEvent[]>('fileEventHistory', []);
        
        // 恢復日期對象
        this.eventHistory = history.map(event => ({
            ...event,
            timestamp: new Date(event.timestamp),
            uri: vscode.Uri.parse(event.uri.toString())
        }));
    }

    /**
     * 批量處理事件
     */
    private batchEvents: FileChangeEvent[] = [];
    private batchTimer?: NodeJS.Timeout;

    /**
     * 啟用批量事件處理
     */
    enableBatchProcessing(batchDelay: number = 1000): void {
        this.onFileChanged(event => {
            this.batchEvents.push(event);

            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
            }

            this.batchTimer = setTimeout(() => {
                if (this.batchEvents.length > 0) {
                    this.onBatchChangesEmitter.fire([...this.batchEvents]);
                    this.batchEvents = [];
                }
                this.batchTimer = undefined;
            }, batchDelay);
        });
    }

    /**
     * 清理資源
     */
    dispose(): void {
        // 銷毀所有監視器
        for (const [id, watcher] of this.watchers) {
            watcher.dispose();
        }
        this.watchers.clear();

        // 清除所有計時器
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        // 保存最終狀態
        this.saveEventHistory();

        // 清理事件發射器
        this.onFileChangedEmitter.dispose();
        this.onBatchChangesEmitter.dispose();

        console.log('文件監視系統已清理');
    }
}
