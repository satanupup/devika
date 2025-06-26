/**
 * LLM 配置介面
 */
export interface LLMConfig {
    /** 預設提供商 */
    defaultProvider: string;
    /** 預設最大 token 數 */
    defaultMaxTokens?: number;
    /** 預設溫度 */
    defaultTemperature?: number;
    /** 程式碼分析專用提供商 */
    codeAnalysisProvider?: string;
    
    /** Claude 配置 */
    claude?: ClaudeConfig;
    /** OpenAI 配置 */
    openai?: OpenAIConfig;
    /** Gemini 配置 */
    gemini?: GeminiConfig;
}

/**
 * Claude 配置
 */
export interface ClaudeConfig {
    /** API 金鑰 */
    apiKey: string;
    /** 預設模型 */
    defaultModel?: string;
    /** API 基礎 URL */
    baseUrl?: string;
    /** 請求超時時間 (毫秒) */
    timeout?: number;
}

/**
 * OpenAI 配置
 */
export interface OpenAIConfig {
    /** API 金鑰 */
    apiKey: string;
    /** 預設模型 */
    defaultModel?: string;
    /** 組織 ID */
    organization?: string;
    /** API 基礎 URL */
    baseUrl?: string;
    /** 請求超時時間 (毫秒) */
    timeout?: number;
}

/**
 * Gemini 配置
 */
export interface GeminiConfig {
    /** API 金鑰 */
    apiKey: string;
    /** 預設模型 */
    defaultModel?: string;
    /** API 基礎 URL */
    baseUrl?: string;
    /** 請求超時時間 (毫秒) */
    timeout?: number;
}

/**
 * LLM 回應
 */
export interface LLMResponse<T = string> {
    /** 回應內容 */
    content: T;
    /** Token 使用統計 */
    usage: TokenUsage;
    /** 模型名稱 */
    model: string;
    /** 提供商名稱 */
    provider: string;
    /** 回應時間 (毫秒) */
    responseTime: number;
}

/**
 * Token 使用統計
 */
export interface TokenUsage {
    /** 總 token 數 */
    totalTokens: number;
    /** 提示 token 數 */
    promptTokens: number;
    /** 完成 token 數 */
    completionTokens: number;
    /** 總成本 (USD) */
    totalCost: number;
}

/**
 * 生成選項
 */
export interface GenerationOptions {
    /** 模型名稱 */
    model?: string;
    /** 最大 token 數 */
    maxTokens?: number;
    /** 溫度 (0-1) */
    temperature?: number;
    /** 系統提示 */
    systemPrompt?: string;
    /** 停止序列 */
    stopSequences?: string[];
    /** Top-p 採樣 */
    topP?: number;
    /** 頻率懲罰 */
    frequencyPenalty?: number;
    /** 存在懲罰 */
    presencePenalty?: number;
}

/**
 * 結構化生成選項
 */
export interface StructuredGenerationOptions extends Omit<GenerationOptions, 'systemPrompt'> {
    /** 是否嚴格遵循 schema */
    strict?: boolean;
}

/**
 * LLM 錯誤
 */
export class LLMError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly originalError?: Error,
        public readonly errorCode?: string
    ) {
        super(message);
        this.name = 'LLMError';
    }
}

/**
 * 模型資訊
 */
export interface ModelInfo {
    /** 模型 ID */
    id: string;
    /** 顯示名稱 */
    name: string;
    /** 描述 */
    description?: string;
    /** 最大 token 數 */
    maxTokens: number;
    /** 每 1K token 的成本 (USD) */
    costPer1KTokens: {
        input: number;
        output: number;
    };
    /** 支援的功能 */
    capabilities: ModelCapabilities;
}

/**
 * 模型能力
 */
export interface ModelCapabilities {
    /** 是否支援函式呼叫 */
    functionCalling: boolean;
    /** 是否支援結構化輸出 */
    structuredOutput: boolean;
    /** 是否支援視覺輸入 */
    vision: boolean;
    /** 是否支援程式碼生成 */
    codeGeneration: boolean;
    /** 支援的語言列表 */
    languages: string[];
}

/**
 * 聊天訊息
 */
export interface ChatMessage {
    /** 角色 */
    role: 'system' | 'user' | 'assistant';
    /** 內容 */
    content: string;
    /** 時間戳 */
    timestamp?: Date;
}

/**
 * 聊天會話
 */
export interface ChatSession {
    /** 會話 ID */
    id: string;
    /** 訊息列表 */
    messages: ChatMessage[];
    /** 會話標題 */
    title?: string;
    /** 建立時間 */
    createdAt: Date;
    /** 最後更新時間 */
    updatedAt: Date;
}

/**
 * 程式碼分析結果
 */
export interface CodeAnalysisResult {
    /** 分析類型 */
    type: 'review' | 'explain' | 'optimize' | 'debug';
    /** 分析結果 */
    analysis: string;
    /** 建議列表 */
    suggestions: CodeSuggestion[];
    /** 問題列表 */
    issues: CodeIssue[];
    /** 評分 (1-10) */
    score?: number;
}

/**
 * 程式碼建議
 */
export interface CodeSuggestion {
    /** 建議類型 */
    type: 'improvement' | 'optimization' | 'refactoring' | 'best-practice';
    /** 建議描述 */
    description: string;
    /** 原始程式碼 */
    originalCode?: string;
    /** 建議的程式碼 */
    suggestedCode?: string;
    /** 優先級 */
    priority: 'low' | 'medium' | 'high';
}

/**
 * 程式碼問題
 */
export interface CodeIssue {
    /** 問題類型 */
    type: 'error' | 'warning' | 'info';
    /** 問題描述 */
    description: string;
    /** 行號 */
    line?: number;
    /** 列號 */
    column?: number;
    /** 嚴重程度 */
    severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 提示模板
 */
export interface PromptTemplate {
    /** 模板 ID */
    id: string;
    /** 模板名稱 */
    name: string;
    /** 模板內容 */
    template: string;
    /** 變數列表 */
    variables: string[];
    /** 分類 */
    category: string;
    /** 描述 */
    description?: string;
}

/**
 * 批次處理請求
 */
export interface BatchRequest {
    /** 請求 ID */
    id: string;
    /** 提示文字 */
    prompt: string;
    /** 生成選項 */
    options?: GenerationOptions;
}

/**
 * 批次處理回應
 */
export interface BatchResponse {
    /** 請求 ID */
    id: string;
    /** 回應內容 */
    content: string;
    /** 是否成功 */
    success: boolean;
    /** 錯誤訊息 */
    error?: string;
    /** Token 使用統計 */
    usage?: TokenUsage;
}
