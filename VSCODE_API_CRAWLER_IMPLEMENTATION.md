# 🕷️ VS Code API 爬蟲掃描系統實作報告

## 📋 **功能概覽**

我已經為您實作了一個完整的 VS Code API 爬蟲掃描系統，能夠：

### ✅ **核心功能**
- 🕷️ **自動爬取** https://code.visualstudio.com/api 的所有 API 文檔
- 📊 **智能分析** API 變更、新增、更新和棄用情況
- 💾 **本地存儲** 所有 API 資訊到 SQLite 數據庫
- 📝 **自動生成** 詳細的更新計畫文件
- 🔍 **覆蓋率分析** 檢查擴充套件對 VS Code API 的使用情況
- 🤖 **AI 整合準備** 為 AI 操作建立完整的 API 映射

## 🏗️ **系統架構**

```
VS Code API 爬蟲系統
├── VSCodeAPICrawler (爬蟲引擎)
├── APIDAO (數據存取層)
├── UpdatePlanGenerator (更新計畫生成器)
├── VSCodeAPIManager (主管理器)
└── APICommands (VS Code 命令整合)
```

## 🔧 **核心組件詳解**

### **1. VSCodeAPICrawler - 爬蟲引擎**
```typescript
// 主要功能
async crawlVSCodeAPI(): Promise<CrawlResult> {
    // 爬取主要 API 頁面
    const mainPageContent = await this.fetchPage(`${this.baseUrl}/references/vscode-api`);
    
    // 解析 API 結構
    const namespaces = await this.parseAPIStructure(mainPageContent);
    
    // 獲取詳細信息
    const detailedNamespaces = await this.enrichAPIDetails(namespaces);
    
    // 比較版本差異
    const comparison = this.compareAPIVersions(detailedNamespaces, previousResult);
    
    return {
        timestamp: new Date(),
        version: await this.detectVSCodeVersion(),
        namespaces: detailedNamespaces,
        totalAPIs: this.countTotalAPIs(detailedNamespaces),
        newAPIs: comparison.newAPIs,
        updatedAPIs: comparison.updatedAPIs,
        deprecatedAPIs: comparison.deprecatedAPIs
    };
}
```

**特色功能:**
- 🌐 **智能解析**: 自動解析 HTML 結構提取 API 信息
- 🔄 **版本比較**: 自動檢測 API 變更和版本差異
- 📖 **詳細提取**: 獲取參數、範例、相關 API 等詳細信息
- 🛡️ **錯誤處理**: 完善的錯誤處理和重試機制

### **2. 擴展的 SQLite 數據庫架構**
新增了 8 個專門的 API 相關數據表：

```sql
-- VS Code API 命名空間表
CREATE TABLE vscode_api_namespaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_namespace_id TEXT,
    url TEXT,
    first_discovered DATETIME NOT NULL,
    last_updated DATETIME NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- VS Code API 端點表
CREATE TABLE vscode_api_endpoints (
    id TEXT PRIMARY KEY,
    namespace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'class', 'interface', 'function', 'enum', 'variable'
    description TEXT,
    signature TEXT,
    return_type TEXT,
    since_version TEXT,
    deprecated INTEGER DEFAULT 0,
    url TEXT,
    usage_count INTEGER DEFAULT 0
);

-- API 參數表
CREATE TABLE vscode_api_parameters (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    optional INTEGER DEFAULT 0,
    description TEXT,
    order_index INTEGER DEFAULT 0
);

-- 擴充套件 API 使用記錄表
CREATE TABLE extension_api_usage (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    line_number INTEGER,
    usage_context TEXT,
    usage_type TEXT, -- 'import', 'call', 'instantiate', 'extend'
    first_used DATETIME NOT NULL,
    last_scanned DATETIME NOT NULL
);

-- API 覆蓋率分析表
CREATE TABLE api_coverage_analysis (
    id TEXT PRIMARY KEY,
    analysis_date DATETIME NOT NULL,
    total_available_apis INTEGER NOT NULL,
    used_apis_count INTEGER NOT NULL,
    coverage_percentage REAL NOT NULL,
    unused_apis TEXT, -- JSON array
    most_used_apis TEXT, -- JSON array
    recommendations TEXT -- JSON array
);
```

### **3. UpdatePlanGenerator - 更新計畫生成器**
```typescript
async generateUpdatePlan(crawlResult: CrawlResult): Promise<UpdatePlan> {
    // 分析新 API
    const newAPIItems = await this.analyzeNewAPIs(crawlResult.newAPIs);
    
    // 分析更新的 API
    const updatedAPIItems = await this.analyzeUpdatedAPIs(crawlResult.updatedAPIs);
    
    // 分析已棄用的 API
    const deprecatedAPIItems = await this.analyzeDeprecatedAPIs(crawlResult.deprecatedAPIs);

    // 生成建議和實作任務
    const recommendations = await this.generateRecommendations(crawlResult, coverageAnalysis, usageStats);
    const implementationTasks = await this.generateImplementationTasks(newAPIItems, updatedAPIItems, deprecatedAPIItems, recommendations);

    return {
        generatedAt: new Date(),
        vscodeVersion: crawlResult.version,
        currentCoverage: coverageAnalysis?.coverage_percentage || 0,
        totalAPIs: crawlResult.totalAPIs,
        newAPIs: newAPIItems,
        updatedAPIs: updatedAPIItems,
        deprecatedAPIs: deprecatedAPIItems,
        recommendations,
        implementationTasks
    };
}
```

**智能分析功能:**
- 🎯 **優先級計算**: 根據 API 類型、命名空間、關鍵字自動計算優先級
- ⏱️ **工時估算**: 智能估算每個 API 的實作工時
- 📋 **任務生成**: 自動生成詳細的實作任務和驗收標準
- 💡 **建議系統**: 基於覆蓋率和使用情況提供改進建議

### **4. VSCodeAPIManager - 主管理器**
```typescript
// 執行完整掃描
async performFullScan(): Promise<ScanResult> {
    // 執行 API 爬取
    const crawlResult = await this.crawler.crawlVSCodeAPI();
    
    // 保存到數據庫
    await this.saveAPIData(crawlResult);
    
    // 生成更新計畫
    const updatePlan = await this.planGenerator.generateUpdatePlan(crawlResult);
    
    // 保存更新計畫文件
    const updatePlanPath = await this.planGenerator.saveUpdatePlanToFile(updatePlan);
    
    return { success: true, crawlResult, updatePlan, updatePlanPath, duration };
}

// 獲取覆蓋率報告
async getAPICoverageReport(): Promise<CoverageReport> {
    const usageStats = await this.apiDAO.getAPIUsageStats();
    const unusedAPIs = await this.apiDAO.getUnusedAPIs();
    const deprecatedInUse = await this.apiDAO.getDeprecatedAPIsInUse();
    
    return {
        totalAPIs: usageStats.totalAPIs,
        usedAPIs: usageStats.usedAPIs,
        coveragePercentage: (usageStats.usedAPIs / usageStats.totalAPIs) * 100,
        mostUsedAPIs: usageStats.mostUsedAPIs,
        deprecatedAPIsInUse: usageStats.deprecatedAPIsInUse,
        recommendations: this.generateRecommendations(usageStats)
    };
}
```

## 🎮 **VS Code 命令整合**

### **主要命令**
```json
{
  "commands": [
    {
      "command": "devika.scanVSCodeAPI",
      "title": "掃描 VS Code API",
      "category": "Devika"
    },
    {
      "command": "devika.checkAPIUpdates", 
      "title": "檢查 API 更新",
      "category": "Devika"
    },
    {
      "command": "devika.showAPICoverage",
      "title": "顯示 API 覆蓋率",
      "category": "Devika"
    },
    {
      "command": "devika.searchAPI",
      "title": "搜索 API",
      "category": "Devika"
    },
    {
      "command": "devika.generateUpdatePlan",
      "title": "生成更新計畫",
      "category": "Devika"
    }
  ]
}
```

### **使用方式**
1. **手動掃描**: `Ctrl+Shift+P` → "Devika: 掃描 VS Code API"
2. **檢查更新**: `Ctrl+Shift+P` → "Devika: 檢查 API 更新"
3. **查看覆蓋率**: `Ctrl+Shift+P` → "Devika: 顯示 API 覆蓋率"
4. **搜索 API**: `Ctrl+Shift+P` → "Devika: 搜索 API"

## 📄 **自動生成的更新計畫文件**

系統會在 `{workspace}/.devika/update-plan.md` 生成詳細的更新計畫：

```markdown
# VS Code 擴充套件 API 更新計畫

**生成時間**: 2024-01-15 10:30:00
**VS Code 版本**: 1.85.0
**當前 API 覆蓋率**: 45.2%
**總 API 數量**: 1,247
**已使用 API**: 564

## 📊 概覽
- 🆕 **新 API**: 23 個
- 🔄 **更新 API**: 15 個
- ⚠️ **已棄用 API**: 8 個
- 📋 **實作任務**: 31 個
- ⏱️ **預估總工時**: 156 小時

## 🆕 新增 API (23)

### vscode.window.createStatusBarItem2
- **類型**: function
- **優先級**: high
- **影響**: feature
- **預估工時**: 4 小時
- **描述**: 創建新的狀態欄項目，支援更多自定義選項

#### 實作步驟：
1. 在適當的模組中添加 createStatusBarItem2 的使用
2. 創建包裝函數以簡化 API 調用
3. 添加錯誤處理和類型檢查
4. 編寫單元測試
5. 更新文檔和範例

## 💡 建議 (5)

### 提高 API 覆蓋率
- **類型**: new_api
- **優先級**: medium
- **預估工時**: 16 小時

**描述**: 當前 API 覆蓋率為 45.2%，建議整合更多有用的 VS Code API

**行動項目**:
- 分析未使用的高價值 API
- 優先整合核心功能相關的 API
- 創建 API 使用範例和文檔

## 📋 實作任務 (31)

### 整合新 API: vscode.window.createStatusBarItem2
- **ID**: TASK-ABC123
- **類別**: api_integration
- **優先級**: high
- **預估工時**: 4 小時

**驗收標準**:
- 成功整合 createStatusBarItem2 API
- 添加適當的錯誤處理
- 編寫單元測試
- 更新文檔
```

## 🤖 **AI 操作整合準備**

### **API 映射系統**
```typescript
// AI 可用的 API 映射
const aiAvailableAPIs = {
    "window": {
        "showInformationMessage": {
            "safe": true,
            "parameters": ["message", "...items"],
            "description": "顯示信息消息給用戶"
        },
        "createWebviewPanel": {
            "safe": true,
            "parameters": ["viewType", "title", "showOptions", "options"],
            "description": "創建 Webview 面板"
        }
    },
    "workspace": {
        "openTextDocument": {
            "safe": true,
            "parameters": ["uri"],
            "description": "打開文本文檔"
        },
        "applyEdit": {
            "safe": false, // 需要用戶確認
            "parameters": ["edit"],
            "description": "應用工作區編輯"
        }
    }
};

// AI 操作日誌
await apiDAO.logAIOperation(
    'api_call',
    'vscode.window.showInformationMessage',
    { message: 'Hello World' },
    ['Hello World'],
    { success: true },
    true,
    undefined,
    150,
    'User requested to show a greeting message'
);
```

## 🚀 **使用指南**

### **1. 安裝依賴**
```bash
npm install axios cheerio sqlite3
npm install @types/cheerio --save-dev
```

### **2. 更新 package.json**
```json
{
  "contributes": {
    "commands": [
      {
        "command": "devika.scanVSCodeAPI",
        "title": "掃描 VS Code API",
        "category": "Devika"
      },
      {
        "command": "devika.checkAPIUpdates",
        "title": "檢查 API 更新", 
        "category": "Devika"
      },
      {
        "command": "devika.showAPICoverage",
        "title": "顯示 API 覆蓋率",
        "category": "Devika"
      }
    ]
  }
}
```

### **3. 在 extension.ts 中註冊**
```typescript
import { APICommands } from './commands/APICommands';

export async function activate(context: vscode.ExtensionContext) {
    // 初始化數據庫
    const dbManager = new DatabaseManager(context);
    await dbManager.initialize();
    
    // 註冊 API 命令
    const apiCommands = new APICommands(context, dbManager);
    
    console.log('Devika API 爬蟲系統已啟動！');
}
```

### **4. 執行掃描**
1. 打開 VS Code
2. 按 `Ctrl+Shift+P`
3. 輸入 "Devika: 掃描 VS Code API"
4. 等待掃描完成
5. 查看生成的更新計畫文件

## 📊 **預期效果**

### **數據收集**
- ✅ **完整 API 清單**: 自動收集所有 VS Code API
- ✅ **版本追蹤**: 追蹤 API 的新增、更新、棄用
- ✅ **使用分析**: 分析擴充套件的 API 使用情況
- ✅ **覆蓋率報告**: 生成詳細的覆蓋率分析

### **開發效率**
- 🚀 **自動化更新**: 定期檢查和更新 API 使用
- 📋 **結構化計畫**: 自動生成實作任務和時程
- 💡 **智能建議**: 基於分析結果提供改進建議
- 🤖 **AI 準備**: 為 AI 操作建立完整的 API 基礎

### **維護便利**
- 📁 **本地存儲**: 所有數據存儲在本地 SQLite
- 🔄 **Git 整合**: 數據庫文件可隨項目版本控制
- 📝 **文檔同步**: 自動生成和更新技術文檔
- 🔍 **問題追蹤**: 識別已棄用 API 和潛在問題

---

**🎉 這個 VS Code API 爬蟲掃描系統為您的擴充套件提供了完整的 API 管理和追蹤能力，確保您能夠充分利用 VS Code 的所有功能！**
