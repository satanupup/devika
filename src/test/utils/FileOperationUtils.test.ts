import * as vscode from 'vscode';
import { FileOperationUtils, FileInfo } from '../../utils/FileOperationUtils';

// Mock vscode module
jest.mock('vscode', () => ({
    workspace: {
        fs: {
            stat: jest.fn(),
            readFile: jest.fn(),
            writeFile: jest.fn(),
            copy: jest.fn(),
            rename: jest.fn(),
            delete: jest.fn(),
            createDirectory: jest.fn(),
            readDirectory: jest.fn()
        },
        asRelativePath: jest.fn(),
        findFiles: jest.fn()
    },
    Uri: {
        file: jest.fn(),
        joinPath: jest.fn()
    },
    FileType: {
        Directory: 2,
        File: 1
    }
}));

describe('FileOperationUtils', () => {
    const mockUri = { fsPath: '/test/file.txt' } as vscode.Uri;
    const mockFs = vscode.workspace.fs as jest.Mocked<typeof vscode.workspace.fs>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('exists', () => {
        it('should return true when file exists', async () => {
            mockFs.stat.mockResolvedValue({} as any);
            
            const result = await FileOperationUtils.exists(mockUri);
            
            expect(result).toBe(true);
            expect(mockFs.stat).toHaveBeenCalledWith(mockUri);
        });

        it('should return false when file does not exist', async () => {
            mockFs.stat.mockRejectedValue(new Error('File not found'));
            
            const result = await FileOperationUtils.exists(mockUri);
            
            expect(result).toBe(false);
        });
    });

    describe('getFileInfo', () => {
        it('should return file info for existing file', async () => {
            const mockStat = {
                size: 1024,
                mtime: 1640995200000,
                type: vscode.FileType.File
            };
            mockFs.stat.mockResolvedValue(mockStat as any);
            (vscode.workspace.asRelativePath as jest.Mock).mockReturnValue('file.txt');
            
            const result = await FileOperationUtils.getFileInfo(mockUri);
            
            expect(result).toEqual({
                uri: mockUri,
                relativePath: 'file.txt',
                size: 1024,
                lastModified: new Date(1640995200000),
                type: 'file',
                exists: true
            });
        });

        it('should return null for non-existing file', async () => {
            mockFs.stat.mockRejectedValue(new Error('File not found'));
            
            const result = await FileOperationUtils.getFileInfo(mockUri);
            
            expect(result).toBeNull();
        });

        it('should handle directory type', async () => {
            const mockStat = {
                size: 0,
                mtime: 1640995200000,
                type: vscode.FileType.Directory
            };
            mockFs.stat.mockResolvedValue(mockStat as any);
            (vscode.workspace.asRelativePath as jest.Mock).mockReturnValue('folder');
            
            const result = await FileOperationUtils.getFileInfo(mockUri);
            
            expect(result?.type).toBe('directory');
        });
    });

    describe('readFile', () => {
        it('should read file content successfully', async () => {
            const content = 'test content';
            mockFs.readFile.mockResolvedValue(Buffer.from(content));
            
            const result = await FileOperationUtils.readFile(mockUri);
            
            expect(result).toBe(content);
            expect(mockFs.readFile).toHaveBeenCalledWith(mockUri);
        });

        it('should return null on read error', async () => {
            mockFs.readFile.mockRejectedValue(new Error('Read failed'));
            
            const result = await FileOperationUtils.readFile(mockUri);
            
            expect(result).toBeNull();
        });

        it('should handle different encodings', async () => {
            const content = 'test content';
            mockFs.readFile.mockResolvedValue(Buffer.from(content));
            
            const result = await FileOperationUtils.readFile(mockUri, 'ascii');
            
            expect(result).toBe(content);
        });
    });

    describe('writeFile', () => {
        it('should write file successfully', async () => {
            mockFs.writeFile.mockResolvedValue();
            
            const result = await FileOperationUtils.writeFile(mockUri, 'test content');
            
            expect(result).toBe(true);
            expect(mockFs.writeFile).toHaveBeenCalledWith(
                mockUri,
                Buffer.from('test content', 'utf8')
            );
        });

        it('should return false on write error', async () => {
            mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
            
            const result = await FileOperationUtils.writeFile(mockUri, 'test content');
            
            expect(result).toBe(false);
        });

        it('should handle overwrite option', async () => {
            // Mock file exists
            mockFs.stat.mockResolvedValue({} as any);
            mockFs.writeFile.mockResolvedValue();
            
            const result = await FileOperationUtils.writeFile(
                mockUri,
                'test content',
                { overwrite: true }
            );
            
            expect(result).toBe(true);
        });

        it('should fail when file exists and overwrite is false', async () => {
            // Mock file exists
            mockFs.stat.mockResolvedValue({} as any);
            
            const result = await FileOperationUtils.writeFile(
                mockUri,
                'test content',
                { overwrite: false }
            );
            
            expect(result).toBe(false);
        });
    });

    describe('copyFile', () => {
        it('should copy file successfully', async () => {
            const targetUri = { fsPath: '/test/target.txt' } as vscode.Uri;
            mockFs.copy.mockResolvedValue();
            
            const result = await FileOperationUtils.copyFile(mockUri, targetUri);
            
            expect(result).toBe(true);
            expect(mockFs.copy).toHaveBeenCalledWith(mockUri, targetUri, { overwrite: false });
        });

        it('should return false on copy error', async () => {
            const targetUri = { fsPath: '/test/target.txt' } as vscode.Uri;
            mockFs.copy.mockRejectedValue(new Error('Copy failed'));
            
            const result = await FileOperationUtils.copyFile(mockUri, targetUri);
            
            expect(result).toBe(false);
        });
    });

    describe('moveFile', () => {
        it('should move file successfully', async () => {
            const targetUri = { fsPath: '/test/target.txt' } as vscode.Uri;
            mockFs.rename.mockResolvedValue();
            
            const result = await FileOperationUtils.moveFile(mockUri, targetUri);
            
            expect(result).toBe(true);
            expect(mockFs.rename).toHaveBeenCalledWith(mockUri, targetUri);
        });

        it('should return false on move error', async () => {
            const targetUri = { fsPath: '/test/target.txt' } as vscode.Uri;
            mockFs.rename.mockRejectedValue(new Error('Move failed'));
            
            const result = await FileOperationUtils.moveFile(mockUri, targetUri);
            
            expect(result).toBe(false);
        });
    });

    describe('deleteFile', () => {
        it('should delete file successfully', async () => {
            mockFs.delete.mockResolvedValue();
            
            const result = await FileOperationUtils.deleteFile(mockUri);
            
            expect(result).toBe(true);
            expect(mockFs.delete).toHaveBeenCalledWith(mockUri, { recursive: false, useTrash: false });
        });

        it('should return false on delete error', async () => {
            mockFs.delete.mockRejectedValue(new Error('Delete failed'));
            
            const result = await FileOperationUtils.deleteFile(mockUri);
            
            expect(result).toBe(false);
        });

        it('should handle ignoreIfNotExists option', async () => {
            // Mock file doesn't exist
            mockFs.stat.mockRejectedValue(new Error('File not found'));
            
            const result = await FileOperationUtils.deleteFile(mockUri, { ignoreIfNotExists: true });
            
            expect(result).toBe(true);
        });
    });

    describe('batchFileOperation', () => {
        it('should process all files successfully', async () => {
            const files = [mockUri, mockUri, mockUri];
            const operation = jest.fn().mockResolvedValue('processed');
            
            const result = await FileOperationUtils.batchFileOperation(files, operation);
            
            expect(result.success).toBe(true);
            expect(result.results).toEqual(['processed', 'processed', 'processed']);
            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);
        });

        it('should handle partial failures', async () => {
            const files = [mockUri, mockUri, mockUri];
            const operation = jest.fn()
                .mockResolvedValueOnce('success1')
                .mockRejectedValueOnce(new Error('failed'))
                .mockResolvedValueOnce('success2');
            
            const result = await FileOperationUtils.batchFileOperation(
                files,
                operation,
                { continueOnError: true }
            );
            
            expect(result.success).toBe(false);
            expect(result.results).toEqual(['success1', 'success2']);
            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(1);
        });

        it('should call progress callback', async () => {
            const files = [mockUri, mockUri];
            const operation = jest.fn().mockResolvedValue('processed');
            const progressCallback = jest.fn();
            
            await FileOperationUtils.batchFileOperation(
                files,
                operation,
                { progressCallback }
            );
            
            expect(progressCallback).toHaveBeenCalledTimes(2);
            expect(progressCallback).toHaveBeenCalledWith(0, 2, mockUri.fsPath);
            expect(progressCallback).toHaveBeenCalledWith(1, 2, mockUri.fsPath);
        });
    });

    describe('findFiles', () => {
        it('should find files with pattern', async () => {
            const mockFiles = [mockUri];
            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue(mockFiles);
            
            const result = await FileOperationUtils.findFiles('**/*.ts');
            
            expect(result).toEqual(mockFiles);
            expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
                '**/*.ts',
                undefined,
                undefined
            );
        });

        it('should handle search options', async () => {
            const mockFiles = [mockUri];
            (vscode.workspace.findFiles as jest.Mock).mockResolvedValue(mockFiles);
            
            const result = await FileOperationUtils.findFiles('**/*.ts', {
                exclude: '**/node_modules/**',
                maxResults: 100
            });
            
            expect(result).toEqual(mockFiles);
            expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
                '**/*.ts',
                '**/node_modules/**',
                100
            );
        });

        it('should return empty array on error', async () => {
            (vscode.workspace.findFiles as jest.Mock).mockRejectedValue(new Error('Search failed'));
            
            const result = await FileOperationUtils.findFiles('**/*.ts');
            
            expect(result).toEqual([]);
        });
    });

    describe('edge cases', () => {
        it('should handle empty file paths', async () => {
            const emptyUri = { fsPath: '' } as vscode.Uri;
            
            const result = await FileOperationUtils.exists(emptyUri);
            
            expect(result).toBe(false);
        });

        it('should handle very large files', async () => {
            const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
            mockFs.readFile.mockResolvedValue(Buffer.from(largeContent));
            
            const result = await FileOperationUtils.readFile(mockUri);
            
            expect(result).toBe(largeContent);
        });

        it('should handle special characters in file paths', async () => {
            const specialUri = { fsPath: '/test/file with spaces & symbols!.txt' } as vscode.Uri;
            mockFs.stat.mockResolvedValue({} as any);
            
            const result = await FileOperationUtils.exists(specialUri);
            
            expect(result).toBe(true);
        });
    });
});
