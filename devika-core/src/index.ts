// 核心介面
export * from './interfaces/IFileSystem';
export * from './interfaces/IUserInterface';
export * from './interfaces/IProjectContext';

// LLM 服務
export * from './llm/LLMService';
export * from './llm/types';

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
export const VERSION = '0.1.0';

/**
 * 支援的平台
 */
export const SUPPORTED_PLATFORMS = [
    'vscode',
    'jetbrains',
    'vim',
    'emacs',
    'cli'
] as const;

export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];
