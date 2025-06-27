import { DatabaseManager } from './DatabaseManager';
import { Task } from '../tasks/TaskManager';

export interface TaskRecord {
    id: string;
    title: string;
    description: string;
    status: string;
    type: string;
    priority: string;
    assignee?: string;
    estimated_time?: number;
    actual_time?: number;
    file_path?: string;
    line_start?: number;
    line_end?: number;
    created_at: string;
    updated_at?: string;
    completed_at?: string;
    metadata?: string;
}

export interface TaskWithRelations extends TaskRecord {
    tags: string[];
    dependencies: string[];
    subtasks: string[];
}

export class TaskDAO {
    constructor(private dbManager: DatabaseManager) {}

    /**
     * 創建任務
     */
    async create(task: Omit<Task, 'dependencies' | 'subtasks'>): Promise<Task> {
        await this.dbManager.beginTransaction();
        
        try {
            // 插入主任務記錄
            const taskRecord: Omit<TaskRecord, 'id'> = {
                title: task.title,
                description: task.description,
                status: task.status,
                type: task.type,
                priority: task.priority,
                assignee: task.assignee,
                estimated_time: task.estimatedTime,
                actual_time: task.actualTime,
                file_path: task.filePath,
                line_start: task.range?.start.line,
                line_end: task.range?.end.line,
                created_at: task.createdAt.toISOString(),
                updated_at: task.updatedAt?.toISOString(),
                completed_at: task.completedAt?.toISOString(),
                metadata: task.metadata ? JSON.stringify(task.metadata) : undefined
            };

            await this.dbManager.run(`
                INSERT INTO tasks (
                    id, title, description, status, type, priority, assignee,
                    estimated_time, actual_time, file_path, line_start, line_end,
                    created_at, updated_at, completed_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                task.id, taskRecord.title, taskRecord.description, taskRecord.status,
                taskRecord.type, taskRecord.priority, taskRecord.assignee,
                taskRecord.estimated_time, taskRecord.actual_time, taskRecord.file_path,
                taskRecord.line_start, taskRecord.line_end, taskRecord.created_at,
                taskRecord.updated_at, taskRecord.completed_at, taskRecord.metadata
            ]);

            // 插入標籤
            if (task.tags && task.tags.length > 0) {
                for (const tag of task.tags) {
                    await this.dbManager.run(
                        'INSERT INTO task_tags (task_id, tag) VALUES (?, ?)',
                        [task.id, tag]
                    );
                }
            }

            await this.dbManager.commit();

            return {
                ...task,
                dependencies: [],
                subtasks: []
            };
        } catch (error) {
            await this.dbManager.rollback();
            throw error;
        }
    }

    /**
     * 根據 ID 獲取任務
     */
    async findById(id: string): Promise<Task | undefined> {
        const taskRecord = await this.dbManager.get<TaskRecord>(
            'SELECT * FROM tasks WHERE id = ?',
            [id]
        );

        if (!taskRecord) {
            return undefined;
        }

        return await this.mapRecordToTask(taskRecord);
    }

    /**
     * 獲取所有任務
     */
    async findAll(): Promise<Task[]> {
        const taskRecords = await this.dbManager.query<TaskRecord>(
            'SELECT * FROM tasks ORDER BY created_at DESC'
        );

        const tasks: Task[] = [];
        for (const record of taskRecords) {
            const task = await this.mapRecordToTask(record);
            tasks.push(task);
        }

        return tasks;
    }

    /**
     * 根據狀態查找任務
     */
    async findByStatus(status: Task['status']): Promise<Task[]> {
        const taskRecords = await this.dbManager.query<TaskRecord>(
            'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC',
            [status]
        );

        const tasks: Task[] = [];
        for (const record of taskRecords) {
            const task = await this.mapRecordToTask(record);
            tasks.push(task);
        }

        return tasks;
    }

    /**
     * 根據類型查找任務
     */
    async findByType(type: Task['type']): Promise<Task[]> {
        const taskRecords = await this.dbManager.query<TaskRecord>(
            'SELECT * FROM tasks WHERE type = ? ORDER BY created_at DESC',
            [type]
        );

        const tasks: Task[] = [];
        for (const record of taskRecords) {
            const task = await this.mapRecordToTask(record);
            tasks.push(task);
        }

        return tasks;
    }

    /**
     * 根據標籤查找任務
     */
    async findByTag(tag: string): Promise<Task[]> {
        const taskRecords = await this.dbManager.query<TaskRecord>(`
            SELECT t.* FROM tasks t
            INNER JOIN task_tags tt ON t.id = tt.task_id
            WHERE tt.tag = ?
            ORDER BY t.created_at DESC
        `, [tag]);

        const tasks: Task[] = [];
        for (const record of taskRecords) {
            const task = await this.mapRecordToTask(record);
            tasks.push(task);
        }

        return tasks;
    }

    /**
     * 搜索任務
     */
    async search(query: string): Promise<Task[]> {
        const taskRecords = await this.dbManager.query<TaskRecord>(`
            SELECT * FROM tasks 
            WHERE title LIKE ? OR description LIKE ?
            ORDER BY created_at DESC
        `, [`%${query}%`, `%${query}%`]);

        const tasks: Task[] = [];
        for (const record of taskRecords) {
            const task = await this.mapRecordToTask(record);
            tasks.push(task);
        }

        return tasks;
    }

    /**
     * 更新任務
     */
    async update(id: string, updates: Partial<Task>): Promise<Task | undefined> {
        await this.dbManager.beginTransaction();

        try {
            // 構建更新 SQL
            const updateFields: string[] = [];
            const updateValues: any[] = [];

            if (updates.title !== undefined) {
                updateFields.push('title = ?');
                updateValues.push(updates.title);
            }
            if (updates.description !== undefined) {
                updateFields.push('description = ?');
                updateValues.push(updates.description);
            }
            if (updates.status !== undefined) {
                updateFields.push('status = ?');
                updateValues.push(updates.status);
            }
            if (updates.type !== undefined) {
                updateFields.push('type = ?');
                updateValues.push(updates.type);
            }
            if (updates.priority !== undefined) {
                updateFields.push('priority = ?');
                updateValues.push(updates.priority);
            }
            if (updates.assignee !== undefined) {
                updateFields.push('assignee = ?');
                updateValues.push(updates.assignee);
            }
            if (updates.estimatedTime !== undefined) {
                updateFields.push('estimated_time = ?');
                updateValues.push(updates.estimatedTime);
            }
            if (updates.actualTime !== undefined) {
                updateFields.push('actual_time = ?');
                updateValues.push(updates.actualTime);
            }
            if (updates.updatedAt !== undefined) {
                updateFields.push('updated_at = ?');
                updateValues.push(updates.updatedAt.toISOString());
            }
            if (updates.completedAt !== undefined) {
                updateFields.push('completed_at = ?');
                updateValues.push(updates.completedAt?.toISOString());
            }
            if (updates.metadata !== undefined) {
                updateFields.push('metadata = ?');
                updateValues.push(JSON.stringify(updates.metadata));
            }

            if (updateFields.length > 0) {
                updateValues.push(id);
                await this.dbManager.run(
                    `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
                    updateValues
                );
            }

            // 更新標籤
            if (updates.tags !== undefined) {
                // 刪除舊標籤
                await this.dbManager.run(
                    'DELETE FROM task_tags WHERE task_id = ?',
                    [id]
                );

                // 插入新標籤
                for (const tag of updates.tags) {
                    await this.dbManager.run(
                        'INSERT INTO task_tags (task_id, tag) VALUES (?, ?)',
                        [id, tag]
                    );
                }
            }

            // 更新依賴關係
            if (updates.dependencies !== undefined) {
                // 刪除舊依賴
                await this.dbManager.run(
                    'DELETE FROM task_dependencies WHERE task_id = ?',
                    [id]
                );

                // 插入新依賴
                for (const depId of updates.dependencies) {
                    await this.dbManager.run(
                        'INSERT INTO task_dependencies (task_id, depends_on_task_id, created_at) VALUES (?, ?, ?)',
                        [id, depId, new Date().toISOString()]
                    );
                }
            }

            // 更新子任務關係
            if (updates.subtasks !== undefined) {
                // 刪除舊關係
                await this.dbManager.run(
                    'DELETE FROM task_hierarchy WHERE parent_task_id = ?',
                    [id]
                );

                // 插入新關係
                for (let i = 0; i < updates.subtasks.length; i++) {
                    await this.dbManager.run(
                        'INSERT INTO task_hierarchy (parent_task_id, child_task_id, order_index, created_at) VALUES (?, ?, ?, ?)',
                        [id, updates.subtasks[i], i, new Date().toISOString()]
                    );
                }
            }

            await this.dbManager.commit();

            return await this.findById(id);
        } catch (error) {
            await this.dbManager.rollback();
            throw error;
        }
    }

    /**
     * 刪除任務
     */
    async delete(id: string): Promise<boolean> {
        await this.dbManager.beginTransaction();

        try {
            // 刪除相關數據（由於外鍵約束，會自動級聯刪除）
            const result = await this.dbManager.run(
                'DELETE FROM tasks WHERE id = ?',
                [id]
            );

            await this.dbManager.commit();

            return result.changes > 0;
        } catch (error) {
            await this.dbManager.rollback();
            throw error;
        }
    }

    /**
     * 獲取任務統計
     */
    async getStatistics(): Promise<{
        total: number;
        byStatus: { [status: string]: number };
        byType: { [type: string]: number };
        byPriority: { [priority: string]: number };
    }> {
        const [totalResult, statusStats, typeStats, priorityStats] = await Promise.all([
            this.dbManager.get<{ count: number }>('SELECT COUNT(*) as count FROM tasks'),
            this.dbManager.query<{ status: string; count: number }>('SELECT status, COUNT(*) as count FROM tasks GROUP BY status'),
            this.dbManager.query<{ type: string; count: number }>('SELECT type, COUNT(*) as count FROM tasks GROUP BY type'),
            this.dbManager.query<{ priority: string; count: number }>('SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority')
        ]);

        return {
            total: totalResult?.count || 0,
            byStatus: Object.fromEntries(statusStats.map(s => [s.status, s.count])),
            byType: Object.fromEntries(typeStats.map(t => [t.type, t.count])),
            byPriority: Object.fromEntries(priorityStats.map(p => [p.priority, p.count]))
        };
    }

    /**
     * 將數據庫記錄映射為 Task 對象
     */
    private async mapRecordToTask(record: TaskRecord): Promise<Task> {
        // 獲取標籤
        const tags = await this.dbManager.query<{ tag: string }>(
            'SELECT tag FROM task_tags WHERE task_id = ?',
            [record.id]
        );

        // 獲取依賴關係
        const dependencies = await this.dbManager.query<{ depends_on_task_id: string }>(
            'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?',
            [record.id]
        );

        // 獲取子任務
        const subtasks = await this.dbManager.query<{ child_task_id: string }>(
            'SELECT child_task_id FROM task_hierarchy WHERE parent_task_id = ? ORDER BY order_index',
            [record.id]
        );

        return {
            id: record.id,
            title: record.title,
            description: record.description,
            status: record.status as Task['status'],
            type: record.type as Task['type'],
            priority: record.priority as Task['priority'],
            assignee: record.assignee,
            estimatedTime: record.estimated_time,
            actualTime: record.actual_time,
            filePath: record.file_path,
            range: record.line_start && record.line_end ? {
                start: { line: record.line_start, character: 0 },
                end: { line: record.line_end, character: 0 }
            } as any : undefined,
            createdAt: new Date(record.created_at),
            updatedAt: record.updated_at ? new Date(record.updated_at) : undefined,
            completedAt: record.completed_at ? new Date(record.completed_at) : undefined,
            tags: tags.map(t => t.tag),
            dependencies: dependencies.map(d => d.depends_on_task_id),
            subtasks: subtasks.map(s => s.child_task_id),
            metadata: record.metadata ? JSON.parse(record.metadata) : undefined
        };
    }
}
