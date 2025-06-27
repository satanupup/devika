import * as path from 'path';
import Mocha from 'mocha';
import * as glob from 'glob';

export async function run(): Promise<void> {
    // 建立 Mocha 測試實例
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname, '..');

    try {
        // 使用同步版本的 glob
        const files = glob.sync('**/**.test.js', { cwd: testsRoot });

        // 新增檔案到測試套件
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        // 執行 Mocha 測試
        return new Promise<void>((resolve, reject) => {
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error(err);
        throw new Error(`Test discovery failed: ${err}`);
    }
}
