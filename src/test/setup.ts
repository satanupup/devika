
// Mock VS Code API
const mockVSCode = {
  window: {
    showInformationMessage: sinon.stub(),
    showWarningMessage: sinon.stub(),
    showErrorMessage: sinon.stub(),
    createStatusBarItem: sinon.stub().returns({
      text: '',
      tooltip: '',
      show: sinon.stub(),
      hide: sinon.stub(),
      dispose: sinon.stub()
    }),
    createWebviewPanel: sinon.stub(),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: sinon.stub()
  },
  workspace: {
    workspaceFolders: [],
    getConfiguration: sinon.stub().returns({
      get: sinon.stub(),
      update: sinon.stub(),
      has: sinon.stub()
    }),
    onDidChangeConfiguration: sinon.stub(),
    findFiles: sinon.stub(),
    fs: {
      readFile: sinon.stub(),
      writeFile: sinon.stub(),
      readDirectory: sinon.stub()
    }
  },
  commands: {
    registerCommand: sinon.stub(),
    executeCommand: sinon.stub()
  },
  Uri: {
    file: sinon.stub().callsFake((path: string) => ({ fsPath: path, path })),
    joinPath: sinon.stub()
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Beside: -2
  },
  FileType: {
    File: 1,
    Directory: 2,
    SymbolicLink: 64
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
  EventEmitter: sinon.stub().returns({
    event: sinon.stub(),
    fire: sinon.stub(),
    dispose: sinon.stub()
  }),
  Disposable: sinon.stub().returns({
    dispose: sinon.stub()
  }),
  Range: sinon.stub(),
  Position: sinon.stub(),
  Selection: sinon.stub(),
  TextEdit: {
    replace: sinon.stub(),
    insert: sinon.stub(),
    delete: sinon.stub()
  },
  WorkspaceEdit: sinon.stub().returns({
    set: sinon.stub(),
    replace: sinon.stub(),
    insert: sinon.stub(),
    delete: sinon.stub()
  })
};

// Mock Node.js modules - using require.cache manipulation for Mocha
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'fs') {
    return {
      promises: {
        readFile: sinon.stub(),
        writeFile: sinon.stub(),
        readdir: sinon.stub(),
        stat: sinon.stub(),
        mkdir: sinon.stub(),
        access: sinon.stub()
      },
      existsSync: sinon.stub(),
      readFileSync: sinon.stub(),
      writeFileSync: sinon.stub()
    };
  }

  if (id === 'path') {
    return {
      join: sinon.stub().callsFake((...args: string[]) => args.join('/')),
      resolve: sinon.stub().callsFake((...args: string[]) => args.join('/')),
      dirname: sinon.stub().callsFake((path: string) => path.split('/').slice(0, -1).join('/')),
      basename: sinon.stub().callsFake((path: string) => path.split('/').pop() || ''),
      extname: sinon.stub().callsFake((path: string) => {
        const parts = path.split('.');
        return parts.length > 1 ? '.' + parts.pop() : '';
      }),
      relative: sinon.stub(),
      isAbsolute: sinon.stub()
    };
  }

  return originalRequire.apply(this, arguments);
};

  // Continue with other mocks
  if (id === 'sqlite3') {
    return {
      Database: sinon.stub().returns({
        run: sinon.stub().callsFake((sql: string, params: any[], callback?: Function) => {
          if (callback) callback(null);
        }),
        get: sinon.stub().callsFake((sql: string, params: any[], callback?: Function) => {
          if (callback) callback(null, {});
        }),
        all: sinon.stub().callsFake((sql: string, params: any[], callback?: Function) => {
          if (callback) callback(null, []);
        }),
        close: sinon.stub().callsFake((callback?: Function) => {
          if (callback) callback(null);
        })
      })
    };
  }

  if (id === 'axios') {
    return {
      default: {
        get: sinon.stub(),
        post: sinon.stub(),
        put: sinon.stub(),
        delete: sinon.stub()
      },
      get: sinon.stub(),
      post: sinon.stub(),
      put: sinon.stub(),
      delete: sinon.stub()
    };
  }

// Set up global mocks
(global as any).vscode = mockVSCode;

// Set up test environment
beforeEach(() => {
  sinon.restore();
});

afterEach(() => {
  sinon.restore();
});
