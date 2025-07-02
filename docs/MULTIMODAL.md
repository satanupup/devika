# Devika 多模態支援

Devika VS Code 擴展現在支援多模態功能，包括螢幕截圖、Figma 檔案處理等視覺內容分析。

## 功能概覽

### 🖼️ 圖像處理
- 支援多種圖像格式：PNG、JPEG、GIF、SVG、WebP
- 自動圖像分析和內容識別
- UI 元素檢測和分類
- 設計模式識別

### 📸 螢幕截圖
- 全螢幕截圖
- 指定區域截圖
- VS Code 視窗截圖
- 可配置的圖像品質和格式
- 截圖歷史管理

### 🎨 Figma 整合
- 從 Figma 匯入設計文件
- 自動提取設計令牌
- 組件識別和分析
- 設計系統分析

### 🤖 AI 驅動的代碼生成
- 從圖像生成 HTML/CSS 代碼
- 支援多種前端框架（React、Vue、Angular）
- 響應式設計建議
- 無障礙性分析和建議

## 使用方法

### 設置 Figma API Token

1. 打開命令面板 (`Ctrl+Shift+P` 或 `Cmd+Shift+P`)
2. 執行 `Devika 多模態: 設置 Figma API Token`
3. 輸入您的 Figma API Token

### 截取螢幕截圖

#### 全螢幕截圖
```
命令: Devika 多模態: 截取螢幕截圖
快捷鍵: 可在設置中配置
```

#### 指定區域截圖
```
命令: Devika 多模態: 截取指定區域
```

#### VS Code 視窗截圖
```
命令: Devika 多模態: 截取 VS Code 視窗
```

### 從 Figma 匯入設計

1. 執行 `Devika 多模態: 從 Figma 匯入設計`
2. 輸入 Figma 文件 URL 或文件 Key
3. 等待匯入完成
4. 查看自動生成的分析結果

### 分析圖像

#### 手動分析
1. 右鍵點擊圖像文件
2. 選擇 `Devika 多模態: 分析圖像`

#### 自動分析
- 新增圖像文件時自動觸發（可在設置中關閉）

### 生成代碼

1. 分析圖像後，執行 `Devika 多模態: 從圖像生成代碼`
2. 選擇目標框架
3. 查看生成的代碼建議

## 配置選項

在 VS Code 設置中搜索 "devika" 來配置多模態功能：

### 基本設置
```json
{
  "devika.enableMultimodal": true,
  "devika.autoAnalyzeImages": true,
  "devika.maxImageSize": 10485760
}
```

### 截圖設置
```json
{
  "devika.screenshotQuality": 90,
  "devika.screenshotFormat": "png"
}
```

### Figma 設置
```json
{
  "devika.figmaApiToken": "your-figma-token"
}
```

## 支援的文件格式

### 圖像格式
- **PNG** - 推薦用於截圖和 UI 設計
- **JPEG/JPG** - 適合照片和複雜圖像
- **GIF** - 支援動畫圖像
- **SVG** - 向量圖形
- **WebP** - 現代圖像格式

### 設計文件
- **Figma** - 通過 API 整合
- **PDF** - 基本支援（計劃中）

## API 參考

### MultimodalProcessor

主要的多模態處理器類：

```typescript
import { MultimodalProcessor } from './multimodal/MultimodalProcessor';

const processor = MultimodalProcessor.getInstance();

// 處理圖像
const mediaContent = await processor.processMedia(uri);

// 截取螢幕截圖
const screenshot = await processor.takeScreenshot(options);

// 從 Figma 匯入
const figmaContent = await processor.importFromFigma(options);
```

### VisualContentAnalyzer

視覺內容分析器：

```typescript
import { VisualContentAnalyzer } from './multimodal/VisualContentAnalyzer';

const analyzer = VisualContentAnalyzer.getInstance();

// 分析設計系統
const designSystem = await analyzer.analyzeDesignSystem(mediaContent);

// 識別組件
const components = await analyzer.identifyComponents(mediaContent);

// 生成響應式建議
const suggestions = await analyzer.generateResponsiveDesignSuggestions(mediaContent);
```

## 故障排除

### 常見問題

#### 截圖功能不工作
1. 檢查作業系統權限
2. 確認螢幕錄製權限（macOS）
3. 檢查防毒軟體設置

#### Figma 匯入失敗
1. 驗證 API Token 是否正確
2. 檢查文件權限
3. 確認網路連接

#### 圖像分析結果不準確
1. 確保圖像品質足夠高
2. 檢查圖像格式是否支援
3. 嘗試不同的分析參數

### 日誌和調試

啟用詳細日誌：
```json
{
  "devika.logLevel": "debug"
}
```

查看輸出面板中的 "Devika" 頻道以獲取詳細信息。

## 性能優化

### 圖像處理優化
- 使用適當的圖像格式
- 控制圖像大小（建議 < 10MB）
- 定期清理緩存

### 記憶體管理
- 自動清理過期緩存
- 限制同時處理的圖像數量
- 使用懶加載機制

## 隱私和安全

### 數據處理
- 圖像在本地處理，不會上傳到外部服務器
- Figma API 調用使用加密連接
- 敏感數據自動過濾

### API Token 安全
- Token 加密存儲在 VS Code 設置中
- 不會記錄在日誌文件中
- 支援環境變數配置

## 未來計劃

### 即將推出的功能
- [ ] PDF 文件分析
- [ ] 視頻內容處理
- [ ] 音頻轉文字
- [ ] 更多設計工具整合（Sketch、Adobe XD）
- [ ] 機器學習模型優化
- [ ] 批量處理功能

### 改進計劃
- [ ] 更準確的 UI 元素識別
- [ ] 更智能的代碼生成
- [ ] 更好的設計系統分析
- [ ] 性能優化

## 貢獻

歡迎貢獻多模態功能的改進！請參考主要的 [CONTRIBUTING.md](../CONTRIBUTING.md) 文件。

### 開發環境設置

1. 克隆倉庫
2. 安裝依賴：`npm install`
3. 運行測試：`npm run test:multimodal`
4. 啟動開發模式：`npm run watch`

### 測試

運行多模態相關測試：
```bash
npm run test -- --testPathPattern=multimodal
```

## 支援

如果您遇到問題或有功能建議，請：

1. 查看 [故障排除](#故障排除) 部分
2. 搜索現有的 [GitHub Issues](https://github.com/devika-ai/devika-vscode/issues)
3. 創建新的 Issue 並提供詳細信息

## 授權

多模態功能遵循與主項目相同的授權條款。
