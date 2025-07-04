import * as vscode from 'vscode';
import { CodeCompletionItem, CompletionType } from './CodeCompletionEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 代碼片段定義
 */
export interface SnippetDefinition {
  id: string;
  name: string;
  prefix: string;
  body: string | string[];
  description: string;
  scope: string[];
  category: string;
  tags: string[];
  author?: string;
  version?: string;
  insertText: vscode.SnippetString;
  documentation?: vscode.MarkdownString;
  when?: string; // 條件表達式
}

/**
 * 代碼片段類別
 */
export enum SnippetCategory {
  LANGUAGE = 'language',
  FRAMEWORK = 'framework',
  LIBRARY = 'library',
  PATTERN = 'pattern',
  TEMPLATE = 'template',
  USER = 'user',
  TEAM = 'team',
  CUSTOM = 'custom'
}

/**
 * 代碼片段管理器
 * 管理和提供各種代碼片段
 */
export class SnippetManager {
  private static instance: SnippetManager;
  private snippets: Map<string, SnippetDefinition[]> = new Map();
  private userSnippets: Map<string, SnippetDefinition[]> = new Map();
  private snippetUsage: Map<string, number> = new Map();

  private constructor() {
    this.loadBuiltinSnippets();
    this.loadUserSnippets();
  }

  static getInstance(): SnippetManager {
    if (!SnippetManager.instance) {
      SnippetManager.instance = new SnippetManager();
    }
    return SnippetManager.instance;
  }

  /**
   * 獲取語言特定的代碼片段
   */
  getLanguageSnippets(language: string, prefix?: string): SnippetDefinition[] {
    const languageSnippets = this.snippets.get(language) || [];
    const userLanguageSnippets = this.userSnippets.get(language) || [];

    const allSnippets = [...languageSnippets, ...userLanguageSnippets];

    if (prefix) {
      return allSnippets.filter(snippet =>
        snippet.prefix.toLowerCase().startsWith(prefix.toLowerCase()) ||
        snippet.name.toLowerCase().includes(prefix.toLowerCase())
      );
    }

    return allSnippets;
  }

  /**
   * 獲取框架特定的代碼片段
   */
  getFrameworkSnippets(framework: string, language: string, prefix?: string): SnippetDefinition[] {
    const frameworkKey = `${language}-${framework}`;
    const frameworkSnippets = this.snippets.get(frameworkKey) || [];

    if (prefix) {
      return frameworkSnippets.filter(snippet =>
        snippet.prefix.toLowerCase().startsWith(prefix.toLowerCase())
      );
    }

    return frameworkSnippets;
  }

  /**
   * 搜索代碼片段
   */
  searchSnippets(query: string, language?: string): SnippetDefinition[] {
    const results: SnippetDefinition[] = [];
    const queryLower = query.toLowerCase();

    const searchInSnippets = (snippets: SnippetDefinition[]) => {
      for (const snippet of snippets) {
        if (
          snippet.name.toLowerCase().includes(queryLower) ||
          snippet.prefix.toLowerCase().includes(queryLower) ||
          snippet.description.toLowerCase().includes(queryLower) ||
          snippet.tags.some(tag => tag.toLowerCase().includes(queryLower))
        ) {
          results.push(snippet);
        }
      }
    };

    if (language) {
      const languageSnippets = this.snippets.get(language) || [];
      const userLanguageSnippets = this.userSnippets.get(language) || [];
      searchInSnippets([...languageSnippets, ...userLanguageSnippets]);
    } else {
      // 搜索所有語言的代碼片段
      for (const snippets of this.snippets.values()) {
        searchInSnippets(snippets);
      }
      for (const snippets of this.userSnippets.values()) {
        searchInSnippets(snippets);
      }
    }

    // 按使用頻率和相關性排序
    return results.sort((a, b) => {
      const aUsage = this.snippetUsage.get(a.id) || 0;
      const bUsage = this.snippetUsage.get(b.id) || 0;

      if (aUsage !== bUsage) {
        return bUsage - aUsage;
      }

      // 按前綴匹配度排序
      const aExactMatch = a.prefix.toLowerCase() === queryLower;
      const bExactMatch = b.prefix.toLowerCase() === queryLower;

      if (aExactMatch && !bExactMatch) {return -1;}
      if (!aExactMatch && bExactMatch) {return 1;}

      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 添加用戶自定義代碼片段
   */
  async addUserSnippet(snippet: Omit<SnippetDefinition, 'id' | 'insertText'>): Promise<string> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const id = this.generateSnippetId();
        const insertText = new vscode.SnippetString(
          Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body
        );

        const fullSnippet: SnippetDefinition = {
          ...snippet,
          id,
          insertText,
          category: SnippetCategory.USER
        };

        // 添加到用戶代碼片段
        for (const scope of snippet.scope) {
          if (!this.userSnippets.has(scope)) {
            this.userSnippets.set(scope, []);
          }
          this.userSnippets.get(scope)!.push(fullSnippet);
        }

        // 保存到用戶設置
        await this.saveUserSnippets();

        return id;
      },
      '添加用戶代碼片段',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : '');
  }

  /**
   * 移除用戶代碼片段
   */
  async removeUserSnippet(snippetId: string): Promise<boolean> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let removed = false;

        for (const [language, snippets] of this.userSnippets.entries()) {
          const index = snippets.findIndex(s => s.id === snippetId);
          if (index !== -1) {
            snippets.splice(index, 1);
            removed = true;
          }
        }

        if (removed) {
          await this.saveUserSnippets();
        }

        return removed;
      },
      '移除用戶代碼片段',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : false);
  }

  /**
   * 記錄代碼片段使用
   */
  recordSnippetUsage(snippetId: string): void {
    const currentUsage = this.snippetUsage.get(snippetId) || 0;
    this.snippetUsage.set(snippetId, currentUsage + 1);
  }

  /**
   * 獲取熱門代碼片段
   */
  getPopularSnippets(language?: string, limit: number = 10): SnippetDefinition[] {
    const allSnippets: SnippetDefinition[] = [];

    if (language) {
      const languageSnippets = this.snippets.get(language) || [];
      const userLanguageSnippets = this.userSnippets.get(language) || [];
      allSnippets.push(...languageSnippets, ...userLanguageSnippets);
    } else {
      for (const snippets of this.snippets.values()) {
        allSnippets.push(...snippets);
      }
      for (const snippets of this.userSnippets.values()) {
        allSnippets.push(...snippets);
      }
    }

    return allSnippets
      .sort((a, b) => {
        const aUsage = this.snippetUsage.get(a.id) || 0;
        const bUsage = this.snippetUsage.get(b.id) || 0;
        return bUsage - aUsage;
      })
      .slice(0, limit);
  }

  /**
   * 轉換為完成項目
   */
  convertToCompletionItems(snippets: SnippetDefinition[]): CodeCompletionItem[] {
    return snippets.map(snippet => ({
      id: snippet.id,
      label: snippet.prefix,
      detail: snippet.name,
      documentation: snippet.documentation || new vscode.MarkdownString(snippet.description),
      insertText: snippet.insertText,
      kind: vscode.CompletionItemKind.Snippet,
      type: CompletionType.SNIPPET,
      priority: this.calculateSnippetPriority(snippet),
      confidence: 0.8,
      source: snippet.category === SnippetCategory.USER ? 'learned' : 'builtin',
      metadata: {
        language: snippet.scope[0] || 'unknown',
        framework: snippet.category === SnippetCategory.FRAMEWORK ? snippet.name : undefined,
        context: snippet.tags,
        usage: this.snippetUsage.get(snippet.id) || 0,
        lastUsed: new Date(),
        userPreference: 0
      },
      filterText: `${snippet.prefix} ${snippet.name}`,
      sortText: this.generateSnippetSortText(snippet),
      commitCharacters: ['\t', ' ']
    }));
  }

  /**
   * 私有方法
   */
  private loadBuiltinSnippets(): void {
    // JavaScript/TypeScript 代碼片段
    this.loadJavaScriptSnippets();

    // Python 代碼片段
    this.loadPythonSnippets();

    // React 代碼片段
    this.loadReactSnippets();

    // Vue 代碼片段
    this.loadVueSnippets();

    // Node.js 代碼片段
    this.loadNodeSnippets();
  }

  private loadJavaScriptSnippets(): void {
    const jsSnippets: SnippetDefinition[] = [
      {
        id: 'js-function',
        name: 'Function Declaration',
        prefix: 'func',
        body: [
          'function ${1:functionName}(${2:parameters}) {',
          '\t${3:// function body}',
          '}'
        ],
        description: '創建函數聲明',
        scope: ['javascript', 'typescript'],
        category: SnippetCategory.LANGUAGE,
        tags: ['function', 'declaration'],
        insertText: new vscode.SnippetString([
          'function ${1:functionName}(${2:parameters}) {',
          '\t${3:// function body}',
          '}'
        ].join('\n'))
      },
      {
        id: 'js-arrow-function',
        name: 'Arrow Function',
        prefix: 'arrow',
        body: [
          'const ${1:functionName} = (${2:parameters}) => {',
          '\t${3:// function body}',
          '};'
        ],
        description: '創建箭頭函數',
        scope: ['javascript', 'typescript'],
        category: SnippetCategory.LANGUAGE,
        tags: ['function', 'arrow', 'es6'],
        insertText: new vscode.SnippetString([
          'const ${1:functionName} = (${2:parameters}) => {',
          '\t${3:// function body}',
          '};'
        ].join('\n'))
      },
      {
        id: 'js-class',
        name: 'Class Declaration',
        prefix: 'class',
        body: [
          'class ${1:ClassName} {',
          '\tconstructor(${2:parameters}) {',
          '\t\t${3:// constructor body}',
          '\t}',
          '',
          '\t${4:// class methods}',
          '}'
        ],
        description: '創建類聲明',
        scope: ['javascript', 'typescript'],
        category: SnippetCategory.LANGUAGE,
        tags: ['class', 'oop'],
        insertText: new vscode.SnippetString([
          'class ${1:ClassName} {',
          '\tconstructor(${2:parameters}) {',
          '\t\t${3:// constructor body}',
          '\t}',
          '',
          '\t${4:// class methods}',
          '}'
        ].join('\n'))
      },
      {
        id: 'js-try-catch',
        name: 'Try-Catch Block',
        prefix: 'try',
        body: [
          'try {',
          '\t${1:// try block}',
          '} catch (${2:error}) {',
          '\t${3:// error handling}',
          '}'
        ],
        description: '創建 try-catch 錯誤處理塊',
        scope: ['javascript', 'typescript'],
        category: SnippetCategory.LANGUAGE,
        tags: ['error', 'handling', 'try', 'catch'],
        insertText: new vscode.SnippetString([
          'try {',
          '\t${1:// try block}',
          '} catch (${2:error}) {',
          '\t${3:// error handling}',
          '}'
        ].join('\n'))
      }
    ];

    this.snippets.set('javascript', jsSnippets);
    this.snippets.set('typescript', jsSnippets);
  }

  private loadPythonSnippets(): void {
    const pythonSnippets: SnippetDefinition[] = [
      {
        id: 'py-function',
        name: 'Function Definition',
        prefix: 'def',
        body: [
          'def ${1:function_name}(${2:parameters}):',
          '\t"""${3:Function description}"""',
          '\t${4:pass}'
        ],
        description: '創建 Python 函數定義',
        scope: ['python'],
        category: SnippetCategory.LANGUAGE,
        tags: ['function', 'def'],
        insertText: new vscode.SnippetString([
          'def ${1:function_name}(${2:parameters}):',
          '\t"""${3:Function description}"""',
          '\t${4:pass}'
        ].join('\n'))
      },
      {
        id: 'py-class',
        name: 'Class Definition',
        prefix: 'class',
        body: [
          'class ${1:ClassName}:',
          '\t"""${2:Class description}"""',
          '\t',
          '\tdef __init__(self${3:, parameters}):',
          '\t\t"""${4:Constructor description}"""',
          '\t\t${5:pass}'
        ],
        description: '創建 Python 類定義',
        scope: ['python'],
        category: SnippetCategory.LANGUAGE,
        tags: ['class', 'oop'],
        insertText: new vscode.SnippetString([
          'class ${1:ClassName}:',
          '\t"""${2:Class description}"""',
          '\t',
          '\tdef __init__(self${3:, parameters}):',
          '\t\t"""${4:Constructor description}"""',
          '\t\t${5:pass}'
        ].join('\n'))
      }
    ];

    this.snippets.set('python', pythonSnippets);
  }

  private loadReactSnippets(): void {
    const reactSnippets: SnippetDefinition[] = [
      {
        id: 'react-component',
        name: 'React Functional Component',
        prefix: 'rfc',
        body: [
          'import React from \'react\';',
          '',
          'interface ${1:ComponentName}Props {',
          '\t${2:// props definition}',
          '}',
          '',
          'const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = (${3:props}) => {',
          '\treturn (',
          '\t\t<div>',
          '\t\t\t${4:// component content}',
          '\t\t</div>',
          '\t);',
          '};',
          '',
          'export default ${1:ComponentName};'
        ],
        description: '創建 React 函數組件',
        scope: ['typescript', 'javascript'],
        category: SnippetCategory.FRAMEWORK,
        tags: ['react', 'component', 'functional'],
        insertText: new vscode.SnippetString([
          'import React from \'react\';',
          '',
          'interface ${1:ComponentName}Props {',
          '\t${2:// props definition}',
          '}',
          '',
          'const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = (${3:props}) => {',
          '\treturn (',
          '\t\t<div>',
          '\t\t\t${4:// component content}',
          '\t\t</div>',
          '\t);',
          '};',
          '',
          'export default ${1:ComponentName};'
        ].join('\n'))
      }
    ];

    this.snippets.set('typescript-react', reactSnippets);
    this.snippets.set('javascript-react', reactSnippets);
  }

  private loadVueSnippets(): void {
    // Vue 代碼片段實現
  }

  private loadNodeSnippets(): void {
    // Node.js 代碼片段實現
  }

  private async loadUserSnippets(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('devika.completion.snippets');
      const userSnippetsData = config.get('user', {});

      // 解析用戶代碼片段數據
      for (const [language, snippets] of Object.entries(userSnippetsData as Record<string, any[]>)) {
        const parsedSnippets = snippets.map(snippet => ({
          ...snippet,
          insertText: new vscode.SnippetString(
            Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body
          )
        }));
        this.userSnippets.set(language, parsedSnippets);
      }
    } catch (error) {
      console.warn('載入用戶代碼片段失敗:', error);
    }
  }

  private async saveUserSnippets(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('devika.completion.snippets');
      const userSnippetsData: Record<string, any[]> = {};

      for (const [language, snippets] of this.userSnippets.entries()) {
        userSnippetsData[language] = snippets.map(snippet => ({
          id: snippet.id,
          name: snippet.name,
          prefix: snippet.prefix,
          body: snippet.body,
          description: snippet.description,
          scope: snippet.scope,
          category: snippet.category,
          tags: snippet.tags
        }));
      }

      await config.update('user', userSnippetsData, vscode.ConfigurationTarget.Global);
    } catch (error) {
      console.error('保存用戶代碼片段失敗:', error);
    }
  }

  private generateSnippetId(): string {
    return `snippet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateSnippetPriority(snippet: SnippetDefinition): number {
    const usage = this.snippetUsage.get(snippet.id) || 0;
    const baseScore = snippet.category === SnippetCategory.USER ? 80 : 60;
    const usageScore = Math.min(usage * 5, 20);
    return baseScore + usageScore;
  }

  private generateSnippetSortText(snippet: SnippetDefinition): string {
    const priority = this.calculateSnippetPriority(snippet);
    return `${String(1000 - priority).padStart(4, '0')}-${snippet.prefix}`;
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.snippets.clear();
    this.userSnippets.clear();
    this.snippetUsage.clear();
  }
}
