import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodeContextService } from '../context/CodeContextService';

suite('CodeContextService Tests', () => {
    let codeContextService: CodeContextService;

    setup(() => {
        codeContextService = new CodeContextService();
    });

    test('應該過濾 macOS 元數據文件', () => {
        const macosFiles = [
            vscode.Uri.file('/test/path/._SomeFile.kt'),
            vscode.Uri.file('/test/path/__MACOSX/file.txt'),
            vscode.Uri.file('/test/path/.DS_Store'),
        ];

        macosFiles.forEach(uri => {
            // 使用反射來訪問私有方法進行測試
            const shouldIndex = (codeContextService as any).shouldIndexFile(uri);
            assert.strictEqual(shouldIndex, false, `應該過濾文件: ${uri.fsPath}`);
        });
    });

    test('應該允許有效的文本文件', () => {
        const validFiles = [
            vscode.Uri.file('/test/path/SomeFile.kt'),
            vscode.Uri.file('/test/path/script.ts'),
            vscode.Uri.file('/test/path/component.vue'),
        ];

        validFiles.forEach(uri => {
            const shouldIndex = (codeContextService as any).shouldIndexFile(uri);
            assert.strictEqual(shouldIndex, true, `應該索引文件: ${uri.fsPath}`);
        });
    });

    test('應該識別文本文件擴展名', () => {
        const textFiles = [
            vscode.Uri.file('/test/file.ts'),
            vscode.Uri.file('/test/file.js'),
            vscode.Uri.file('/test/file.kt'),
            vscode.Uri.file('/test/file.py'),
        ];

        textFiles.forEach(uri => {
            const isText = (codeContextService as any).isTextFile(uri);
            assert.strictEqual(isText, true, `應該識別為文本文件: ${uri.fsPath}`);
        });
    });

    test('應該排除二進制文件擴展名', () => {
        const binaryFiles = [
            vscode.Uri.file('/test/file.exe'),
            vscode.Uri.file('/test/file.bin'),
            vscode.Uri.file('/test/file.dll'),
        ];

        binaryFiles.forEach(uri => {
            const isText = (codeContextService as any).isTextFile(uri);
            assert.strictEqual(isText, false, `應該識別為二進制文件: ${uri.fsPath}`);
        });
    });
});
