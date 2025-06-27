import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigManager } from '../../config/ConfigManager';
import { TaskManager } from '../../tasks/TaskManager';

suite('Devika Extension Test Suite', () => {
    vscode.window.showInformationMessage('開始執行所有測試。');

    test('ConfigManager 單例測試', () => {
        const config1 = ConfigManager.getInstance();
        const config2 = ConfigManager.getInstance();
        
        assert.strictEqual(config1, config2, 'ConfigManager 應該是單例');
    });

    test('ConfigManager 預設值測試', () => {
        const config = ConfigManager.getInstance();
        
        assert.strictEqual(config.getPreferredModel(), 'claude-3-sonnet', '預設模型應該是 claude-3-sonnet');
        assert.strictEqual(config.getAutoScanTodos(), true, '預設應該啟用自動掃描 TODO');
        assert.strictEqual(config.getEnableCodeIndexing(), true, '預設應該啟用程式碼索引');
        assert.strictEqual(config.getMaxContextLines(), 100, '預設最大上下文行數應該是 100');
    });

    test('ConfigManager 配置驗證測試', () => {
        const config = ConfigManager.getInstance();
        const validation = config.validateConfiguration();
        
        // 由於沒有設定 API 金鑰，驗證應該失敗
        assert.strictEqual(validation.isValid, false, '沒有 API 金鑰時驗證應該失敗');
        assert.ok(validation.errors.length > 0, '應該有錯誤訊息');
    });

    test('TaskManager 初始化測試', async () => {
        const mockContext = {
            workspaceState: {
                get: () => ({}),
                update: () => Promise.resolve()
            }
        } as any;

        const taskManager = new TaskManager(mockContext);
        await taskManager.initialize();

        const tasks = taskManager.getAllTasks();
        assert.strictEqual(tasks.length, 0, '初始化後應該沒有任務');
    });

    test('TaskManager 新增任務測試', async () => {
        const mockContext = {
            workspaceState: {
                get: () => ({}),
                update: () => Promise.resolve()
            }
        } as any;

        const taskManager = new TaskManager(mockContext);
        await taskManager.initialize();

        const task = await taskManager.addTask({
            title: '測試任務',
            description: '測試任務',
            status: 'pending',
            type: 'analysis'
        });

        assert.ok(task.id, '任務應該有 ID');
        assert.strictEqual(task.description, '測試任務', '任務描述應該正確');
        assert.strictEqual(task.status, 'pending', '任務狀態應該是 pending');
        assert.strictEqual(task.type, 'analysis', '任務類型應該是 analysis');
        assert.strictEqual(task.priority, 'medium', '預設優先級應該是 medium');
    });

    test('TaskManager 更新任務測試', async () => {
        const mockContext = {
            workspaceState: {
                get: () => ({}),
                update: () => Promise.resolve()
            }
        } as any;

        const taskManager = new TaskManager(mockContext);
        await taskManager.initialize();

        const task = await taskManager.addTask({
            title: '測試任務',
            description: '測試任務',
            status: 'pending',
            type: 'analysis'
        });

        const updatedTask = await taskManager.updateTask(task.id, {
            status: 'completed',
            priority: 'high'
        });

        assert.ok(updatedTask, '應該能更新任務');
        assert.strictEqual(updatedTask!.status, 'completed', '任務狀態應該更新為 completed');
        assert.strictEqual(updatedTask!.priority, 'high', '任務優先級應該更新為 high');
        assert.ok(updatedTask!.updatedAt, '應該有更新時間');
        assert.ok(updatedTask!.completedAt, '完成的任務應該有完成時間');
    });

    test('TaskManager 搜尋任務測試', async () => {
        const mockContext = {
            workspaceState: {
                get: () => ({}),
                update: () => Promise.resolve()
            }
        } as any;

        const taskManager = new TaskManager(mockContext);
        await taskManager.initialize();

        await taskManager.addTask({
            title: '重構程式碼',
            description: '重構程式碼',
            status: 'pending',
            type: 'refactor'
        });

        await taskManager.addTask({
            title: '生成測試',
            description: '生成測試',
            status: 'pending',
            type: 'test'
        });

        const searchResults = taskManager.searchTasks('重構');
        assert.strictEqual(searchResults.length, 1, '應該找到一個包含"重構"的任務');
        assert.strictEqual(searchResults[0].description, '重構程式碼', '搜尋結果應該正確');
    });

    test('TaskManager 統計測試', async () => {
        const mockContext = {
            workspaceState: {
                get: () => ({}),
                update: () => Promise.resolve()
            }
        } as any;

        const taskManager = new TaskManager(mockContext);
        await taskManager.initialize();

        await taskManager.addTask({
            description: '任務1',
            status: 'pending',
            type: 'analysis'
        });

        await taskManager.addTask({
            description: '任務2',
            status: 'completed',
            type: 'refactor'
        });

        const stats = taskManager.getTaskStatistics();
        assert.strictEqual(stats.total, 2, '總任務數應該是 2');
        assert.strictEqual(stats.pending, 1, '待處理任務數應該是 1');
        assert.strictEqual(stats.completed, 1, '已完成任務數應該是 1');
        assert.strictEqual(stats.byType.analysis, 1, 'analysis 類型任務數應該是 1');
        assert.strictEqual(stats.byType.refactor, 1, 'refactor 類型任務數應該是 1');
    });
});
