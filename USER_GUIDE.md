# 🧩 Devika VS Code Extension - 用戶指南

<p align="center">
  <img src=".assets/devika-avatar.png" alt="Devika Logo" width="200">
</p>

<h1 align="center">🤖 Devika AI 開發助理 - 完整用戶指南</h1>

<p align="center">
  <strong>讓 AI 成為您最得力的編程夥伴</strong>
</p>

---

## 📋 目錄

- [快速開始](#快速開始)
- [核心功能](#核心功能)
- [AI 模型切換](#ai-模型切換)
- [智能功能](#智能功能)
- [多模態支援](#多模態支援)
- [整合工具](#整合工具)
- [個人化設定](#個人化設定)
- [使用技巧](#使用技巧)

---

## 🚀 快速開始

### 第一次使用

1. **啟動 Devika**
   ```
   Ctrl+Shift+P → "Devika: 啟動 AI 助理"
   ```

2. **設定 API 金鑰**
   - 點擊活動欄中的 🤖 圖標
   - 選擇 "設定" → "API 金鑰"
   - 輸入您的 AI 提供商 API 金鑰

3. **開始對話**
   - 在聊天面板中輸入您的問題
   - 或選擇程式碼後右鍵選擇 "Devika 分析"

### 基本命令

| 命令 | 功能 | 快捷鍵 |
|------|------|--------|
| `Devika: 啟動 AI 助理` | 開啟主面板 | `Ctrl+Shift+D` |
| `Devika: 分析選取的程式碼` | 分析程式碼 | `Ctrl+Shift+A` |
| `Devika: 生成 Commit 訊息` | Git 整合 | `Ctrl+Shift+G` |
| `Devika: 掃描 TODO` | 任務管理 | `Ctrl+Shift+T` |

---

## 🧠 核心功能

### 1. 智能程式碼分析

**功能說明**: 使用 Tree-sitter 技術深度理解程式碼結構

**使用方法**:
1. 選擇要分析的程式碼
2. 右鍵選擇 "Devika 分析程式碼"
3. 查看分析結果和建議

**支援的分析類型**:
- 程式碼品質檢查
- 效能優化建議
- 重構建議
- 安全性分析
- 複雜度計算

### 2. 任務代理系統

**功能說明**: 將 AI 建議自動轉換為可追蹤的任務

**使用方法**:
1. 在聊天中詢問改進建議
2. 點擊 "轉換為任務"
3. 在任務面板中管理任務狀態

**任務狀態**:
- 🔲 待處理 (Not Started)
- 🔄 進行中 (In Progress)  
- ✅ 已完成 (Completed)
- ❌ 已取消 (Cancelled)

### 3. Git 深度整合

**功能說明**: 智能分析 Git 變更並提供協助

**主要功能**:
- 自動生成 Commit 訊息
- 變更影響分析
- 分支管理建議
- 衝突解決協助

**使用方法**:
```bash
# 自動生成 Commit 訊息
Ctrl+Shift+P → "Devika: 生成 Commit 訊息"

# 分析變更影響
Ctrl+Shift+P → "Devika: 分析 Git 變更"
```

---

## 🔄 AI 模型切換

### 支援的 AI 模型

| 提供商 | 模型 | 適用場景 | 成本 |
|--------|------|----------|------|
| **Anthropic** | Claude 3.5 Sonnet | 日常開發、代碼分析 | 中等 |
| **OpenAI** | GPT-4 Turbo | 複雜問題解決 | 較高 |
| **OpenAI** | GPT-3.5 Turbo | 快速查詢 | 較低 |
| **Google** | Gemini 1.5 Pro | 大型專案分析 | 中等 |

### 切換方法

**方法一: 設定面板**
1. 點擊 🤖 圖標
2. 選擇 "設定" → "AI 模型"
3. 選擇想要的模型

**方法二: 命令面板**
```
Ctrl+Shift+P → "Devika: 切換 AI 模型"
```

**方法三: 狀態欄**
- 點擊狀態欄中的模型名稱
- 從下拉選單中選擇

### 模型選擇建議

**日常開發推薦**:
- 🧠 Claude 3.5 Sonnet (平衡性能與成本)
- ⚡ GPT-4 Turbo (最佳性能)

**快速查詢推薦**:
- 💨 GPT-3.5 Turbo (最快回應)
- ⚡ Claude 3 Haiku (高效率)

**大型專案推薦**:
- 🚀 Gemini 1.5 Pro (長上下文)
- 🧠 Claude 3.5 Sonnet (深度分析)

---

## ✨ 智能功能

### 1. 智能代碼完成

**功能說明**: 基於上下文的智能代碼建議

**啟用方法**:
```json
{
  "devika.completion.enabled": true,
  "devika.completion.triggerCharacters": [".", "(", "["]
}
```

**特色功能**:
- 上下文感知建議
- 多語言支援
- 函數簽名提示
- 文檔自動生成

### 2. 持續學習系統

**功能說明**: 學習您的編程習慣並提供個人化建議

**學習內容**:
- 編程模式識別
- 偏好設定學習
- 常用函數記憶
- 錯誤模式分析

**查看學習狀態**:
```
Ctrl+Shift+P → "Devika: 顯示學習統計"
```

### 3. 智能重構

**功能說明**: AI 驅動的代碼重構建議

**支援的重構類型**:
- 提取函數/方法
- 重命名變數
- 簡化條件表達式
- 消除重複代碼

**使用方法**:
1. 選擇要重構的代碼
2. 右鍵選擇 "Devika 重構建議"
3. 選擇適合的重構選項

---

## 🎨 多模態支援

### 圖像處理功能

**支援格式**: PNG、JPEG、GIF、SVG、WebP

**主要功能**:
- 螢幕截圖分析
- UI 元素識別
- 設計模式識別
- 代碼生成

### 螢幕截圖功能

**全螢幕截圖**:
```
Ctrl+Shift+P → "Devika 多模態: 截取螢幕截圖"
```

**指定區域截圖**:
```
Ctrl+Shift+P → "Devika 多模態: 截取指定區域"
```

**VS Code 視窗截圖**:
```
Ctrl+Shift+P → "Devika 多模態: 截取 VS Code 視窗"
```

### Figma 整合

**設定 API Token**:
1. 開啟命令面板
2. 執行 `Devika 多模態: 設置 Figma API Token`
3. 輸入您的 Figma API Token

**功能特色**:
- 設計文件匯入
- 設計令牌提取
- 組件識別分析
- 設計系統分析

### AI 驅動代碼生成

**從圖像生成代碼**:
1. 上傳或截取 UI 設計圖
2. 選擇目標框架 (React/Vue/Angular)
3. 獲得對應的 HTML/CSS 代碼

**支援框架**:
- React + TypeScript
- Vue 3 + Composition API
- Angular + TypeScript
- 純 HTML/CSS

---

## 🔗 整合工具

### 代碼管理平台

**GitHub 整合**:
- 倉庫管理
- Issues 追蹤
- Pull Requests
- 提交歷史分析

**GitLab 整合**:
- 項目管理
- 合併請求
- CI/CD 流水線

**Bitbucket 整合**:
- 代碼倉庫
- 分支管理
- 部署管理

### 項目管理工具

**Jira 整合**:
- Issue 追蹤
- Sprint 管理
- 看板視圖

**Linear 整合**:
- 現代化 Issue 追蹤
- 項目管理

**Trello 整合**:
- 看板式管理
- 任務追蹤

### 設定整合

**配置 GitHub**:
```json
{
  "devika.integrations.github.token": "your-github-token",
  "devika.integrations.github.enabled": true
}
```

**配置 Jira**:
```json
{
  "devika.integrations.jira.url": "https://your-domain.atlassian.net",
  "devika.integrations.jira.token": "your-jira-token"
}
```

---

## ⚙️ 個人化設定

### 基本偏好設定

```json
{
  "devika.preferences.preferredModel": "claude-3-5-sonnet",
  "devika.preferences.maxContextLines": 100,
  "devika.preferences.autoScanTodos": true,
  "devika.preferences.enableCodeIndexing": true,
  "devika.preferences.language": "zh-TW"
}
```

### 進階設定

**性能優化**:
```json
{
  "devika.performance.cacheSize": 52428800,
  "devika.performance.maxConcurrency": 5,
  "devika.performance.timeoutMs": 30000,
  "devika.performance.largeProjectOptimization": true
}
```

**UI 客製化**:
```json
{
  "devika.ui.theme": "dark",
  "devika.ui.fontSize": 14,
  "devika.ui.showLineNumbers": true,
  "devika.ui.enableAnimations": true
}
```

### 學習系統設定

**啟用學習功能**:
```json
{
  "devika.learning.enabled": true,
  "devika.learning.patternRecognition": true,
  "devika.learning.adaptiveSuggestions": true,
  "devika.learning.privacyMode": false
}
```

**學習數據管理**:
- 查看學習統計: `Ctrl+Shift+P → "Devika: 學習統計"`
- 匯出學習數據: `Ctrl+Shift+P → "Devika: 匯出學習數據"`
- 重置學習數據: `Ctrl+Shift+P → "Devika: 重置學習數據"`

---

## 💡 使用技巧

### 提高效率的技巧

1. **善用快捷鍵**: 記住常用命令的快捷鍵
2. **設定別名**: 為常用命令設定自訂快捷鍵
3. **使用模板**: 建立常用的代碼模板
4. **批量操作**: 利用任務系統批量處理改進建議

### 最佳實踐

1. **定期更新**: 保持擴展和 AI 模型為最新版本
2. **合理使用**: 根據任務複雜度選擇適當的 AI 模型
3. **學習反饋**: 對 AI 建議提供反饋以改善學習效果
4. **備份設定**: 定期備份個人化設定和學習數據

### 故障排除

**常見問題快速解決**:
- 擴展無回應: 重新載入 VS Code 視窗
- API 錯誤: 檢查網路連接和 API 金鑰
- 性能問題: 清理快取並重啟擴展

**獲得幫助**:
- 查看 [故障排除指南](TROUBLESHOOTING.md)
- 訪問 [GitHub Issues](https://github.com/satanupup/devika/issues)
- 參考 [FAQ 文檔](docs/FAQ.md)

---

*最後更新: 2025-07-02*
