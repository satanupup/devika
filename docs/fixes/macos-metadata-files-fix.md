# macOS 元數據文件處理修復

## 問題描述

VS Code 擴展在索引文件時遇到錯誤，特別是在處理 macOS 系統生成的元數據文件時：

```
CodeExpectedError: cannot open file:///d%3A/emmt/gp_stocking/rfid_stocking_app_v1.0.0.0_20230822/__MACOSX/rfid_stocking_app/app/src/main/java/com/cginfortech/rfid_stocking/._Stocking_311.kt. Detail: 檔案似乎是二進位檔，因此無法以文字檔格式開啟
```

## 問題原因

1. **macOS 元數據文件**：以 `._`
   開頭的文件是 macOS 系統自動生成的元數據文件，它們是二進制格式
2. **\_\_MACOSX 目錄**：包含 macOS 特定的文件屬性和元數據
3. **缺乏文件過濾**：原始代碼沒有適當的文件過濾機制來排除這些系統文件

## 解決方案

### 1. 文件過濾邏輯

在 `CodeContextService.ts` 中添加了 `shouldIndexFile()` 方法：

```typescript
private shouldIndexFile(uri: vscode.Uri): boolean {
  const filePath = uri.fsPath;
  const fileName = uri.path.split('/').pop() || '';

  // 排除 macOS 元數據文件
  if (fileName.startsWith('._')) {
    return false;
  }

  // 排除 __MACOSX 目錄
  if (filePath.includes('__MACOSX')) {
    return false;
  }

  // 排除其他系統文件
  const excludePatterns = [
    '.DS_Store', 'Thumbs.db', 'desktop.ini',
    '.git/', 'node_modules/', '.vscode/',
    'dist/', 'build/', 'out/',
    '.nyc_output/', 'coverage/'
  ];

  return !excludePatterns.some(pattern =>
    filePath.includes(pattern) || fileName === pattern
  );
}
```

### 2. 文本文件檢測

添加了 `isTextFile()` 方法來確保只處理文本文件：

```typescript
private isTextFile(uri: vscode.Uri): boolean {
  const ext = uri.path.split('.').pop()?.toLowerCase() || '';
  const textExtensions = [
    'ts', 'js', 'tsx', 'jsx', 'py', 'java', 'kt', 'swift',
    'cpp', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'dart',
    'html', 'css', 'scss', 'less', 'json', 'xml', 'yaml', 'yml',
    'md', 'txt', 'sql', 'sh', 'bat', 'ps1', 'vue', 'svelte'
  ];
  return textExtensions.includes(ext);
}
```

### 3. 改進的錯誤處理

更新了 `indexFile()` 方法的錯誤處理：

```typescript
catch (error) {
  // 只記錄非預期的錯誤，忽略二進制文件錯誤
  if (error instanceof Error &&
      !error.message.includes('檔案似乎是二進位檔') &&
      !error.message.includes('binary file')) {
    console.error(`索引文件失敗 ${uri.fsPath}:`, error);
  }
}
```

### 4. VS Code API 最佳實踐

- 使用 `uri.scheme !== 'file'` 檢查確保只處理磁盤文件
- 在 `findFiles()` 中使用適當的排除模式
- 實施批次處理以避免同時處理過多文件

## 測試

創建了單元測試來驗證修復：

```typescript
test('應該過濾 macOS 元數據文件', () => {
  const macosFiles = [
    vscode.Uri.file('/test/path/._SomeFile.kt'),
    vscode.Uri.file('/test/path/__MACOSX/file.txt'),
    vscode.Uri.file('/test/path/.DS_Store')
  ];

  macosFiles.forEach(uri => {
    const shouldIndex = (codeContextService as any).shouldIndexFile(uri);
    assert.strictEqual(shouldIndex, false);
  });
});
```

## 效果

- ✅ 消除了 macOS 元數據文件導致的錯誤
- ✅ 提高了文件索引的性能和穩定性
- ✅ 遵循了 VS Code API 最佳實踐
- ✅ 支持跨平台兼容性

## 測試結果

運行簡單測試驗證修復效果：

```
測試 macOS 元數據文件（應該被過濾）:
/test/path/._SomeFile.kt: ✅ 已過濾
/test/path/__MACOSX/file.txt: ✅ 已過濾
/test/path/.DS_Store: ✅ 已過濾

測試有效文件（應該被索引）:
/test/path/SomeFile.kt: ✅ 應該索引
/test/path/script.ts: ✅ 應該索引
/test/path/component.vue: ✅ 應該索引

🎯 原始問題文件測試:
文件: /d/emmt/gp_stocking/.../__MACOSX/.../._Stocking_311.kt
結果: ✅ 已被過濾（問題已解決）
```

## 相關文件

- `src/context/CodeContextService.ts` - 主要修復
- `src/test/simple-codeContextService.test.ts` - 驗證測試
- `src/test/codeContextService.test.ts` - 單元測試
- `vscode_references/VS Code API.txt` - API 參考
- `vscode_references/Document Selectors.txt` - 文檔選擇器參考

## 使用建議

1. **重新啟動 VS Code** - 確保新的過濾邏輯生效
2. **清理工作區索引** - 如果問題仍然存在，可以重新打開工作區
3. **監控控制台** - 確認不再出現 macOS 元數據文件的錯誤信息
