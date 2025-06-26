# 🧩 Augment 插件開發指南

## 🛠️ 基本概念說明

設計自己的 **Augment 插件**（Augment Agent / 任務模組），本質上就是打造一個**會讀上下文、能執行工作流程、幫你改 VS Code 專案的 AI 助手**。

| 名稱             | 說明                                                                          |
| -------------- | --------------------------------------------------------------------------- |
| **Augment 插件** | 一個任務模組（Task Module），描述「某個具體工作」該怎麼完成，例如：自動產出 roadmap、幫你產生單元測試、自動整理 tsconfig。 |
| **Agent（代理）**  | 執行這個任務的「AI角色」，可以讀取檔案、執行對話、生成檔案內容，甚至與 VS Code 互動。                            |
| **Thread**     | 每個任務的執行脈絡，例如：「幫我重構這段 code」，Agent 會啟動一條 thread 並逐步詢問、執行修改。                   |

---

## 🧭 設計一個 Augment 插件的步驟

### 🔹 步驟 1：定義你的任務（What）

你要讓 AI 幫你做什麼？
範例：

* 幫我生成 `CONTRIBUTING.md`
* 幫我寫 Jest 單元測試
* 幫我整理 LLM Plugin Metadata
* 幫我檢查 tsconfig 問題並建議修改

**💡 個體戶建議**: 從你專案中「重複性高」的任務切入，優先選擇能立即看到效果的任務。

---

### 🔹 步驟 2：分解工作流程（How）

用「人類邏輯」先描述流程：

```txt
任務名稱：生成 CONTRIBUTING.md 指南

步驟：
1. 分析專案是否為 open source？是否有 CI？
2. 根據專案語言（Node/TS），決定建議格式
3. 自動建立 CONTRIBUTING.md，說明：
   - 如何建立 PR
   - 分支命名規則
   - 使用的工具（如 ESLint、Prettier）
4. 回傳預覽內容給用戶確認
5. 寫入檔案
```

---

### 🔹 步驟 3：撰寫 Agent 指令（Prompt 編寫）

Devika VS Code Extension 支援以下插件格式：

```json
{
  "name": "Create Contributing Guide",
  "description": "Generate a CONTRIBUTING.md file based on the project structure.",
  "entryPoint": "agent.ts",
  "inputs": ["projectStructure", "existingFiles"],
  "steps": [
    "Analyze project setup",
    "Propose contribution steps",
    "Generate Markdown",
    "Write CONTRIBUTING.md"
  ]
}
```

你可以定義：

* 代理角色的語氣、目的
* 允許讀取的檔案
* 允許寫入的範圍
* 是否需要互動（Thread）還是直接產出結果

---

### 🔹 步驟 4：測試與微調（Debug & Prompt Tuning）

進 VS Code 啟動 Devika：

1. 建立一個專案
2. 運行你的插件（Agent 模組）
3. 看生成的內容是否滿足預期
4. 若不準確，回去修改 prompt、輸入格式或上下文限制

---

## 🚀 範例：自製插件 `auto-generate-roadmap`

```yaml
任務名稱：auto-generate-roadmap

說明：根據 README.md 與現有程式碼，自動生成 `ROADMAP.md`

步驟：
1. 掃描 README.md → 擷取目前專案說明
2. 掃描專案 src 結構 → 擷取有哪些模組
3. 建立 `ROADMAP.md`，格式如下：
   - 即將完成：
   - 開發中模組：
   - 待定：
4. 呈現產出 → 問是否儲存
```

---

## 📁 專案結構（建議）

```
src/plugins/
├── agents/
│   ├── BaseAgent.ts                ← 基礎代理類別
│   ├── DocumentationAgent.ts       ← 文件生成代理
│   └── CodeAnalysisAgent.ts        ← 程式碼分析代理
├── tasks/
│   ├── generate-contributing.json  ← 任務描述
│   ├── generate-roadmap.json       ← 任務描述
│   └── analyze-code.json           ← 任務描述
├── prompts/
│   ├── contributing.prompt.txt     ← Prompt 範本
│   ├── roadmap.prompt.txt          ← Prompt 範本
│   └── analysis.prompt.txt         ← Prompt 範本
├── workflows/
│   └── DocumentationWorkflow.ts    ← 工作流程定義
└── PluginManager.ts                ← 插件管理器
```

---

## 🧠 Plugin 功能範例：`generate-roadmap`

### 🪪 1. 任務描述 `tasks/generate-roadmap.json`

```json
{
  "id": "generate-roadmap",
  "name": "生成專案路線圖",
  "description": "根據 README 與程式結構，產出 ROADMAP.md",
  "agent": "DocumentationAgent",
  "category": "documentation",
  "inputs": {
    "readmePath": "README.md",
    "sourceDirs": ["src", "packages"],
    "outputPath": "ROADMAP.md"
  },
  "steps": [
    "讀取專案簡介與模組結構",
    "產生 ROADMAP 提案",
    "要求使用者確認",
    "寫入檔案"
  ],
  "estimatedTime": "2-3 分鐘",
  "tags": ["documentation", "automation", "markdown"]
}
```

### 🤖 2. Agent 主體 `agents/DocumentationAgent.ts`

```typescript
import { BaseAgent } from './BaseAgent';
import { TaskContext, TaskResult } from '../types';

export class DocumentationAgent extends BaseAgent {
  async executeTask(taskId: string, context: TaskContext): Promise<TaskResult> {
    switch (taskId) {
      case 'generate-roadmap':
        return await this.generateRoadmap(context);
      case 'generate-contributing':
        return await this.generateContributing(context);
      default:
        throw new Error(`Unknown task: ${taskId}`);
    }
  }

  private async generateRoadmap(context: TaskContext): Promise<TaskResult> {
    // 1. 讀取專案資訊
    const readme = await context.fileSystem.readFile('README.md');
    const projectStructure = await context.fileSystem.getProjectStructure();
    
    // 2. 建立 prompt
    const prompt = await this.buildPrompt('roadmap', {
      readme,
      structure: projectStructure,
      language: context.project.primaryLanguage
    });
    
    // 3. 呼叫 LLM
    const roadmapContent = await this.llmService.generateCompletion(prompt);
    
    // 4. 顯示預覽
    const confirmed = await context.ui.showPreview(
      'ROADMAP.md',
      roadmapContent,
      '是否要建立這個路線圖？'
    );
    
    if (confirmed) {
      await context.fileSystem.writeFile('ROADMAP.md', roadmapContent);
      return {
        success: true,
        message: 'ROADMAP.md 已成功建立！',
        files: ['ROADMAP.md']
      };
    }
    
    return {
      success: false,
      message: '使用者取消操作'
    };
  }
}
```

### ✍️ 3. Prompt 設計 `prompts/roadmap.prompt.txt`

```txt
你是一位熟悉開源專案的技術寫手。請根據以下資訊撰寫一份清晰的 `ROADMAP.md`。

## 專案資訊
README 內容：
{{readme}}

專案結構：
{{structure}}

主要語言：{{language}}

## 輸出要求
請輸出 Markdown 格式的路線圖，包含：

### 🎯 專案目標
- 簡述專案的核心目標

### 📅 開發階段
#### 🚀 即將完成 (本月)
- 列出即將完成的功能

#### 🔄 進行中 (未來 2-3 個月)
- 列出正在開發的功能

#### 📋 計劃中 (未來 6 個月)
- 列出計劃中的功能

#### 💭 願景 (長期目標)
- 列出長期願景

### 📊 里程碑
- 重要的版本發布計劃

請確保內容具體、可執行，避免過於抽象的描述。
```

---

## 🔌 個體戶開發建議

### 💡 優先級策略
1. **先做能看到效果的**: 文件生成 > 程式碼分析 > 複雜重構
2. **從簡單開始**: 靜態分析 > 動態分析 > AI 推理
3. **重複利用**: 一個好的 prompt 可以用在多個場景

### ⏰ 時間分配建議
- **插件架構設計**: 20% (一次性投資)
- **第一個插件開發**: 40% (學習曲線)
- **後續插件開發**: 30% (複製模式)
- **測試和優化**: 10% (持續改進)

### 🎯 個體戶成功指標
- [ ] 能在 30 分鐘內開發一個新插件
- [ ] 插件的成功率 > 80%
- [ ] 其他開發者願意使用你的插件
- [ ] 可以作為作品集展示

---

## 📚 參考資源

| 資源 | 說明 |
|------|------|
| [VS Code Extension API](https://code.visualstudio.com/api) | 官方 API 文件 |
| [OpenAI API](https://platform.openai.com/docs) | LLM API 參考 |
| [Claude API](https://docs.anthropic.com/) | Anthropic API 文件 |
| [Tree-sitter](https://tree-sitter.github.io/) | 語法分析工具 |

---

*最後更新: 2024-12-19*
