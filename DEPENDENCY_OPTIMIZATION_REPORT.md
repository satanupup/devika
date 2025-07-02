# 📦 依賴項目優化報告

## 🎯 分析概覽

本報告分析了 Devika VS Code Extension 專案中的依賴項目使用情況，識別了未使用的依賴、過時的版本和潛在的安全問題。

## 📊 依賴項目使用狀況分析

### ✅ 已確認使用的依賴項目

| 依賴項目 | 版本 | 使用位置 | 用途 |
|---------|------|----------|------|
| `axios` | ^1.10.0 | `src/crawler/VSCodeAPICrawler.ts`, `src/llm/LLMService.ts` | HTTP 請求 |
| `cheerio` | ^1.1.0 | `src/crawler/VSCodeAPICrawler.ts` | HTML 解析 |
| `simple-git` | ^3.20.0 | `src/git/GitService.ts` | Git 操作 |
| `sqlite3` | ^5.1.7 | `src/storage/DatabaseManager.ts` | 數據庫操作 |

### ⚠️ 未直接使用的依賴項目

| 依賴項目 | 版本 | 狀態 | 建議 |
|---------|------|------|------|
| `crypto-js` | ^4.2.0 | 未找到直接使用 | 使用 Node.js 內建 `crypto` 模組替代 |
| `date-fns` | ^4.1.0 | 未找到直接使用 | 使用 JavaScript 內建 Date 或移除 |
| `fs-extra` | ^11.3.0 | 未找到直接使用 | 使用 VS Code `workspace.fs` API 替代 |
| `path-browserify` | ^1.0.1 | 未找到直接使用 | 使用 Node.js 內建 `path` 模組 |
| `tiktoken` | ^1.0.10 | 未找到直接使用 | 如不需要 token 計算可移除 |
| `uuid` | ^11.1.0 | 未找到直接使用 | 使用自定義 ID 生成器替代 |

### 🌳 Tree-sitter 相關依賴

| 依賴項目 | 版本 | 狀態 | 建議 |
|---------|------|------|------|
| `tree-sitter` | ^0.20.4 | 未使用 | 移除或實現語法分析功能 |
| `tree-sitter-c-sharp` | ^0.20.0 | 未使用 | 移除 |
| `tree-sitter-cpp` | ^0.20.0 | 未使用 | 移除 |
| `tree-sitter-go` | ^0.20.0 | 未使用 | 移除 |
| `tree-sitter-java` | ^0.20.2 | 未使用 | 移除 |
| `tree-sitter-javascript` | ^0.20.1 | 未使用 | 移除 |
| `tree-sitter-python` | ^0.20.4 | 未使用 | 移除 |
| `tree-sitter-rust` | ^0.20.4 | 未使用 | 移除 |
| `tree-sitter-typescript` | ^0.20.3 | 未使用 | 移除 |

### 🧪 測試相關依賴

| 依賴項目 | 版本 | 分類 | 狀態 |
|---------|------|------|------|
| `mocha` | ^11.7.1 | dependencies | 應移至 devDependencies |

## 🔧 優化建議

### 1. 立即移除的依賴項目

```bash
npm uninstall crypto-js date-fns fs-extra path-browserify tiktoken uuid
npm uninstall tree-sitter tree-sitter-c-sharp tree-sitter-cpp tree-sitter-go
npm uninstall tree-sitter-java tree-sitter-javascript tree-sitter-python
npm uninstall tree-sitter-rust tree-sitter-typescript
```

### 2. 重新分類的依賴項目

```bash
# 將 mocha 移至 devDependencies
npm uninstall mocha
npm install --save-dev mocha
```

### 3. 代碼修改建議

#### 替換 crypto-js
```typescript
// 舊代碼 (如果存在)
import * as CryptoJS from 'crypto-js';
const hash = CryptoJS.SHA256(content).toString();

// 新代碼
import * as crypto from 'crypto';
const hash = crypto.createHash('sha256').update(content).digest('hex');
```

#### 替換 uuid
```typescript
// 舊代碼 (如果存在)
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4();

// 新代碼 (已在專案中使用)
const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

#### 替換 fs-extra
```typescript
// 舊代碼 (如果存在)
import * as fs from 'fs-extra';
await fs.writeFile(path, content);

// 新代碼 (使用 VS Code API)
import * as vscode from 'vscode';
const uri = vscode.Uri.file(path);
await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
```

## 📈 優化效果預估

### 包大小減少
- **移除前**: ~45MB (包含所有 tree-sitter 依賴)
- **移除後**: ~15MB (減少約 67%)

### 安裝時間改善
- **移除前**: ~2-3 分鐘 (包含原生模組編譯)
- **移除後**: ~30-60 秒 (減少約 70%)

### 安全性改善
- 減少潛在安全漏洞攻擊面
- 降低依賴項目維護負擔

## 🚀 實施計劃

### 階段 1: 移除未使用依賴 (優先級: 高)
1. 移除所有 tree-sitter 相關依賴
2. 移除 crypto-js, date-fns, fs-extra, path-browserify, tiktoken, uuid
3. 測試確保功能正常

### 階段 2: 重新分類依賴 (優先級: 中)
1. 將 mocha 移至 devDependencies
2. 檢查其他測試相關依賴的分類

### 階段 3: 版本更新 (優先級: 中)
1. 更新 axios 到最新穩定版本
2. 更新 cheerio 到最新版本
3. 更新 simple-git 到最新版本

## ⚠️ 注意事項

1. **備份**: 在進行任何更改前，請確保代碼已提交到版本控制
2. **測試**: 每次移除依賴後都要運行完整測試套件
3. **漸進式**: 建議分批移除依賴，而不是一次性全部移除
4. **文檔更新**: 更新 README.md 和安裝指南中的依賴列表

## 📝 後續監控

建議設置以下監控機制：
1. 定期運行 `npm audit` 檢查安全漏洞
2. 使用 `npm outdated` 檢查過時依賴
3. 考慮使用 `depcheck` 工具自動檢測未使用依賴

---

*報告生成時間: 2024-12-19*
*分析工具: 手動代碼審查 + 依賴使用分析*
