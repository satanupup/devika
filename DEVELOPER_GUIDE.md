# 🛠️ Devika VS Code Extension - 開發者指南

<p align="center">
  <img src=".assets/devika-avatar.png" alt="Devika Logo" width="200">
</p>

<h1 align="center">🧩 Devika VS Code Extension - 完整開發指南</h1>

<p align="center">
  <strong>為開發者提供的全面技術文檔</strong>
</p>

---

## 📋 目錄

- [專案概述](#專案概述)
- [技術架構](#技術架構)
- [開發環境設定](#開發環境設定)
- [核心模組開發](#核心模組開發)
- [插件系統](#插件系統)
- [測試策略](#測試策略)
- [部署與發布](#部署與發布)
- [最佳實踐](#最佳實踐)

---

## 🎯 專案概述

### 核心理念

Devika VS Code Extension 是一個**類 Augment 插件系統**，設計為：
- **智能情境感知**: 透過程式碼索引和語法樹分析，精準定位相關程式碼片段
- **任務模組化**: 將複雜需求拆解成可重複使用的任務模組
- **工作流自動化**: 自動執行重複性開發任務
- **深度整合**: 與 VS Code、Git、AI 模型深度整合

### 技術目標

- **平台無關**: 核心邏輯可移植到其他 IDE
- **高性能**: 啟動時間 < 2 秒，記憶體使用 < 100MB
- **可擴展**: 模組化架構，支援插件開發
- **類型安全**: 100% TypeScript，嚴格類型檢查

---

## 🏗️ 技術架構

### 整體架構

```
devika/
├── devika-core/              # 🧠 平台無關的 AI 核心引擎
│   ├── src/
│   │   ├── interfaces/       # 抽象介面定義
│   │   ├── llm/             # AI 模型服務
│   │   ├── context/         # 程式碼情境分析
│   │   ├── tasks/           # 任務管理引擎
│   │   ├── git/             # Git 操作核心
│   │   └── plugins/         # 插件系統
│   └── package.json
└── src/                      # 🎨 VS Code Extension 實作
    ├── core/                # 核心管理器
    ├── llm/                 # AI 模型服務
    ├── context/             # 程式碼情境智能
    ├── tasks/               # 任務管理
    ├── git/                 # Git 整合
    ├── ui/                  # 使用者介面
    ├── config/              # 配置管理
    └── extension.ts         # 擴充功能入口點
```

### 核心設計模式

**1. 依賴注入 (Dependency Injection)**
```typescript
// src/core/DependencyContainer.ts
export class DependencyContainer {
    private services = new Map<string, any>();
    
    register<T>(name: string, service: T): void {
        this.services.set(name, service);
    }
    
    resolve<T>(name: string): T {
        return this.services.get(name);
    }
}
```

**2. 事件驅動架構 (Event-Driven Architecture)**
```typescript
// src/core/EventBus.ts
export class EventBus {
    private listeners = new Map<string, Function[]>();
    
    on(event: string, callback: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }
    
    emit(event: string, data?: any): void {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }
}
```

**3. 策略模式 (Strategy Pattern)**
```typescript
// src/llm/LLMService.ts
export interface LLMProvider {
    generateResponse(prompt: string): Promise<string>;
}

export class LLMService {
    constructor(private provider: LLMProvider) {}
    
    async analyze(code: string): Promise<string> {
        return this.provider.generateResponse(`Analyze: ${code}`);
    }
}
```

---

## ⚙️ 開發環境設定

### 必要工具

```bash
# Node.js 18+ 和 npm
node --version  # >= 18.0.0
npm --version   # >= 8.0.0

# VS Code 1.74+
code --version  # >= 1.74.0

# Git
git --version
```

### 專案設定

```bash
# 1. 複製儲存庫
git clone https://github.com/satanupup/devika.git
cd devika

# 2. 安裝依賴
npm install

# 3. 編譯 TypeScript
npm run compile

# 4. 啟動監視模式
npm run watch

# 5. 在 VS Code 中開啟
code .

# 6. 啟動除錯 (F5)
```

### 開發腳本

```json
{
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext ts --fix",
    "package": "vsce package",
    "publish": "vsce publish"
  }
}
```

### TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out", "**/*.test.ts"]
}
```

---

## 🧩 核心模組開發

### 1. DevikaCoreManager

**職責**: 協調所有核心服務的生命週期

```typescript
// src/core/DevikaCoreManager.ts
export class DevikaCoreManager {
    private services: Map<string, any> = new Map();
    private initialized = false;
    
    constructor(private context: vscode.ExtensionContext) {}
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // 初始化核心服務
        await this.initializeServices();
        
        // 註冊事件監聽器
        this.registerEventListeners();
        
        this.initialized = true;
    }
    
    private async initializeServices(): Promise<void> {
        // 按依賴順序初始化服務
        const configManager = new ConfigManager(this.context);
        const llmService = new LLMService(configManager);
        const taskManager = new TaskManager(this.context);
        
        this.services.set('config', configManager);
        this.services.set('llm', llmService);
        this.services.set('tasks', taskManager);
    }
}
```

### 2. LLM 服務架構

**設計原則**: 支援多個 AI 提供商，統一介面

```typescript
// src/llm/providers/ClaudeProvider.ts
export class ClaudeProvider implements LLMProvider {
    constructor(private apiKey: string) {}
    
    async generateResponse(prompt: string): Promise<string> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4000
            })
        });
        
        const data = await response.json();
        return data.content[0].text;
    }
}
```

### 3. 任務管理系統

**特色**: 將 AI 建議轉換為可追蹤的任務

```typescript
// src/tasks/TaskManager.ts
export interface Task {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    createdAt: Date;
    updatedAt: Date;
    fileUri?: vscode.Uri;
    lineNumber?: number;
}

export class TaskManager {
    private tasks: Map<string, Task> = new Map();
    private storage: TaskStorage;
    
    constructor(context: vscode.ExtensionContext) {
        this.storage = new TaskStorage(context);
    }
    
    async createTask(taskData: Partial<Task>): Promise<Task> {
        const task: Task = {
            id: generateUUID(),
            title: taskData.title || '',
            description: taskData.description || '',
            status: 'pending',
            priority: taskData.priority || 'medium',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...taskData
        };
        
        this.tasks.set(task.id, task);
        await this.storage.saveTask(task);
        
        // 發送事件
        this.eventBus.emit('task:created', task);
        
        return task;
    }
}
```

### 4. 程式碼上下文分析

**技術**: 使用 Tree-sitter 進行語法分析

```typescript
// src/context/CodeParser.ts
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';

export class CodeParser {
    private parsers: Map<string, Parser> = new Map();
    
    constructor() {
        this.initializeParsers();
    }
    
    private initializeParsers(): void {
        // JavaScript Parser
        const jsParser = new Parser();
        jsParser.setLanguage(JavaScript);
        this.parsers.set('javascript', jsParser);
        
        // TypeScript Parser
        const tsParser = new Parser();
        tsParser.setLanguage(TypeScript.typescript);
        this.parsers.set('typescript', tsParser);
    }
    
    parseCode(code: string, language: string): ParseResult {
        const parser = this.parsers.get(language);
        if (!parser) {
            throw new Error(`Unsupported language: ${language}`);
        }
        
        const tree = parser.parse(code);
        return this.extractSymbols(tree);
    }
    
    private extractSymbols(tree: Parser.Tree): ParseResult {
        const symbols: Symbol[] = [];
        
        const traverse = (node: Parser.SyntaxNode) => {
            if (node.type === 'function_declaration') {
                symbols.push({
                    name: this.extractFunctionName(node),
                    type: 'function',
                    startPosition: node.startPosition,
                    endPosition: node.endPosition
                });
            }
            
            for (const child of node.children) {
                traverse(child);
            }
        };
        
        traverse(tree.rootNode);
        return { symbols, tree };
    }
}
```

---

## 🔌 插件系統

### Augment 插件架構

**設計目標**: 讓開發者能夠創建自己的 AI 助手

```typescript
// src/plugins/PluginManager.ts
export interface AugmentPlugin {
    id: string;
    name: string;
    version: string;
    activate(context: PluginContext): Promise<void>;
    deactivate(): Promise<void>;
}

export interface PluginContext {
    llmService: LLMService;
    taskManager: TaskManager;
    fileSystem: FileSystemService;
    ui: UIService;
}

export class PluginManager {
    private plugins: Map<string, AugmentPlugin> = new Map();
    
    async loadPlugin(pluginPath: string): Promise<void> {
        const plugin = await import(pluginPath);
        const instance = new plugin.default();
        
        await instance.activate(this.createPluginContext());
        this.plugins.set(instance.id, instance);
    }
    
    private createPluginContext(): PluginContext {
        return {
            llmService: this.container.resolve('llm'),
            taskManager: this.container.resolve('tasks'),
            fileSystem: this.container.resolve('fileSystem'),
            ui: this.container.resolve('ui')
        };
    }
}
```

### 插件開發範例

```typescript
// plugins/code-reviewer/index.ts
export default class CodeReviewerPlugin implements AugmentPlugin {
    id = 'code-reviewer';
    name = 'AI Code Reviewer';
    version = '1.0.0';
    
    async activate(context: PluginContext): Promise<void> {
        // 註冊命令
        vscode.commands.registerCommand('codeReviewer.review', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            const code = editor.document.getText();
            const review = await context.llmService.generateResponse(
                `Please review this code and provide suggestions:\n\n${code}`
            );
            
            // 創建任務
            await context.taskManager.createTask({
                title: 'Code Review Suggestions',
                description: review,
                fileUri: editor.document.uri
            });
        });
    }
    
    async deactivate(): Promise<void> {
        // 清理資源
    }
}
```

---

## 🧪 測試策略

### 測試架構

```
tests/
├── unit/                    # 單元測試
│   ├── core/
│   ├── llm/
│   └── tasks/
├── integration/             # 整合測試
│   ├── api/
│   └── workflows/
└── e2e/                     # 端到端測試
    └── extension/
```

### 單元測試範例

```typescript
// tests/unit/tasks/TaskManager.test.ts
import { TaskManager } from '../../../src/tasks/TaskManager';
import { MockExtensionContext } from '../../mocks/MockExtensionContext';

describe('TaskManager', () => {
    let taskManager: TaskManager;
    let mockContext: MockExtensionContext;
    
    beforeEach(() => {
        mockContext = new MockExtensionContext();
        taskManager = new TaskManager(mockContext);
    });
    
    describe('createTask', () => {
        it('should create a task with default values', async () => {
            const task = await taskManager.createTask({
                title: 'Test Task',
                description: 'Test Description'
            });
            
            expect(task.id).toBeDefined();
            expect(task.title).toBe('Test Task');
            expect(task.status).toBe('pending');
            expect(task.priority).toBe('medium');
        });
        
        it('should emit task:created event', async () => {
            const eventSpy = jest.spyOn(taskManager['eventBus'], 'emit');
            
            await taskManager.createTask({
                title: 'Test Task'
            });
            
            expect(eventSpy).toHaveBeenCalledWith('task:created', expect.any(Object));
        });
    });
});
```

### 整合測試範例

```typescript
// tests/integration/llm/LLMService.test.ts
import { LLMService } from '../../../src/llm/LLMService';
import { MockLLMProvider } from '../../mocks/MockLLMProvider';

describe('LLMService Integration', () => {
    let llmService: LLMService;
    
    beforeEach(() => {
        const mockProvider = new MockLLMProvider();
        llmService = new LLMService(mockProvider);
    });
    
    it('should analyze code and return suggestions', async () => {
        const code = `
            function calculateSum(a, b) {
                return a + b;
            }
        `;
        
        const result = await llmService.analyzeCode(code, 'javascript');
        
        expect(result).toContain('function');
        expect(result).toContain('suggestion');
    });
});
```

### 測試配置

```json
// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/test/**'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    }
};
```

---

## 🚀 部署與發布

### 建置流程

```bash
# 1. 清理舊建置
npm run clean

# 2. 類型檢查
npm run typecheck

# 3. 代碼檢查
npm run lint

# 4. 執行測試
npm test

# 5. 編譯
npm run compile

# 6. 打包
npm run package
```

### 版本管理

```bash
# 更新版本號
npm version patch  # 0.1.0 -> 0.1.1
npm version minor  # 0.1.1 -> 0.2.0
npm version major  # 0.2.0 -> 1.0.0

# 發布到 VS Code Marketplace
npm run publish
```

### CI/CD 配置

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run compile
    
    - name: Package
      run: npm run package
    
    - name: Upload artifact
      uses: actions/upload-artifact@v3
      with:
        name: extension-package
        path: '*.vsix'
```

---

## 📚 最佳實踐

### 代碼規範

1. **使用 TypeScript 嚴格模式**
2. **遵循 ESLint 規則**
3. **撰寫清晰的註釋**
4. **保持函數簡潔** (< 50 行)
5. **使用有意義的變數名稱**

### 性能優化

1. **懶加載非關鍵模組**
2. **使用 Web Workers 處理重型任務**
3. **實施智能快取策略**
4. **優化 API 調用頻率**
5. **監控記憶體使用**

### 安全考量

1. **驗證所有外部輸入**
2. **安全儲存 API 金鑰**
3. **實施請求限制**
4. **定期更新依賴項**
5. **遵循最小權限原則**

### 文檔維護

1. **保持 README 更新**
2. **撰寫 API 文檔**
3. **提供使用範例**
4. **記錄變更歷史**
5. **建立故障排除指南**

---

*最後更新: 2025-07-02*
