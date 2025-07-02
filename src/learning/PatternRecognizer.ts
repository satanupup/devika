import * as vscode from 'vscode';
import { LearningEngine, CodingPattern } from './LearningEngine';
import { CodeUnderstandingEngine } from '../ai/CodeUnderstandingEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 模式類型
 */
export enum PatternType {
  FUNCTION_SIGNATURE = 'function_signature',
  CLASS_STRUCTURE = 'class_structure',
  IMPORT_STYLE = 'import_style',
  VARIABLE_NAMING = 'variable_naming',
  ERROR_HANDLING = 'error_handling',
  ASYNC_PATTERN = 'async_pattern',
  CONDITIONAL_LOGIC = 'conditional_logic',
  LOOP_STRUCTURE = 'loop_structure',
  OBJECT_CREATION = 'object_creation',
  TYPE_ANNOTATION = 'type_annotation'
}

/**
 * 識別的模式
 */
export interface IdentifiedPattern {
  type: PatternType;
  pattern: string;
  confidence: number;
  frequency: number;
  examples: string[];
  context: string;
  language: string;
  metadata: Record<string, any>;
}

/**
 * 模式匹配規則
 */
interface PatternRule {
  type: PatternType;
  regex: RegExp;
  extractor: (match: RegExpMatchArray, code: string) => string;
  validator?: (pattern: string) => boolean;
  weight: number;
}

/**
 * 模式識別器
 * 自動識別用戶的編碼模式和風格
 */
export class PatternRecognizer {
  private static instance: PatternRecognizer;
  private learningEngine: LearningEngine;
  private codeEngine: CodeUnderstandingEngine;
  private patternRules: Map<string, PatternRule[]> = new Map();
  private identifiedPatterns: Map<string, IdentifiedPattern> = new Map();

  private constructor() {
    this.learningEngine = LearningEngine.getInstance();
    this.codeEngine = CodeUnderstandingEngine.getInstance();
    this.initializePatternRules();
  }

  static getInstance(): PatternRecognizer {
    if (!PatternRecognizer.instance) {
      PatternRecognizer.instance = new PatternRecognizer();
    }
    return PatternRecognizer.instance;
  }

  /**
   * 分析代碼並識別模式
   */
  async analyzeCode(
    code: string,
    language: string,
    context: string = 'general'
  ): Promise<IdentifiedPattern[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const patterns: IdentifiedPattern[] = [];
        const rules = this.patternRules.get(language) || [];

        for (const rule of rules) {
          const matches = code.matchAll(rule.regex);
          
          for (const match of matches) {
            try {
              const pattern = rule.extractor(match, code);
              
              if (rule.validator && !rule.validator(pattern)) {
                continue;
              }

              const patternId = this.generatePatternId(rule.type, pattern, language);
              const existing = this.identifiedPatterns.get(patternId);

              if (existing) {
                // 更新現有模式
                existing.frequency++;
                existing.confidence = Math.min(1, existing.confidence + 0.1);
                existing.examples.push(pattern);
              } else {
                // 創建新模式
                const identifiedPattern: IdentifiedPattern = {
                  type: rule.type,
                  pattern,
                  confidence: rule.weight,
                  frequency: 1,
                  examples: [pattern],
                  context,
                  language,
                  metadata: this.extractMetadata(pattern, rule.type, match)
                };

                this.identifiedPatterns.set(patternId, identifiedPattern);
                patterns.push(identifiedPattern);
              }

              // 記錄到學習引擎
              await this.learningEngine.learnCodingPattern(
                pattern,
                language,
                context,
                rule.weight
              );

            } catch (error) {
              console.warn(`模式提取失敗: ${error}`);
            }
          }
        }

        return patterns;
      },
      `分析代碼模式 (${language})`,
      { logError: true, showToUser: false }
    ).then(result => result.success ? result.data! : []);
  }

  /**
   * 獲取用戶的編碼風格偏好
   */
  async getCodingStylePreferences(language: string): Promise<Record<string, any>> {
    const patterns = Array.from(this.identifiedPatterns.values())
      .filter(p => p.language === language && p.confidence > 0.6);

    const preferences: Record<string, any> = {};

    // 分析函數簽名風格
    const functionPatterns = patterns.filter(p => p.type === PatternType.FUNCTION_SIGNATURE);
    if (functionPatterns.length > 0) {
      preferences.functionStyle = this.analyzeFunctionStyle(functionPatterns);
    }

    // 分析變數命名風格
    const variablePatterns = patterns.filter(p => p.type === PatternType.VARIABLE_NAMING);
    if (variablePatterns.length > 0) {
      preferences.namingStyle = this.analyzeNamingStyle(variablePatterns);
    }

    // 分析導入風格
    const importPatterns = patterns.filter(p => p.type === PatternType.IMPORT_STYLE);
    if (importPatterns.length > 0) {
      preferences.importStyle = this.analyzeImportStyle(importPatterns);
    }

    // 分析錯誤處理風格
    const errorPatterns = patterns.filter(p => p.type === PatternType.ERROR_HANDLING);
    if (errorPatterns.length > 0) {
      preferences.errorHandlingStyle = this.analyzeErrorHandlingStyle(errorPatterns);
    }

    return preferences;
  }

  /**
   * 預測用戶可能喜歡的代碼風格
   */
  async predictPreferredStyle(
    codeSnippet: string,
    language: string,
    alternatives: string[]
  ): Promise<{ style: string; confidence: number }[]> {
    const userPatterns = await this.getCodingStylePreferences(language);
    const predictions: { style: string; confidence: number }[] = [];

    for (const alternative of alternatives) {
      const patterns = await this.analyzeCode(alternative, language, 'prediction');
      let confidence = 0;
      let matchCount = 0;

      for (const pattern of patterns) {
        // 檢查是否符合用戶偏好
        const preference = this.getPreferenceForPattern(pattern.type, userPatterns);
        if (preference) {
          confidence += preference.confidence * pattern.confidence;
          matchCount++;
        }
      }

      if (matchCount > 0) {
        confidence /= matchCount;
      }

      predictions.push({
        style: alternative,
        confidence
      });
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 初始化模式規則
   */
  private initializePatternRules(): void {
    // TypeScript/JavaScript 規則
    this.patternRules.set('typescript', [
      {
        type: PatternType.FUNCTION_SIGNATURE,
        regex: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{|function))/g,
        extractor: (match) => match[0],
        weight: 0.8
      },
      {
        type: PatternType.IMPORT_STYLE,
        regex: /import\s+(?:{[^}]+}|[^{}\s]+|\*\s+as\s+\w+)\s+from\s+['"][^'"]+['"]/g,
        extractor: (match) => match[0],
        weight: 0.9
      },
      {
        type: PatternType.VARIABLE_NAMING,
        regex: /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        extractor: (match) => match[1],
        weight: 0.7
      },
      {
        type: PatternType.TYPE_ANNOTATION,
        regex: /:\s*([a-zA-Z_$][a-zA-Z0-9_$<>\[\]|&\s]*)/g,
        extractor: (match) => match[1].trim(),
        weight: 0.8
      },
      {
        type: PatternType.ERROR_HANDLING,
        regex: /try\s*{[^}]*}\s*catch\s*\([^)]*\)\s*{[^}]*}/g,
        extractor: (match) => match[0],
        weight: 0.9
      },
      {
        type: PatternType.ASYNC_PATTERN,
        regex: /(?:async\s+function|async\s+\([^)]*\)\s*=>|await\s+)/g,
        extractor: (match) => match[0],
        weight: 0.8
      }
    ]);

    // JavaScript 規則（類似 TypeScript 但沒有類型註解）
    this.patternRules.set('javascript', [
      {
        type: PatternType.FUNCTION_SIGNATURE,
        regex: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{|function))/g,
        extractor: (match) => match[0],
        weight: 0.8
      },
      {
        type: PatternType.IMPORT_STYLE,
        regex: /(?:import\s+(?:{[^}]+}|[^{}\s]+|\*\s+as\s+\w+)\s+from\s+['"][^'"]+['"]|const\s+(?:{[^}]+}|\w+)\s*=\s*require\(['"][^'"]+['"]\))/g,
        extractor: (match) => match[0],
        weight: 0.9
      },
      {
        type: PatternType.VARIABLE_NAMING,
        regex: /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        extractor: (match) => match[1],
        weight: 0.7
      }
    ]);

    // Python 規則
    this.patternRules.set('python', [
      {
        type: PatternType.FUNCTION_SIGNATURE,
        regex: /def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?:/g,
        extractor: (match) => match[0],
        weight: 0.8
      },
      {
        type: PatternType.IMPORT_STYLE,
        regex: /(?:from\s+[\w.]+\s+import\s+[^#\n]+|import\s+[^#\n]+)/g,
        extractor: (match) => match[0],
        weight: 0.9
      },
      {
        type: PatternType.CLASS_STRUCTURE,
        regex: /class\s+(\w+)(?:\([^)]*\))?:/g,
        extractor: (match) => match[0],
        weight: 0.8
      }
    ]);
  }

  /**
   * 分析函數風格
   */
  private analyzeFunctionStyle(patterns: IdentifiedPattern[]): any {
    const styles = {
      arrowFunction: 0,
      regularFunction: 0,
      asyncFunction: 0,
      namedFunction: 0
    };

    patterns.forEach(pattern => {
      if (pattern.pattern.includes('=>')) {
        styles.arrowFunction += pattern.frequency;
      }
      if (pattern.pattern.includes('function')) {
        styles.regularFunction += pattern.frequency;
      }
      if (pattern.pattern.includes('async')) {
        styles.asyncFunction += pattern.frequency;
      }
      if (/function\s+\w+/.test(pattern.pattern)) {
        styles.namedFunction += pattern.frequency;
      }
    });

    const total = Object.values(styles).reduce((sum, count) => sum + count, 0);
    const preferences: any = {};

    Object.entries(styles).forEach(([style, count]) => {
      preferences[style] = {
        preference: count / total,
        confidence: count > 3 ? 0.8 : 0.5
      };
    });

    return preferences;
  }

  /**
   * 分析命名風格
   */
  private analyzeNamingStyle(patterns: IdentifiedPattern[]): any {
    const styles = {
      camelCase: 0,
      snake_case: 0,
      PascalCase: 0,
      kebab_case: 0
    };

    patterns.forEach(pattern => {
      const name = pattern.pattern;
      if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
        styles.camelCase += pattern.frequency;
      } else if (/^[a-z][a-z0-9_]*$/.test(name)) {
        styles.snake_case += pattern.frequency;
      } else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        styles.PascalCase += pattern.frequency;
      } else if (/^[a-z][a-z0-9-]*$/.test(name)) {
        styles.kebab_case += pattern.frequency;
      }
    });

    const total = Object.values(styles).reduce((sum, count) => sum + count, 0);
    const preferences: any = {};

    Object.entries(styles).forEach(([style, count]) => {
      preferences[style] = {
        preference: count / total,
        confidence: count > 5 ? 0.9 : 0.6
      };
    });

    return preferences;
  }

  /**
   * 分析導入風格
   */
  private analyzeImportStyle(patterns: IdentifiedPattern[]): any {
    const styles = {
      namedImport: 0,
      defaultImport: 0,
      namespaceImport: 0,
      requireStyle: 0
    };

    patterns.forEach(pattern => {
      if (pattern.pattern.includes('{')) {
        styles.namedImport += pattern.frequency;
      } else if (pattern.pattern.includes('* as')) {
        styles.namespaceImport += pattern.frequency;
      } else if (pattern.pattern.includes('require(')) {
        styles.requireStyle += pattern.frequency;
      } else {
        styles.defaultImport += pattern.frequency;
      }
    });

    const total = Object.values(styles).reduce((sum, count) => sum + count, 0);
    const preferences: any = {};

    Object.entries(styles).forEach(([style, count]) => {
      preferences[style] = {
        preference: count / total,
        confidence: count > 2 ? 0.8 : 0.5
      };
    });

    return preferences;
  }

  /**
   * 分析錯誤處理風格
   */
  private analyzeErrorHandlingStyle(patterns: IdentifiedPattern[]): any {
    const styles = {
      tryCatch: 0,
      promiseChain: 0,
      asyncAwait: 0
    };

    patterns.forEach(pattern => {
      if (pattern.pattern.includes('try') && pattern.pattern.includes('catch')) {
        styles.tryCatch += pattern.frequency;
      }
      if (pattern.pattern.includes('.catch(')) {
        styles.promiseChain += pattern.frequency;
      }
      if (pattern.pattern.includes('await') && pattern.pattern.includes('try')) {
        styles.asyncAwait += pattern.frequency;
      }
    });

    const total = Object.values(styles).reduce((sum, count) => sum + count, 0);
    const preferences: any = {};

    Object.entries(styles).forEach(([style, count]) => {
      preferences[style] = {
        preference: count / total,
        confidence: count > 1 ? 0.9 : 0.6
      };
    });

    return preferences;
  }

  /**
   * 獲取模式偏好
   */
  private getPreferenceForPattern(
    patternType: PatternType,
    userPreferences: Record<string, any>
  ): { confidence: number } | null {
    switch (patternType) {
      case PatternType.FUNCTION_SIGNATURE:
        return userPreferences.functionStyle ? { confidence: 0.8 } : null;
      case PatternType.VARIABLE_NAMING:
        return userPreferences.namingStyle ? { confidence: 0.7 } : null;
      case PatternType.IMPORT_STYLE:
        return userPreferences.importStyle ? { confidence: 0.9 } : null;
      case PatternType.ERROR_HANDLING:
        return userPreferences.errorHandlingStyle ? { confidence: 0.8 } : null;
      default:
        return null;
    }
  }

  /**
   * 提取模式元數據
   */
  private extractMetadata(
    pattern: string,
    type: PatternType,
    match: RegExpMatchArray
  ): Record<string, any> {
    const metadata: Record<string, any> = {};

    switch (type) {
      case PatternType.FUNCTION_SIGNATURE:
        metadata.isAsync = pattern.includes('async');
        metadata.isArrow = pattern.includes('=>');
        metadata.hasParameters = pattern.includes('(') && pattern.includes(')');
        break;
      case PatternType.VARIABLE_NAMING:
        metadata.length = pattern.length;
        metadata.hasUnderscore = pattern.includes('_');
        metadata.startsWithCapital = /^[A-Z]/.test(pattern);
        break;
      case PatternType.IMPORT_STYLE:
        metadata.isNamed = pattern.includes('{');
        metadata.isDefault = !pattern.includes('{') && !pattern.includes('* as');
        metadata.isNamespace = pattern.includes('* as');
        break;
    }

    return metadata;
  }

  /**
   * 生成模式 ID
   */
  private generatePatternId(type: PatternType, pattern: string, language: string): string {
    const hash = this.simpleHash(type + pattern + language);
    return `${type}-${language}-${hash}`;
  }

  /**
   * 簡單哈希函數
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 獲取所有識別的模式
   */
  getAllPatterns(): IdentifiedPattern[] {
    return Array.from(this.identifiedPatterns.values());
  }

  /**
   * 清除模式數據
   */
  clearPatterns(): void {
    this.identifiedPatterns.clear();
  }
}
