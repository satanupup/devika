import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { 
  CodeCompletionEngine, 
  CompletionType, 
  CodeCompletionItem 
} from '../../completion/CodeCompletionEngine';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key, defaultValue) => defaultValue)
    })),
    openTextDocument: jest.fn(() => Promise.resolve({
      getText: jest.fn(() => 'test content'),
      languageId: 'typescript'
    }))
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    activeTextEditor: {
      document: {
        languageId: 'typescript',
        getText: jest.fn(() => 'test content'),
        uri: { fsPath: '/test/file.ts' }
      }
    }
  },
  languages: {
    getDiagnostics: jest.fn(() => [])
  },
  CompletionItemKind: {
    Text: 0,
    Method: 1,
    Function: 2,
    Constructor: 3,
    Field: 4,
    Variable: 5,
    Class: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Unit: 10,
    Value: 11,
    Enum: 12,
    Keyword: 13,
    Snippet: 14,
    Color: 15,
    File: 16,
    Reference: 17,
    Folder: 18,
    EnumMember: 19,
    Constant: 20,
    Struct: 21,
    Event: 22,
    Operator: 23,
    TypeParameter: 24,
    Issue: 25
  },
  CompletionTriggerKind: {
    Invoke: 0,
    TriggerCharacter: 1,
    TriggerForIncompleteCompletions: 2
  },
  Position: jest.fn((line, character) => ({ line, character })),
  Range: jest.fn((start, end) => ({ start, end })),
  SnippetString: jest.fn((value) => ({ value })),
  MarkdownString: jest.fn((value) => ({ value })),
  CancellationToken: {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn()
  }
}));

// Mock dependencies
jest.mock('../../ai/CodeUnderstandingEngine', () => ({
  CodeUnderstandingEngine: {
    getInstance: jest.fn(() => ({
      getWorkspaceSymbols: jest.fn(() => Promise.resolve([])),
      getDocumentSymbols: jest.fn(() => Promise.resolve([])),
      generateSmartSuggestions: jest.fn(() => Promise.resolve([]))
    }))
  }
}));

jest.mock('../../context/ContextManager', () => ({
  ContextManager: {
    getInstance: jest.fn(() => ({
      getCurrentContext: jest.fn(() => Promise.resolve({}))
    }))
  }
}));

jest.mock('../../learning/LearningEngine', () => ({
  LearningEngine: {
    getInstance: jest.fn(() => ({
      getCompletionPatterns: jest.fn(() => Promise.resolve([])),
      recordCompletionUsage: jest.fn()
    }))
  }
}));

describe('CodeCompletionEngine', () => {
  let completionEngine: CodeCompletionEngine;
  let mockDocument: vscode.TextDocument;
  let mockPosition: vscode.Position;
  let mockContext: vscode.CompletionContext;

  beforeEach(() => {
    // 重置單例實例
    (CodeCompletionEngine as any).instance = undefined;
    completionEngine = CodeCompletionEngine.getInstance();

    // 創建模擬對象
    mockDocument = {
      uri: { toString: () => 'file:///test.ts', fsPath: '/test.ts' },
      languageId: 'typescript',
      lineCount: 10,
      getText: jest.fn(() => 'const test = "hello world";'),
      lineAt: jest.fn(() => ({ text: 'const test = "hello world";' })),
      getWordRangeAtPosition: jest.fn(() => new vscode.Range(new vscode.Position(0, 6), new vscode.Position(0, 10)))
    } as any;

    mockPosition = new vscode.Position(0, 10);

    mockContext = {
      triggerKind: vscode.CompletionTriggerKind.Invoke,
      triggerCharacter: undefined
    };
  });

  afterEach(() => {
    completionEngine.dispose();
  });

  describe('基本功能', () => {
    it('應該能夠創建單例實例', () => {
      const instance1 = CodeCompletionEngine.getInstance();
      const instance2 = CodeCompletionEngine.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('應該能夠提供完成項目', async () => {
      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      expect(Array.isArray(completions) || (completions && Array.isArray(completions.items))).toBe(true);
    });

    it('應該能夠解析完成項目', async () => {
      const mockItem = new vscode.CompletionItem('test', vscode.CompletionItemKind.Variable);
      
      const resolvedItem = await completionEngine.resolveCompletionItem(
        mockItem,
        vscode.CancellationToken
      );

      expect(resolvedItem).toBeDefined();
      expect(resolvedItem.label).toBe('test');
    });

    it('應該能夠記錄完成使用', () => {
      const completionId = 'test-completion-id';
      
      expect(() => {
        completionEngine.recordCompletionUsage(completionId);
      }).not.toThrow();
    });

    it('應該能夠獲取配置', () => {
      const config = completionEngine.getConfig();
      
      expect(config).toBeDefined();
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.maxSuggestions).toBe('number');
    });

    it('應該能夠更新配置', () => {
      const newConfig = {
        enabled: false,
        maxSuggestions: 10
      };
      
      expect(() => {
        completionEngine.updateConfig(newConfig);
      }).not.toThrow();
      
      const updatedConfig = completionEngine.getConfig();
      expect(updatedConfig.enabled).toBe(false);
      expect(updatedConfig.maxSuggestions).toBe(10);
    });

    it('應該能夠清除快取', () => {
      expect(() => {
        completionEngine.clearCache();
      }).not.toThrow();
    });

    it('應該能夠獲取統計信息', () => {
      const stats = completionEngine.getStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalCompletions).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
      expect(stats.usageStats).toBeInstanceOf(Map);
    });
  });

  describe('完成生成', () => {
    it('應該在禁用時返回空數組', async () => {
      completionEngine.updateConfig({ enabled: false });
      
      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      const items = Array.isArray(completions) ? completions : completions.items;
      expect(items).toHaveLength(0);
    });

    it('應該能夠生成不同類型的完成項目', async () => {
      completionEngine.updateConfig({ 
        enabled: true,
        enableSnippets: true,
        enableAISuggestions: true,
        enableLearning: true
      });

      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      expect(completions).toBeDefined();
    });

    it('應該能夠處理不同的觸發字符', async () => {
      const dotContext = {
        ...mockContext,
        triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: '.'
      };

      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        dotContext
      );

      expect(completions).toBeDefined();
    });

    it('應該能夠處理不同的語言', async () => {
      const pythonDocument = {
        ...mockDocument,
        languageId: 'python'
      };

      const completions = await completionEngine.provideCompletionItems(
        pythonDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      expect(completions).toBeDefined();
    });
  });

  describe('快取機制', () => {
    it('應該能夠快取完成結果', async () => {
      // 第一次調用
      const completions1 = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      // 第二次調用應該使用快取
      const completions2 = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      expect(completions1).toBeDefined();
      expect(completions2).toBeDefined();
    });

    it('應該能夠清理過期快取', () => {
      // 模擬大量快取項目
      for (let i = 0; i < 150; i++) {
        const mockDoc = {
          ...mockDocument,
          uri: { toString: () => `file:///test${i}.ts`, fsPath: `/test${i}.ts` }
        };
        
        completionEngine.provideCompletionItems(
          mockDoc,
          mockPosition,
          vscode.CancellationToken,
          mockContext
        );
      }

      const stats = completionEngine.getStatistics();
      expect(stats.cacheSize).toBeLessThanOrEqual(100);
    });
  });

  describe('使用統計', () => {
    it('應該能夠記錄完成使用統計', () => {
      const completionId = 'test-completion';
      
      // 記錄多次使用
      completionEngine.recordCompletionUsage(completionId);
      completionEngine.recordCompletionUsage(completionId);
      completionEngine.recordCompletionUsage(completionId);

      const stats = completionEngine.getStatistics();
      expect(stats.totalCompletions).toBeGreaterThan(0);
    });

    it('應該能夠追蹤最近使用的完成項目', () => {
      const completionId = 'recent-completion';
      
      completionEngine.recordCompletionUsage(completionId);

      const stats = completionEngine.getStatistics();
      expect(stats.recentCompletions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('錯誤處理', () => {
    it('應該能夠處理無效的文檔', async () => {
      const invalidDocument = null as any;

      const completions = await completionEngine.provideCompletionItems(
        invalidDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      const items = Array.isArray(completions) ? completions : completions.items;
      expect(items).toHaveLength(0);
    });

    it('應該能夠處理無效的位置', async () => {
      const invalidPosition = new vscode.Position(-1, -1);

      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        invalidPosition,
        vscode.CancellationToken,
        mockContext
      );

      expect(completions).toBeDefined();
    });

    it('應該能夠處理取消令牌', async () => {
      const cancelledToken = {
        isCancellationRequested: true,
        onCancellationRequested: jest.fn()
      };

      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        cancelledToken as any,
        mockContext
      );

      expect(completions).toBeDefined();
    });

    it('應該能夠處理生成器異常', async () => {
      // Mock 一個會拋出異常的生成器
      const originalMethod = (completionEngine as any).generateBuiltinCompletions;
      (completionEngine as any).generateBuiltinCompletions = jest.fn(() => {
        throw new Error('Generator error');
      });

      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      expect(completions).toBeDefined();

      // 恢復原方法
      (completionEngine as any).generateBuiltinCompletions = originalMethod;
    });
  });

  describe('配置管理', () => {
    it('應該能夠載入默認配置', () => {
      const config = completionEngine.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.maxSuggestions).toBeGreaterThan(0);
      expect(Array.isArray(config.languages)).toBe(true);
    });

    it('應該能夠響應配置變更', () => {
      const originalMaxSuggestions = completionEngine.getConfig().maxSuggestions;
      
      completionEngine.updateConfig({ maxSuggestions: 5 });
      
      const updatedConfig = completionEngine.getConfig();
      expect(updatedConfig.maxSuggestions).toBe(5);
      expect(updatedConfig.maxSuggestions).not.toBe(originalMaxSuggestions);
    });

    it('應該能夠驗證配置值', () => {
      // 測試無效配置值
      completionEngine.updateConfig({ 
        maxSuggestions: -1,
        confidenceThreshold: 2.0
      });
      
      const config = completionEngine.getConfig();
      // 配置應該有合理的默認值或驗證
      expect(config.maxSuggestions).toBeGreaterThan(0);
      expect(config.confidenceThreshold).toBeLessThanOrEqual(1);
    });
  });

  describe('性能測試', () => {
    it('應該能夠在合理時間內提供完成', async () => {
      const startTime = Date.now();
      
      await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 完成應該在 1 秒內返回
      expect(duration).toBeLessThan(1000);
    });

    it('應該能夠處理大量並發請求', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        const promise = completionEngine.provideCompletionItems(
          mockDocument,
          new vscode.Position(i, 0),
          vscode.CancellationToken,
          mockContext
        );
        promises.push(promise);
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('應該能夠限制完成項目數量', async () => {
      completionEngine.updateConfig({ maxSuggestions: 5 });
      
      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );
      
      const items = Array.isArray(completions) ? completions : completions.items;
      expect(items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('資源清理', () => {
    it('應該能夠正確清理資源', () => {
      // 創建一些數據
      completionEngine.recordCompletionUsage('test-1');
      completionEngine.recordCompletionUsage('test-2');
      
      // 清理資源
      completionEngine.dispose();
      
      // 驗證清理效果
      const stats = completionEngine.getStatistics();
      expect(stats.cacheSize).toBe(0);
    });

    it('應該能夠重新初始化', () => {
      // 清理資源
      completionEngine.dispose();
      
      // 重新獲取實例
      (CodeCompletionEngine as any).instance = undefined;
      const newEngine = CodeCompletionEngine.getInstance();
      
      expect(newEngine).toBeDefined();
      expect(newEngine).not.toBe(completionEngine);
    });
  });

  describe('完成項目驗證', () => {
    it('應該生成有效的完成項目', async () => {
      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      const items = Array.isArray(completions) ? completions : completions.items;
      
      items.forEach(item => {
        expect(item.label).toBeDefined();
        expect(typeof item.label).toBe('string');
        expect(item.kind).toBeDefined();
        
        if (item.insertText) {
          expect(typeof item.insertText === 'string' || item.insertText instanceof vscode.SnippetString).toBe(true);
        }
      });
    });

    it('應該為完成項目設置正確的排序', async () => {
      const completions = await completionEngine.provideCompletionItems(
        mockDocument,
        mockPosition,
        vscode.CancellationToken,
        mockContext
      );

      const items = Array.isArray(completions) ? completions : completions.items;
      
      // 檢查排序文本是否存在且格式正確
      items.forEach(item => {
        if (item.sortText) {
          expect(typeof item.sortText).toBe('string');
          expect(item.sortText.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
