import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Database } from 'sqlite3';
import { DATABASE_SCHEMA, DatabaseSchema, TableDefinition } from './DatabaseSchema';

export class DatabaseManager {
    private db: Database | null = null;
    private dbPath: string;
    private isInitialized = false;

    constructor(private context: vscode.ExtensionContext) {
        // 將數據庫文件放在工作區根目錄下的 .devika 文件夾中
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const devikaDir = path.join(workspaceFolder.uri.fsPath, '.devika');
            this.ensureDirectoryExists(devikaDir);
            this.dbPath = path.join(devikaDir, 'devika.db');
        } else {
            // 如果沒有工作區，使用擴展的全局存儲路徑
            this.dbPath = path.join(context.globalStorageUri.fsPath, 'devika.db');
        }
    }

    /**
     * 初始化數據庫
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // 確保數據庫目錄存在
            this.ensureDirectoryExists(path.dirname(this.dbPath));

            // 創建數據庫連接
            this.db = await this.createConnection();

            // 檢查並創建表結構
            await this.ensureSchema();

            this.isInitialized = true;
            console.log(`數據庫初始化完成: ${this.dbPath}`);
        } catch (error) {
            console.error('數據庫初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 創建數據庫連接
     */
    private createConnection(): Promise<Database> {
        return new Promise((resolve, reject) => {
            const db = new Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    // 啟用外鍵約束
                    db.run('PRAGMA foreign_keys = ON', (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(db);
                        }
                    });
                }
            });
        });
    }

    /**
     * 確保目錄存在
     */
    private ensureDirectoryExists(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * 確保數據庫架構正確
     */
    private async ensureSchema(): Promise<void> {
        if (!this.db) {
            throw new Error('數據庫未初始化');
        }

        // 檢查當前數據庫版本
        const currentVersion = await this.getDatabaseVersion();

        if (currentVersion === 0) {
            // 新數據庫，創建所有表
            await this.createTables();
            await this.setDatabaseVersion(DATABASE_SCHEMA.version);
        } else if (currentVersion < DATABASE_SCHEMA.version) {
            // 需要遷移
            await this.migrateDatabase(currentVersion, DATABASE_SCHEMA.version);
        }
    }

    /**
     * 獲取數據庫版本
     */
    private async getDatabaseVersion(): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('數據庫未初始化'));
                return;
            }

            // 檢查是否存在版本表
            this.db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!row) {
                        // 版本表不存在，這是新數據庫
                        resolve(0);
                        return;
                    }

                    // 獲取當前版本
                    this.db!.get(
                        'SELECT version FROM schema_version ORDER BY id DESC LIMIT 1',
                        (err, versionRow: any) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(versionRow ? versionRow.version : 0);
                            }
                        }
                    );
                }
            );
        });
    }

    /**
     * 設置數據庫版本
     */
    private async setDatabaseVersion(version: number): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('數據庫未初始化'));
                return;
            }

            // 創建版本表（如果不存在）
            this.db.run(`
                CREATE TABLE IF NOT EXISTS schema_version (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version INTEGER NOT NULL,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // 插入版本記錄
                this.db!.run(
                    'INSERT INTO schema_version (version) VALUES (?)',
                    [version],
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        });
    }

    /**
     * 創建所有表
     */
    private async createTables(): Promise<void> {
        if (!this.db) {
            throw new Error('數據庫未初始化');
        }

        for (const table of DATABASE_SCHEMA.tables) {
            await this.createTable(table);
        }
    }

    /**
     * 創建單個表
     */
    private async createTable(table: TableDefinition): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('數據庫未初始化'));
                return;
            }

            const sql = this.generateCreateTableSQL(table);

            this.db.run(sql, (err) => {
                if (err) {
                    console.error(`創建表 ${table.name} 失敗:`, err);
                    reject(err);
                } else {
                    console.log(`表 ${table.name} 創建成功`);

                    // 創建索引
                    if (table.indexes) {
                        this.createIndexes(table.name, table.indexes)
                            .then(() => resolve())
                            .catch(reject);
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    /**
     * 生成創建表的 SQL
     */
    private generateCreateTableSQL(table: TableDefinition): string {
        const columns = table.columns.map(col => {
            let sql = `${col.name} ${col.type}`;

            if (col.primaryKey) {
                sql += ' PRIMARY KEY';
            }

            if (col.autoIncrement) {
                sql += ' AUTOINCREMENT';
            }

            if (col.notNull) {
                sql += ' NOT NULL';
            }

            if (col.unique) {
                sql += ' UNIQUE';
            }

            if (col.defaultValue !== undefined) {
                if (typeof col.defaultValue === 'string') {
                    sql += ` DEFAULT '${col.defaultValue}'`;
                } else {
                    sql += ` DEFAULT ${col.defaultValue}`;
                }
            }

            if (col.foreignKey) {
                sql += ` REFERENCES ${col.foreignKey.table}(${col.foreignKey.column})`;
                if (col.foreignKey.onDelete) {
                    sql += ` ON DELETE ${col.foreignKey.onDelete}`;
                }
                if (col.foreignKey.onUpdate) {
                    sql += ` ON UPDATE ${col.foreignKey.onUpdate}`;
                }
            }

            return sql;
        });

        return `CREATE TABLE ${table.name} (${columns.join(', ')})`;
    }

    /**
     * 創建索引
     */
    private async createIndexes(tableName: string, indexes: any[]): Promise<void> {
        for (const index of indexes) {
            await this.createIndex(tableName, index);
        }
    }

    /**
     * 創建單個索引
     */
    private async createIndex(tableName: string, index: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('數據庫未初始化'));
                return;
            }

            const unique = index.unique ? 'UNIQUE ' : '';
            const sql = `CREATE ${unique}INDEX ${index.name} ON ${tableName} (${index.columns.join(', ')})`;

            this.db.run(sql, (err) => {
                if (err) {
                    console.error(`創建索引 ${index.name} 失敗:`, err);
                    reject(err);
                } else {
                    console.log(`索引 ${index.name} 創建成功`);
                    resolve();
                }
            });
        });
    }

    /**
     * 數據庫遷移
     */
    private async migrateDatabase(fromVersion: number, toVersion: number): Promise<void> {
        console.log(`開始數據庫遷移: ${fromVersion} -> ${toVersion}`);

        // 這裡可以實作具體的遷移邏輯
        // 暫時簡單地重新創建表結構
        await this.createTables();
        await this.setDatabaseVersion(toVersion);

        console.log('數據庫遷移完成');
    }

    /**
     * 執行查詢
     */
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('數據庫未初始化'));
                return;
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as T[]);
                }
            });
        });
    }

    /**
     * 執行單個查詢
     */
    async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('數據庫未初始化'));
                return;
            }

            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row as T);
                }
            });
        });
    }

    /**
     * 執行更新/插入/刪除
     */
    async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('數據庫未初始化'));
                return;
            }

            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * 開始事務
     */
    async beginTransaction(): Promise<void> {
        await this.run('BEGIN TRANSACTION');
    }

    /**
     * 提交事務
     */
    async commit(): Promise<void> {
        await this.run('COMMIT');
    }

    /**
     * 回滾事務
     */
    async rollback(): Promise<void> {
        await this.run('ROLLBACK');
    }

    /**
     * 關閉數據庫連接
     */
    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.db = null;
                        this.isInitialized = false;
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * 獲取數據庫路徑
     */
    getDatabasePath(): string {
        return this.dbPath;
    }

    /**
     * 檢查數據庫是否已初始化
     */
    isReady(): boolean {
        return this.isInitialized && this.db !== null;
    }
}
