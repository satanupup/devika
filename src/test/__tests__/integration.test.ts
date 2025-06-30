import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigManager } from '../../config/ConfigManager';
import { TaskManager } from '../../tasks/TaskManager';
import { LLMService } from '../../llm/LLMService';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { GitService } from '../../git/GitService';

// Mock external dependencies
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn(),
      has: jest.fn()
    })),
    workspaceFolders: [
      { uri: { fsPath: '/test/workspace' } }
    ]
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2
  }
}), { virtual: true });

jest.mock('axios', () => ({
  post: jest.fn()
}));

jest.mock('simple-git', () => ({
  simpleGit: jest.fn(() => ({
    status: jest.fn(),
    log: jest.fn(),
    add: jest.fn(),
    commit: jest.fn()
  }))
}));

jest.mock('sqlite3', () => ({
  Database: jest.fn(() => ({
    run: jest.fn((sql: string, params: any[], callback?: Function) => {
      if (callback) callback(null);
    }),
    get: jest.fn((sql: string, params: any[], callback?: Function) => {
      if (callback) callback(null, {});
    }),
    all: jest.fn((sql: string, params: any[], callback?: Function) => {
      if (callback) callback(null, []);
    }),
    close: jest.fn((callback?: Function) => {
      if (callback) callback(null);
    })
  }))
}));

describe('Integration Tests', () => {
  let configManager: ConfigManager;
  let taskManager: TaskManager;
  let llmService: LLMService;
  let databaseManager: DatabaseManager;
  let gitService: GitService;

  const mockContext = {
    workspaceState: {
      get: jest.fn(() => ({})),
      update: jest.fn()
    },
    globalState: {
      get: jest.fn(() => ({})),
      update: jest.fn()
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    configManager = ConfigManager.getInstance();
    taskManager = new TaskManager(mockContext as any);
    llmService = new LLMService();
    databaseManager = new DatabaseManager(':memory:');
    gitService = new GitService();

    await taskManager.initialize();
    await databaseManager.initialize();
  });

  afterEach(async () => {
    await databaseManager.close();
  });

  describe('Configuration and Task Management Integration', () => {
    test('should create tasks based on configuration settings', async () => {
      // Setup configuration
      const mockConfig = configManager as any;
      mockConfig.config = {
        get: jest.fn()
          .mockReturnValueOnce(true)  // autoScanTodos
          .mockReturnValueOnce(true)  // enableCodeIndexing
          .mockReturnValueOnce('gpt-4'), // preferredModel
        update: jest.fn()
      };

      // Create a task that depends on configuration
      const task = await taskManager.addTask({
        title: 'Analyze code with AI',
        description: 'Use configured AI model to analyze code',
        status: 'pending',
        type: 'analysis'
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('Analyze code with AI');

      // Verify task was saved
      const allTasks = taskManager.getAllTasks();
      expect(allTasks).toHaveLength(1);
      expect(allTasks[0].id).toBe(task.id);
    });

    test('should validate configuration before creating AI tasks', async () => {
      const mockConfig = configManager as any;
      mockConfig.config = {
        get: jest.fn()
          .mockReturnValueOnce('')  // openaiApiKey
          .mockReturnValueOnce('')  // claudeApiKey
          .mockReturnValueOnce(''), // geminiApiKey
        update: jest.fn()
      };

      const validation = configManager.validateConfiguration();
      expect(validation.isValid).toBe(false);

      // Should still be able to create non-AI tasks
      const task = await taskManager.addTask({
        title: 'Manual code review',
        description: 'Review code manually',
        status: 'pending',
        type: 'review'
      });

      expect(task).toBeDefined();
    });
  });

  describe('LLM Service and Task Management Integration', () => {
    test('should process AI tasks with LLM service', async () => {
      // Setup valid API key
      const mockConfig = configManager as any;
      mockConfig.config = {
        get: jest.fn()
          .mockReturnValueOnce('test-api-key')  // openaiApiKey
          .mockReturnValueOnce('gpt-4'), // preferredModel
        update: jest.fn()
      };

      // Mock successful LLM response
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: {
          choices: [{
            message: {
              content: 'AI analysis complete: Code looks good!'
            }
          }],
          usage: { total_tokens: 50 },
          model: 'gpt-4'
        }
      });

      // Create AI task
      const task = await taskManager.addTask({
        title: 'AI Code Analysis',
        description: 'Analyze code quality using AI',
        status: 'pending',
        type: 'analysis'
      });

      // Simulate processing the task with LLM
      const llmResponse = await llmService.generateCompletion(
        'Analyze this code for quality issues',
        { model: 'gpt-4' }
      );

      expect(llmResponse.content).toBe('AI analysis complete: Code looks good!');

      // Update task with results
      const updatedTask = await taskManager.updateTask(task.id, {
        status: 'completed',
        result: llmResponse.content
      });

      expect(updatedTask?.status).toBe('completed');
      expect(updatedTask?.result).toBe('AI analysis complete: Code looks good!');
    });
  });

  describe('Database and Task Persistence Integration', () => {
    test('should persist tasks to database', async () => {
      // Create multiple tasks
      const tasks = await Promise.all([
        taskManager.addTask({
          title: 'Task 1',
          description: 'First task',
          status: 'pending',
          type: 'analysis'
        }),
        taskManager.addTask({
          title: 'Task 2',
          description: 'Second task',
          status: 'in-progress',
          type: 'refactor'
        })
      ]);

      expect(tasks).toHaveLength(2);

      // Verify tasks are persisted
      expect(mockContext.workspaceState.update).toHaveBeenCalled();

      // Simulate loading tasks from persistence
      mockContext.workspaceState.get.mockReturnValue({
        tasks: tasks.map(task => ({
          ...task,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        }))
      });

      const newTaskManager = new TaskManager(mockContext as any);
      await newTaskManager.initialize();

      const loadedTasks = newTaskManager.getAllTasks();
      expect(loadedTasks).toHaveLength(2);
      expect(loadedTasks[0].title).toBe('Task 1');
      expect(loadedTasks[1].title).toBe('Task 2');
    });
  });

  describe('Git Service and Task Integration', () => {
    test('should create tasks based on git status', async () => {
      // Mock git status
      const simpleGit = require('simple-git');
      const mockGit = simpleGit.simpleGit();
      
      mockGit.status.mockResolvedValue({
        current: 'feature-branch',
        staged: ['src/new-feature.ts'],
        modified: ['src/existing-file.ts'],
        not_added: ['temp.log']
      });

      const status = await gitService.getStatus();

      // Create tasks based on git status
      if (status.staged.length > 0) {
        await taskManager.addTask({
          title: 'Review staged changes',
          description: `Review ${status.staged.length} staged files`,
          status: 'pending',
          type: 'review'
        });
      }

      if (status.modified.length > 0) {
        await taskManager.addTask({
          title: 'Commit modified files',
          description: `Commit ${status.modified.length} modified files`,
          status: 'pending',
          type: 'git'
        });
      }

      const tasks = taskManager.getAllTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Review staged changes');
      expect(tasks[1].title).toBe('Commit modified files');
    });

    test('should generate commit messages using AI', async () => {
      // Setup LLM service
      const mockConfig = configManager as any;
      mockConfig.config = {
        get: jest.fn()
          .mockReturnValueOnce('test-api-key')
          .mockReturnValueOnce('gpt-4'),
        update: jest.fn()
      };

      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: {
          choices: [{
            message: {
              content: 'feat: add new user authentication feature'
            }
          }],
          usage: { total_tokens: 30 },
          model: 'gpt-4'
        }
      });

      // Mock git diff
      const simpleGit = require('simple-git');
      const mockGit = simpleGit.simpleGit();
      
      mockGit.diff.mockResolvedValue(`
diff --git a/src/auth.ts b/src/auth.ts
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/src/auth.ts
@@ -0,0 +1,10 @@
+export function authenticate(user: string, password: string) {
+  // Authentication logic
+  return true;
+}
      `);

      const diff = await gitService.getDiff(true);
      
      // Generate commit message using AI
      const commitMessage = await llmService.generateCompletion(
        `Generate a conventional commit message for these changes:\n${diff}`,
        { model: 'gpt-4', maxTokens: 100 }
      );

      expect(commitMessage.content).toBe('feat: add new user authentication feature');

      // Create task to commit with AI-generated message
      const task = await taskManager.addTask({
        title: 'Commit with AI message',
        description: `Commit changes with message: ${commitMessage.content}`,
        status: 'pending',
        type: 'git'
      });

      expect(task.description).toContain('feat: add new user authentication feature');
    });
  });

  describe('End-to-End Workflow', () => {
    test('should complete full AI-assisted development workflow', async () => {
      // 1. Setup configuration
      const mockConfig = configManager as any;
      mockConfig.config = {
        get: jest.fn()
          .mockReturnValueOnce('test-api-key')  // API key
          .mockReturnValueOnce('gpt-4')         // preferred model
          .mockReturnValueOnce(true)            // auto scan todos
          .mockReturnValueOnce(true),           // enable indexing
        update: jest.fn()
      };

      // 2. Create initial analysis task
      const analysisTask = await taskManager.addTask({
        title: 'Analyze codebase',
        description: 'Perform AI-powered code analysis',
        status: 'pending',
        type: 'analysis'
      });

      // 3. Process task with AI
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: {
          choices: [{
            message: {
              content: 'Found 3 potential improvements: 1) Extract common utility functions, 2) Add error handling, 3) Improve type safety'
            }
          }],
          usage: { total_tokens: 75 },
          model: 'gpt-4'
        }
      });

      const aiAnalysis = await llmService.generateCompletion(
        'Analyze this codebase for improvements',
        { model: 'gpt-4' }
      );

      // 4. Update analysis task and create follow-up tasks
      await taskManager.updateTask(analysisTask.id, {
        status: 'completed',
        result: aiAnalysis.content
      });

      const followUpTasks = await Promise.all([
        taskManager.addTask({
          title: 'Extract utility functions',
          description: 'Extract common utility functions as suggested by AI',
          status: 'pending',
          type: 'refactor'
        }),
        taskManager.addTask({
          title: 'Add error handling',
          description: 'Improve error handling throughout the codebase',
          status: 'pending',
          type: 'improvement'
        }),
        taskManager.addTask({
          title: 'Improve type safety',
          description: 'Add better TypeScript types',
          status: 'pending',
          type: 'improvement'
        })
      ]);

      // 5. Verify workflow completion
      const allTasks = taskManager.getAllTasks();
      expect(allTasks).toHaveLength(4); // 1 analysis + 3 follow-up tasks

      const completedTasks = taskManager.getTasksByStatus('completed');
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].title).toBe('Analyze codebase');

      const pendingTasks = taskManager.getTasksByStatus('pending');
      expect(pendingTasks).toHaveLength(3);

      // 6. Verify task statistics
      const stats = taskManager.getTaskStatistics();
      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(3);
      expect(stats.byType.analysis).toBe(1);
      expect(stats.byType.refactor).toBe(1);
      expect(stats.byType.improvement).toBe(2);
    });
  });
});
