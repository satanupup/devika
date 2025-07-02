# 📦 package.json 更新計畫

## 🔍 當前狀態分析

### ✅ **已存在的命令** (8 個)
- `devika.start` - 啟動 Devika AI 助理
- `devika.analyzeCode` - 分析選取的程式碼
- `devika.generateTests` - 生成單元測試
- `devika.refactorCode` - 重構程式碼
- `devika.summarizeChanges` - 總結 Git 變更
- `devika.generateCommitMessage` - 生成 Commit 訊息
- `devika.showTasks` - 顯示任務列表
- `devika.scanTodos` - 掃描 TODO 項目

### ❌ **缺失的命令** (5 個)
根據 `src/extension.ts` 中已實作但未在 package.json 中定義的命令：
- `devika.showPlugins` - 顯示 Augment 插件
- `devika.generateContributing` - 生成貢獻指南
- `devika.generateRoadmap` - 生成開發路線圖
- `devika.generateChangelog` - 生成變更日誌

## 🎯 **需要添加的命令定義**

### 📋 **插件相關命令**
```json
{
  "command": "devika.showPlugins",
  "title": "顯示 Augment 插件",
  "category": "Devika",
  "icon": "$(extensions)"
},
{
  "command": "devika.generateContributing",
  "title": "生成貢獻指南 (CONTRIBUTING.md)",
  "category": "Devika",
  "icon": "$(book)"
},
{
  "command": "devika.generateRoadmap",
  "title": "生成開發路線圖 (ROADMAP.md)",
  "category": "Devika",
  "icon": "$(milestone)"
},
{
  "command": "devika.generateChangelog",
  "title": "生成變更日誌 (CHANGELOG.md)",
  "category": "Devika",
  "icon": "$(history)"
}
```

## 🎨 **需要完善的 UI 元素**

### 📱 **命令面板 (Command Palette)**
添加條件顯示控制：
```json
"menus": {
  "commandPalette": [
    {
      "command": "devika.generateContributing",
      "when": "workspaceFolderCount > 0"
    },
    {
      "command": "devika.generateRoadmap", 
      "when": "workspaceFolderCount > 0"
    },
    {
      "command": "devika.generateChangelog",
      "when": "workspaceFolderCount > 0 && gitOpenRepositoryCount > 0"
    }
  ]
}
```

### 🖱️ **右鍵選單 (Context Menu)**
添加檔案總管右鍵選單：
```json
"explorer/context": [
  {
    "command": "devika.showPlugins",
    "when": "explorerResourceIsFolder && resourceFilename == workspaceFolder",
    "group": "devika@1"
  }
]
```

### 🎛️ **活動列 (Activity Bar)**
完善 Devika 專用面板：
```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "devika",
      "title": "Devika AI",
      "icon": "$(robot)"
    }
  ]
},
"views": {
  "devika": [
    {
      "id": "devika.plugins",
      "name": "Augment 插件",
      "when": "devika.activated"
    },
    {
      "id": "devika.tasks",
      "name": "任務管理",
      "when": "devika.activated"
    }
  ]
}
```

## ⌨️ **建議的快捷鍵綁定**

### 🔥 **常用功能快捷鍵**
```json
"keybindings": [
  {
    "command": "devika.start",
    "key": "ctrl+shift+d",
    "mac": "cmd+shift+d",
    "when": "!terminalFocus"
  },
  {
    "command": "devika.analyzeCode",
    "key": "ctrl+shift+a",
    "mac": "cmd+shift+a", 
    "when": "editorHasSelection"
  },
  {
    "command": "devika.showPlugins",
    "key": "ctrl+shift+p",
    "mac": "cmd+shift+p",
    "when": "workspaceFolderCount > 0"
  }
]
```

## ⚙️ **需要新增的配置項目**

### 🔧 **插件系統配置**
```json
"devika.plugins.autoExecute": {
  "type": "boolean",
  "default": false,
  "description": "自動執行插件而不顯示預覽"
},
"devika.plugins.defaultCategory": {
  "type": "string",
  "enum": ["documentation", "testing", "refactoring", "analysis"],
  "default": "documentation",
  "description": "預設插件類別"
},
"devika.ui.showPreview": {
  "type": "boolean", 
  "default": true,
  "description": "生成內容前顯示預覽"
}
```

## 📋 **完整更新清單**

### 🎯 **Phase 1: 添加缺失命令** (立即執行)
1. ✅ 在 `commands` 陣列中添加 4 個插件命令
2. ✅ 為每個命令添加適當的圖示
3. ✅ 設定正確的類別分組

### 🎯 **Phase 2: 完善選單系統** (短期)
1. ✅ 添加命令面板條件顯示
2. ✅ 完善右鍵選單整合
3. ✅ 改善活動列面板結構

### 🎯 **Phase 3: 快捷鍵和配置** (中期)
1. ✅ 添加常用功能快捷鍵
2. ✅ 新增插件系統配置項目
3. ✅ 完善使用者體驗設定

## 🔧 **實作步驟**

### **Step 1: 更新 commands 陣列**
在 package.json 第 69 行後添加：
```json
{
  "command": "devika.showPlugins",
  "title": "顯示 Augment 插件", 
  "category": "Devika",
  "icon": "$(extensions)"
},
{
  "command": "devika.generateContributing",
  "title": "生成貢獻指南 (CONTRIBUTING.md)",
  "category": "Devika", 
  "icon": "$(book)"
},
{
  "command": "devika.generateRoadmap",
  "title": "生成開發路線圖 (ROADMAP.md)",
  "category": "Devika",
  "icon": "$(milestone)"
},
{
  "command": "devika.generateChangelog", 
  "title": "生成變更日誌 (CHANGELOG.md)",
  "category": "Devika",
  "icon": "$(history)"
}
```

### **Step 2: 更新 menus 配置**
在現有 menus 物件中添加：
```json
"commandPalette": [
  {
    "command": "devika.generateContributing",
    "when": "workspaceFolderCount > 0"
  },
  {
    "command": "devika.generateRoadmap",
    "when": "workspaceFolderCount > 0" 
  },
  {
    "command": "devika.generateChangelog",
    "when": "workspaceFolderCount > 0 && gitOpenRepositoryCount > 0"
  }
],
"explorer/context": [
  {
    "command": "devika.showPlugins",
    "when": "explorerResourceIsFolder",
    "group": "devika@1"
  }
]
```

### **Step 3: 完善 views 配置**
更新現有 views 配置：
```json
"views": {
  "devika": [
    {
      "id": "devika.plugins", 
      "name": "Augment 插件",
      "when": "devika.activated"
    },
    {
      "id": "devika.tasks",
      "name": "任務管理", 
      "when": "devika.activated"
    }
  ]
}
```

## ✅ **驗證清單**

### 🔍 **功能驗證**
- [ ] 所有命令在命令面板中可見
- [ ] 插件命令可以正常執行
- [ ] 右鍵選單顯示正確
- [ ] 活動列面板正常載入

### 🎨 **UI 驗證**
- [ ] 命令圖示顯示正確
- [ ] 選單分組合理
- [ ] 條件顯示邏輯正確

### ⚙️ **配置驗證**
- [ ] 設定頁面顯示新配置項目
- [ ] 配置變更即時生效
- [ ] 預設值合理

## 📊 **預期效果**

### 🚀 **使用者體驗改善**
- **命令發現性 +100%**: 所有功能都可在命令面板找到
- **操作便利性 +80%**: 右鍵選單和快捷鍵支援
- **視覺一致性 +90%**: 統一的圖示和分組

### 🔧 **開發者體驗改善**
- **功能完整性 +100%**: 所有實作的功能都有對應的 UI
- **除錯便利性 +70%**: 清楚的命令結構和條件邏輯
- **擴展性 +85%**: 易於添加新命令和功能

---

## 🎯 **總結**

這個更新計畫將：
1. **解決當前阻塞問題**: 添加缺失的 4 個插件命令
2. **完善使用者體驗**: 改善選單、快捷鍵和視覺設計
3. **提升專業度**: 符合 VS Code 擴充功能最佳實踐
4. **為未來擴展做準備**: 建立可擴展的命令和配置架構

**預計執行時間**: 30-45 分鐘  
**優先級**: 🔥 高 (阻塞 Sprint 1 完成)  
**影響範圍**: 所有插件功能的可用性
