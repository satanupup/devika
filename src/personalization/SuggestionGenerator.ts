import * as vscode from 'vscode';
import { 
  PersonalizedSuggestion, 
  SuggestionType, 
  SuggestionPriority, 
  SuggestionContext,
  SuggestionAction 
} from './PersonalizationEngine';
import { UserPreference, CodingPattern } from '../learning/LearningEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 建議模板
 */
interface SuggestionTemplate {
  type: SuggestionType;
  priority: SuggestionPriority;
  titleTemplate: string;
  descriptionTemplate: string;
  reasoningTemplate: string;
  conditions: (context: SuggestionContext) => boolean;
  actionGenerator: (context: SuggestionContext) => SuggestionAction[];
  confidenceCalculator: (context: SuggestionContext) => number;
}

/**
 * 代碼分析結果
 */
interface CodeAnalysisResult {
  complexity: number;
  duplicatedCode: string[];
  unusedVariables: string[];
  performanceIssues: string[];
  securityIssues: string[];
  testCoverage: number;
  documentationCoverage: number;
}

/**
 * 建議生成器
 * 實現具體的個性化建議生成邏輯
 */
export class SuggestionGenerator {
  private static instance: SuggestionGenerator;
  private suggestionTemplates: Map<string, SuggestionTemplate> = new Map();

  private constructor() {
    this.initializeSuggestionTemplates();
  }

  static getInstance(): SuggestionGenerator {
    if (!SuggestionGenerator.instance) {
      SuggestionGenerator.instance = new SuggestionGenerator();
    }
    return SuggestionGenerator.instance;
  }

  /**
   * 生成代碼風格建議
   */
  async generateStyleSuggestions(
    preference: UserPreference,
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const suggestions: PersonalizedSuggestion[] = [];
        
        // 基於用戶偏好生成風格建議
        switch (preference.name) {
          case 'arrow_function':
            if (preference.value.preference > 0.7) {
              const suggestion = await this.createArrowFunctionSuggestion(context);
              if (suggestion) suggestions.push(suggestion);
            }
            break;
            
          case 'camelCase':
            if (preference.value.preference > 0.7) {
              const suggestion = await this.createNamingStyleSuggestion(context, 'camelCase');
              if (suggestion) suggestions.push(suggestion);
            }
            break;
            
          case 'async_await':
            if (preference.value.preference > 0.7) {
              const suggestion = await this.createAsyncAwaitSuggestion(context);
              if (suggestion) suggestions.push(suggestion);
            }
            break;
        }

        return suggestions;
      },
      '生成代碼風格建議',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 生成最佳實踐建議
   */
  async generateBestPracticeSuggestions(
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const suggestions: PersonalizedSuggestion[] = [];
        const analysis = await this.analyzeCode(context);

        // 基於代碼分析生成最佳實踐建議
        if (analysis.complexity > 10) {
          const suggestion = await this.createComplexityReductionSuggestion(context, analysis);
          if (suggestion) suggestions.push(suggestion);
        }

        if (analysis.duplicatedCode.length > 0) {
          const suggestion = await this.createDuplicationRemovalSuggestion(context, analysis);
          if (suggestion) suggestions.push(suggestion);
        }

        if (analysis.unusedVariables.length > 0) {
          const suggestion = await this.createUnusedVariablesSuggestion(context, analysis);
          if (suggestion) suggestions.push(suggestion);
        }

        if (analysis.testCoverage < 0.8) {
          const suggestion = await this.createTestCoverageSuggestion(context, analysis);
          if (suggestion) suggestions.push(suggestion);
        }

        if (analysis.documentationCoverage < 0.6) {
          const suggestion = await this.createDocumentationSuggestion(context, analysis);
          if (suggestion) suggestions.push(suggestion);
        }

        return suggestions;
      },
      '生成最佳實踐建議',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 生成性能建議
   */
  async generatePerformanceSuggestions(
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const suggestions: PersonalizedSuggestion[] = [];
        const analysis = await this.analyzeCode(context);

        for (const issue of analysis.performanceIssues) {
          const suggestion = await this.createPerformanceSuggestion(context, issue);
          if (suggestion) suggestions.push(suggestion);
        }

        // 基於語言特定的性能建議
        if (context.language === 'typescript' || context.language === 'javascript') {
          const jsSuggestions = await this.generateJavaScriptPerformanceSuggestions(context);
          suggestions.push(...jsSuggestions);
        }

        return suggestions;
      },
      '生成性能建議',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 生成學習建議
   */
  async generateLearningSuggestions(
    learningArea: string,
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const suggestions: PersonalizedSuggestion[] = [];

        // 基於學習領域生成建議
        switch (learningArea) {
          case 'typescript':
            const tsSuggestions = await this.generateTypeScriptLearningSuggestions(context);
            suggestions.push(...tsSuggestions);
            break;
            
          case 'react':
            const reactSuggestions = await this.generateReactLearningSuggestions(context);
            suggestions.push(...reactSuggestions);
            break;
            
          case 'testing':
            const testSuggestions = await this.generateTestingLearningSuggestions(context);
            suggestions.push(...testSuggestions);
            break;
        }

        return suggestions;
      },
      '生成學習建議',
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 創建箭頭函數建議
   */
  private async createArrowFunctionSuggestion(context: SuggestionContext): Promise<PersonalizedSuggestion | null> {
    const document = await vscode.workspace.openTextDocument(context.fileUri);
    const text = document.getText();
    
    // 檢查是否有傳統函數可以轉換為箭頭函數
    const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{/g;
    const matches = text.match(functionRegex);
    
    if (!matches || matches.length === 0) {
      return null;
    }

    return {
      id: this.generateSuggestionId(),
      type: SuggestionType.CODE_STYLE,
      priority: SuggestionPriority.LOW,
      title: '使用箭頭函數',
      description: `發現 ${matches.length} 個可以轉換為箭頭函數的傳統函數`,
      reasoning: '基於您的編碼偏好，您傾向於使用箭頭函數語法',
      confidence: 0.8,
      actionable: true,
      context,
      actions: [{
        id: 'convert-to-arrow',
        label: '轉換為箭頭函數',
        description: '將傳統函數轉換為箭頭函數語法',
        command: 'devika.refactor.convertToArrowFunction'
      }],
      metadata: {
        learnedFrom: ['user_preference'],
        frequency: 1,
        effectiveness: 0.7,
        lastSeen: new Date()
      }
    };
  }

  /**
   * 創建命名風格建議
   */
  private async createNamingStyleSuggestion(
    context: SuggestionContext,
    style: string
  ): Promise<PersonalizedSuggestion | null> {
    const document = await vscode.workspace.openTextDocument(context.fileUri);
    const text = document.getText();
    
    // 檢查命名風格不一致的變數
    const variableRegex = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const variables = [];
    let match;
    
    while ((match = variableRegex.exec(text)) !== null) {
      variables.push(match[1]);
    }

    const inconsistentVariables = variables.filter(variable => {
      if (style === 'camelCase') {
        return /[_-]/.test(variable) || /^[A-Z]/.test(variable);
      }
      return false;
    });

    if (inconsistentVariables.length === 0) {
      return null;
    }

    return {
      id: this.generateSuggestionId(),
      type: SuggestionType.CODE_STYLE,
      priority: SuggestionPriority.MEDIUM,
      title: `統一命名風格為 ${style}`,
      description: `發現 ${inconsistentVariables.length} 個不符合 ${style} 風格的變數名`,
      reasoning: `基於您的編碼偏好，您傾向於使用 ${style} 命名風格`,
      confidence: 0.75,
      actionable: true,
      context,
      actions: [{
        id: 'fix-naming-style',
        label: '修正命名風格',
        description: `將變數名轉換為 ${style} 風格`,
        command: 'devika.refactor.fixNamingStyle',
        arguments: [style, inconsistentVariables]
      }],
      metadata: {
        learnedFrom: ['user_preference'],
        frequency: 1,
        effectiveness: 0.8,
        lastSeen: new Date()
      }
    };
  }

  /**
   * 創建 async/await 建議
   */
  private async createAsyncAwaitSuggestion(context: SuggestionContext): Promise<PersonalizedSuggestion | null> {
    const document = await vscode.workspace.openTextDocument(context.fileUri);
    const text = document.getText();
    
    // 檢查是否有 Promise.then() 可以轉換為 async/await
    const promiseChainRegex = /\.then\s*\([^)]*\)/g;
    const matches = text.match(promiseChainRegex);
    
    if (!matches || matches.length === 0) {
      return null;
    }

    return {
      id: this.generateSuggestionId(),
      type: SuggestionType.CODE_STYLE,
      priority: SuggestionPriority.MEDIUM,
      title: '使用 async/await 語法',
      description: `發現 ${matches.length} 個可以轉換為 async/await 的 Promise 鏈`,
      reasoning: '基於您的編碼偏好，您傾向於使用 async/await 而不是 Promise 鏈',
      confidence: 0.85,
      actionable: true,
      context,
      actions: [{
        id: 'convert-to-async-await',
        label: '轉換為 async/await',
        description: '將 Promise 鏈轉換為 async/await 語法',
        command: 'devika.refactor.convertToAsyncAwait'
      }],
      metadata: {
        learnedFrom: ['user_preference'],
        frequency: 1,
        effectiveness: 0.9,
        lastSeen: new Date()
      }
    };
  }

  /**
   * 分析代碼
   */
  private async analyzeCode(context: SuggestionContext): Promise<CodeAnalysisResult> {
    const document = await vscode.workspace.openTextDocument(context.fileUri);
    const text = document.getText();
    
    return {
      complexity: this.calculateComplexity(text),
      duplicatedCode: this.findDuplicatedCode(text),
      unusedVariables: this.findUnusedVariables(text),
      performanceIssues: this.findPerformanceIssues(text),
      securityIssues: this.findSecurityIssues(text),
      testCoverage: 0.6, // 簡化實現
      documentationCoverage: 0.4 // 簡化實現
    };
  }

  /**
   * 計算代碼複雜度
   */
  private calculateComplexity(code: string): number {
    const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?'];
    let complexity = 1; // 基礎複雜度
    
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  /**
   * 查找重複代碼
   */
  private findDuplicatedCode(code: string): string[] {
    // 簡化的重複代碼檢測
    const lines = code.split('\n').filter(line => line.trim().length > 10);
    const duplicates: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[i].trim() === lines[j].trim()) {
          duplicates.push(lines[i].trim());
        }
      }
    }
    
    return [...new Set(duplicates)];
  }

  /**
   * 查找未使用的變數
   */
  private findUnusedVariables(code: string): string[] {
    const variableRegex = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(code)) !== null) {
      variables.push(match[1]);
    }
    
    return variables.filter(variable => {
      const usageRegex = new RegExp(`\\b${variable}\\b`, 'g');
      const matches = code.match(usageRegex);
      return matches && matches.length <= 1; // 只有聲明，沒有使用
    });
  }

  /**
   * 查找性能問題
   */
  private findPerformanceIssues(code: string): string[] {
    const issues: string[] = [];
    
    // 檢查常見的性能問題
    if (code.includes('document.getElementById') && code.match(/document\.getElementById/g)!.length > 3) {
      issues.push('頻繁的 DOM 查詢');
    }
    
    if (code.includes('for') && code.includes('innerHTML')) {
      issues.push('在迴圈中修改 DOM');
    }
    
    if (code.includes('JSON.parse') && code.includes('JSON.stringify')) {
      issues.push('不必要的 JSON 序列化/反序列化');
    }
    
    return issues;
  }

  /**
   * 查找安全問題
   */
  private findSecurityIssues(code: string): string[] {
    const issues: string[] = [];
    
    if (code.includes('eval(')) {
      issues.push('使用 eval() 函數');
    }
    
    if (code.includes('innerHTML') && code.includes('+')) {
      issues.push('可能的 XSS 漏洞');
    }
    
    return issues;
  }

  /**
   * 生成 JavaScript 性能建議
   */
  private async generateJavaScriptPerformanceSuggestions(
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    const document = await vscode.workspace.openTextDocument(context.fileUri);
    const text = document.getText();
    
    // 檢查是否可以使用 const 而不是 let
    if (text.includes('let ') && !text.includes('let ') || text.includes('=')) {
      suggestions.push({
        id: this.generateSuggestionId(),
        type: SuggestionType.PERFORMANCE,
        priority: SuggestionPriority.LOW,
        title: '使用 const 聲明不變的變數',
        description: '使用 const 可以提高代碼可讀性並幫助 JavaScript 引擎優化',
        reasoning: '不變的變數應該使用 const 聲明',
        confidence: 0.7,
        actionable: true,
        context,
        actions: [{
          id: 'convert-let-to-const',
          label: '轉換為 const',
          description: '將不會重新賦值的 let 變數轉換為 const',
          command: 'devika.refactor.convertLetToConst'
        }],
        metadata: {
          learnedFrom: ['best_practice'],
          frequency: 1,
          effectiveness: 0.6,
          lastSeen: new Date()
        }
      });
    }
    
    return suggestions;
  }

  /**
   * 生成 TypeScript 學習建議
   */
  private async generateTypeScriptLearningSuggestions(
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    
    if (context.language === 'typescript') {
      const document = await vscode.workspace.openTextDocument(context.fileUri);
      const text = document.getText();
      
      // 檢查是否缺少類型註解
      if (text.includes('function') && !text.includes(': ')) {
        suggestions.push({
          id: this.generateSuggestionId(),
          type: SuggestionType.LEARNING,
          priority: SuggestionPriority.MEDIUM,
          title: '學習 TypeScript 類型註解',
          description: '添加類型註解可以提高代碼安全性和可維護性',
          reasoning: '您的代碼中缺少類型註解，這是 TypeScript 的重要特性',
          confidence: 0.8,
          actionable: true,
          context,
          actions: [{
            id: 'learn-type-annotations',
            label: '學習類型註解',
            description: '查看 TypeScript 類型註解的教程和範例',
            command: 'devika.learning.showTypeScriptTutorial'
          }],
          metadata: {
            learnedFrom: ['code_analysis'],
            frequency: 1,
            effectiveness: 0.9,
            lastSeen: new Date()
          }
        });
      }
    }
    
    return suggestions;
  }

  /**
   * 生成 React 學習建議
   */
  private async generateReactLearningSuggestions(
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    
    if (context.dependencies.includes('react')) {
      suggestions.push({
        id: this.generateSuggestionId(),
        type: SuggestionType.LEARNING,
        priority: SuggestionPriority.MEDIUM,
        title: '學習 React Hooks',
        description: 'React Hooks 是現代 React 開發的核心概念',
        reasoning: '您的項目使用 React，學習 Hooks 可以提高開發效率',
        confidence: 0.75,
        actionable: true,
        context,
        actions: [{
          id: 'learn-react-hooks',
          label: '學習 React Hooks',
          description: '查看 React Hooks 的教程和最佳實踐',
          command: 'devika.learning.showReactHooksTutorial'
        }],
        metadata: {
          learnedFrom: ['project_analysis'],
          frequency: 1,
          effectiveness: 0.85,
          lastSeen: new Date()
        }
      });
    }
    
    return suggestions;
  }

  /**
   * 生成測試學習建議
   */
  private async generateTestingLearningSuggestions(
    context: SuggestionContext
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    
    // 檢查是否有測試文件
    const hasTests = context.relatedFiles.some(file => 
      file.fsPath.includes('.test.') || file.fsPath.includes('.spec.')
    );
    
    if (!hasTests) {
      suggestions.push({
        id: this.generateSuggestionId(),
        type: SuggestionType.LEARNING,
        priority: SuggestionPriority.HIGH,
        title: '學習單元測試',
        description: '為您的代碼添加測試可以提高代碼品質和可靠性',
        reasoning: '您的項目缺少測試文件，學習測試是提高代碼品質的重要步驟',
        confidence: 0.9,
        actionable: true,
        context,
        actions: [{
          id: 'learn-unit-testing',
          label: '學習單元測試',
          description: '查看單元測試的教程和最佳實踐',
          command: 'devika.learning.showTestingTutorial'
        }],
        metadata: {
          learnedFrom: ['project_analysis'],
          frequency: 1,
          effectiveness: 0.95,
          lastSeen: new Date()
        }
      });
    }
    
    return suggestions;
  }

  /**
   * 初始化建議模板
   */
  private initializeSuggestionTemplates(): void {
    // 這裡可以定義更多的建議模板
  }

  /**
   * 創建其他類型的建議方法
   */
  private async createComplexityReductionSuggestion(context: SuggestionContext, analysis: CodeAnalysisResult): Promise<PersonalizedSuggestion | null> {
    return null; // 簡化實現
  }

  private async createDuplicationRemovalSuggestion(context: SuggestionContext, analysis: CodeAnalysisResult): Promise<PersonalizedSuggestion | null> {
    return null; // 簡化實現
  }

  private async createUnusedVariablesSuggestion(context: SuggestionContext, analysis: CodeAnalysisResult): Promise<PersonalizedSuggestion | null> {
    return null; // 簡化實現
  }

  private async createTestCoverageSuggestion(context: SuggestionContext, analysis: CodeAnalysisResult): Promise<PersonalizedSuggestion | null> {
    return null; // 簡化實現
  }

  private async createDocumentationSuggestion(context: SuggestionContext, analysis: CodeAnalysisResult): Promise<PersonalizedSuggestion | null> {
    return null; // 簡化實現
  }

  private async createPerformanceSuggestion(context: SuggestionContext, issue: string): Promise<PersonalizedSuggestion | null> {
    return null; // 簡化實現
  }

  /**
   * 生成建議 ID
   */
  private generateSuggestionId(): string {
    return `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
