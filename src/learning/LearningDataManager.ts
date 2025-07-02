import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LearningEngine, LearningEvent, CodingPattern, UserPreference, LearningStats } from './LearningEngine';
import { PatternRecognizer, IdentifiedPattern } from './PatternRecognizer';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 學習數據存儲格式
 */
export interface LearningData {
  version: string;
  lastUpdated: Date;
  events: LearningEvent[];
  patterns: CodingPattern[];
  preferences: UserPreference[];
  identifiedPatterns: IdentifiedPattern[];
  stats: LearningStats;
  metadata: {
    totalSessions: number;
    firstLearningDate: Date;
    dataSize: number;
  };
}

/**
 * 導出/導入選項
 */
export interface ExportOptions {
  includeEvents: boolean;
  includePatterns: boolean;
  includePreferences: boolean;
  includeStats: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  anonymize: boolean;
}

/**
 * 學習數據管理器
 * 負責學習數據的持久化、備份、導出和導入
 */
export class LearningDataManager {
  private static instance: LearningDataManager;
  private learningEngine: LearningEngine;
  private patternRecognizer: PatternRecognizer;
  private dataPath!: string;
  private backupPath!: string;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.learningEngine = LearningEngine.getInstance();
    this.patternRecognizer = PatternRecognizer.getInstance();
    this.initializePaths();
    this.setupAutoSave();
  }

  static getInstance(): LearningDataManager {
    if (!LearningDataManager.instance) {
      LearningDataManager.instance = new LearningDataManager();
    }
    return LearningDataManager.instance;
  }

  /**
   * 保存學習數據
   */
  async saveLearningData(): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const data = await this.collectLearningData();
        const jsonData = JSON.stringify(data, null, 2);

        // 確保目錄存在
        await this.ensureDirectoryExists(path.dirname(this.dataPath));

        // 保存數據
        await fs.promises.writeFile(this.dataPath, jsonData, 'utf8');

        console.log(`學習數據已保存到: ${this.dataPath}`);
      },
      '保存學習數據',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 加載學習數據
   */
  async loadLearningData(): Promise<boolean> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!fs.existsSync(this.dataPath)) {
          console.log('學習數據文件不存在，將創建新的數據');
          return false;
        }

        const jsonData = await fs.promises.readFile(this.dataPath, 'utf8');
        const data: LearningData = JSON.parse(jsonData);

        // 驗證數據格式
        if (!this.validateLearningData(data)) {
          throw new Error('學習數據格式無效');
        }

        // 恢復數據到各個系統
        await this.restoreLearningData(data);

        console.log(`學習數據已從 ${this.dataPath} 加載`);
        return true;
      },
      '加載學習數據',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : false));
  }

  /**
   * 創建備份
   */
  async createBackup(): Promise<string> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `learning-data-backup-${timestamp}.json`;
        const backupFilePath = path.join(this.backupPath, backupFileName);

        const data = await this.collectLearningData();
        const jsonData = JSON.stringify(data, null, 2);

        await this.ensureDirectoryExists(this.backupPath);
        await fs.promises.writeFile(backupFilePath, jsonData, 'utf8');

        // 清理舊備份（保留最近 10 個）
        await this.cleanupOldBackups();

        console.log(`備份已創建: ${backupFilePath}`);
        return backupFilePath;
      },
      '創建學習數據備份',
      { logError: true, showToUser: true }
    ).then(result => (result.success ? result.data! : ''));
  }

  /**
   * 從備份恢復
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!fs.existsSync(backupPath)) {
          throw new Error(`備份文件不存在: ${backupPath}`);
        }

        const jsonData = await fs.promises.readFile(backupPath, 'utf8');
        const data: LearningData = JSON.parse(jsonData);

        if (!this.validateLearningData(data)) {
          throw new Error('備份數據格式無效');
        }

        // 創建當前數據的備份
        await this.createBackup();

        // 恢復數據
        await this.restoreLearningData(data);

        // 保存恢復的數據
        await this.saveLearningData();

        console.log(`已從備份恢復學習數據: ${backupPath}`);
      },
      '從備份恢復學習數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導出學習數據
   */
  async exportLearningData(
    exportPath: string,
    options: ExportOptions = {
      includeEvents: true,
      includePatterns: true,
      includePreferences: true,
      includeStats: true,
      anonymize: false
    }
  ): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const data = await this.collectLearningData();
        const filteredData = this.filterDataForExport(data, options);

        if (options.anonymize) {
          this.anonymizeData(filteredData);
        }

        const jsonData = JSON.stringify(filteredData, null, 2);
        await fs.promises.writeFile(exportPath, jsonData, 'utf8');

        console.log(`學習數據已導出到: ${exportPath}`);
      },
      '導出學習數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 導入學習數據
   */
  async importLearningData(importPath: string, merge: boolean = true): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        if (!fs.existsSync(importPath)) {
          throw new Error(`導入文件不存在: ${importPath}`);
        }

        const jsonData = await fs.promises.readFile(importPath, 'utf8');
        const importedData: LearningData = JSON.parse(jsonData);

        if (!this.validateLearningData(importedData)) {
          throw new Error('導入數據格式無效');
        }

        if (merge) {
          // 合併數據
          await this.mergeLearningData(importedData);
        } else {
          // 替換數據
          await this.createBackup(); // 先備份當前數據
          await this.restoreLearningData(importedData);
        }

        await this.saveLearningData();
        console.log(`學習數據已從 ${importPath} 導入`);
      },
      '導入學習數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 獲取數據統計
   */
  async getDataStatistics(): Promise<{
    fileSize: number;
    eventsCount: number;
    patternsCount: number;
    preferencesCount: number;
    lastUpdated: Date;
    backupsCount: number;
  }> {
    const stats = {
      fileSize: 0,
      eventsCount: 0,
      patternsCount: 0,
      preferencesCount: 0,
      lastUpdated: new Date(),
      backupsCount: 0
    };

    try {
      if (fs.existsSync(this.dataPath)) {
        const fileStats = await fs.promises.stat(this.dataPath);
        stats.fileSize = fileStats.size;
        stats.lastUpdated = fileStats.mtime;

        const data = await this.collectLearningData();
        stats.eventsCount = data.events.length;
        stats.patternsCount = data.patterns.length;
        stats.preferencesCount = data.preferences.length;
      }

      if (fs.existsSync(this.backupPath)) {
        const backupFiles = await fs.promises.readdir(this.backupPath);
        stats.backupsCount = backupFiles.filter(f => f.startsWith('learning-data-backup-')).length;
      }
    } catch (error) {
      console.warn('獲取數據統計失敗:', error);
    }

    return stats;
  }

  /**
   * 清理學習數據
   */
  async cleanupLearningData(
    options: {
      removeOldEvents?: boolean;
      removeUnusedPatterns?: boolean;
      removeLowConfidencePreferences?: boolean;
      daysToKeep?: number;
    } = {}
  ): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const data = await this.collectLearningData();
        let cleaned = false;

        if (options.removeOldEvents && options.daysToKeep) {
          const cutoffDate = new Date(Date.now() - options.daysToKeep * 24 * 60 * 60 * 1000);
          const originalCount = data.events.length;
          data.events = data.events.filter(event => event.timestamp > cutoffDate);
          if (data.events.length < originalCount) {
            cleaned = true;
            console.log(`清理了 ${originalCount - data.events.length} 個舊事件`);
          }
        }

        if (options.removeUnusedPatterns) {
          const originalCount = data.patterns.length;
          data.patterns = data.patterns.filter(pattern => pattern.frequency > 1);
          if (data.patterns.length < originalCount) {
            cleaned = true;
            console.log(`清理了 ${originalCount - data.patterns.length} 個未使用的模式`);
          }
        }

        if (options.removeLowConfidencePreferences) {
          const originalCount = data.preferences.length;
          data.preferences = data.preferences.filter(pref => pref.confidence > 0.3);
          if (data.preferences.length < originalCount) {
            cleaned = true;
            console.log(`清理了 ${originalCount - data.preferences.length} 個低信心度偏好`);
          }
        }

        if (cleaned) {
          await this.restoreLearningData(data);
          await this.saveLearningData();
          console.log('學習數據清理完成');
        } else {
          console.log('沒有需要清理的數據');
        }
      },
      '清理學習數據',
      { logError: true, showToUser: true }
    ).then(() => {});
  }

  /**
   * 收集學習數據
   */
  private async collectLearningData(): Promise<LearningData> {
    const stats = this.learningEngine.getLearningStats();
    const patterns = this.learningEngine.getLearnedPatterns();
    const preferences = this.learningEngine.getUserPreferences();
    const identifiedPatterns = this.patternRecognizer.getAllPatterns();

    return {
      version: '1.0.0',
      lastUpdated: new Date(),
      events: [], // 實際實現中需要從 LearningEngine 獲取
      patterns,
      preferences,
      identifiedPatterns,
      stats,
      metadata: {
        totalSessions: 1, // 實際實現中需要追蹤
        firstLearningDate: new Date(),
        dataSize: 0 // 將在保存時計算
      }
    };
  }

  /**
   * 驗證學習數據
   */
  private validateLearningData(data: any): data is LearningData {
    return (
      data &&
      typeof data.version === 'string' &&
      Array.isArray(data.events) &&
      Array.isArray(data.patterns) &&
      Array.isArray(data.preferences) &&
      Array.isArray(data.identifiedPatterns) &&
      data.stats &&
      data.metadata
    );
  }

  /**
   * 恢復學習數據
   */
  private async restoreLearningData(data: LearningData): Promise<void> {
    // 這裡需要實際的恢復邏輯
    // 將數據恢復到 LearningEngine 和 PatternRecognizer
    console.log(`恢復 ${data.patterns.length} 個模式和 ${data.preferences.length} 個偏好`);
  }

  /**
   * 過濾導出數據
   */
  private filterDataForExport(data: LearningData, options: ExportOptions): Partial<LearningData> {
    const filtered: Partial<LearningData> = {
      version: data.version,
      lastUpdated: data.lastUpdated
    };

    if (options.includeEvents) {
      filtered.events = options.dateRange
        ? data.events.filter(e => e.timestamp >= options.dateRange!.start && e.timestamp <= options.dateRange!.end)
        : data.events;
    }

    if (options.includePatterns) {
      filtered.patterns = data.patterns;
    }

    if (options.includePreferences) {
      filtered.preferences = data.preferences;
    }

    if (options.includeStats) {
      filtered.stats = data.stats;
    }

    return filtered;
  }

  /**
   * 匿名化數據
   */
  private anonymizeData(data: Partial<LearningData>): void {
    // 移除敏感信息
    if (data.events) {
      data.events.forEach(event => {
        if (event.context.fileUri) {
          event.context.fileUri = vscode.Uri.file('/anonymized/file.ts');
        }
        if (event.data.code) {
          event.data.code = this.anonymizeCode(event.data.code);
        }
      });
    }

    if (data.patterns) {
      data.patterns.forEach(pattern => {
        pattern.pattern = this.anonymizeCode(pattern.pattern);
        pattern.examples = pattern.examples.map(ex => this.anonymizeCode(ex));
      });
    }
  }

  /**
   * 匿名化代碼
   */
  private anonymizeCode(code: string): string {
    return code
      .replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, 'identifier')
      .replace(/['"`][^'"`]*['"`]/g, '"string"')
      .replace(/\d+/g, '0');
  }

  /**
   * 合併學習數據
   */
  private async mergeLearningData(importedData: LearningData): Promise<void> {
    // 實現數據合併邏輯
    console.log('合併學習數據...');
  }

  /**
   * 初始化路徑
   */
  private initializePaths(): void {
    const extensionPath = vscode.extensions.getExtension('devika.devika-vscode')?.extensionPath || '';
    this.dataPath = path.join(extensionPath, 'data', 'learning-data.json');
    this.backupPath = path.join(extensionPath, 'data', 'backups');
  }

  /**
   * 設置自動保存
   */
  private setupAutoSave(): void {
    // 每 5 分鐘自動保存一次
    this.autoSaveInterval = setInterval(
      async () => {
        await this.saveLearningData();
      },
      5 * 60 * 1000
    );
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
   * 清理舊備份
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backupFiles = await fs.promises.readdir(this.backupPath);
      const learningBackups = backupFiles
        .filter(f => f.startsWith('learning-data-backup-'))
        .sort()
        .reverse();

      if (learningBackups.length > 10) {
        const filesToDelete = learningBackups.slice(10);
        for (const file of filesToDelete) {
          await fs.promises.unlink(path.join(this.backupPath, file));
        }
      }
    } catch (error) {
      console.warn('清理舊備份失敗:', error);
    }
  }

  /**
   * 清理資源
   */
  dispose(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
}
