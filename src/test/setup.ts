import { jest } from '@jest/globals';

// Mock VS Code API
const mockVSCode = {
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createStatusBarItem: jest.fn(() => ({
      text: '',
      tooltip: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    })),
    createWebviewPanel: jest.fn(),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: jest.fn()
  },
  workspace: {
    workspaceFolders: [],
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn(),
      has: jest.fn()
    })),
    onDidChangeConfiguration: jest.fn(),
    findFiles: jest.fn(),
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      readDirectory: jest.fn()
    }
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    joinPath: jest.fn()
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
  EventEmitter: jest.fn(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn()
  })),
  Disposable: jest.fn(() => ({
    dispose: jest.fn()
  })),
  Range: jest.fn(),
  Position: jest.fn(),
  Selection: jest.fn(),
  TextEdit: {
    replace: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn()
  },
  WorkspaceEdit: jest.fn(() => ({
    set: jest.fn(),
    replace: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn()
  }))
};

// Mock Node.js modules
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn()
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
  dirname: jest.fn((path: string) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path: string) => path.split('/').pop() || ''),
  extname: jest.fn((path: string) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
  relative: jest.fn(),
  isAbsolute: jest.fn()
}));

// Mock sqlite3
jest.mock('sqlite3', () => ({
  Database: jest.fn(() => ({
    run: jest.fn((sql: string, params: any[], callback?: Function) => {
      if (callback) callback(null);
    }),
    get: jest.fn((sql: string, params: any[], callback?: Function) => {
      if (callback) callback(null, {});
    }),
    all: jest.fn((sql: string, params: any[], callback?: Function) => {
      if (callback) callback(null, []);
    }),
    close: jest.fn((callback?: Function) => {
      if (callback) callback(null);
    })
  }))
}));

// Mock axios
jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

// Set up global mocks
(global as any).vscode = mockVSCode;

// Set up test environment
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
