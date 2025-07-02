import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';
import { ConversationMemoryManager, ConversationType } from '../../memory/ConversationMemoryManager';
import { ConversationContextAnalyzer } from '../../memory/ConversationContextAnalyzer';

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
      readFile: jest.fn()
    }
  },
  window: {
    activeTextEditor: null,
    tabGroups: {
      all: []
    },
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  Position: jest.fn(),
  extensions: {
    getExtension: jest.fn(() => ({ extensionPath: '/test/extension' }))
  }
}));

describe('ConversationMemoryManager', () => {
  let memoryManager: ConversationMemoryManager;
  let contextAnalyzer: ConversationContextAnalyzer;

  beforeEach(() => {
    // 重置單例實例
    (ConversationMemoryManager as any).instance = undefined;
    (ConversationContextAnalyzer as any).instance = undefined;
    
    memoryManager = ConversationMemoryManager.getInstance();
    contextAnalyzer = ConversationContextAnalyzer.getInstance();
  });

  afterEach(() => {
    // 清理測試數據
    memoryManager.dispose();
  });

  describe('基本功能', () => {
    it('應該能夠創建單例實例', () => {
      const instance1 = ConversationMemoryManager.getInstance();
      const instance2 = ConversationMemoryManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('應該能夠開始新的對話會話', async () => {
      const sessionId = await memoryManager.startNewSession(
        ConversationType.CHAT,
        '測試對話'
      );

      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe('string');

      const currentSession = memoryManager.getCurrentSession();
      expect(currentSession).toBeTruthy();
      expect(currentSession?.id).toBe(sessionId);
      expect(currentSession?.type).toBe(ConversationType.CHAT);
      expect(currentSession?.title).toBe('測試對話');
    });

    it('應該能夠添加消息到會話', async () => {
      const sessionId = await memoryManager.startNewSession(ConversationType.CHAT);
      
      await memoryManager.addMessage('user', '你好，這是一條測試消息');
      await memoryManager.addMessage('assistant', '你好！我是 Devika，很高興為您服務。');

      const session = memoryManager.getCurrentSession();
      expect(session?.messages.length).toBe(3); // 包括系統歡迎消息
      
      const userMessage = session?.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toBe('你好，這是一條測試消息');
      
      const assistantMessage = session?.messages.find(m => m.role === 'assistant');
      expect(assistantMessage?.content).toBe('你好！我是 Devika，很高興為您服務。');
    });

    it('應該能夠結束對話會話', async () => {
      const sessionId = await memoryManager.startNewSession(ConversationType.CHAT);
      await memoryManager.addMessage('user', '測試消息');

      await memoryManager.endSession(sessionId, '測試會話摘要');

      const currentSession = memoryManager.getCurrentSession();
      expect(currentSession).toBeNull();

      const history = memoryManager.getSessionHistory();
      expect(history.length).toBe(1);
      expect(history[0].id).toBe(sessionId);
      expect(history[0].isActive).toBe(false);
      expect(history[0].summary).toBe('測試會話摘要');
    });
  });

  describe('會話管理', () => {
    it('應該能夠管理多個會話', async () => {
      const session1 = await memoryManager.startNewSession(ConversationType.CHAT, '會話1');
      const session2 = await memoryManager.startNewSession(ConversationType.DEBUGGING, '會話2');
      const session3 = await memoryManager.startNewSession(ConversationType.CODE_REVIEW, '會話3');

      // 當前會話應該是最後創建的
      const currentSession = memoryManager.getCurrentSession();
      expect(currentSession?.id).toBe(session3);
      expect(currentSession?.type).toBe(ConversationType.CODE_REVIEW);
    });

    it('應該能夠恢復歷史會話', async () => {
      const sessionId = await memoryManager.startNewSession(ConversationType.CHAT, '測試會話');
      await memoryManager.addMessage('user', '測試消息');
      await memoryManager.endSession(sessionId);

      // 恢復會話
      const success = await memoryManager.resumeSession(sessionId);
      expect(success).toBe(true);

      const currentSession = memoryManager.getCurrentSession();
      expect(currentSession?.id).toBe(sessionId);
      expect(currentSession?.isActive).toBe(true);
    });

    it('應該能夠搜索對話歷史', async () => {
      // 創建一些測試會話
      const session1 = await memoryManager.startNewSession(ConversationType.CHAT, 'React 開發問題');
      await memoryManager.addMessage('user', '如何使用 React hooks？');
      await memoryManager.endSession(session1);

      const session2 = await memoryManager.startNewSession(ConversationType.DEBUGGING, 'TypeScript 錯誤');
      await memoryManager.addMessage('user', 'TypeScript 編譯錯誤');
      await memoryManager.endSession(session2);

      // 搜索包含 "React" 的會話
      const reactResults = await memoryManager.searchConversations('React');
      expect(reactResults.length).toBe(1);
      expect(reactResults[0].title).toBe('React 開發問題');

      // 搜索包含 "TypeScript" 的會話
      const tsResults = await memoryManager.searchConversations('TypeScript');
      expect(tsResults.length).toBe(1);
      expect(tsResults[0].title).toBe('TypeScript 錯誤');
    });

    it('應該能夠按類型過濾會話', async () => {
      await memoryManager.startNewSession(ConversationType.CHAT, '聊天會話');
      await memoryManager.endSession();

      await memoryManager.startNewSession(ConversationType.DEBUGGING, '調試會話');
      await memoryManager.endSession();

      await memoryManager.startNewSession(ConversationType.CODE_REVIEW, '審查會話');
      await memoryManager.endSession();

      // 按類型搜索
      const chatSessions = await memoryManager.searchConversations('', {
        type: ConversationType.CHAT
      });
      expect(chatSessions.length).toBe(1);
      expect(chatSessions[0].type).toBe(ConversationType.CHAT);

      const debugSessions = await memoryManager.searchConversations('', {
        type: ConversationType.DEBUGGING
      });
      expect(debugSessions.length).toBe(1);
      expect(debugSessions[0].type).toBe(ConversationType.DEBUGGING);
    });
  });

  describe('記憶檢索', () => {
    it('應該能夠檢索相關記憶', async () => {
      // 創建一些有內容的會話
      const session1 = await memoryManager.startNewSession(ConversationType.CHAT);
      await memoryManager.addMessage('user', '如何實現 React 組件？');
      await memoryManager.addMessage('assistant', '您可以使用函數組件或類組件來實現 React 組件。');
      await memoryManager.endSession(session1);

      const session2 = await memoryManager.startNewSession(ConversationType.LEARNING);
      await memoryManager.addMessage('user', 'React hooks 的使用方法');
      await memoryManager.addMessage('assistant', 'React hooks 讓您可以在函數組件中使用狀態和其他 React 特性。');
      await memoryManager.endSession(session2);

      // 檢索相關記憶
      const result = await memoryManager.getRelevantMemory('React 組件開發');
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toBeTruthy();
    });

    it('應該能夠基於上下文檢索記憶', async () => {
      // 模擬當前文件上下文
      const mockContext = {
        currentFile: vscode.Uri.file('/test/component.tsx'),
        projectType: 'react',
        relatedTopics: ['react', 'typescript']
      };

      const result = await memoryManager.getRelevantMemory(
        '組件優化',
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.contextualInfo).toBeDefined();
    });
  });

  describe('上下文管理', () => {
    it('應該能夠自動生成會話標題', async () => {
      // 模擬活躍編輯器
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: vscode.Uri.file('/test/component.tsx')
        }
      };

      const sessionId = await memoryManager.startNewSession(ConversationType.CODE_REVIEW);
      const session = memoryManager.getCurrentSession();
      
      expect(session?.title).toContain('Code Review');
      expect(session?.title).toContain('component.tsx');
    });

    it('應該能夠生成適當的會話標籤', async () => {
      const sessionId = await memoryManager.startNewSession(
        ConversationType.DEBUGGING,
        undefined,
        { projectType: 'react', currentFile: vscode.Uri.file('/test/app.ts') }
      );

      const session = memoryManager.getCurrentSession();
      expect(session?.tags).toContain('debugging');
      expect(session?.tags).toContain('react');
      expect(session?.tags).toContain('typescript');
    });
  });

  describe('消息元數據', () => {
    it('應該能夠正確估算 token 數量', async () => {
      const sessionId = await memoryManager.startNewSession(ConversationType.CHAT);
      
      const shortMessage = 'Hello';
      const longMessage = 'This is a much longer message that should have more tokens than the short message above.';

      await memoryManager.addMessage('user', shortMessage);
      await memoryManager.addMessage('user', longMessage);

      const session = memoryManager.getCurrentSession();
      const messages = session?.messages.filter(m => m.role === 'user') || [];
      
      expect(messages[0].metadata?.tokens).toBeLessThan(messages[1].metadata?.tokens);
    });

    it('應該能夠更新會話統計', async () => {
      const sessionId = await memoryManager.startNewSession(ConversationType.CHAT);
      
      await memoryManager.addMessage('user', '第一條消息');
      await memoryManager.addMessage('assistant', '第一條回復');
      await memoryManager.addMessage('user', '第二條消息');

      const session = memoryManager.getCurrentSession();
      expect(session?.metadata.totalMessages).toBe(4); // 包括系統消息
      expect(session?.metadata.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('錯誤處理', () => {
    it('應該能夠處理無效的會話 ID', async () => {
      const result = await memoryManager.resumeSession('invalid-session-id');
      expect(result).toBe(false);
    });

    it('應該能夠處理空的搜索查詢', async () => {
      const results = await memoryManager.searchConversations('');
      expect(Array.isArray(results)).toBe(true);
    });

    it('應該能夠處理添加消息到不存在的會話', async () => {
      // 這應該不會拋出錯誤，而是優雅地處理
      await expect(memoryManager.addMessage(
        'user',
        '測試消息',
        undefined,
        'non-existent-session'
      )).resolves.not.toThrow();
    });
  });

  describe('性能測試', () => {
    it('應該能夠處理大量消息', async () => {
      const sessionId = await memoryManager.startNewSession(ConversationType.CHAT);
      
      const startTime = Date.now();
      
      // 添加大量消息
      for (let i = 0; i < 100; i++) {
        await memoryManager.addMessage('user', `測試消息 ${i}`);
        await memoryManager.addMessage('assistant', `回復消息 ${i}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 應該在合理時間內完成（比如 5 秒）
      expect(duration).toBeLessThan(5000);
      
      const session = memoryManager.getCurrentSession();
      expect(session?.messages.length).toBe(201); // 200 + 1 系統消息
    });

    it('應該能夠維護上下文窗口大小', async () => {
      const sessionId = await memoryManager.startNewSession(ConversationType.CHAT);
      
      // 添加超過上下文窗口大小的消息
      for (let i = 0; i < 60; i++) {
        await memoryManager.addMessage('user', `消息 ${i}`);
      }
      
      const session = memoryManager.getCurrentSession();
      // 應該維持在上下文窗口大小內（50 條消息）
      expect(session?.messages.length).toBeLessThanOrEqual(50);
    });
  });

  describe('會話生命週期', () => {
    it('應該能夠正確追蹤會話時間', async () => {
      const startTime = new Date();
      const sessionId = await memoryManager.startNewSession(ConversationType.CHAT);
      
      // 等待一小段時間
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await memoryManager.addMessage('user', '測試消息');
      
      const session = memoryManager.getCurrentSession();
      expect(session?.startTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(session?.lastActivity.getTime()).toBeGreaterThan(session?.startTime.getTime());
    });

    it('應該能夠自動清理過多的活躍會話', async () => {
      // 創建超過最大限制的會話
      const sessionIds: string[] = [];
      
      for (let i = 0; i < 7; i++) { // 超過默認的 5 個最大活躍會話
        const sessionId = await memoryManager.startNewSession(ConversationType.CHAT, `會話 ${i}`);
        sessionIds.push(sessionId);
      }
      
      // 檢查是否有會話被自動移動到歷史記錄
      const history = memoryManager.getSessionHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });
});
