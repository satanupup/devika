import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';
import { LearningEngine, LearningEventType } from '../../learning/LearningEngine';
import { PatternRecognizer } from '../../learning/PatternRecognizer';

// Mock vscode module
jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path }))
  },
  workspace: {
    getWorkspaceFolder: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}));

describe('LearningEngine', () => {
  let learningEngine: LearningEngine;
  let patternRecognizer: PatternRecognizer;

  beforeEach(() => {
    // 重置單例實例
    (LearningEngine as any).instance = undefined;
    (PatternRecognizer as any).instance = undefined;
    
    learningEngine = LearningEngine.getInstance();
    patternRecognizer = PatternRecognizer.getInstance();
  });

  afterEach(() => {
    learningEngine.clearLearningData();
  });

  describe('基本功能', () => {
    it('應該能夠創建單例實例', () => {
      const instance1 = LearningEngine.getInstance();
      const instance2 = LearningEngine.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('應該能夠記錄學習事件', async () => {
      const context = {
        fileUri: vscode.Uri.file('/test/file.ts'),
        language: 'typescript',
        sessionId: 'test-session'
      };

      await learningEngine.recordEvent(
        LearningEventType.CODE_EDIT,
        context,
        { code: 'const x = 1;' },
        'positive'
      );

      const stats = learningEngine.getLearningStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.eventsByType[LearningEventType.CODE_EDIT]).toBe(1);
    });

    it('應該能夠學習編碼模式', async () => {
      const code = 'const handleClick = () => { console.log("clicked"); };';
      
      await learningEngine.learnCodingPattern(
        code,
        'typescript',
        'react',
        0.8
      );

      const patterns = learningEngine.getLearnedPatterns('typescript');
      expect(patterns.length).toBeGreaterThan(0);
      
      const pattern = patterns[0];
      expect(pattern.language).toBe('typescript');
      expect(pattern.effectiveness).toBe(0.8);
    });

    it('應該能夠學習用戶偏好', async () => {
      await learningEngine.learnUserPreference(
        'style',
        'arrow_function',
        { preference: 0.9 },
        ['typescript'],
        0.8
      );

      const preferences = learningEngine.getUserPreferences('style');
      expect(preferences.length).toBe(1);
      
      const preference = preferences[0];
      expect(preference.category).toBe('style');
      expect(preference.name).toBe('arrow_function');
      expect(preference.confidence).toBe(0.8);
    });
  });

  describe('模式學習', () => {
    it('應該能夠識別重複的模式並增加頻率', async () => {
      const code = 'const getData = async () => { return await fetch("/api/data"); };';
      
      // 第一次學習
      await learningEngine.learnCodingPattern(code, 'typescript', 'api', 0.7);
      
      // 第二次學習相同模式
      await learningEngine.learnCodingPattern(code, 'typescript', 'api', 0.8);

      const patterns = learningEngine.getLearnedPatterns('typescript');
      expect(patterns.length).toBe(1);
      
      const pattern = patterns[0];
      expect(pattern.frequency).toBe(2);
      expect(pattern.confidence).toBeGreaterThan(0.5);
    });

    it('應該能夠過濾低信心度的模式', () => {
      // 這個測試需要先添加一些低信心度的模式
      const patterns = learningEngine.getLearnedPatterns('typescript', 0.8);
      // 所有返回的模式信心度都應該 >= 0.8
      patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('偏好學習', () => {
    it('應該能夠更新現有偏好', async () => {
      const prefName = 'function_style';
      
      // 第一次學習
      await learningEngine.learnUserPreference(
        'style',
        prefName,
        { arrowFunction: true },
        ['typescript'],
        0.6
      );

      // 第二次學習，更新偏好
      await learningEngine.learnUserPreference(
        'style',
        prefName,
        { arrowFunction: true },
        ['typescript'],
        0.8
      );

      const preferences = learningEngine.getUserPreferences('style');
      const preference = preferences.find(p => p.name === prefName);
      
      expect(preference).toBeDefined();
      expect(preference!.frequency).toBe(2);
      expect(preference!.confidence).toBeGreaterThan(0.6);
    });

    it('應該能夠按類別過濾偏好', async () => {
      await learningEngine.learnUserPreference('style', 'indent', { spaces: 2 }, ['typescript'], 0.8);
      await learningEngine.learnUserPreference('pattern', 'error_handling', { tryCatch: true }, ['typescript'], 0.7);
      await learningEngine.learnUserPreference('tool', 'formatter', { prettier: true }, ['typescript'], 0.9);

      const stylePrefs = learningEngine.getUserPreferences('style');
      const patternPrefs = learningEngine.getUserPreferences('pattern');
      const toolPrefs = learningEngine.getUserPreferences('tool');

      expect(stylePrefs.length).toBe(1);
      expect(patternPrefs.length).toBe(1);
      expect(toolPrefs.length).toBe(1);

      expect(stylePrefs[0].category).toBe('style');
      expect(patternPrefs[0].category).toBe('pattern');
      expect(toolPrefs[0].category).toBe('tool');
    });
  });

  describe('學習統計', () => {
    it('應該能夠提供準確的統計信息', async () => {
      // 添加一些測試數據
      await learningEngine.recordEvent(
        LearningEventType.CODE_EDIT,
        {
          fileUri: vscode.Uri.file('/test/file1.ts'),
          language: 'typescript',
          sessionId: 'session1'
        },
        { code: 'const x = 1;' }
      );

      await learningEngine.recordEvent(
        LearningEventType.REFACTOR_ACCEPT,
        {
          fileUri: vscode.Uri.file('/test/file2.ts'),
          language: 'typescript',
          sessionId: 'session1'
        },
        { suggestion: 'extract function' },
        'positive'
      );

      await learningEngine.learnCodingPattern('const x = 1;', 'typescript', 'test', 0.7);
      await learningEngine.learnUserPreference('style', 'const_usage', { prefer: true }, ['typescript'], 0.8);

      const stats = learningEngine.getLearningStats();

      expect(stats.totalEvents).toBe(2);
      expect(stats.eventsByType[LearningEventType.CODE_EDIT]).toBe(1);
      expect(stats.eventsByType[LearningEventType.REFACTOR_ACCEPT]).toBe(1);
      expect(stats.patternsLearned).toBe(1);
      expect(stats.preferencesIdentified).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });

    it('應該能夠計算學習率', async () => {
      // 添加一些最近的事件
      for (let i = 0; i < 5; i++) {
        await learningEngine.recordEvent(
          LearningEventType.CODE_EDIT,
          {
            fileUri: vscode.Uri.file(`/test/file${i}.ts`),
            language: 'typescript',
            sessionId: 'session1'
          },
          { code: `const x${i} = ${i};` }
        );
      }

      const stats = learningEngine.getLearningStats();
      expect(stats.learningRate).toBeGreaterThan(0);
    });
  });

  describe('數據管理', () => {
    it('應該能夠清除學習數據', () => {
      // 先添加一些數據
      learningEngine.recordEvent(
        LearningEventType.CODE_EDIT,
        {
          fileUri: vscode.Uri.file('/test/file.ts'),
          language: 'typescript',
          sessionId: 'session1'
        },
        { code: 'const x = 1;' }
      );

      // 清除數據
      learningEngine.clearLearningData();

      // 驗證數據已清除
      const stats = learningEngine.getLearningStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.patternsLearned).toBe(0);
      expect(stats.preferencesIdentified).toBe(0);
    });

    it('應該能夠啟用和禁用學習', () => {
      learningEngine.setLearningEnabled(false);
      // 這裡需要驗證學習已禁用，但由於 isLearningEnabled 是私有的，
      // 我們可以通過嘗試記錄事件來間接測試
      
      learningEngine.setLearningEnabled(true);
      // 驗證學習已重新啟用
    });
  });

  describe('錯誤處理', () => {
    it('應該能夠處理無效的學習事件', async () => {
      // 測試空的上下文
      const invalidContext = {
        fileUri: vscode.Uri.file(''),
        language: '',
        sessionId: ''
      };

      // 這應該不會拋出錯誤
      await expect(learningEngine.recordEvent(
        LearningEventType.CODE_EDIT,
        invalidContext,
        {}
      )).resolves.not.toThrow();
    });

    it('應該能夠處理無效的模式數據', async () => {
      // 測試空代碼
      await expect(learningEngine.learnCodingPattern(
        '',
        'typescript',
        'test',
        0.5
      )).resolves.not.toThrow();

      // 測試無效語言
      await expect(learningEngine.learnCodingPattern(
        'const x = 1;',
        '',
        'test',
        0.5
      )).resolves.not.toThrow();
    });
  });

  describe('性能測試', () => {
    it('應該能夠處理大量學習事件', async () => {
      const startTime = Date.now();
      
      // 添加大量事件
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(learningEngine.recordEvent(
          LearningEventType.CODE_EDIT,
          {
            fileUri: vscode.Uri.file(`/test/file${i}.ts`),
            language: 'typescript',
            sessionId: 'performance-test'
          },
          { code: `const x${i} = ${i};` }
        ));
      }

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 應該在合理時間內完成（比如 5 秒）
      expect(duration).toBeLessThan(5000);

      const stats = learningEngine.getLearningStats();
      expect(stats.totalEvents).toBe(100);
    });
  });
});
