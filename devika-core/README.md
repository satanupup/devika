# 🧠 Devika Core

Devika Core 是一個平台無關的 AI 開發助理引擎，提供程式碼分析、任務管理、Git 整合等核心功能。

## 🎯 設計目標

- **平台無關**: 可以在任何 IDE 或編輯器中使用
- **模組化**: 清楚的介面定義，易於擴展和測試
- **高效能**: 優化的演算法和智能快取機制
- **可靠性**: 完整的錯誤處理和恢復機制

## 🏗️ 架構概覽

```
devika-core/
├── interfaces/     # 抽象介面定義
├── llm/           # AI 模型服務
├── context/       # 程式碼情境分析
├── tasks/         # 任務管理引擎
├── git/           # Git 操作核心
├── plugins/       # 插件系統
└── config/        # 核心配置
```

## 🚀 快速開始

### 安裝

```bash
npm install devika-core
```

### 基本使用

```typescript
import { LLMService, IFileSystem, IUserInterface } from 'devika-core';

// 實作平台特定的介面
class MyFileSystem implements IFileSystem {
  // 實作檔案系統操作
}

class MyUserInterface implements IUserInterface {
  // 實作使用者介面操作
}

// 初始化 LLM 服務
const llmService = new LLMService({
  defaultProvider: 'claude',
  claude: {
    apiKey: 'your-api-key'
  }
});

// 使用 AI 分析程式碼
const analysis = await llmService.analyzeCode(
  'function hello() { console.log("Hello World"); }',
  'javascript',
  'review'
);
```

## 🔌 介面實作

Devika Core 使用抽象介面來實現平台無關性。你需要為你的平台實作以下介面：

### IFileSystem

處理檔案系統操作：

```typescript
interface IFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(pattern: string): Promise<string[]>;
  getWorkspaceRoot(): string | undefined;
  // ... 更多方法
}
```

### IUserInterface

處理使用者互動：

```typescript
interface IUserInterface {
  showMessage(message: string, type: MessageType): Promise<void>;
  showProgress<T>(title: string, task: () => Promise<T>): Promise<T>;
  showQuickPick<T>(items: T[], options?: QuickPickOptions): Promise<T | undefined>;
  // ... 更多方法
}
```

### IProjectContext

提供專案上下文資訊：

```typescript
interface IProjectContext {
  getProjectName(): string;
  getPrimaryLanguage(): string;
  getFrameworks(): string[];
  getProjectType(): ProjectType;
  // ... 更多方法
}
```

## 🤖 LLM 服務

支援多個 AI 模型提供商：

- **Claude** (Anthropic)
- **GPT** (OpenAI)
- **Gemini** (Google)

### 配置範例

```typescript
const config: LLMConfig = {
  defaultProvider: 'claude',
  defaultMaxTokens: 4000,
  defaultTemperature: 0.7,
  
  claude: {
    apiKey: process.env.CLAUDE_API_KEY!,
    defaultModel: 'claude-3-sonnet-20240229'
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    defaultModel: 'gpt-4'
  },
  
  gemini: {
    apiKey: process.env.GEMINI_API_KEY!,
    defaultModel: 'gemini-pro'
  }
};
```

### 使用範例

```typescript
// 生成文字
const response = await llmService.generateCompletion(
  "解釋這段程式碼的功能",
  {
    provider: 'claude',
    maxTokens: 1000,
    temperature: 0.5
  }
);

// 結構化輸出
const analysis = await llmService.generateStructuredResponse(
  "分析這個函式的複雜度",
  {
    type: "object",
    properties: {
      complexity: { type: "string" },
      suggestions: { type: "array", items: { type: "string" } }
    }
  }
);

// 程式碼分析
const codeReview = await llmService.analyzeCode(
  sourceCode,
  'typescript',
  'review'
);
```

## 📊 Token 使用統計

追蹤 AI 模型的使用情況：

```typescript
// 取得使用統計
const usage = llmService.getTokenUsage();
console.log(`總 tokens: ${usage.totalTokens}`);
console.log(`總成本: $${usage.totalCost}`);

// 重設統計
llmService.resetTokenUsage();
```

## 🧪 測試

```bash
# 執行測試
npm test

# 監視模式
npm run test:watch

# 覆蓋率報告
npm run test:coverage
```

## 🔧 開發

```bash
# 編譯
npm run build

# 監視模式
npm run watch

# 程式碼檢查
npm run lint
```

## 📝 API 文件

詳細的 API 文件請參閱 [API.md](API.md)。

## 🤝 貢獻

歡迎貢獻！請參閱 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 📄 授權

MIT License - 詳見 [LICENSE](../LICENSE) 檔案。

---

## 🔗 相關專案

- [devika-vscode](../devika-vscode) - VS Code 擴充功能
- [devika-jetbrains](../devika-jetbrains) - JetBrains IDE 插件 (計劃中)
- [devika-cli](../devika-cli) - 命令列工具 (計劃中)
