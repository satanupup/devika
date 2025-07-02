# 🔍 代碼重複分析報告

## 🎯 分析概覽

本報告識別了 Devika VS Code Extension 專案中的主要代碼重複模式，並提供重構建議以提高代碼品質和可維護性。

## 📊 發現的重複模式

### 1. 錯誤處理模式重複 (高優先級)

#### 問題描述
多個文件中存在相似的錯誤處理邏輯：

**重複位置:**
- `src/utils/ErrorHandler.ts`
- `src/error/EnhancedErrorHandler.ts`
- `src/files/WorkspaceEditManager.ts`
- `src/files/SmartFileSearchEngine.ts`

**重複代碼模式:**
```typescript
// 模式 1: try-catch 包裝
try {
    // 操作邏輯
    result.appliedEdits++;
} catch (error) {
    result.failedEdits++;
    result.errors.push(`操作失敗: ${error}`);
    result.success = false;
}

// 模式 2: 錯誤標準化
const devikaError = this.normalizeError(error);
this.logError(devikaError);
this.addToHistory(devikaError);
if (showToUser) {
    await this.showErrorToUser(devikaError);
}
```

#### 重構建議
創建統一的錯誤處理工具類：

```typescript
// src/utils/ErrorHandlingUtils.ts
export class ErrorHandlingUtils {
    static async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        context: string,
        options: ErrorHandlingOptions = {}
    ): Promise<OperationResult<T>> {
        try {
            const result = await operation();
            return { success: true, data: result };
        } catch (error) {
            return this.handleOperationError(error, context, options);
        }
    }

    static handleOperationError(
        error: unknown,
        context: string,
        options: ErrorHandlingOptions
    ): OperationResult<never> {
        const normalizedError = this.normalizeError(error);
        const errorMessage = `${context} 失敗: ${normalizedError.message}`;
        
        if (options.logError !== false) {
            console.error(errorMessage, normalizedError);
        }
        
        if (options.showToUser) {
            vscode.window.showErrorMessage(errorMessage);
        }
        
        return {
            success: false,
            error: normalizedError,
            message: errorMessage
        };
    }
}
```

### 2. 文件操作模式重複 (高優先級)

#### 問題描述
文件操作代碼在多個地方重複：

**重複位置:**
- `src/files/WorkspaceEditManager.ts`
- `src/filesystem/AdvancedFileSystemService.ts`
- `src/files/GitIntegration.ts`

**重複代碼模式:**
```typescript
// 模式 1: 文件存在檢查
try {
    const stat = await vscode.workspace.fs.stat(file);
    // 處理文件信息
} catch (error) {
    // 文件不存在或無法訪問
}

// 模式 2: 批量文件操作
for (const file of files) {
    try {
        // 文件操作
        result.success++;
    } catch (error) {
        result.failed++;
        result.errors.push(`文件操作失敗: ${error}`);
    }
}
```

#### 重構建議
創建統一的文件操作工具類：

```typescript
// src/utils/FileOperationUtils.ts
export class FileOperationUtils {
    static async safeFileOperation<T>(
        uri: vscode.Uri,
        operation: (uri: vscode.Uri) => Promise<T>,
        fallback?: T
    ): Promise<T | undefined> {
        try {
            return await operation(uri);
        } catch (error) {
            console.warn(`文件操作失敗 ${uri.fsPath}:`, error);
            return fallback;
        }
    }

    static async batchFileOperation<T>(
        files: vscode.Uri[],
        operation: (uri: vscode.Uri) => Promise<T>,
        options: BatchOperationOptions = {}
    ): Promise<BatchOperationResult<T>> {
        const results: T[] = [];
        const errors: string[] = [];
        
        for (const file of files) {
            const result = await this.safeFileOperation(file, operation);
            if (result !== undefined) {
                results.push(result);
            } else {
                errors.push(`操作失敗: ${file.fsPath}`);
                if (!options.continueOnError) break;
            }
        }
        
        return { results, errors, success: errors.length === 0 };
    }
}
```

### 3. VS Code API 調用模式重複 (中優先級)

#### 問題描述
VS Code API 調用模式在多處重複：

**重複代碼模式:**
```typescript
// 模式 1: 顯示消息並處理用戶選擇
vscode.window.showInformationMessage(
    message,
    '選項1',
    '選項2'
).then(choice => {
    if (choice === '選項1') {
        // 處理選項1
    } else if (choice === '選項2') {
        // 處理選項2
    }
});

// 模式 2: 文件搜索
const files = await vscode.workspace.findFiles(
    pattern,
    exclude,
    maxResults
);
```

#### 重構建議
創建 VS Code API 包裝器：

```typescript
// src/utils/VSCodeUtils.ts
export class VSCodeUtils {
    static async showChoiceMessage(
        message: string,
        choices: Array<{ label: string; action: () => void | Promise<void> }>
    ): Promise<void> {
        const labels = choices.map(c => c.label);
        const selected = await vscode.window.showInformationMessage(message, ...labels);
        
        const choice = choices.find(c => c.label === selected);
        if (choice) {
            await choice.action();
        }
    }

    static async findFilesWithProgress(
        pattern: string,
        options: FileSearchOptions = {}
    ): Promise<vscode.Uri[]> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '搜索文件...',
            cancellable: true
        }, async (progress, token) => {
            return vscode.workspace.findFiles(
                pattern,
                options.exclude,
                options.maxResults
            );
        });
    }
}
```

### 4. 數據驗證模式重複 (中優先級)

#### 問題描述
參數驗證邏輯在多處重複：

**重複代碼模式:**
```typescript
// 模式 1: 空值檢查
if (!value || value.trim().length === 0) {
    throw new Error('參數不能為空');
}

// 模式 2: 類型檢查
if (typeof value !== 'string') {
    throw new Error('參數必須是字符串');
}
```

#### 重構建議
創建驗證工具類：

```typescript
// src/utils/ValidationUtils.ts
export class ValidationUtils {
    static validateRequired<T>(value: T, name: string): T {
        if (value === null || value === undefined) {
            throw new Error(`${name} 是必需的`);
        }
        return value;
    }

    static validateString(value: unknown, name: string): string {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${name} 必須是非空字符串`);
        }
        return value;
    }

    static validateUri(value: unknown, name: string): vscode.Uri {
        if (!(value instanceof vscode.Uri)) {
            throw new Error(`${name} 必須是有效的 URI`);
        }
        return value;
    }
}
```

## 🚀 重構實施計劃

### 階段 1: 創建工具類 (第 1 週)
- [ ] 創建 `ErrorHandlingUtils`
- [ ] 創建 `FileOperationUtils`
- [ ] 創建 `VSCodeUtils`
- [ ] 創建 `ValidationUtils`

### 階段 2: 重構核心模組 (第 2 週)
- [ ] 重構 `DevikaCoreManager` 中的重複代碼
- [ ] 重構文件操作相關類
- [ ] 重構錯誤處理邏輯

### 階段 3: 重構其他模組 (第 3 週)
- [ ] 重構 UI 相關重複代碼
- [ ] 重構 API 調用重複代碼
- [ ] 重構驗證邏輯

### 階段 4: 測試和優化 (第 4 週)
- [ ] 單元測試所有工具類
- [ ] 整合測試重構後的功能
- [ ] 性能測試和優化

## 📈 預期效果

### 代碼品質改善
- **重複代碼減少**: 預計減少 40-60%
- **可維護性提升**: 統一的工具類更易維護
- **錯誤處理一致性**: 統一的錯誤處理策略

### 開發效率提升
- **新功能開發**: 可重用工具類加速開發
- **Bug 修復**: 集中的邏輯更容易定位問題
- **代碼審查**: 更清晰的代碼結構

### 文件大小優化
- **減少重複代碼**: 預計減少 15-20% 的代碼量
- **更好的樹搖**: 工具類支援按需導入

## 🧪 測試策略

### 單元測試
```typescript
// 測試錯誤處理工具
describe('ErrorHandlingUtils', () => {
    it('should handle operation errors correctly', async () => {
        const result = await ErrorHandlingUtils.executeWithErrorHandling(
            () => { throw new Error('test error'); },
            'test operation'
        );
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
```

### 整合測試
- 測試重構後的文件操作功能
- 驗證錯誤處理流程
- 確保 UI 交互正常

## ⚠️ 風險評估

### 潛在風險
1. **破壞性變更**: 重構可能影響現有功能
2. **性能影響**: 額外的抽象層可能影響性能
3. **學習成本**: 團隊需要熟悉新的工具類

### 風險緩解
1. **漸進式重構**: 分階段進行，每次只重構一小部分
2. **完整測試**: 確保每次重構後功能正常
3. **文檔更新**: 提供清晰的使用指南

---

*分析報告生成時間: 2024-12-19*
*預計重構完成時間: 4 週*
*預期代碼重複減少: 50%*
