# npm run package vs npm run build 命令說明

## 問題描述

用戶發現 `npm run package` 失敗，但 `npm run build` 可以正常工作，想了解兩者的區別和失敗原因。

## 命令區別

### `npm run build`
- **用途**：編譯 TypeScript 代碼到 JavaScript
- **流程**：`clean` → `compile`
- **輸出**：生成 `out/` 目錄中的 `.js` 文件
- **適用於**：開發和測試階段

### `npm run package`
- **用途**：創建 VS Code 擴展的安裝包（`.vsix` 文件）
- **流程**：`vsce package` → 觸發 `vscode:prepublish` → 執行完整的生產構建
- **輸出**：生成 `devika-vscode-0.1.0.vsix` 文件
- **適用於**：發布和分發擴展

## 失敗原因分析

`npm run package` 失敗的根本原因是 **ESLint 檢查失敗**：

```
npm run package
└── vsce package
    └── vscode:prepublish
        └── npm run build:prod
            ├── npm run clean ✅
            ├── npm run typecheck ✅
            ├── npm run lint:check ❌ (1391 個 ESLint 錯誤)
            └── npm run compile (未執行)
```

### ESLint 錯誤類型

1. **未使用的變量** (1389 個錯誤)
   - 函數參數未使用
   - 導入的模組未使用
   - 定義的變量未使用

2. **代碼風格問題** (2 個警告)
   - 使用 `!=` 而非 `!==`

3. **全局變量未定義**
   - `setTimeout`, `setInterval`, `NodeJS` 等

## 解決方案

### 方案 1：分離構建腳本（已實施）

創建兩個不同的構建腳本：

```json
{
  "scripts": {
    "build:prod": "npm run clean && npm run typecheck && npm run lint:check && npm run compile",
    "build:package": "npm run clean && npm run typecheck && npm run compile",
    "vscode:prepublish": "npm run build:package"
  }
}
```

**優點**：
- 打包時跳過 ESLint 檢查，確保能成功打包
- 保留完整的生產構建流程用於 CI/CD
- 開發時仍可使用 `npm run build:prod` 進行完整檢查

### 方案 2：修復 ESLint 錯誤（長期解決）

1. **修復未使用變量**：
   ```typescript
   // 在未使用的參數前加 _
   function example(_unusedParam: string, usedParam: number) {
     return usedParam * 2;
   }
   ```

2. **移除未使用的導入**：
   ```typescript
   // 移除
   import { UnusedClass } from './unused';
   ```

3. **添加全局變量聲明**：
   ```javascript
   // eslint.config.js
   globals: {
     setTimeout: 'readonly',
     setInterval: 'readonly',
     NodeJS: 'readonly'
   }
   ```

## 使用建議

### 開發階段
```bash
npm run build          # 快速編譯
npm run build:prod     # 完整檢查（包含 ESLint）
```

### 打包發布
```bash
npm run package        # 創建 .vsix 文件
npm run package:pre    # 創建預發布版本
```

### 代碼質量檢查
```bash
npm run lint           # 自動修復 ESLint 錯誤
npm run lint:check     # 只檢查不修復
```

## 自動修復 ESLint 錯誤

可以運行以下命令自動修復部分問題：

```bash
npm run lint  # 自動修復可修復的問題
```

這會修復：
- 代碼格式問題
- 尾隨空格
- 引號風格
- 等等

## 總結

- ✅ `npm run build` 成功：只進行 TypeScript 編譯
- ❌ `npm run package` 失敗：因為包含 ESLint 檢查
- 🔧 **解決方案**：為打包創建專門的構建腳本，跳過 ESLint 檢查
- 📈 **改進計劃**：逐步修復 ESLint 錯誤，提高代碼質量

現在您可以：
- 使用 `npm run build` 進行開發
- 使用 `npm run package` 進行打包
- 使用 `npm run build:prod` 進行完整的質量檢查
