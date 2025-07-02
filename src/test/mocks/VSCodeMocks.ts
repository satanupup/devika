import * as sinon from 'sinon';

/**
 * VS Code API 模擬物件
 */
export class VSCodeMocks {
  /**
   * 創建模擬的 VS Code 文檔
   */
  static createMockDocument(overrides: any = {}) {
    return {
      uri: { fsPath: '/test/file.ts', path: '/test/file.ts' },
      fileName: 'file.ts',
      languageId: 'typescript',
      version: 1,
      isDirty: false,
      isClosed: false,
      lineCount: 10,
      getText: sinon.stub().returns('mock file content'),
      getWordRangeAtPosition: sinon.stub(),
      lineAt: sinon.stub().callsFake((line: number) => ({
        lineNumber: line,
        text: `line ${line + 1} content`,
        range: { start: { line, character: 0 }, end: { line, character: 20 } },
        rangeIncludingLineBreak: { start: { line, character: 0 }, end: { line, character: 21 } },
        firstNonWhitespaceCharacterIndex: 0,
        isEmptyOrWhitespace: false
      })),
      offsetAt: sinon.stub(),
      positionAt: sinon.stub(),
      validateRange: sinon.stub(),
      validatePosition: sinon.stub(),
      save: sinon.stub(),
      ...overrides
    };
  }

  /**
   * 創建模擬的 VS Code 編輯器
   */
  static createMockEditor(overrides: any = {}) {
    return {
      document: this.createMockDocument(),
      selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      selections: [],
      visibleRanges: [],
      options: {
        cursorStyle: 1,
        insertSpaces: true,
        lineNumbers: 1,
        tabSize: 2
      },
      viewColumn: 1,
      edit: sinon.stub(),
      insertSnippet: sinon.stub(),
      setDecorations: sinon.stub(),
      revealRange: sinon.stub(),
      show: sinon.stub(),
      hide: sinon.stub(),
      ...overrides
    };
  }

  /**
   * 創建模擬的 VS Code 工作區
   */
  static createMockWorkspace(overrides: any = {}) {
    return {
      workspaceFolders: [
        {
          uri: { fsPath: '/test/workspace', path: '/test/workspace' },
          name: 'test-workspace',
          index: 0
        }
      ],
      name: 'test-workspace',
      getConfiguration: sinon.stub().returns({
        get: sinon.stub(),
        update: sinon.stub(),
        has: sinon.stub(),
        inspect: sinon.stub()
      }),
      getWorkspaceFolder: sinon.stub(),
      asRelativePath: sinon.stub().callsFake((path: string) => path.replace('/test/workspace/', '')),
      findFiles: sinon.stub().resolves([]),
      openTextDocument: sinon.stub(),
      saveAll: sinon.stub(),
      applyEdit: sinon.stub(),
      createFileSystemWatcher: sinon.stub(),
      onDidChangeConfiguration: sinon.stub(),
      onDidChangeWorkspaceFolders: sinon.stub(),
      onDidChangeTextDocument: sinon.stub(),
      onDidOpenTextDocument: sinon.stub(),
      onDidCloseTextDocument: sinon.stub(),
      onDidSaveTextDocument: sinon.stub(),
      fs: {
        readFile: sinon.stub(),
        writeFile: sinon.stub(),
        readDirectory: sinon.stub(),
        createDirectory: sinon.stub(),
        delete: sinon.stub(),
        stat: sinon.stub(),
        copy: sinon.stub(),
        rename: sinon.stub()
      },
      ...overrides
    };
  }

  /**
   * 創建模擬的 VS Code 窗口
   */
  static createMockWindow(overrides: any = {}) {
    return {
      activeTextEditor: this.createMockEditor(),
      visibleTextEditors: [],
      terminals: [],
      activeTerminal: null,
      showInformationMessage: sinon.stub(),
      showWarningMessage: sinon.stub(),
      showErrorMessage: sinon.stub(),
      showQuickPick: sinon.stub(),
      showInputBox: sinon.stub(),
      showOpenDialog: sinon.stub(),
      showSaveDialog: sinon.stub(),
      showWorkspaceFolderPick: sinon.stub(),
      createStatusBarItem: sinon.stub().returns({
        alignment: 1,
        priority: 0,
        text: '',
        tooltip: '',
        color: undefined,
        backgroundColor: undefined,
        command: undefined,
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub()
      }),
      createOutputChannel: sinon.stub().returns({
        name: 'test-channel',
        append: sinon.stub(),
        appendLine: sinon.stub(),
        clear: sinon.stub(),
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub()
      }),
      createWebviewPanel: sinon.stub().returns({
        webview: {
          html: '',
          options: {},
          cspSource: 'vscode-webview:',
          asWebviewUri: sinon.stub(),
          postMessage: sinon.stub(),
          onDidReceiveMessage: sinon.stub()
        },
        title: 'Test Panel',
        viewType: 'test',
        viewColumn: 1,
        active: true,
        visible: true,
        onDidDispose: sinon.stub(),
        onDidChangeViewState: sinon.stub(),
        reveal: sinon.stub(),
        dispose: sinon.stub()
      }),
      createTerminal: sinon.stub().returns({
        name: 'test-terminal',
        processId: Promise.resolve(1234),
        creationOptions: {},
        exitStatus: undefined,
        sendText: sinon.stub(),
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub()
      }),
      onDidChangeActiveTextEditor: sinon.stub(),
      onDidChangeVisibleTextEditors: sinon.stub(),
      onDidChangeTextEditorSelection: sinon.stub(),
      onDidChangeTextEditorVisibleRanges: sinon.stub(),
      onDidChangeTextEditorOptions: sinon.stub(),
      onDidChangeTextEditorViewColumn: sinon.stub(),
      onDidChangeActiveTerminal: sinon.stub(),
      onDidCloseTerminal: sinon.stub(),
      onDidOpenTerminal: sinon.stub(),
      registerTreeDataProvider: sinon.stub(),
      createTreeView: sinon.stub(),
      registerWebviewViewProvider: sinon.stub(),
      ...overrides
    };
  }

  /**
   * 創建模擬的 VS Code 命令
   */
  static createMockCommands(overrides: any = {}) {
    return {
      registerCommand: sinon.stub(),
      registerTextEditorCommand: sinon.stub(),
      executeCommand: sinon.stub(),
      getCommands: sinon.stub().resolves([]),
      onDidExecuteCommand: sinon.stub(),
      ...overrides
    };
  }

  /**
   * 創建完整的 VS Code API 模擬
   */
  static createMockVSCode(overrides: any = {}) {
    return {
      window: this.createMockWindow(),
      workspace: this.createMockWorkspace(),
      commands: this.createMockCommands(),
      languages: {
        createDiagnosticCollection: sinon.stub().returns({
          name: 'test-diagnostics',
          set: sinon.stub(),
          delete: sinon.stub(),
          clear: sinon.stub(),
          forEach: sinon.stub(),
          get: sinon.stub(),
          has: sinon.stub(),
          dispose: sinon.stub()
        }),
        getDiagnostics: sinon.stub(),
        getLanguages: sinon.stub().resolves(['typescript', 'javascript']),
        setTextDocumentLanguage: sinon.stub(),
        match: sinon.stub(),
        registerCodeActionsProvider: sinon.stub(),
        registerCodeLensProvider: sinon.stub(),
        registerDefinitionProvider: sinon.stub(),
        registerHoverProvider: sinon.stub(),
        registerDocumentSymbolProvider: sinon.stub(),
        registerWorkspaceSymbolProvider: sinon.stub(),
        registerReferenceProvider: sinon.stub(),
        registerRenameProvider: sinon.stub(),
        registerDocumentFormattingEditProvider: sinon.stub(),
        registerDocumentRangeFormattingEditProvider: sinon.stub(),
        registerOnTypeFormattingEditProvider: sinon.stub(),
        registerSignatureHelpProvider: sinon.stub(),
        registerCompletionItemProvider: sinon.stub(),
        registerDocumentLinkProvider: sinon.stub(),
        registerColorProvider: sinon.stub(),
        registerFoldingRangeProvider: sinon.stub(),
        registerSelectionRangeProvider: sinon.stub(),
        registerCallHierarchyProvider: sinon.stub()
      },
      Uri: {
        file: sinon.stub().callsFake((path: string) => ({ fsPath: path, path, scheme: 'file' })),
        parse: sinon.stub(),
        joinPath: sinon.stub(),
        from: sinon.stub()
      },
      Range: sinon.stub(),
      Position: sinon.stub(),
      Selection: sinon.stub(),
      Location: sinon.stub(),
      Diagnostic: sinon.stub(),
      DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
      },
      ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3,
        Beside: -2
      },
      ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
      },
      StatusBarAlignment: {
        Left: 1,
        Right: 2
      },
      FileType: {
        Unknown: 0,
        File: 1,
        Directory: 2,
        SymbolicLink: 64
      },
      EventEmitter: sinon.stub().returns({
        event: sinon.stub(),
        fire: sinon.stub(),
        dispose: sinon.stub()
      }),
      Disposable: sinon.stub().returns({
        dispose: sinon.stub()
      }),
      ...overrides
    };
  }
}
