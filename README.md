<p align="center">
  <img src=".assets/devika-avatar.png" alt="Devika Logo" width="250">
</p>

<h1 align="center">🧩 Devika VS Code Extension - 智能 AI 開發助理 👩‍💻</h1>

<p align="center">
  <strong>深度整合進 VS Code 的 AI 開發助理，具備程式碼情境理解、任務代理和 Git 整合功能</strong>
</p>

<p align="center">
  <a href="#快速開始">快速開始</a> •
  <a href="#核心功能">功能特色</a> •
  <a href="#安裝指南">安裝指南</a> •
  <a href="#使用方法">使用方法</a> •
  <a href="#開發指南">開發指南</a>
</p>

![VS Code Extension Screenshot](https://via.placeholder.com/800x400/1e1e1e/ffffff?text=Devika+VS+Code+Extension)

> [!NOTE]
> 這是 Devika AI 軟體工程師的 VS Code Extension 版本，專為提供更好的開發體驗而設計。具備智能程式碼分析、自動任務管理和深度 Git 整合功能。

## 目錄

- [關於專案](#關於專案)
- [核心功能](#核心功能)
- [系統架構](#系統架構)
- [開發狀態](#開發狀態)
- [快速開始](#快速開始)
  - [系統需求](#系統需求)
  - [安裝指南](#安裝指南)
  - [使用方法](#使用方法)
- [配置設定](#配置設定)
- [專案結構](#專案結構)
- [開發指南](#開發指南)
  - [開發環境設定](#開發環境設定)
  - [建置和測試](#建置和測試)
  - [發布流程](#發布流程)
- [開發計畫](#開發計畫)
- [功能詳解](#功能詳解)
- [故障排除](#故障排除)
- [貢獻指南](#貢獻指南)
- [發展路線圖](#發展路線圖)
- [授權條款](#授權條款)

## 關於專案

Devika VS Code Extension 是一個深度整合進 VS Code 的 AI 開發助理，專為提升開發效率而設計。它不僅能執行指令，更能主動理解專案的程式碼結構與 Git 脈絡，提供智能的開發建議和自動化任務管理。

### 🎯 專案目標

打造一款能「觀察、理解、建議、執行」的完整開發工作流助理，核心功能包括：

- **🧠 智能情境感知**: 透過程式碼索引和語法樹分析，精準定位相關程式碼片段
- **🤖 多步任務代理**: 將模糊需求拆解成具體可執行的步驟清單
- **� 深度 Git 整合**: 分析變更、生成 Commit 訊息、追蹤開發歷史
- **� 主動式工作流**: 自動偵測 TODO、FIXME，轉換為可管理的任務項

### ✨ 核心優勢

- **� 精準上下文**: 只傳送最相關的程式碼片段給 AI，降低 Token 成本
- **📊 即時監控**: 提供任務進度和決策制定的即時更新
- **🔄 智能學習**: 基於程式碼變更和使用者回饋持續改進
- **⚡ 無縫整合**: 深度整合 VS Code，提供原生的開發體驗

> [!TIP]
> 這個 Extension 是基於原始 Devika 專案的核心理念，專門為 VS Code 環境優化設計，提供更直接、更高效的開發助理體驗。

## 核心功能

### 🤖 AI 模型支援
- **Claude 3** (Sonnet/Opus) - 建議使用，程式碼理解能力最佳
- **GPT-4** / **GPT-3.5 Turbo** - OpenAI 模型，廣泛支援
- **Gemini Pro** - Google 模型，多模態能力強
- **一鍵切換**: 在設定中輕鬆切換不同 AI 模型

### 🧠 智能程式碼分析
- **語法樹解析**: 使用 Tree-sitter 精準理解程式碼結構
- **符號索引**: 自動建立函式、類別、變數的索引
- **上下文提取**: 智能提取相關程式碼片段，減少 Token 消耗
- **複雜度分析**: 計算圈複雜度和認知複雜度

### 📋 任務代理系統
- **自動任務生成**: 將 AI 建議轉換為可追蹤的任務
- **任務狀態管理**: 待處理、進行中、已完成、已取消
- **優先級排序**: 低、中、高、緊急四個優先級
- **任務分組**: 將相關任務組織成群組

### � 深度 Git 整合
- **智能 Commit 訊息**: 基於變更內容自動生成描述性訊息
- **變更總結**: 分析 Git diff 並提供變更摘要
- **分支管理**: 檢視和切換分支
- **歷史追蹤**: 查看檔案和專案的變更歷史

### � 程式碼重構與優化
- **重構建議**: AI 分析程式碼並提供改進建議
- **一鍵應用**: 直接將重構建議應用到程式碼
- **測試生成**: 為選取的程式碼自動生成單元測試
- **程式碼品質檢查**: 識別潛在問題和改進機會

### 📝 TODO 與任務管理
- **自動掃描**: 掃描專案中的 TODO、FIXME、HACK 註解
- **任務轉換**: 將註解自動轉換為可管理的任務項
- **檔案關聯**: 任務與特定檔案和行數關聯
- **進度追蹤**: 視覺化任務完成進度

### 🎨 現代化 UI
- **Webview 面板**: 原生 VS Code 整合的使用者介面
- **即時更新**: 任務狀態和進度的即時反饋
- **右鍵選單**: 快速存取常用功能
- **狀態列整合**: 顯示擴充功能狀態和快捷操作

## 系統架構

Devika VS Code Extension 採用模組化架構設計，專為 VS Code 環境優化。

### 🏗️ 核心模組

```
src/
├── core/                    # 核心管理器
│   └── DevikaCoreManager.ts # 主要協調器
├── llm/                     # AI 模型服務
│   └── LLMService.ts        # 統一 LLM 介面
├── context/                 # 程式碼情境智能
│   ├── CodeContextService.ts # 上下文分析
│   └── CodeParser.ts        # 程式碼解析
├── tasks/                   # 任務管理
│   └── TaskManager.ts       # 任務生命週期管理
├── git/                     # Git 整合
│   └── GitService.ts        # Git 操作封裝
├── ui/                      # 使用者介面
│   └── UIManager.ts         # Webview 管理
├── config/                  # 配置管理
│   └── ConfigManager.ts     # 設定和偏好
└── extension.ts             # 擴充功能入口點
```

### 🔧 技術堆疊

#### VS Code Extension 框架
- **TypeScript**: 主要開發語言，提供型別安全
- **VS Code API**: 深度整合編輯器功能
- **Webview API**: 自訂使用者介面

#### 程式碼分析
- **Tree-sitter**: 高效能語法樹解析
- **多語言支援**: TypeScript、Python、Java、C++、Go、Rust 等

#### AI 整合
- **多 LLM 支援**: Claude 3、GPT-4、Gemini Pro
- **Axios**: HTTP 客戶端，處理 API 請求
- **Token 管理**: 智能 Token 計算和成本控制

#### Git 整合
- **simple-git**: 強大的 Git 操作函式庫
- **差異分析**: 智能變更檢測和總結

#### 資料持久化
- **VS Code State API**: 工作區和全域狀態管理
- **JSON 序列化**: 任務和配置資料儲存

## 開發狀態

> [!NOTE]
> 此專案目前處於積極開發階段。我們採用敏捷開發方法，分為 5 個 Sprint 週期進行開發。

### 🚧 目前進度

| 功能模組 | 狀態 | 完成度 | 說明 |
|---------|------|--------|------|
| 🏗️ **基礎架構** | 🟡 進行中 | 70% | TypeScript 設定、配置管理已完成 |
| 🤖 **LLM 整合** | 🟡 進行中 | 60% | 多模型 API 整合進行中 |
| 🧠 **程式碼分析** | ⚪ 計劃中 | 0% | Tree-sitter 整合待開始 |
| 📋 **任務管理** | ⚪ 計劃中 | 0% | 任務系統設計完成，實作待開始 |
| 🔗 **Git 整合** | ⚪ 計劃中 | 0% | Git 服務架構設計完成 |
| 🎨 **使用者介面** | ⚪ 計劃中 | 0% | Webview 框架待實作 |

### 📅 開發時程

- **Sprint 1** (第 1-3 週): 建立基礎架構 (MVP) - 🟡 **進行中**
- **Sprint 2** (第 4-6 週): 程式碼情境智能 - ⚪ 待開始
- **Sprint 3** (第 7-9 週): 任務管理與 Git 整合 - ⚪ 待開始
- **Sprint 4** (第 10-12 週): 進階功能與工作流 - ⚪ 待開始
- **Sprint 5** (第 13-15 週): 優化與發布準備 - ⚪ 待開始

詳細開發計畫請參閱 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)

### 🎯 近期里程碑

#### Sprint 1 目標 (目前)
- [x] TypeScript 專案設定
- [x] 配置管理系統
- [🟡] LLM 服務整合
- [ ] 基本 UI 框架
- [ ] 指令註冊系統

#### 下一個里程碑 (Sprint 2)
- [ ] Tree-sitter 語法分析
- [ ] 程式碼符號提取
- [ ] 智能上下文分析
- [ ] 程式碼分析功能


## 快速開始

### 系統需求

#### 必要條件
- **VS Code**: 1.74.0 或更高版本
- **Node.js**: 18.0 或更高版本 (用於開發)
- **Git**: 用於版本控制功能

#### AI 模型 API 金鑰 (至少需要一個)
- **Claude API**: [Anthropic Console](https://console.anthropic.com/)
- **OpenAI API**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Gemini API**: [Google AI Studio](https://makersuite.google.com/app/apikey)

### 安裝指南

#### 方法一：從 VS Code Marketplace 安裝 (推薦)

1. **開啟 VS Code**
2. **前往擴充功能面板** (`Ctrl+Shift+X` 或 `Cmd+Shift+X`)
3. **搜尋** "Devika AI 助理"
4. **點擊安裝**

#### 方法二：從原始碼安裝

1. **複製儲存庫**
   ```bash
   git clone https://github.com/satanupup/devika.git
   cd devika
   ```

2. **安裝依賴項**
   ```bash
   npm install
   ```

3. **編譯擴充功能**
   ```bash
   npm run compile
   ```

4. **在 VS Code 中開啟專案**
   ```bash
   code .
   ```

5. **按 F5 啟動除錯模式**，這會開啟一個新的 VS Code 視窗並載入擴充功能

#### 方法三：安裝 VSIX 套件

1. **下載最新的 VSIX 檔案** 從 [Releases 頁面](https://github.com/satanupup/devika/releases)
2. **在 VS Code 中安裝**:
   ```bash
   code --install-extension devika-vscode-0.1.0.vsix
   ```

### 初次設定

1. **安裝完成後**，VS Code 會顯示歡迎通知
2. **開啟指令面板** (`Ctrl+Shift+P` 或 `Cmd+Shift+P`)
3. **執行指令**: `Devika: 啟動 AI 助理`
4. **設定 API 金鑰**:
   - 點擊設定圖示
   - 選擇要設定的 AI 提供商
   - 輸入您的 API 金鑰

### 驗證安裝

1. **檢查擴充功能狀態**:
   - 在活動列中應該會看到 Devika 圖示 🤖
   - 狀態列顯示 "Devika: 已就緒"

2. **測試基本功能**:
   - 選取一段程式碼
   - 右鍵選單中應該會出現 Devika 選項
   - 嘗試執行 "分析程式碼" 功能

3. **檢查設定**:
   - 前往 VS Code 設定 (`Ctrl+,`)
   - 搜尋 "Devika"
   - 確認所有設定項目都正確顯示

### 使用方法

#### 🚀 基本使用流程

1. **啟動 Devika**
   - 使用指令面板 (`Ctrl+Shift+P`) 執行 `Devika: 啟動 AI 助理`
   - 或點擊活動列中的 Devika 圖示 🤖

2. **程式碼分析**
   - 選取要分析的程式碼
   - 右鍵選單 → `分析程式碼`
   - 或使用指令 `Devika: 分析選取的程式碼`

3. **程式碼重構**
   - 選取要重構的程式碼
   - 右鍵選單 → `重構程式碼`
   - 檢視建議並選擇是否應用

4. **生成測試**
   - 選取函式或類別
   - 右鍵選單 → `生成測試`
   - 自動建立對應的測試檔案

#### 🔧 進階功能

1. **Git 整合**
   - 在 Git 面板中使用 `生成 Commit 訊息`
   - 使用 `總結 Git 變更` 了解變更內容
   - 自動分析 diff 並提供有意義的描述

2. **TODO 管理**
   - 自動掃描專案中的 TODO、FIXME 註解
   - 轉換為可管理的任務項目
   - 在任務面板中追蹤進度

3. **任務系統**
   - 檢視所有 AI 生成的任務
   - 按狀態、類型、優先級篩選
   - 標記完成或取消任務

#### 📝 使用範例

**程式碼分析範例**:
```typescript
// 選取這個函式
function calculateTotal(items: Item[]): number {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total += items[i].price * items[i].quantity;
    }
    return total;
}
```
→ AI 會分析並建議使用 `reduce` 方法來簡化程式碼

**重構建議範例**:
```typescript
// AI 建議的重構版本
function calculateTotal(items: Item[]): number {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
}
```

**測試生成範例**:
```typescript
// AI 生成的測試
describe('calculateTotal', () => {
    it('should calculate total correctly', () => {
        const items = [
            { price: 10, quantity: 2 },
            { price: 5, quantity: 3 }
        ];
        expect(calculateTotal(items)).toBe(35);
    });
});
```

#### ⚡ 快捷鍵

- `Ctrl+Shift+D` (Windows/Linux) 或 `Cmd+Shift+D` (Mac): 啟動 Devika
- `Ctrl+Shift+A` (Windows/Linux) 或 `Cmd+Shift+A` (Mac): 分析選取的程式碼
- `Ctrl+Shift+R` (Windows/Linux) 或 `Cmd+Shift+R` (Mac): 重構程式碼
- `Ctrl+Shift+T` (Windows/Linux) 或 `Cmd+Shift+T` (Mac): 生成測試

## 配置設定

Devika VS Code Extension 使用 VS Code 的內建設定系統，所有配置都整合在 VS Code 設定中。

### 🔧 設定方式

#### 方法一：設定 UI (建議)
1. 開啟 VS Code 設定 (`Ctrl+,` 或 `Cmd+,`)
2. 搜尋 "Devika"
3. 配置各項設定

#### 方法二：指令面板
1. 開啟指令面板 (`Ctrl+Shift+P`)
2. 執行 `Devika: 設定 API 金鑰`
3. 選擇要設定的提供商並輸入金鑰

#### 方法三：settings.json
```json
{
  "devika.openaiApiKey": "your-openai-api-key",
  "devika.claudeApiKey": "your-claude-api-key",
  "devika.geminiApiKey": "your-gemini-api-key",
  "devika.preferredModel": "claude-3-sonnet",
  "devika.autoScanTodos": true,
  "devika.enableCodeIndexing": true,
  "devika.maxContextLines": 100
}
```

### ⚙️ 主要設定項目

#### AI 模型設定
- **`devika.preferredModel`**: 偏好的 AI 模型
  - 選項: `gpt-4`, `gpt-3.5-turbo`, `claude-3-opus`, `claude-3-sonnet`, `gemini-pro`
  - 預設: `claude-3-sonnet`

#### API 金鑰
- **`devika.openaiApiKey`**: OpenAI API 金鑰
- **`devika.claudeApiKey`**: Claude API 金鑰
- **`devika.geminiApiKey`**: Gemini API 金鑰

#### 功能開關
- **`devika.autoScanTodos`**: 自動掃描 TODO 註解
  - 預設: `true`
- **`devika.enableCodeIndexing`**: 啟用程式碼索引
  - 預設: `true`

#### 效能設定
- **`devika.maxContextLines`**: 傳送給 AI 的最大程式碼行數
  - 範圍: 10-1000
  - 預設: 100

### 🔐 API 金鑰管理

#### 取得 API 金鑰
1. **Claude API**: [Anthropic Console](https://console.anthropic.com/)
2. **OpenAI API**: [OpenAI Platform](https://platform.openai.com/api-keys)
3. **Gemini API**: [Google AI Studio](https://makersuite.google.com/app/apikey)

#### 安全最佳實務
- API 金鑰儲存在 VS Code 的安全儲存中
- 不會同步到其他裝置
- 定期檢查和輪換金鑰
- 監控 API 使用量

### 🔍 設定驗證

擴充功能會自動驗證您的配置：
- 檢查是否至少設定一個 API 金鑰
- 驗證偏好模型是否有對應的金鑰
- 檢查數值設定是否在有效範圍內

如果配置有問題，會在狀態列顯示警告訊息。

## 專案結構

> **🧩 模組化架構**: 本專案採用分離式架構，將核心邏輯與 VS Code 特定功能分開

```
devika/
├── devika-core/                 # 🧠 核心 AI 引擎 (平台無關)
│   ├── src/
│   │   ├── interfaces/          # 抽象介面定義
│   │   │   ├── IFileSystem.ts   # 檔案系統介面
│   │   │   ├── IUserInterface.ts # 使用者介面介面
│   │   │   └── IProjectContext.ts # 專案上下文介面
│   │   ├── llm/                 # AI 模型服務
│   │   │   ├── LLMService.ts    # 統一 LLM 介面
│   │   │   ├── providers/       # 各 LLM 提供商實作
│   │   │   └── types.ts         # LLM 相關型別
│   │   ├── context/             # 程式碼情境分析 (待實作)
│   │   ├── tasks/               # 任務管理核心 (待實作)
│   │   ├── git/                 # Git 操作核心 (待實作)
│   │   └── plugins/             # 插件系統核心 (待實作)
│   ├── package.json             # 核心模組依賴
│   └── README.md                # 核心模組說明
│
├── devika-vscode/               # 🎨 VS Code 擴充功能 (目前主要開發)
│   ├── src/
│   │   ├── core/                # VS Code 核心管理
│   │   │   └── DevikaCoreManager.ts # 主要協調器
│   │   ├── adapters/            # devika-core 介面適配器
│   │   │   ├── VSCodeFileSystem.ts # 檔案系統適配
│   │   │   ├── VSCodeUI.ts      # 使用者介面適配
│   │   │   └── VSCodeProject.ts # 專案上下文適配
│   │   ├── ui/                  # VS Code UI 管理
│   │   │   └── UIManager.ts     # Webview 和 UI 管理
│   │   ├── config/              # VS Code 特定配置
│   │   │   └── ConfigManager.ts # 設定管理
│   │   ├── plugins/             # Augment 插件系統
│   │   │   ├── PluginManager.ts # 插件管理器
│   │   │   ├── agents/          # AI 代理實作
│   │   │   └── types.ts         # 插件型別定義
│   │   ├── test/                # 測試檔案
│   │   └── extension.ts         # 擴充功能入口點
│   ├── package.json             # VS Code 擴充功能清單
│   └── README.md                # VS Code 擴充功能說明
│
├── docs/                        # 📚 專案文件
│   ├── ARCHITECTURE_SEPARATION.md # 架構分離計畫
│   ├── DEVELOPMENT_PLAN.md      # 開發計畫
│   ├── AUGMENT_PLUGIN_GUIDE.md  # Augment 插件開發指南
│   └── API.md                   # API 文件
│
├── ROADMAP.md                   # 發展路線圖
├── CONTRIBUTING.md              # 貢獻指南
└── README.md                    # 主專案說明
```

### 🔄 架構優勢

| 優勢 | 說明 |
|------|------|
| **🔌 平台無關** | `devika-core` 可用於任何 IDE 或編輯器 |
| **🧪 易於測試** | 核心邏輯可獨立測試，不依賴 VS Code |
| **🚀 快速擴展** | 新平台只需實作介面適配器 |
| **🛠️ 維護性高** | 核心邏輯與 UI 邏輯分離 |
| **📦 模組化** | 清楚的依賴關係和職責分離 |

## 開發指南

### 開發環境設定

#### 必要工具
- **Node.js**: 18.0 或更高版本
- **npm**: 8.0 或更高版本
- **VS Code**: 1.74.0 或更高版本
- **Git**: 版本控制

#### 設定步驟

1. **複製儲存庫**
   ```bash
   git clone https://github.com/satanupup/devika.git
   cd devika
   ```

2. **安裝依賴項**
   ```bash
   npm install
   ```

3. **編譯 TypeScript**
   ```bash
   npm run compile
   ```

4. **啟動開發模式**
   ```bash
   npm run watch
   ```

5. **在 VS Code 中開啟專案**
   ```bash
   code .
   ```

6. **啟動除錯**
   - 按 `F5` 或使用除錯面板
   - 選擇 "執行擴充功能" 配置
   - 這會開啟一個新的 VS Code 視窗載入擴充功能

### 建置和測試

#### 編譯專案
```bash
# 一次性編譯
npm run compile

# 監視模式 (自動重新編譯)
npm run watch
```

#### 執行測試
```bash
# 執行所有測試
npm test

# 執行 ESLint 檢查
npm run lint
```

#### 打包擴充功能
```bash
# 安裝 vsce (如果尚未安裝)
npm install -g @vscode/vsce

# 打包成 VSIX 檔案
npm run package
```

### 發布流程

#### 準備發布
1. **更新版本號**
   ```bash
   npm version patch  # 或 minor, major
   ```

2. **更新 CHANGELOG**
   - 記錄新功能和修復
   - 遵循語義化版本規範

3. **測試擴充功能**
   - 在多個 VS Code 版本中測試
   - 驗證所有功能正常運作

#### 發布到 Marketplace
```bash
# 登入 Visual Studio Marketplace
vsce login <publisher-name>

# 發布擴充功能
vsce publish
```

### 程式碼風格

#### TypeScript 規範
- 使用 4 空格縮排
- 使用 PascalCase 命名類別
- 使用 camelCase 命名變數和函式
- 使用 UPPER_CASE 命名常數

#### ESLint 規則
專案使用 ESLint 確保程式碼品質：
```bash
# 檢查程式碼風格
npm run lint

# 自動修復可修復的問題
npm run lint -- --fix
```

### 除錯技巧

#### VS Code 除錯
1. 在程式碼中設定中斷點
2. 按 `F5` 啟動除錯
3. 在新視窗中觸發功能
4. 檢查變數和呼叫堆疊

#### 日誌記錄
```typescript
// 使用 console.log 進行除錯
console.log('Debug info:', data);

// 使用 VS Code 輸出頻道
const outputChannel = vscode.window.createOutputChannel('Devika');
outputChannel.appendLine('Log message');
```

#### 常見問題
- **擴充功能未載入**: 檢查 package.json 中的 activationEvents
- **指令未註冊**: 確認 contributes.commands 配置正確
- **Webview 無法顯示**: 檢查 CSP 設定和資源路徑

## 開發計畫

### 📋 敏捷開發方法

我們採用敏捷開發方法，將整個專案分為 5 個 Sprint 週期，每個週期約 2-3 週。每個 Sprint 都有明確的目標和可交付成果。

### 🎯 Sprint 概覽

#### Sprint 1: 建立基礎架構 (MVP) - 🟡 進行中
**時間**: 第 1-3 週
**目標**: 建立可運作的基礎骨架，實現核心功能的最小可行版本

**主要任務**:
- [x] TypeScript 專案設定和配置
- [x] ConfigManager 實作 (API 金鑰管理)
- [🟡] LLMService 基礎實作
- [ ] 基本 UI 框架 (Webview)
- [ ] 指令註冊系統

**成功標準**:
- 擴充功能可以在 VS Code 中正常載入
- 可以設定和驗證 API 金鑰
- 基本的 AI 對話功能運作

#### Sprint 2: 程式碼情境智能 - ⚪ 待開始
**時間**: 第 4-6 週
**目標**: 實作程式碼分析和上下文理解的核心功能

**主要任務**:
- [ ] Tree-sitter 語法分析整合
- [ ] CodeParser 核心功能 (符號提取、TODO 掃描)
- [ ] CodeContextService (智能上下文提取)
- [ ] 程式碼分析功能實作

**成功標準**:
- 可以正確解析主要程式語言的語法樹
- 能夠提取函式、類別等符號資訊
- 智能上下文提取功能運作正常

#### Sprint 3: 任務管理與 Git 整合 - ⚪ 待開始
**時間**: 第 7-9 週
**目標**: 實作任務代理系統和深度 Git 整合功能

**主要任務**:
- [ ] TaskManager 系統 (CRUD、狀態管理)
- [ ] GitService 核心功能 (狀態檢測、diff 分析)
- [ ] AI 回應解析器 (建議轉任務)
- [ ] 任務 UI 整合

**成功標準**:
- 任務管理系統完全運作
- Git 整合功能可以生成有意義的 commit 訊息
- AI 建議可以自動轉換為可管理的任務

#### Sprint 4: 進階功能與工作流 - ⚪ 待開始
**時間**: 第 10-12 週
**目標**: 實作程式碼重構、測試生成和完整工作流

**主要任務**:
- [ ] 程式碼重構功能 (建議生成、一鍵應用)
- [ ] 測試生成系統 (單元測試、測試檔案建立)
- [ ] 自動 TODO 掃描 (背景監聽)
- [ ] Git 工作流完善 (一鍵 commit、分支管理)

**成功標準**:
- 程式碼重構功能可以正確應用變更
- 測試生成功能產生可執行的測試
- 自動 TODO 掃描不會影響效能

#### Sprint 5: 優化與發布準備 - ⚪ 待開始
**時間**: 第 13-15 週
**目標**: 效能優化、測試完善、文件更新和發布準備

**主要任務**:
- [ ] 效能優化與錯誤處理
- [ ] 測試覆蓋率完善 (目標 >80%)
- [ ] UI/UX 優化
- [ ] 文件與範例完善
- [ ] 發布準備 (Marketplace)

**成功標準**:
- 擴充功能效能達到生產級別
- 測試覆蓋率達到 80% 以上
- 準備好發布到 VS Code Marketplace

### 📊 進度追蹤

我們使用 GitHub Issues 和 Project Board 來追蹤開發進度：

- **Issues**: 功能需求、錯誤回報、改進建議
- **Pull Requests**: 程式碼審查和協作開發
- **Milestones**: Sprint 里程碑和版本發布
- **Project Board**: 視覺化任務狀態和進度

### 🤝 參與開發

如果您想參與開發，請：

1. 查看 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) 了解詳細計畫
2. 選擇適合的 [Good First Issue](https://github.com/satanupup/devika/labels/good%20first%20issue)
3. 在 Issue 中留言表示您要處理
4. Fork 專案並建立功能分支
5. 提交 Pull Request

詳細的貢獻指南請參閱 [貢獻指南](#貢獻指南) 部分。

### 📋 專案文件

- **[開發計畫](DEVELOPMENT_PLAN.md)**: 詳細的 5 個 Sprint 開發計畫
- **[發展路線圖](ROADMAP.md)**: 長期版本發布和功能規劃
- **[貢獻指南](CONTRIBUTING.md)**: 完整的貢獻流程和規範
- **[專案總結](PROJECT_SUMMARY.md)**: 目前進度和成就總結

## 開發指南

### 設定開發環境

1. **Fork 並複製儲存庫**
   ```bash
   git clone https://github.com/yourusername/devika.git
   cd devika
   ```

2. **安裝開發依賴項**
   ```bash
   # 後端
   uv venv
   source .venv/bin/activate  # 或在 Windows 上使用 .venv\Scripts\activate
   uv pip install -r requirements.txt

   # 前端
   cd ui
   bun install
   ```

3. **以開發模式執行**
   ```bash
   # 後端 (自動重載)
   python devika.py

   # 前端 (熱重載)
   cd ui
   bun run dev
   ```

### 程式碼風格和標準

- **Python**: 遵循 PEP 8 指南
- **JavaScript/Svelte**: 使用 Prettier 進行格式化
- **文件**: 為任何新功能更新文件
- **測試**: 為新功能新增測試

### 開發工具

- **後端除錯**: 使用 Python 除錯器或日誌記錄
- **前端除錯**: 瀏覽器開發工具和 Svelte 開發工具
- **API 測試**: 使用 Postman 或 curl 測試 API 端點
- **資料庫**: SQLite 瀏覽器進行資料庫檢查

## 測試

### 執行測試

```bash
# 安裝測試依賴項
uv pip install pytest pytest-asyncio

# 執行所有測試
pytest

# 執行特定測試檔案
pytest tests/test_agents.py

# 執行覆蓋率測試
pytest --cov=src tests/
```

### 測試結構

```
tests/
├── test_agents/           # 代理功能測試
├── test_llm/             # 語言模型測試
├── test_browser/         # 瀏覽器自動化測試
├── test_api/             # API 端點測試
└── fixtures/             # 測試資料和固定裝置
```

### 編寫測試

```python
import pytest
from src.agents.planner import Planner

def test_planner_execution():
    planner = Planner(base_model="gpt-4")
    result = planner.execute("Create a todo app", "test_project")
    assert result is not None
    assert "plan" in result.lower()
```

## 部署

### 生產環境部署

#### Docker 部署 (建議)

```bash
# 使用 Docker Compose 建置和執行
docker-compose up -d

# 檢視日誌
docker-compose logs -f

# 停止服務
docker-compose down
```

#### 手動部署

```bash
# 設定生產環境
export FLASK_ENV=production

# 安裝生產依賴項
uv pip install -r requirements.txt

# 建置前端
cd ui
bun run build

# 使用生產伺服器啟動
gunicorn -w 4 -b 0.0.0.0:1337 devika:app
```

### 環境變數

```bash
# 生產環境必需
export CLAUDE_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export BING_API_KEY="your-key"

# 可選
export OLLAMA_HOST="http://localhost:11434"
export DATABASE_URL="sqlite:///data/db/devika.db"
```

### 擴展考量

- **負載平衡**: 使用 nginx 或類似工具處理多個實例
- **資料庫**: 考慮使用 PostgreSQL 處理大量使用
- **快取**: 實作 Redis 進行會話和回應快取
- **監控**: 使用 Prometheus 和 Grafana 等工具

## 故障排除

### 常見問題

#### 安裝問題

**問題**: `playwright install` 失敗
```bash
# 解決方案: 安裝系統依賴項
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2
```

**問題**: Python 版本相容性
```bash
# 解決方案: 使用 Python 3.10 或 3.11
pyenv install 3.11.0
pyenv local 3.11.0
```

#### 執行時問題

**問題**: "找不到模型" 錯誤
- 檢查設定中的 API 金鑰
- 驗證模型在您的地區是否可用
- 嘗試不同的模型

**問題**: 搜尋無法運作
- 驗證搜尋引擎 API 金鑰
- 檢查網路連線
- 嘗試不同的搜尋引擎

**問題**: 瀏覽器自動化失敗
- 執行 `playwright install --with-deps`
- 檢查系統權限
- 驗證顯示伺服器 (Linux)

#### 效能問題

**問題**: 回應時間緩慢
- 使用更快的模型 (Groq、本地 LLMs)
- 減少上下文視窗大小
- 檢查網路連線

**問題**: 記憶體使用量過高
- 重新啟動應用程式
- 清除瀏覽器快取
- 使用較輕量的模型

### 除錯模式

啟用除錯日誌記錄：

```bash
# 設定環境變數
export DEVIKA_DEBUG=true

# 或修改 config.toml
[LOGGING]
LOG_REST_API = "true"
LOG_PROMPTS = "true"
```

### 取得幫助

1. **檢查日誌**: `data/logs/` 目錄
2. **啟用除錯模式**: 參閱上述除錯說明
3. **搜尋問題**: [GitHub Issues](https://github.com/satanupup/devika/issues)
4. **詢問社群**: [Discord 伺服器](https://discord.gg/CYRp43878y)

## 貢獻指南

我們歡迎貢獻來增強 Devika 的功能並改善其效能！

### 如何貢獻

1. **在 GitHub 上 Fork 儲存庫**
2. **建立功能分支** (`git checkout -b feature/amazing-feature`)
3. **進行變更** 並徹底測試
4. **提交變更** (`git commit -m 'Add amazing feature'`)
5. **推送到分支** (`git push origin feature/amazing-feature`)
6. **開啟 Pull Request**

### 貢獻指南

#### Pull Request 格式
- **標題**: 使用前綴如 `Feature:`、`Fix:`、`Docs:`、`Refactor:`、`Improve:`
- **描述**: 提供關於您變更的清楚詳細資訊
- **測試**: 確保所有測試通過並在需要時新增新測試
- **文件**: 更新相關文件

#### 貢獻領域

- 🤖 **新 AI 代理**: 實作針對特定任務的專門代理
- 🔍 **搜尋改進**: 增強網頁搜尋和資訊提取
- 💻 **語言支援**: 新增對新程式語言的支援
- 🎨 **UI/UX**: 改善網頁介面和使用者體驗
- 📚 **文件**: 改善指南、教學和 API 文件
- 🧪 **測試**: 新增全面的測試覆蓋
- 🐛 **錯誤修復**: 修復回報的問題和邊緣情況

#### 開發設定

詳細設定說明請參閱 [開發指南](#開發指南) 部分。

詳細貢獻指南請參閱 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 發展路線圖

### 目前重點 (2024)

- [ ] **穩定性改進**
  - 為所有代理建立全面的測試套件
  - 執行時錯誤處理和恢復
  - 效能最佳化

- [ ] **增強功能**
  - 多檔案專案編輯
  - 進階程式碼重構
  - 資料庫整合支援
  - API 測試和驗證

- [ ] **使用者體驗**
  - 改善網頁介面
  - 更好的錯誤訊息和指導
  - 教學影片和文件
  - 跨平台安裝套件

### 未來目標

- [ ] **SWE-bench 效能**
  - 在 SWE-bench 上達到競爭性分數
  - 進階除錯功能
  - 複雜專案理解

- [ ] **企業功能**
  - 團隊協作工具
  - 專案模板和工作流程
  - 進階安全性和合規性

- [ ] **生態系統整合**
  - IDE 外掛和擴充功能
  - CI/CD 管道整合
  - 雲端部署選項

詳細計劃請參閱完整的 [ROADMAP.md](ROADMAP.md)。

## 功能詳解

### 🧠 智能程式碼分析
Devika 使用先進的語法樹分析技術，能夠：
- 理解程式碼結構和語義
- 識別潛在的效能問題
- 提供具體的改進建議
- 計算程式碼複雜度指標

### � 任務代理系統
自動將 AI 建議轉換為可管理的任務：
- 任務狀態追蹤（待處理、進行中、已完成）
- 優先級管理（低、中、高、緊急）
- 檔案和行數關聯
- 任務分組和批次操作

### 🔗 Git 深度整合
智能分析 Git 變更並提供協助：
- 基於 diff 內容生成描述性 commit 訊息
- 分析變更影響範圍
- 提供變更總結和建議
- 支援分支管理和歷史查看

## 故障排除

### 常見問題

#### 擴充功能無法啟動
- 檢查 VS Code 版本是否 ≥ 1.74.0
- 確認 Node.js 版本是否 ≥ 18.0
- 重新載入 VS Code 視窗

#### API 金鑰無效
- 驗證金鑰格式是否正確
- 檢查金鑰是否有足夠的配額
- 確認選擇的模型與金鑰匹配

#### 程式碼分析失敗
- 確認選取的程式碼語法正確
- 檢查檔案是否已儲存
- 嘗試重新啟動擴充功能

#### 任務無法建立
- 檢查工作區是否已開啟
- 確認有寫入權限
- 清除擴充功能快取

### 取得幫助
1. 查看 [GitHub Issues](https://github.com/satanupup/devika/issues)
2. 檢查 VS Code 開發者工具的控制台
3. 啟用除錯模式並查看日誌

## 貢獻指南

我們歡迎各種形式的貢獻！

### 🤝 如何貢獻

1. **Fork 專案** 到您的 GitHub 帳戶
2. **建立功能分支** (`git checkout -b feature/amazing-feature`)
3. **提交變更** (`git commit -m 'Add amazing feature'`)
4. **推送分支** (`git push origin feature/amazing-feature`)
5. **開啟 Pull Request**

### 📝 貢獻類型

- **🐛 錯誤修復**: 修復已知問題
- **✨ 新功能**: 實作新的 AI 功能
- **📚 文件改進**: 改善說明文件
- **🧪 測試**: 增加測試覆蓋率
- **🎨 UI/UX**: 改善使用者介面
- **⚡ 效能優化**: 提升執行效率

### 🔧 開發貢獻

參考 [開發指南](#開發指南) 設定開發環境，然後：

1. 選擇一個 [Good First Issue](https://github.com/satanupup/devika/labels/good%20first%20issue)
2. 在 Issue 中留言表示您要處理
3. 按照開發指南進行開發
4. 提交 Pull Request 並等待審核

## 授權條款

本專案採用 [MIT 授權條款](LICENSE)。

### 第三方授權
- **VS Code API**: MIT License
- **Tree-sitter**: MIT License
- **simple-git**: MIT License
- **axios**: MIT License

## 致謝

- **Microsoft** 提供優秀的 VS Code 平台和 API
- **Anthropic** 提供 Claude AI 模型
- **OpenAI** 提供 GPT 模型和 APIs
- **Google** 提供 Gemini AI 模型
- **Tree-sitter 社群** 提供強大的語法分析工具
- **開源社群** 提供無數的函式庫和工具

特別感謝所有幫助讓 Devika VS Code Extension 變得更好的貢獻者！

---

<div align="center">

## Star History

<a href="https://star-history.com/#satanupup/devika&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=satanupup/devika&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=satanupup/devika&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=satanupup/devika&type=Date" />
 </picture>
</a>

---

**🚀 準備好革命性地改變您的編程體驗了嗎？**

[快速開始](#快速開始) • [GitHub Issues](https://github.com/satanupup/devika/issues) • [貢獻專案](#貢獻指南)

*與 Devika VS Code Extension 一起提升開發效率！👩‍💻*

**⭐ 如果這個專案對您有幫助，請給我們一個 Star！**

</div>
