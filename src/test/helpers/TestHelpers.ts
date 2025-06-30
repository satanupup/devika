import { jest } from '@jest/globals';
import { VSCodeMocks } from '../mocks/VSCodeMocks';
import { LLMMocks } from '../mocks/LLMMocks';
import { TestDataFactory } from '../factories/TestDataFactory';

/**
 * 測試助手工具類
 */
export class TestHelpers {
  /**
   * 設置完整的測試環境
   */
  static setupTestEnvironment() {
    // 設置 VS Code API 模擬
    const vscode = VSCodeMocks.createFullVSCodeMock();
    (global as any).vscode = vscode;

    // 設置 Axios 模擬
    const mockAxios = LLMMocks.createMockAxios();
    LLMMocks.setupSuccessfulLLMResponses(mockAxios);

    return {
      vscode,
      mockAxios
    };
  }

  /**
   * 清理測試環境
   */
  static cleanupTestEnvironment() {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    TestDataFactory.resetCounters();
    
    // 清理全局變數
    delete (global as any).vscode;
  }

  /**
   * 等待異步操作完成
   */
  static async waitForAsync(ms: number = 0): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 等待所有 Promise 完成
   */
  static async flushPromises(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }

  /**
   * 創建模擬的 VS Code 擴展上下文
   */
  static createMockExtensionContext() {
    return {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(() => ({})),
        update: jest.fn(() => Promise.resolve()),
        keys: jest.fn(() => [])
      },
      globalState: {
        get: jest.fn(() => ({})),
        update: jest.fn(() => Promise.resolve()),
        keys: jest.fn(() => []),
        setKeysForSync: jest.fn()
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
        onDidChange: jest.fn()
      },
      extensionUri: { fsPath: '/test/extension', path: '/test/extension' },
      extensionPath: '/test/extension',
      asAbsolutePath: jest.fn((relativePath: string) => `/test/extension/${relativePath}`),
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/logs',
      extensionMode: 1, // Normal mode
      environmentVariableCollection: {
        persistent: true,
        replace: jest.fn(),
        append: jest.fn(),
        prepend: jest.fn(),
        get: jest.fn(),
        forEach: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn()
      }
    };
  }

  /**
   * 模擬文件系統操作
   */
  static mockFileSystem(files: Record<string, string> = {}) {
    const fs = require('fs');
    
    fs.promises.readFile.mockImplementation(async (path: string) => {
      if (files[path]) {
        return Buffer.from(files[path], 'utf8');
      }
      throw new Error(`File not found: ${path}`);
    });

    fs.promises.writeFile.mockImplementation(async (path: string, content: string) => {
      files[path] = content;
    });

    fs.promises.readdir.mockImplementation(async (path: string) => {
      return Object.keys(files)
        .filter(file => file.startsWith(path))
        .map(file => file.replace(path + '/', '').split('/')[0])
        .filter((item, index, arr) => arr.indexOf(item) === index);
    });

    fs.existsSync.mockImplementation((path: string) => {
      return files.hasOwnProperty(path);
    });

    return files;
  }

  /**
   * 模擬數據庫操作
   */
  static mockDatabase() {
    const mockDb = {
      data: new Map<string, any>(),
      
      run: jest.fn((sql: string, params: any[], callback?: Function) => {
        // 簡單的 INSERT 模擬
        if (sql.includes('INSERT')) {
          const id = Math.random().toString(36).substr(2, 9);
          this.data.set(id, { id, ...params });
        }
        if (callback) callback(null);
      }),
      
      get: jest.fn((sql: string, params: any[], callback?: Function) => {
        // 簡單的 SELECT 模擬
        const values = Array.from(this.data.values());
        const result = values.length > 0 ? values[0] : null;
        if (callback) callback(null, result);
      }),
      
      all: jest.fn((sql: string, params: any[], callback?: Function) => {
        // 簡單的 SELECT ALL 模擬
        const results = Array.from(this.data.values());
        if (callback) callback(null, results);
      }),
      
      close: jest.fn((callback?: Function) => {
        if (callback) callback(null);
      })
    };

    const sqlite3 = require('sqlite3');
    sqlite3.Database.mockImplementation(() => mockDb);

    return mockDb;
  }

  /**
   * 模擬 Git 操作
   */
  static mockGit() {
    const mockGit = {
      status: jest.fn(() => Promise.resolve(TestDataFactory.createGitStatus())),
      log: jest.fn(() => Promise.resolve({ all: TestDataFactory.createGitHistory() })),
      add: jest.fn(() => Promise.resolve()),
      commit: jest.fn(() => Promise.resolve({ commit: 'abc123' })),
      push: jest.fn(() => Promise.resolve()),
      pull: jest.fn(() => Promise.resolve()),
      branch: jest.fn(() => Promise.resolve({
        current: 'main',
        all: ['main', 'feature-branch']
      })),
      checkout: jest.fn(() => Promise.resolve()),
      diff: jest.fn(() => Promise.resolve('mock diff content')),
      show: jest.fn(() => Promise.resolve('mock show content'))
    };

    const simpleGit = require('simple-git');
    simpleGit.simpleGit.mockReturnValue(mockGit);

    return mockGit;
  }

  /**
   * 創建測試用的臨時目錄結構
   */
  static createTempDirectoryStructure() {
    const structure = {
      '/test/workspace': {
        'package.json': JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'typescript': '^4.9.0'
          }
        }),
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            strict: true
          }
        }),
        'src/main.ts': 'export class Main { }',
        'src/utils.ts': 'export function helper() { }',
        'tests/main.test.ts': 'import { Main } from "../src/main";',
        'README.md': '# Test Project'
      }
    };

    return this.flattenDirectoryStructure(structure);
  }

  /**
   * 將嵌套的目錄結構扁平化
   */
  private static flattenDirectoryStructure(structure: any, basePath: string = ''): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const [key, value] of Object.entries(structure)) {
      const fullPath = basePath ? `${basePath}/${key}` : key;
      
      if (typeof value === 'string') {
        flattened[fullPath] = value;
      } else if (typeof value === 'object' && value !== null) {
        Object.assign(flattened, this.flattenDirectoryStructure(value, fullPath));
      }
    }

    return flattened;
  }

  /**
   * 驗證模擬函數的調用
   */
  static expectMockToHaveBeenCalledWith(mockFn: jest.MockedFunction<any>, ...expectedArgs: any[]) {
    expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
  }

  /**
   * 驗證模擬函數的調用次數
   */
  static expectMockToHaveBeenCalledTimes(mockFn: jest.MockedFunction<any>, times: number) {
    expect(mockFn).toHaveBeenCalledTimes(times);
  }

  /**
   * 創建測試用的錯誤
   */
  static createTestError(message: string = 'Test error', code?: string) {
    return TestDataFactory.createTestError(message, code);
  }

  /**
   * 模擬網絡延遲
   */
  static async simulateNetworkDelay(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 驗證對象的部分匹配
   */
  static expectObjectToMatch(actual: any, expected: Partial<any>) {
    expect(actual).toMatchObject(expected);
  }

  /**
   * 驗證數組包含特定元素
   */
  static expectArrayToContain(array: any[], item: any) {
    expect(array).toContain(item);
  }

  /**
   * 驗證數組長度
   */
  static expectArrayToHaveLength(array: any[], length: number) {
    expect(array).toHaveLength(length);
  }

  /**
   * 驗證字符串包含特定內容
   */
  static expectStringToContain(str: string, substring: string) {
    expect(str).toContain(substring);
  }

  /**
   * 驗證 Promise 被拒絕
   */
  static async expectPromiseToReject(promise: Promise<any>, errorMessage?: string) {
    if (errorMessage) {
      await expect(promise).rejects.toThrow(errorMessage);
    } else {
      await expect(promise).rejects.toThrow();
    }
  }

  /**
   * 驗證 Promise 被解析
   */
  static async expectPromiseToResolve(promise: Promise<any>, expectedValue?: any) {
    if (expectedValue !== undefined) {
      await expect(promise).resolves.toEqual(expectedValue);
    } else {
      await expect(promise).resolves.toBeDefined();
    }
  }
}
