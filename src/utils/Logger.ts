import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 日誌級別
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
}

/**
 * 日誌條目接口
 */
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    category: string;
    message: string;
    data?: any;
    stack?: string;
}

/**
 * 日誌配置接口
 */
export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    enableOutputChannel: boolean;
    maxFileSize: number; // bytes
    maxFiles: number;
    logDirectory?: string;
}

/**
 * 統一日誌記錄器
 */
export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;
    private outputChannel: vscode.OutputChannel;
    private logEntries: LogEntry[] = [];
    private readonly maxMemoryEntries = 1000;

    private constructor(config?: Partial<LoggerConfig>) {
        this.config = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableFile: true,
            enableOutputChannel: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            ...config
        };

        this.outputChannel = vscode.window.createOutputChannel('Devika Logs');
        this.initializeFileLogging();
    }

    public static getInstance(config?: Partial<LoggerConfig>): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }

    /**
     * 初始化文件日誌
     */
    private initializeFileLogging(): void {
        if (!this.config.enableFile) {
            return;
        }

        try {
            const logDir = this.getLogDirectory();
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            // 清理舊日誌文件
            this.cleanupOldLogs();
        } catch (error) {
            console.warn('Failed to initialize file logging:', error);
            this.config.enableFile = false;
        }
    }

    /**
     * 獲取日誌目錄
     */
    private getLogDirectory(): string {
        if (this.config.logDirectory) {
            return this.config.logDirectory;
        }

        // 使用 VS Code 的全局存儲路徑
        const extensionPath = vscode.extensions.getExtension('devika.devika-vscode')?.extensionPath;
        if (extensionPath) {
            return path.join(extensionPath, 'logs');
        }

        // 回退到臨時目錄
        return path.join(require('os').tmpdir(), 'devika-logs');
    }

    /**
     * 清理舊日誌文件
     */
    private cleanupOldLogs(): void {
        try {
            const logDir = this.getLogDirectory();
            const files = fs.readdirSync(logDir)
                .filter(file => file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(logDir, file),
                    stats: fs.statSync(path.join(logDir, file))
                }))
                .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

            // 刪除超過最大文件數的舊文件
            if (files.length > this.config.maxFiles) {
                const filesToDelete = files.slice(this.config.maxFiles);
                for (const file of filesToDelete) {
                    fs.unlinkSync(file.path);
                }
            }
        } catch (error) {
            console.warn('Failed to cleanup old logs:', error);
        }
    }

    /**
     * 記錄調試信息
     */
    public debug(category: string, message: string, data?: any): void {
        this.log(LogLevel.DEBUG, category, message, data);
    }

    /**
     * 記錄信息
     */
    public info(category: string, message: string, data?: any): void {
        this.log(LogLevel.INFO, category, message, data);
    }

    /**
     * 記錄警告
     */
    public warn(category: string, message: string, data?: any): void {
        this.log(LogLevel.WARN, category, message, data);
    }

    /**
     * 記錄錯誤
     */
    public error(category: string, message: string, error?: Error | any): void {
        const stack = error instanceof Error ? error.stack : undefined;
        this.log(LogLevel.ERROR, category, message, error, stack);
    }

    /**
     * 記錄致命錯誤
     */
    public fatal(category: string, message: string, error?: Error | any): void {
        const stack = error instanceof Error ? error.stack : undefined;
        this.log(LogLevel.FATAL, category, message, error, stack);
    }

    /**
     * 核心日誌記錄方法
     */
    private log(level: LogLevel, category: string, message: string, data?: any, stack?: string): void {
        // 檢查日誌級別
        if (level < this.config.level) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            category,
            message,
            data,
            stack
        };

        // 添加到內存
        this.addToMemory(entry);

        // 輸出到各個目標
        if (this.config.enableConsole) {
            this.logToConsole(entry);
        }

        if (this.config.enableOutputChannel) {
            this.logToOutputChannel(entry);
        }

        if (this.config.enableFile) {
            this.logToFile(entry);
        }
    }

    /**
     * 添加到內存日誌
     */
    private addToMemory(entry: LogEntry): void {
        this.logEntries.unshift(entry);
        
        // 限制內存中的日誌條目數量
        if (this.logEntries.length > this.maxMemoryEntries) {
            this.logEntries = this.logEntries.slice(0, this.maxMemoryEntries);
        }
    }

    /**
     * 輸出到控制台
     */
    private logToConsole(entry: LogEntry): void {
        const message = this.formatMessage(entry);
        
        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(message);
                break;
            case LogLevel.INFO:
                console.info(message);
                break;
            case LogLevel.WARN:
                console.warn(message);
                break;
            case LogLevel.ERROR:
            case LogLevel.FATAL:
                console.error(message);
                break;
        }
    }

    /**
     * 輸出到 VS Code 輸出面板
     */
    private logToOutputChannel(entry: LogEntry): void {
        const message = this.formatMessage(entry, true);
        this.outputChannel.appendLine(message);
    }

    /**
     * 輸出到文件
     */
    private logToFile(entry: LogEntry): void {
        try {
            const logFile = this.getCurrentLogFile();
            const message = this.formatMessage(entry, true) + '\n';
            
            fs.appendFileSync(logFile, message, 'utf8');
            
            // 檢查文件大小，如果超過限制則輪轉
            const stats = fs.statSync(logFile);
            if (stats.size > this.config.maxFileSize) {
                this.rotateLogFile();
            }
        } catch (error) {
            console.warn('Failed to write to log file:', error);
        }
    }

    /**
     * 獲取當前日誌文件路徑
     */
    private getCurrentLogFile(): string {
        const logDir = this.getLogDirectory();
        const today = new Date().toISOString().split('T')[0];
        return path.join(logDir, `devika-${today}.log`);
    }

    /**
     * 輪轉日誌文件
     */
    private rotateLogFile(): void {
        try {
            const currentFile = this.getCurrentLogFile();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedFile = currentFile.replace('.log', `-${timestamp}.log`);
            
            fs.renameSync(currentFile, rotatedFile);
            this.cleanupOldLogs();
        } catch (error) {
            console.warn('Failed to rotate log file:', error);
        }
    }

    /**
     * 格式化日誌消息
     */
    private formatMessage(entry: LogEntry, includeData: boolean = false): string {
        const timestamp = entry.timestamp.toISOString();
        const level = LogLevel[entry.level].padEnd(5);
        const category = entry.category.padEnd(15);
        
        let message = `[${timestamp}] [${level}] [${category}] ${entry.message}`;
        
        if (includeData && entry.data) {
            try {
                const dataStr = typeof entry.data === 'string' 
                    ? entry.data 
                    : JSON.stringify(entry.data, null, 2);
                message += `\nData: ${dataStr}`;
            } catch (error) {
                message += `\nData: [Unable to serialize]`;
            }
        }
        
        if (entry.stack) {
            message += `\nStack: ${entry.stack}`;
        }
        
        return message;
    }

    /**
     * 獲取內存中的日誌條目
     */
    public getLogEntries(level?: LogLevel, category?: string, limit?: number): LogEntry[] {
        let entries = [...this.logEntries];
        
        if (level !== undefined) {
            entries = entries.filter(entry => entry.level >= level);
        }
        
        if (category) {
            entries = entries.filter(entry => entry.category === category);
        }
        
        if (limit) {
            entries = entries.slice(0, limit);
        }
        
        return entries;
    }

    /**
     * 清除內存日誌
     */
    public clearMemoryLogs(): void {
        this.logEntries = [];
    }

    /**
     * 獲取日誌統計
     */
    public getLogStatistics(): Record<string, number> {
        const stats: Record<string, number> = {};
        
        for (const entry of this.logEntries) {
            const levelKey = LogLevel[entry.level];
            const categoryKey = entry.category;
            
            stats[levelKey] = (stats[levelKey] || 0) + 1;
            stats[`${categoryKey}_${levelKey}`] = (stats[`${categoryKey}_${levelKey}`] || 0) + 1;
        }
        
        return stats;
    }

    /**
     * 設置日誌級別
     */
    public setLogLevel(level: LogLevel): void {
        this.config.level = level;
    }

    /**
     * 獲取當前日誌級別
     */
    public getLogLevel(): LogLevel {
        return this.config.level;
    }

    /**
     * 顯示日誌輸出面板
     */
    public showOutputChannel(): void {
        this.outputChannel.show();
    }

    /**
     * 導出日誌到文件
     */
    public async exportLogs(filePath: string, options?: {
        level?: LogLevel;
        category?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<void> {
        try {
            let entries = this.getLogEntries(options?.level, options?.category);
            
            if (options?.startDate || options?.endDate) {
                entries = entries.filter(entry => {
                    if (options.startDate && entry.timestamp < options.startDate) {
                        return false;
                    }
                    if (options.endDate && entry.timestamp > options.endDate) {
                        return false;
                    }
                    return true;
                });
            }
            
            const content = entries
                .map(entry => this.formatMessage(entry, true))
                .join('\n');
            
            fs.writeFileSync(filePath, content, 'utf8');
        } catch (error) {
            throw new Error(`Failed to export logs: ${error}`);
        }
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.outputChannel.dispose();
        this.logEntries = [];
    }
}
