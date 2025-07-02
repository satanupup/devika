# 下一步編輯導航系統

Devika VS Code Extension 的下一步編輯導航系統是一個智能的編輯指導工具，能夠將複雜的編輯任務分解為清晰的步驟，提供逐步指導，並自動執行編輯操作，讓開發者能夠更有條理地完成代碼編輯工作。

## 🧭 核心概念

### 編輯計劃 (Edit Plan)
編輯計劃是一個完整的編輯任務規劃，包含：
- **計劃信息** - 標題、描述、目標
- **編輯步驟** - 有序的編輯操作列表
- **執行狀態** - 計劃的當前執行狀態
- **進度追蹤** - 完成度和時間估算
- **上下文信息** - 工作區、語言、框架等

### 編輯步驟 (Edit Step)
編輯步驟是單個具體的編輯操作，包含：
- **操作類型** - 創建、修改、刪除文件等
- **目標文件** - 要操作的文件路徑
- **代碼變更** - 具體的代碼修改內容
- **執行指令** - 詳細的操作說明
- **驗證規則** - 步驟完成的驗證條件

### 智能生成 (Smart Generation)
系統能夠基於用戶需求和代碼上下文智能生成編輯步驟：
- **任務分析** - 分析用戶需求和現有代碼
- **步驟規劃** - 自動生成最佳的編輯步驟序列
- **依賴管理** - 處理步驟間的依賴關係
- **優化排序** - 按優先級和依賴關係優化步驟順序

## 🚀 主要功能

### 1. 編輯計劃管理

#### 創建編輯計劃
```typescript
// 支援的任務類型
enum EditTaskType {
  FEATURE_IMPLEMENTATION = 'feature_implementation',  // 🚀 功能實現
  BUG_FIX = 'bug_fix',                               // 🐛 Bug 修復
  REFACTORING = 'refactoring',                       // 🔧 代碼重構
  TESTING = 'testing',                               // 🧪 測試添加
  DOCUMENTATION = 'documentation',                   // 📚 文檔更新
  CONFIGURATION = 'configuration',                   // ⚙️ 配置更新
  PERFORMANCE_OPTIMIZATION = 'performance_optimization', // ⚡ 性能優化
  SECURITY_FIX = 'security_fix',                     // 🔒 安全修復
  CODE_CLEANUP = 'code_cleanup'                      // 🧹 代碼清理
}
```

#### 計劃執行控制
- **開始執行** - 按順序執行編輯步驟
- **暫停/恢復** - 靈活控制執行進度
- **跳過步驟** - 跳過不需要的步驟
- **重試失敗** - 重新執行失敗的步驟

### 2. 智能步驟生成

#### 功能實現步驟生成
```typescript
// 自動生成功能實現的完整步驟
const featureSteps = [
  '📄 創建功能規格文檔',
  '📁 創建主要功能文件', 
  '📥 添加必要的導入',
  '⚡ 實現核心功能',
  '🛡️ 添加錯誤處理',
  '🧪 創建測試文件',
  '📚 更新文檔'
];
```

#### Bug 修復步驟生成
```typescript
// 自動生成 Bug 修復的系統化步驟
const bugFixSteps = [
  '🔍 創建問題分析報告',
  '🧪 創建 Bug 重現測試',
  '🔧 修復 Bug',
  '✅ 驗證修復效果'
];
```

#### 重構步驟生成
```typescript
// 自動生成安全重構的步驟
const refactoringSteps = [
  '📋 創建重構計劃',
  '🧪 確保測試覆蓋',
  '🔄 執行重構',
  '✅ 驗證重構結果'
];
```

### 3. 步驟類型和操作

#### 文件操作步驟
```typescript
enum EditStepType {
  CREATE_FILE = 'create_file',        // 📄 創建文件
  MODIFY_FILE = 'modify_file',        // ✏️ 修改文件
  DELETE_FILE = 'delete_file',        // 🗑️ 刪除文件
  RENAME_FILE = 'rename_file',        // 📝 重命名文件
}
```

#### 代碼結構步驟
```typescript
enum EditStepType {
  ADD_IMPORT = 'add_import',          // 📥 添加導入
  REMOVE_IMPORT = 'remove_import',    // 📤 移除導入
  ADD_FUNCTION = 'add_function',      // ⚡ 添加函數
  MODIFY_FUNCTION = 'modify_function', // 🔧 修改函數
  DELETE_FUNCTION = 'delete_function', // ❌ 刪除函數
  ADD_CLASS = 'add_class',            // 🏗️ 添加類
  MODIFY_CLASS = 'modify_class',      // 🔨 修改類
  DELETE_CLASS = 'delete_class',      // 💥 刪除類
}
```

#### 特殊操作步驟
```typescript
enum EditStepType {
  REFACTOR = 'refactor',              // 🔄 重構
  FIX_ERROR = 'fix_error',            // 🐛 修復錯誤
  ADD_TEST = 'add_test',              // 🧪 添加測試
  UPDATE_CONFIG = 'update_config'     // ⚙️ 更新配置
}
```

### 4. 進度追蹤和統計

#### 實時進度監控
```typescript
interface ProgressInfo {
  currentStep: number;           // 當前步驟編號
  totalSteps: number;           // 總步驟數
  completedSteps: number;       // 已完成步驟數
  percentage: number;           // 完成百分比
  estimatedTimeRemaining: number; // 預估剩餘時間（分鐘）
}
```

#### 執行統計
- **步驟執行歷史** - 記錄所有已執行的步驟
- **時間統計** - 實際執行時間 vs 預估時間
- **成功率分析** - 步驟執行成功率統計
- **錯誤分析** - 失敗步驟的錯誤分析

### 5. 智能驗證系統

#### 步驟驗證規則
```typescript
interface StepValidation {
  rules: string[];              // 驗證規則列表
  expectedOutcome: string;      // 預期結果描述
}

// 示例驗證規則
const validationRules = [
  '文件必須存在',
  '代碼必須通過語法檢查',
  '測試必須通過',
  '沒有 TypeScript 錯誤'
];
```

#### 自動驗證
- **文件存在性檢查** - 驗證文件是否正確創建
- **代碼語法檢查** - 確保代碼語法正確
- **內容匹配驗證** - 驗證代碼內容是否符合預期
- **測試執行驗證** - 自動運行相關測試

## 🛠️ 使用方法

### 基本命令

#### 計劃管理
```
Devika: 創建編輯計劃        - 創建新的編輯計劃
Devika: 顯示計劃詳情        - 查看當前計劃的詳細信息
Devika: 導出編輯計劃        - 將計劃導出為 JSON 文件
Devika: 導入編輯計劃        - 從 JSON 文件導入計劃
Devika: 刪除編輯計劃        - 刪除當前計劃
```

#### 執行控制
```
Devika: 開始執行            - 開始執行編輯計劃
Devika: 暫停執行            - 暫停當前執行
Devika: 恢復執行            - 恢復暫停的執行
Devika: 停止執行            - 停止執行並保存進度
```

#### 步驟導航
```
Devika: 下一步              - 前進到下一個步驟
Devika: 上一步              - 回到上一個步驟
Devika: 跳轉到步驟          - 跳轉到指定步驟
Devika: 執行當前步驟        - 執行當前步驟
Devika: 跳過當前步驟        - 跳過當前步驟
Devika: 重試當前步驟        - 重試失敗的步驟
```

#### 步驟管理
```
Devika: 顯示步驟詳情        - 查看步驟的詳細信息
Devika: 編輯步驟            - 修改步驟內容
Devika: 添加步驟            - 添加新的步驟
Devika: 移除步驟            - 移除指定步驟
Devika: 移動步驟            - 調整步驟順序
```

#### 進度和統計
```
Devika: 顯示進度            - 查看當前執行進度
Devika: 顯示歷史            - 查看步驟執行歷史
Devika: 顯示統計            - 查看執行統計信息
```

### 快速操作

#### 快速開始
```
Devika: 快速開始            - 選擇任務類型快速創建計劃
```

快速開始選項：
- 🚀 **實現新功能** - 創建功能實現計劃
- 🐛 **修復 Bug** - 創建 Bug 修復計劃  
- 🔧 **重構代碼** - 創建重構計劃
- 🧪 **添加測試** - 創建測試計劃
- 📚 **更新文檔** - 創建文檔更新計劃

#### 智能生成
```
Devika: 從選擇生成步驟      - 基於選中代碼生成編輯步驟
Devika: 從註釋生成步驟      - 基於代碼註釋生成步驟
Devika: 從 TODO 生成步驟    - 基於 TODO 註釋生成步驟
```

### 配置設置

#### 編輯導航配置
```json
{
  "devika.editNavigation.enabled": true,
  "devika.editNavigation.autoAdvance": true,
  "devika.editNavigation.showPreview": true,
  "devika.editNavigation.confirmBeforeExecute": true,
  "devika.editNavigation.skipOptionalSteps": false,
  "devika.editNavigation.maxRetries": 3,
  "devika.editNavigation.timeoutSeconds": 30,
  "devika.editNavigation.enableValidation": true,
  "devika.editNavigation.showEstimatedTime": true,
  "devika.editNavigation.enableSmartSuggestions": true,
  "devika.editNavigation.autoSaveProgress": true
}
```

#### 步驟生成配置
```json
{
  "devika.editNavigation.stepGeneration.defaultTestingFramework": "jest",
  "devika.editNavigation.stepGeneration.defaultCodeStyle": "typescript",
  "devika.editNavigation.stepGeneration.includeDocumentation": true,
  "devika.editNavigation.stepGeneration.includeTests": true,
  "devika.editNavigation.stepGeneration.includeErrorHandling": true
}
```

## 🎯 使用場景

### 1. 功能開發流程

#### 場景：實現用戶認證功能
```
1. 📋 創建功能規格文檔
   - 分析需求：用戶登錄、註冊、密碼重置
   - 設計 API 接口和數據結構
   
2. 📁 創建核心文件
   - src/auth/AuthService.ts
   - src/auth/AuthController.ts
   - src/auth/types.ts
   
3. 📥 添加必要導入
   - bcrypt, jsonwebtoken, express
   - 類型定義和接口
   
4. ⚡ 實現核心功能
   - 用戶註冊邏輯
   - 登錄驗證邏輯
   - Token 生成和驗證
   
5. 🛡️ 添加錯誤處理
   - 輸入驗證
   - 異常處理
   - 安全檢查
   
6. 🧪 創建測試
   - 單元測試
   - 整合測試
   - 安全測試
   
7. 📚 更新文檔
   - API 文檔
   - 使用說明
   - README 更新
```

### 2. Bug 修復流程

#### 場景：修復內存洩漏問題
```
1. 🔍 問題分析
   - 重現 Bug 的步驟
   - 分析內存使用模式
   - 識別洩漏源頭
   
2. 🧪 創建重現測試
   - 編寫能穩定重現問題的測試
   - 設置內存監控
   
3. 🔧 實施修復
   - 修復事件監聽器洩漏
   - 添加適當的清理邏輯
   - 優化資源管理
   
4. ✅ 驗證修復
   - 運行重現測試確認修復
   - 執行回歸測試
   - 監控內存使用
```

### 3. 重構流程

#### 場景：重構大型組件
```
1. 📋 制定重構計劃
   - 分析當前代碼結構
   - 設計新的架構
   - 評估風險和影響
   
2. 🧪 確保測試覆蓋
   - 為現有功能添加測試
   - 確保測試覆蓋率達標
   
3. 🔄 執行重構
   - 小步驟、安全地重構
   - 保持功能不變
   - 持續運行測試
   
4. ✅ 驗證結果
   - 確認所有測試通過
   - 檢查性能影響
   - 代碼審查
```

## 🔧 技術實現

### 架構設計

```
┌─────────────────────────────────────────────────────────────┐
│                下一步編輯導航系統架構                        │
├─────────────────────────────────────────────────────────────┤
│  用戶界面層                                                  │
│  ├── 樹視圖提供者 (EditNavigationProvider)                 │
│  ├── 命令提供者 (EditNavigationCommandProvider)            │
│  ├── 狀態欄整合                                             │
│  └── WebView 詳情頁面                                       │
├─────────────────────────────────────────────────────────────┤
│  核心引擎層                                                  │
│  ├── 編輯導航引擎 (EditNavigationEngine)                   │
│  ├── 步驟生成器 (EditStepGenerator)                        │
│  └── 進度追蹤器                                             │
├─────────────────────────────────────────────────────────────┤
│  執行層                                                      │
│  ├── 步驟執行器                                             │
│  ├── 文件操作處理器                                         │
│  ├── 代碼變更應用器                                         │
│  └── 驗證處理器                                             │
├─────────────────────────────────────────────────────────────┤
│  分析層                                                      │
│  ├── 代碼結構分析器                                         │
│  ├── 依賴關係分析器                                         │
│  ├── 上下文構建器                                           │
│  └── 智能建議生成器                                         │
├─────────────────────────────────────────────────────────────┤
│  存儲層                                                      │
│  ├── 計劃存儲管理                                           │
│  ├── 進度狀態存儲                                           │
│  ├── 歷史記錄存儲                                           │
│  └── 配置管理                                               │
└─────────────────────────────────────────────────────────────┘
```

### 核心算法

#### 步驟生成算法
```typescript
class EditStepGenerator {
  async generateEditSteps(context: EditContext): Promise<EditStep[]> {
    // 1. 分析代碼結構和上下文
    const analysis = await this.analyzeCodeStructure(context);
    
    // 2. 根據任務類型生成步驟模板
    const stepTemplates = this.getStepTemplates(context.taskType);
    
    // 3. 基於分析結果定制步驟
    const customizedSteps = this.customizeSteps(stepTemplates, analysis);
    
    // 4. 優化步驟順序和依賴
    const optimizedSteps = this.optimizeSteps(customizedSteps);
    
    return optimizedSteps;
  }
}
```

#### 依賴關係解析
```typescript
class DependencyResolver {
  sortStepsByDependencies(steps: EditStep[]): EditStep[] {
    const sorted: EditStep[] = [];
    const remaining = [...steps];
    
    while (remaining.length > 0) {
      // 找到所有依賴已滿足的步驟
      const canExecute = remaining.filter(step => 
        step.dependencies.every(depId => 
          sorted.some(s => s.id === depId)
        )
      );
      
      if (canExecute.length === 0) {
        // 檢測到循環依賴，使用啟發式解決
        break;
      }
      
      // 按優先級排序並選擇第一個
      const nextStep = this.selectByPriority(canExecute);
      sorted.push(nextStep);
      remaining.splice(remaining.indexOf(nextStep), 1);
    }
    
    return sorted;
  }
}
```

#### 智能驗證系統
```typescript
class StepValidator {
  async validateStep(step: EditStep): Promise<boolean> {
    if (!step.validation) return true;
    
    const results = await Promise.all([
      this.validateFileOperations(step),
      this.validateCodeSyntax(step),
      this.validateContentMatch(step),
      this.validateTestExecution(step)
    ]);
    
    return results.every(result => result);
  }
}
```

## 📊 性能和優化

### 執行性能
- **異步執行** - 所有步驟執行都是異步的，不阻塞 UI
- **批量操作** - 相似的操作會被批量處理
- **智能快取** - 快取分析結果和生成的步驟
- **增量更新** - 只更新變化的部分

### 內存管理
- **懶加載** - 按需載入步驟詳情和代碼內容
- **資源清理** - 及時清理不再需要的資源
- **事件管理** - 正確管理事件監聽器的生命週期

### 用戶體驗優化
- **即時反饋** - 實時顯示執行進度和狀態
- **錯誤恢復** - 智能的錯誤處理和恢復機制
- **可中斷執行** - 支援暫停和恢復執行
- **進度保存** - 自動保存執行進度

## 🔮 未來發展

### 計劃功能
- **AI 增強生成** - 使用 AI 模型生成更智能的編輯步驟
- **協作編輯** - 支援團隊協作的編輯計劃
- **模板系統** - 可重用的編輯計劃模板
- **插件擴展** - 支援第三方步驟類型插件

### 技術改進
- **語義分析** - 更深入的代碼語義理解
- **預測執行** - 預測步驟執行結果和潛在問題
- **自動優化** - 基於執行歷史自動優化步驟
- **跨語言支援** - 支援更多編程語言和框架

## 📚 相關文檔

- [用戶指南](USER_GUIDE.md) - 詳細的使用說明
- [API 文檔](api/) - 開發者 API 參考
- [配置指南](CONFIGURATION.md) - 詳細的配置說明
- [故障排除](TROUBLESHOOTING.md) - 常見問題解決

---

下一步編輯導航系統讓複雜的編輯任務變得簡單有序。通過智能的步驟生成、清晰的進度追蹤和自動化的執行能力，開發者可以更專注於邏輯思考，而不是繁瑣的編輯操作。系統會成為您的編程助手，指導您完成每一個編輯任務。
