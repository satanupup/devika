import * as vscode from 'vscode';
import { Task, TaskManager } from '../tasks/TaskManager';

export class TaskTreeItem extends vscode.TreeItem {
    public override command?: vscode.Command;

    constructor(
        public readonly task: Task,
        public override readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly parent?: TaskTreeItem
    ) {
        super(task.title, collapsibleState);

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
        this.command = this.getCommand();
    }

    private getTooltip(): string {
        const lines = [
            `標題: ${this.task.title}`,
            `描述: ${this.task.description}`,
            `狀態: ${this.getStatusText()}`,
            `類型: ${this.task.type}`,
            `優先級: ${this.task.priority}`,
            `創建時間: ${this.task.createdAt.toLocaleString()}`
        ];

        if (this.task.estimatedTime) {
            lines.push(`預估時間: ${this.task.estimatedTime} 分鐘`);
        }

        if (this.task.actualTime) {
            lines.push(`實際時間: ${this.task.actualTime} 分鐘`);
        }

        if (this.task.assignee) {
            lines.push(`負責人: ${this.task.assignee}`);
        }

        if (this.task.tags.length > 0) {
            lines.push(`標籤: ${this.task.tags.join(', ')}`);
        }

        return lines.join('\n');
    }

    private getDescription(): string {
        const parts: string[] = [];

        // 顯示進度
        if (this.task.subtasks && this.task.subtasks.length > 0) {
            const completedSubtasks = this.getCompletedSubtasksCount();
            const totalSubtasks = this.task.subtasks.length;
            const progress = Math.round((completedSubtasks / totalSubtasks) * 100);
            parts.push(`${progress}% (${completedSubtasks}/${totalSubtasks})`);
        }

        // 顯示優先級
        if (this.task.priority === 'urgent') {
            parts.push('🔥');
        } else if (this.task.priority === 'high') {
            parts.push('⚡');
        }

        // 顯示時間信息
        if (this.task.estimatedTime) {
            parts.push(`⏱️ ${this.task.estimatedTime}m`);
        }

        return parts.join(' ');
    }

    private getIcon(): vscode.ThemeIcon {
        switch (this.task.status) {
            case 'pending':
                return new vscode.ThemeIcon('circle-outline');
            case 'in-progress':
                return new vscode.ThemeIcon('sync', new vscode.ThemeColor('charts.blue'));
            case 'completed':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            case 'cancelled':
                return new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private getContextValue(): string {
        const values = ['task'];

        values.push(`status-${this.task.status}`);
        values.push(`type-${this.task.type}`);
        values.push(`priority-${this.task.priority}`);

        if (this.task.subtasks && this.task.subtasks.length > 0) {
            values.push('has-subtasks');
        }

        if (this.task.dependencies && this.task.dependencies.length > 0) {
            values.push('has-dependencies');
        }

        return values.join(' ');
    }

    private getCommand(): vscode.Command | undefined {
        return {
            command: 'devika.openTask',
            title: '打開任務',
            arguments: [this.task]
        };
    }

    private getStatusText(): string {
        switch (this.task.status) {
            case 'pending':
                return '待處理';
            case 'in-progress':
                return '進行中';
            case 'completed':
                return '已完成';
            case 'cancelled':
                return '已取消';
            default:
                return '未知';
        }
    }

    private getCompletedSubtasksCount(): number {
        // 這裡需要從 TaskManager 獲取子任務的狀態
        // 暫時返回 0，後續會實作
        return 0;
    }
}

export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private taskManager: TaskManager;
    private rootTasks: Task[] = [];

    constructor(taskManager: TaskManager) {
        this.taskManager = taskManager;
        this.loadTasks();

        // 監聽任務變更
        this.taskManager.onTaskChanged(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this.loadTasks();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
        if (!element) {
            // 返回根任務
            return Promise.resolve(this.getRootTaskItems());
        } else {
            // 返回子任務
            return Promise.resolve(this.getSubTaskItems(element.task));
        }
    }

    getParent(element: TaskTreeItem): vscode.ProviderResult<TaskTreeItem> {
        return element.parent;
    }

    private loadTasks(): void {
        const allTasks = this.taskManager.getAllTasks();

        // 找出根任務（沒有父任務的任務）
        this.rootTasks = allTasks.filter(task => {
            return !allTasks.some(otherTask =>
                otherTask.subtasks?.includes(task.id)
            );
        });
    }

    private getRootTaskItems(): TaskTreeItem[] {
        return this.rootTasks.map(task => this.createTaskItem(task));
    }

    private getSubTaskItems(parentTask: Task): TaskTreeItem[] {
        if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
            return [];
        }

        const subtasks = parentTask.subtasks
            .map(subtaskId => this.taskManager.getTask(subtaskId))
            .filter(task => task !== undefined) as Task[];

        return subtasks.map(task => this.createTaskItem(task));
    }

    private createTaskItem(task: Task, parent?: TaskTreeItem): TaskTreeItem {
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        const collapsibleState = hasSubtasks
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        return new TaskTreeItem(task, collapsibleState, parent);
    }

    // 公共方法供外部調用

    /**
     * 添加新任務
     */
    async addTask(parentTask?: Task): Promise<void> {
        const title = await vscode.window.showInputBox({
            prompt: '輸入任務標題',
            placeHolder: '任務標題'
        });

        if (!title) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: '輸入任務描述',
            placeHolder: '任務描述'
        });

        const type = await vscode.window.showQuickPick([
            { label: 'analysis', description: '分析任務' },
            { label: 'refactor', description: '重構任務' },
            { label: 'test', description: '測試任務' },
            { label: 'todo', description: '待辦事項' },
            { label: 'fix', description: '修復任務' },
            { label: 'feature', description: '功能開發' },
            { label: 'documentation', description: '文檔編寫' },
            { label: 'deployment', description: '部署任務' }
        ], {
            placeHolder: '選擇任務類型'
        });

        if (!type) {
            return;
        }

        const priority = await vscode.window.showQuickPick([
            { label: 'low', description: '低優先級' },
            { label: 'medium', description: '中優先級' },
            { label: 'high', description: '高優先級' },
            { label: 'urgent', description: '緊急' }
        ], {
            placeHolder: '選擇優先級'
        });

        const newTask = await this.taskManager.addTask({
            title: title,
            description: description || '',
            status: 'pending',
            type: type.label as any
        });

        if (priority) {
            await this.taskManager.updateTask(newTask.id, {
                priority: priority.label as any
            });
        }

        // 如果有父任務，添加到父任務的子任務列表
        if (parentTask) {
            const updatedSubtasks = [...(parentTask.subtasks || []), newTask.id];
            await this.taskManager.updateTask(parentTask.id, {
                subtasks: updatedSubtasks
            });
        }

        this.refresh();
    }

    /**
     * 刪除任務
     */
    async deleteTask(task: Task): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            `確定要刪除任務 "${task.title}" 嗎？`,
            { modal: true },
            '確定'
        );

        if (confirm === '確定') {
            await this.taskManager.deleteTask(task.id);
            this.refresh();
        }
    }

    /**
     * 更新任務狀態
     */
    async updateTaskStatus(task: Task, newStatus: Task['status']): Promise<void> {
        const updateData: Partial<Task> = {
            status: newStatus,
            updatedAt: new Date()
        };

        if (newStatus === 'completed') {
            updateData.completedAt = new Date();
        }

        await this.taskManager.updateTask(task.id, updateData);
        this.refresh();
    }

    /**
     * 編輯任務
     */
    async editTask(task: Task): Promise<void> {
        const newTitle = await vscode.window.showInputBox({
            prompt: '編輯任務標題',
            value: task.title
        });

        if (newTitle && newTitle !== task.title) {
            await this.taskManager.updateTask(task.id, {
                title: newTitle,
                updatedAt: new Date()
            });
            this.refresh();
        }
    }
}
