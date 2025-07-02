# 🔧 Devika VS Code Extension - 故障排除指南

<p align="center">
  <img src=".assets/devika-avatar.png" alt="Devika Logo" width="200">
</p>

<h1 align="center">🛠️ Devika 故障排除指南</h1>

<p align="center">
  <strong>快速解決常見問題的完整指南</strong>
</p>

---

## 📋 目錄

- [快速診斷](#快速診斷)
- [安裝問題](#安裝問題)
- [啟動問題](#啟動問題)
- [API 相關問題](#api-相關問題)
- [性能問題](#性能問題)
- [功能問題](#功能問題)
- [Gemini 特定問題](#gemini-特定問題)
- [調試技巧](#調試技巧)
- [獲得幫助](#獲得幫助)

---

## 🚀 快速診斷

### 系統檢查清單

在報告問題之前，請先檢查以下項目：

```bash
# 1. 檢查 VS Code 版本
code --version
# 需要 >= 1.74.0

# 2. 檢查 Node.js 版本 (開發用)
node --version
# 需要 >= 18.0.0

# 3. 檢查擴展狀態
Ctrl+Shift+P → "Extensions: Show Installed Extensions"
# 確認 Devika 已安裝且已啟用
```

### 快速重置

如果遇到問題，可以嘗試以下快速重置步驟：

```bash
# 1. 重新載入 VS Code 視窗
Ctrl+Shift+P → "Developer: Reload Window"

# 2. 重啟 Devika 擴展
Ctrl+Shift+P → "Devika: 重啟擴展"

# 3. 清除快取
Ctrl+Shift+P → "Devika: 清除快取"

# 4. 重置設定
Ctrl+Shift+P → "Devika: 重置所有設定"
```

---

## 📦 安裝問題

### 問題：擴展無法安裝

**症狀**: 在 VS Code Marketplace 中找不到 Devika 或安裝失敗

**解決方案**:
1. **檢查網路連接**
   ```bash
   # 測試網路連接
   ping marketplace.visualstudio.com
   ```

2. **手動安裝 VSIX**
   ```bash
   # 下載 VSIX 文件後手動安裝
   code --install-extension devika-vscode-0.1.0.vsix
   ```

3. **清除 VS Code 快取**
   ```bash
   # Windows
   %APPDATA%\Code\User\workspaceStorage\
   
   # macOS
   ~/Library/Application Support/Code/User/workspaceStorage/
   
   # Linux
   ~/.config/Code/User/workspaceStorage/
   ```

### 問題：依賴項安裝失敗

**症狀**: 從源碼安裝時 `npm install` 失敗

**解決方案**:
```bash
# 1. 清除 npm 快取
npm cache clean --force

# 2. 刪除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 3. 重新安裝
npm install

# 4. 如果仍然失敗，嘗試使用 yarn
npm install -g yarn
yarn install
```

---

## 🚀 啟動問題

### 問題：擴展無法啟動

**症狀**: 安裝後看不到 Devika 圖標或命令無法執行

**診斷步驟**:
```bash
# 1. 檢查擴展是否已啟用
Ctrl+Shift+P → "Extensions: Show Installed Extensions"

# 2. 查看開發者控制台
Ctrl+Shift+I → Console 標籤

# 3. 檢查擴展日誌
Ctrl+Shift+P → "Developer: Show Logs" → "Extension Host"
```

**解決方案**:
1. **重新載入視窗**
   ```bash
   Ctrl+Shift+P → "Developer: Reload Window"
   ```

2. **檢查 VS Code 版本**
   ```bash
   # 確保版本 >= 1.74.0
   code --version
   ```

3. **手動啟動擴展**
   ```bash
   Ctrl+Shift+P → "Devika: 啟動 AI 助理"
   ```

### 問題：啟動時間過長

**症狀**: 擴展啟動超過 5 秒

**解決方案**:
1. **啟用啟動優化**
   ```json
   {
     "devika.performance.startupOptimization": true,
     "devika.performance.largeProjectOptimization": true
   }
   ```

2. **減少初始化負載**
   ```json
   {
     "devika.learning.enabled": false,
     "devika.completion.enabled": false
   }
   ```

3. **檢查系統資源**
   ```bash
   # 檢查記憶體使用
   Ctrl+Shift+P → "Developer: Show Running Extensions"
   ```

---

## 🔑 API 相關問題

### 問題：API 金鑰無效

**症狀**: 顯示 "API key is invalid" 或 "Unauthorized" 錯誤

**解決方案**:
1. **驗證金鑰格式**
   ```typescript
   // OpenAI: sk-...
   // Claude: sk-ant-...
   // Gemini: AI...
   ```

2. **檢查金鑰權限**
   ```bash
   # 測試 OpenAI API
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api.openai.com/v1/models
   
   # 測試 Claude API
   curl -H "x-api-key: YOUR_API_KEY" \
        https://api.anthropic.com/v1/messages
   ```

3. **重新設定金鑰**
   ```bash
   Ctrl+Shift+P → "Devika: 設定 API 金鑰"
   ```

### 問題：API 請求超時

**症狀**: 請求長時間無回應或超時錯誤

**解決方案**:
1. **增加超時時間**
   ```json
   {
     "devika.api.timeoutMs": 60000
   }
   ```

2. **檢查網路連接**
   ```bash
   # 測試連接
   ping api.openai.com
   ping api.anthropic.com
   ```

3. **使用代理設定**
   ```json
   {
     "http.proxy": "http://proxy.company.com:8080",
     "http.proxyStrictSSL": false
   }
   ```

### 問題：API 配額不足

**症狀**: "Rate limit exceeded" 或 "Quota exceeded" 錯誤

**解決方案**:
1. **檢查使用量**
   - OpenAI: https://platform.openai.com/usage
   - Claude: https://console.anthropic.com/
   - Gemini: https://makersuite.google.com/

2. **啟用請求快取**
   ```json
   {
     "devika.api.enableCache": true,
     "devika.api.cacheSize": 100
   }
   ```

3. **調整請求頻率**
   ```json
   {
     "devika.api.maxConcurrency": 2,
     "devika.api.requestDelay": 1000
   }
   ```

---

## ⚡ 性能問題

### 問題：記憶體使用過高

**症狀**: VS Code 變慢或記憶體使用超過 500MB

**診斷**:
```bash
# 檢查擴展記憶體使用
Ctrl+Shift+P → "Developer: Show Running Extensions"
```

**解決方案**:
1. **啟用記憶體優化**
   ```json
   {
     "devika.performance.memoryOptimization": true,
     "devika.performance.cacheSize": 52428800
   }
   ```

2. **減少快取大小**
   ```json
   {
     "devika.context.maxSnippets": 10,
     "devika.chat.maxHistory": 20
   }
   ```

3. **定期清理快取**
   ```bash
   Ctrl+Shift+P → "Devika: 清除快取"
   ```

### 問題：大型專案處理緩慢

**症狀**: 在大型專案中文件掃描或分析很慢

**解決方案**:
1. **啟用大型專案優化**
   ```json
   {
     "devika.performance.largeProjectOptimization": true,
     "devika.fileExclusion.enabled": true
   }
   ```

2. **配置文件排除**
   ```json
   {
     "devika.fileExclusion.patterns": [
       "**/node_modules/**",
       "**/dist/**",
       "**/build/**",
       "**/.git/**"
     ]
   }
   ```

3. **限制掃描深度**
   ```json
   {
     "devika.context.maxDepth": 3,
     "devika.context.maxFiles": 100
   }
   ```

---

## 🔧 功能問題

### 問題：代碼分析無結果

**症狀**: 選擇代碼後分析沒有回應或結果為空

**解決方案**:
1. **檢查語言支援**
   ```typescript
   // 支援的語言
   const supportedLanguages = [
     'javascript', 'typescript', 'python', 
     'java', 'csharp', 'go', 'rust', 'cpp'
   ];
   ```

2. **確認代碼已儲存**
   ```bash
   Ctrl+S  # 儲存文件
   ```

3. **檢查選取範圍**
   - 確保選取了有效的代碼片段
   - 避免選取註釋或空行

### 問題：任務無法創建

**症狀**: 點擊 "轉換為任務" 沒有反應

**解決方案**:
1. **檢查工作區**
   ```bash
   # 確保已開啟工作區
   File → Open Folder
   ```

2. **檢查權限**
   ```bash
   # 確保有寫入權限
   ls -la .vscode/
   ```

3. **重新初始化任務系統**
   ```bash
   Ctrl+Shift+P → "Devika: 重新初始化任務系統"
   ```

### 問題：Git 整合無法使用

**症狀**: Git 相關功能無法使用

**解決方案**:
1. **檢查 Git 安裝**
   ```bash
   git --version
   ```

2. **確認 Git 倉庫**
   ```bash
   git status
   ```

3. **檢查 Git 配置**
   ```bash
   git config --list
   ```

---

## 🔮 Gemini 特定問題

### 問題：Gemini API 連接失敗

**症狀**: 使用 Gemini 時出現連接錯誤

**解決方案**:
1. **檢查 API 金鑰格式**
   ```typescript
   // Gemini API 金鑰格式: AIza...
   ```

2. **確認 API 啟用**
   - 訪問 [Google AI Studio](https://makersuite.google.com/)
   - 確認 Gemini API 已啟用

3. **檢查地區限制**
   ```bash
   # 某些地區可能無法使用 Gemini API
   # 嘗試使用 VPN 或其他 AI 提供商
   ```

### 問題：Gemini 回應品質問題

**症狀**: Gemini 回應不如預期或格式錯誤

**解決方案**:
1. **調整模型參數**
   ```json
   {
     "devika.gemini.temperature": 0.7,
     "devika.gemini.maxTokens": 2048
   }
   ```

2. **優化 Prompt 設計**
   ```typescript
   // 使用更具體的指令
   const prompt = `請分析以下 TypeScript 代碼並提供具體的改進建議：\n\n${code}`;
   ```

3. **切換到其他模型**
   ```bash
   Ctrl+Shift+P → "Devika: 切換 AI 模型"
   # 選擇 Claude 或 GPT-4
   ```

---

## 🔍 調試技巧

### 啟用詳細日誌

```json
{
  "devika.debug.enabled": true,
  "devika.debug.level": "verbose",
  "devika.debug.logToFile": true
}
```

### 查看日誌文件

```bash
# Windows
%APPDATA%\Code\User\globalStorage\satanupup.devika-vscode\logs\

# macOS
~/Library/Application Support/Code/User/globalStorage/satanupup.devika-vscode/logs/

# Linux
~/.config/Code/User/globalStorage/satanupup.devika-vscode/logs/
```

### 開發者工具

```bash
# 開啟開發者控制台
Ctrl+Shift+I

# 查看擴展主機日誌
Ctrl+Shift+P → "Developer: Show Logs" → "Extension Host"

# 重新載入擴展
Ctrl+Shift+P → "Developer: Reload Window"
```

### 診斷命令

```bash
# 顯示系統資訊
Ctrl+Shift+P → "Devika: 顯示診斷資訊"

# 檢查配置
Ctrl+Shift+P → "Devika: 檢查配置"

# 測試 API 連接
Ctrl+Shift+P → "Devika: 測試 API 連接"

# 匯出日誌
Ctrl+Shift+P → "Devika: 匯出診斷日誌"
```

---

## 🆘 獲得幫助

### 自助資源

1. **官方文檔**
   - [用戶指南](USER_GUIDE.md)
   - [開發者指南](DEVELOPER_GUIDE.md)
   - [API 參考](API_REFERENCE.md)

2. **常見問題**
   - [FAQ 文檔](docs/FAQ.md)
   - [已知問題](https://github.com/satanupup/devika/issues?q=is%3Aissue+label%3Aknown-issue)

### 社群支援

1. **GitHub Issues**
   - 報告 Bug: [新建 Issue](https://github.com/satanupup/devika/issues/new?template=bug_report.md)
   - 功能請求: [新建 Issue](https://github.com/satanupup/devika/issues/new?template=feature_request.md)

2. **討論區**
   - [GitHub Discussions](https://github.com/satanupup/devika/discussions)

### 報告問題時請提供

1. **系統資訊**
   ```bash
   # VS Code 版本
   code --version
   
   # 作業系統
   # Node.js 版本 (如果從源碼安裝)
   ```

2. **錯誤資訊**
   - 完整的錯誤訊息
   - 重現步驟
   - 預期行為 vs 實際行為

3. **配置資訊**
   ```bash
   # 匯出診斷資訊
   Ctrl+Shift+P → "Devika: 匯出診斷日誌"
   ```

4. **日誌文件**
   - 開發者控制台日誌
   - 擴展主機日誌
   - Devika 詳細日誌

---

## 📞 緊急聯絡

如果遇到嚴重問題影響工作，請：

1. **立即停用擴展**
   ```bash
   Ctrl+Shift+P → "Extensions: Disable" → 搜尋 "Devika"
   ```

2. **備份重要數據**
   ```bash
   Ctrl+Shift+P → "Devika: 匯出所有數據"
   ```

3. **聯絡支援**
   - Email: support@devika-extension.com
   - GitHub: [@satanupup](https://github.com/satanupup)

---

*最後更新: 2025-07-02*
