/**
 * 專案上下文資訊的抽象介面
 * 提供專案相關的元資料和分析結果
 */
export interface IProjectContext {
    /**
     * 取得專案名稱
     */
    getProjectName(): string;

    /**
     * 取得主要程式語言
     */
    getPrimaryLanguage(): string;

    /**
     * 取得使用的框架列表
     */
    getFrameworks(): string[];

    /**
     * 取得專案類型
     */
    getProjectType(): ProjectType;

    /**
     * 取得 Git 資訊
     */
    getGitInfo(): GitInfo | undefined;

    /**
     * 取得專案統計資訊
     */
    getProjectStats(): ProjectStats;

    /**
     * 取得依賴項資訊
     */
    getDependencies(): DependencyInfo;

    /**
     * 取得建置工具資訊
     */
    getBuildTools(): BuildToolInfo;

    /**
     * 取得測試框架資訊
     */
    getTestFrameworks(): string[];

    /**
     * 取得程式碼風格配置
     */
    getCodeStyleConfig(): CodeStyleConfig;

    /**
     * 分析專案結構
     */
    analyzeProjectStructure(): Promise<ProjectStructure>;

    /**
     * 檢測專案問題
     */
    detectProjectIssues(): Promise<ProjectIssue[]>;
}

/**
 * 專案類型
 */
export type ProjectType = 
    | 'library'           // 函式庫
    | 'application'       // 應用程式
    | 'extension'         // 擴充功能
    | 'framework'         // 框架
    | 'tool'             // 工具
    | 'documentation'     // 文件專案
    | 'unknown';         // 未知類型

/**
 * Git 資訊
 */
export interface GitInfo {
    /** 是否為 Git 儲存庫 */
    isRepository: boolean;
    /** 目前分支 */
    currentBranch?: string;
    /** 遠端 URL */
    remoteUrl?: string;
    /** 是否有未提交的變更 */
    hasUncommittedChanges: boolean;
    /** 未追蹤的檔案數量 */
    untrackedFiles: number;
    /** 最後一次提交資訊 */
    lastCommit?: CommitInfo;
}

/**
 * 提交資訊
 */
export interface CommitInfo {
    /** 提交雜湊 */
    hash: string;
    /** 提交訊息 */
    message: string;
    /** 作者 */
    author: string;
    /** 提交時間 */
    date: Date;
}

/**
 * 專案統計資訊
 */
export interface ProjectStats {
    /** 總檔案數 */
    totalFiles: number;
    /** 程式碼檔案數 */
    codeFiles: number;
    /** 總行數 */
    totalLines: number;
    /** 程式碼行數 */
    codeLines: number;
    /** 註解行數 */
    commentLines: number;
    /** 空白行數 */
    blankLines: number;
    /** 各語言的檔案數量 */
    languageDistribution: Record<string, number>;
}

/**
 * 依賴項資訊
 */
export interface DependencyInfo {
    /** 生產依賴項 */
    production: Dependency[];
    /** 開發依賴項 */
    development: Dependency[];
    /** 過時的依賴項 */
    outdated: OutdatedDependency[];
    /** 有安全漏洞的依賴項 */
    vulnerable: VulnerableDependency[];
}

/**
 * 依賴項
 */
export interface Dependency {
    /** 套件名稱 */
    name: string;
    /** 目前版本 */
    version: string;
    /** 描述 */
    description?: string;
    /** 授權條款 */
    license?: string;
}

/**
 * 過時的依賴項
 */
export interface OutdatedDependency extends Dependency {
    /** 最新版本 */
    latestVersion: string;
    /** 更新類型 */
    updateType: 'patch' | 'minor' | 'major';
}

/**
 * 有漏洞的依賴項
 */
export interface VulnerableDependency extends Dependency {
    /** 漏洞嚴重程度 */
    severity: 'low' | 'moderate' | 'high' | 'critical';
    /** 漏洞描述 */
    vulnerabilityDescription: string;
    /** 修復版本 */
    fixedVersion?: string;
}

/**
 * 建置工具資訊
 */
export interface BuildToolInfo {
    /** 主要建置工具 */
    primary?: string;
    /** 所有檢測到的建置工具 */
    detected: string[];
    /** 建置腳本 */
    scripts: Record<string, string>;
}

/**
 * 程式碼風格配置
 */
export interface CodeStyleConfig {
    /** 縮排類型 */
    indentType: 'spaces' | 'tabs';
    /** 縮排大小 */
    indentSize: number;
    /** 行尾字元 */
    lineEnding: 'lf' | 'crlf';
    /** 最大行長度 */
    maxLineLength?: number;
    /** 是否在檔案結尾插入新行 */
    insertFinalNewline: boolean;
    /** 是否移除行尾空白 */
    trimTrailingWhitespace: boolean;
}

/**
 * 專案結構
 */
export interface ProjectStructure {
    /** 根目錄 */
    root: DirectoryNode;
    /** 重要檔案 */
    importantFiles: string[];
    /** 配置檔案 */
    configFiles: string[];
    /** 文件檔案 */
    documentationFiles: string[];
}

/**
 * 目錄節點
 */
export interface DirectoryNode {
    /** 名稱 */
    name: string;
    /** 路徑 */
    path: string;
    /** 子目錄 */
    children: DirectoryNode[];
    /** 檔案 */
    files: FileNode[];
}

/**
 * 檔案節點
 */
export interface FileNode {
    /** 名稱 */
    name: string;
    /** 路徑 */
    path: string;
    /** 檔案大小 */
    size: number;
    /** 檔案類型 */
    type: string;
}

/**
 * 專案問題
 */
export interface ProjectIssue {
    /** 問題類型 */
    type: IssueType;
    /** 嚴重程度 */
    severity: IssueSeverity;
    /** 問題描述 */
    description: string;
    /** 相關檔案 */
    file?: string;
    /** 行號 */
    line?: number;
    /** 建議的修復方法 */
    suggestion?: string;
}

/**
 * 問題類型
 */
export type IssueType = 
    | 'security'          // 安全問題
    | 'performance'       // 效能問題
    | 'maintainability'   // 維護性問題
    | 'compatibility'     // 相容性問題
    | 'style'            // 程式碼風格問題
    | 'dependency'       // 依賴項問題
    | 'configuration';   // 配置問題

/**
 * 問題嚴重程度
 */
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
