import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { LLMService } from '../LLMService';
import { ConfigManager } from '../../config/ConfigManager';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock ConfigManager
jest.mock('../../config/ConfigManager');
const MockedConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;

describe('LLMService', () => {
  let llmService: LLMService;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup ConfigManager mock
    mockConfigManager = {
      getOpenAIApiKey: jest.fn(),
      getClaudeApiKey: jest.fn(),
      getGeminiApiKey: jest.fn(),
      getPreferredModel: jest.fn()
    } as any;

    MockedConfigManager.getInstance.mockReturnValue(mockConfigManager);
    
    llmService = new LLMService();
  });

  describe('OpenAI Integration', () => {
    beforeEach(() => {
      mockConfigManager.getOpenAIApiKey.mockReturnValue('test-openai-key');
    });

    test('should generate completion with OpenAI', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: 'Test response from OpenAI'
            }
          }],
          usage: {
            total_tokens: 100
          },
          model: 'gpt-4'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await llmService.generateCompletion('Test prompt', {
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.7
      });

      expect(result.content).toBe('Test response from OpenAI');
      expect(result.tokens).toBe(100);
      expect(result.model).toBe('gpt-4');
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Test prompt'
            })
          ]),
          max_tokens: 1000,
          temperature: 0.7
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-openai-key'
          })
        })
      );
    });

    test('should handle OpenAI API errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      await expect(llmService.generateCompletion('Test prompt', {
        model: 'gpt-4'
      })).rejects.toThrow('API Error');
    });

    test('should throw error when OpenAI API key is missing', async () => {
      mockConfigManager.getOpenAIApiKey.mockReturnValue('');

      await expect(llmService.generateCompletion('Test prompt', {
        model: 'gpt-4'
      })).rejects.toThrow('請設定 OpenAI API 金鑰');
    });
  });

  describe('Claude Integration', () => {
    beforeEach(() => {
      mockConfigManager.getClaudeApiKey.mockReturnValue('test-claude-key');
    });

    test('should generate completion with Claude', async () => {
      const mockResponse = {
        data: {
          content: [{
            text: 'Test response from Claude'
          }],
          usage: {
            output_tokens: 80
          },
          model: 'claude-3-sonnet'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await llmService.generateCompletion('Test prompt', {
        model: 'claude-3-sonnet',
        maxTokens: 1000,
        temperature: 0.7
      });

      expect(result.content).toBe('Test response from Claude');
      expect(result.tokens).toBe(80);
      expect(result.model).toBe('claude-3-sonnet');
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          model: 'claude-3-sonnet',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Test prompt'
            })
          ]),
          max_tokens: 1000,
          temperature: 0.7
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-claude-key'
          })
        })
      );
    });

    test('should throw error when Claude API key is missing', async () => {
      mockConfigManager.getClaudeApiKey.mockReturnValue('');

      await expect(llmService.generateCompletion('Test prompt', {
        model: 'claude-3-sonnet'
      })).rejects.toThrow('請設定 Claude API 金鑰');
    });
  });

  describe('Gemini Integration', () => {
    beforeEach(() => {
      mockConfigManager.getGeminiApiKey.mockReturnValue('test-gemini-key');
    });

    test('should generate completion with Gemini', async () => {
      const mockResponse = {
        data: {
          candidates: [{
            content: {
              parts: [{
                text: 'Test response from Gemini'
              }]
            },
            finishReason: 'STOP'
          }],
          usageMetadata: {
            totalTokenCount: 120
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await llmService.generateCompletion('Test prompt', {
        model: 'gemini-2.5-flash',
        maxTokens: 1000,
        temperature: 0.7
      });

      expect(result.content).toBe('Test response from Gemini');
      expect(result.tokens).toBe(120);
      expect(result.model).toBe('gemini-2.5-flash');
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: 'Test prompt'
                })
              ])
            })
          ]),
          generationConfig: expect.objectContaining({
            maxOutputTokens: 1000,
            temperature: 0.7
          })
        }),
        expect.any(Object)
      );
    });

    test('should handle Gemini thinking configuration for 2.5 models', async () => {
      const mockResponse = {
        data: {
          candidates: [{
            content: {
              parts: [{
                text: 'Test response with thinking'
              }]
            },
            finishReason: 'STOP'
          }],
          usageMetadata: {
            totalTokenCount: 150
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await llmService.generateCompletion('Test prompt', {
        model: 'gemini-2.5-pro'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          config: expect.objectContaining({
            thinkingConfig: expect.objectContaining({
              thinkingBudget: -1
            })
          })
        }),
        expect.any(Object)
      );
    });

    test('should throw error when Gemini API key is missing', async () => {
      mockConfigManager.getGeminiApiKey.mockReturnValue('');

      await expect(llmService.generateCompletion('Test prompt', {
        model: 'gemini-2.5-flash'
      })).rejects.toThrow('請設定 Gemini API 金鑰');
    });
  });

  describe('Model Detection', () => {
    test('should detect OpenAI models', () => {
      const isOpenAI1 = llmService['isOpenAIModel']('gpt-4');
      const isOpenAI2 = llmService['isOpenAIModel']('gpt-3.5-turbo');
      const isOpenAI3 = llmService['isOpenAIModel']('claude-3-sonnet');

      expect(isOpenAI1).toBe(true);
      expect(isOpenAI2).toBe(true);
      expect(isOpenAI3).toBe(false);
    });

    test('should detect Claude models', () => {
      const isClaude1 = llmService['isClaudeModel']('claude-3-sonnet');
      const isClaude2 = llmService['isClaudeModel']('claude-3-haiku');
      const isClaude3 = llmService['isClaudeModel']('gpt-4');

      expect(isClaude1).toBe(true);
      expect(isClaude2).toBe(true);
      expect(isClaude3).toBe(false);
    });

    test('should detect Gemini models', () => {
      const isGemini1 = llmService['isGeminiModel']('gemini-2.5-flash');
      const isGemini2 = llmService['isGeminiModel']('gemini-pro');
      const isGemini3 = llmService['isGeminiModel']('gpt-4');

      expect(isGemini1).toBe(true);
      expect(isGemini2).toBe(true);
      expect(isGemini3).toBe(false);
    });
  });

  describe('API Health Check', () => {
    test('should check API health for all providers', async () => {
      mockConfigManager.getOpenAIApiKey.mockReturnValue('test-openai-key');
      mockConfigManager.getClaudeApiKey.mockReturnValue('test-claude-key');
      mockConfigManager.getGeminiApiKey.mockReturnValue('test-gemini-key');

      // Mock successful responses for all APIs
      mockedAxios.post.mockResolvedValue({ data: {} });

      const health = await llmService.checkAPIHealth();

      expect(health.openai).toBe(true);
      expect(health.claude).toBe(true);
      expect(health.gemini).toBe(true);
    });

    test('should handle API health check failures', async () => {
      mockConfigManager.getOpenAIApiKey.mockReturnValue('test-openai-key');
      mockConfigManager.getClaudeApiKey.mockReturnValue('');
      mockConfigManager.getGeminiApiKey.mockReturnValue('test-gemini-key');

      // Mock mixed responses
      mockedAxios.post
        .mockResolvedValueOnce({ data: {} })  // OpenAI success
        .mockRejectedValueOnce(new Error('API Error'));  // Gemini failure

      const health = await llmService.checkAPIHealth();

      expect(health.openai).toBe(true);
      expect(health.claude).toBe(false);  // No API key
      expect(health.gemini).toBe(false);  // API error
    });
  });

  describe('Token Estimation', () => {
    test('should estimate tokens for text', async () => {
      const text = 'This is a test prompt for token estimation';
      const tokens = await llmService.estimateTokens(text);
      
      // Simple estimation: roughly 1 token per 4 characters
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });
  });
});
