import * as vscode from 'vscode';
import { CodeUnderstandingEngine, SymbolType, CodeAnalysis } from '../../ai/CodeUnderstandingEngine';

// Mock vscode module
jest.mock('vscode', () => ({
    Uri: {
        file: jest.fn(),
        parse: jest.fn()
    },
    Range: jest.fn(),
    Position: jest.fn(),
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            readFile: jest.fn()
        }
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    }
}));

// Mock TypeScript
jest.mock('typescript', () => ({
    createSourceFile: jest.fn(),
    ScriptTarget: { Latest: 99 },
    SyntaxKind: {
        ClassDeclaration: 245,
        InterfaceDeclaration: 246,
        FunctionDeclaration: 244,
        MethodDeclaration: 161,
        PropertyDeclaration: 159,
        VariableDeclaration: 242,
        EnumDeclaration: 248,
        TypeAliasDeclaration: 247,
        ImportDeclaration: 254,
        ExportDeclaration: 260,
        IfStatement: 227,
        WhileStatement: 228,
        ForStatement: 229,
        SwitchStatement: 231,
        CatchClause: 280,
        ConditionalExpression: 210,
        ReturnStatement: 235,
        BinaryExpression: 209
    },
    forEachChild: jest.fn(),
    isFunctionDeclaration: jest.fn(),
    isMethodDeclaration: jest.fn(),
    isArrowFunction: jest.fn(),
    isFunctionExpression: jest.fn(),
    isConstructorDeclaration: jest.fn(),
    isGetAccessorDeclaration: jest.fn(),
    isSetAccessorDeclaration: jest.fn(),
    isClassDeclaration: jest.fn(),
    isInterfaceDeclaration: jest.fn(),
    isIdentifier: jest.fn(),
    readConfigFile: jest.fn(),
    parseJsonConfigFileContent: jest.fn(),
    createProgram: jest.fn(),
    sys: {
        readFile: jest.fn()
    }
}));

// Mock FileOperationUtils
jest.mock('../../utils/FileOperationUtils', () => ({
    FileOperationUtils: {
        readFile: jest.fn()
    }
}));

import * as ts from 'typescript';
import { FileOperationUtils } from '../../utils/FileOperationUtils';

describe('CodeUnderstandingEngine', () => {
    let engine: CodeUnderstandingEngine;
    const mockUri = { fsPath: '/test/file.ts' } as vscode.Uri;

    beforeEach(() => {
        engine = CodeUnderstandingEngine.getInstance();
        jest.clearAllMocks();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = CodeUnderstandingEngine.getInstance();
            const instance2 = CodeUnderstandingEngine.getInstance();
            
            expect(instance1).toBe(instance2);
        });
    });

    describe('analyzeFile', () => {
        const mockSourceFile = {
            getLineAndCharacterOfPosition: jest.fn(),
            getStart: jest.fn(),
            getEnd: jest.fn()
        };

        beforeEach(() => {
            (FileOperationUtils.readFile as jest.Mock).mockResolvedValue('test content');
            (ts.createSourceFile as jest.Mock).mockReturnValue(mockSourceFile);
            mockSourceFile.getLineAndCharacterOfPosition.mockReturnValue({ line: 0, character: 0 });
            mockSourceFile.getStart.mockReturnValue(0);
            mockSourceFile.getEnd.mockReturnValue(100);
            (vscode.Range as jest.Mock).mockImplementation((start, end) => ({ start, end }));
            (vscode.Position as jest.Mock).mockImplementation((line, char) => ({ line, character: char }));
        });

        it('should analyze file successfully', async () => {
            const result = await engine.analyzeFile(mockUri);
            
            expect(result).toBeDefined();
            expect(result.symbols).toBeDefined();
            expect(result.relationships).toBeDefined();
            expect(result.complexity).toBeGreaterThanOrEqual(0);
            expect(result.maintainabilityIndex).toBeGreaterThanOrEqual(0);
            expect(result.issues).toBeDefined();
        });

        it('should return empty analysis when file cannot be read', async () => {
            (FileOperationUtils.readFile as jest.Mock).mockResolvedValue(null);
            
            const result = await engine.analyzeFile(mockUri);
            
            expect(result.symbols).toEqual([]);
            expect(result.relationships).toEqual([]);
            expect(result.complexity).toBe(0);
            expect(result.issues).toEqual([]);
        });

        it('should handle TypeScript parsing errors', async () => {
            (ts.createSourceFile as jest.Mock).mockImplementation(() => {
                throw new Error('Parse error');
            });
            
            const result = await engine.analyzeFile(mockUri);
            
            expect(result.symbols).toEqual([]);
        });
    });

    describe('calculateComplexity', () => {
        it('should calculate basic complexity correctly', () => {
            const simpleCode = 'function test() { return true; }';
            const complexity = (engine as any).calculateComplexity(simpleCode);
            
            expect(complexity).toBe(1); // Base complexity
        });

        it('should increase complexity for decision points', () => {
            const complexCode = `
                function test() {
                    if (condition) {
                        return true;
                    } else {
                        return false;
                    }
                }
            `;
            const complexity = (engine as any).calculateComplexity(complexCode);
            
            expect(complexity).toBeGreaterThan(1);
        });

        it('should handle loops and switches', () => {
            const loopCode = `
                function test() {
                    for (let i = 0; i < 10; i++) {
                        if (i % 2 === 0) {
                            continue;
                        }
                    }
                    while (condition) {
                        break;
                    }
                    switch (value) {
                        case 1:
                            return 'one';
                        case 2:
                            return 'two';
                        default:
                            return 'other';
                    }
                }
            `;
            const complexity = (engine as any).calculateComplexity(loopCode);
            
            expect(complexity).toBeGreaterThan(5);
        });
    });

    describe('calculateMaintainabilityIndex', () => {
        it('should calculate maintainability index', () => {
            const code = 'function simple() { return 42; }';
            const complexity = 1;
            const index = (engine as any).calculateMaintainabilityIndex(code, complexity);
            
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThanOrEqual(171);
        });

        it('should return lower index for complex code', () => {
            const simpleCode = 'function simple() { return 42; }';
            const complexCode = `
                function complex() {
                    if (a) {
                        if (b) {
                            if (c) {
                                for (let i = 0; i < 100; i++) {
                                    if (i % 2) {
                                        console.log(i);
                                    }
                                }
                            }
                        }
                    }
                }
            `;
            
            const simpleIndex = (engine as any).calculateMaintainabilityIndex(simpleCode, 1);
            const complexIndex = (engine as any).calculateMaintainabilityIndex(complexCode, 10);
            
            expect(complexIndex).toBeLessThan(simpleIndex);
        });
    });

    describe('detectIssues', () => {
        it('should detect long lines', async () => {
            const longLineCode = 'const veryLongVariableName = "this is a very long line that exceeds the recommended length limit of 120 characters and should be flagged as an issue";';
            const issues = await (engine as any).detectIssues(mockUri, longLineCode);
            
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0].message).toContain('行長度超過');
        });

        it('should detect short variable names', async () => {
            const shortVarCode = 'let x = 5; const y = 10;';
            const issues = await (engine as any).detectIssues(mockUri, shortVarCode);
            
            expect(issues.some(issue => issue.message.includes('變量名'))).toBe(true);
        });

        it('should detect duplicate lines', async () => {
            const duplicateCode = `
                console.log("duplicate line");
                console.log("duplicate line");
                console.log("duplicate line");
            `;
            const issues = await (engine as any).detectIssues(mockUri, duplicateCode);
            
            expect(issues.some(issue => issue.message.includes('重複代碼'))).toBe(true);
        });
    });

    describe('getSymbolSuggestions', () => {
        beforeEach(() => {
            // Mock analyzeFile to return some symbols
            jest.spyOn(engine, 'analyzeFile').mockResolvedValue({
                symbols: [
                    {
                        name: 'testFunction',
                        type: SymbolType.FUNCTION,
                        uri: mockUri,
                        range: new vscode.Range(0, 0, 0, 10)
                    },
                    {
                        name: 'TestClass',
                        type: SymbolType.CLASS,
                        uri: mockUri,
                        range: new vscode.Range(1, 0, 1, 10)
                    }
                ],
                relationships: [],
                complexity: 1,
                maintainabilityIndex: 100,
                issues: []
            });
        });

        it('should return matching symbols', async () => {
            const suggestions = await engine.getSymbolSuggestions('test', mockUri);
            
            expect(suggestions).toHaveLength(2);
            expect(suggestions[0].name).toBe('testFunction');
            expect(suggestions[1].name).toBe('TestClass');
        });

        it('should filter symbols by query', async () => {
            const suggestions = await engine.getSymbolSuggestions('function', mockUri);
            
            expect(suggestions).toHaveLength(1);
            expect(suggestions[0].name).toBe('testFunction');
        });

        it('should return empty array for no matches', async () => {
            const suggestions = await engine.getSymbolSuggestions('nonexistent', mockUri);
            
            expect(suggestions).toHaveLength(0);
        });
    });

    describe('clearCache', () => {
        it('should clear all caches', () => {
            // Add some data to cache first
            (engine as any).analysisCache.set('test', {});
            (engine as any).symbolIndex.set('test', []);
            
            engine.clearCache();
            
            expect((engine as any).analysisCache.size).toBe(0);
            expect((engine as any).symbolIndex.size).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('should handle empty file content', async () => {
            (FileOperationUtils.readFile as jest.Mock).mockResolvedValue('');
            
            const result = await engine.analyzeFile(mockUri);
            
            expect(result).toBeDefined();
            expect(result.symbols).toEqual([]);
        });

        it('should handle malformed TypeScript code', async () => {
            (FileOperationUtils.readFile as jest.Mock).mockResolvedValue('invalid typescript code {{{');
            (ts.createSourceFile as jest.Mock).mockImplementation(() => {
                throw new SyntaxError('Unexpected token');
            });
            
            const result = await engine.analyzeFile(mockUri);
            
            expect(result.symbols).toEqual([]);
        });

        it('should handle very large files', async () => {
            const largeContent = 'function test() {}\n'.repeat(10000);
            (FileOperationUtils.readFile as jest.Mock).mockResolvedValue(largeContent);
            
            const result = await engine.analyzeFile(mockUri);
            
            expect(result).toBeDefined();
            expect(result.complexity).toBeGreaterThan(0);
        });
    });
});
