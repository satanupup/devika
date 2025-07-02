import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternRecognizer, PatternType } from '../../learning/PatternRecognizer';

describe('PatternRecognizer', () => {
  let patternRecognizer: PatternRecognizer;

  beforeEach(() => {
    // 重置單例實例
    (PatternRecognizer as any).instance = undefined;
    patternRecognizer = PatternRecognizer.getInstance();
  });

  afterEach(() => {
    patternRecognizer.clearPatterns();
  });

  describe('基本功能', () => {
    it('應該能夠創建單例實例', () => {
      const instance1 = PatternRecognizer.getInstance();
      const instance2 = PatternRecognizer.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('應該能夠分析 TypeScript 代碼', async () => {
      const code = `
        import React from 'react';
        
        const MyComponent = () => {
          const handleClick = async () => {
            try {
              const data = await fetch('/api/data');
              return data.json();
            } catch (error) {
              console.error(error);
            }
          };
          
          return <button onClick={handleClick}>Click me</button>;
        };
        
        export default MyComponent;
      `;

      const patterns = await patternRecognizer.analyzeCode(code, 'typescript', 'react');
      
      expect(patterns.length).toBeGreaterThan(0);
      
      // 檢查是否識別了不同類型的模式
      const patternTypes = patterns.map(p => p.type);
      expect(patternTypes).toContain(PatternType.IMPORT_STYLE);
      expect(patternTypes).toContain(PatternType.FUNCTION_SIGNATURE);
      expect(patternTypes).toContain(PatternType.ASYNC_PATTERN);
      expect(patternTypes).toContain(PatternType.ERROR_HANDLING);
    });

    it('應該能夠分析 JavaScript 代碼', async () => {
      const code = `
        const express = require('express');
        const app = express();
        
        function getUserData(userId) {
          return new Promise((resolve, reject) => {
            if (!userId) {
              reject(new Error('User ID is required'));
              return;
            }
            
            // 模擬數據庫查詢
            setTimeout(() => {
              resolve({ id: userId, name: 'John Doe' });
            }, 100);
          });
        }
        
        app.get('/user/:id', async (req, res) => {
          try {
            const userData = await getUserData(req.params.id);
            res.json(userData);
          } catch (error) {
            res.status(400).json({ error: error.message });
          }
        });
        
        module.exports = app;
      `;

      const patterns = await patternRecognizer.analyzeCode(code, 'javascript', 'express');
      
      expect(patterns.length).toBeGreaterThan(0);
      
      const patternTypes = patterns.map(p => p.type);
      expect(patternTypes).toContain(PatternType.IMPORT_STYLE); // require
      expect(patternTypes).toContain(PatternType.FUNCTION_SIGNATURE);
      expect(patternTypes).toContain(PatternType.ERROR_HANDLING);
    });

    it('應該能夠分析 Python 代碼', async () => {
      const code = `
        from typing import List, Optional
        import asyncio
        
        class UserService:
            def __init__(self, database_url: str):
                self.database_url = database_url
            
            async def get_user(self, user_id: int) -> Optional[dict]:
                try:
                    # 模擬異步數據庫查詢
                    await asyncio.sleep(0.1)
                    return {"id": user_id, "name": "John Doe"}
                except Exception as e:
                    print(f"Error fetching user {user_id}: {e}")
                    return None
            
            def get_users(self, limit: int = 10) -> List[dict]:
                return [{"id": i, "name": f"User {i}"} for i in range(limit)]
      `;

      const patterns = await patternRecognizer.analyzeCode(code, 'python', 'service');
      
      expect(patterns.length).toBeGreaterThan(0);
      
      const patternTypes = patterns.map(p => p.type);
      expect(patternTypes).toContain(PatternType.IMPORT_STYLE);
      expect(patternTypes).toContain(PatternType.CLASS_STRUCTURE);
      expect(patternTypes).toContain(PatternType.FUNCTION_SIGNATURE);
    });
  });

  describe('模式識別', () => {
    it('應該能夠識別函數簽名模式', async () => {
      const code = `
        function regularFunction(param1, param2) {
          return param1 + param2;
        }
        
        const arrowFunction = (a, b) => a * b;
        
        async function asyncFunction(data) {
          return await processData(data);
        }
        
        const asyncArrow = async (input) => {
          return await transform(input);
        };
      `;

      const patterns = await patternRecognizer.analyzeCode(code, 'typescript');
      const functionPatterns = patterns.filter(p => p.type === PatternType.FUNCTION_SIGNATURE);
      
      expect(functionPatterns.length).toBeGreaterThan(0);
      
      // 檢查元數據
      const hasAsync = functionPatterns.some(p => p.metadata.isAsync);
      const hasArrow = functionPatterns.some(p => p.metadata.isArrow);
      
      expect(hasAsync).toBe(true);
      expect(hasArrow).toBe(true);
    });

    it('應該能夠識別導入風格模式', async () => {
      const code = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import * as utils from './utils';
        import type { User } from './types';
        
        const lodash = require('lodash');
        const { merge } = require('lodash');
      `;

      const patterns = await patternRecognizer.analyzeCode(code, 'typescript');
      const importPatterns = patterns.filter(p => p.type === PatternType.IMPORT_STYLE);
      
      expect(importPatterns.length).toBeGreaterThan(0);
      
      // 檢查不同的導入風格
      const hasNamed = importPatterns.some(p => p.metadata.isNamed);
      const hasDefault = importPatterns.some(p => p.metadata.isDefault);
      const hasNamespace = importPatterns.some(p => p.metadata.isNamespace);
      
      expect(hasNamed).toBe(true);
      expect(hasDefault).toBe(true);
      expect(hasNamespace).toBe(true);
    });

    it('應該能夠識別變數命名模式', async () => {
      const code = `
        const camelCaseVar = 'value';
        const snake_case_var = 'value';
        const PascalCaseVar = 'value';
        const CONSTANT_VALUE = 'value';
        let temporaryData = null;
        var oldStyleVar = undefined;
      `;

      const patterns = await patternRecognizer.analyzeCode(code, 'typescript');
      const variablePatterns = patterns.filter(p => p.type === PatternType.VARIABLE_NAMING);
      
      expect(variablePatterns.length).toBeGreaterThan(0);
      
      // 檢查命名風格的元數據
      const hasUnderscore = variablePatterns.some(p => p.metadata.hasUnderscore);
      const hasCapital = variablePatterns.some(p => p.metadata.startsWithCapital);
      
      expect(hasUnderscore).toBe(true);
      expect(hasCapital).toBe(true);
    });

    it('應該能夠識別錯誤處理模式', async () => {
      const code = `
        try {
          const result = await riskyOperation();
          return result;
        } catch (error) {
          console.error('Operation failed:', error);
          throw error;
        }
        
        function handleError(error) {
          if (error instanceof TypeError) {
            return 'Type error occurred';
          }
          return 'Unknown error';
        }
      `;

      const patterns = await patternRecognizer.analyzeCode(code, 'typescript');
      const errorPatterns = patterns.filter(p => p.type === PatternType.ERROR_HANDLING);
      
      expect(errorPatterns.length).toBeGreaterThan(0);
    });

    it('應該能夠識別類型註解模式', async () => {
      const code = `
        interface User {
          id: number;
          name: string;
          email?: string;
        }
        
        function processUser(user: User): Promise<boolean> {
          return Promise.resolve(true);
        }
        
        const users: User[] = [];
        const userMap: Map<string, User> = new Map();
        const callback: (user: User) => void = (user) => console.log(user);
      `;

      const patterns = await patternRecognizer.analyzeCode(code, 'typescript');
      const typePatterns = patterns.filter(p => p.type === PatternType.TYPE_ANNOTATION);
      
      expect(typePatterns.length).toBeGreaterThan(0);
    });
  });

  describe('編碼風格分析', () => {
    it('應該能夠分析函數風格偏好', async () => {
      const code = `
        const func1 = () => {};
        const func2 = () => {};
        const func3 = () => {};
        function func4() {}
        async function func5() {}
      `;

      await patternRecognizer.analyzeCode(code, 'typescript');
      const preferences = await patternRecognizer.getCodingStylePreferences('typescript');
      
      expect(preferences.functionStyle).toBeDefined();
      expect(preferences.functionStyle.arrowFunction.preference).toBeGreaterThan(0.5);
    });

    it('應該能夠分析命名風格偏好', async () => {
      const code = `
        const userName = 'john';
        const userAge = 25;
        const userEmail = 'john@example.com';
        const user_id = 123;
        const UserType = 'admin';
      `;

      await patternRecognizer.analyzeCode(code, 'typescript');
      const preferences = await patternRecognizer.getCodingStylePreferences('typescript');
      
      expect(preferences.namingStyle).toBeDefined();
      expect(preferences.namingStyle.camelCase.preference).toBeGreaterThan(0);
    });

    it('應該能夠分析導入風格偏好', async () => {
      const code = `
        import React from 'react';
        import { Component } from 'react';
        import { useState, useEffect } from 'react';
        import * as utils from './utils';
      `;

      await patternRecognizer.analyzeCode(code, 'typescript');
      const preferences = await patternRecognizer.getCodingStylePreferences('typescript');
      
      expect(preferences.importStyle).toBeDefined();
      expect(preferences.importStyle.namedImport.preference).toBeGreaterThan(0);
    });
  });

  describe('模式預測', () => {
    it('應該能夠預測用戶偏好的代碼風格', async () => {
      // 先學習一些模式
      const trainingCode = `
        const getData = async () => {
          try {
            const response = await fetch('/api/data');
            return response.json();
          } catch (error) {
            console.error(error);
          }
        };
        
        const processData = (data) => {
          return data.map(item => item.value);
        };
      `;

      await patternRecognizer.analyzeCode(trainingCode, 'typescript');

      // 測試預測
      const alternatives = [
        'function getData() { return fetch("/api/data"); }',
        'const getData = () => fetch("/api/data");',
        'async function getData() { return await fetch("/api/data"); }'
      ];

      const predictions = await patternRecognizer.predictPreferredStyle(
        'getData',
        'typescript',
        alternatives
      );

      expect(predictions.length).toBe(alternatives.length);
      expect(predictions[0].confidence).toBeGreaterThanOrEqual(0);
      
      // 預測應該按信心度排序
      for (let i = 1; i < predictions.length; i++) {
        expect(predictions[i].confidence).toBeLessThanOrEqual(predictions[i - 1].confidence);
      }
    });
  });

  describe('性能測試', () => {
    it('應該能夠快速分析大型代碼文件', async () => {
      // 生成大型代碼文件
      const largeCode = Array.from({ length: 100 }, (_, i) => `
        const function${i} = async (param${i}) => {
          try {
            const result${i} = await process${i}(param${i});
            return result${i};
          } catch (error${i}) {
            console.error('Error in function${i}:', error${i});
            throw error${i};
          }
        };
      `).join('\n');

      const startTime = Date.now();
      const patterns = await patternRecognizer.analyzeCode(largeCode, 'typescript');
      const endTime = Date.now();

      const duration = endTime - startTime;
      
      // 應該在合理時間內完成（比如 2 秒）
      expect(duration).toBeLessThan(2000);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('錯誤處理', () => {
    it('應該能夠處理無效的代碼', async () => {
      const invalidCode = 'const x = ; function() { if (';
      
      // 不應該拋出錯誤
      await expect(patternRecognizer.analyzeCode(invalidCode, 'typescript'))
        .resolves.not.toThrow();
    });

    it('應該能夠處理空代碼', async () => {
      const patterns = await patternRecognizer.analyzeCode('', 'typescript');
      expect(patterns).toEqual([]);
    });

    it('應該能夠處理不支援的語言', async () => {
      const code = 'print("Hello, World!")';
      const patterns = await patternRecognizer.analyzeCode(code, 'unsupported-language');
      
      // 應該返回空數組而不是拋出錯誤
      expect(patterns).toEqual([]);
    });
  });

  describe('數據管理', () => {
    it('應該能夠獲取所有識別的模式', async () => {
      const code = 'const x = 1; function test() {}';
      await patternRecognizer.analyzeCode(code, 'typescript');
      
      const allPatterns = patternRecognizer.getAllPatterns();
      expect(allPatterns.length).toBeGreaterThan(0);
    });

    it('應該能夠清除模式數據', async () => {
      const code = 'const x = 1; function test() {}';
      await patternRecognizer.analyzeCode(code, 'typescript');
      
      expect(patternRecognizer.getAllPatterns().length).toBeGreaterThan(0);
      
      patternRecognizer.clearPatterns();
      expect(patternRecognizer.getAllPatterns().length).toBe(0);
    });
  });
});
