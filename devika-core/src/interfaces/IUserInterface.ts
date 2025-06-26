/**
 * 使用者介面操作的抽象介面
 * 允許不同平台實作自己的 UI 邏輯
 */
export interface IUserInterface {
    /**
     * 顯示訊息給使用者
     * @param message 訊息內容
     * @param type 訊息類型
     */
    showMessage(message: string, type: MessageType): Promise<void>;

    /**
     * 顯示進度指示器
     * @param title 進度標題
     * @param task 要執行的任務
     * @returns 任務結果
     */
    showProgress<T>(title: string, task: (progress: ProgressReporter) => Promise<T>): Promise<T>;

    /**
     * 顯示快速選擇列表
     * @param items 選項列表
     * @param options 選擇選項
     * @returns 選中的項目，如果取消則返回 undefined
     */
    showQuickPick<T extends QuickPickItem>(
        items: T[], 
        options?: QuickPickOptions
    ): Promise<T | undefined>;

    /**
     * 顯示輸入框
     * @param options 輸入選項
     * @returns 輸入的文字，如果取消則返回 undefined
     */
    showInputBox(options?: InputBoxOptions): Promise<string | undefined>;

    /**
     * 顯示確認對話框
     * @param message 確認訊息
     * @param options 確認選項
     * @returns 使用者選擇
     */
    showConfirmDialog(message: string, options?: ConfirmOptions): Promise<boolean>;

    /**
     * 顯示預覽面板
     * @param title 面板標題
     * @param content 預覽內容
     * @param options 預覽選項
     * @returns 使用者操作結果
     */
    showPreview(title: string, content: string, options?: PreviewOptions): Promise<PreviewResult>;

    /**
     * 建立狀態列項目
     * @param text 顯示文字
     * @param options 狀態列選項
     * @returns 狀態列項目控制器
     */
    createStatusBarItem(text: string, options?: StatusBarOptions): StatusBarItem;

    /**
     * 註冊指令
     * @param command 指令名稱
     * @param callback 指令回調函式
     * @returns 取消註冊的函式
     */
    registerCommand(command: string, callback: (...args: any[]) => any): () => void;
}

/**
 * 訊息類型
 */
export type MessageType = 'info' | 'warning' | 'error' | 'success';

/**
 * 進度報告器
 */
export interface ProgressReporter {
    /**
     * 報告進度
     * @param progress 進度資訊
     */
    report(progress: ProgressInfo): void;
}

/**
 * 進度資訊
 */
export interface ProgressInfo {
    /** 進度百分比 (0-100) */
    increment?: number;
    /** 進度訊息 */
    message?: string;
}

/**
 * 快速選擇項目
 */
export interface QuickPickItem {
    /** 顯示標籤 */
    label: string;
    /** 描述文字 */
    description?: string;
    /** 詳細資訊 */
    detail?: string;
    /** 是否被選中 */
    picked?: boolean;
    /** 總是顯示 */
    alwaysShow?: boolean;
}

/**
 * 快速選擇選項
 */
export interface QuickPickOptions {
    /** 佔位符文字 */
    placeHolder?: string;
    /** 是否可以選擇多個項目 */
    canPickMany?: boolean;
    /** 是否忽略焦點丟失 */
    ignoreFocusOut?: boolean;
    /** 是否匹配描述 */
    matchOnDescription?: boolean;
    /** 是否匹配詳細資訊 */
    matchOnDetail?: boolean;
}

/**
 * 輸入框選項
 */
export interface InputBoxOptions {
    /** 佔位符文字 */
    placeHolder?: string;
    /** 預設值 */
    value?: string;
    /** 提示文字 */
    prompt?: string;
    /** 是否為密碼輸入 */
    password?: boolean;
    /** 是否忽略焦點丟失 */
    ignoreFocusOut?: boolean;
    /** 輸入驗證函式 */
    validateInput?(value: string): string | undefined;
}

/**
 * 確認選項
 */
export interface ConfirmOptions {
    /** 確認按鈕文字 */
    confirmText?: string;
    /** 取消按鈕文字 */
    cancelText?: string;
    /** 是否為危險操作 */
    dangerous?: boolean;
}

/**
 * 預覽選項
 */
export interface PreviewOptions {
    /** 內容類型 */
    contentType?: 'markdown' | 'html' | 'text';
    /** 是否可編輯 */
    editable?: boolean;
    /** 確認按鈕文字 */
    confirmText?: string;
    /** 取消按鈕文字 */
    cancelText?: string;
}

/**
 * 預覽結果
 */
export interface PreviewResult {
    /** 是否確認 */
    confirmed: boolean;
    /** 編輯後的內容 (如果可編輯) */
    content?: string;
}

/**
 * 狀態列選項
 */
export interface StatusBarOptions {
    /** 對齊方式 */
    alignment?: 'left' | 'right';
    /** 優先級 */
    priority?: number;
    /** 工具提示 */
    tooltip?: string;
    /** 指令 */
    command?: string;
}

/**
 * 狀態列項目控制器
 */
export interface StatusBarItem {
    /** 更新文字 */
    updateText(text: string): void;
    /** 更新工具提示 */
    updateTooltip(tooltip: string): void;
    /** 顯示 */
    show(): void;
    /** 隱藏 */
    hide(): void;
    /** 銷毀 */
    dispose(): void;
}
