<p align="center">
  <img src=".assets/devika-avatar.png" alt="Devika Logo" width="250">
</p>

<h1 align="center">🚀 Devika - 智能 AI 軟體工程師 👩‍💻</h1>

<p align="center">
  <strong>一個先進的 AI 軟體工程師，能夠理解高層次的人類指令，將其分解為步驟，研究相關資訊，並編寫程式碼來實現指定目標。</strong>
</p>

<p align="center">
  <a href="#快速開始">快速開始</a> •
  <a href="#核心功能">功能特色</a> •
  <a href="#系統架構">系統架構</a> •
  <a href="#配置設定">配置設定</a> •
  <a href="#貢獻指南">貢獻指南</a>
</p>

![devika screenshot](.assets/devika-screenshot.png)

> [!IMPORTANT]
> 此專案目前處於非常早期的開發/實驗階段。目前有許多未實現/損壞的功能。歡迎貢獻來幫助專案進展！

## 目錄

- [關於專案](#關於專案)
- [演示影片](#演示影片)
- [核心功能](#核心功能)
- [系統架構](#系統架構)
- [技術堆疊](#技術堆疊)
- [快速開始](#快速開始)
  - [系統需求](#系統需求)
  - [安裝步驟](#安裝步驟)
  - [Docker 快速啟動](#docker-快速啟動)
  - [使用方法](#使用方法)
- [配置設定](#配置設定)
- [專案結構](#專案結構)
- [API 文件](#api-文件)
- [開發指南](#開發指南)
- [測試](#測試)
- [部署](#部署)
- [故障排除](#故障排除)
- [貢獻指南](#貢獻指南)
- [發展路線圖](#發展路線圖)
- [幫助與支援](#幫助與支援)
- [授權條款](#授權條款)

## 關於專案

Devika 是一個先進的 AI 軟體工程師，能夠理解高層次的人類指令，將其分解為步驟，研究相關資訊，並編寫程式碼來實現指定目標。Devika 利用大型語言模型、規劃和推理演算法，以及網頁瀏覽能力來智能地開發軟體。

### Devika 的特色優勢

- **🎯 自主規劃**: 將複雜任務分解為可管理的步驟
- **🔍 智能研究**: 自動搜尋和收集相關資訊
- **💻 多語言編程**: 支援多種程式語言編寫程式碼
- **🌐 網頁整合**: 無縫瀏覽和提取網頁資訊
- **📊 即時監控**: 提供進度和決策制定的即時更新
- **🔄 迭代開發**: 基於回饋學習和適應

Devika 旨在透過提供一個能夠在最少人工指導下承擔複雜編程任務的 AI 配對程式設計師，來革命性地改變我們構建軟體的方式。無論您需要創建新功能、修復錯誤，還是從頭開發整個專案，Devika 都能為您提供協助。

> [!NOTE]
> Devika 是以 Cognition AI 的 [Devin](https://www.cognition-labs.com/introducing-devin) 為藍本。此專案旨在成為 Devin 的開源替代方案，並有一個「過於雄心勃勃」的目標，即在 [SWE-bench](https://www.swebench.com/) 基準測試中達到與 Devin 相同的分數...並最終超越它？

## 演示影片

https://github.com/satanupup/devika/assets/26198477/cfed6945-d53b-4189-9fbe-669690204206

## 核心功能

### 🤖 多模型 AI 支援
- **Claude 3** (建議使用，效能最佳)
- **GPT-4** (OpenAI)
- **Gemini** (Google)
- **Mistral** (Mistral AI)
- **Groq** (高速推理)
- **本地 LLMs** 透過 [Ollama](https://ollama.com)

### 🧠 智能代理系統
- **進階規劃**: 將複雜任務分解為可執行的步驟
- **情境研究**: 提取關鍵字並搜尋相關資訊
- **多代理架構**: 針對不同任務的專門代理（規劃器、研究員、編程師等）
- **決策制定**: 智能路由和任務執行

### 🔍 研究與資訊收集
- **網頁搜尋整合**: 支援 Bing、Google 和 DuckDuckGo
- **內容提取**: 智能解析網頁內容
- **知識管理**: 情境資訊儲存和檢索
- **PDF 處理**: 從文件中提取資訊

### 💻 程式碼生成與管理
- **多語言支援**: Python、JavaScript、Java、C++ 等
- **專案組織**: 結構化檔案和資料夾管理
- **程式碼執行**: 內建程式碼執行器和測試功能
- **版本控制**: Git 整合進行專案管理

### 🌐 網頁互動
- **瀏覽器自動化**: Playwright 驅動的網頁瀏覽
- **動態內容**: 處理 JavaScript 渲染的頁面
- **螢幕截圖**: 視覺回饋和除錯
- **表單互動**: 自動化網頁表單填寫

### 📊 監控與視覺化
- **即時狀態追蹤**: 監控代理進度和決策
- **互動式 UI**: 使用 Svelte 構建的現代網頁介面
- **Token 使用追蹤**: 監控 API 成本和使用量
- **日誌系統**: 全面的除錯和審計追蹤

## 系統架構

Devika 採用模組化、基於代理的架構設計，具有可擴展性和可延展性。

### 核心組件

1. **代理核心**: 管理 AI 工作流程的中央協調器
2. **專門代理**: 針對特定任務的代理（規劃器、研究員、編程師等）
3. **LLM 介面**: 多種語言模型的統一介面
4. **瀏覽器引擎**: 網頁互動和內容提取
5. **專案管理器**: 檔案系統和專案組織
6. **狀態管理**: 即時代理狀態追蹤
7. **網頁介面**: 用戶互動的現代 UI

詳細技術細節請閱讀 [**架構文件**](docs/architecture)。

## 技術堆疊

### 後端
- **Python 3.10+**: 核心應用程式執行環境
- **Flask**: 網頁框架和 API 伺服器
- **Socket.IO**: 即時通訊
- **SQLModel**: 資料庫 ORM 和管理
- **Playwright**: 瀏覽器自動化
- **Jinja2**: 提示模板引擎

### 前端
- **Svelte**: 現代響應式 UI 框架
- **SvelteKit**: 全端網頁框架
- **TailwindCSS**: 實用優先的 CSS 框架
- **Monaco Editor**: 程式碼編輯器組件
- **Vite**: 建置工具和開發伺服器

### AI 與機器學習
- **多種 LLM APIs**: Claude、GPT-4、Gemini、Mistral、Groq
- **Ollama**: 本地 LLM 推理
- **Tiktoken**: Token 計數和管理
- **KeyBERT**: 關鍵字提取
- **Sentence Transformers**: 語義搜尋


## 快速開始

### 系統需求

在安裝 Devika 之前，請確保您已安裝以下軟體：

#### 系統要求
- **Python**: 3.10 或 3.11 (尚不支援 3.12+)
- **Node.js**: 18.0 或更高版本
- **Git**: 用於複製儲存庫

#### 套件管理器
- **uv**: 快速的 Python 套件管理器 ([安裝指南](https://github.com/astral-sh/uv))
- **bun**: JavaScript 執行環境和套件管理器 ([安裝指南](https://bun.sh/docs/installation))

#### 可選依賴項
- **Ollama**: 用於本地 LLM 支援 ([設定指南](docs/Installation/ollama.md))
- **Docker**: 用於容器化部署

### 安裝步驟

#### 方法一：標準安裝

1. **複製儲存庫**
   ```bash
   git clone https://github.com/satanupup/devika.git
   cd devika
   ```

2. **設定 Python 環境**
   ```bash
   # 建立虛擬環境
   uv venv

   # 啟動虛擬環境
   # 在 macOS/Linux:
   source .venv/bin/activate

   # 在 Windows:
   .venv\Scripts\activate

   # 安裝 Python 依賴項
   uv pip install -r requirements.txt
   ```

3. **安裝瀏覽器依賴項**
   ```bash
   # 安裝 Playwright 瀏覽器 (網頁瀏覽必需)
   playwright install --with-deps
   ```

4. **設定前端**
   ```bash
   cd ui
   bun install
   cd ..
   ```

5. **啟動應用程式**
   ```bash
   # 終端機 1: 啟動後端伺服器
   python devika.py

   # 終端機 2: 啟動前端 (在新的終端機中)
   cd ui
   bun run start
   ```

6. **存取應用程式**
   - 開啟瀏覽器並導航至 `http://localhost:3001`
   - 您應該會看到 Devika 介面

#### 方法二：快速啟動腳本

對於 Windows 使用者，您可以使用提供的批次腳本：

```bash
# 執行自動化設定腳本
run.bat
```

此腳本將會：
- 使用 DeepSeek 模型啟動 Ollama
- 啟動後端伺服器
- 啟動前端開發伺服器
- 在瀏覽器中開啟應用程式

### Docker 快速啟動

對於容器化設定：

```bash
# 複製儲存庫
git clone https://github.com/satanupup/devika.git
cd devika

# 使用 Docker Compose 啟動
docker-compose up -d

# 在 http://localhost:3001 存取應用程式
```

### 驗證安裝

安裝完成後，您應該看到：

1. **後端伺服器運行中**:
   ```
   root: INFO   : Devika is up and running!
   ```

2. **前端可在** `http://localhost:3001` **存取**

3. **終端機輸出中沒有錯誤訊息**

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
