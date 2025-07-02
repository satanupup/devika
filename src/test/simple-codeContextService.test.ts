/**
 * 簡單的 CodeContextService 測試
 * 不依賴複雜的測試設置，直接測試文件過濾邏輯
 */

import * as vscode from 'vscode';

// 模擬 VS Code URI
function createMockUri(fsPath: string): vscode.Uri {
    return {
        scheme: 'file',
        authority: '',
        path: fsPath,
        query: '',
        fragment: '',
        fsPath: fsPath,
        with: () => createMockUri(fsPath),
        toJSON: () => ({ scheme: 'file', path: fsPath })
    } as vscode.Uri;
}

// 從 CodeContextService 中提取的過濾邏輯
function shouldIndexFile(uri: vscode.Uri): boolean {
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
        '.DS_Store',
        'Thumbs.db',
        'desktop.ini',
        '.git/',
        'node_modules/',
        '.vscode/',
        'dist/',
        'build/',
        'out/',
        '.nyc_output/',
        'coverage/'
    ];
    
    return !excludePatterns.some(pattern => 
        filePath.includes(pattern) || fileName === pattern
    );
}

function isTextFile(uri: vscode.Uri): boolean {
    const ext = uri.path.split('.').pop()?.toLowerCase() || '';
    const textExtensions = [
        'ts', 'js', 'tsx', 'jsx', 'py', 'java', 'kt', 'swift', 
        'cpp', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'dart',
        'html', 'css', 'scss', 'less', 'json', 'xml', 'yaml', 'yml',
        'md', 'txt', 'sql', 'sh', 'bat', 'ps1', 'vue', 'svelte'
    ];
    return textExtensions.includes(ext);
}

// 測試用例
console.log('開始測試 macOS 元數據文件過濾...');

// 測試 macOS 元數據文件
const macosFiles = [
    '/test/path/._SomeFile.kt',
    '/test/path/__MACOSX/file.txt',
    '/test/path/.DS_Store',
    '/test/path/._Stocking_311.kt',
    '/test/path/__MACOSX/rfid_stocking_app/app/src/main/java/com/cginfortech/rfid_stocking/._WriteMain.kt'
];

console.log('\n測試 macOS 元數據文件（應該被過濾）:');
macosFiles.forEach(filePath => {
    const uri = createMockUri(filePath);
    const shouldIndex = shouldIndexFile(uri);
    console.log(`${filePath}: ${shouldIndex ? '❌ 未被過濾' : '✅ 已過濾'}`);
});

// 測試有效文件
const validFiles = [
    '/test/path/SomeFile.kt',
    '/test/path/script.ts',
    '/test/path/component.vue',
    '/test/path/MainActivity.java',
    '/test/path/styles.css'
];

console.log('\n測試有效文件（應該被索引）:');
validFiles.forEach(filePath => {
    const uri = createMockUri(filePath);
    const shouldIndex = shouldIndexFile(uri);
    const isText = isTextFile(uri);
    console.log(`${filePath}: ${shouldIndex && isText ? '✅ 應該索引' : '❌ 不應該索引'}`);
});

// 測試二進制文件
const binaryFiles = [
    '/test/file.exe',
    '/test/file.bin',
    '/test/file.dll',
    '/test/image.png',
    '/test/document.pdf'
];

console.log('\n測試二進制文件（應該被排除）:');
binaryFiles.forEach(filePath => {
    const uri = createMockUri(filePath);
    const isText = isTextFile(uri);
    console.log(`${filePath}: ${isText ? '❌ 被識別為文本' : '✅ 被識別為二進制'}`);
});

console.log('\n測試完成！');

// 驗證主要問題是否解決
const problematicFile = '/d/emmt/gp_stocking/rfid_stocking_app_v1.0.0.0_20230822/__MACOSX/rfid_stocking_app/app/src/main/java/com/cginfortech/rfid_stocking/._Stocking_311.kt';
const uri = createMockUri(problematicFile);
const shouldIndex = shouldIndexFile(uri);

console.log(`\n🎯 原始問題文件測試:`);
console.log(`文件: ${problematicFile}`);
console.log(`結果: ${shouldIndex ? '❌ 仍會被處理（問題未解決）' : '✅ 已被過濾（問題已解決）'}`);
