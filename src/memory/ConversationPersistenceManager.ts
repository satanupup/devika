import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConversationSession, ConversationMessage } from './ConversationMemoryManager';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 存儲配置
 */
export interface StorageConfig {
  maxSessions: number;
  maxMessagesPerSession: number;
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  backupEnabled: boolean;
  backupInterval: number; // 小時
}

/**
 * 導出選項
 */
export interface ExportOptions {
  format: 'json' | 'markdown' | 'csv';
  includeSessions: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeMetadata: boolean;
  anonymize: boolean;
}

/**
 * 導入結果
 */
export interface ImportResult {
  success: boolean;
  importedSessions: number;
  skippedSessions: number;
  errors: string[];
}

/**
 * 存儲統計
 */
export interface StorageStats {
  totalSessions: number;
  totalMessages: number;
  totalSize: number;
  oldestSession: Date;
  newestSession: Date;
  averageSessionLength: number;
  storageUsage: {
    sessions: number;
    messages: number;
    metadata: number;
    backups: number;
  };
}

/**
 * 對話持久化管理器
 * 負責對話數據的持久化存儲、備份和恢復
 */
export class ConversationPersistenceManager {
  private static instance: ConversationPersistenceManager;
  private storagePath: string;
  private backupPath: string;
  private config: StorageConfig;
  private backupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializePaths();
    this.loadConfig();
    this.setupAutoBackup();
  }

  static getInstance(): ConversationPersistenceManager {
    if (!ConversationPersistenceManager.instance) {
      ConversationPersistenceManager.instance = new ConversationPersistenceManager();
    }
    return ConversationPersistenceManager.instance;
  }

  /**
   * 保存對話會話
   */
  async saveSession(session: ConversationSession): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const sessionPath = path.join(this.storagePath, 'sessions', `${session.id}.json`);
        
        // 確保目錄存在
        await this.ensureDirectoryExists(path.dirname(sessionPath));
        
        // 準備保存的數據
        const sessionData = this.prepareSessionForStorage(session);
        
        // 壓縮數據（如果啟用）
        const dataToSave = this.config.compressionEnabled 
          ? await this.compressData(sessionData)
          : JSON.stringify(sessionData, null, 2);
        
        // 加密數據（如果啟用）
        const finalData = this.config.encryptionEnabled
          ? await this.encryptData(dataToSave)
          : dataToSave;
        
        // 寫入文件
        await fs.promises.writeFile(sessionPath, finalData, 'utf8');
        
        console.log(`會話已保存: ${session.id}`);
      },
      '保存對話會話',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 加載對話會話
   */
  async loadSession(sessionId: string): Promise<ConversationSession | null> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const sessionPath = path.join(this.storagePath, 'sessions', `${sessionId}.json`);
        
        if (!fs.existsSync(sessionPath)) {
          return null;
        }
        
        // 讀取文件
        let data = await fs.promises.readFile(sessionPath, 'utf8');
        
        // 解密數據（如果需要）
        if (this.config.encryptionEnabled) {
          data = await this.decryptData(data);
        }
        
        // 解壓縮數據（如果需要）
        const sessionData = this.config.compressionEnabled
          ? await this.decompressData(data)
          : JSON.parse(data);
        
        return this.restoreSessionFromStorage(sessionData);
      },
      '加載對話會話',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : null);
  }

  /**
   * 加載所有會話
   */
  async loadAllSessions(): Promise<ConversationSession[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const sessionsDir = path.join(this.storagePath, 'sessions');
        
        if (!fs.existsSync(sessionsDir)) {
          return [];
        }
        
        const sessionFiles = await fs.promises.readdir(sessionsDir);
        const sessions: ConversationSession[] = [];
        
        for (const file of sessionFiles) {
          if (file.endsWith('.json')) {
            const sessionId = file.replace('.json', '');
            const session = await this.loadSession(sessionId);
            if (session) {
              sessions.push(session);
            }
          }
        }
        
        return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      },
      '加載所有對話會話',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 刪除對話會話
   */
  async deleteSession(sessionId: string): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const sessionPath = path.join(this.storagePath, 'sessions', `${sessionId}.json`);
        
        if (fs.existsSync(sessionPath)) {
          await fs.promises.unlink(sessionPath);
          console.log(`會話已刪除: ${sessionId}`);
        }
      },
      '刪除對話會話',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 清理過期會話
   */
  async cleanupExpiredSessions(): Promise<number> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const sessions = await this.loadAllSessions();
        const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
        
        let deletedCount = 0;
        
        for (const session of sessions) {
          if (session.lastActivity < cutoffDate) {
            await this.deleteSession(session.id);
            deletedCount++;
          }
        }
        
        console.log(`清理了 ${deletedCount} 個過期會話`);
        return deletedCount;
      },
      '清理過期對話會話',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : 0);
  }

  /**
   * 創建備份
   */
  async createBackup(): Promise<string> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `conversations-backup-${timestamp}.json`;
        const backupFilePath = path.join(this.backupPath, backupFileName);
        
        // 加載所有會話
        const sessions = await this.loadAllSessions();
        
        // 創建備份數據
        const backupData = {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          sessionCount: sessions.length,
          sessions: sessions.map(session => this.prepareSessionForStorage(session))
        };
        
        // 確保備份目錄存在
        await this.ensureDirectoryExists(this.backupPath);
        
        // 寫入備份文件
        await fs.promises.writeFile(
          backupFilePath,
          JSON.stringify(backupData, null, 2),
          'utf8'
        );
        
        // 清理舊備份
        await this.cleanupOldBackups();
        
        console.log(`備份已創建: ${backupFilePath}`);
        return backupFilePath;
      },
      '創建對話備份',
      { logError: true, showToUser: true }
    ).then(result => result.success ? result.data! : '');
  }

  /**
   * 從備份恢復
   */
  async restoreFromBackup(backupPath: string): Promise<ImportResult> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!fs.existsSync(backupPath)) {
          throw new Error(`備份文件不存在: ${backupPath}`);
        }
        
        const backupData = JSON.parse(await fs.promises.readFile(backupPath, 'utf8'));
        
        if (!backupData.sessions || !Array.isArray(backupData.sessions)) {
          throw new Error('無效的備份文件格式');
        }
        
        let importedCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];
        
        for (const sessionData of backupData.sessions) {
          try {
            const session = this.restoreSessionFromStorage(sessionData);
            await this.saveSession(session);
            importedCount++;
          } catch (error) {
            skippedCount++;
            errors.push(`會話 ${sessionData.id}: ${error}`);
          }
        }
        
        return {
          success: true,
          importedSessions: importedCount,
          skippedSessions: skippedCount,
          errors
        };
      },
      '從備份恢復對話',
      { logError: true, showToUser: true }
    ).then(result => result.success ? result.data! : {
      success: false,
      importedSessions: 0,
      skippedSessions: 0,
      errors: ['恢復失敗']
    });
  }

  /**
   * 導出對話數據
   */
  async exportConversations(exportPath: string, options: ExportOptions): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const sessions = await this.loadAllSessions();
        
        // 過濾會話
        let filteredSessions = sessions;
        
        if (options.includeSessions.length > 0) {
          filteredSessions = sessions.filter(s => options.includeSessions.includes(s.id));
        }
        
        if (options.dateRange) {
          filteredSessions = filteredSessions.filter(s =>
            s.startTime >= options.dateRange!.start &&
            s.startTime <= options.dateRange!.end
          );
        }
        
        // 匿名化處理
        if (options.anonymize) {
          filteredSessions = filteredSessions.map(session => this.anonymizeSession(session));
        }
        
        // 根據格式導出
        let exportData: string;
        
        switch (options.format) {
          case 'json':
            exportData = JSON.stringify(filteredSessions, null, 2);
            break;
          case 'markdown':
            exportData = this.convertToMarkdown(filteredSessions, options.includeMetadata);
            break;
          case 'csv':
            exportData = this.convertToCSV(filteredSessions, options.includeMetadata);
            break;
          default:
            throw new Error(`不支援的導出格式: ${options.format}`);
        }
        
        await fs.promises.writeFile(exportPath, exportData, 'utf8');
        console.log(`對話數據已導出到: ${exportPath}`);
      },
      '導出對話數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 獲取存儲統計
   */
  async getStorageStats(): Promise<StorageStats> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const sessions = await this.loadAllSessions();
        
        if (sessions.length === 0) {
          return {
            totalSessions: 0,
            totalMessages: 0,
            totalSize: 0,
            oldestSession: new Date(),
            newestSession: new Date(),
            averageSessionLength: 0,
            storageUsage: {
              sessions: 0,
              messages: 0,
              metadata: 0,
              backups: 0
            }
          };
        }
        
        const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
        const averageSessionLength = totalMessages / sessions.length;
        
        const dates = sessions.map(s => s.startTime);
        const oldestSession = new Date(Math.min(...dates.map(d => d.getTime())));
        const newestSession = new Date(Math.max(...dates.map(d => d.getTime())));
        
        // 計算存儲大小
        const storageSize = await this.calculateStorageSize();
        
        return {
          totalSessions: sessions.length,
          totalMessages,
          totalSize: storageSize.total,
          oldestSession,
          newestSession,
          averageSessionLength,
          storageUsage: storageSize
        };
      },
      '獲取存儲統計',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : {
      totalSessions: 0,
      totalMessages: 0,
      totalSize: 0,
      oldestSession: new Date(),
      newestSession: new Date(),
      averageSessionLength: 0,
      storageUsage: { sessions: 0, messages: 0, metadata: 0, backups: 0 }
    });
  }

  /**
   * 初始化路徑
   */
  private initializePaths(): void {
    const extensionPath = vscode.extensions.getExtension('devika.devika-vscode')?.extensionPath || '';
    this.storagePath = path.join(extensionPath, 'data', 'conversations');
    this.backupPath = path.join(extensionPath, 'data', 'backups', 'conversations');
  }

  /**
   * 加載配置
   */
  private loadConfig(): void {
    this.config = {
      maxSessions: 1000,
      maxMessagesPerSession: 1000,
      retentionDays: 90,
      compressionEnabled: true,
      encryptionEnabled: false,
      backupEnabled: true,
      backupInterval: 24 // 24 小時
    };
  }

  /**
   * 設置自動備份
   */
  private setupAutoBackup(): void {
    if (this.config.backupEnabled) {
      this.backupTimer = setInterval(async () => {
        await this.createBackup();
      }, this.config.backupInterval * 60 * 60 * 1000);
    }
  }

  /**
   * 準備會話數據用於存儲
   */
  private prepareSessionForStorage(session: ConversationSession): any {
    return {
      ...session,
      startTime: session.startTime.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      messages: session.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }))
    };
  }

  /**
   * 從存儲恢復會話數據
   */
  private restoreSessionFromStorage(data: any): ConversationSession {
    return {
      ...data,
      startTime: new Date(data.startTime),
      lastActivity: new Date(data.lastActivity),
      messages: data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    };
  }

  /**
   * 匿名化會話
   */
  private anonymizeSession(session: ConversationSession): ConversationSession {
    return {
      ...session,
      id: 'anonymous-session',
      context: {
        ...session.context,
        currentFile: undefined,
        workspaceFolder: undefined,
        openFiles: [],
        recentFiles: []
      },
      messages: session.messages.map(msg => ({
        ...msg,
        id: 'anonymous-message',
        content: this.anonymizeContent(msg.content),
        metadata: {
          ...msg.metadata,
          fileUri: undefined
        }
      }))
    };
  }

  /**
   * 匿名化內容
   */
  private anonymizeContent(content: string): string {
    return content
      .replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, 'identifier')
      .replace(/['"`][^'"`]*['"`]/g, '"string"')
      .replace(/\d+/g, '0')
      .replace(/\/[^\/\s]+/g, '/path');
  }

  /**
   * 轉換為 Markdown 格式
   */
  private convertToMarkdown(sessions: ConversationSession[], includeMetadata: boolean): string {
    let markdown = '# 對話導出\n\n';
    
    for (const session of sessions) {
      markdown += `## ${session.title}\n\n`;
      
      if (includeMetadata) {
        markdown += `**類型**: ${session.type}\n`;
        markdown += `**開始時間**: ${session.startTime.toLocaleString()}\n`;
        markdown += `**最後活動**: ${session.lastActivity.toLocaleString()}\n`;
        markdown += `**消息數量**: ${session.messages.length}\n\n`;
      }
      
      for (const message of session.messages) {
        markdown += `### ${message.role}\n\n`;
        markdown += `${message.content}\n\n`;
        
        if (includeMetadata) {
          markdown += `*時間: ${message.timestamp.toLocaleString()}*\n\n`;
        }
      }
      
      markdown += '---\n\n';
    }
    
    return markdown;
  }

  /**
   * 轉換為 CSV 格式
   */
  private convertToCSV(sessions: ConversationSession[], includeMetadata: boolean): string {
    const headers = ['Session ID', 'Session Title', 'Message Role', 'Message Content', 'Timestamp'];
    if (includeMetadata) {
      headers.push('Session Type', 'Message ID');
    }
    
    let csv = headers.join(',') + '\n';
    
    for (const session of sessions) {
      for (const message of session.messages) {
        const row = [
          session.id,
          `"${session.title}"`,
          message.role,
          `"${message.content.replace(/"/g, '""')}"`,
          message.timestamp.toISOString()
        ];
        
        if (includeMetadata) {
          row.push(session.type, message.id);
        }
        
        csv += row.join(',') + '\n';
      }
    }
    
    return csv;
  }

  /**
   * 計算存儲大小
   */
  private async calculateStorageSize(): Promise<StorageStats['storageUsage']> {
    const usage = {
      sessions: 0,
      messages: 0,
      metadata: 0,
      backups: 0
    };
    
    try {
      const sessionsDir = path.join(this.storagePath, 'sessions');
      if (fs.existsSync(sessionsDir)) {
        const files = await fs.promises.readdir(sessionsDir);
        for (const file of files) {
          const filePath = path.join(sessionsDir, file);
          const stats = await fs.promises.stat(filePath);
          usage.sessions += stats.size;
        }
      }
      
      if (fs.existsSync(this.backupPath)) {
        const files = await fs.promises.readdir(this.backupPath);
        for (const file of files) {
          const filePath = path.join(this.backupPath, file);
          const stats = await fs.promises.stat(filePath);
          usage.backups += stats.size;
        }
      }
    } catch (error) {
      console.warn('計算存儲大小失敗:', error);
    }
    
    return usage;
  }

  /**
   * 清理舊備份
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      if (!fs.existsSync(this.backupPath)) {
        return;
      }
      
      const files = await fs.promises.readdir(this.backupPath);
      const backupFiles = files
        .filter(f => f.startsWith('conversations-backup-'))
        .sort()
        .reverse();
      
      // 保留最近 10 個備份
      if (backupFiles.length > 10) {
        const filesToDelete = backupFiles.slice(10);
        for (const file of filesToDelete) {
          await fs.promises.unlink(path.join(this.backupPath, file));
        }
      }
    } catch (error) {
      console.warn('清理舊備份失敗:', error);
    }
  }

  /**
   * 確保目錄存在
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.access(dirPath);
    } catch {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 數據壓縮/解壓縮（簡化實現）
   */
  private async compressData(data: any): Promise<string> {
    // 實際實現中可以使用 zlib 或其他壓縮庫
    return JSON.stringify(data);
  }

  private async decompressData(data: string): Promise<any> {
    // 實際實現中對應解壓縮
    return JSON.parse(data);
  }

  /**
   * 數據加密/解密（簡化實現）
   */
  private async encryptData(data: string): Promise<string> {
    // 實際實現中使用加密算法
    return data;
  }

  private async decryptData(data: string): Promise<string> {
    // 實際實現中對應解密
    return data;
  }

  /**
   * 清理資源
   */
  dispose(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }
}
