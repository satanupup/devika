# 📚 Devika VS Code Extension - API 參考文檔

<p align="center">
  <img src=".assets/devika-avatar.png" alt="Devika Logo" width="200">
</p>

<h1 align="center">🔌 Devika API 參考文檔</h1>

<p align="center">
  <strong>完整的 API 介面和插件開發指南</strong>
</p>

---

## 📋 目錄

- [核心 API](#核心-api)
- [LLM 服務 API](#llm-服務-api)
- [任務管理 API](#任務管理-api)
- [代碼完成 API](#代碼完成-api)
- [學習系統 API](#學習系統-api)
- [插件開發 API](#插件開發-api)
- [事件系統](#事件系統)
- [類型定義](#類型定義)

---

## 🧩 核心 API

### DevikaCoreManager

主要的核心管理器，協調所有服務。

```typescript
class DevikaCoreManager {
    constructor(context: vscode.ExtensionContext)
    
    // 初始化核心管理器
    async initialize(): Promise<void>
    
    // 等待初始化完成
    async waitForInitialization(): Promise<void>
    
    // 獲取服務實例
    getService<T>(serviceName: string): T
    
    // 註冊服務
    registerService(name: string, service: any): void
    
    // 銷毀管理器
    dispose(): void
}
```

**使用範例**:
```typescript
const coreManager = new DevikaCoreManager(context);
await coreManager.initialize();

const llmService = coreManager.getService<LLMService>('llm');
const taskManager = coreManager.getService<TaskManager>('tasks');
```

### ConfigManager

配置管理服務。

```typescript
class ConfigManager {
    constructor(context: vscode.ExtensionContext)
    
    // 獲取配置值
    get<T>(key: string, defaultValue?: T): T
    
    // 設定配置值
    async set(key: string, value: any): Promise<void>
    
    // 獲取 API 金鑰
    getApiKey(provider: 'openai' | 'claude' | 'gemini'): string | undefined
    
    // 設定 API 金鑰
    async setApiKey(provider: string, apiKey: string): Promise<void>
    
    // 監聽配置變更
    onConfigChanged(callback: (key: string, value: any) => void): vscode.Disposable
}
```

---

## 🤖 LLM 服務 API

### LLMService

統一的 LLM 服務介面。

```typescript
interface LLMProvider {
    generateResponse(prompt: string, options?: LLMOptions): Promise<string>
    analyzeCode(code: string, language: string): Promise<CodeAnalysis>
    generateCommitMessage(diff: string): Promise<string>
}

class LLMService {
    constructor(configManager: ConfigManager)
    
    // 切換 AI 提供商
    switchProvider(provider: 'openai' | 'claude' | 'gemini'): void
    
    // 獲取當前提供商
    getCurrentProvider(): string
    
    // 生成回應
    async generateResponse(prompt: string, options?: LLMOptions): Promise<string>
    
    // 分析程式碼
    async analyzeCode(code: string, language: string, analysisType?: AnalysisType): Promise<CodeAnalysis>
    
    // 生成 Commit 訊息
    async generateCommitMessage(diff: string): Promise<string>
    
    // 重構建議
    async getRefactoringSuggestions(code: string, language: string): Promise<RefactoringSuggestion[]>
    
    // 生成文檔
    async generateDocumentation(code: string, language: string): Promise<string>
}
```

**類型定義**:
```typescript
interface LLMOptions {
    maxTokens?: number;
    temperature?: number;
    model?: string;
    stream?: boolean;
}

interface CodeAnalysis {
    summary: string;
    issues: Issue[];
    suggestions: Suggestion[];
    complexity: ComplexityMetrics;
    quality: QualityScore;
}

interface Issue {
    type: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

interface Suggestion {
    type: 'performance' | 'readability' | 'security' | 'best-practice';
    message: string;
    code?: string;
    line?: number;
}
```

**使用範例**:
```typescript
const llmService = new LLMService(configManager);

// 分析程式碼
const analysis = await llmService.analyzeCode(
    'function hello() { console.log("Hello"); }',
    'javascript'
);

// 生成 Commit 訊息
const commitMessage = await llmService.generateCommitMessage(gitDiff);

// 獲取重構建議
const suggestions = await llmService.getRefactoringSuggestions(code, 'typescript');
```

---

## 📋 任務管理 API

### TaskManager

任務生命週期管理。

```typescript
interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    createdAt: Date;
    updatedAt: Date;
    fileUri?: vscode.Uri;
    lineNumber?: number;
    tags?: string[];
    assignee?: string;
    dueDate?: Date;
}

type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

class TaskManager {
    constructor(context: vscode.ExtensionContext)
    
    // 創建任務
    async createTask(taskData: Partial<Task>): Promise<Task>
    
    // 更新任務
    async updateTask(taskId: string, updates: Partial<Task>): Promise<Task>
    
    // 刪除任務
    async deleteTask(taskId: string): Promise<void>
    
    // 獲取任務
    getTask(taskId: string): Task | undefined
    
    // 獲取所有任務
    getAllTasks(): Task[]
    
    // 按狀態篩選任務
    getTasksByStatus(status: TaskStatus): Task[]
    
    // 按優先級篩選任務
    getTasksByPriority(priority: TaskPriority): Task[]
    
    // 搜尋任務
    searchTasks(query: string): Task[]
    
    // 批量操作
    async batchUpdateTasks(taskIds: string[], updates: Partial<Task>): Promise<Task[]>
    
    // 匯出任務
    async exportTasks(format: 'json' | 'csv' | 'markdown'): Promise<string>
    
    // 監聽任務變更
    onTaskChanged(callback: (task: Task, action: 'created' | 'updated' | 'deleted') => void): vscode.Disposable
}
```

**使用範例**:
```typescript
const taskManager = new TaskManager(context);

// 創建任務
const task = await taskManager.createTask({
    title: '修復登入錯誤',
    description: '用戶無法登入系統',
    priority: 'high',
    fileUri: vscode.Uri.file('/path/to/auth.ts'),
    lineNumber: 42
});

// 更新任務狀態
await taskManager.updateTask(task.id, {
    status: 'in-progress',
    assignee: 'developer@example.com'
});

// 監聽任務變更
taskManager.onTaskChanged((task, action) => {
    console.log(`Task ${task.title} was ${action}`);
});
```

---

## 💡 代碼完成 API

### CodeCompletionProvider

智能代碼完成系統。

```typescript
interface CompletionItem {
    label: string;
    kind: vscode.CompletionItemKind;
    detail?: string;
    documentation?: string;
    insertText: string;
    range?: vscode.Range;
    sortText?: string;
    filterText?: string;
    command?: vscode.Command;
}

interface CompletionContext {
    document: vscode.TextDocument;
    position: vscode.Position;
    triggerCharacter?: string;
    triggerKind: vscode.CompletionTriggerKind;
}

class CodeCompletionProvider implements vscode.CompletionItemProvider {
    constructor(llmService: LLMService)
    
    // 提供完成建議
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]>
    
    // 解析完成項目
    async resolveCompletionItem(
        item: vscode.CompletionItem,
        token: vscode.CancellationToken
    ): Promise<vscode.CompletionItem>
}

// 初始化代碼完成系統
async function initializeCodeCompletionSystem(context: vscode.ExtensionContext): Promise<void>
```

**使用範例**:
```typescript
// 註冊代碼完成提供者
const provider = new CodeCompletionProvider(llmService);
const disposable = vscode.languages.registerCompletionItemProvider(
    ['typescript', 'javascript'],
    provider,
    '.', '(', '['
);

context.subscriptions.push(disposable);
```

---

## 🧠 學習系統 API

### LearningEngine

持續學習機制。

```typescript
interface LearningEvent {
    type: LearningEventType;
    timestamp: Date;
    context: LearningContext;
    data: any;
}

type LearningEventType = 'code_edit' | 'completion_accepted' | 'suggestion_feedback' | 'error_fixed';

interface LearningContext {
    fileUri: vscode.Uri;
    language: string;
    projectContext?: string;
    userAction?: string;
}

interface CodingPattern {
    id: string;
    type: PatternType;
    frequency: number;
    confidence: number;
    context: string;
    examples: string[];
}

class LearningEngine {
    constructor(context: vscode.ExtensionContext)
    
    // 記錄學習事件
    recordEvent(event: LearningEvent): void
    
    // 獲取編程模式
    getCodingPatterns(): CodingPattern[]
    
    // 獲取用戶偏好
    getUserPreferences(): UserPreference[]
    
    // 獲取學習統計
    getLearningStats(): LearningStats
    
    // 重置學習數據
    async resetLearningData(): Promise<void>
    
    // 匯出學習數據
    async exportLearningData(options?: ExportOptions): Promise<string>
    
    // 監聽學習事件
    onLearningEvent(callback: (event: LearningEvent) => void): vscode.Disposable
}

// 初始化學習系統
async function initializeLearningSystem(context: vscode.ExtensionContext): Promise<void>
```

**使用範例**:
```typescript
const learningEngine = new LearningEngine(context);

// 記錄代碼編輯事件
learningEngine.recordEvent({
    type: 'code_edit',
    timestamp: new Date(),
    context: {
        fileUri: document.uri,
        language: document.languageId
    },
    data: {
        editType: 'function_creation',
        codeSnippet: 'function calculateSum(a, b) { return a + b; }'
    }
});

// 獲取學習統計
const stats = learningEngine.getLearningStats();
console.log(`Total events: ${stats.totalEvents}`);
```

---

## 🔌 插件開發 API

### PluginManager

Augment 插件系統。

```typescript
interface AugmentPlugin {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    
    activate(context: PluginContext): Promise<void>;
    deactivate(): Promise<void>;
}

interface PluginContext {
    llmService: LLMService;
    taskManager: TaskManager;
    fileSystem: FileSystemService;
    ui: UIService;
    storage: StorageService;
    eventBus: EventBus;
}

class PluginManager {
    constructor(context: vscode.ExtensionContext)
    
    // 載入插件
    async loadPlugin(pluginPath: string): Promise<void>
    
    // 卸載插件
    async unloadPlugin(pluginId: string): Promise<void>
    
    // 獲取已載入的插件
    getLoadedPlugins(): AugmentPlugin[]
    
    // 獲取插件資訊
    getPluginInfo(pluginId: string): PluginInfo | undefined
    
    // 啟用/停用插件
    async enablePlugin(pluginId: string): Promise<void>
    async disablePlugin(pluginId: string): Promise<void>
    
    // 監聽插件事件
    onPluginLoaded(callback: (plugin: AugmentPlugin) => void): vscode.Disposable
    onPluginUnloaded(callback: (pluginId: string) => void): vscode.Disposable
}
```

**插件開發範例**:
```typescript
// my-plugin/index.ts
export default class MyPlugin implements AugmentPlugin {
    id = 'my-custom-plugin';
    name = 'My Custom Plugin';
    version = '1.0.0';
    
    async activate(context: PluginContext): Promise<void> {
        // 註冊命令
        vscode.commands.registerCommand('myPlugin.doSomething', async () => {
            const result = await context.llmService.generateResponse('Hello AI!');
            
            await context.taskManager.createTask({
                title: 'AI Generated Task',
                description: result
            });
        });
        
        // 監聽事件
        context.eventBus.on('task:created', (task) => {
            console.log('New task created:', task.title);
        });
    }
    
    async deactivate(): Promise<void> {
        // 清理資源
    }
}
```

---

## 📡 事件系統

### EventBus

全域事件匯流排。

```typescript
class EventBus {
    // 註冊事件監聽器
    on(event: string, callback: Function): vscode.Disposable
    
    // 註冊一次性事件監聽器
    once(event: string, callback: Function): vscode.Disposable
    
    // 發送事件
    emit(event: string, data?: any): void
    
    // 移除事件監聽器
    off(event: string, callback: Function): void
    
    // 清除所有監聽器
    clear(): void
}
```

**系統事件**:
```typescript
// 任務相關事件
'task:created'     // 任務創建
'task:updated'     // 任務更新
'task:deleted'     // 任務刪除
'task:completed'   // 任務完成

// LLM 相關事件
'llm:response'     // AI 回應
'llm:error'        // AI 錯誤
'llm:provider:changed'  // 提供商切換

// 學習相關事件
'learning:pattern:detected'  // 模式檢測
'learning:preference:updated'  // 偏好更新

// 插件相關事件
'plugin:loaded'    // 插件載入
'plugin:unloaded'  // 插件卸載
'plugin:error'     // 插件錯誤
```

**使用範例**:
```typescript
const eventBus = new EventBus();

// 監聽任務創建事件
eventBus.on('task:created', (task: Task) => {
    vscode.window.showInformationMessage(`新任務已創建: ${task.title}`);
});

// 發送自訂事件
eventBus.emit('custom:event', { message: 'Hello World' });
```

---

## 📝 類型定義

### 核心類型

```typescript
// 基本類型
type UUID = string;
type Timestamp = Date;
type FilePath = string;
type LineNumber = number;

// 配置類型
interface DevikaConfig {
    apiKeys: {
        openai?: string;
        claude?: string;
        gemini?: string;
    };
    preferences: {
        preferredModel: string;
        maxContextLines: number;
        autoScanTodos: boolean;
        enableCodeIndexing: boolean;
    };
    performance: {
        cacheSize: number;
        maxConcurrency: number;
        timeoutMs: number;
    };
}

// 錯誤類型
class DevikaError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'DevikaError';
    }
}

// API 回應類型
interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    timestamp: Date;
}
```

---

*最後更新: 2025-07-02*
