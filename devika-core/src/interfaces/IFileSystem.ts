/**
 * 檔案系統操作的抽象介面
 * 允許不同平台實作自己的檔案系統邏輯
 */
export interface IFileSystem {
    /**
     * 讀取檔案內容
     * @param path 檔案路徑 (相對於工作區根目錄)
     * @returns 檔案內容
     */
    readFile(path: string): Promise<string>;

    /**
     * 寫入檔案內容
     * @param path 檔案路徑 (相對於工作區根目錄)
     * @param content 檔案內容
     */
    writeFile(path: string, content: string): Promise<void>;

    /**
     * 檢查檔案是否存在
     * @param path 檔案路徑
     * @returns 是否存在
     */
    exists(path: string): Promise<boolean>;

    /**
     * 列出符合模式的檔案
     * @param pattern 檔案模式 (支援 glob)
     * @returns 檔案路徑列表
     */
    listFiles(pattern: string): Promise<string[]>;

    /**
     * 取得工作區根目錄
     * @returns 工作區根目錄路徑，如果沒有工作區則返回 undefined
     */
    getWorkspaceRoot(): string | undefined;

    /**
     * 取得檔案統計資訊
     * @param path 檔案路徑
     * @returns 檔案統計資訊
     */
    stat(path: string): Promise<FileStats>;

    /**
     * 建立目錄
     * @param path 目錄路徑
     */
    createDirectory(path: string): Promise<void>;

    /**
     * 刪除檔案或目錄
     * @param path 檔案或目錄路徑
     */
    delete(path: string): Promise<void>;

    /**
     * 監聽檔案變更
     * @param pattern 檔案模式
     * @param callback 變更回調函式
     * @returns 取消監聽的函式
     */
    watchFiles(pattern: string, callback: (event: FileChangeEvent) => void): () => void;
}

/**
 * 檔案統計資訊
 */
export interface FileStats {
    /** 檔案大小 (bytes) */
    size: number;
    /** 是否為目錄 */
    isDirectory: boolean;
    /** 是否為檔案 */
    isFile: boolean;
    /** 建立時間 */
    createdTime: Date;
    /** 修改時間 */
    modifiedTime: Date;
}

/**
 * 檔案變更事件
 */
export interface FileChangeEvent {
    /** 變更類型 */
    type: 'created' | 'modified' | 'deleted';
    /** 檔案路徑 */
    path: string;
}

/**
 * 檔案系統錯誤
 */
export class FileSystemError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly path?: string
    ) {
        super(message);
        this.name = 'FileSystemError';
    }
}

/**
 * 常見的檔案系統錯誤代碼
 */
export const FileSystemErrorCodes = {
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    DIRECTORY_NOT_EMPTY: 'DIRECTORY_NOT_EMPTY',
    INVALID_PATH: 'INVALID_PATH',
    DISK_FULL: 'DISK_FULL'
} as const;
