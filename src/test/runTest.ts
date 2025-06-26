import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // 擴充功能開發資料夾的路徑
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // 測試套件的路徑
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // 下載 VS Code，解壓縮並執行整合測試
        await runTests({ extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('測試執行失敗');
        process.exit(1);
    }
}

main();
