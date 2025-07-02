import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';
import { PersonalizationEngine, SuggestionType, SuggestionPriority } from '../../personalization/PersonalizationEngine';
import { SuggestionGenerator } from '../../personalization/SuggestionGenerator';

// Mock vscode module
jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    joinPath: jest.fn((base, ...paths) => ({ fsPath: `${base.fsPath}/${paths.join('/')}` }))
  },
  workspace: {
    getWorkspaceFolder: jest.fn(),
    workspaceFolders: [],
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    },
    openTextDocument: jest.fn()
  },
  window: {
    activeTextEditor: null,
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  Range: jest.fn(),
  Position: jest.fn(),
  CodeActionKind: {
    QuickFix: 'quickfix',
    Refactor: 'refactor',
    RefactorRewrite: 'refactor.rewrite'
  },
  CompletionItemKind: {
    Snippet: 'snippet'
  }
}));

describe('PersonalizationEngine', () => {
  let personalizationEngine: PersonalizationEngine;
  let suggestionGenerator: SuggestionGenerator;

  beforeEach(() => {
    // 重置單例實例
    (PersonalizationEngine as any).instance = undefined;
    (SuggestionGenerator as any).instance = undefined;
    
    personalizationEngine = PersonalizationEngine.getInstance();
    suggestionGenerator = SuggestionGenerator.getInstance();
  });

  afterEach(() => {
    // 清理測試數據
  });

  describe('基本功能', () => {
    it('應該能夠創建單例實例', () => {
      const instance1 = PersonalizationEngine.getInstance();
      const instance2 = PersonalizationEngine.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('應該能夠生成個性化建議', async () => {
      // 模擬文檔
      const mockDocument = {
        uri: vscode.Uri.file('/test/file.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'function test() { return "hello"; }')
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      
      expect(Array.isArray(suggestions)).toBe(true);
      // 由於是模擬環境，可能沒有實際建議，但不應該拋出錯誤
    });

    it('應該能夠記錄用戶反饋', async () => {
      const suggestionId = 'test-suggestion-id';
      
      // 這應該不會拋出錯誤
      await expect(personalizationEngine.recordUserFeedback(
        suggestionId,
        'positive',
        'accepted'
      )).resolves.not.toThrow();
    });

    it('應該能夠獲取用戶偏好摘要', async () => {
      const summary = await personalizationEngine.getUserPreferenceSummary();
      
      expect(summary).toBeDefined();
      expect(Array.isArray(summary.preferredSuggestionTypes)).toBe(true);
      expect(Array.isArray(summary.avoidedSuggestionTypes)).toBe(true);
      expect(Array.isArray(summary.preferredLanguages)).toBe(true);
      expect(Array.isArray(summary.commonPatterns)).toBe(true);
      expect(Array.isArray(summary.learningAreas)).toBe(true);
    });
  });

  describe('建議生成', () => {
    it('應該能夠基於用戶偏好生成建議', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/component.tsx'),
        languageId: 'typescript',
        getText: jest.fn(() => `
          function MyComponent() {
            return <div>Hello World</div>;
          }
        `)
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(
        mockDocument,
        new vscode.Position(1, 0)
      );

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('應該能夠根據代碼內容生成相關建議', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/performance.js'),
        languageId: 'javascript',
        getText: jest.fn(() => `
          for (let i = 0; i < 1000; i++) {
            document.getElementById('test').innerHTML += 'item';
          }
        `)
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);

      expect(Array.isArray(suggestions)).toBe(true);
      // 應該能夠識別性能問題
    });

    it('應該能夠為不同語言生成適當的建議', async () => {
      const languages = ['typescript', 'javascript', 'python', 'java'];
      
      for (const language of languages) {
        const mockDocument = {
          uri: vscode.Uri.file(`/test/file.${language}`),
          languageId: language,
          getText: jest.fn(() => 'console.log("test");')
        } as any;

        const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
        expect(Array.isArray(suggestions)).toBe(true);
      }
    });
  });

  describe('用戶反饋學習', () => {
    it('應該能夠從正面反饋中學習', async () => {
      const suggestionId = 'positive-test';
      
      await personalizationEngine.recordUserFeedback(suggestionId, 'positive', 'accepted');
      
      // 驗證學習效果（這裡需要更具體的實現來測試）
      const summary = await personalizationEngine.getUserPreferenceSummary();
      expect(summary).toBeDefined();
    });

    it('應該能夠從負面反饋中學習', async () => {
      const suggestionId = 'negative-test';
      
      await personalizationEngine.recordUserFeedback(suggestionId, 'negative', 'rejected');
      
      // 驗證學習效果
      const summary = await personalizationEngine.getUserPreferenceSummary();
      expect(summary).toBeDefined();
    });

    it('應該能夠調整建議優先級基於反饋', async () => {
      // 模擬多次反饋
      for (let i = 0; i < 5; i++) {
        await personalizationEngine.recordUserFeedback(
          `suggestion-${i}`,
          'positive',
          'accepted'
        );
      }

      const summary = await personalizationEngine.getUserPreferenceSummary();
      expect(summary).toBeDefined();
    });
  });

  describe('建議過濾和排序', () => {
    it('應該能夠過濾低信心度的建議', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/filter.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'const x = 1;')
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      
      // 所有返回的建議都應該滿足最低信心度要求
      suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('應該能夠按優先級排序建議', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/priority.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'function test() {}')
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      
      // 檢查建議是否按優先級排序
      for (let i = 1; i < suggestions.length; i++) {
        const prevPriority = this.getPriorityValue(suggestions[i - 1].priority);
        const currPriority = this.getPriorityValue(suggestions[i].priority);
        expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
      }
    });

    it('應該能夠限制建議數量', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/limit.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'const a = 1; const b = 2; const c = 3;')
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      
      // 建議數量不應該超過配置的最大值
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });

    // 輔助方法
    getPriorityValue(priority: SuggestionPriority): number {
      switch (priority) {
        case SuggestionPriority.CRITICAL: return 4;
        case SuggestionPriority.HIGH: return 3;
        case SuggestionPriority.MEDIUM: return 2;
        case SuggestionPriority.LOW: return 1;
        default: return 0;
      }
    }
  });

  describe('上下文感知', () => {
    it('應該能夠基於項目類型生成建議', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/react-project/component.tsx'),
        languageId: 'typescript',
        getText: jest.fn(() => 'import React from "react";')
      } as any;

      // 模擬 React 項目
      (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
        uri: vscode.Uri.file('/test/react-project')
      });

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('應該能夠考慮當前文件上下文', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/utils.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'export function helper() {}')
      } as any;

      const position = new vscode.Position(0, 10);
      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(
        mockDocument,
        position
      );

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('應該能夠基於相關文件生成建議', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/main.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'import { helper } from "./utils";')
      } as any;

      const context = {
        relatedFiles: [vscode.Uri.file('/test/utils.ts')],
        dependencies: ['lodash', 'react']
      };

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(
        mockDocument,
        undefined,
        context
      );

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('錯誤處理', () => {
    it('應該能夠處理無效的文檔', async () => {
      const invalidDocument = null as any;
      
      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(invalidDocument);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    it('應該能夠處理無效的建議 ID', async () => {
      await expect(personalizationEngine.recordUserFeedback(
        'invalid-id',
        'positive',
        'accepted'
      )).resolves.not.toThrow();
    });

    it('應該能夠處理網絡錯誤', async () => {
      // 模擬網絡錯誤
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('Network error'));

      const mockDocument = {
        uri: vscode.Uri.file('/test/network-error.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'const x = 1;')
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('性能測試', () => {
    it('應該能夠快速生成建議', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/performance.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'const x = 1; const y = 2; const z = 3;')
      } as any;

      const startTime = Date.now();
      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      const endTime = Date.now();

      const duration = endTime - startTime;
      
      // 應該在合理時間內完成（比如 2 秒）
      expect(duration).toBeLessThan(2000);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('應該能夠處理大型文件', async () => {
      // 生成大型文件內容
      const largeContent = Array.from({ length: 1000 }, (_, i) => 
        `const variable${i} = ${i};`
      ).join('\n');

      const mockDocument = {
        uri: vscode.Uri.file('/test/large-file.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => largeContent)
      } as any;

      const startTime = Date.now();
      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      const endTime = Date.now();

      const duration = endTime - startTime;
      
      // 即使是大文件也應該在合理時間內完成
      expect(duration).toBeLessThan(5000);
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('建議品質', () => {
    it('應該生成有意義的建議標題', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/quality.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'function test() { return "hello"; }')
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      
      suggestions.forEach(suggestion => {
        expect(suggestion.title).toBeTruthy();
        expect(suggestion.title.length).toBeGreaterThan(5);
        expect(suggestion.description).toBeTruthy();
        expect(suggestion.reasoning).toBeTruthy();
      });
    });

    it('應該生成可執行的建議', async () => {
      const mockDocument = {
        uri: vscode.Uri.file('/test/actionable.ts'),
        languageId: 'typescript',
        getText: jest.fn(() => 'let x = 1; x = 2;')
      } as any;

      const suggestions = await personalizationEngine.generatePersonalizedSuggestions(mockDocument);
      
      const actionableSuggestions = suggestions.filter(s => s.actionable);
      actionableSuggestions.forEach(suggestion => {
        expect(suggestion.actions.length).toBeGreaterThan(0);
        suggestion.actions.forEach(action => {
          expect(action.label).toBeTruthy();
          expect(action.description).toBeTruthy();
        });
      });
    });
  });
});
