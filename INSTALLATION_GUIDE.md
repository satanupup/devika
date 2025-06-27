# 🚀 Devika VS Code Extension 安裝和使用指南

## 📦 **安裝方法**

### 方法 1: 從 VSIX 文件安裝 (推薦)

1. **下載 VSIX 文件**：
   - 文件名：`devika-vscode-0.1.0.vsix`
   - 大小：6.64 MB
   - 包含：79 個文件

2. **安裝命令**：
   ```bash
   code --install-extension devika-vscode-0.1.0.vsix
   ```

3. **或者通過 VS Code 界面安裝**：
   - 打開 VS Code
   - 按 `Ctrl+Shift+P` 打開命令面板
   - 輸入 "Extensions: Install from VSIX..."
   - 選擇 `devika-vscode-0.1.0.vsix` 文件

### 方法 2: 從源碼構建

```bash
# 克隆項目
git clone https://github.com/satanupup/devika.git
cd devika

# 安裝依賴
npm install

# 編譯項目
npm run compile

# 打包擴展
npm run package

# 安裝
code --install-extension devika-vscode-0.1.0.vsix
```

## 🔍 **安裝後檢查**

### 1. 檢查擴展是否已安裝
- 按 `Ctrl+Shift+X` 打開擴展面板
- 搜索 "Devika"
- 應該看到 "Devika AI 開發助理" 已安裝

### 2. 查找 Devika 圖標
- 在左側活動欄中尋找 🤖 圖標
- 如果沒有看到，請重新載入 VS Code

### 3. 重新載入 VS Code
```
Ctrl+Shift+P → "Developer: Reload Window"
```

## 🎯 **首次使用**

### 1. 激活 Devika
- 點擊活動欄中的 🤖 圖標
- 或按 `Ctrl+Shift+P` 輸入 "Devika: 啟動 AI 助理"

### 2. 配置 API 密鑰
在 VS Code 設置中配置以下任一 API 密鑰：

```json
{
  "devika.openaiApiKey": "sk-your-openai-api-key",
  "devika.claudeApiKey": "sk-ant-your-claude-api-key", 
  "devika.geminiApiKey": "your-gemini-api-key"
}
```

### 3. 開始使用
- 在 Devika 側邊欄中點擊 "開始使用 Devika"
- 或在聊天面板中輸入您的第一個問題

## 🔧 **故障排除**

### 問題 1: 看不到 Devika 圖標

**解決方案**：
1. 確保擴展已正確安裝和啟用
2. 重新載入 VS Code 窗口
3. 檢查活動欄是否隱藏了圖標

**詳細步驟**：
```bash
# 1. 檢查擴展狀態
Ctrl+Shift+X → 搜索 "Devika" → 確保已啟用

# 2. 手動激活
Ctrl+Shift+P → "Devika: 啟動 AI 助理"

# 3. 重新載入窗口
Ctrl+Shift+P → "Developer: Reload Window"
```

### 問題 2: 擴展無法激活

**檢查輸出面板**：
1. 按 `Ctrl+Shift+U` 打開輸出面板
2. 在下拉菜單中選擇 "Devika"
3. 查看錯誤信息

**常見錯誤和解決方案**：
- **模塊未找到**：重新安裝擴展
- **API 密鑰錯誤**：檢查配置設置
- **網絡連接問題**：檢查網絡設置

### 問題 3: VS Code 版本不兼容

**檢查版本**：
- 確保 VS Code 版本 ≥ 1.74.0
- 如果版本過舊，請更新 VS Code

### 問題 4: 命令不可用

**解決方案**：
1. 確保擴展已完全加載
2. 等待幾秒鐘後重試
3. 重新載入窗口

## 📋 **可用功能**

### 側邊欄視圖
- **任務列表**：查看和管理 AI 任務
- **AI 助理**：與 AI 進行對話
- **代碼上下文**：管理代碼片段和上下文

### 命令面板功能
- `Devika: 啟動 AI 助理`
- `Devika: 分析選取的程式碼`
- `Devika: 生成 CONTRIBUTING.md`
- `Devika: 生成 ROADMAP.md`
- `Devika: 生成 CHANGELOG.md`
- `Devika: 添加代碼片段到上下文`
- `Devika: 管理上下文`
- `Devika: 清空上下文`

### 右鍵菜單
- 選擇代碼後右鍵 → "Devika: 分析選取的程式碼"

## ⚙️ **配置選項**

### 基本配置
```json
{
  "devika.defaultProvider": "openai",
  "devika.defaultModel": "gpt-4",
  "devika.agentMode.enabled": true,
  "devika.chat.autoScroll": true
}
```

### 高級配置
```json
{
  "devika.fileExclusion.enabled": true,
  "devika.fileExclusion.customPatterns": ["*.log", "node_modules/**"],
  "devika.context.maxSnippets": 20,
  "devika.performance.largeProjectOptimization": true
}
```

## 🎉 **驗證安裝成功**

如果以下所有項目都正常，說明安裝成功：

- ✅ 在活動欄中看到 🤖 Devika 圖標
- ✅ 點擊圖標後顯示三個視圖面板
- ✅ 命令面板中可以找到 Devika 命令
- ✅ 可以與 AI 助理進行對話
- ✅ 可以分析選取的代碼

## 📞 **獲取幫助**

如果遇到問題：

1. **查看文檔**：閱讀 README.md 和其他文檔
2. **檢查 Issues**：訪問 [GitHub Issues](https://github.com/satanupup/devika/issues)
3. **報告問題**：創建新的 Issue 並提供詳細信息
4. **聯繫支持**：通過 GitHub 聯繫開發團隊

---

**🎊 歡迎使用 Devika AI 開發助理！**
