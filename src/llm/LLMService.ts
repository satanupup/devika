import axios from 'axios';
import { ConfigManager } from '../config/ConfigManager';
import { ErrorHandler, DevikaError, ErrorType, ErrorSeverity } from '../utils/ErrorHandler';
import { Logger, LogLevel } from '../utils/Logger';

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
    finishReason?: string;
}

export interface LLMOptions {
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    retries?: number;
}

export class LLMService {
    private configManager: ConfigManager;
    private errorHandler: ErrorHandler;
    private logger: Logger;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
        this.errorHandler = ErrorHandler.getInstance();
        this.logger = Logger.getInstance();
    }

    async generateCompletion(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
        try {
            this.logger.info('LLMService', 'Starting completion generation', {
                promptLength: prompt.length,
                options
            });

            const model = this.configManager.getPreferredModel();
            const defaultOptions: LLMOptions = {
                maxTokens: 4000,
                temperature: 0.7,
                timeout: 30000,
                retries: 3
            };
            const finalOptions = { ...defaultOptions, ...options };

            const result = await this.callWithRetry(async () => {
                switch (this.getModelProvider(model)) {
                    case 'openai':
                        return await this.callOpenAI(prompt, model, finalOptions);
                    case 'claude':
                        return await this.callClaude(prompt, model, finalOptions);
                    case 'gemini':
                        return await this.callGemini(prompt, model, finalOptions);
                    default:
                        throw new DevikaError(
                            `不支援的模型: ${model}`,
                            ErrorType.CONFIGURATION,
                            ErrorSeverity.HIGH,
                            'UNSUPPORTED_MODEL',
                            { model }
                        );
                }
            }, finalOptions.retries || 3);

            this.logger.info('LLMService', 'Completion generation successful', {
                model: result.model,
                tokensUsed: result.usage?.totalTokens
            });

            return result;
        } catch (error) {
            const devikaError = error instanceof DevikaError ? error : new DevikaError(
                `LLM 服務錯誤: ${error instanceof Error ? error.message : String(error)}`,
                ErrorType.API,
                ErrorSeverity.HIGH,
                'LLM_SERVICE_ERROR',
                { prompt: prompt.substring(0, 100), options }
            );

            this.logger.error('LLMService', 'Completion generation failed', devikaError);
            await this.errorHandler.handleError(devikaError);
            throw devikaError;
        }
    }

    private async callWithRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
        let lastError: Error | DevikaError | undefined;

        for (let i = 0; i < retries; i++) {
            try {
                this.logger.debug('LLMService', `Attempt ${i + 1}/${retries}`);
                return await fn();
            } catch (error: any) {
                lastError = error;

                // 檢查是否為不可重試的錯誤
                if (this.isNonRetryableError(error)) {
                    this.logger.warn('LLMService', 'Non-retryable error encountered', { error: error.message });
                    throw error;
                }

                // 等待後重試（指數退避）
                if (i < retries - 1) {
                    const delay = Math.pow(2, i) * 1000;
                    this.logger.debug('LLMService', `Retrying in ${delay}ms`, { attempt: i + 1, error: error.message });
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    this.logger.error('LLMService', 'All retry attempts exhausted', { attempts: retries, lastError: error.message });
                }
            }
        }

        throw lastError || new DevikaError(
            '重試失敗',
            ErrorType.API,
            ErrorSeverity.HIGH,
            'RETRY_EXHAUSTED',
            { retries }
        );
    }

    /**
     * 檢查是否為不可重試的錯誤
     */
    private isNonRetryableError(error: any): boolean {
        const message = error.message?.toLowerCase() || '';

        // API 金鑰錯誤
        if (message.includes('api key') || message.includes('api 金鑰') || message.includes('unauthorized')) {
            return true;
        }

        // 配額錯誤
        if (message.includes('quota') || message.includes('rate limit') || message.includes('billing')) {
            return true;
        }

        // 模型不存在錯誤
        if (message.includes('model not found') || message.includes('invalid model')) {
            return true;
        }

        // 請求格式錯誤
        if (message.includes('bad request') || message.includes('invalid request')) {
            return true;
        }

        return false;
    }

    private getModelProvider(model: string): string {
        if (model.startsWith('gpt-')) {
            return 'openai';
        } else if (model.startsWith('claude-')) {
            return 'claude';
        } else if (model.startsWith('gemini-')) {
            return 'gemini';
        }
        return 'unknown';
    }

    private async callOpenAI(prompt: string, model: string, options: LLMOptions): Promise<LLMResponse> {
        const apiKey = this.configManager.getOpenAIApiKey();
        if (!apiKey) {
            throw new Error('請設定 OpenAI API 金鑰');
        }

        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: '你是一個專業的程式開發助理，專精於程式碼分析、重構和測試生成。請提供準確、實用的建議。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: options.maxTokens || 4000,
                    temperature: options.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: options.timeout || 30000
                }
            );

            const choice = response.data.choices[0];
            return {
                content: choice.message.content,
                model: response.data.model,
                finishReason: choice.finish_reason,
                usage: response.data.usage ? {
                    promptTokens: response.data.usage.prompt_tokens,
                    completionTokens: response.data.usage.completion_tokens,
                    totalTokens: response.data.usage.total_tokens
                } : undefined
            };
        } catch (error: any) {
            if (error.response) {
                throw new Error(`OpenAI API 錯誤: ${error.response.data.error?.message || error.response.statusText}`);
            } else if (error.request) {
                throw new Error('無法連接到 OpenAI API');
            } else {
                throw new Error(`請求錯誤: ${error.message}`);
            }
        }
    }

    private async callClaude(prompt: string, model: string, options: LLMOptions): Promise<LLMResponse> {
        const apiKey = this.configManager.getClaudeApiKey();
        if (!apiKey) {
            throw new Error('請設定 Claude API 金鑰');
        }

        // 確保使用正確的模型名稱
        const validModel = model || 'claude-3-5-sonnet-20241022';

        try {
            console.log(`調用 Claude API，模型: ${validModel}`);

            const requestData = {
                model: validModel,
                max_tokens: options.maxTokens || 4000,
                temperature: options.temperature || 0.7,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            };

            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                requestData,
                {
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: options.timeout || 30000
                }
            );

            console.log('Claude API 響應成功');

            return {
                content: response.data.content[0].text,
                model: response.data.model,
                finishReason: response.data.stop_reason,
                usage: response.data.usage ? {
                    promptTokens: response.data.usage.input_tokens,
                    completionTokens: response.data.usage.output_tokens,
                    totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens
                } : undefined
            };
        } catch (error: any) {
            console.error('Claude API 錯誤:', error);

            if (error.response) {
                const errorMessage = error.response.data?.error?.message ||
                                   error.response.data?.message ||
                                   error.response.statusText ||
                                   '未知錯誤';
                const statusCode = error.response.status;

                console.error('Claude API 響應錯誤:', {
                    status: statusCode,
                    data: error.response.data
                });

                if (statusCode === 401) {
                    throw new Error('Claude API 金鑰無效，請檢查您的 API 金鑰');
                } else if (statusCode === 429) {
                    throw new Error('Claude API 請求頻率過高，請稍後再試');
                } else if (statusCode === 400) {
                    throw new Error(`Claude API 請求格式錯誤: ${errorMessage}`);
                } else {
                    throw new Error(`Claude API 錯誤 (${statusCode}): ${errorMessage}`);
                }
            } else if (error.request) {
                throw new Error('無法連接到 Claude API，請檢查網路連接');
            } else {
                throw new Error(`請求錯誤: ${error.message}`);
            }
        }
    }

    private async callGemini(prompt: string, model: string, options: LLMOptions): Promise<LLMResponse> {
        const apiKey = this.configManager.getGeminiApiKey();
        if (!apiKey) {
            throw new Error('請設定 Gemini API 金鑰');
        }

        try {
            // 構建請求體
            const requestBody: any = {
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],
                generationConfig: {
                    maxOutputTokens: options.maxTokens || 4000,
                    temperature: options.temperature || 0.7,
                    topP: 0.8,
                    topK: 10
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_ONLY_HIGH"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_ONLY_HIGH"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_ONLY_HIGH"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_ONLY_HIGH"
                    }
                ]
            };

            // 為支援思考的模型添加系統指令
            if (model.includes('2.5') || model.includes('2.0')) {
                requestBody.systemInstruction = {
                    parts: [
                        {
                            text: "你是一個專業的程式開發助理，專精於程式碼分析、重構和測試生成。請提供準確、實用的建議。"
                        }
                    ]
                };

                // 為 2.5 系列模型添加思考配置
                if (model.includes('2.5')) {
                    requestBody.config = {
                        thinkingConfig: {
                            thinkingBudget: -1  // 啟用動態思考
                        }
                    };
                }
            }

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: options.timeout || 30000
                }
            );

            // 檢查響應是否有效
            if (!response.data.candidates || response.data.candidates.length === 0) {
                throw new Error('Gemini API 沒有返回有效的候選回應');
            }

            const candidate = response.data.candidates[0];

            // 檢查是否被安全過濾器阻擋
            if (candidate.finishReason === 'SAFETY') {
                throw new Error('回應被 Gemini 安全過濾器阻擋，請嘗試修改您的問題');
            }

            if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                throw new Error('Gemini API 返回的內容格式無效');
            }

            return {
                content: candidate.content.parts[0].text,
                model: model,
                finishReason: candidate.finishReason,
                usage: response.data.usageMetadata ? {
                    promptTokens: response.data.usageMetadata.promptTokenCount || 0,
                    completionTokens: response.data.usageMetadata.candidatesTokenCount || 0,
                    totalTokens: response.data.usageMetadata.totalTokenCount || 0
                } : undefined
            };
        } catch (error: any) {
            if (error.response) {
                throw new Error(`Gemini API 錯誤: ${error.response.data.error?.message || error.response.statusText}`);
            } else if (error.request) {
                throw new Error('無法連接到 Gemini API');
            } else {
                throw new Error(`請求錯誤: ${error.message}`);
            }
        }
    }

    async validateApiKeys(): Promise<{ [key: string]: boolean }> {
        const results: { [key: string]: boolean } = {};

        // 測試 OpenAI
        try {
            const apiKey = this.configManager.getOpenAIApiKey();
            if (apiKey) {
                await axios.get('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    timeout: 5000
                });
                results.openai = true;
            }
        } catch {
            results.openai = false;
        }

        // 測試 Claude
        try {
            const apiKey = this.configManager.getClaudeApiKey();
            if (apiKey) {
                await axios.post(
                    'https://api.anthropic.com/v1/messages',
                    {
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 10,
                        messages: [{ role: 'user', content: 'test' }]
                    },
                    {
                        headers: {
                            'x-api-key': apiKey,
                            'Content-Type': 'application/json',
                            'anthropic-version': '2023-06-01'
                        },
                        timeout: 5000
                    }
                );
                results.claude = true;
            }
        } catch {
            results.claude = false;
        }

        // 測試 Gemini
        try {
            const apiKey = this.configManager.getGeminiApiKey();
            if (apiKey) {
                await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
                    {
                        contents: [{ parts: [{ text: 'test' }] }]
                    },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 5000
                    }
                );
                results.gemini = true;
            }
        } catch {
            results.gemini = false;
        }

        return results;
    }

    async estimateTokens(text: string): Promise<number> {
        // 簡單的 token 估算，實際應該使用 tiktoken
        return Math.ceil(text.length / 4);
    }

    async calculateCost(promptTokens: number, completionTokens: number, model: string): Promise<number> {
        // 根據模型計算成本
        const rates: { [key: string]: { prompt: number; completion: number } } = {
            'gpt-4': { prompt: 0.03, completion: 0.06 },
            'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 },
            'claude-3-opus': { prompt: 0.015, completion: 0.075 },
            'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
            'gemini-pro': { prompt: 0.0005, completion: 0.0015 }
        };

        const rate = rates[model];
        if (!rate) {
            return 0;
        }

        return (promptTokens / 1000 * rate.prompt) + (completionTokens / 1000 * rate.completion);
    }
}
