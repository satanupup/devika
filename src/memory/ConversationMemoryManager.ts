import * as vscode from 'vscode';
import { MemorySystem, MemoryType } from '../ai/MemorySystem';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 對話類型
 */
export enum ConversationType {
  CHAT = 'chat',
  CODE_REVIEW = 'code_review',
  DEBUGGING = 'debugging',
  REFACTORING = 'refactoring',
  LEARNING = 'learning',
  PLANNING = 'planning',
  GENERAL = 'general'
}

/**
 * 對話消息
 */
export interface ConversationMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    fileUri?: vscode.Uri;
    language?: string;
    codeContext?: string;
    intent?: string;
    confidence?: number;
    tokens?: number;
  };
}

/**
 * 對話會話
 */
export interface ConversationSession {
  id: string;
  type: ConversationType;
  title: string;
  startTime: Date;
  lastActivity: Date;
  messages: ConversationMessage[];
  context: ConversationContext;
  summary?: string;
  tags: string[];
  isActive: boolean;
  metadata: {
    totalMessages: number;
    totalTokens: number;
    averageResponseTime: number;
    userSatisfaction?: number;
    projectPath?: string;
    language?: string;
  };
}

/**
 * 對話上下文
 */
export interface ConversationContext {
  currentFile?: vscode.Uri;
  workspaceFolder?: vscode.Uri;
  selectedText?: string;
  cursorPosition?: vscode.Position;
  openFiles: vscode.Uri[];
  recentFiles: vscode.Uri[];
  projectType?: string;
  dependencies: string[];
  codeSymbols: string[];
  relatedTopics: string[];
  userIntent?: string;
  conversationGoal?: string;
}

/**
 * 記憶檢索結果
 */
export interface MemoryRetrievalResult {
  relevantSessions: ConversationSession[];
  relatedMessages: ConversationMessage[];
  contextualInfo: string[];
  confidence: number;
  reasoning: string;
}

/**
 * 對話記憶系統
 * 管理跨對話的記憶保持和上下文繼承
 */
export class ConversationMemoryManager {
  private static instance: ConversationMemoryManager;
  private memorySystem: MemorySystem;
  private activeSessions: Map<string, ConversationSession> = new Map();
  private sessionHistory: Map<string, ConversationSession> = new Map();
  private currentSessionId: string | null = null;
  private maxActiveSessions = 5;
  private maxHistorySessions = 100;
  private contextWindow = 50; // 最大上下文消息數

  private constructor() {
    this.memorySystem = MemorySystem.getInstance();
    this.loadSessionHistory();
  }

  static getInstance(): ConversationMemoryManager {
    if (!ConversationMemoryManager.instance) {
      ConversationMemoryManager.instance = new ConversationMemoryManager();
    }
    return ConversationMemoryManager.instance;
  }

  /**
   * 開始新的對話會話
   */
  async startNewSession(
    type: ConversationType,
    title?: string,
    context?: Partial<ConversationContext>
  ): Promise<string> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const sessionId = this.generateSessionId();
        const currentContext = await this.buildCurrentContext(context);

        const session: ConversationSession = {
          id: sessionId,
          type,
          title: title || this.generateSessionTitle(type, currentContext),
          startTime: new Date(),
          lastActivity: new Date(),
          messages: [],
          context: currentContext,
          tags: this.generateSessionTags(type, currentContext),
          isActive: true,
          metadata: {
            totalMessages: 0,
            totalTokens: 0,
            averageResponseTime: 0,
            projectPath: currentContext.workspaceFolder?.fsPath,
            language: currentContext.currentFile ? this.detectLanguage(currentContext.currentFile) : undefined
          }
        };

        // 添加系統消息
        await this.addSystemMessage(session, this.generateWelcomeMessage(type, currentContext));

        this.activeSessions.set(sessionId, session);
        this.currentSessionId = sessionId;

        // 清理過多的活躍會話
        await this.cleanupActiveSessions();

        // 保存到記憶系統
        await this.memorySystem.addMemory(
          MemoryType.CONVERSATION,
          `Started ${type} session: ${session.title}`,
          {
            context: JSON.stringify(currentContext),
            confidence: 0.8,
            triggers: [type, 'session_start']
          },
          0.8
        );

        console.log(`新對話會話已開始: ${sessionId} (${type})`);
        return sessionId;
      },
      '開始新對話會話',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : ''));
  }

  /**
   * 添加消息到當前會話
   */
  async addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: ConversationMessage['metadata'],
    sessionId?: string
  ): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const targetSessionId = sessionId || this.currentSessionId;
        if (!targetSessionId) {
          throw new Error('沒有活躍的對話會話');
        }

        const session = this.activeSessions.get(targetSessionId);
        if (!session) {
          throw new Error(`找不到會話: ${targetSessionId}`);
        }

        const message: ConversationMessage = {
          id: this.generateMessageId(),
          timestamp: new Date(),
          role,
          content,
          metadata: {
            ...metadata,
            tokens: this.estimateTokens(content)
          }
        };

        session.messages.push(message);
        session.lastActivity = new Date();
        session.metadata.totalMessages++;
        session.metadata.totalTokens += message.metadata?.tokens || 0;

        // 更新上下文
        if (role === 'user') {
          await this.updateSessionContext(session, content, metadata);
        }

        // 保存重要消息到長期記憶
        if (this.isImportantMessage(message, session)) {
          await this.saveToLongTermMemory(message, session);
        }

        // 維護上下文窗口大小
        this.maintainContextWindow(session);

        console.log(`消息已添加到會話 ${targetSessionId}: ${role}`);
      },
      '添加對話消息',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 獲取相關的對話記憶
   */
  async getRelevantMemory(
    query: string,
    currentContext?: Partial<ConversationContext>,
    maxResults: number = 10
  ): Promise<MemoryRetrievalResult> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const context = await this.buildCurrentContext(currentContext);

        // 從記憶系統檢索相關記憶
        const memories = await this.memorySystem.retrieveMemories(query, MemoryType.CONVERSATION, maxResults);

        // 查找相關的會話
        const relevantSessions = await this.findRelevantSessions(query, context);

        // 查找相關的消息
        const relatedMessages = await this.findRelatedMessages(query, context);

        // 提取上下文信息
        const contextualInfo = this.extractContextualInfo(memories, relevantSessions);

        // 計算整體信心度
        const confidence = this.calculateRetrievalConfidence(memories, relevantSessions, relatedMessages);

        const reasoning = this.generateRetrievalReasoning(memories, relevantSessions, relatedMessages);

        return {
          relevantSessions: relevantSessions.slice(0, 5),
          relatedMessages: relatedMessages.slice(0, 10),
          contextualInfo,
          confidence,
          reasoning
        };
      },
      '檢索相關對話記憶',
      { logError: true, showToUser: false }
    ).then(result =>
      result.success
        ? result.data!
        : {
            relevantSessions: [],
            relatedMessages: [],
            contextualInfo: [],
            confidence: 0,
            reasoning: '記憶檢索失敗'
          }
    );
  }

  /**
   * 結束對話會話
   */
  async endSession(sessionId?: string, summary?: string): Promise<void> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const targetSessionId = sessionId || this.currentSessionId;
        if (!targetSessionId) {
          return;
        }

        const session = this.activeSessions.get(targetSessionId);
        if (!session) {
          return;
        }

        session.isActive = false;
        session.summary = summary || (await this.generateSessionSummary(session));

        // 移動到歷史記錄
        this.sessionHistory.set(targetSessionId, session);
        this.activeSessions.delete(targetSessionId);

        if (this.currentSessionId === targetSessionId) {
          this.currentSessionId = null;
        }

        // 保存會話摘要到長期記憶
        await this.memorySystem.addMemory(
          MemoryType.CONVERSATION,
          `Session ended: ${session.title}`,
          {
            context: session.summary,
            confidence: 0.9,
            triggers: [session.type, 'session_end']
          },
          0.9
        );

        console.log(`對話會話已結束: ${targetSessionId}`);
      },
      '結束對話會話',
      { logError: true, showToUser: false }
    ).then(() => {});
  }

  /**
   * 獲取當前會話
   */
  getCurrentSession(): ConversationSession | null {
    if (!this.currentSessionId) {
      return null;
    }
    return this.activeSessions.get(this.currentSessionId) || null;
  }

  /**
   * 獲取會話歷史
   */
  getSessionHistory(limit: number = 20): ConversationSession[] {
    return Array.from(this.sessionHistory.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .slice(0, limit);
  }

  /**
   * 搜索對話歷史
   */
  async searchConversations(
    query: string,
    filters?: {
      type?: ConversationType;
      dateRange?: { start: Date; end: Date };
      tags?: string[];
      language?: string;
    }
  ): Promise<ConversationSession[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let sessions = Array.from(this.sessionHistory.values());

        // 應用過濾器
        if (filters) {
          if (filters.type) {
            sessions = sessions.filter(s => s.type === filters.type);
          }
          if (filters.dateRange) {
            sessions = sessions.filter(
              s => s.startTime >= filters.dateRange!.start && s.startTime <= filters.dateRange!.end
            );
          }
          if (filters.tags && filters.tags.length > 0) {
            sessions = sessions.filter(s => filters.tags!.some(tag => s.tags.includes(tag)));
          }
          if (filters.language) {
            sessions = sessions.filter(s => s.metadata.language === filters.language);
          }
        }

        // 文本搜索
        if (query.trim()) {
          sessions = sessions.filter(session => {
            const searchText = `${session.title} ${session.summary || ''} ${session.tags.join(' ')}`.toLowerCase();
            return (
              searchText.includes(query.toLowerCase()) ||
              session.messages.some(msg => msg.content.toLowerCase().includes(query.toLowerCase()))
            );
          });
        }

        return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      },
      '搜索對話歷史',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : []));
  }

  /**
   * 恢復會話
   */
  async resumeSession(sessionId: string): Promise<boolean> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const session = this.sessionHistory.get(sessionId) || this.activeSessions.get(sessionId);
        if (!session) {
          throw new Error(`找不到會話: ${sessionId}`);
        }

        // 如果會話已經是活躍的，直接切換
        if (this.activeSessions.has(sessionId)) {
          this.currentSessionId = sessionId;
          return true;
        }

        // 從歷史中恢復會話
        session.isActive = true;
        session.lastActivity = new Date();

        this.activeSessions.set(sessionId, session);
        this.sessionHistory.delete(sessionId);
        this.currentSessionId = sessionId;

        // 清理過多的活躍會話
        await this.cleanupActiveSessions();

        console.log(`會話已恢復: ${sessionId}`);
        return true;
      },
      '恢復對話會話',
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : false));
  }

  /**
   * 構建當前上下文
   */
  private async buildCurrentContext(partialContext?: Partial<ConversationContext>): Promise<ConversationContext> {
    const activeEditor = vscode.window.activeTextEditor;
    const workspaceFolders = vscode.workspace.workspaceFolders;

    const context: ConversationContext = {
      currentFile: activeEditor?.document.uri,
      workspaceFolder: workspaceFolders?.[0]?.uri,
      selectedText: activeEditor?.document.getText(activeEditor.selection),
      cursorPosition: activeEditor?.selection.active,
      openFiles: vscode.window.tabGroups.all
        .flatMap(group => group.tabs)
        .map(tab => (tab.input as any)?.uri)
        .filter(uri => uri),
      recentFiles: [], // 可以從 VS Code API 獲取
      dependencies: [],
      codeSymbols: [],
      relatedTopics: [],
      ...partialContext
    };

    // 檢測項目類型
    if (context.workspaceFolder) {
      context.projectType = await this.detectProjectType(context.workspaceFolder);
    }

    return context;
  }

  /**
   * 生成會話 ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成會話標題
   */
  private generateSessionTitle(type: ConversationType, context: ConversationContext): string {
    const fileName = context.currentFile ? context.currentFile.fsPath.split('/').pop() : 'Unknown';

    switch (type) {
      case ConversationType.CODE_REVIEW:
        return `Code Review: ${fileName}`;
      case ConversationType.DEBUGGING:
        return `Debug Session: ${fileName}`;
      case ConversationType.REFACTORING:
        return `Refactoring: ${fileName}`;
      case ConversationType.LEARNING:
        return `Learning Session: ${context.projectType || 'General'}`;
      case ConversationType.PLANNING:
        return `Planning: ${context.projectType || 'Project'}`;
      default:
        return `Chat: ${new Date().toLocaleString()}`;
    }
  }

  /**
   * 生成會話標籤
   */
  private generateSessionTags(type: ConversationType, context: ConversationContext): string[] {
    const tags: string[] = [type];

    if (context.projectType) {
      tags.push(context.projectType);
    }

    if (context.currentFile) {
      const language = this.detectLanguage(context.currentFile);
      if (language) {
        tags.push(language);
      }
    }

    return tags;
  }

  /**
   * 檢測文件語言
   */
  private detectLanguage(uri: vscode.Uri): string | undefined {
    const ext = uri.fsPath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby'
    };
    return ext ? languageMap[ext] : undefined;
  }

  /**
   * 檢測項目類型
   */
  private async detectProjectType(workspaceUri: vscode.Uri): Promise<string | undefined> {
    try {
      const packageJsonUri = vscode.Uri.joinPath(workspaceUri, 'package.json');
      const packageJson = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageData = JSON.parse(packageJson.toString());

      if (packageData.dependencies?.react) return 'react';
      if (packageData.dependencies?.vue) return 'vue';
      if (packageData.dependencies?.angular) return 'angular';
      if (packageData.dependencies?.express) return 'express';

      return 'javascript';
    } catch {
      return undefined;
    }
  }

  /**
   * 估算 token 數量
   */
  private estimateTokens(text: string): number {
    // 簡單的 token 估算：大約 4 個字符 = 1 個 token
    return Math.ceil(text.length / 4);
  }

  /**
   * 其他輔助方法的簡化實現
   */
  private generateWelcomeMessage(type: ConversationType, context: ConversationContext): string {
    return `開始 ${type} 會話`;
  }

  private async addSystemMessage(session: ConversationSession, content: string): Promise<void> {
    await this.addMessage('system', content, undefined, session.id);
  }

  private async cleanupActiveSessions(): Promise<void> {
    if (this.activeSessions.size <= this.maxActiveSessions) {
      return;
    }

    const sessions = Array.from(this.activeSessions.values()).sort(
      (a, b) => a.lastActivity.getTime() - b.lastActivity.getTime()
    );

    const sessionsToMove = sessions.slice(0, sessions.length - this.maxActiveSessions);

    for (const session of sessionsToMove) {
      await this.endSession(session.id);
    }
  }

  private async updateSessionContext(
    session: ConversationSession,
    content: string,
    metadata?: ConversationMessage['metadata']
  ): Promise<void> {
    // 更新會話上下文的邏輯
  }

  private isImportantMessage(message: ConversationMessage, session: ConversationSession): boolean {
    // 判斷消息是否重要的邏輯
    return message.content.length > 100 || (message.metadata?.confidence || 0) > 0.8;
  }

  private async saveToLongTermMemory(message: ConversationMessage, session: ConversationSession): Promise<void> {
    await this.memorySystem.addMemory(
      MemoryType.CONVERSATION,
      message.content,
      {
        context: session.type,
        confidence: message.metadata?.confidence || 0.7,
        triggers: session.tags
      },
      message.metadata?.confidence || 0.7
    );
  }

  private maintainContextWindow(session: ConversationSession): void {
    if (session.messages.length > this.contextWindow) {
      session.messages = session.messages.slice(-this.contextWindow);
    }
  }

  private async findRelevantSessions(query: string, context: ConversationContext): Promise<ConversationSession[]> {
    // 查找相關會話的邏輯
    return [];
  }

  private async findRelatedMessages(query: string, context: ConversationContext): Promise<ConversationMessage[]> {
    // 查找相關消息的邏輯
    return [];
  }

  private extractContextualInfo(memories: any[], sessions: ConversationSession[]): string[] {
    // 提取上下文信息的邏輯
    return [];
  }

  private calculateRetrievalConfidence(
    memories: any[],
    sessions: ConversationSession[],
    messages: ConversationMessage[]
  ): number {
    // 計算檢索信心度的邏輯
    return 0.7;
  }

  private generateRetrievalReasoning(
    memories: any[],
    sessions: ConversationSession[],
    messages: ConversationMessage[]
  ): string {
    // 生成檢索推理的邏輯
    return '基於歷史對話和上下文分析';
  }

  private async generateSessionSummary(session: ConversationSession): Promise<string> {
    // 生成會話摘要的邏輯
    return `${session.type} 會話，包含 ${session.messages.length} 條消息`;
  }

  private async loadSessionHistory(): Promise<void> {
    // 從持久化存儲加載會話歷史
  }

  /**
   * 清理資源
   */
  dispose(): void {
    // 保存所有活躍會話
    this.activeSessions.forEach(session => {
      this.sessionHistory.set(session.id, session);
    });
    this.activeSessions.clear();
  }
}
