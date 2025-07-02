import * as vscode from 'vscode';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    type: 'analysis' | 'refactor' | 'test' | 'todo' | 'fix' | 'feature' | 'documentation' | 'deployment';
    filePath?: string;
    range?: vscode.Range;
    createdAt: Date;
    updatedAt?: Date;
    completedAt?: Date;
    priority: TaskPriority;
    tags: string[];
    assignee?: string;
    project?: string;
    dueDate?: Date;
    estimatedTime?: number; // 預估時間（分鐘）
    actualTime?: number; // 實際時間（分鐘）
    dependencies?: string[]; // 依賴的任務 ID
    subtasks?: Task[]; // 子任務
    metadata?: any;
}

export interface TaskGroup {
    id: string;
    name: string;
    tasks: Task[];
    createdAt: Date;
}

export class TaskManager {
    private tasks: Map<string, Task> = new Map();
    private taskGroups: Map<string, TaskGroup> = new Map();
    private context: vscode.ExtensionContext;
    private onTaskChangedEmitter = new vscode.EventEmitter<Task>();
    public readonly onTaskChanged = this.onTaskChangedEmitter.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async initialize(): Promise<void> {
        await this.loadTasks();
        this.setupAutoSave();
    }

    async addTask(task: Omit<Task, 'id' | 'createdAt' | 'priority' | 'tags' | 'dependencies' | 'subtasks'>): Promise<Task> {
        const newTask: Task = {
            ...task,
            id: this.generateTaskId(),
            createdAt: new Date(),
            priority: 'medium',
            tags: [],
            dependencies: task.dependencies || [],
            subtasks: task.subtasks || []
        };

        this.tasks.set(newTask.id, newTask);
        await this.saveTasks();
        this.onTaskChangedEmitter.fire(newTask);

        return newTask;
    }

    async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | undefined> {
        const task = this.tasks.get(taskId);
        if (!task) {
            return undefined;
        }

        const updatedTask: Task = {
            ...task,
            ...updates,
            updatedAt: new Date()
        };

        if (updates.status === 'completed' && task.status !== 'completed') {
            updatedTask.completedAt = new Date();
        }

        this.tasks.set(taskId, updatedTask);
        await this.saveTasks();
        this.onTaskChangedEmitter.fire(updatedTask);

        return updatedTask;
    }

    async deleteTask(taskId: string): Promise<boolean> {
        const deleted = this.tasks.delete(taskId);
        if (deleted) {
            await this.saveTasks();
        }
        return deleted;
    }

    getTask(taskId: string): Task | undefined {
        return this.tasks.get(taskId);
    }

    getAllTasks(): Task[] {
        return Array.from(this.tasks.values());
    }

    getTasksByStatus(status: Task['status']): Task[] {
        return this.getAllTasks().filter(task => task.status === status);
    }

    getTasksByType(type: Task['type']): Task[] {
        return this.getAllTasks().filter(task => task.type === type);
    }

    getTasksByFile(filePath: string): Task[] {
        return this.getAllTasks().filter(task => task.filePath === filePath);
    }

    getTasksByPriority(priority: Task['priority']): Task[] {
        return this.getAllTasks().filter(task => task.priority === priority);
    }

    searchTasks(query: string): Task[] {
        const lowerQuery = query.toLowerCase();
        return this.getAllTasks().filter(task =>
            task.description.toLowerCase().includes(lowerQuery) ||
            task.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
            (task.filePath && task.filePath.toLowerCase().includes(lowerQuery))
        );
    }

    async createTaskGroup(name: string, taskIds: string[]): Promise<TaskGroup> {
        const group: TaskGroup = {
            id: this.generateTaskId(),
            name,
            tasks: taskIds.map(id => this.getTask(id)).filter(Boolean) as Task[],
            createdAt: new Date()
        };

        this.taskGroups.set(group.id, group);
        await this.saveTaskGroups();

        return group;
    }

    getTaskGroup(groupId: string): TaskGroup | undefined {
        return this.taskGroups.get(groupId);
    }

    getAllTaskGroups(): TaskGroup[] {
        return Array.from(this.taskGroups.values());
    }

    async addTaskToGroup(groupId: string, taskId: string): Promise<boolean> {
        const group = this.taskGroups.get(groupId);
        const task = this.tasks.get(taskId);

        if (!group || !task) {
            return false;
        }

        if (!group.tasks.find(t => t.id === taskId)) {
            group.tasks.push(task);
            await this.saveTaskGroups();
        }

        return true;
    }

    async removeTaskFromGroup(groupId: string, taskId: string): Promise<boolean> {
        const group = this.taskGroups.get(groupId);
        if (!group) {
            return false;
        }

        const index = group.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            group.tasks.splice(index, 1);
            await this.saveTaskGroups();
            return true;
        }

        return false;
    }

    async completeTask(taskId: string): Promise<Task | undefined> {
        return await this.updateTask(taskId, { status: 'completed' });
    }

    async startTask(taskId: string): Promise<Task | undefined> {
        return await this.updateTask(taskId, { status: 'in-progress' });
    }

    async cancelTask(taskId: string): Promise<Task | undefined> {
        return await this.updateTask(taskId, { status: 'cancelled' });
    }

    async setPriority(taskId: string, priority: Task['priority']): Promise<Task | undefined> {
        return await this.updateTask(taskId, { priority });
    }

    async addTag(taskId: string, tag: string): Promise<Task | undefined> {
        const task = this.getTask(taskId);
        if (!task) {
            return undefined;
        }

        if (!task.tags.includes(tag)) {
            const updatedTags = [...task.tags, tag];
            return await this.updateTask(taskId, { tags: updatedTags });
        }

        return task;
    }

    async removeTag(taskId: string, tag: string): Promise<Task | undefined> {
        const task = this.getTask(taskId);
        if (!task) {
            return undefined;
        }

        const updatedTags = task.tags.filter(t => t !== tag);
        return await this.updateTask(taskId, { tags: updatedTags });
    }



    async clearCompletedTasks(): Promise<number> {
        const completedTasks = this.getTasksByStatus('completed');
        let deletedCount = 0;

        for (const task of completedTasks) {
            if (await this.deleteTask(task.id)) {
                deletedCount++;
            }
        }

        return deletedCount;
    }

    async clearAllTasks(): Promise<void> {
        this.tasks.clear();
        this.taskGroups.clear();
        await this.saveTasks();
        await this.saveTaskGroups();
    }

    private generateTaskId(): string {
        return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private async loadTasks(): Promise<void> {
        try {
            const tasksData = this.context.workspaceState.get<{ [key: string]: Task }>('devika.tasks', {});
            this.tasks = new Map(Object.entries(tasksData));

            const groupsData = this.context.workspaceState.get<{ [key: string]: TaskGroup }>('devika.taskGroups', {});
            this.taskGroups = new Map(Object.entries(groupsData));
        } catch (error) {
            console.error('載入任務失敗:', error);
        }
    }

    private async saveTasks(): Promise<void> {
        try {
            const tasksData = Object.fromEntries(this.tasks);
            await this.context.workspaceState.update('devika.tasks', tasksData);
        } catch (error) {
            console.error('儲存任務失敗:', error);
        }
    }

    private async saveTaskGroups(): Promise<void> {
        try {
            const groupsData = Object.fromEntries(this.taskGroups);
            await this.context.workspaceState.update('devika.taskGroups', groupsData);
        } catch (error) {
            console.error('儲存任務群組失敗:', error);
        }
    }

    private setupAutoSave(): void {
        // 每 5 分鐘自動儲存一次
        setInterval(async () => {
            await this.saveTasks();
            await this.saveTaskGroups();
        }, 5 * 60 * 1000);
    }

    /**
     * 獲取任務統計信息
     */
    getTaskStatistics(): {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
        cancelled: number;
        byType: Map<string, number>;
        byPriority: Map<string, number>;
        averageCompletionTime: number;
    } {
        const stats = {
            total: this.tasks.size,
            pending: 0,
            inProgress: 0,
            completed: 0,
            cancelled: 0,
            byType: new Map<string, number>(),
            byPriority: new Map<string, number>(),
            averageCompletionTime: 0
        };

        let totalCompletionTime = 0;
        let completedTasksWithTime = 0;

        for (const task of this.tasks.values()) {
            // 統計狀態
            switch (task.status) {
                case 'pending':
                    stats.pending++;
                    break;
                case 'in-progress':
                    stats.inProgress++;
                    break;
                case 'completed':
                    stats.completed++;
                    if (task.actualTime) {
                        totalCompletionTime += task.actualTime;
                        completedTasksWithTime++;
                    }
                    break;
                case 'cancelled':
                    stats.cancelled++;
                    break;
            }

            // 統計類型
            const typeCount = stats.byType.get(task.type) || 0;
            stats.byType.set(task.type, typeCount + 1);

            // 統計優先級
            const priorityCount = stats.byPriority.get(task.priority) || 0;
            stats.byPriority.set(task.priority, priorityCount + 1);
        }

        // 計算平均完成時間
        if (completedTasksWithTime > 0) {
            stats.averageCompletionTime = totalCompletionTime / completedTasksWithTime;
        }

        return stats;
    }

    /**
     * 獲取任務依賴圖
     */
    getTaskDependencyGraph(): Map<string, string[]> {
        const graph = new Map<string, string[]>();

        for (const task of this.tasks.values()) {
            graph.set(task.id, task.dependencies);
        }

        return graph;
    }

    /**
     * 檢查任務依賴循環
     */
    checkCircularDependencies(): string[] {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const cycles: string[] = [];

        const dfs = (taskId: string, path: string[]): boolean => {
            if (recursionStack.has(taskId)) {
                cycles.push(path.join(' -> ') + ' -> ' + taskId);
                return true;
            }

            if (visited.has(taskId)) {
                return false;
            }

            visited.add(taskId);
            recursionStack.add(taskId);

            const task = this.tasks.get(taskId);
            if (task) {
                for (const depId of task.dependencies) {
                    if (dfs(depId, [...path, taskId])) {
                        return true;
                    }
                }
            }

            recursionStack.delete(taskId);
            return false;
        };

        for (const taskId of this.tasks.keys()) {
            if (!visited.has(taskId)) {
                dfs(taskId, []);
            }
        }

        return cycles;
    }

    /**
     * 獲取任務的執行順序（拓撲排序）
     */
    getTaskExecutionOrder(): string[] {
        const inDegree = new Map<string, number>();
        const graph = new Map<string, string[]>();

        // 初始化
        for (const task of this.tasks.values()) {
            inDegree.set(task.id, 0);
            graph.set(task.id, []);
        }

        // 構建圖和計算入度
        for (const task of this.tasks.values()) {
            for (const depId of task.dependencies) {
                if (graph.has(depId)) {
                    graph.get(depId)!.push(task.id);
                    inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
                }
            }
        }

        // 拓撲排序
        const queue: string[] = [];
        const result: string[] = [];

        // 找到所有入度為 0 的節點
        for (const [taskId, degree] of inDegree.entries()) {
            if (degree === 0) {
                queue.push(taskId);
            }
        }

        while (queue.length > 0) {
            const current = queue.shift()!;
            result.push(current);

            // 處理當前節點的所有鄰居
            for (const neighbor of graph.get(current) || []) {
                inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
                if (inDegree.get(neighbor) === 0) {
                    queue.push(neighbor);
                }
            }
        }

        return result;
    }

    /**
     * 自動分配任務優先級
     */
    autoAssignPriorities(): void {
        const dependencyGraph = this.getTaskDependencyGraph();
        const executionOrder = this.getTaskExecutionOrder();

        // 基於依賴關係和截止日期自動分配優先級
        for (let i = 0; i < executionOrder.length; i++) {
            const taskId = executionOrder[i];
            const task = this.tasks.get(taskId);

            if (task) {
                // 越早需要執行的任務優先級越高
                const position = i / executionOrder.length;

                if (position < 0.25) {
                    task.priority = 'urgent';
                } else if (position < 0.5) {
                    task.priority = 'high';
                } else if (position < 0.75) {
                    task.priority = 'medium';
                } else {
                    task.priority = 'low';
                }

                task.updatedAt = new Date();
                this.onTaskChangedEmitter.fire(task);
            }
        }
    }

    /**
     * 生成任務報告
     */
    generateTaskReport(): string {
        const stats = this.getTaskStatistics();
        const cycles = this.checkCircularDependencies();

        let report = '# 任務管理報告\n\n';

        // 基本統計
        report += '## 基本統計\n\n';
        report += `- 總任務數: ${stats.total}\n`;
        report += `- 待處理: ${stats.pending}\n`;
        report += `- 進行中: ${stats.inProgress}\n`;
        report += `- 已完成: ${stats.completed}\n`;
        report += `- 已取消: ${stats.cancelled}\n`;
        report += `- 平均完成時間: ${stats.averageCompletionTime.toFixed(1)} 分鐘\n\n`;

        // 按類型統計
        report += '## 按類型統計\n\n';
        for (const [type, count] of stats.byType.entries()) {
            report += `- ${type}: ${count}\n`;
        }
        report += '\n';

        // 按優先級統計
        report += '## 按優先級統計\n\n';
        for (const [priority, count] of stats.byPriority.entries()) {
            report += `- ${priority}: ${count}\n`;
        }
        report += '\n';

        // 依賴循環檢查
        if (cycles.length > 0) {
            report += '## ⚠️ 發現依賴循環\n\n';
            for (const cycle of cycles) {
                report += `- ${cycle}\n`;
            }
            report += '\n';
        }

        return report;
    }

    dispose(): void {
        this.onTaskChangedEmitter.dispose();
    }
}
