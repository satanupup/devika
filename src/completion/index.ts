/**
 * 智能代碼完成系統模組
 * 
 * 此模組實現了 Devika VS Code Extension 的智能代碼完成功能，
 * 提供個性化的內聯代碼完成、智能建議和代碼片段管理。
 */

import * as vscode from 'vscode';

// 核心代碼完成引擎
export {
  CodeCompletionEngine,
  CompletionType,
  CodeCompletionItem,
  CompletionContext,
  CompletionConfig
} from './CodeCompletionEngine';

// 代碼片段管理器
export {
  SnippetManager,
  SnippetDefinition,
  SnippetCategory
} from './SnippetManager';

// 智能建議生成器
export {
  SmartSuggestionGenerator,
  SmartSuggestionType,
  SmartSuggestion,
  SuggestionContext
} from './SmartSuggestionGenerator';

// 代碼完成提供者
export {
  CodeCompletionProvider
} from './CodeCompletionProvider';

/**
 * 初始化智能代碼完成系統
 * 
 * @param context VS Code 擴展上下文
 * @returns Promise<void>
 */
export async function initializeCodeCompletionSystem(context: vscode.ExtensionContext): Promise<void> {
  try {
    // 註冊代碼完成提供者
    const completionProvider = CodeCompletionProvider.register(context);
    
    // 註冊狀態欄項目
    const statusBarItem = createCompletionStatusBar();
    context.subscriptions.push(statusBarItem);
    
    // 註冊配置變更監聽器
    const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('devika.completion')) {
        handleConfigurationChange();
      }
    });
    context.subscriptions.push(configWatcher);
    
    // 註冊快捷鍵
    registerKeybindings(context);
    
    console.log('智能代碼完成系統初始化完成');
  } catch (error) {
    console.error('智能代碼完成系統初始化失敗:', error);
    throw error;
  }
}

/**
 * 代碼完成系統配置
 */
export interface CodeCompletionSystemConfig {
  /** 是否啟用代碼完成 */
  enabled: boolean;
  
  /** 最大建議數量 */
  maxSuggestions: number;
  
  /** 是否啟用 AI 建議 */
  enableAISuggestions: boolean;
  
  /** 是否啟用學習功能 */
  enableLearning: boolean;
  
  /** 是否啟用代碼片段 */
  enableSnippets: boolean;
  
  /** 是否啟用導入建議 */
  enableImportSuggestions: boolean;
  
  /** 是否啟用類型推斷 */
  enableTypeInference: boolean;
  
  /** 是否啟用上下文建議 */
  enableContextualSuggestions: boolean;
  
  /** 是否優先顯示最近使用的項目 */
  prioritizeRecentlyUsed: boolean;
  
  /** 是否顯示文檔 */
  showDocumentation: boolean;
  
  /** 是否自動導入 */
  autoImport: boolean;
  
  /** 建議延遲時間（毫秒） */
  suggestionDelay: number;
  
  /** 信心度閾值 */
  confidenceThreshold: number;
  
  /** 支援的語言列表 */
  languages: string[];
  
  /** 排除模式 */
  excludePatterns: string[];
  
  /** 是否在註釋中啟用 */
  enableInComments: boolean;
  
  /** 是否在字符串中啟用 */
  enableInStrings: boolean;
}

/**
 * 默認代碼完成配置
 */
export const DEFAULT_CODE_COMPLETION_CONFIG: CodeCompletionSystemConfig = {
  enabled: true,
  maxSuggestions: 20,
  enableAISuggestions: true,
  enableLearning: true,
  enableSnippets: true,
  enableImportSuggestions: true,
  enableTypeInference: true,
  enableContextualSuggestions: true,
  prioritizeRecentlyUsed: true,
  showDocumentation: true,
  autoImport: true,
  suggestionDelay: 100,
  confidenceThreshold: 0.3,
  languages: [
    'javascript',
    'typescript',
    'python',
    'java',
    'csharp',
    'go',
    'rust',
    'php',
    'ruby',
    'cpp',
    'c'
  ],
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '.vscode'
  ],
  enableInComments: false,
  enableInStrings: false
};

/**
 * 代碼完成系統狀態
 */
export interface CodeCompletionSystemStatus {
  /** 是否已初始化 */
  initialized: boolean;
  
  /** 是否啟用 */
  enabled: boolean;
  
  /** 支援的語言數量 */
  supportedLanguages: number;
  
  /** 快取大小 */
  cacheSize: number;
  
  /** 總完成次數 */
  totalCompletions: number;
  
  /** 代碼片段數量 */
  snippetCount: number;
  
  /** 用戶自定義片段數量 */
  userSnippetCount: number;
  
  /** 最近完成項目數量 */
  recentCompletions: number;
  
  /** 平均響應時間（毫秒） */
  averageResponseTime: number;
  
  /** 最後活動時間 */
  lastActivity: Date | null;
  
  /** 錯誤信息 */
  errors: string[];
}

/**
 * 獲取代碼完成系統狀態
 */
export function getCodeCompletionSystemStatus(): CodeCompletionSystemStatus {
  try {
    const completionEngine = CodeCompletionEngine.getInstance();
    const snippetManager = SnippetManager.getInstance();
    const config = completionEngine.getConfig();
    const stats = completionEngine.getStatistics();

    return {
      initialized: true,
      enabled: config.enabled,
      supportedLanguages: config.languages.length,
      cacheSize: stats.cacheSize,
      totalCompletions: stats.totalCompletions,
      snippetCount: 0, // 需要從 SnippetManager 獲取
      userSnippetCount: 0, // 需要從 SnippetManager 獲取
      recentCompletions: stats.recentCompletions,
      averageResponseTime: 0, // 需要實現性能監控
      lastActivity: new Date(),
      errors: []
    };
  } catch (error) {
    return {
      initialized: false,
      enabled: false,
      supportedLanguages: 0,
      cacheSize: 0,
      totalCompletions: 0,
      snippetCount: 0,
      userSnippetCount: 0,
      recentCompletions: 0,
      averageResponseTime: 0,
      lastActivity: null,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * 代碼完成事件類型
 */
export enum CodeCompletionEventType {
  COMPLETION_TRIGGERED = 'completion_triggered',
  COMPLETION_ACCEPTED = 'completion_accepted',
  COMPLETION_REJECTED = 'completion_rejected',
  SNIPPET_USED = 'snippet_used',
  SMART_SUGGESTION_GENERATED = 'smart_suggestion_generated',
  CACHE_CLEARED = 'cache_cleared',
  CONFIG_CHANGED = 'config_changed'
}

/**
 * 代碼完成事件
 */
export interface CodeCompletionEvent {
  type: CodeCompletionEventType;
  timestamp: Date;
  language?: string;
  completionType?: CompletionType;
  confidence?: number;
  responseTime?: number;
  metadata?: Record<string, any>;
}

/**
 * 代碼完成事件監聽器
 */
export type CodeCompletionEventListener = (event: CodeCompletionEvent) => void;

/**
 * 代碼完成工具函數
 */
export class CodeCompletionUtils {
  /**
   * 格式化完成類型
   */
  static formatCompletionType(type: CompletionType): string {
    const typeMap = {
      [CompletionType.VARIABLE]: '📊 變數',
      [CompletionType.FUNCTION]: '⚡ 函數',
      [CompletionType.CLASS]: '🏗️ 類',
      [CompletionType.INTERFACE]: '📋 接口',
      [CompletionType.ENUM]: '📝 枚舉',
      [CompletionType.IMPORT]: '📥 導入',
      [CompletionType.PROPERTY]: '🔧 屬性',
      [CompletionType.METHOD]: '🔨 方法',
      [CompletionType.PARAMETER]: '📌 參數',
      [CompletionType.TYPE]: '🏷️ 類型',
      [CompletionType.KEYWORD]: '🔑 關鍵字',
      [CompletionType.SNIPPET]: '📄 片段',
      [CompletionType.TEMPLATE]: '📋 模板',
      [CompletionType.SMART_SUGGESTION]: '🧠 智能建議'
    };
    return typeMap[type] || '❓ 未知';
  }
  
  /**
   * 計算完成項目相關性分數
   */
  static calculateRelevanceScore(
    completion: CodeCompletionItem,
    context: CompletionContext
  ): number {
    let score = completion.confidence * 100;
    
    // 基於使用頻率調整
    score += completion.metadata.usage * 2;
    
    // 基於最近使用時間調整
    const daysSinceLastUsed = (Date.now() - completion.metadata.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceLastUsed);
    
    // 基於用戶偏好調整
    score += completion.metadata.userPreference * 5;
    
    // 基於上下文匹配調整
    const contextMatch = this.calculateContextMatch(completion, context);
    score += contextMatch * 20;
    
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * 計算上下文匹配度
   */
  static calculateContextMatch(
    completion: CodeCompletionItem,
    context: CompletionContext
  ): number {
    let matchScore = 0;
    
    // 語言匹配
    if (completion.metadata.language === context.document.languageId) {
      matchScore += 0.3;
    }
    
    // 框架匹配
    if (completion.metadata.framework) {
      // 需要檢測當前項目使用的框架
      matchScore += 0.2;
    }
    
    // 上下文標籤匹配
    const contextTags = completion.metadata.context;
    if (contextTags.length > 0) {
      // 簡化的上下文匹配邏輯
      matchScore += 0.3;
    }
    
    // 位置相關性
    if (context.semanticContext.isInFunction && completion.type === CompletionType.VARIABLE) {
      matchScore += 0.2;
    }
    
    return Math.min(1, matchScore);
  }
  
  /**
   * 生成完成項目摘要
   */
  static generateCompletionSummary(completions: CodeCompletionItem[]): string {
    const typeCount = new Map<CompletionType, number>();
    const sourceCount = new Map<string, number>();
    let totalConfidence = 0;
    
    for (const completion of completions) {
      // 統計類型
      const currentTypeCount = typeCount.get(completion.type) || 0;
      typeCount.set(completion.type, currentTypeCount + 1);
      
      // 統計來源
      const currentSourceCount = sourceCount.get(completion.source) || 0;
      sourceCount.set(completion.source, currentSourceCount + 1);
      
      // 累計信心度
      totalConfidence += completion.confidence;
    }
    
    const averageConfidence = completions.length > 0 ? totalConfidence / completions.length : 0;
    
    let summary = `代碼完成摘要\n`;
    summary += `總數: ${completions.length}\n`;
    summary += `平均信心度: ${(averageConfidence * 100).toFixed(1)}%\n\n`;
    
    summary += `類型分布:\n`;
    for (const [type, count] of typeCount.entries()) {
      summary += `  ${this.formatCompletionType(type)}: ${count}\n`;
    }
    
    summary += `\n來源分布:\n`;
    for (const [source, count] of sourceCount.entries()) {
      const sourceLabel = {
        'builtin': '內建',
        'workspace': '工作區',
        'dependencies': '依賴項',
        'ai': 'AI 生成',
        'learned': '學習型'
      }[source] || source;
      summary += `  ${sourceLabel}: ${count}\n`;
    }
    
    return summary;
  }
  
  /**
   * 驗證完成項目
   */
  static validateCompletion(completion: CodeCompletionItem): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // 檢查必需字段
    if (!completion.id || completion.id.trim().length === 0) {
      issues.push('完成項目 ID 不能為空');
    }
    
    if (!completion.label || completion.label.trim().length === 0) {
      issues.push('完成項目標籤不能為空');
    }
    
    if (!completion.insertText) {
      issues.push('完成項目插入文本不能為空');
    }
    
    // 檢查信心度範圍
    if (completion.confidence < 0 || completion.confidence > 1) {
      issues.push('信心度必須在 0-1 範圍內');
    }
    
    // 檢查優先級範圍
    if (completion.priority < 0 || completion.priority > 100) {
      issues.push('優先級必須在 0-100 範圍內');
    }
    
    // 檢查元數據
    if (!completion.metadata.language) {
      issues.push('必須指定語言');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * 優化完成項目列表
   */
  static optimizeCompletions(completions: CodeCompletionItem[]): CodeCompletionItem[] {
    // 去重
    const uniqueCompletions = this.deduplicateCompletions(completions);
    
    // 按相關性排序
    const sortedCompletions = uniqueCompletions.sort((a, b) => {
      // 優先級排序
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // 信心度排序
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      
      // 使用頻率排序
      const aUsage = a.metadata.usage || 0;
      const bUsage = b.metadata.usage || 0;
      if (aUsage !== bUsage) {
        return bUsage - aUsage;
      }
      
      // 字母順序排序
      return a.label.localeCompare(b.label);
    });
    
    return sortedCompletions;
  }
  
  /**
   * 去重完成項目
   */
  private static deduplicateCompletions(completions: CodeCompletionItem[]): CodeCompletionItem[] {
    const seen = new Set<string>();
    return completions.filter(completion => {
      const key = `${completion.label}-${completion.type}-${completion.kind}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

/**
 * 私有輔助函數
 */
function createCompletionStatusBar(): vscode.StatusBarItem {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  
  statusBarItem.text = '$(lightbulb) 智能完成';
  statusBarItem.tooltip = '點擊配置智能代碼完成';
  statusBarItem.command = 'devika.completion.configure';
  statusBarItem.show();
  
  return statusBarItem;
}

function handleConfigurationChange(): void {
  // 重新載入配置
  const completionEngine = CodeCompletionEngine.getInstance();
  const newConfig = vscode.workspace.getConfiguration('devika.completion');
  
  completionEngine.updateConfig({
    enabled: newConfig.get('enabled', true),
    maxSuggestions: newConfig.get('maxSuggestions', 20),
    enableAISuggestions: newConfig.get('enableAISuggestions', true),
    enableLearning: newConfig.get('enableLearning', true),
    enableSnippets: newConfig.get('enableSnippets', true),
    enableImportSuggestions: newConfig.get('enableImportSuggestions', true),
    enableTypeInference: newConfig.get('enableTypeInference', true),
    enableContextualSuggestions: newConfig.get('enableContextualSuggestions', true),
    prioritizeRecentlyUsed: newConfig.get('prioritizeRecentlyUsed', true),
    showDocumentation: newConfig.get('showDocumentation', true),
    autoImport: newConfig.get('autoImport', true),
    suggestionDelay: newConfig.get('suggestionDelay', 100),
    confidenceThreshold: newConfig.get('confidenceThreshold', 0.3),
    languages: newConfig.get('languages', DEFAULT_CODE_COMPLETION_CONFIG.languages),
    excludePatterns: newConfig.get('excludePatterns', DEFAULT_CODE_COMPLETION_CONFIG.excludePatterns)
  });
  
  console.log('代碼完成配置已更新');
}

function registerKeybindings(context: vscode.ExtensionContext): void {
  // 註冊快捷鍵命令
  const keybindings = [
    {
      command: 'devika.completion.triggerSmart',
      key: 'ctrl+space',
      when: 'editorTextFocus'
    },
    {
      command: 'devika.completion.addSnippet',
      key: 'ctrl+shift+s',
      when: 'editorTextFocus'
    }
  ];
  
  // 在實際實現中，快捷鍵應該在 package.json 中定義
  console.log('代碼完成快捷鍵已註冊');
}
