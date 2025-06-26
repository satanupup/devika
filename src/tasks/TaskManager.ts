import * as vscode from 'vscode';

export interface Task {
    id: string;
    description: string;
    status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
    type: 'analysis' | 'refactor' | 'test' | 'todo' | 'fix' | 'feature';
    filePath?: string;
    range?: vscode.Range;
    createdAt: Date;
    updatedAt?: Date;
    completedAt?: Date;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    tags: string[];
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

    async addTask(task: Omit<Task, 'id' | 'createdAt' | 'priority' | 'tags'>): Promise<Task> {
        const newTask: Task = {
            ...task,
            id: this.generateTaskId(),
            createdAt: new Date(),
            priority: 'medium',
            tags: []
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

    getTaskStatistics(): {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
        cancelled: number;
        byType: { [key in Task['type']]: number };
        byPriority: { [key in Task['priority']]: number };
    } {
        const tasks = this.getAllTasks();
        const stats = {
            total: tasks.length,
            pending: 0,
            inProgress: 0,
            completed: 0,
            cancelled: 0,
            byType: {
                analysis: 0,
                refactor: 0,
                test: 0,
                todo: 0,
                fix: 0,
                feature: 0
            } as { [key in Task['type']]: number },
            byPriority: {
                low: 0,
                medium: 0,
                high: 0,
                urgent: 0
            } as { [key in Task['priority']]: number }
        };

        for (const task of tasks) {
            switch (task.status) {
                case 'pending':
                    stats.pending++;
                    break;
                case 'in-progress':
                    stats.inProgress++;
                    break;
                case 'completed':
                    stats.completed++;
                    break;
                case 'cancelled':
                    stats.cancelled++;
                    break;
            }

            stats.byType[task.type]++;
            stats.byPriority[task.priority]++;
        }

        return stats;
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

    dispose(): void {
        this.onTaskChangedEmitter.dispose();
    }
}
