# Devika VS Code Extension 用戶指南

## 目錄

- [快速開始](#快速開始)
- [核心功能詳解](#核心功能詳解)
- [多模態功能](#多模態功能)
- [配置和自定義](#配置和自定義)
- [最佳實踐](#最佳實踐)
- [故障排除](#故障排除)

## 快速開始

### 安裝和初始設置

1. **安裝擴展**
   - 在 VS Code 擴展市場搜索 "Devika"
   - 點擊安裝並重新啟動 VS Code

2. **基本配置**
   ```json
   {
     "devika.enableAI": true,
     "devika.autoAnalyze": true,
     "devika.openaiApiKey": "your-api-key-here"
   }
   ```

3. **驗證安裝**
   - 按 `Ctrl+Shift+P` 打開命令面板
   - 輸入 "Devika" 查看可用命令
   - 運行 "Devika: 分析代碼" 測試功能

### 第一次使用

1. **打開一個代碼文件**
2. **選擇一段代碼**
3. **右鍵選擇 "Devika: 分析代碼"**
4. **查看分析結果和建議**

## 核心功能詳解

### 🧠 智能代碼分析

#### 基本使用
```typescript
// 選中這段代碼
function calculateTotal(items: any[]) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}
```

**操作步驟：**
1. 選中函數
2. 運行 `Devika: 分析代碼`
3. 查看建議：類型安全、性能優化等

#### 高級功能
- **複雜度分析**: 自動計算圈複雜度
- **代碼異味檢測**: 識別潛在問題
- **重構建議**: 提供具體的改進方案

### 🔧 自動化重構

#### 函數重構
```typescript
// 原始代碼
function processUserData(user: any) {
  if (user.age > 18) {
    if (user.hasLicense) {
      if (user.hasInsurance) {
        return "可以駕駛";
      }
    }
  }
  return "不能駕駛";
}
```

**重構步驟：**
1. 選中函數
2. 運行 `Devika: 重構代碼`
3. 選擇重構類型（提取函數、簡化條件等）
4. 應用建議的重構

#### 類重構
- **提取接口**: 從類中提取接口定義
- **分解大類**: 將大類拆分為多個小類
- **優化繼承**: 改進類的繼承結構

### 📋 任務管理

#### 自動任務生成
```typescript
// TODO: 優化這個函數的性能
// FIXME: 處理邊界情況
// HACK: 臨時解決方案，需要重構
function complexFunction() {
  // 複雜邏輯...
}
```

**任務管理流程：**
1. 運行 `Devika: 掃描 TODOs`
2. 查看任務面板
3. 設置優先級和狀態
4. 追蹤完成進度

#### 手動任務創建
1. 打開任務面板
2. 點擊 "新增任務"
3. 填寫任務詳情
4. 設置優先級和截止日期

### 🧪 測試生成

#### 單元測試生成
```typescript
// 原始函數
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

**生成測試：**
1. 選中函數
2. 運行 `Devika: 生成測試`
3. 查看生成的測試用例
4. 根據需要調整測試

#### 測試覆蓋率分析
- 運行 `Devika: 分析測試覆蓋率`
- 查看覆蓋率報告
- 識別未測試的代碼路徑

## 多模態功能

### 📸 螢幕截圖

#### 基本截圖
1. 運行 `Devika: 截取螢幕截圖`
2. 選擇截圖區域（可選）
3. 設置圖像品質和格式
4. 查看截圖結果

#### 截圖分析
- 自動識別 UI 元素
- 提取文字內容
- 分析設計模式
- 生成代碼建議

### 🎨 Figma 整合

#### 設置 Figma API
1. 獲取 Figma API Token
2. 在設置中配置 `devika.figmaApiToken`
3. 驗證連接

#### 匯入設計
1. 運行 `Devika: 從 Figma 匯入`
2. 輸入 Figma 文件 URL 或 Key
3. 選擇要匯入的組件
4. 查看生成的代碼

#### 設計分析
- 自動提取設計令牌
- 識別組件結構
- 生成響應式代碼
- 分析無障礙性

### 🖼️ 圖像到代碼

#### 上傳圖像
1. 右鍵點擊圖像文件
2. 選擇 `Devika: 分析圖像`
3. 等待分析完成

#### 代碼生成
- HTML 結構生成
- CSS 樣式提取
- React/Vue 組件生成
- 響應式設計建議

## 配置和自定義

### 基本設置

```json
{
  // AI 設置
  "devika.enableAI": true,
  "devika.aiModel": "gpt-4",
  "devika.maxContextLines": 100,
  
  // 自動化設置
  "devika.autoAnalyze": true,
  "devika.autoScanTodos": true,
  "devika.autoGenerateTests": false,
  
  // 多模態設置
  "devika.enableMultimodal": true,
  "devika.screenshotQuality": 90,
  "devika.figmaApiToken": "your-token",
  
  // 性能設置
  "devika.enableLazyLoading": true,
  "devika.maxMemoryUsage": 512,
  "devika.enableCaching": true
}
```

### 高級配置

#### 自定義快捷鍵
```json
{
  "key": "ctrl+alt+a",
  "command": "devika.analyzeCode",
  "when": "editorTextFocus"
}
```

#### 工作區特定設置
```json
{
  "devika.projectType": "react",
  "devika.testFramework": "jest",
  "devika.codeStyle": "airbnb"
}
```

## 最佳實踐

### 代碼分析最佳實踐

1. **定期分析**
   - 每次提交前運行代碼分析
   - 設置自動分析觸發器

2. **關注重點**
   - 優先處理高優先級建議
   - 關注性能和安全問題

3. **漸進改進**
   - 逐步應用重構建議
   - 保持代碼變更的可追蹤性

### 多模態功能最佳實踐

1. **圖像品質**
   - 使用高解析度圖像
   - 確保文字清晰可讀

2. **設計一致性**
   - 保持設計系統的一致性
   - 使用標準的 UI 組件

3. **代碼生成**
   - 審查生成的代碼
   - 根據項目需求調整

### 性能優化

1. **資源管理**
   - 定期清理緩存
   - 監控記憶體使用

2. **配置調整**
   - 根據硬體調整設置
   - 關閉不需要的功能

## 故障排除

### 常見問題

#### 功能無響應
1. 檢查 API Token 配置
2. 查看網路連接
3. 重新啟動 VS Code

#### 性能問題
1. 調整記憶體限制
2. 關閉自動分析
3. 清理緩存

#### 多模態功能問題
1. 檢查圖像格式支援
2. 驗證 Figma API Token
3. 確認網路權限

### 調試模式

啟用詳細日誌：
```json
{
  "devika.logLevel": "debug",
  "devika.enableDebugMode": true
}
```

查看日誌：
1. 打開輸出面板 (`Ctrl+Shift+U`)
2. 選擇 "Devika" 頻道
3. 查看詳細錯誤信息

### 獲得幫助

1. **文檔資源**
   - [FAQ](FAQ.md)
   - [API 文檔](api/)
   - [貢獻指南](../CONTRIBUTING.md)

2. **社群支援**
   - [GitHub Issues](https://github.com/devika-ai/devika-vscode/issues)
   - [GitHub Discussions](https://github.com/devika-ai/devika-vscode/discussions)

3. **報告問題**
   - 提供詳細的重現步驟
   - 包含錯誤日誌
   - 說明預期行為

---

這個用戶指南涵蓋了 Devika VS Code Extension 的主要功能和使用方法。如果您需要更詳細的信息，請查看相關的專門文檔或聯繫支援團隊。
