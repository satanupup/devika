import * as vscode from 'vscode';
import { CodeParser } from './CodeParser';

/**
 * 代碼片段接口
 */
export interface CodeSnippet {
  id: string;
  title: string;
  description?: string;
  code: string;
  language: string;
  tags: string[];
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

/**
 * 函數上下文接口
 */
export interface FunctionContext {
  name: string;
  code: string;
  startLine: number;
  endLine: number;
  parameters: string[];
  returnType?: string;
}

/**
 * 類別上下文接口
 */
export interface ClassContext {
  class: vscode.DocumentSymbol;
  methods: vscode.DocumentSymbol[];
  properties: vscode.DocumentSymbol[];
}

export interface CodeSymbol {
  name: string;
  kind: vscode.SymbolKind;
  range: vscode.Range;
  detail?: string;
  children?: CodeSymbol[];
}

export interface CodeContext {
  selectedCode: string;
  fileName: string;
  language: string;
  surroundingCode: string;
  symbols: CodeSymbol[];
  imports: string[];
  relatedFiles: string[];
  lineNumbers: {
    start: number;
    end: number;
  };
}

export class CodeContextService {
  private codeParser: CodeParser;
  private symbolIndex: Map<string, CodeSymbol[]> = new Map();
  private dependencyGraph: Map<string, string[]> = new Map();
  private fileWatcher: vscode.FileSystemWatcher | undefined;

  constructor() {
    this.codeParser = new CodeParser();
    this.initializeFileWatcher();
  }

  async getCodeContext(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    maxLines: number = 100
  ): Promise<CodeContext> {
    const selectedCode = document.getText(selection);
    const fileName = document.fileName;
    const language = document.languageId;

    // 獲取周圍程式碼
    const surroundingCode = this.getSurroundingCode(document, selection, maxLines);

    // 解析符號
    const symbols = await this.getDocumentSymbols(document);

    // 獲取 imports
    const imports = await this.codeParser.extractImports(document);

    // 尋找相關檔案
    const relatedFiles = await this.findRelatedFiles(document, selectedCode);

    return {
      selectedCode,
      fileName,
      language,
      surroundingCode,
      symbols,
      imports,
      relatedFiles,
      lineNumbers: {
        start: selection.start.line + 1,
        end: selection.end.line + 1
      }
    };
  }

  private getSurroundingCode(document: vscode.TextDocument, selection: vscode.Selection, maxLines: number): string {
    const totalLines = document.lineCount;
    const contextLines = Math.floor(maxLines / 2);

    const startLine = Math.max(0, selection.start.line - contextLines);
    const endLine = Math.min(totalLines - 1, selection.end.line + contextLines);

    const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    return document.getText(range);
  }

  async getDocumentSymbols(document: vscode.TextDocument): Promise<CodeSymbol[]> {
    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      return this.convertDocumentSymbols(symbols || []);
    } catch (error) {
      console.error('獲取文件符號失敗:', error);
      return [];
    }
  }

  private convertDocumentSymbols(symbols: vscode.DocumentSymbol[]): CodeSymbol[] {
    return symbols.map(symbol => ({
      name: symbol.name,
      kind: symbol.kind,
      range: symbol.range,
      detail: symbol.detail,
      children: symbol.children ? this.convertDocumentSymbols(symbol.children) : undefined
    }));
  }

  async findSymbolAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<CodeSymbol | undefined> {
    const symbols = await this.getDocumentSymbols(document);
    return this.findSymbolInRange(symbols, position);
  }

  private findSymbolInRange(symbols: CodeSymbol[], position: vscode.Position): CodeSymbol | undefined {
    for (const symbol of symbols) {
      if (symbol.range.contains(position)) {
        // 先檢查子符號
        if (symbol.children) {
          const childSymbol = this.findSymbolInRange(symbol.children, position);
          if (childSymbol) {
            return childSymbol;
          }
        }
        return symbol;
      }
    }
    return undefined;
  }

  async getFunctionContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<{ function: CodeSymbol; code: string } | undefined> {
    const symbol = await this.findSymbolAtPosition(document, position);

    if (symbol && (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Method)) {
      const code = document.getText(symbol.range);
      return { function: symbol, code };
    }

    return undefined;
  }

  async getClassContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<{ class: CodeSymbol; methods: CodeSymbol[]; code: string } | undefined> {
    const symbols = await this.getDocumentSymbols(document);

    for (const symbol of symbols) {
      if (symbol.kind === vscode.SymbolKind.Class && symbol.range.contains(position)) {
        const methods =
          symbol.children?.filter(
            child => child.kind === vscode.SymbolKind.Method || child.kind === vscode.SymbolKind.Function
          ) || [];

        const code = document.getText(symbol.range);
        return { class: symbol, methods, code };
      }
    }

    return undefined;
  }

  private async findRelatedFiles(document: vscode.TextDocument, selectedCode: string): Promise<string[]> {
    const relatedFiles: string[] = [];

    try {
      // 從 imports 中尋找相關檔案
      const imports = await this.codeParser.extractImports(document);

      for (const importPath of imports) {
        const resolvedPath = await this.resolveImportPath(document.uri, importPath);
        if (resolvedPath) {
          relatedFiles.push(resolvedPath);
        }
      }

      // 從選取的程式碼中尋找可能的檔案引用
      const fileReferences = this.extractFileReferences(selectedCode);
      relatedFiles.push(...fileReferences);
    } catch (error) {
      console.error('尋找相關檔案失敗:', error);
    }

    return [...new Set(relatedFiles)]; // 去重
  }

  private async resolveImportPath(baseUri: vscode.Uri, importPath: string): Promise<string | undefined> {
    try {
      // 簡單的路徑解析邏輯
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(baseUri);
        if (workspaceFolder) {
          const resolvedUri = vscode.Uri.joinPath(workspaceFolder.uri, importPath);
          return resolvedUri.fsPath;
        }
      }
    } catch (error) {
      console.error('解析 import 路徑失敗:', error);
    }
    return undefined;
  }

  private extractFileReferences(code: string): string[] {
    const fileReferences: string[] = [];

    // 尋找可能的檔案路徑模式
    const patterns = [
      /['"`]([^'"`]+\.(ts|js|py|java|cpp|cs|go|rs))['"`]/g,
      /import\s+.*from\s+['"`]([^'"`]+)['"`]/g,
      /require\(['"`]([^'"`]+)['"`]\)/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        fileReferences.push(match[1]);
      }
    }

    return fileReferences;
  }

  async updateIndex(document: vscode.TextDocument): Promise<void> {
    try {
      const symbols = await this.getDocumentSymbols(document);
      this.symbolIndex.set(document.uri.fsPath, symbols);
    } catch (error) {
      console.error('更新程式碼索引失敗:', error);
    }
  }

  searchSymbols(query: string): CodeSymbol[] {
    const results: CodeSymbol[] = [];

    for (const symbols of this.symbolIndex.values()) {
      const matches = this.searchInSymbols(symbols, query);
      results.push(...matches);
    }

    return results;
  }

  private searchInSymbols(symbols: CodeSymbol[], query: string): CodeSymbol[] {
    const results: CodeSymbol[] = [];

    for (const symbol of symbols) {
      if (symbol.name.toLowerCase().includes(query.toLowerCase())) {
        results.push(symbol);
      }

      if (symbol.children) {
        const childResults = this.searchInSymbols(symbol.children, query);
        results.push(...childResults);
      }
    }

    return results;
  }

  getIndexStats(): { totalFiles: number; totalSymbols: number } {
    let totalSymbols = 0;

    for (const symbols of this.symbolIndex.values()) {
      totalSymbols += this.countSymbols(symbols);
    }

    return {
      totalFiles: this.symbolIndex.size,
      totalSymbols
    };
  }

  private countSymbols(symbols: CodeSymbol[]): number {
    let count = symbols.length;

    for (const symbol of symbols) {
      if (symbol.children) {
        count += this.countSymbols(symbol.children);
      }
    }

    return count;
  }

  clearIndex(): void {
    this.symbolIndex.clear();
  }

  /**
   * 獲取智能上下文
   * 根據選取的程式碼類型，提供最相關的上下文信息
   */
  async getSmartContext(document: vscode.TextDocument, selection: vscode.Selection): Promise<CodeContext> {
    const context = await this.getCodeContext(document, selection);

    await this.enhanceContextWithFunctionInfo(document, selection, context);
    await this.enhanceContextWithClassInfo(document, selection, context);

    return context;
  }

  /**
   * 增強上下文的函數信息
   */
  private async enhanceContextWithFunctionInfo(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    context: CodeContext
  ): Promise<void> {
    const functionContext = await this.getFunctionContext(document, selection.start);
    if (functionContext) {
      context.surroundingCode = functionContext.code;
    }
  }

  /**
   * 增強上下文的類別信息
   */
  private async enhanceContextWithClassInfo(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    context: CodeContext
  ): Promise<void> {
    const classContext = await this.getClassContext(document, selection.start);
    if (classContext) {
      context.symbols = [classContext.class];
    }
  }

  /**
   * 代碼片段管理
   */
  private codeSnippets: CodeSnippet[] = [];

  /**
   * 添加代碼片段
   */
  async addCodeSnippet(snippet: CodeSnippet): Promise<void> {
    this.codeSnippets.push(snippet);
  }

  /**
   * 獲取所有代碼片段
   */
  getCodeSnippets(): CodeSnippet[] {
    return [...this.codeSnippets];
  }

  clearContext(): void {
    this.codeSnippets = [];
    this.symbolIndex.clear();
  }

  /**
   * 初始化文件監視器
   */
  private initializeFileWatcher(): void {
    // 監視所有支持的文件類型
    const pattern =
      '**/*.{ts,js,tsx,jsx,py,java,kt,swift,cpp,c,cs,go,rs,php,rb,dart,html,css,scss,less,json,xml,yaml,yml,md,txt,sql,sh,bat,ps1,vue,svelte}';
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.fileWatcher.onDidChange(uri => {
      // 只有當文件應該被索引時才處理變更
      if (this.shouldIndexFile(uri)) {
        this.invalidateSymbolCache(uri.fsPath);
      }
    });

    this.fileWatcher.onDidCreate(uri => {
      // indexFile 方法內部已經有過濾邏輯
      this.indexFile(uri);
    });

    this.fileWatcher.onDidDelete(uri => {
      this.removeFromIndex(uri.fsPath);
    });
  }

  /**
   * 檢查文件是否應該被索引
   */
  private shouldIndexFile(uri: vscode.Uri): boolean {
    const filePath = uri.fsPath;
    const fileName = uri.path.split('/').pop() || '';

    // 排除 macOS 元數據文件
    if (fileName.startsWith('._')) {
      return false;
    }

    // 排除 __MACOSX 目錄
    if (filePath.includes('__MACOSX')) {
      return false;
    }

    // 排除其他系統文件
    const excludePatterns = [
      '.DS_Store',
      'Thumbs.db',
      'desktop.ini',
      '.git/',
      'node_modules/',
      '.vscode/',
      'dist/',
      'build/',
      'out/',
      '.nyc_output/',
      'coverage/'
    ];

    return !excludePatterns.some(pattern => filePath.includes(pattern) || fileName === pattern);
  }

  /**
   * 檢查文件是否為文本文件
   */
  private isTextFile(uri: vscode.Uri): boolean {
    const ext = uri.path.split('.').pop()?.toLowerCase() || '';
    const textExtensions = [
      'ts',
      'js',
      'tsx',
      'jsx',
      'py',
      'java',
      'kt',
      'swift',
      'cpp',
      'c',
      'cs',
      'go',
      'rs',
      'php',
      'rb',
      'dart',
      'html',
      'css',
      'scss',
      'less',
      'json',
      'xml',
      'yaml',
      'yml',
      'md',
      'txt',
      'sql',
      'sh',
      'bat',
      'ps1',
      'vue',
      'svelte'
    ];
    return textExtensions.includes(ext);
  }

  /**
   * 索引單個文件
   */
  async indexFile(uri: vscode.Uri): Promise<void> {
    // 檢查文件是否應該被索引
    if (!this.shouldIndexFile(uri)) {
      return;
    }

    // 檢查是否為文本文件
    if (!this.isTextFile(uri)) {
      return;
    }

    try {
      // 使用 file scheme 確保只處理磁盤上的文件
      if (uri.scheme !== 'file') {
        return;
      }

      const document = await vscode.workspace.openTextDocument(uri);
      const symbols = await this.getDocumentSymbols(document);
      this.symbolIndex.set(uri.fsPath, symbols);

      // 分析依賴關係
      const imports = await this.codeParser.extractImports(document);
      this.dependencyGraph.set(uri.fsPath, imports);
    } catch (error) {
      // 只記錄非預期的錯誤，忽略二進制文件錯誤
      if (
        error instanceof Error &&
        !error.message.includes('檔案似乎是二進位檔') &&
        !error.message.includes('binary file')
      ) {
        console.error(`索引文件失敗 ${uri.fsPath}:`, error);
      }
    }
  }

  /**
   * 索引整個工作區
   */
  async indexWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    // 包含的文件模式
    const includePattern = new vscode.RelativePattern(
      workspaceFolder,
      '**/*.{ts,js,tsx,jsx,py,java,kt,swift,cpp,c,cs,go,rs,php,rb,dart,html,css,scss,less,json,xml,yaml,yml,md,txt,sql,sh,bat,ps1,vue,svelte}'
    );

    // 排除的文件模式
    const excludePattern = new vscode.RelativePattern(
      workspaceFolder,
      '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/__MACOSX/**,**/.DS_Store,**/Thumbs.db,**/desktop.ini,**/.vscode/**,**/.nyc_output/**,**/coverage/**,**/._*}'
    );

    const files = await vscode.workspace.findFiles(includePattern, excludePattern);

    // 使用批次處理來避免同時處理太多文件
    const batchSize = 50;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const indexPromises = batch.map(uri => this.indexFile(uri));
      await Promise.all(indexPromises);
    }
  }

  /**
   * 失效符號緩存
   */
  private invalidateSymbolCache(filePath: string): void {
    this.symbolIndex.delete(filePath);
    this.dependencyGraph.delete(filePath);
  }

  /**
   * 從索引中移除文件
   */
  private removeFromIndex(filePath: string): void {
    this.symbolIndex.delete(filePath);
    this.dependencyGraph.delete(filePath);
  }

  /**
   * 獲取文件的依賴關係
   */
  getDependencies(filePath: string): string[] {
    return this.dependencyGraph.get(filePath) || [];
  }

  /**
   * 獲取依賴於指定文件的文件列表
   */
  getDependents(filePath: string): string[] {
    const dependents: string[] = [];

    for (const [file, dependencies] of this.dependencyGraph.entries()) {
      if (dependencies.includes(filePath)) {
        dependents.push(file);
      }
    }

    return dependents;
  }

  /**
   * 清理資源
   */
  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }
}
