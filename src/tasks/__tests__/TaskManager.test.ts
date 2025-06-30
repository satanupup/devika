import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TaskManager } from '../TaskManager';
import { Task, TaskStatus, TaskType, TaskPriority } from '../TaskManager';

// Mock vscode module
const mockContext = {
  workspaceState: {
    get: jest.fn(),
    update: jest.fn()
  },
  globalState: {
    get: jest.fn(),
    update: jest.fn()
  }
};

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockContext.workspaceState.get.mockReturnValue({});
    taskManager = new TaskManager(mockContext as any);
    await taskManager.initialize();
  });

  describe('Initialization', () => {
    test('should initialize with empty task list', async () => {
      const tasks = taskManager.getAllTasks();
      expect(tasks).toHaveLength(0);
    });

    test('should load existing tasks from workspace state', async () => {
      const existingTasks = [
        {
          id: 'task-1',
          title: 'Test Task',
          description: 'Test Description',
          status: 'pending' as TaskStatus,
          type: 'analysis' as TaskType,
          priority: 'medium' as TaskPriority,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockContext.workspaceState.get.mockReturnValue({ tasks: existingTasks });
      
      const newTaskManager = new TaskManager(mockContext as any);
      await newTaskManager.initialize();
      
      const tasks = newTaskManager.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Test Task');
    });
  });

  describe('Task Creation', () => {
    test('should create a new task with required fields', async () => {
      const taskData = {
        title: 'New Task',
        description: 'New Task Description',
        status: 'pending' as TaskStatus,
        type: 'analysis' as TaskType
      };

      const task = await taskManager.addTask(taskData);

      expect(task.id).toBeDefined();
      expect(task.title).toBe('New Task');
      expect(task.description).toBe('New Task Description');
      expect(task.status).toBe('pending');
      expect(task.type).toBe('analysis');
      expect(task.priority).toBe('medium'); // default priority
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    test('should create a task with custom priority', async () => {
      const taskData = {
        title: 'High Priority Task',
        description: 'Important task',
        status: 'pending' as TaskStatus,
        type: 'refactor' as TaskType,
        priority: 'high' as TaskPriority
      };

      const task = await taskManager.addTask(taskData);

      expect(task.priority).toBe('high');
    });

    test('should save tasks to workspace state after creation', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending' as TaskStatus,
        type: 'analysis' as TaskType
      };

      await taskManager.addTask(taskData);

      expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
        'devikaTasks',
        expect.objectContaining({
          tasks: expect.arrayContaining([
            expect.objectContaining({
              title: 'Test Task'
            })
          ])
        })
      );
    });
  });

  describe('Task Updates', () => {
    test('should update task status', async () => {
      const task = await taskManager.addTask({
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending' as TaskStatus,
        type: 'analysis' as TaskType
      });

      const updatedTask = await taskManager.updateTask(task.id, {
        status: 'completed' as TaskStatus
      });

      expect(updatedTask).toBeDefined();
      expect(updatedTask!.status).toBe('completed');
      expect(updatedTask!.completedAt).toBeInstanceOf(Date);
      expect(updatedTask!.updatedAt.getTime()).toBeGreaterThan(task.updatedAt.getTime());
    });

    test('should update task priority', async () => {
      const task = await taskManager.addTask({
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending' as TaskStatus,
        type: 'analysis' as TaskType
      });

      const updatedTask = await taskManager.updateTask(task.id, {
        priority: 'high' as TaskPriority
      });

      expect(updatedTask).toBeDefined();
      expect(updatedTask!.priority).toBe('high');
    });

    test('should return undefined for non-existent task', async () => {
      const updatedTask = await taskManager.updateTask('non-existent-id', {
        status: 'completed' as TaskStatus
      });

      expect(updatedTask).toBeUndefined();
    });
  });

  describe('Task Retrieval', () => {
    beforeEach(async () => {
      // Add some test tasks
      await taskManager.addTask({
        title: 'Task 1',
        description: 'First task',
        status: 'pending' as TaskStatus,
        type: 'analysis' as TaskType,
        priority: 'high' as TaskPriority
      });

      await taskManager.addTask({
        title: 'Task 2',
        description: 'Second task',
        status: 'completed' as TaskStatus,
        type: 'refactor' as TaskType,
        priority: 'medium' as TaskPriority
      });

      await taskManager.addTask({
        title: 'Task 3',
        description: 'Third task',
        status: 'in-progress' as TaskStatus,
        type: 'test' as TaskType,
        priority: 'low' as TaskPriority
      });
    });

    test('should get all tasks', () => {
      const tasks = taskManager.getAllTasks();
      expect(tasks).toHaveLength(3);
    });

    test('should get task by ID', () => {
      const allTasks = taskManager.getAllTasks();
      const task = taskManager.getTaskById(allTasks[0].id);
      
      expect(task).toBeDefined();
      expect(task!.title).toBe('Task 1');
    });

    test('should return undefined for non-existent task ID', () => {
      const task = taskManager.getTaskById('non-existent-id');
      expect(task).toBeUndefined();
    });

    test('should get tasks by status', () => {
      const pendingTasks = taskManager.getTasksByStatus('pending');
      const completedTasks = taskManager.getTasksByStatus('completed');
      
      expect(pendingTasks).toHaveLength(1);
      expect(completedTasks).toHaveLength(1);
      expect(pendingTasks[0].title).toBe('Task 1');
      expect(completedTasks[0].title).toBe('Task 2');
    });

    test('should get tasks by type', () => {
      const analysisTasks = taskManager.getTasksByType('analysis');
      const refactorTasks = taskManager.getTasksByType('refactor');
      
      expect(analysisTasks).toHaveLength(1);
      expect(refactorTasks).toHaveLength(1);
      expect(analysisTasks[0].title).toBe('Task 1');
      expect(refactorTasks[0].title).toBe('Task 2');
    });

    test('should get tasks by priority', () => {
      const highPriorityTasks = taskManager.getTasksByPriority('high');
      const mediumPriorityTasks = taskManager.getTasksByPriority('medium');
      
      expect(highPriorityTasks).toHaveLength(1);
      expect(mediumPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0].title).toBe('Task 1');
      expect(mediumPriorityTasks[0].title).toBe('Task 2');
    });
  });

  describe('Task Search', () => {
    beforeEach(async () => {
      await taskManager.addTask({
        title: 'Refactor authentication module',
        description: 'Improve the authentication system',
        status: 'pending' as TaskStatus,
        type: 'refactor' as TaskType
      });

      await taskManager.addTask({
        title: 'Generate unit tests',
        description: 'Create comprehensive test suite',
        status: 'pending' as TaskStatus,
        type: 'test' as TaskType
      });
    });

    test('should search tasks by title', () => {
      const results = taskManager.searchTasks('Refactor');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Refactor authentication module');
    });

    test('should search tasks by description', () => {
      const results = taskManager.searchTasks('authentication');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Refactor authentication module');
    });

    test('should return empty array for no matches', () => {
      const results = taskManager.searchTasks('nonexistent');
      expect(results).toHaveLength(0);
    });

    test('should be case insensitive', () => {
      const results = taskManager.searchTasks('REFACTOR');
      expect(results).toHaveLength(1);
    });
  });

  describe('Task Statistics', () => {
    beforeEach(async () => {
      await taskManager.addTask({
        title: 'Task 1',
        description: 'Description 1',
        status: 'pending' as TaskStatus,
        type: 'analysis' as TaskType
      });

      await taskManager.addTask({
        title: 'Task 2',
        description: 'Description 2',
        status: 'completed' as TaskStatus,
        type: 'refactor' as TaskType
      });

      await taskManager.addTask({
        title: 'Task 3',
        description: 'Description 3',
        status: 'in-progress' as TaskStatus,
        type: 'analysis' as TaskType
      });
    });

    test('should calculate task statistics correctly', () => {
      const stats = taskManager.getTaskStatistics();

      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.byType.analysis).toBe(2);
      expect(stats.byType.refactor).toBe(1);
    });
  });

  describe('Task Deletion', () => {
    test('should delete task by ID', async () => {
      const task = await taskManager.addTask({
        title: 'Task to delete',
        description: 'This task will be deleted',
        status: 'pending' as TaskStatus,
        type: 'analysis' as TaskType
      });

      const deleted = await taskManager.deleteTask(task.id);
      
      expect(deleted).toBe(true);
      expect(taskManager.getTaskById(task.id)).toBeUndefined();
      expect(taskManager.getAllTasks()).toHaveLength(0);
    });

    test('should return false for non-existent task', async () => {
      const deleted = await taskManager.deleteTask('non-existent-id');
      expect(deleted).toBe(false);
    });
  });
});
