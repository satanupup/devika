# 🔧 Devika VS Code Extension 故障排除指南

## ❌ **常見錯誤和解決方案**

### 錯誤 1: "command 'devika.start' not found"

**原因**: 擴展沒有正確激活或命令沒有註冊

**解決方案**:

1. **重新安裝擴展**:
   ```bash
   # 卸載舊版本
   code --uninstall-extension devika.vscode-extension
   
   # 安裝新版本
   code --install-extension devika-vscode-0.1.0.vsix
   ```

2. **完全重啟 VS Code**:
   - 關閉所有 VS Code 窗口
   - 等待 5 秒
   - 重新打開 VS Code

3. **檢查擴展狀態**:
   - 按 `Ctrl+Shift+X`
   - 搜索 "Devika"
   - 確保擴展已啟用且版本為 0.1.0

4. **手動重新載入窗口**:
   ```
   Ctrl+Shift+P → "Developer: Reload Window"
   ```

5. **檢查輸出面板**:
   - 按 `Ctrl+Shift+U`
   - 選擇 "Devika" 查看錯誤信息

### 錯誤 2: 看不到 Devika 圖標

**解決方案**:

1. **檢查活動欄**:
   - 右鍵點擊活動欄
   - 確保沒有隱藏 Devika

2. **手動激活**:
   ```
   Ctrl+Shift+P → "Extensions: Show Installed Extensions"
   找到 Devika → 點擊 "Reload Required" (如果有)
   ```

3. **重置 VS Code 設置**:
   ```
   Ctrl+Shift+P → "Preferences: Open Settings (JSON)"
   檢查是否有衝突的設置
   ```

### 錯誤 3: "Devika 核心管理器尚未初始化"

**原因**: 擴展初始化過程中出現錯誤

**解決方案**:

1. **等待初始化完成**:
   - 安裝後等待 10-15 秒
   - 再嘗試執行命令

2. **檢查依賴**:
   - 確保 VS Code 版本 ≥ 1.74.0
   - 檢查系統資源是否充足

3. **清除擴展數據**:
   ```
   Ctrl+Shift+P → "Developer: Reload Window With Extensions Disabled"
   然後重新啟用 Devika
   ```

## 🔍 **診斷步驟**

### 步驟 1: 基本檢查

```bash
# 檢查 VS Code 版本
code --version

# 檢查已安裝的擴展
code --list-extensions | grep devika
```

### 步驟 2: 擴展狀態檢查

1. 打開 VS Code
2. 按 `F1` 或 `Ctrl+Shift+P`
3. 輸入 "Extensions: Show Installed Extensions"
4. 搜索 "Devika"
5. 檢查狀態：
   - ✅ **已啟用**: 沒有 "啟用" 按鈕
   - ❌ **已禁用**: 有 "啟用" 按鈕
   - ⚠️ **需要重新載入**: 有 "Reload Required" 按鈕

### 步驟 3: 命令可用性檢查

1. 按 `Ctrl+Shift+P`
2. 輸入 "Devika"
3. 應該看到以下命令：
   - ✅ Devika: 啟動 Devika AI 助理
   - ✅ Devika: 分析選取的程式碼
   - ✅ Devika: 生成 CONTRIBUTING.md
   - ✅ Devika: 生成 ROADMAP.md
   - ✅ Devika: 生成 CHANGELOG.md

### 步驟 4: 視圖檢查

1. 查看左側活動欄
2. 應該看到 🤖 Devika 圖標
3. 點擊圖標後應該顯示三個面板：
   - 任務列表
   - AI 助理  
   - 代碼上下文

## 🛠️ **高級故障排除**

### 清除所有 Devika 數據

```bash
# Windows
%APPDATA%\Code\User\globalStorage\devika.vscode-extension

# macOS
~/Library/Application Support/Code/User/globalStorage/devika.vscode-extension

# Linux
~/.config/Code/User/globalStorage/devika.vscode-extension
```

刪除此目錄後重新啟動 VS Code。

### 重置 VS Code 擴展

1. 關閉 VS Code
2. 刪除擴展目錄：
   ```bash
   # Windows
   %USERPROFILE%\.vscode\extensions\devika.vscode-extension-*
   
   # macOS/Linux
   ~/.vscode/extensions/devika.vscode-extension-*
   ```
3. 重新安裝擴展

### 檢查系統日誌

**Windows**:
```
事件檢視器 → Windows 記錄檔 → 應用程式
搜索 "Code" 或 "Electron"
```

**macOS**:
```bash
Console.app → 搜索 "Code"
```

**Linux**:
```bash
journalctl -f | grep -i code
```

## 📋 **完整重新安裝流程**

如果所有方法都無效，請執行完整重新安裝：

1. **完全卸載**:
   ```bash
   code --uninstall-extension devika.vscode-extension
   ```

2. **清除數據**:
   - 刪除全局存儲目錄
   - 刪除擴展目錄

3. **重啟系統** (可選但推薦)

4. **重新安裝**:
   ```bash
   code --install-extension devika-vscode-0.1.0.vsix
   ```

5. **驗證安裝**:
   - 重啟 VS Code
   - 等待 15 秒
   - 檢查 Devika 圖標
   - 測試命令

## 📞 **獲取幫助**

如果問題仍然存在：

1. **收集信息**:
   - VS Code 版本
   - 操作系統版本
   - 錯誤消息截圖
   - 輸出面板內容

2. **報告問題**:
   - 訪問: https://github.com/satanupup/devika/issues
   - 創建新 Issue
   - 提供詳細信息

3. **臨時解決方案**:
   - 使用命令面板直接執行功能
   - 通過右鍵菜單使用部分功能

## ✅ **驗證清單**

安裝成功後，以下項目應該都正常：

- [ ] VS Code 活動欄中有 🤖 Devika 圖標
- [ ] 點擊圖標顯示三個視圖面板
- [ ] 命令面板中可以找到 Devika 命令
- [ ] 執行 "Devika: 啟動 Devika AI 助理" 不報錯
- [ ] 可以選擇代碼並分析
- [ ] 輸出面板中沒有錯誤信息

如果所有項目都正常，恭喜您！Devika 已成功安裝並可以使用了。

---

**💡 提示**: 大多數問題都可以通過重新載入 VS Code 窗口來解決。
