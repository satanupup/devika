import axios from 'axios';
import { ConfigManager } from '../config/ConfigManager';

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export class LLMService {
    private configManager: ConfigManager;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
    }

    async generateCompletion(prompt: string): Promise<string> {
        const model = this.configManager.getPreferredModel();
        
        switch (this.getModelProvider(model)) {
            case 'openai':
                return await this.callOpenAI(prompt, model);
            case 'claude':
                return await this.callClaude(prompt, model);
            case 'gemini':
                return await this.callGemini(prompt, model);
            default:
                throw new Error(`不支援的模型: ${model}`);
        }
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

    private async callOpenAI(prompt: string, model: string): Promise<string> {
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
                    max_tokens: 4000,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return response.data.choices[0].message.content;
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

    private async callClaude(prompt: string, model: string): Promise<string> {
        const apiKey = this.configManager.getClaudeApiKey();
        if (!apiKey) {
            throw new Error('請設定 Claude API 金鑰');
        }

        try {
            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: model,
                    max_tokens: 4000,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: 30000
                }
            );

            return response.data.content[0].text;
        } catch (error: any) {
            if (error.response) {
                throw new Error(`Claude API 錯誤: ${error.response.data.error?.message || error.response.statusText}`);
            } else if (error.request) {
                throw new Error('無法連接到 Claude API');
            } else {
                throw new Error(`請求錯誤: ${error.message}`);
            }
        }
    }

    private async callGemini(prompt: string, model: string): Promise<string> {
        const apiKey = this.configManager.getGeminiApiKey();
        if (!apiKey) {
            throw new Error('請設定 Gemini API 金鑰');
        }

        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
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
                        maxOutputTokens: 4000,
                        temperature: 0.7
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return response.data.candidates[0].content.parts[0].text;
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
