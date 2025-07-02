#!/usr/bin/env node

/**
 * Git LFS 問題修復腳本
 * 將 LFS 追蹤的文件遷移回普通 Git 追蹤
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 開始修復 Git LFS 問題...\n');

function executeCommand(command, description) {
    try {
        console.log(`📋 ${description}`);
        console.log(`   執行: ${command}`);
        const result = execSync(command, { encoding: 'utf8', cwd: __dirname });
        if (result.trim()) {
            console.log(`   結果: ${result.trim()}`);
        }
        console.log('   ✅ 完成\n');
        return result;
    } catch (error) {
        console.log(`   ❌ 失敗: ${error.message}\n`);
        return null;
    }
}

function main() {
    console.log('🎯 修復步驟:\n');
    
    // 1. 檢查當前 LFS 狀態
    console.log('1️⃣ 檢查當前 LFS 追蹤的文件');
    const lfsFiles = executeCommand('git lfs ls-files', '列出 LFS 文件');
    
    if (!lfsFiles || lfsFiles.trim() === '') {
        console.log('✅ 沒有 LFS 文件需要處理');
        return;
    }
    
    // 2. 停止追蹤 TypeScript 和 JavaScript 文件
    console.log('2️⃣ 停止 LFS 追蹤 TypeScript 和 JavaScript 文件');
    executeCommand('git lfs untrack "*.ts"', '停止追蹤 .ts 文件');
    executeCommand('git lfs untrack "*.js"', '停止追蹤 .js 文件');
    
    // 3. 將 LFS 文件遷移回普通 Git
    console.log('3️⃣ 遷移 LFS 文件到普通 Git');
    
    // 獲取所有 LFS 文件列表
    const lfsFileList = lfsFiles.split('\n').filter(line => line.trim());
    
    for (const line of lfsFileList) {
        if (line.trim()) {
            // 提取文件路徑 (格式: "hash * filepath")
            const parts = line.split(' * ');
            if (parts.length >= 2) {
                const filePath = parts[1].trim();
                console.log(`   處理文件: ${filePath}`);
                
                // 將文件從 LFS 遷移到普通 Git
                executeCommand(`git add "${filePath}"`, `添加 ${filePath} 到普通 Git`);
            }
        }
    }
    
    // 4. 提交 .gitattributes 的變更
    console.log('4️⃣ 提交 .gitattributes 變更');
    executeCommand('git add .gitattributes', '添加 .gitattributes 變更');
    
    // 5. 創建提交
    console.log('5️⃣ 創建提交');
    executeCommand('git commit -m "fix: 移除 Git LFS 追蹤，改為普通 Git 追蹤\n\n- 移除 .ts 和 .js 文件的 LFS 追蹤\n- 將所有文件遷移回普通 Git\n- 修復 fork 倉庫的 LFS 權限問題"', '提交變更');
    
    // 6. 檢查結果
    console.log('6️⃣ 檢查修復結果');
    const remainingLfsFiles = executeCommand('git lfs ls-files', '檢查剩餘的 LFS 文件');
    
    if (!remainingLfsFiles || remainingLfsFiles.trim() === '') {
        console.log('✅ 所有文件已成功遷移出 LFS');
    } else {
        console.log('⚠️  仍有文件在 LFS 中:');
        console.log(remainingLfsFiles);
    }
    
    // 7. 顯示推送指令
    console.log('7️⃣ 下一步操作');
    console.log('現在您可以安全地推送到 GitHub:');
    console.log('   git push origin main');
    console.log('');
    console.log('如果仍有問題，可以嘗試:');
    console.log('   git push --force origin main  # 強制推送 (謹慎使用)');
    
    console.log('\n🎉 Git LFS 問題修復完成！');
    console.log('');
    console.log('📋 修復摘要:');
    console.log('   - 已移除 .ts 和 .js 文件的 LFS 追蹤');
    console.log('   - 已將所有文件遷移回普通 Git');
    console.log('   - 已更新 .gitattributes 文件');
    console.log('   - 已創建修復提交');
    console.log('');
    console.log('💡 建議:');
    console.log('   - 對於大型二進制文件 (如圖片、視頻)，可以考慮使用 LFS');
    console.log('   - 對於源代碼文件，建議使用普通 Git 追蹤');
    console.log('   - 如果需要使用 LFS，建議創建自己的倉庫而不是 fork');
}

// 執行修復
if (require.main === module) {
    main();
}

module.exports = { main };
