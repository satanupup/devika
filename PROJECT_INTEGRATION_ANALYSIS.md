# 📊 Devika 專案整合分析與清理計畫

## 🔍 專案現狀掃描

### 📁 檔案結構分析

#### ✅ **VS Code Extension 相關檔案** (保留)
```
src/
├── extension.ts              # VS Code 擴充功能入口
├── core/DevikaCoreManager.ts # 核心管理器
├── llm/LLMService.ts         # LLM 服務 (TypeScript)
├── context/                  # 程式碼上下文分析
├── tasks/TaskManager.ts      # 任務管理
├── git/GitService.ts         # Git 服務
├── ui/UIManager.ts           # UI 管理
├── config/ConfigManager.ts   # 配置管理
├── plugins/                  # Augment 插件系統
└── test/                     # 測試檔案

devika-core/                  # 新建的核心模組
package.json                  # VS Code Extension 配置
tsconfig.json                 # TypeScript 配置
.vscode/                      # VS Code 開發配置
```

#### ❌ **原始 Devika Python 專案檔案** (需要清理)
```
src/
├── agents/                   # Python AI 代理 (刪除)
├── apis/                     # Python API (刪除)
├── bert/                     # BERT 模型 (刪除)
├── browser/                  # 瀏覽器自動化 (刪除)
├── documenter/               # 文件生成器 (刪除)
├── experts/                  # 專家系統 (刪除)
├── filesystem/               # Python 檔案系統 (刪除)
├── llm/                      # Python LLM 客戶端 (刪除)
├── memory/                   # 記憶體管理 (刪除)
├── prompts/                  # Prompt 模板 (部分保留)
├── sandbox/                  # 沙盒執行 (刪除)
├── services/                 # Python 服務 (刪除)
├── __pycache__/              # Python 快取 (刪除)
├── *.py                      # Python 檔案 (刪除)

ui/                           # Svelte UI (刪除)
requirements.txt              # Python 依賴 (刪除)
devika.py                     # Python 主程式 (刪除)
*.dockerfile                  # Docker 檔案 (刪除)
docker-compose.yaml           # Docker Compose (刪除)
config.toml                   # Python 配置 (刪除)
```

#### 📚 **文件檔案** (需要整合)
```
README.md                     # 主要說明文件 (需要統一)
DEVELOPMENT_PLAN.md           # 開發計畫 (已更新)
ROADMAP.md                    # 路線圖 (已更新)
CONTRIBUTING.md               # 貢獻指南 (已更新)
ARCHITECTURE_SEPARATION.md   # 架構分離計畫 (新增)
AUGMENT_PLUGIN_GUIDE.md      # 插件開發指南 (新增)
PROJECT_SUMMARY.md           # 專案總結 (新增)
ARCHITECTURE.md              # 舊架構文件 (需要刪除)
開發計畫.md                   # 中文開發計畫 (重複，刪除)
```

## 🎯 文件一致性分析

### 📖 **各文件的核心訊息**

| 文件 | 主要內容 | 狀態 | 一致性 |
|------|----------|------|--------|
| **README.md** | VS Code Extension 說明 | ✅ 已更新 | 🟢 一致 |
| **DEVELOPMENT_PLAN.md** | 5 Sprint 開發計畫 | ✅ 已更新 | 🟢 一致 |
| **ROADMAP.md** | 版本發布路線圖 | ✅ 已更新 | 🟢 一致 |
| **CONTRIBUTING.md** | 貢獻指南 | ✅ 已更新 | 🟢 一致 |
| **ARCHITECTURE_SEPARATION.md** | 架構分離計畫 | ✅ 新增 | 🟢 一致 |
| **AUGMENT_PLUGIN_GUIDE.md** | 插件開發指南 | ✅ 新增 | 🟢 一致 |
| **PROJECT_SUMMARY.md** | 專案總結 | ✅ 新增 | 🟢 一致 |

### 🔄 **需要統一的方向**

#### ✅ **已統一的核心概念**
1. **專案定位**: VS Code AI 開發助理擴充功能
2. **技術架構**: devika-core + devika-vscode 分離式架構
3. **開發方法**: 個體戶友善的敏捷開發
4. **核心功能**: Augment-like 插件系統
5. **目標使用者**: 個人開發者和小團隊

#### ⚠️ **需要調整的不一致處**
1. **README.md** 中仍有部分 Python 相關的內容
2. **package.json** 中的描述需要更新
3. **測試說明** 混合了 Python 和 TypeScript 的內容

## 🗑️ 清理計畫

### Phase 1: 刪除 Python 相關檔案 (1 小時)

#### 🔥 **立即刪除的檔案和目錄**
```bash
# Python 原始碼
src/agents/
src/apis/
src/bert/
src/browser/
src/documenter/
src/experts/
src/filesystem/
src/llm/*.py
src/memory/
src/sandbox/
src/services/
src/__pycache__/
src/*.py (除了保留的 prompt 檔案)

# Python 配置和依賴
requirements.txt
devika.py
config.toml
sample.config.toml

# Docker 相關
devika.dockerfile
app.dockerfile
docker-compose.yaml

# Svelte UI (已被 VS Code Webview 取代)
ui/

# 其他不需要的檔案
logs/
data/
benchmarks/
Makefile
setup.sh
run.bat
Run.txt
devika.sln
```

#### 📋 **保留但需要移動的檔案**
```bash
# Prompt 模板 (移動到 devika-core)
src/prompts/ → devika-core/src/prompts/

# 文件檔案 (移動到 docs/)
ARCHITECTURE.md → 刪除 (已被 ARCHITECTURE_SEPARATION.md 取代)
開發計畫.md → 刪除 (重複)
```

### Phase 2: 更新配置檔案 (30 分鐘)

#### 📝 **需要更新的檔案**
1. **package.json**: 移除 Python 相關的腳本和依賴
2. **README.md**: 移除 Python 安裝和使用說明
3. **.gitignore**: 移除 Python 相關的忽略規則
4. **tsconfig.json**: 確保只包含 TypeScript 檔案

### Phase 3: 建立統一的專案結構 (30 分鐘)

#### 🏗️ **最終專案結構**
```
devika/
├── devika-core/              # 核心 AI 引擎
├── src/                      # VS Code Extension 原始碼
├── out/                      # 編譯輸出
├── docs/                     # 所有文件
│   ├── ARCHITECTURE_SEPARATION.md
│   ├── DEVELOPMENT_PLAN.md
│   ├── AUGMENT_PLUGIN_GUIDE.md
│   └── API.md
├── .vscode/                  # VS Code 開發配置
├── node_modules/             # Node.js 依賴
├── README.md                 # 主要說明文件
├── ROADMAP.md               # 發展路線圖
├── CONTRIBUTING.md          # 貢獻指南
├── PROJECT_SUMMARY.md       # 專案總結
├── package.json             # VS Code Extension 配置
├── tsconfig.json            # TypeScript 配置
└── LICENSE                  # 授權條款
```

## 📋 執行清單

### 🚀 **立即執行** (優先級 1)

- [ ] **刪除 Python 檔案和目錄**
  - [ ] 刪除 `src/agents/`, `src/apis/`, `src/bert/` 等 Python 目錄
  - [ ] 刪除 `requirements.txt`, `devika.py`, `config.toml`
  - [ ] 刪除 `ui/`, `docker-compose.yaml`, `*.dockerfile`
  - [ ] 刪除 `logs/`, `data/`, `benchmarks/`

- [ ] **移動和整理檔案**
  - [ ] 移動 `src/prompts/` 到 `devika-core/src/prompts/`
  - [ ] 刪除重複的文件檔案
  - [ ] 建立 `docs/` 目錄並移動相關文件

### 🔧 **配置更新** (優先級 2)

- [ ] **更新 package.json**
  - [ ] 移除 Python 相關腳本
  - [ ] 更新專案描述和關鍵字
  - [ ] 確認 TypeScript 依賴項

- [ ] **更新 README.md**
  - [ ] 移除 Python 安裝說明
  - [ ] 移除 Svelte UI 相關內容
  - [ ] 更新測試說明為 TypeScript

- [ ] **更新 .gitignore**
  - [ ] 移除 Python 相關忽略規則
  - [ ] 新增 VS Code Extension 相關忽略規則

### 📚 **文件統一** (優先級 3)

- [ ] **建立統一的文件索引**
  - [ ] 在 README.md 中新增文件導航
  - [ ] 確保所有文件的連結正確
  - [ ] 統一文件的格式和風格

- [ ] **驗證一致性**
  - [ ] 檢查所有文件的專案定位一致
  - [ ] 確認技術架構描述統一
  - [ ] 驗證開發計畫的連貫性

## ⏰ 預估時間

| 階段 | 任務 | 預估時間 |
|------|------|----------|
| Phase 1 | 刪除 Python 檔案 | 1 小時 |
| Phase 2 | 更新配置檔案 | 30 分鐘 |
| Phase 3 | 建立統一結構 | 30 分鐘 |
| **總計** | | **2 小時** |

## 🎯 清理後的效益

### ✅ **立即效益**
1. **專案聚焦**: 100% 專注於 VS Code Extension 開發
2. **減少混淆**: 移除不相關的 Python 程式碼
3. **檔案大小**: 大幅減少專案檔案大小
4. **開發效率**: 更清楚的專案結構

### 🚀 **長期效益**
1. **維護性**: 更容易維護和更新
2. **新手友善**: 新貢獻者更容易理解專案
3. **部署簡化**: 只需要 Node.js 環境
4. **文件一致**: 統一的專案說明和指南

---

*建立時間: 2024-12-19*  
*預計執行時間: 2 小時*  
*執行優先級: 🔥 高優先級*
