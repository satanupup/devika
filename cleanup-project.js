#!/usr/bin/env node

/**
 * Devika 專案清理腳本
 * 自動移除 Python 相關檔案，保留 VS Code Extension 相關內容
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 開始清理 Devika 專案...\n');

// 需要刪除的目錄列表
const directoriesToDelete = [
    'src/agents',
    'src/apis', 
    'src/bert',
    'src/browser',
    'src/documenter',
    'src/experts',
    'src/filesystem',
    'src/memory',
    'src/sandbox',
    'src/services',
    'src/__pycache__',
    'ui',
    'logs',
    'data',
    'benchmarks',
    'api',
    'docs/Installation',
    'docs/architecture'
];

// 需要刪除的檔案列表
const filesToDelete = [
    'requirements.txt',
    'devika.py',
    'config.toml',
    'sample.config.toml',
    'devika.dockerfile',
    'app.dockerfile',
    'docker-compose.yaml',
    'Makefile',
    'setup.sh',
    'run.bat',
    'Run.txt',
    'devika.sln',
    'ARCHITECTURE.md',
    '開發計畫.md',
    // Python 檔案
    'src/config.py',
    'src/init.py',
    'src/logger.py',
    'src/project.py',
    'src/socket_instance.py',
    'src/state.py'
];

// 需要移動的檔案
const filesToMove = [
    {
        from: 'src/prompts',
        to: 'devika-core/src/prompts'
    }
];

/**
 * 安全刪除目錄
 */
function deleteDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`✅ 已刪除目錄: ${dirPath}`);
            return true;
        } catch (error) {
            console.log(`❌ 刪除目錄失敗: ${dirPath} - ${error.message}`);
            return false;
        }
    } else {
        console.log(`⚠️  目錄不存在: ${dirPath}`);
        return true;
    }
}

/**
 * 安全刪除檔案
 */
function deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`✅ 已刪除檔案: ${filePath}`);
            return true;
        } catch (error) {
            console.log(`❌ 刪除檔案失敗: ${filePath} - ${error.message}`);
            return false;
        }
    } else {
        console.log(`⚠️  檔案不存在: ${filePath}`);
        return true;
    }
}

/**
 * 移動檔案或目錄
 */
function moveItem(from, to) {
    if (fs.existsSync(from)) {
        try {
            // 確保目標目錄存在
            const targetDir = path.dirname(to);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            
            // 移動檔案/目錄
            fs.renameSync(from, to);
            console.log(`✅ 已移動: ${from} → ${to}`);
            return true;
        } catch (error) {
            console.log(`❌ 移動失敗: ${from} → ${to} - ${error.message}`);
            return false;
        }
    } else {
        console.log(`⚠️  來源不存在: ${from}`);
        return true;
    }
}

/**
 * 建立 docs 目錄並移動文件
 */
function organizeDocs() {
    console.log('\n📚 整理文件檔案...');
    
    // 建立 docs 目錄
    if (!fs.existsSync('docs')) {
        fs.mkdirSync('docs');
        console.log('✅ 已建立 docs/ 目錄');
    }
    
    // 移動文件到 docs 目錄
    const docsToMove = [
        'ARCHITECTURE_SEPARATION.md',
        'AUGMENT_PLUGIN_GUIDE.md',
        'PROJECT_INTEGRATION_ANALYSIS.md'
    ];
    
    docsToMove.forEach(doc => {
        if (fs.existsSync(doc)) {
            moveItem(doc, `docs/${doc}`);
        }
    });
}

/**
 * 更新 package.json
 */
function updatePackageJson() {
    console.log('\n📝 更新 package.json...');
    
    try {
        const packagePath = 'package.json';
        if (fs.existsSync(packagePath)) {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // 更新描述
            packageJson.description = 'AI-powered VS Code extension for intelligent code analysis and development assistance';
            
            // 移除 Python 相關的腳本
            if (packageJson.scripts) {
                delete packageJson.scripts.setup;
                delete packageJson.scripts.start;
                delete packageJson.scripts['start:ui'];
            }
            
            // 更新關鍵字
            packageJson.keywords = [
                'ai',
                'assistant', 
                'vscode-extension',
                'code-analysis',
                'development-tools',
                'llm',
                'typescript'
            ];
            
            // 寫回檔案
            fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
            console.log('✅ 已更新 package.json');
        }
    } catch (error) {
        console.log(`❌ 更新 package.json 失敗: ${error.message}`);
    }
}

/**
 * 更新 .gitignore
 */
function updateGitignore() {
    console.log('\n📝 更新 .gitignore...');
    
    try {
        const gitignorePath = '.gitignore';
        let gitignoreContent = '';
        
        if (fs.existsSync(gitignorePath)) {
            gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        }
        
        // 移除 Python 相關的忽略規則，新增 VS Code Extension 相關規則
        const newGitignore = `# VS Code Extension
out/
node_modules/
*.vsix
.vscode-test/

# TypeScript
*.tsbuildinfo

# Logs
logs/
*.log

# Environment variables
.env
.env.local

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# devika-core build
devika-core/dist/
devika-core/node_modules/
`;
        
        fs.writeFileSync(gitignorePath, newGitignore);
        console.log('✅ 已更新 .gitignore');
    } catch (error) {
        console.log(`❌ 更新 .gitignore 失敗: ${error.message}`);
    }
}

/**
 * 主要清理函式
 */
function main() {
    let successCount = 0;
    let totalCount = 0;
    
    // 1. 刪除目錄
    console.log('🗂️  刪除 Python 相關目錄...');
    directoriesToDelete.forEach(dir => {
        totalCount++;
        if (deleteDirectory(dir)) successCount++;
    });
    
    // 2. 刪除檔案
    console.log('\n📄 刪除 Python 相關檔案...');
    filesToDelete.forEach(file => {
        totalCount++;
        if (deleteFile(file)) successCount++;
    });
    
    // 3. 移動檔案
    console.log('\n📦 移動檔案...');
    filesToMove.forEach(move => {
        totalCount++;
        if (moveItem(move.from, move.to)) successCount++;
    });
    
    // 4. 整理文件
    organizeDocs();
    
    // 5. 更新配置檔案
    updatePackageJson();
    updateGitignore();
    
    // 6. 顯示結果
    console.log('\n🎉 清理完成！');
    console.log(`✅ 成功: ${successCount}/${totalCount}`);
    
    if (successCount === totalCount) {
        console.log('\n🚀 專案已成功轉換為純 VS Code Extension！');
        console.log('\n下一步:');
        console.log('1. 執行 npm install 安裝依賴項');
        console.log('2. 執行 npm run compile 編譯 TypeScript');
        console.log('3. 按 F5 啟動除錯模式測試擴充功能');
    } else {
        console.log('\n⚠️  部分清理任務失敗，請手動檢查並完成剩餘工作');
    }
}

// 執行清理
main();
