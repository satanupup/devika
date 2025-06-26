"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_PLATFORMS = exports.VERSION = void 0;
// 核心介面
__exportStar(require("./interfaces/IFileSystem"), exports);
__exportStar(require("./interfaces/IUserInterface"), exports);
__exportStar(require("./interfaces/IProjectContext"), exports);
// LLM 服務
__exportStar(require("./llm/LLMService"), exports);
__exportStar(require("./llm/types"), exports);
// 核心服務 (待實作)
// export * from './context/CodeAnalyzer';
// export * from './tasks/TaskEngine';
// export * from './git/GitAnalyzer';
// export * from './plugins/PluginEngine';
// 配置
// export * from './config/CoreConfig';
// 工具函式
// export * from './utils/index';
/**
 * Devika Core 版本
 */
exports.VERSION = '0.1.0';
/**
 * 支援的平台
 */
exports.SUPPORTED_PLATFORMS = [
    'vscode',
    'jetbrains',
    'vim',
    'emacs',
    'cli'
];
//# sourceMappingURL=index.js.map