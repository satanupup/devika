# 常見問題 (FAQ)

## 目錄

- [安裝和設置](#安裝和設置)
- [功能使用](#功能使用)
- [多模態功能](#多模態功能)
- [性能和故障排除](#性能和故障排除)
- [開發和貢獻](#開發和貢獻)

## 安裝和設置

### Q: 如何安裝 Devika VS Code 擴展？

**A:** 有三種安裝方式：

1. **從 VS Code Marketplace**
   - 打開 VS Code
   - 按 `Ctrl+Shift+X` 打開擴展面板
   - 搜索 "Devika"
   - 點擊安裝

2. **從命令行**
   ```bash
   code --install-extension devika.devika-vscode
   ```

3. **手動安裝 VSIX 文件**
   - 下載 `.vsix` 文件
   - 在 VS Code 中按 `Ctrl+Shift+P`
   - 運行 "Extensions: Install from VSIX..."

### Q: 安裝後需要重新啟動 VS Code 嗎？

**A:** 通常不需要，但如果遇到問題，建議重新啟動 VS Code 以確保擴展正確載入。

### Q: 如何配置 API Token？

**A:** 
1. 打開 VS Code 設置 (`Ctrl+,`)
2. 搜索 "devika"
3. 設置相應的 API Token：
   - `devika.openaiApiKey` - OpenAI API Key
   - `devika.claudeApiKey` - Claude API Key
   - `devika.figmaApiToken` - Figma API Token

### Q: 支援哪些作業系統？

**A:** Devika 支援所有 VS Code 支援的平台：
- Windows 10/11
- macOS 10.15+
- Linux (Ubuntu, Debian, CentOS, etc.)

## 功能使用

### Q: 如何開始使用 AI 功能？

**A:** 
1. 確保已設置 API Token
2. 打開命令面板 (`Ctrl+Shift+P`)
3. 輸入 "Devika" 查看可用命令
4. 選擇想要使用的功能，如 "Devika: 分析代碼"

### Q: AI 分析需要多長時間？

**A:** 分析時間取決於：
- 代碼文件大小
- 選擇的 AI 模型
- 網路連接速度
- API 響應時間

通常在 5-30 秒之間。

### Q: 如何提高 AI 建議的準確性？

**A:** 
- 提供清晰的代碼註釋
- 使用描述性的變數和函數名稱
- 保持代碼結構清晰
- 在設置中選擇更強大的 AI 模型

### Q: 可以自定義 AI 提示嗎？

**A:** 目前版本使用預設的提示模板，未來版本將支援自定義提示。

## 多模態功能

### Q: 如何使用螢幕截圖功能？

**A:** 
1. 運行命令 "Devika: 截取螢幕截圖"
2. 選擇截圖格式和品質
3. 截圖將自動保存並可進行分析

### Q: Figma 整合需要什麼權限？

**A:** 
- 需要 Figma API Token
- 對要匯入的文件需要有讀取權限
- 建議使用個人 Access Token

### Q: 支援哪些圖像格式？

**A:** 
- **輸入**: PNG, JPEG, GIF, SVG, WebP
- **輸出**: PNG, JPEG, WebP

### Q: 圖像分析的準確度如何？

**A:** 
- UI 元素識別：85-95%
- 文字提取：90-98%
- 設計模式識別：70-85%

準確度會隨著模型更新持續改進。

## 性能和故障排除

### Q: 擴展運行緩慢怎麼辦？

**A:** 
1. 檢查系統資源使用情況
2. 在設置中調整以下選項：
   - 減少 `devika.maxContextLines`
   - 關閉 `devika.autoAnalyze`
   - 啟用 `devika.enableLazyLoading`
3. 清除緩存：運行 "Devika: 清除緩存"

### Q: 記憶體使用過高怎麼辦？

**A:** 
1. 調整 `devika.maxMemoryUsage` 設置
2. 定期運行 "Devika: 清除緩存"
3. 重新啟動 VS Code
4. 檢查是否有記憶體洩漏並報告問題

### Q: API 調用失敗怎麼辦？

**A:** 
1. 檢查 API Token 是否正確
2. 確認網路連接正常
3. 檢查 API 配額是否用盡
4. 查看 VS Code 輸出面板的錯誤訊息

### Q: 如何查看詳細的錯誤日誌？

**A:** 
1. 打開 VS Code 輸出面板 (`Ctrl+Shift+U`)
2. 選擇 "Devika" 頻道
3. 設置 `devika.logLevel` 為 "debug" 獲取更多信息

### Q: 擴展無法啟動怎麼辦？

**A:** 
1. 檢查 VS Code 版本是否符合要求 (1.74+)
2. 檢查是否有衝突的擴展
3. 嘗試禁用其他擴展後重新啟動
4. 重新安裝擴展

## 開發和貢獻

### Q: 如何設置開發環境？

**A:** 
1. 克隆倉庫：`git clone https://github.com/devika-ai/devika-vscode.git`
2. 安裝依賴：`npm install`
3. 構建項目：`npm run build`
4. 在 VS Code 中按 F5 啟動調試

### Q: 如何運行測試？

**A:** 
```bash
# 運行所有測試
npm run test

# 運行單元測試
npm run test:unit

# 運行測試並生成覆蓋率報告
npm run test:coverage
```

### Q: 如何貢獻代碼？

**A:** 
1. Fork 倉庫
2. 創建功能分支
3. 遵循代碼規範
4. 添加測試
5. 提交 Pull Request

詳見 [貢獻指南](../CONTRIBUTING.md)。

### Q: 如何報告 Bug？

**A:** 
1. 在 [GitHub Issues](https://github.com/devika-ai/devika-vscode/issues) 搜索是否已有相同問題
2. 如果沒有，創建新的 Issue
3. 提供詳細的重現步驟
4. 包含錯誤訊息和系統信息

### Q: 如何請求新功能？

**A:** 
1. 在 GitHub Issues 中創建 Feature Request
2. 詳細描述功能需求和使用場景
3. 說明功能的價值和重要性
4. 如果可能，提供實現建議

## 其他問題

### Q: 擴展是否收集用戶數據？

**A:** 
- 不收集個人代碼內容
- 可能收集匿名使用統計（可在設置中關閉）
- 所有數據處理遵循隱私政策

### Q: 如何獲得技術支援？

**A:** 
1. 查看本 FAQ 和文檔
2. 搜索 GitHub Issues
3. 在 GitHub Discussions 提問
4. 聯繫維護團隊

### Q: 擴展的更新頻率如何？

**A:** 
- **主要版本**: 每 3-6 個月
- **次要版本**: 每月
- **修補版本**: 根據需要隨時發布

### Q: 如何保持擴展最新？

**A:** 
VS Code 會自動更新擴展，也可以：
1. 在擴展面板中手動檢查更新
2. 啟用自動更新設置

### Q: 支援離線使用嗎？

**A:** 
- 基本功能（代碼分析、重構工具）可離線使用
- AI 功能需要網路連接
- 多模態功能部分可離線使用

---

如果您的問題沒有在此列出，請在 [GitHub Issues](https://github.com/devika-ai/devika-vscode/issues) 中提問。
