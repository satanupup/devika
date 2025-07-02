# 對話記憶系統

Devika VS Code Extension 的對話記憶系統是一個智能的對話管理和記憶保持系統，能夠跨對話會話維護上下文，提供個性化的對話體驗，並從歷史對話中學習和檢索相關信息。

## 🧠 核心概念

### 對話會話 (Conversation Session)
- **會話管理**: 自動管理多個並行對話會話
- **上下文保持**: 在會話中維護完整的對話上下文
- **智能分類**: 根據對話類型自動分類和標記
- **生命週期管理**: 完整的會話創建、維護和結束流程

### 記憶檢索 (Memory Retrieval)
- **相關性檢索**: 基於查詢內容檢索相關的歷史對話
- **上下文感知**: 考慮當前代碼上下文和項目環境
- **智能排序**: 根據相關性和時間順序智能排序結果
- **多維度匹配**: 基於內容、標籤、類型等多個維度匹配

### 上下文分析 (Context Analysis)
- **意圖識別**: 自動識別用戶的對話意圖
- **實體提取**: 從對話中提取關鍵實體和概念
- **代碼引用分析**: 分析對話中的代碼引用和符號
- **模式識別**: 識別常見的對話模式和流程

### 數據持久化 (Data Persistence)
- **自動保存**: 實時保存對話數據
- **備份恢復**: 自動備份和手動恢復功能
- **數據導出**: 支援多種格式的數據導出
- **清理管理**: 自動清理過期數據

## 🚀 主要功能

### 1. 智能會話管理

#### 會話類型
```typescript
enum ConversationType {
  CHAT = 'chat',              // 💬 一般聊天
  CODE_REVIEW = 'code_review', // 🔍 代碼審查
  DEBUGGING = 'debugging',     // 🐛 調試幫助
  REFACTORING = 'refactoring', // 🔧 代碼重構
  LEARNING = 'learning',       // 📚 學習輔導
  PLANNING = 'planning',       // 📋 項目規劃
  GENERAL = 'general'          // 🌐 通用對話
}
```

#### 自動上下文構建
- **文件上下文**: 當前編輯的文件和選中的代碼
- **項目上下文**: 工作區信息和項目類型
- **代碼符號**: 相關的函數、類和變數
- **歷史關聯**: 與之前對話的關聯性

### 2. 智能記憶檢索

#### 多維度檢索
```typescript
// 基於查詢內容檢索
const result = await memoryManager.getRelevantMemory(
  'React 組件優化',
  currentContext,
  10 // 最大結果數
);

// 檢索結果包含
interface MemoryRetrievalResult {
  relevantSessions: ConversationSession[];  // 相關會話
  relatedMessages: ConversationMessage[];   // 相關消息
  contextualInfo: string[];                 // 上下文信息
  confidence: number;                       // 信心度
  reasoning: string;                        // 檢索推理
}
```

#### 智能搜索
- **內容搜索**: 搜索對話內容和標題
- **標籤過濾**: 基於標籤和類型過濾
- **時間範圍**: 指定時間範圍的搜索
- **項目範圍**: 限定在特定項目的對話

### 3. 上下文分析和理解

#### 消息分析
```typescript
interface ContextAnalysisResult {
  intent: string;                    // 用戶意圖
  entities: string[];                // 提取的實體
  topics: string[];                  // 識別的主題
  codeReferences: CodeReference[];   // 代碼引用
  sentiment: 'positive' | 'negative' | 'neutral'; // 情感分析
  complexity: number;                // 複雜度評估
  confidence: number;                // 分析信心度
  suggestions: string[];             // 建議的後續行動
}
```

#### 模式識別
- **對話模式**: 識別常見的對話流程和模式
- **用戶習慣**: 學習用戶的對話習慣和偏好
- **上下文繼承**: 智能繼承相關會話的上下文
- **預測建議**: 預測用戶可能的下一步行動

### 4. 數據管理和持久化

#### 存儲配置
```typescript
interface StorageConfig {
  maxSessions: number;           // 最大會話數
  maxMessagesPerSession: number; // 每個會話最大消息數
  retentionDays: number;         // 數據保留天數
  compressionEnabled: boolean;   // 是否啟用壓縮
  encryptionEnabled: boolean;    // 是否啟用加密
  backupEnabled: boolean;        // 是否啟用自動備份
  backupInterval: number;        // 備份間隔（小時）
}
```

#### 導出選項
- **JSON 格式**: 結構化數據，便於程序處理
- **Markdown 格式**: 可讀的文檔格式
- **CSV 格式**: 表格數據，便於分析
- **匿名化選項**: 移除敏感信息的匿名導出

## 🛠️ 使用方法

### 基本命令

#### 會話管理
```
Devika: 開始新對話        - 開始新的對話會話
Devika: 結束當前對話      - 結束當前活躍的對話
Devika: 恢復對話          - 從歷史中恢復對話會話
Devika: 切換對話          - 在多個活躍會話間切換
```

#### 記憶檢索
```
Devika: 搜索對話記憶      - 搜索歷史對話內容
Devika: 獲取相關上下文    - 基於當前上下文檢索相關記憶
Devika: 顯示對話歷史      - 查看完整的對話歷史
```

#### 上下文分析
```
Devika: 分析當前上下文    - 分析當前對話的上下文
Devika: 預測下一步行動    - 預測可能的後續行動
Devika: 識別對話模式      - 識別當前對話的模式
```

#### 數據管理
```
Devika: 導出對話數據      - 導出對話數據到文件
Devika: 導入對話數據      - 從文件導入對話數據
Devika: 創建備份          - 創建對話數據備份
Devika: 恢復備份          - 從備份恢復對話數據
Devika: 顯示統計          - 查看對話統計信息
Devika: 清理對話          - 清理過期的對話數據
```

### 配置選項

在 VS Code 設置中可以配置對話記憶系統：

```json
{
  "devika.conversation.enabled": true,
  "devika.conversation.maxActiveSessions": 5,
  "devika.conversation.maxHistorySessions": 100,
  "devika.conversation.contextWindow": 50,
  "devika.conversation.retentionDays": 90,
  "devika.conversation.autoBackup": true,
  "devika.conversation.backupInterval": 24,
  "devika.conversation.enableContextAnalysis": true,
  "devika.conversation.enablePatternRecognition": true
}
```

## 🔧 技術實現

### 架構設計

```
┌─────────────────────────────────────────────────────────────┐
│                    對話記憶系統架構                          │
├─────────────────────────────────────────────────────────────┤
│  用戶交互層                                                  │
│  ├── 命令提供者 (ConversationCommandProvider)               │
│  ├── WebView 界面                                           │
│  └── 狀態欄集成                                             │
├─────────────────────────────────────────────────────────────┤
│  核心管理層                                                  │
│  ├── 對話記憶管理器 (ConversationMemoryManager)             │
│  ├── 上下文分析器 (ConversationContextAnalyzer)             │
│  └── 持久化管理器 (ConversationPersistenceManager)          │
├─────────────────────────────────────────────────────────────┤
│  數據處理層                                                  │
│  ├── 記憶檢索引擎                                           │
│  ├── 上下文構建器                                           │
│  └── 模式識別器                                             │
├─────────────────────────────────────────────────────────────┤
│  存儲層                                                      │
│  ├── 本地文件存儲                                           │
│  ├── 數據壓縮和加密                                         │
│  └── 備份管理                                               │
└─────────────────────────────────────────────────────────────┘
```

### 數據結構

#### 對話會話
```typescript
interface ConversationSession {
  id: string;                    // 會話唯一標識
  type: ConversationType;        // 會話類型
  title: string;                 // 會話標題
  startTime: Date;               // 開始時間
  lastActivity: Date;            // 最後活動時間
  messages: ConversationMessage[]; // 消息列表
  context: ConversationContext;  // 會話上下文
  summary?: string;              // 會話摘要
  tags: string[];                // 標籤
  isActive: boolean;             // 是否活躍
  metadata: SessionMetadata;     // 元數據
}
```

#### 對話消息
```typescript
interface ConversationMessage {
  id: string;                    // 消息唯一標識
  timestamp: Date;               // 時間戳
  role: 'user' | 'assistant' | 'system'; // 角色
  content: string;               // 消息內容
  metadata?: MessageMetadata;    // 消息元數據
}
```

#### 對話上下文
```typescript
interface ConversationContext {
  currentFile?: vscode.Uri;      // 當前文件
  workspaceFolder?: vscode.Uri;  // 工作區文件夾
  selectedText?: string;         // 選中的文本
  cursorPosition?: vscode.Position; // 光標位置
  openFiles: vscode.Uri[];       // 打開的文件
  recentFiles: vscode.Uri[];     // 最近的文件
  projectType?: string;          // 項目類型
  dependencies: string[];        // 依賴項目
  codeSymbols: string[];         // 代碼符號
  relatedTopics: string[];       // 相關主題
  userIntent?: string;           // 用戶意圖
  conversationGoal?: string;     // 對話目標
}
```

### 記憶檢索算法

1. **語義匹配**: 基於內容語義的相似度計算
2. **上下文權重**: 根據當前上下文調整檢索權重
3. **時間衰減**: 考慮時間因素的相關性衰減
4. **類型偏好**: 基於對話類型的偏好調整
5. **用戶習慣**: 結合用戶歷史習慣的個性化調整

### 上下文繼承機制

```typescript
interface ContextInheritanceRule {
  sourceType: ConversationType;    // 源會話類型
  targetType: ConversationType;    // 目標會話類型
  inheritanceWeight: number;       // 繼承權重
  contextFields: string[];         // 繼承的上下文字段
  conditions: string[];            // 繼承條件
}
```

## 🔒 隱私和安全

### 數據隱私
- **本地存儲**: 所有對話數據都存儲在本地
- **匿名化選項**: 導出時可選擇匿名化處理
- **用戶控制**: 用戶可以隨時查看、修改或刪除對話數據
- **透明度**: 提供詳細的數據使用說明

### 數據安全
- **可選加密**: 支援對話數據的加密存儲
- **備份保護**: 自動備份防止數據丟失
- **訪問控制**: 只有擴展本身可以訪問對話數據
- **數據完整性**: 驗證數據完整性和一致性

## 🚀 未來發展

### 計劃功能
- **雲端同步**: 可選的雲端數據同步功能
- **團隊共享**: 支援團隊級別的對話共享
- **智能摘要**: 更智能的對話摘要生成
- **多語言支援**: 支援多種語言的對話分析

### 技術改進
- **向量檢索**: 使用向量數據庫提升檢索效果
- **實時分析**: 實時的上下文分析和建議
- **機器學習**: 集成更先進的機器學習算法
- **性能優化**: 進一步優化大規模數據處理性能

## 📚 相關文檔

- [用戶指南](USER_GUIDE.md) - 詳細的使用說明
- [API 文檔](api/) - 開發者 API 參考
- [學習系統](LEARNING_SYSTEM.md) - 持續學習機制
- [貢獻指南](../CONTRIBUTING.md) - 如何貢獻代碼

---

對話記憶系統讓 Devika 能夠維護長期的對話記憶，提供更加智能和個性化的對話體驗。通過跨會話的上下文保持和智能記憶檢索，用戶可以享受到連續性和一致性的 AI 助手服務。
