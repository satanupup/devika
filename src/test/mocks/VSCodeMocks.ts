import { jest } from '@jest/globals';

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
      getText: jest.fn(() => 'mock file content'),
      getWordRangeAtPosition: jest.fn(),
      lineAt: jest.fn((line: number) => ({
        lineNumber: line,
        text: `line ${line + 1} content`,
        range: { start: { line, character: 0 }, end: { line, character: 20 } },
        rangeIncludingLineBreak: { start: { line, character: 0 }, end: { line, character: 21 } },
        firstNonWhitespaceCharacterIndex: 0,
        isEmptyOrWhitespace: false
      })),
      offsetAt: jest.fn(),
      positionAt: jest.fn(),
      validateRange: jest.fn(),
      validatePosition: jest.fn(),
      save: jest.fn(),
      ...overrides
    };
  }

  /**
   * 創建模擬的 VS Code 編輯器
   */
  static createMockEditor(document?: any) {
    const mockDocument = document || this.createMockDocument();
    
    return {
      document: mockDocument,
      selection: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 },
        isEmpty: false,
        isReversed: false,
        isSingleLine: true,
        active: { line: 0, character: 10 },
        anchor: { line: 0, character: 0 }
      },
      selections: [],
      visibleRanges: [],
      options: {
        cursorStyle: 1,
        insertSpaces: true,
        lineNumbers: 1,
        tabSize: 2
      },
      viewColumn: 1,
      edit: jest.fn(),
      insertSnippet: jest.fn(),
      setDecorations: jest.fn(),
      revealRange: jest.fn(),
      show: jest.fn(),
      hide: jest.fn()
    };
  }

  /**
   * 創建模擬的 VS Code 工作區
   */
  static createMockWorkspace() {
    return {
      workspaceFolders: [
        {
          uri: { fsPath: '/test/workspace', path: '/test/workspace' },
          name: 'test-workspace',
          index: 0
        }
      ],
      name: 'test-workspace',
      getConfiguration: jest.fn(() => ({
        get: jest.fn(),
        update: jest.fn(),
        has: jest.fn(),
        inspect: jest.fn()
      })),
      getWorkspaceFolder: jest.fn(),
      asRelativePath: jest.fn((path: string) => path.replace('/test/workspace/', '')),
      findFiles: jest.fn(() => Promise.resolve([])),
      openTextDocument: jest.fn(),
      saveAll: jest.fn(),
      applyEdit: jest.fn(),
      createFileSystemWatcher: jest.fn(),
      onDidChangeConfiguration: jest.fn(),
      onDidChangeWorkspaceFolders: jest.fn(),
      onDidChangeTextDocument: jest.fn(),
      onDidOpenTextDocument: jest.fn(),
      onDidCloseTextDocument: jest.fn(),
      onDidSaveTextDocument: jest.fn(),
      fs: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        readDirectory: jest.fn(),
        createDirectory: jest.fn(),
        delete: jest.fn(),
        stat: jest.fn(),
        copy: jest.fn(),
        rename: jest.fn()
      }
    };
  }

  /**
   * 創建模擬的 VS Code 窗口
   */
  static createMockWindow() {
    return {
      activeTextEditor: this.createMockEditor(),
      visibleTextEditors: [],
      terminals: [],
      activeTerminal: null,
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      showQuickPick: jest.fn(),
      showInputBox: jest.fn(),
      showOpenDialog: jest.fn(),
      showSaveDialog: jest.fn(),
      showWorkspaceFolderPick: jest.fn(),
      createStatusBarItem: jest.fn(() => ({
        alignment: 1,
        priority: 0,
        text: '',
        tooltip: '',
        color: undefined,
        backgroundColor: undefined,
        command: undefined,
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
      })),
      createOutputChannel: jest.fn(() => ({
        name: 'test-channel',
        append: jest.fn(),
        appendLine: jest.fn(),
        clear: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
      })),
      createWebviewPanel: jest.fn(() => ({
        webview: {
          html: '',
          options: {},
          cspSource: 'vscode-webview:',
          asWebviewUri: jest.fn(),
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn()
        },
        title: 'Test Panel',
        viewType: 'test',
        viewColumn: 1,
        active: true,
        visible: true,
        onDidDispose: jest.fn(),
        onDidChangeViewState: jest.fn(),
        reveal: jest.fn(),
        dispose: jest.fn()
      })),
      createTerminal: jest.fn(() => ({
        name: 'test-terminal',
        processId: Promise.resolve(1234),
        creationOptions: {},
        exitStatus: undefined,
        sendText: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn()
      })),
      onDidChangeActiveTextEditor: jest.fn(),
      onDidChangeVisibleTextEditors: jest.fn(),
      onDidChangeTextEditorSelection: jest.fn(),
      onDidChangeTextEditorVisibleRanges: jest.fn(),
      onDidChangeTextEditorOptions: jest.fn(),
      onDidChangeTextEditorViewColumn: jest.fn(),
      onDidChangeActiveTerminal: jest.fn(),
      onDidCloseTerminal: jest.fn(),
      onDidOpenTerminal: jest.fn(),
      registerTreeDataProvider: jest.fn(),
      createTreeView: jest.fn(),
      registerWebviewViewProvider: jest.fn()
    };
  }

  /**
   * 創建模擬的 VS Code 命令
   */
  static createMockCommands() {
    return {
      registerCommand: jest.fn(),
      registerTextEditorCommand: jest.fn(),
      executeCommand: jest.fn(),
      getCommands: jest.fn(() => Promise.resolve([])),
      onDidExecuteCommand: jest.fn()
    };
  }

  /**
   * 創建模擬的 VS Code 語言功能
   */
  static createMockLanguages() {
    return {
      createDiagnosticCollection: jest.fn(() => ({
        name: 'test-diagnostics',
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        forEach: jest.fn(),
        get: jest.fn(),
        has: jest.fn(),
        dispose: jest.fn()
      })),
      getDiagnostics: jest.fn(),
      getLanguages: jest.fn(() => Promise.resolve(['typescript', 'javascript'])),
      setTextDocumentLanguage: jest.fn(),
      match: jest.fn(),
      registerCodeActionsProvider: jest.fn(),
      registerCodeLensProvider: jest.fn(),
      registerDefinitionProvider: jest.fn(),
      registerHoverProvider: jest.fn(),
      registerDocumentSymbolProvider: jest.fn(),
      registerWorkspaceSymbolProvider: jest.fn(),
      registerReferenceProvider: jest.fn(),
      registerRenameProvider: jest.fn(),
      registerDocumentFormattingEditProvider: jest.fn(),
      registerDocumentRangeFormattingEditProvider: jest.fn(),
      registerOnTypeFormattingEditProvider: jest.fn(),
      registerSignatureHelpProvider: jest.fn(),
      registerCompletionItemProvider: jest.fn(),
      registerDocumentLinkProvider: jest.fn(),
      registerColorProvider: jest.fn(),
      registerFoldingRangeProvider: jest.fn(),
      registerSelectionRangeProvider: jest.fn(),
      registerCallHierarchyProvider: jest.fn()
    };
  }

  /**
   * 創建完整的 VS Code API 模擬
   */
  static createFullVSCodeMock() {
    return {
      version: '1.74.0',
      workspace: this.createMockWorkspace(),
      window: this.createMockWindow(),
      commands: this.createMockCommands(),
      languages: this.createMockLanguages(),
      debug: {
        activeDebugSession: null,
        activeDebugConsole: null,
        breakpoints: [],
        onDidChangeActiveDebugSession: jest.fn(),
        onDidStartDebugSession: jest.fn(),
        onDidReceiveDebugSessionCustomEvent: jest.fn(),
        onDidTerminateDebugSession: jest.fn(),
        onDidChangeBreakpoints: jest.fn(),
        registerDebugConfigurationProvider: jest.fn(),
        registerDebugAdapterDescriptorFactory: jest.fn(),
        registerDebugAdapterTrackerFactory: jest.fn(),
        startDebugging: jest.fn(),
        addBreakpoints: jest.fn(),
        removeBreakpoints: jest.fn()
      },
      extensions: {
        all: [],
        getExtension: jest.fn(),
        onDidChange: jest.fn()
      },
      env: {
        appName: 'Visual Studio Code',
        appRoot: '/test/vscode',
        language: 'en',
        clipboard: {
          readText: jest.fn(),
          writeText: jest.fn()
        },
        machineId: 'test-machine-id',
        sessionId: 'test-session-id',
        remoteName: undefined,
        shell: '/bin/bash',
        uriScheme: 'vscode',
        openExternal: jest.fn(),
        asExternalUri: jest.fn()
      },
      Uri: {
        file: jest.fn((path: string) => ({ fsPath: path, path, scheme: 'file' })),
        parse: jest.fn(),
        joinPath: jest.fn(),
        from: jest.fn()
      },
      Range: jest.fn(),
      Position: jest.fn(),
      Selection: jest.fn(),
      Location: jest.fn(),
      Diagnostic: jest.fn(),
      DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
      },
      ViewColumn: {
        Active: -1,
        Beside: -2,
        One: 1,
        Two: 2,
        Three: 3,
        Four: 4,
        Five: 5,
        Six: 6,
        Seven: 7,
        Eight: 8,
        Nine: 9
      },
      StatusBarAlignment: {
        Left: 1,
        Right: 2
      },
      TextDocumentSaveReason: {
        Manual: 1,
        AfterDelay: 2,
        FocusOut: 3
      },
      ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
      },
      FileType: {
        Unknown: 0,
        File: 1,
        Directory: 2,
        SymbolicLink: 64
      },
      EventEmitter: jest.fn(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
      })),
      Disposable: jest.fn(() => ({
        dispose: jest.fn()
      })),
      CancellationTokenSource: jest.fn(() => ({
        token: {
          isCancellationRequested: false,
          onCancellationRequested: jest.fn()
        },
        cancel: jest.fn(),
        dispose: jest.fn()
      })),
      TextEdit: {
        replace: jest.fn(),
        insert: jest.fn(),
        delete: jest.fn()
      },
      WorkspaceEdit: jest.fn(() => ({
        set: jest.fn(),
        replace: jest.fn(),
        insert: jest.fn(),
        delete: jest.fn(),
        createFile: jest.fn(),
        deleteFile: jest.fn(),
        renameFile: jest.fn()
      }))
    };
  }
}
