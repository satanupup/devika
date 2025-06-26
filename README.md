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

#### 首次設定

1. **存取介面**
   - 開啟瀏覽器並前往 `http://localhost:3001`
   - 您將看到 Devika 儀表板

2. **配置設定**
   - 點擊設定圖示
   - 為您想使用的模型新增 API 金鑰：
     - OpenAI API 金鑰用於 GPT 模型
     - Anthropic API 金鑰用於 Claude 模型
     - Google API 金鑰用於 Gemini 模型
     - 搜尋引擎 API 金鑰 (Bing/Google)

3. **建立您的第一個專案**
   - 點擊「選擇專案」→「新專案」
   - 輸入專案名稱
   - 選擇您偏好的：
     - **AI 模型**: Claude 3 (建議)、GPT-4、Gemini 等
     - **搜尋引擎**: Bing、Google 或 DuckDuckGo

#### 使用 Devika

1. **開始對話**
   ```
   範例提示：
   - "使用 React 和 Node.js 建立一個待辦事項應用程式"
   - "建立一個 Python 新聞文章網頁爬蟲"
   - "修復我的 Express.js 應用程式中的身份驗證錯誤"
   - "為我的網站新增深色模式切換"
   ```

2. **監控進度**
   - 觀看 Devika 將您的請求分解為步驟
   - 查看即時研究和規劃
   - 觀看程式碼生成進度
   - 監控瀏覽器互動和搜尋

3. **檢視和迭代**
   - 在檔案瀏覽器中檢查生成的程式碼
   - 提供回饋或請求修改
   - 提出後續問題或請求額外功能

4. **專案管理**
   - 所有檔案都儲存在 `data/projects/` 目錄中
   - 每個專案都維護自己的對話歷史
   - 使用專案選擇器在專案之間切換

#### 範例工作流程

```
您: "建立一個簡單的部落格網站，使用 HTML、CSS 和 JavaScript"

Devika:
1. 📋 規劃: 分解部落格網站需求
2. 🔍 研究: 搜尋現代部落格設計模式
3. 💻 編程: 建立 HTML 結構、CSS 樣式和 JavaScript 功能
4. 📁 組織: 將檔案儲存到您的專案目錄
5. ✅ 完成: 部落格網站準備好供檢視

您: "為部落格新增深色模式切換"

Devika:
1. 🔍 研究: 尋找深色模式實作模式
2. 💻 編程: 新增切換功能和深色主題樣式
3. 🔄 整合: 使用新功能更新現有檔案
```

## 配置設定

Devika 使用 `config.toml` 檔案進行配置管理。首次執行時，它會自動從 `sample.config.toml` 模板建立此檔案。

### 配置檔案結構

```toml
[STORAGE]
SQLITE_DB = "data/db/devika.db"
SCREENSHOTS_DIR = "data/screenshots"
PDFS_DIR = "data/pdfs"
PROJECTS_DIR = "data/projects"
LOGS_DIR = "data/logs"
REPOS_DIR = "data/repos"

[API_KEYS]
# 語言模型
CLAUDE = "your-claude-api-key"
OPENAI = "your-openai-api-key"
GEMINI = "your-gemini-api-key"
MISTRAL = "your-mistral-api-key"
GROQ = "your-groq-api-key"

# 搜尋引擎
BING = "your-bing-api-key"
GOOGLE_SEARCH = "your-google-search-api-key"
GOOGLE_SEARCH_ENGINE_ID = "your-google-search-engine-id"

# 部署
NETLIFY = "your-netlify-api-key"

[API_ENDPOINTS]
BING = "https://api.bing.microsoft.com/v7.0/search"
GOOGLE = "https://www.googleapis.com/customsearch/v1"
OLLAMA = "http://127.0.0.1:11434"
OPENAI = "https://api.openai.com/v1"

[LOGGING]
LOG_REST_API = "true"
LOG_PROMPTS = "false"

[TIMEOUT]
INFERENCE = 60
```

### API 金鑰設定

#### 必需的 API 金鑰

1. **語言模型** (至少選擇一個):
   - **Claude (建議)**: [取得 API 金鑰](https://console.anthropic.com/)
   - **OpenAI**: [取得 API 金鑰](https://platform.openai.com/api-keys)
   - **Google Gemini**: [取得 API 金鑰](https://makersuite.google.com/app/apikey)
   - **Mistral**: [取得 API 金鑰](https://console.mistral.ai/)
   - **Groq**: [取得 API 金鑰](https://console.groq.com/)

2. **搜尋引擎** (至少選擇一個):
   - **Bing Search**: [取得 API 金鑰](https://www.microsoft.com/en-us/bing/apis/bing-web-search-api)
   - **Google Custom Search**: [設定指南](docs/Installation/search_engine.md)

#### 可選的 API 金鑰

- **Netlify**: 用於自動部署 ([取得 API 金鑰](https://app.netlify.com/user/applications))

### 配置方法

#### 方法一：網頁介面 (建議)
1. 啟動 Devika
2. 前往設定頁面
3. 輸入您的 API 金鑰
4. 儲存配置

#### 方法二：手動配置
1. 複製 `sample.config.toml` 到 `config.toml`
2. 使用您的 API 金鑰編輯檔案
3. 重新啟動 Devika

### 安全最佳實務

- **絕不提交** `config.toml` 到版本控制
- **使用環境變數** 進行生產部署
- **定期輪換 API 金鑰**
- **監控使用情況** 以偵測未授權存取

詳細設定說明請參閱：
- [搜尋引擎設定指南](docs/Installation/search_engine.md)
- [Ollama 設定指南](docs/Installation/ollama.md)

## 專案結構

```
devika/
├── src/                          # 核心應用程式原始碼
│   ├── agents/                   # AI 代理實作
│   │   ├── planner/             # 任務規劃代理
│   │   ├── researcher/          # 資訊研究代理
│   │   ├── coder/               # 程式碼生成代理
│   │   ├── action/              # 動作決策代理
│   │   └── ...                  # 其他專門代理
│   ├── llm/                     # 語言模型介面
│   ├── browser/                 # 網頁瀏覽和搜尋
│   ├── memory/                  # 知識庫和儲存
│   ├── services/                # 外部服務整合
│   └── config.py                # 配置管理
├── ui/                          # 前端應用程式
│   ├── src/                     # Svelte 原始碼
│   ├── static/                  # 靜態資源
│   └── package.json             # 前端依賴項
├── data/                        # 應用程式資料
│   ├── projects/                # 生成的專案檔案
│   ├── db/                      # SQLite 資料庫
│   ├── logs/                    # 應用程式日誌
│   └── screenshots/             # 瀏覽器螢幕截圖
├── docs/                        # 文件
│   ├── architecture/            # 架構文件
│   └── Installation/            # 設定指南
├── devika.py                    # 主要應用程式進入點
├── requirements.txt             # Python 依賴項
├── docker-compose.yaml          # Docker 配置
└── config.toml                  # 應用程式配置
```

## API 文件

Devika 提供 REST API 供程式化存取：

### 核心端點

- `GET /api/status` - 檢查伺服器狀態
- `GET /api/data` - 取得專案、模型和搜尋引擎
- `POST /api/messages` - 檢索專案訊息
- `GET /api/settings` - 取得目前配置
- `POST /api/settings` - 更新配置
- `GET /api/logs` - 取得應用程式日誌
- `GET /api/token-usage` - 取得 token 使用統計

### WebSocket 事件

- `socket_connect` - 建立連接
- `user-message` - 向代理發送使用者訊息
- `agent-response` - 接收代理回應
- `code` - 接收生成的程式碼
- `screenshot` - 接收瀏覽器螢幕截圖

### API 使用範例

```python
import requests

# 檢查狀態
response = requests.get('http://localhost:1337/api/status')
print(response.json())

# 取得可用模型
response = requests.get('http://localhost:1337/api/data')
data = response.json()
print(f"可用模型: {data['models']}")
```

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

## 幫助與支援

### 社群資源

- 💬 **Discord 社群**: [加入我們的 Discord](https://discord.gg/3VCpAbWwy5)
- 🐛 **問題追蹤器**: [回報錯誤](https://github.com/satanupup/devika/issues)
- 💡 **討論區**: [功能請求和想法](https://github.com/satanupup/devika/discussions)
- 📖 **文件**: [架構文件](docs/architecture/)

### 取得幫助

1. **首先檢查文件**
2. **搜尋現有問題** 尋找類似問題
3. **加入我們的 Discord** 獲得即時社群支援
4. **建立詳細問題** 如果找不到解決方案

### 回報問題

回報問題時，請包含：

- **環境詳細資訊** (作業系統、Python 版本等)
- **重現問題的步驟**
- **預期與實際行為**
- **錯誤訊息和日誌**
- **配置詳細資訊** (不含 API 金鑰)

## 授權條款

Devika 在 [MIT 授權條款](https://opensource.org/licenses/MIT) 下發布。更多資訊請參閱 [`LICENSE`](LICENSE) 檔案。

### 第三方授權條款

此專案使用多個開源函式庫。詳細資訊請參閱各個套件的授權條款：

- **Flask**: BSD-3-Clause 授權條款
- **Svelte**: MIT 授權條款
- **Playwright**: Apache-2.0 授權條款
- **Anthropic SDK**: MIT 授權條款
- **OpenAI SDK**: MIT 授權條款

## 致謝

- **Anthropic** 提供 Claude AI 模型
- **OpenAI** 提供 GPT 模型和 APIs
- **Google** 提供 Gemini AI 模型
- **Mistral AI** 提供 Mistral 模型
- **Groq** 提供高速推理
- **Ollama** 提供本地 LLM 支援
- **開源社群** 提供無數的函式庫和工具

特別感謝所有幫助讓 Devika 變得更好的貢獻者！

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

[快速開始](#快速開始) • [加入 Discord](https://discord.gg/3VCpAbWwy5) • [貢獻專案](#貢獻指南)

*與 Devika 一起快樂編程！👩‍💻*

</div>
