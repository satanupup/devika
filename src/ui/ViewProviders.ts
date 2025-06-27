import * as vscode from 'vscode';

export class DevikaTaskProvider implements vscode.TreeDataProvider<TaskItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | null | void> = new vscode.EventEmitter<TaskItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private tasks: TaskItem[] = [];

    constructor() {
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaskItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskItem): Thenable<TaskItem[]> {
        if (!element) {
            return Promise.resolve(this.getTasks());
        }
        return Promise.resolve([]);
    }

    private getTasks(): TaskItem[] {
        return [
            new TaskItem('開始使用 Devika', '點擊開始使用 AI 助理', vscode.TreeItemCollapsibleState.None, {
                command: 'devika.start',
                title: '啟動 Devika',
                arguments: []
            }),
            new TaskItem('分析代碼', '選擇代碼後點擊分析', vscode.TreeItemCollapsibleState.None, {
                command: 'devika.analyzeCode',
                title: '分析代碼',
                arguments: []
            }),
            new TaskItem('生成文檔', '自動生成項目文檔', vscode.TreeItemCollapsibleState.None, {
                command: 'devika.showPlugins',
                title: '顯示插件',
                arguments: []
            })
        ];
    }

    addTask(label: string, description: string, command?: vscode.Command): void {
        this.tasks.push(new TaskItem(label, description, vscode.TreeItemCollapsibleState.None, command));
        this.refresh();
    }

    clearTasks(): void {
        this.tasks = [];
        this.refresh();
    }
}

export class DevikaChatProvider implements vscode.TreeDataProvider<ChatItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ChatItem | undefined | null | void> = new vscode.EventEmitter<ChatItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ChatItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChatItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ChatItem): Thenable<ChatItem[]> {
        if (!element) {
            return Promise.resolve(this.getChatItems());
        }
        return Promise.resolve([]);
    }

    private getChatItems(): ChatItem[] {
        return [
            new ChatItem('💬 開始對話', '與 AI 助理開始對話', vscode.TreeItemCollapsibleState.None, {
                command: 'devika.start',
                title: '開始對話',
                arguments: []
            }),
            new ChatItem('📝 查看歷史', '查看對話歷史', vscode.TreeItemCollapsibleState.None),
            new ChatItem('⚙️ 設置', '配置 AI 助理', vscode.TreeItemCollapsibleState.None, {
                command: 'workbench.action.openSettings',
                title: '打開設置',
                arguments: ['@ext:devika.vscode-extension']
            })
        ];
    }
}

export class DevikaContextProvider implements vscode.TreeDataProvider<ContextItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContextItem | undefined | null | void> = new vscode.EventEmitter<ContextItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContextItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private contextItems: ContextItem[] = [];

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ContextItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ContextItem): Thenable<ContextItem[]> {
        if (!element) {
            return Promise.resolve(this.getContextItems());
        }
        return Promise.resolve([]);
    }

    private getContextItems(): ContextItem[] {
        if (this.contextItems.length === 0) {
            return [
                new ContextItem('📄 添加代碼片段', '選擇代碼並添加到上下文', vscode.TreeItemCollapsibleState.None, {
                    command: 'devika.addCodeSnippetToContext',
                    title: '添加代碼片段',
                    arguments: []
                }),
                new ContextItem('🗂️ 管理上下文', '查看和管理代碼上下文', vscode.TreeItemCollapsibleState.None, {
                    command: 'devika.showContextManager',
                    title: '管理上下文',
                    arguments: []
                }),
                new ContextItem('🗑️ 清空上下文', '清空所有上下文內容', vscode.TreeItemCollapsibleState.None, {
                    command: 'devika.clearContext',
                    title: '清空上下文',
                    arguments: []
                })
            ];
        }
        return this.contextItems;
    }

    addContextItem(filePath: string, lineStart: number, lineEnd: number): void {
        const fileName = filePath.split('/').pop() || filePath;
        const item = new ContextItem(
            `📄 ${fileName}`,
            `行 ${lineStart}-${lineEnd}`,
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'vscode.open',
                title: '打開文件',
                arguments: [vscode.Uri.file(filePath), { selection: new vscode.Range(lineStart - 1, 0, lineEnd - 1, 0) }]
            }
        );
        this.contextItems.push(item);
        this.refresh();
    }

    clearContextItems(): void {
        this.contextItems = [];
        this.refresh();
    }
}

class TaskItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.description = '';
        this.iconPath = new vscode.ThemeIcon('checklist');
    }
}

class ChatItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.description = '';
        this.iconPath = new vscode.ThemeIcon('comment-discussion');
    }
}

class ContextItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.description = '';
        this.iconPath = new vscode.ThemeIcon('code');
    }
}
