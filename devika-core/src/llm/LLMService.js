"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const ClaudeProvider_1 = require("./providers/ClaudeProvider");
const OpenAIProvider_1 = require("./providers/OpenAIProvider");
const GeminiProvider_1 = require("./providers/GeminiProvider");
const types_1 = require("./types");
/**
 * LLM 服務核心類別
 * 提供統一的 AI 模型介面，支援多個提供商
 */
class LLMService {
    constructor(config) {
        this.providers = new Map();
        this.tokenUsage = {
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalCost: 0
        };
        this.config = config;
        this.initializeProviders();
    }
    /**
     * 初始化所有 LLM 提供商
     */
    initializeProviders() {
        // Claude (Anthropic)
        if (this.config.claude?.apiKey) {
            this.providers.set('claude', new ClaudeProvider_1.ClaudeProvider(this.config.claude));
        }
        // OpenAI
        if (this.config.openai?.apiKey) {
            this.providers.set('openai', new OpenAIProvider_1.OpenAIProvider(this.config.openai));
        }
        // Gemini (Google)
        if (this.config.gemini?.apiKey) {
            this.providers.set('gemini', new GeminiProvider_1.GeminiProvider(this.config.gemini));
        }
    }
    /**
     * 生成文字完成
     * @param prompt 提示文字
     * @param options 生成選項
     * @returns 生成的回應
     */
    async generateCompletion(prompt, options) {
        const provider = this.getProvider(options?.provider);
        try {
            const response = await provider.generateCompletion(prompt, {
                model: options?.model,
                maxTokens: options?.maxTokens || this.config.defaultMaxTokens || 4000,
                temperature: options?.temperature || this.config.defaultTemperature || 0.7,
                systemPrompt: options?.systemPrompt
            });
            // 更新 token 使用統計
            this.updateTokenUsage(response.usage);
            return response.content;
        }
        catch (error) {
            throw new types_1.LLMError(`LLM 生成失敗: ${error}`, options?.provider || this.config.defaultProvider, error);
        }
    }
    /**
     * 生成結構化回應
     * @param prompt 提示文字
     * @param schema JSON Schema 定義
     * @param options 生成選項
     * @returns 結構化的回應物件
     */
    async generateStructuredResponse(prompt, schema, options) {
        const provider = this.getProvider(options?.provider);
        if (!provider.supportsStructuredOutput) {
            // 如果提供商不支援結構化輸出，使用 JSON 模式
            const jsonPrompt = `${prompt}\n\n請以 JSON 格式回應，遵循以下 schema:\n${JSON.stringify(schema, null, 2)}`;
            const response = await this.generateCompletion(jsonPrompt, options);
            try {
                return JSON.parse(response);
            }
            catch (error) {
                throw new types_1.LLMError(`無法解析 JSON 回應: ${error}`, options?.provider || this.config.defaultProvider, error);
            }
        }
        try {
            const response = await provider.generateStructuredResponse(prompt, schema, {
                model: options?.model,
                maxTokens: options?.maxTokens || this.config.defaultMaxTokens || 4000,
                temperature: options?.temperature || this.config.defaultTemperature || 0.7
            });
            this.updateTokenUsage(response.usage);
            return response.content;
        }
        catch (error) {
            throw new types_1.LLMError(`結構化生成失敗: ${error}`, options?.provider || this.config.defaultProvider, error);
        }
    }
    /**
     * 分析程式碼
     * @param code 程式碼內容
     * @param language 程式語言
     * @param analysisType 分析類型
     * @returns 分析結果
     */
    async analyzeCode(code, language, analysisType = 'review') {
        const systemPrompt = this.getCodeAnalysisPrompt(analysisType, language);
        return await this.generateCompletion(code, {
            systemPrompt,
            provider: this.config.codeAnalysisProvider || this.config.defaultProvider
        });
    }
    /**
     * 生成 Git commit 訊息
     * @param diff Git diff 內容
     * @param options 生成選項
     * @returns commit 訊息
     */
    async generateCommitMessage(diff, options) {
        const systemPrompt = this.getCommitMessagePrompt(options);
        return await this.generateCompletion(diff, {
            systemPrompt,
            maxTokens: 200,
            temperature: 0.3
        });
    }
    /**
     * 取得可用的提供商列表
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    /**
     * 取得指定提供商的模型列表
     */
    getAvailableModels(provider) {
        const llmProvider = this.providers.get(provider);
        return llmProvider ? llmProvider.getAvailableModels() : [];
    }
    /**
     * 取得 token 使用統計
     */
    getTokenUsage() {
        return { ...this.tokenUsage };
    }
    /**
     * 重設 token 使用統計
     */
    resetTokenUsage() {
        this.tokenUsage = {
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalCost: 0
        };
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.initializeProviders();
    }
    /**
     * 取得指定的提供商
     */
    getProvider(providerName) {
        const name = providerName || this.config.defaultProvider;
        const provider = this.providers.get(name);
        if (!provider) {
            throw new types_1.LLMError(`找不到 LLM 提供商: ${name}`, name);
        }
        return provider;
    }
    /**
     * 更新 token 使用統計
     */
    updateTokenUsage(usage) {
        this.tokenUsage.totalTokens += usage.totalTokens;
        this.tokenUsage.promptTokens += usage.promptTokens;
        this.tokenUsage.completionTokens += usage.completionTokens;
        this.tokenUsage.totalCost += usage.totalCost;
    }
    /**
     * 取得程式碼分析的系統提示
     */
    getCodeAnalysisPrompt(analysisType, language) {
        const prompts = {
            review: `你是一位資深的 ${language} 開發者。請仔細審查以下程式碼，提供建設性的回饋，包括：
1. 程式碼品質評估
2. 潛在的問題或錯誤
3. 改進建議
4. 最佳實務建議`,
            explain: `你是一位經驗豐富的程式設計導師。請詳細解釋以下 ${language} 程式碼：
1. 程式碼的功能和目的
2. 關鍵邏輯的運作方式
3. 使用的設計模式或技術
4. 程式碼的優缺點`,
            optimize: `你是一位效能優化專家。請分析以下 ${language} 程式碼並提供優化建議：
1. 效能瓶頸分析
2. 記憶體使用優化
3. 演算法改進建議
4. 重構建議`,
            debug: `你是一位除錯專家。請幫助分析以下 ${language} 程式碼中的潛在問題：
1. 語法錯誤檢查
2. 邏輯錯誤分析
3. 執行時錯誤預測
4. 修復建議`
        };
        return prompts[analysisType] || prompts.review;
    }
    /**
     * 取得 commit 訊息生成的系統提示
     */
    getCommitMessagePrompt(options) {
        const isConventional = options?.conventional ?? true;
        const language = options?.language ?? 'zh';
        if (language === 'en') {
            return isConventional
                ? `Generate a concise Git commit message following Conventional Commits format (type(scope): description). 
                   Types: feat, fix, docs, style, refactor, test, chore. Keep it under 50 characters.`
                : `Generate a concise Git commit message describing the changes. Keep it under 50 characters.`;
        }
        else {
            return isConventional
                ? `根據 Conventional Commits 格式生成簡潔的 Git commit 訊息 (類型(範圍): 描述)。
                   類型包括: feat, fix, docs, style, refactor, test, chore。保持在 50 字元以內。`
                : `生成簡潔的 Git commit 訊息描述變更內容。保持在 50 字元以內。`;
        }
    }
}
exports.LLMService = LLMService;
//# sourceMappingURL=LLMService.js.map