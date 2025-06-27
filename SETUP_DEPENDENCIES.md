# 🔧 依賴安裝和配置指南

## 📦 **必需的 NPM 依賴**

### **1. SQLite 支援**
```bash
# 安裝 SQLite3 依賴
npm install sqlite3
npm install @types/sqlite3 --save-dev

# 如果遇到編譯問題，可以使用預編譯版本
npm install sqlite3 --build-from-source=false
```

### **2. 其他核心依賴**
```bash
# 文件系統操作
npm install fs-extra
npm install @types/fs-extra --save-dev

# 路徑處理
npm install path-browserify

# UUID 生成
npm install uuid
npm install @types/uuid --save-dev

# 日期處理
npm install date-fns

# 加密和哈希
npm install crypto-js
npm install @types/crypto-js --save-dev
```

## 📝 **更新 package.json**

將以下依賴添加到您的 `package.json` 文件中：

```json
{
  "dependencies": {
    "sqlite3": "^5.1.6",
    "fs-extra": "^11.1.1",
    "uuid": "^9.0.0",
    "date-fns": "^2.30.0",
    "crypto-js": "^4.1.1"
  },
  "devDependencies": {
    "@types/sqlite3": "^3.1.8",
    "@types/fs-extra": "^11.0.1",
    "@types/uuid": "^9.0.2",
    "@types/crypto-js": "^4.1.1"
  }
}
```

## 🛠️ **VS Code 擴展配置**

### **1. 更新 package.json 的擴展配置**
```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "devikaTaskTree",
          "name": "Devika 任務管理",
          "when": "workspaceFolderCount > 0"
        },
        {
          "id": "devikaDiagnostics",
          "name": "Devika 問題診斷",
          "when": "workspaceFolderCount > 0"
        }
      ]
    },
    "commands": [
      {
        "command": "devika.addTask",
        "title": "新增任務",
        "icon": "$(add)"
      },
      {
        "command": "devika.editTask",
        "title": "編輯任務",
        "icon": "$(edit)"
      },
      {
        "command": "devika.deleteTask",
        "title": "刪除任務",
        "icon": "$(trash)"
      },
      {
        "command": "devika.markTaskComplete",
        "title": "標記為完成",
        "icon": "$(check)"
      },
      {
        "command": "devika.markTaskInProgress",
        "title": "標記為進行中",
        "icon": "$(sync)"
      },
      {
        "command": "devika.analyzeMarkdown",
        "title": "分析 Markdown 文件",
        "icon": "$(markdown)"
      },
      {
        "command": "devika.fixDiagnostic",
        "title": "修復問題",
        "icon": "$(wrench)"
      },
      {
        "command": "devika.ignoreDiagnostic",
        "title": "忽略問題",
        "icon": "$(eye-closed)"
      },
      {
        "command": "devika.getDiagnosticSolution",
        "title": "獲取 AI 解決方案",
        "icon": "$(lightbulb)"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "devika.addTask",
          "when": "view == devikaTaskTree",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "devika.editTask",
          "when": "view == devikaTaskTree && viewItem =~ /task/",
          "group": "inline"
        },
        {
          "command": "devika.markTaskComplete",
          "when": "view == devikaTaskTree && viewItem =~ /status-pending|status-in-progress/",
          "group": "inline"
        },
        {
          "command": "devika.markTaskInProgress",
          "when": "view == devikaTaskTree && viewItem =~ /status-pending/",
          "group": "inline"
        },
        {
          "command": "devika.deleteTask",
          "when": "view == devikaTaskTree && viewItem =~ /task/",
          "group": "inline"
        },
        {
          "command": "devika.fixDiagnostic",
          "when": "view == devikaDiagnostics",
          "group": "inline"
        },
        {
          "command": "devika.getDiagnosticSolution",
          "when": "view == devikaDiagnostics",
          "group": "inline"
        }
      ]
    }
  }
}
```

## 🔧 **擴展主文件更新**

更新 `src/extension.ts` 以註冊新的功能：

```typescript
import * as vscode from 'vscode';
import { TaskManager } from './tasks/TaskManager';
import { TaskTreeProvider } from './ui/TaskTreeProvider';
import { DatabaseManager } from './storage/DatabaseManager';
import { DiagnosticsManager } from './diagnostics/DiagnosticsManager';
import { LLMService } from './llm/LLMService';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Devika 擴展正在啟動...');

    try {
        // 初始化數據庫
        const dbManager = new DatabaseManager(context);
        await dbManager.initialize();

        // 初始化服務
        const llmService = new LLMService();
        const taskManager = new TaskManager(context);
        const diagnosticsManager = new DiagnosticsManager(dbManager, llmService, context);
        
        await taskManager.initialize();

        // 創建樹狀視圖提供者
        const taskTreeProvider = new TaskTreeProvider(taskManager);
        
        // 註冊樹狀視圖
        vscode.window.createTreeView('devikaTaskTree', {
            treeDataProvider: taskTreeProvider,
            showCollapseAll: true,
            canSelectMany: true
        });

        // 註冊命令
        const commands = [
            vscode.commands.registerCommand('devika.addTask', () => taskTreeProvider.addTask()),
            vscode.commands.registerCommand('devika.editTask', (item) => taskTreeProvider.editTask(item.task)),
            vscode.commands.registerCommand('devika.deleteTask', (item) => taskTreeProvider.deleteTask(item.task)),
            vscode.commands.registerCommand('devika.markTaskComplete', (item) => 
                taskTreeProvider.updateTaskStatus(item.task, 'completed')),
            vscode.commands.registerCommand('devika.markTaskInProgress', (item) => 
                taskTreeProvider.updateTaskStatus(item.task, 'in-progress')),
            
            // 診斷相關命令
            vscode.commands.registerCommand('devika.fixDiagnostic', async (uri, diagnostic) => {
                const success = await diagnosticsManager.attemptAutoFix(uri, diagnostic);
                if (success) {
                    vscode.window.showInformationMessage('問題已自動修復！');
                } else {
                    vscode.window.showWarningMessage('無法自動修復此問題。');
                }
            }),
            
            vscode.commands.registerCommand('devika.getDiagnosticSolution', async (uri, diagnostic) => {
                const solution = await diagnosticsManager.getAISolutions(uri, diagnostic);
                
                // 顯示解決方案
                const panel = vscode.window.createWebviewPanel(
                    'diagnosticSolution',
                    '問題解決方案',
                    vscode.ViewColumn.Beside,
                    { enableScripts: true }
                );
                
                panel.webview.html = generateSolutionHTML(solution);
            })
        ];

        context.subscriptions.push(...commands);

        // 狀態欄項目
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = "$(list-unordered) Devika 任務";
        statusBarItem.command = 'workbench.view.explorer';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);

        console.log('Devika 擴展啟動完成！');
        
    } catch (error) {
        console.error('Devika 擴展啟動失敗:', error);
        vscode.window.showErrorMessage(`Devika 擴展啟動失敗: ${error}`);
    }
}

export function deactivate() {
    console.log('Devika 擴展正在停用...');
}

function generateSolutionHTML(solution: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>問題解決方案</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .solution { margin: 10px 0; padding: 10px; border-left: 3px solid var(--vscode-accent-color); }
            .confidence { color: var(--vscode-charts-green); font-weight: bold; }
            .diagnostic { background: var(--vscode-editor-background); padding: 10px; border-radius: 5px; }
        </style>
    </head>
    <body>
        <h2>問題診斷</h2>
        <div class="diagnostic">
            <strong>訊息:</strong> ${solution.diagnostic.message}<br>
            <strong>來源:</strong> ${solution.diagnostic.source || 'Unknown'}<br>
            <strong>可信度:</strong> <span class="confidence">${solution.confidence}/10</span>
        </div>
        
        <h2>解決方案</h2>
        ${solution.solutions.map((sol: string, index: number) => 
            `<div class="solution"><strong>方案 ${index + 1}:</strong><br>${sol}</div>`
        ).join('')}
        
        ${solution.autoFixAvailable ? 
            '<p><strong>✅ 此問題支援自動修復</strong></p>' : 
            '<p><strong>⚠️ 此問題需要手動修復</strong></p>'
        }
    </body>
    </html>
    `;
}
```

## 🚀 **編譯和測試**

### **1. 編譯項目**
```bash
# 安裝依賴
npm install

# 編譯 TypeScript
npm run compile

# 或者使用監視模式
npm run watch
```

### **2. 測試擴展**
1. 按 `F5` 啟動擴展開發主機
2. 在新窗口中打開一個項目
3. 查看側邊欄中的 "Devika 任務管理" 面板
4. 嘗試創建和管理任務

### **3. 檢查數據庫**
數據庫文件會創建在：
- **有工作區**: `{workspace}/.devika/devika.db`
- **無工作區**: `{extension-global-storage}/devika.db`

## 🐛 **常見問題解決**

### **1. SQLite 編譯問題**
```bash
# Windows 用戶可能需要安裝 Visual Studio Build Tools
npm install --global windows-build-tools

# 或者使用預編譯版本
npm install sqlite3 --build-from-source=false
```

### **2. 權限問題**
確保擴展有權限在工作區創建 `.devika` 文件夾和數據庫文件。

### **3. 數據庫鎖定問題**
如果遇到數據庫鎖定，重啟 VS Code 通常可以解決。

## 📁 **文件結構**
```
src/
├── storage/
│   ├── DatabaseManager.ts      # 數據庫管理器
│   ├── DatabaseSchema.ts       # 數據庫架構定義
│   └── TaskDAO.ts             # 任務數據存取層
├── ui/
│   └── TaskTreeProvider.ts    # 樹狀任務列表
├── diagnostics/
│   └── DiagnosticsManager.ts  # 問題診斷管理器
├── tasks/
│   └── TaskManager.ts         # 任務管理器
└── extension.ts               # 擴展主文件
```

---

**🎉 按照這個指南設置後，您就擁有了一個功能完整的進階任務管理系統！**
