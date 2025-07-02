import * as vscode from 'vscode';
import { Task, TaskManager, TaskPriority, TaskStatus } from '../tasks/TaskManager';

export class TaskTreeView implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<
    TaskTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private treeView: vscode.TreeView<TaskTreeItem>;
  private tasks: Task[] = [];
  private groupBy: 'status' | 'priority' | 'project' | 'assignee' = 'status';
  private sortBy: 'name' | 'created' | 'updated' | 'priority' = 'created';
  private filterBy: TaskStatus | 'all' = 'all';

  constructor(
    private context: vscode.ExtensionContext,
    private taskManager: TaskManager
  ) {
    this.treeView = vscode.window.createTreeView('devikaTaskList', {
      treeDataProvider: this,
      showCollapseAll: true,
      canSelectMany: true,
      dragAndDropController: new TaskDragAndDropController(this.taskManager)
    });

    this.setupEventListeners();
    this.setupCommands();
    this.refresh();
  }

  /**
   * 刷新樹視圖
   */
  refresh(): void {
    this.tasks = this.taskManager.getAllTasks();
    this._onDidChangeTreeData.fire();
  }

  /**
   * 獲取樹項目
   */
  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 獲取子項目
   */
  getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
    if (!element) {
      // 根級別 - 返回分組
      return Promise.resolve(this.getGroupedTasks());
    } else if (element.contextValue === 'group') {
      // 分組級別 - 返回任務
      return Promise.resolve(this.getTasksInGroup(element));
    } else if (element.contextValue === 'task' && element.task?.subtasks) {
      // 任務級別 - 返回子任務
      return Promise.resolve(this.getSubtasks(element.task));
    }
    return Promise.resolve([]);
  }

  /**
   * 獲取分組任務
   */
  private getGroupedTasks(): TaskTreeItem[] {
    const filteredTasks = this.filterTasks(this.tasks);
    const sortedTasks = this.sortTasks(filteredTasks);

    switch (this.groupBy) {
      case 'status':
        return this.groupByStatus(sortedTasks);
      case 'priority':
        return this.groupByPriority(sortedTasks);
      case 'project':
        return this.groupByProject(sortedTasks);
      case 'assignee':
        return this.groupByAssignee(sortedTasks);
      default:
        return sortedTasks.map(task => this.createTaskItem(task));
    }
  }

  /**
   * 按狀態分組
   */
  private groupByStatus(tasks: Task[]): TaskTreeItem[] {
    const groups = new Map<TaskStatus, Task[]>();

    for (const task of tasks) {
      if (!groups.has(task.status)) {
        groups.set(task.status, []);
      }
      groups.get(task.status)!.push(task);
    }

    const statusOrder: TaskStatus[] = ['pending', 'in-progress', 'completed', 'cancelled'];
    const result: TaskTreeItem[] = [];

    for (const status of statusOrder) {
      const tasksInGroup = groups.get(status) || [];
      if (tasksInGroup.length > 0) {
        result.push(this.createGroupItem(this.getStatusDisplayName(status), tasksInGroup, this.getStatusIcon(status)));
      }
    }

    return result;
  }

  /**
   * 按優先級分組
   */
  private groupByPriority(tasks: Task[]): TaskTreeItem[] {
    const groups = new Map<TaskPriority, Task[]>();

    for (const task of tasks) {
      if (!groups.has(task.priority)) {
        groups.set(task.priority, []);
      }
      groups.get(task.priority)!.push(task);
    }

    const priorityOrder: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
    const result: TaskTreeItem[] = [];

    for (const priority of priorityOrder) {
      const tasksInGroup = groups.get(priority) || [];
      if (tasksInGroup.length > 0) {
        result.push(
          this.createGroupItem(this.getPriorityDisplayName(priority), tasksInGroup, this.getPriorityIcon(priority))
        );
      }
    }

    return result;
  }

  /**
   * 按項目分組
   */
  private groupByProject(tasks: Task[]): TaskTreeItem[] {
    const groups = new Map<string, Task[]>();

    for (const task of tasks) {
      const project = task.project || '未分類';
      if (!groups.has(project)) {
        groups.set(project, []);
      }
      groups.get(project)!.push(task);
    }

    return Array.from(groups.entries()).map(([project, tasks]) => this.createGroupItem(project, tasks, '📁'));
  }

  /**
   * 按負責人分組
   */
  private groupByAssignee(tasks: Task[]): TaskTreeItem[] {
    const groups = new Map<string, Task[]>();

    for (const task of tasks) {
      const assignee = task.assignee || '未分配';
      if (!groups.has(assignee)) {
        groups.set(assignee, []);
      }
      groups.get(assignee)!.push(task);
    }

    return Array.from(groups.entries()).map(([assignee, tasks]) => this.createGroupItem(assignee, tasks, '👤'));
  }

  /**
   * 獲取分組中的任務
   */
  private getTasksInGroup(groupItem: TaskTreeItem): TaskTreeItem[] {
    return groupItem.tasks?.map(task => this.createTaskItem(task)) || [];
  }

  /**
   * 獲取子任務
   */
  private getSubtasks(task: Task): TaskTreeItem[] {
    if (!task.subtasks) {
      return [];
    }

    return (
      task.subtasks
        .map(subtaskId => this.taskManager.getTask(subtaskId))
        .filter((subtask): subtask is Task => subtask !== undefined)
        .map(subtask => this.createTaskItem(subtask)) || []
    );
  }

  /**
   * 創建分組項目
   */
  private createGroupItem(label: string, tasks: Task[], icon: string): TaskTreeItem {
    const item = new TaskTreeItem(`${icon} ${label} (${tasks.length})`, vscode.TreeItemCollapsibleState.Expanded);
    item.contextValue = 'group';
    item.tasks = tasks;
    item.tooltip = `${tasks.length} 個任務`;
    return item;
  }

  /**
   * 創建任務項目
   */
  private createTaskItem(task: Task): TaskTreeItem {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const collapsibleState = hasSubtasks
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    const item = new TaskTreeItem(task.title, collapsibleState);
    item.task = task;
    item.contextValue = 'task';
    item.id = task.id;

    // 設置圖標
    item.iconPath = this.getTaskIcon(task);

    // 設置描述
    item.description = this.getTaskDescription(task);

    // 設置工具提示
    item.tooltip = this.getTaskTooltip(task);

    // 設置命令
    item.command = {
      command: 'devika.openTask',
      title: '打開任務',
      arguments: [task]
    };

    return item;
  }

  /**
   * 獲取任務圖標
   */
  private getTaskIcon(task: Task): vscode.ThemeIcon {
    switch (task.status) {
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

  /**
   * 獲取任務描述
   */
  private getTaskDescription(task: Task): string {
    const parts: string[] = [];

    if (task.priority !== 'medium') {
      parts.push(this.getPriorityDisplayName(task.priority));
    }

    if (task.assignee) {
      parts.push(`@${task.assignee}`);
    }

    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const now = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        parts.push(`逾期 ${Math.abs(diffDays)} 天`);
      } else if (diffDays === 0) {
        parts.push('今天到期');
      } else if (diffDays <= 7) {
        parts.push(`${diffDays} 天後到期`);
      }
    }

    return parts.join(' • ');
  }

  /**
   * 獲取任務工具提示
   */
  private getTaskTooltip(task: Task): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${task.title}**\n\n`);

    if (task.description) {
      tooltip.appendMarkdown(`${task.description}\n\n`);
    }

    tooltip.appendMarkdown(`**狀態:** ${this.getStatusDisplayName(task.status)}\n`);
    tooltip.appendMarkdown(`**優先級:** ${this.getPriorityDisplayName(task.priority)}\n`);

    if (task.assignee) {
      tooltip.appendMarkdown(`**負責人:** ${task.assignee}\n`);
    }

    if (task.project) {
      tooltip.appendMarkdown(`**項目:** ${task.project}\n`);
    }

    if (task.dueDate) {
      tooltip.appendMarkdown(`**截止日期:** ${new Date(task.dueDate).toLocaleDateString()}\n`);
    }

    tooltip.appendMarkdown(`**創建時間:** ${task.createdAt.toLocaleDateString()}\n`);
    if (task.updatedAt) {
      tooltip.appendMarkdown(`**更新時間:** ${task.updatedAt.toLocaleDateString()}\n`);
    }

    if (task.tags && task.tags.length > 0) {
      tooltip.appendMarkdown(`**標籤:** ${task.tags.join(', ')}\n`);
    }

    if (task.subtasks && task.subtasks.length > 0) {
      tooltip.appendMarkdown(`**子任務:** ${task.subtasks.length} 個\n`);
    }

    return tooltip;
  }

  /**
   * 過濾任務
   */
  private filterTasks(tasks: Task[]): Task[] {
    if (this.filterBy === 'all') {
      return tasks;
    }
    return tasks.filter(task => task.status === this.filterBy);
  }

  /**
   * 排序任務
   */
  private sortTasks(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'updated':
          return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
        case 'priority':
          const priorityOrder: Record<TaskPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        default:
          return 0;
      }
    });
  }

  /**
   * 設置事件監聽器
   */
  private setupEventListeners(): void {
    // 監聽任務變更
    this.taskManager.onTaskChanged(() => {
      this.refresh();
    });

    // 監聽樹視圖選擇變更
    this.treeView.onDidChangeSelection(e => {
      if (e.selection.length > 0) {
        const item = e.selection[0];
        if (item && item.task) {
          vscode.commands.executeCommand('devika.selectTask', item.task);
        }
      }
    });

    // 監聽樹視圖可見性變更
    this.treeView.onDidChangeVisibility(e => {
      if (e.visible) {
        this.refresh();
      }
    });
  }

  /**
   * 設置命令
   */
  private setupCommands(): void {
    // 刷新命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.refreshTaskList', () => {
        this.refresh();
      })
    );

    // 分組命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.groupTasksBy', async () => {
        const options = [
          { label: '按狀態分組', value: 'status' },
          { label: '按優先級分組', value: 'priority' },
          { label: '按項目分組', value: 'project' },
          { label: '按負責人分組', value: 'assignee' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: '選擇分組方式'
        });

        if (selected) {
          this.groupBy = selected.value as any;
          this.refresh();
        }
      })
    );

    // 排序命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.sortTasksBy', async () => {
        const options = [
          { label: '按名稱排序', value: 'name' },
          { label: '按創建時間排序', value: 'created' },
          { label: '按更新時間排序', value: 'updated' },
          { label: '按優先級排序', value: 'priority' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: '選擇排序方式'
        });

        if (selected) {
          this.sortBy = selected.value as any;
          this.refresh();
        }
      })
    );

    // 過濾命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.filterTasksBy', async () => {
        const options = [
          { label: '顯示所有任務', value: 'all' },
          { label: '待辦任務', value: 'todo' },
          { label: '進行中任務', value: 'in_progress' },
          { label: '審核中任務', value: 'review' },
          { label: '已完成任務', value: 'done' },
          { label: '已取消任務', value: 'cancelled' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: '選擇過濾條件'
        });

        if (selected) {
          this.filterBy = selected.value as any;
          this.refresh();
        }
      })
    );

    // 創建任務命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.createTaskFromTreeView', () => {
        vscode.commands.executeCommand('devika.createTask');
      })
    );

    // 任務操作命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.editTask', (task: Task) => {
        vscode.commands.executeCommand('devika.editTask', task);
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.deleteTask', async (task: Task) => {
        const confirm = await vscode.window.showWarningMessage(`確定要刪除任務 "${task.title}" 嗎？`, '刪除', '取消');

        if (confirm === '刪除') {
          await this.taskManager.deleteTask(task.id);
          this.refresh();
        }
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.toggleTaskStatus', async (task: Task) => {
        const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
        await this.taskManager.updateTask(task.id, { status: newStatus });
        this.refresh();
      })
    );
  }

  // 輔助方法
  private getStatusDisplayName(status: TaskStatus): string {
    const names: Record<TaskStatus, string> = {
      pending: '待辦',
      'in-progress': '進行中',
      completed: '已完成',
      cancelled: '已取消'
    };
    return names[status];
  }

  private getStatusIcon(status: TaskStatus): string {
    const icons: Record<TaskStatus, string> = {
      pending: '⭕',
      'in-progress': '🔄',
      completed: '✅',
      cancelled: '❌'
    };
    return icons[status];
  }

  private getPriorityDisplayName(priority: TaskPriority): string {
    const names: Record<TaskPriority, string> = {
      urgent: '緊急',
      high: '高',
      medium: '中',
      low: '低'
    };
    return names[priority];
  }

  private getPriorityIcon(priority: TaskPriority): string {
    const icons: Record<TaskPriority, string> = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return icons[priority];
  }

  /**
   * 顯示樹視圖
   */
  show(): void {
    // this.treeView.show({ focus: true });
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.treeView.dispose();
  }
}

/**
 * 任務樹項目
 */
export class TaskTreeItem extends vscode.TreeItem {
  public task?: Task;
  public tasks?: Task[];

  constructor(
    public override readonly label: string,
    public override readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

/**
 * 任務拖拽控制器
 */
class TaskDragAndDropController implements vscode.TreeDragAndDropController<TaskTreeItem> {
  dropMimeTypes = ['application/vnd.code.tree.devikaTaskList'];
  dragMimeTypes = ['application/vnd.code.tree.devikaTaskList'];

  constructor(private taskManager: TaskManager) {}

  async handleDrag(source: TaskTreeItem[], treeDataTransfer: vscode.DataTransfer): Promise<void> {
    const tasks = source.filter(item => item.task).map(item => item.task!);
    treeDataTransfer.set('application/vnd.code.tree.devikaTaskList', new vscode.DataTransferItem(tasks));
  }

  async handleDrop(target: TaskTreeItem | undefined, sources: vscode.DataTransfer): Promise<void> {
    const transferItem = sources.get('application/vnd.code.tree.devikaTaskList');
    if (!transferItem) return;

    const tasks = transferItem.value as Task[];

    // 實作拖拽邏輯
    if (target?.task) {
      // 拖拽到另一個任務上 - 設為子任務
      for (const task of tasks) {
        // await this.taskManager.updateTask(task.id, { parentId: target.task.id });
      }
    } else if (target?.contextValue === 'group') {
      // 拖拽到分組上 - 更新狀態或其他屬性
      // 這裡需要根據分組類型來決定更新什麼屬性
    }
  }
}
