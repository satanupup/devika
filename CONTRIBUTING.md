# 貢獻指南

感謝您對 Devika VS Code 擴展的興趣！我們歡迎所有形式的貢獻。

## 目錄

- [開發環境設置](#開發環境設置)
- [項目結構](#項目結構)
- [開發流程](#開發流程)
- [代碼規範](#代碼規範)
- [測試](#測試)
- [提交規範](#提交規範)
- [發布流程](#發布流程)

## 開發環境設置

### 前置要求

- Node.js 18+ 
- npm 8+
- VS Code 1.74+
- Git

### 安裝步驟

1. **克隆倉庫**
   ```bash
   git clone https://github.com/devika-ai/devika-vscode.git
   cd devika-vscode
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **設置 Git hooks**
   ```bash
   npm run prepare
   ```

4. **構建項目**
   ```bash
   npm run build
   ```

5. **運行測試**
   ```bash
   npm run test
   ```

### 開發模式

啟動開發模式：
```bash
npm run dev
```

這將啟動 TypeScript 編譯器的監視模式，自動重新編譯變更的文件。

## 項目結構

```
devika-vscode/
├── src/                    # 源代碼
│   ├── ai/                # AI 相關功能
│   ├── multimodal/        # 多模態支援
│   ├── performance/       # 性能優化
│   ├── refactoring/       # 重構工具
│   ├── utils/             # 工具函數
│   ├── test/              # 測試文件
│   └── extension.ts       # 擴展入口點
├── docs/                  # 文檔
├── .vscode/               # VS Code 配置
├── .github/               # GitHub Actions
└── scripts/               # 構建腳本
```

## 開發流程

### 1. 創建功能分支

```bash
git checkout -b feature/your-feature-name
```

### 2. 開發功能

- 遵循現有的代碼結構和模式
- 添加適當的類型註解
- 編寫單元測試
- 更新相關文檔

### 3. 運行檢查

```bash
# 類型檢查
npm run typecheck

# 代碼檢查
npm run lint

# 格式化
npm run format

# 測試
npm run test

# 完整驗證
npm run validate
```

### 4. 提交變更

使用 Conventional Commits 格式：

```bash
git add .
git commit -m "feat: add new multimodal feature"
```

### 5. 推送並創建 PR

```bash
git push origin feature/your-feature-name
```

然後在 GitHub 上創建 Pull Request。

## 代碼規範

### TypeScript 規範

- 使用嚴格的 TypeScript 配置
- 為所有公共 API 提供類型註解
- 避免使用 `any` 類型
- 使用接口定義複雜對象結構

### 命名規範

- **文件名**: 使用 PascalCase（如 `MultimodalProcessor.ts`）
- **類名**: 使用 PascalCase（如 `CodeAnalyzer`）
- **函數名**: 使用 camelCase（如 `analyzeCode`）
- **常量**: 使用 UPPER_SNAKE_CASE（如 `MAX_FILE_SIZE`）
- **接口**: 使用 PascalCase，可選擇性地以 `I` 開頭

### 代碼組織

- 每個文件應該有單一職責
- 使用 barrel exports（index.ts）組織模組
- 將相關功能分組到同一目錄
- 保持函數簡短且專注

### 註釋和文檔

- 為所有公共 API 編寫 JSDoc 註釋
- 使用中文註釋解釋複雜邏輯
- 保持註釋與代碼同步

```typescript
/**
 * 分析代碼複雜度
 * @param code - 要分析的代碼字符串
 * @param options - 分析選項
 * @returns 複雜度分析結果
 */
export function analyzeComplexity(code: string, options?: AnalysisOptions): ComplexityResult {
  // 實現邏輯...
}
```

## 測試

### 測試類型

1. **單元測試** - 測試個別函數和類
2. **整合測試** - 測試組件間的交互
3. **端到端測試** - 測試完整的用戶流程

### 測試命令

```bash
# 運行所有測試
npm run test

# 運行單元測試
npm run test:unit

# 運行測試並生成覆蓋率報告
npm run test:coverage

# 監視模式運行測試
npm run test:watch

# 運行特定測試
npm run test:multimodal
```

### 測試規範

- 每個功能都應該有對應的測試
- 測試文件命名為 `*.test.ts`
- 使用描述性的測試名稱
- 測試應該獨立且可重複運行
- 目標測試覆蓋率 > 80%

### 測試示例

```typescript
describe('MultimodalProcessor', () => {
  let processor: MultimodalProcessor;

  beforeEach(() => {
    processor = MultimodalProcessor.getInstance();
  });

  describe('processMedia', () => {
    it('should process PNG image successfully', async () => {
      const uri = vscode.Uri.file('/test/image.png');
      const result = await processor.processMedia(uri);
      
      expect(result).toBeDefined();
      expect(result?.type).toBe(MediaType.IMAGE);
    });
  });
});
```

## 提交規範

我們使用 [Conventional Commits](https://www.conventionalcommits.org/) 規範：

### 提交類型

- `feat`: 新功能
- `fix`: 錯誤修復
- `docs`: 文檔變更
- `style`: 代碼格式變更
- `refactor`: 代碼重構
- `perf`: 性能優化
- `test`: 測試相關
- `build`: 構建系統變更
- `ci`: CI/CD 變更
- `chore`: 其他變更

### 提交格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 示例

```bash
feat(multimodal): add Figma integration support

Add support for importing designs from Figma API
- Implement FigmaIntegration class
- Add API token configuration
- Support design file parsing

Closes #123
```

## 發布流程

### 版本號規範

我們使用 [Semantic Versioning](https://semver.org/)：

- `MAJOR`: 不兼容的 API 變更
- `MINOR`: 向後兼容的功能新增
- `PATCH`: 向後兼容的錯誤修復

### 發布步驟

1. **更新版本號**
   ```bash
   npm run release:patch  # 或 minor/major
   ```

2. **生成變更日誌**
   ```bash
   npm run changelog
   ```

3. **創建發布標籤**
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. **發布到 Marketplace**
   ```bash
   npm run publish
   ```

## 問題報告

### Bug 報告

請包含以下信息：

- VS Code 版本
- 擴展版本
- 作業系統
- 重現步驟
- 預期行為
- 實際行為
- 錯誤訊息或截圖

### 功能請求

請描述：

- 功能的用途和價值
- 預期的用戶體驗
- 可能的實現方案
- 相關的用例

## 代碼審查

### 審查清單

- [ ] 代碼遵循項目規範
- [ ] 有適當的測試覆蓋
- [ ] 文檔已更新
- [ ] 沒有破壞性變更（或已適當標記）
- [ ] 性能影響已考慮
- [ ] 安全性已考慮

### 審查流程

1. 自動檢查通過（CI/CD）
2. 至少一個維護者審查
3. 所有討論已解決
4. 合併到主分支

## 社群

- **GitHub Issues**: 報告 bug 和功能請求
- **GitHub Discussions**: 一般討論和問答
- **Pull Requests**: 代碼貢獻

## 許可證

通過貢獻代碼，您同意您的貢獻將在與項目相同的許可證下授權。

---

感謝您的貢獻！如果您有任何問題，請隨時在 GitHub Issues 中提問。
