# 🧩 Devika 專案架構分離計畫

## 📋 分析摘要

基於對整個專案的分析，我們需要將目前的 Devika VS Code Extension 分離成兩個獨立但相互協作的模組：

1. **`devika-core`**: 通用的 AI 開發助理核心邏輯
2. **`devika-vscode`**: VS Code 特定的擴充功能包裝

## 🎯 分離目標

### 為什麼要分離？
- **可重用性**: `devika-core` 可以被其他 IDE 或工具使用
- **維護性**: 核心邏輯與 UI 邏輯分離，更容易維護
- **測試性**: 核心邏輯可以獨立測試，不依賴 VS Code 環境
- **擴展性**: 未來可以輕鬆開發 JetBrains、Vim 等其他 IDE 的版本

### 分離原則
- **依賴倒置**: `devika-vscode` 依賴 `devika-core`，而非相反
- **介面抽象**: 通過介面定義核心功能，VS Code 實作具體的 UI 邏輯
- **配置分離**: 核心配置與 VS Code 特定配置分開管理

## 🏗️ 架構設計

### devika-core (核心模組)
```
devika-core/
├── src/
│   ├── llm/                     # AI 模型服務
│   │   ├── LLMService.ts        # 統一 LLM 介面
│   │   ├── providers/           # 各 LLM 提供商實作
│   │   └── types.ts             # LLM 相關型別定義
│   ├── context/                 # 程式碼情境分析
│   │   ├── CodeAnalyzer.ts      # 程式碼分析核心
│   │   ├── ContextExtractor.ts  # 上下文提取
│   │   └── parsers/             # 各語言解析器
│   ├── tasks/                   # 任務管理核心
│   │   ├── TaskEngine.ts        # 任務引擎
│   │   ├── TaskTypes.ts         # 任務類型定義
│   │   └── workflows/           # 工作流定義
│   ├── git/                     # Git 操作核心
│   │   ├── GitAnalyzer.ts       # Git 分析
│   │   └── CommitGenerator.ts   # Commit 訊息生成
│   ├── plugins/                 # 插件系統核心
│   │   ├── PluginEngine.ts      # 插件引擎
│   │   ├── BaseAgent.ts         # 基礎代理
│   │   └── agents/              # 內建代理
│   ├── config/                  # 核心配置
│   │   └── CoreConfig.ts        # 核心配置管理
│   └── interfaces/              # 抽象介面定義
│       ├── IFileSystem.ts       # 檔案系統介面
│       ├── IUserInterface.ts    # 使用者介面介面
│       └── IProjectContext.ts   # 專案上下文介面
├── package.json
└── README.md
```

### devika-vscode (VS Code 擴充功能)
```
devika-vscode/
├── src/
│   ├── core/                    # VS Code 核心管理
│   │   └── VSCodeManager.ts     # VS Code 特定的管理器
│   ├── ui/                      # VS Code UI 實作
│   │   ├── WebviewManager.ts    # Webview 管理
│   │   ├── StatusBarManager.ts  # 狀態列管理
│   │   └── CommandManager.ts    # 指令管理
│   ├── adapters/                # 介面適配器
│   │   ├── VSCodeFileSystem.ts  # VS Code 檔案系統適配
│   │   ├── VSCodeUI.ts          # VS Code UI 適配
│   │   └── VSCodeProject.ts     # VS Code 專案適配
│   ├── config/                  # VS Code 特定配置
│   │   └── VSCodeConfig.ts      # VS Code 配置管理
│   └── extension.ts             # 擴充功能入口
├── package.json
├── .vscodeignore
└── README.md
```

## 🔄 分離步驟

### Phase 1: 建立 devika-core 基礎架構 (2-3 小時)

#### 1.1 建立 devika-core 專案結構
```bash
mkdir devika-core
cd devika-core
npm init -y
npm install typescript @types/node
```

#### 1.2 定義核心介面
- `IFileSystem`: 檔案系統操作抽象
- `IUserInterface`: 使用者介面操作抽象
- `IProjectContext`: 專案上下文抽象

#### 1.3 移植核心邏輯
- 移植 `LLMService` (移除 VS Code 依賴)
- 移植程式碼分析邏輯
- 移植任務管理核心
- 移植 Git 分析邏輯

### Phase 2: 重構 devika-vscode (2-3 小時)

#### 2.1 安裝 devika-core 依賴
```bash
cd devika-vscode
npm install ../devika-core
```

#### 2.2 建立適配器
- 實作 `VSCodeFileSystem`
- 實作 `VSCodeUI`
- 實作 `VSCodeProject`

#### 2.3 重構現有程式碼
- 更新 `DevikaCoreManager` 使用 `devika-core`
- 移除重複的核心邏輯
- 保留 VS Code 特定的 UI 和指令處理

### Phase 3: 測試和優化 (1-2 小時)

#### 3.1 單元測試
- 為 `devika-core` 建立獨立測試
- 測試 VS Code 適配器

#### 3.2 整合測試
- 測試完整的工作流程
- 確保功能正常運作

## 📦 依賴關係

### devika-core 依賴
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "simple-git": "^3.20.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "jest": "^29.7.0"
  }
}
```

### devika-vscode 依賴
```json
{
  "dependencies": {
    "devika-core": "file:../devika-core",
    "@types/vscode": "^1.74.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@vscode/test-electron": "^2.3.8"
  }
}
```

## 🔌 介面設計

### IFileSystem 介面
```typescript
export interface IFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(pattern: string): Promise<string[]>;
  getWorkspaceRoot(): string | undefined;
}
```

### IUserInterface 介面
```typescript
export interface IUserInterface {
  showMessage(message: string, type: 'info' | 'warning' | 'error'): Promise<void>;
  showProgress<T>(title: string, task: () => Promise<T>): Promise<T>;
  showQuickPick<T>(items: T[], options?: QuickPickOptions): Promise<T | undefined>;
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;
}
```

### IProjectContext 介面
```typescript
export interface IProjectContext {
  getLanguage(): string;
  getFrameworks(): string[];
  getProjectType(): 'library' | 'application' | 'extension';
  getGitInfo(): GitInfo | undefined;
}
```

## 🎯 實作優先級

### 高優先級 (必須完成)
1. **LLMService 分離**: 移除 VS Code 依賴，使用介面抽象
2. **檔案系統抽象**: 建立 `IFileSystem` 介面和 VS Code 實作
3. **基本 UI 抽象**: 建立 `IUserInterface` 介面和 VS Code 實作

### 中優先級 (建議完成)
1. **任務管理分離**: 將任務邏輯移到 core
2. **程式碼分析分離**: 將分析邏輯移到 core
3. **插件系統分離**: 將插件引擎移到 core

### 低優先級 (未來考慮)
1. **Git 分析分離**: 將 Git 邏輯移到 core
2. **配置系統分離**: 建立分層配置系統
3. **測試覆蓋**: 完整的單元測試和整合測試

## 🚀 預期效益

### 短期效益
- **程式碼組織更清晰**: 核心邏輯與 UI 邏輯分離
- **測試更容易**: 核心邏輯可以獨立測試
- **開發更高效**: 可以並行開發核心功能和 UI 功能

### 長期效益
- **跨平台支援**: 可以輕鬆開發其他 IDE 的版本
- **社群貢獻**: 核心邏輯可以被其他專案使用
- **維護成本降低**: 核心邏輯變更不會影響 UI，反之亦然

## ⚠️ 風險與對策

### 風險
1. **過度抽象**: 可能導致程式碼複雜度增加
2. **效能影響**: 介面抽象可能帶來輕微的效能損失
3. **開發時間**: 分離過程需要額外的開發時間

### 對策
1. **漸進式分離**: 先分離最重要的模組，逐步完善
2. **保持簡單**: 介面設計盡量簡單直觀
3. **充分測試**: 確保分離後功能正常運作

## ✅ 已完成的工作

### Phase 1: devika-core 基礎架構 ✅

1. **專案結構建立** ✅
   - 建立 `devika-core/` 目錄結構
   - 配置 `package.json` 和 `tsconfig.json`
   - 設定 TypeScript 編譯和測試環境

2. **核心介面定義** ✅
   - `IFileSystem`: 檔案系統操作抽象
   - `IUserInterface`: 使用者介面操作抽象
   - `IProjectContext`: 專案上下文資訊抽象

3. **LLM 服務核心** ✅
   - `LLMService`: 統一的 AI 模型介面
   - 完整的型別定義和錯誤處理
   - 支援多提供商架構設計

4. **文件建立** ✅
   - devika-core README
   - API 介面文件
   - 使用範例和指南

### 🔄 進行中的工作

1. **LLM 提供商實作** (下一步)
   - Claude、OpenAI、Gemini 具體實作
   - API 整合和錯誤處理

2. **VS Code 適配器** (下一步)
   - VSCodeFileSystem 實作
   - VSCodeUI 實作
   - VSCodeProject 實作

### ⏳ 待完成的工作

1. **現有程式碼重構**
   - 更新 DevikaCoreManager
   - 移除重複的核心邏輯
   - 整合 devika-core

2. **測試和驗證**
   - 單元測試
   - 整合測試
   - 功能驗證

## 🎯 下一步行動計畫

### 立即優先級 (1-2 小時)
1. 實作 LLM 提供商類別
2. 建立基本的 VS Code 適配器

### 短期目標 (2-4 小時)
1. 重構現有的 VS Code 擴充功能
2. 測試分離後的架構

### 中期目標 (1-2 週)
1. 完善所有核心功能
2. 建立完整的測試套件
3. 優化效能和錯誤處理

## 📊 架構分離效益評估

### ✅ 已實現的效益
- **清楚的模組邊界**: 核心邏輯與 UI 邏輯完全分離
- **可重用性**: devika-core 可用於其他平台
- **可測試性**: 核心邏輯可獨立測試
- **可維護性**: 介面抽象使程式碼更易維護

### 🎯 預期效益
- **跨平台支援**: 未來可輕鬆支援其他 IDE
- **社群貢獻**: 核心邏輯可被其他專案使用
- **開發效率**: 並行開發核心功能和 UI 功能

---

*最後更新: 2024-12-19*
*狀態: Phase 1 完成，Phase 2 準備中*
*實際完成時間: 2 小時 (Phase 1)*
*預估剩餘時間: 3-6 小時*
