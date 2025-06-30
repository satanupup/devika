import { Task, TaskStatus, TaskType, TaskPriority } from '../../tasks/TaskManager';

export class TestDataFactory {
  private static taskIdCounter = 1;
  private static projectIdCounter = 1;

  /**
   * 創建測試任務
   */
  static createTask(overrides: Partial<Task> = {}): Task {
    const id = `test-task-${this.taskIdCounter++}`;
    const now = new Date();

    return {
      id,
      title: `Test Task ${this.taskIdCounter}`,
      description: `Test task description ${this.taskIdCounter}`,
      status: 'pending' as TaskStatus,
      type: 'analysis' as TaskType,
      priority: 'medium' as TaskPriority,
      createdAt: now,
      updatedAt: now,
      tags: [],
      estimatedHours: 2,
      ...overrides
    };
  }

  /**
   * 創建多個測試任務
   */
  static createTasks(count: number, overrides: Partial<Task> = {}): Task[] {
    return Array.from({ length: count }, () => this.createTask(overrides));
  }

  /**
   * 創建不同狀態的任務集合
   */
  static createTasksWithDifferentStatuses(): Task[] {
    return [
      this.createTask({ status: 'pending', title: 'Pending Task' }),
      this.createTask({ status: 'in-progress', title: 'In Progress Task' }),
      this.createTask({ status: 'completed', title: 'Completed Task', completedAt: new Date() }),
      this.createTask({ status: 'cancelled', title: 'Cancelled Task' })
    ];
  }

  /**
   * 創建不同類型的任務集合
   */
  static createTasksWithDifferentTypes(): Task[] {
    return [
      this.createTask({ type: 'analysis', title: 'Analysis Task' }),
      this.createTask({ type: 'refactor', title: 'Refactor Task' }),
      this.createTask({ type: 'test', title: 'Test Task' }),
      this.createTask({ type: 'documentation', title: 'Documentation Task' }),
      this.createTask({ type: 'bug-fix', title: 'Bug Fix Task' })
    ];
  }

  /**
   * 創建不同優先級的任務集合
   */
  static createTasksWithDifferentPriorities(): Task[] {
    return [
      this.createTask({ priority: 'low', title: 'Low Priority Task' }),
      this.createTask({ priority: 'medium', title: 'Medium Priority Task' }),
      this.createTask({ priority: 'high', title: 'High Priority Task' }),
      this.createTask({ priority: 'urgent', title: 'Urgent Task' })
    ];
  }

  /**
   * 創建測試項目結構
   */
  static createProjectStructure() {
    return {
      name: `Test Project ${this.projectIdCounter++}`,
      path: `/test/project-${this.projectIdCounter}`,
      type: 'typescript',
      files: [
        {
          path: 'src/main.ts',
          content: `
export class Main {
  constructor() {
    console.log('Hello World');
  }
  
  public start(): void {
    // Implementation here
  }
}
          `.trim(),
          language: 'typescript'
        },
        {
          path: 'src/utils.ts',
          content: `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export function isValidEmail(email: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}
          `.trim(),
          language: 'typescript'
        },
        {
          path: 'tests/main.test.ts',
          content: `
import { Main } from '../src/main';

describe('Main', () => {
  test('should create instance', () => {
    const main = new Main();
    expect(main).toBeInstanceOf(Main);
  });
});
          `.trim(),
          language: 'typescript'
        },
        {
          path: 'package.json',
          content: JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            dependencies: {
              'typescript': '^4.9.0'
            },
            devDependencies: {
              'jest': '^29.0.0',
              '@types/jest': '^29.0.0'
            }
          }, null, 2),
          language: 'json'
        }
      ],
      dependencies: [
        { name: 'typescript', version: '^4.9.0', type: 'dependency' },
        { name: 'jest', version: '^29.0.0', type: 'devDependency' },
        { name: '@types/jest', version: '^29.0.0', type: 'devDependency' }
      ]
    };
  }

  /**
   * 創建測試 Git 歷史
   */
  static createGitHistory() {
    return [
      {
        hash: 'abc123def456',
        date: '2023-01-01T10:00:00Z',
        message: 'Initial commit',
        author_name: 'Test User',
        author_email: 'test@example.com'
      },
      {
        hash: 'def456ghi789',
        date: '2023-01-02T11:30:00Z',
        message: 'Add user authentication',
        author_name: 'Test User',
        author_email: 'test@example.com'
      },
      {
        hash: 'ghi789jkl012',
        date: '2023-01-03T14:15:00Z',
        message: 'Fix: resolve login issue',
        author_name: 'Test User',
        author_email: 'test@example.com'
      },
      {
        hash: 'jkl012mno345',
        date: '2023-01-04T09:45:00Z',
        message: 'feat: add user profile management',
        author_name: 'Another User',
        author_email: 'another@example.com'
      }
    ];
  }

  /**
   * 創建測試 Git 狀態
   */
  static createGitStatus() {
    return {
      current: 'feature/user-management',
      tracking: 'origin/feature/user-management',
      ahead: 2,
      behind: 0,
      staged: [
        'src/user/UserService.ts',
        'src/user/types.ts'
      ],
      modified: [
        'src/auth/AuthService.ts',
        'README.md'
      ],
      not_added: [
        'temp.log',
        'debug.txt'
      ],
      deleted: [],
      renamed: [],
      conflicted: []
    };
  }

  /**
   * 創建測試 LLM 響應
   */
  static createLLMResponse(content: string = 'Test AI response') {
    return {
      content,
      tokens: Math.floor(content.length / 4), // Rough token estimation
      model: 'gpt-4',
      timestamp: new Date(),
      usage: {
        prompt_tokens: 50,
        completion_tokens: Math.floor(content.length / 4),
        total_tokens: 50 + Math.floor(content.length / 4)
      }
    };
  }

  /**
   * 創建測試配置
   */
  static createTestConfiguration() {
    return {
      openaiApiKey: 'test-openai-key-12345',
      claudeApiKey: 'test-claude-key-67890',
      geminiApiKey: 'test-gemini-key-abcdef',
      preferredModel: 'gpt-4',
      autoScanTodos: true,
      enableCodeIndexing: true,
      maxContextLines: 100,
      enableGitIntegration: true,
      autoGenerateCommitMessages: true
    };
  }

  /**
   * 創建測試代碼上下文
   */
  static createCodeContext() {
    return {
      activeFile: {
        path: '/test/workspace/src/main.ts',
        content: `
import { UserService } from './user/UserService';
import { Logger } from './utils/Logger';

export class Application {
  private userService: UserService;
  private logger: Logger;

  constructor() {
    this.userService = new UserService();
    this.logger = new Logger();
  }

  public async start(): Promise<void> {
    this.logger.info('Application starting...');
    await this.userService.initialize();
    this.logger.info('Application started successfully');
  }
}
        `.trim(),
        language: 'typescript'
      },
      selectedText: 'this.userService = new UserService();',
      selection: {
        start: { line: 8, character: 4 },
        end: { line: 8, character: 40 }
      },
      workspacePath: '/test/workspace',
      relatedFiles: [
        '/test/workspace/src/user/UserService.ts',
        '/test/workspace/src/utils/Logger.ts',
        '/test/workspace/tests/Application.test.ts'
      ],
      imports: ['./user/UserService', './utils/Logger'],
      functions: ['constructor', 'start'],
      classes: ['Application'],
      projectStructure: [
        'src/',
        'src/main.ts',
        'src/user/',
        'src/user/UserService.ts',
        'src/utils/',
        'src/utils/Logger.ts',
        'tests/',
        'tests/Application.test.ts'
      ]
    };
  }

  /**
   * 創建測試錯誤
   */
  static createTestError(message: string = 'Test error', code?: string) {
    const error = new Error(message);
    if (code) {
      (error as any).code = code;
    }
    return error;
  }

  /**
   * 重置計數器
   */
  static resetCounters(): void {
    this.taskIdCounter = 1;
    this.projectIdCounter = 1;
  }
}
