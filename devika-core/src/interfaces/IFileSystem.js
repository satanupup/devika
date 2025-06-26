"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemErrorCodes = exports.FileSystemError = void 0;
/**
 * 檔案系統錯誤
 */
class FileSystemError extends Error {
    constructor(message, code, path) {
        super(message);
        this.code = code;
        this.path = path;
        this.name = 'FileSystemError';
    }
}
exports.FileSystemError = FileSystemError;
/**
 * 常見的檔案系統錯誤代碼
 */
exports.FileSystemErrorCodes = {
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    DIRECTORY_NOT_EMPTY: 'DIRECTORY_NOT_EMPTY',
    INVALID_PATH: 'INVALID_PATH',
    DISK_FULL: 'DISK_FULL'
};
//# sourceMappingURL=IFileSystem.js.map