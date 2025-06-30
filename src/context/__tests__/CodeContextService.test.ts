import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { CodeContextService } from '../CodeContextService';

// Mock vscode
const mockDocument = {
  uri: { fsPath: '/test/file.ts' },
  languageId: 'typescript',
  getText: jest.fn(),
  lineAt: jest.fn(),
  lineCount: 100,
  fileName: 'file.ts'
};

const mockEditor = {
  document: mockDocument,
  selection: {
    start: { line: 10, character: 0 },
    end: { line: 15, character: 20 },
    isEmpty: false
  },
  selections: []
};

const mockVscode = {
  window: {
    activeTextEditor: mockEditor,
    visibleTextEditors: [mockEditor]
  },
  workspace: {
    workspaceFolders: [
      { uri: { fsPath: '/test/workspace' } }
    ],
    getWorkspaceFolder: jest.fn(),
    findFiles: jest.fn(),
    fs: {
      readFile: jest.fn()
    }
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path }))
  },
  Range: jest.fn(),
  Position: jest.fn()
};

jest.mock('vscode', () => mockVscode, { virtual: true });

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn()
  },
  existsSync: jest.fn()
}));

describe('CodeContextService', () => {
  let codeContextService: CodeContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    codeContextService = new CodeContextService();
  });

  describe('Current Context', () => {
    test('should get current file context', async () => {
      mockDocument.getText.mockReturnValue('const test = "hello world";');
      
      const context = await codeContextService.getCurrentContext();

      expect(context.activeFile).toBeDefined();
      expect(context.activeFile?.path).toBe('/test/file.ts');
      expect(context.activeFile?.language).toBe('typescript');
      expect(context.activeFile?.content).toBe('const test = "hello world";');
    });

    test('should get selected text context', async () => {
      mockDocument.getText.mockReturnValue('selected code');
      
      const context = await codeContextService.getCurrentContext();

      expect(context.selectedText).toBe('selected code');
      expect(context.selection).toEqual({
        start: { line: 10, character: 0 },
        end: { line: 15, character: 20 }
      });
    });

    test('should handle no active editor', async () => {
      mockVscode.window.activeTextEditor = undefined;
      
      const context = await codeContextService.getCurrentContext();

      expect(context.activeFile).toBeUndefined();
      expect(context.selectedText).toBeUndefined();
    });

    test('should get workspace context', async () => {
      const context = await codeContextService.getCurrentContext();

      expect(context.workspacePath).toBe('/test/workspace');
    });
  });

  describe('Surrounding Context', () => {
    test('should get surrounding lines', async () => {
      const lines = [
        'line 1',
        'line 2',
        'line 3',
        'line 4',
        'line 5',
        'line 6',
        'line 7'
      ];

      mockDocument.lineAt.mockImplementation((lineNumber: number) => ({
        text: lines[lineNumber] || '',
        lineNumber
      }));

      const surroundingLines = await codeContextService.getSurroundingLines(3, 2);

      expect(surroundingLines).toHaveLength(5); // 2 before + current + 2 after
      expect(surroundingLines[0].text).toBe('line 2');
      expect(surroundingLines[2].text).toBe('line 4'); // current line (0-indexed)
      expect(surroundingLines[4].text).toBe('line 6');
    });

    test('should handle edge cases for surrounding lines', async () => {
      mockDocument.lineAt.mockImplementation((lineNumber: number) => ({
        text: `line ${lineNumber + 1}`,
        lineNumber
      }));

      // Test beginning of file
      const beginningLines = await codeContextService.getSurroundingLines(0, 3);
      expect(beginningLines.length).toBeGreaterThan(0);

      // Test end of file
      const endLines = await codeContextService.getSurroundingLines(99, 3);
      expect(endLines.length).toBeGreaterThan(0);
    });
  });

  describe('Related Files', () => {
    test('should find related files', async () => {
      const mockFiles = [
        { fsPath: '/test/workspace/src/utils.ts' },
        { fsPath: '/test/workspace/src/types.ts' },
        { fsPath: '/test/workspace/tests/utils.test.ts' }
      ];

      mockVscode.workspace.findFiles.mockResolvedValue(mockFiles);

      const relatedFiles = await codeContextService.getRelatedFiles('/test/workspace/src/main.ts');

      expect(relatedFiles.length).toBeGreaterThan(0);
      expect(mockVscode.workspace.findFiles).toHaveBeenCalled();
    });

    test('should prioritize files in same directory', async () => {
      const mockFiles = [
        { fsPath: '/test/workspace/src/utils.ts' },
        { fsPath: '/test/workspace/other/helper.ts' },
        { fsPath: '/test/workspace/src/types.ts' }
      ];

      mockVscode.workspace.findFiles.mockResolvedValue(mockFiles);

      const relatedFiles = await codeContextService.getRelatedFiles('/test/workspace/src/main.ts');

      // Files in same directory should come first
      const sameDirectoryFiles = relatedFiles.filter(f => f.includes('/src/'));
      expect(sameDirectoryFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Symbol Context', () => {
    test('should extract imports from file', async () => {
      const fileContent = `
import { Component } from 'react';
import * as fs from 'fs';
import utils from './utils';
const test = 'hello';
      `;

      const imports = await codeContextService.extractImports(fileContent);

      expect(imports).toContain('react');
      expect(imports).toContain('fs');
      expect(imports).toContain('./utils');
    });

    test('should extract function definitions', async () => {
      const fileContent = `
function testFunction() {
  return 'test';
}

const arrowFunction = () => {
  return 'arrow';
};

class TestClass {
  method() {
    return 'method';
  }
}
      `;

      const functions = await codeContextService.extractFunctions(fileContent);

      expect(functions).toContain('testFunction');
      expect(functions).toContain('arrowFunction');
      expect(functions).toContain('method');
    });

    test('should extract class definitions', async () => {
      const fileContent = `
class UserService {
  constructor() {}
}

export class ApiClient {
  async get() {}
}

interface IUser {
  name: string;
}
      `;

      const classes = await codeContextService.extractClasses(fileContent);

      expect(classes).toContain('UserService');
      expect(classes).toContain('ApiClient');
      expect(classes).toContain('IUser');
    });
  });

  describe('Context Building', () => {
    test('should build comprehensive context', async () => {
      mockDocument.getText.mockReturnValue(`
import { Component } from 'react';

class TestComponent extends Component {
  render() {
    return <div>Test</div>;
  }
}
      `);

      const mockFiles = [
        { fsPath: '/test/workspace/src/types.ts' }
      ];

      mockVscode.workspace.findFiles.mockResolvedValue(mockFiles);

      const context = await codeContextService.buildContext();

      expect(context.activeFile).toBeDefined();
      expect(context.imports).toContain('react');
      expect(context.classes).toContain('TestComponent');
      expect(context.relatedFiles.length).toBeGreaterThan(0);
    });

    test('should include project structure in context', async () => {
      const mockFiles = [
        { fsPath: '/test/workspace/src/main.ts' },
        { fsPath: '/test/workspace/src/utils/helper.ts' },
        { fsPath: '/test/workspace/tests/main.test.ts' }
      ];

      mockVscode.workspace.findFiles.mockResolvedValue(mockFiles);

      const context = await codeContextService.buildContext();

      expect(context.projectStructure).toBeDefined();
      expect(context.projectStructure.length).toBeGreaterThan(0);
    });
  });

  describe('Context Filtering', () => {
    test('should filter context by relevance', async () => {
      const context = {
        activeFile: {
          path: '/test/main.ts',
          content: 'test content',
          language: 'typescript'
        },
        relatedFiles: [
          '/test/utils.ts',
          '/test/types.ts',
          '/test/unrelated.js'
        ],
        imports: ['react', 'lodash'],
        functions: ['testFunction', 'helperFunction'],
        classes: ['TestClass']
      };

      const filteredContext = await codeContextService.filterContext(context, 'react');

      expect(filteredContext.imports).toContain('react');
      expect(filteredContext.relatedFiles.length).toBeLessThanOrEqual(context.relatedFiles.length);
    });

    test('should limit context size', async () => {
      const largeContext = {
        activeFile: {
          path: '/test/main.ts',
          content: 'x'.repeat(10000), // Large content
          language: 'typescript'
        },
        relatedFiles: Array.from({ length: 100 }, (_, i) => `/test/file${i}.ts`),
        imports: Array.from({ length: 50 }, (_, i) => `module${i}`),
        functions: Array.from({ length: 50 }, (_, i) => `function${i}`),
        classes: Array.from({ length: 50 }, (_, i) => `Class${i}`)
      };

      const limitedContext = await codeContextService.limitContextSize(largeContext, 5000);

      expect(limitedContext.activeFile?.content.length).toBeLessThanOrEqual(5000);
      expect(limitedContext.relatedFiles.length).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle file read errors gracefully', async () => {
      mockVscode.workspace.fs.readFile.mockRejectedValue(new Error('File not found'));

      const context = await codeContextService.getCurrentContext();

      // Should not throw, but return partial context
      expect(context).toBeDefined();
    });

    test('should handle invalid file paths', async () => {
      const relatedFiles = await codeContextService.getRelatedFiles('');

      expect(relatedFiles).toEqual([]);
    });

    test('should handle malformed code gracefully', async () => {
      const malformedCode = 'function incomplete() { // missing closing brace';

      const functions = await codeContextService.extractFunctions(malformedCode);

      // Should not throw, might return partial results
      expect(Array.isArray(functions)).toBe(true);
    });
  });
});
