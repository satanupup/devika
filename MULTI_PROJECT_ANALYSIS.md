# 🚀 多項目智能分析功能

## 🎯 **解決的問題**

您提到的問題：
> "感覺他不會判斷我的目錄有幾個專案，分別是什麼專案，然後我的目的是啥。我目前是把SDK專案跟我的安卓APP專案放在同個目錄下，裡面還有文件，他不會去掃描。"

## ✅ **新功能：智能多項目分析器**

我已經創建了一個全新的 `MultiProjectAnalyzer`，它可以：

### **🔍 自動檢測項目類型**
- ✅ **Android App**: 檢測 `build.gradle`, `AndroidManifest.xml`
- ✅ **iOS App**: 檢測 `.xcodeproj`, `Podfile`, `Package.swift`
- ✅ **Web App**: 檢測 `package.json` + React/Vue/Angular
- ✅ **Backend API**: 檢測 Express/FastAPI/Spring Boot
- ✅ **Library/SDK**: 檢測庫項目特徵
- ✅ **Documentation**: 檢測文檔項目
- ✅ **Desktop App**: 檢測桌面應用

### **📊 深度分析每個項目**
- ✅ **項目名稱和路徑**
- ✅ **使用的程式語言** (按文件數量排序)
- ✅ **源文件和測試文件數量**
- ✅ **依賴項分析**
- ✅ **配置文件檢測**
- ✅ **README 內容提取**
- ✅ **項目描述自動生成**

### **🏗️ 工作區整體分析**
- ✅ **多項目結構概覽**
- ✅ **共享文件檢測** (README, LICENSE, .gitignore 等)
- ✅ **項目關係分析**
- ✅ **智能總結生成**

## 🎯 **針對您的場景**

### **SDK + Android APP 項目**

當您問 "這個項目是做什麼的？" 或 "分析整個項目" 時，現在會得到：

```
📊 **多項目工作區分析**

🏠 **工作區**: YourWorkspace
📁 **總項目數**: 2

🎯 **項目詳情**:

**1. YourSDK**
   • 類型: Library/SDK
   • 語言: Java, Kotlin
   • 源文件: 45 個
   • 測試文件: 12 個
   • 描述: Android SDK for XYZ functionality
   • 主要依賴: retrofit, gson, okhttp

**2. YourAndroidApp**
   • 類型: Android App
   • 語言: Kotlin, Java
   • 源文件: 78 個
   • 測試文件: 23 個
   • 描述: Mobile application using YourSDK
   • 主要依賴: androidx, material, lifecycle

📋 **共享文件**: README.md, LICENSE, .gitignore

📈 **總結**: 檢測到 2 個項目：
• 1 個 Library/SDK
• 1 個 Android App

主要使用語言：Kotlin, Java
```

## 🔧 **技術實現**

### **智能項目檢測邏輯**

#### **Android 項目檢測**
```typescript
if (files.includes('build.gradle') || files.includes('AndroidManifest.xml')) {
    project.type = ProjectType.ANDROID_APP;
    // 分析 gradle 文件和依賴
}
```

#### **SDK/庫項目檢測**
```typescript
if (packageJson.main || packageJson.exports || setupPy) {
    project.type = ProjectType.LIBRARY;
    // 分析庫的 API 和文檔
}
```

#### **語言分析**
```typescript
// 掃描所有源文件，統計語言使用情況
const languageCount = {};
// 按文件數量排序，取前3種主要語言
project.language = sortedLanguages.slice(0, 3);
```

### **深度掃描功能**
- 🔍 **遞歸掃描**: 最多3層深度，避免性能問題
- 🚫 **智能過濾**: 自動忽略 `node_modules`, `.git`, `build` 等
- 📊 **統計分析**: 源文件、測試文件、配置文件分類統計
- 📖 **內容提取**: 自動讀取 README 和 package.json 信息

## 🎯 **使用方式**

### **1. 自動觸發**
當您詢問以下問題時，會自動使用多項目分析器：
- "這個項目是做什麼的？"
- "分析整個項目"
- "項目結構如何？"
- "有幾個項目？"

### **2. 智能回應**
AI 會自動：
1. 🔍 **掃描工作區**
2. 🎯 **識別項目類型**
3. 📊 **分析項目特徵**
4. 💬 **生成詳細報告**

### **3. 上下文感知**
分析結果會被傳遞給 LLM，讓後續對話更智能：
- "SDK 項目有什麼問題嗎？"
- "Android App 的架構如何？"
- "這兩個項目是如何關聯的？"

## 🚀 **立即體驗**

### **測試步驟**
1. **重新載入擴展**: 在調試窗口按 `Ctrl+R`
2. **開始對話**: 點擊 🤖 與 AI 助理對話
3. **詢問項目**: 
   - "這個工作區有幾個項目？"
   - "分析整個項目結構"
   - "我的 SDK 和 APP 項目分別是做什麼的？"

### **期望結果**
您應該看到：
- ✅ **準確的項目數量**
- ✅ **正確的項目類型識別**
- ✅ **詳細的技術棧分析**
- ✅ **智能的項目描述**
- ✅ **依賴關係分析**

## 🔍 **支援的項目類型**

| 項目類型 | 檢測標誌 | 分析內容 |
|---------|---------|---------|
| 🤖 Android App | `build.gradle`, `AndroidManifest.xml` | Gradle 依賴、SDK 版本 |
| 📱 iOS App | `.xcodeproj`, `Podfile` | CocoaPods、Swift Package |
| 🌐 Web App | `package.json` + React/Vue | NPM 依賴、框架版本 |
| 🔧 Backend API | Express/FastAPI/Spring | 服務器框架、API 路由 |
| 📚 Library/SDK | `setup.py`, library patterns | 公開 API、文檔 |
| 📖 Documentation | 大量 `.md` 文件 | 文檔結構、內容主題 |
| 🎮 Game | Unity/Unreal 特徵 | 遊戲引擎、資源文件 |

## 💡 **智能特性**

### **1. 上下文理解**
- 理解項目之間的關係
- 識別 SDK 和使用它的 APP
- 分析共享的配置和資源

### **2. 語言優先級**
- 按文件數量排序主要語言
- 識別混合語言項目
- 分析語言使用模式

### **3. 依賴分析**
- 提取主要依賴項
- 識別框架和庫
- 分析版本兼容性

### **4. 描述生成**
- 從 README 提取描述
- 從 package.json 獲取信息
- 基於項目結構推斷用途

## 🎉 **預期改進**

現在當您問 "這個項目是做什麼的？" 時，您會得到：

**之前**: 
> "總文件數: 1000，目錄數: 1767..."

**現在**:
> "檢測到 2 個項目：1 個 Android App 和 1 個 Library/SDK。您的 SDK 項目使用 Java/Kotlin 開發，包含 45 個源文件；Android APP 項目使用 Kotlin 開發，依賴您的 SDK..."

**這就是真正智能的項目理解！** 🧠✨

---

**🔥 立即測試**: 重新載入擴展並問 "分析整個項目" 看看新的智能分析結果！
