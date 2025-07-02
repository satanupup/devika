
/**
 * LLM 服務模擬物件
 */
export class LLMMocks {
  /**
   * 創建模擬的 OpenAI 響應
   */
  static createOpenAIResponse(content: string = 'Mock OpenAI response', model: string = 'gpt-4') {
    return {
      data: {
        id: 'chatcmpl-' + Math.random().toString(36).substr(2, 9),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: Math.floor(content.length / 4),
          total_tokens: 50 + Math.floor(content.length / 4)
        }
      }
    };
  }

  /**
   * 創建模擬的 Claude 響應
   */
  static createClaudeResponse(content: string = 'Mock Claude response', model: string = 'claude-3-sonnet') {
    return {
      data: {
        id: 'msg_' + Math.random().toString(36).substr(2, 9),
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: content
          }
        ],
        model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 50,
          output_tokens: Math.floor(content.length / 4)
        }
      }
    };
  }

  /**
   * 創建模擬的 Gemini 響應
   */
  static createGeminiResponse(content: string = 'Mock Gemini response', model: string = 'gemini-2.5-flash') {
    return {
      data: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: content
                }
              ],
              role: 'model'
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: [
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                probability: 'NEGLIGIBLE'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                probability: 'NEGLIGIBLE'
              },
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                probability: 'NEGLIGIBLE'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                probability: 'NEGLIGIBLE'
              }
            ]
          }
        ],
        usageMetadata: {
          promptTokenCount: 50,
          candidatesTokenCount: Math.floor(content.length / 4),
          totalTokenCount: 50 + Math.floor(content.length / 4)
        }
      }
    };
  }

  /**
   * 創建模擬的 Axios 實例
   */
  static createMockAxios() {
    return {
      get: sinon.stub(),
      post: sinon.stub(),
      put: sinon.stub(),
      delete: sinon.stub(),
      patch: sinon.stub(),
      head: sinon.stub(),
      options: sinon.stub(),
      request: sinon.stub(),
      defaults: {
        headers: {},
        timeout: 30000
      },
      interceptors: {
        request: {
          use: sinon.stub(),
          eject: sinon.stub()
        },
        response: {
          use: sinon.stub(),
          eject: sinon.stub()
        }
      }
    };
  }

  /**
   * 設置成功的 LLM 響應模擬
   */
  static setupSuccessfulLLMResponses(mockAxios: any) {
    // OpenAI 響應
    mockAxios.post.mockImplementation((url: string, data: any) => {
      if (url.includes('openai.com')) {
        const content = `OpenAI response for: ${data.messages?.[0]?.content || 'prompt'}`;
        return Promise.resolve(this.createOpenAIResponse(content, data.model));
      }

      // Claude 響應
      if (url.includes('anthropic.com')) {
        const content = `Claude response for: ${data.messages?.[0]?.content || 'prompt'}`;
        return Promise.resolve(this.createClaudeResponse(content, data.model));
      }

      // Gemini 響應
      if (url.includes('generativelanguage.googleapis.com')) {
        const content = `Gemini response for: ${data.contents?.[0]?.parts?.[0]?.text || 'prompt'}`;
        return Promise.resolve(this.createGeminiResponse(content));
      }

      return Promise.reject(new Error('Unknown API endpoint'));
    });
  }

  /**
   * 設置失敗的 LLM 響應模擬
   */
  static setupFailedLLMResponses(mockAxios: any, errorType: 'network' | 'auth' | 'quota' | 'server' = 'network') {
    const errors = {
      network: new Error('Network Error'),
      auth: { response: { status: 401, data: { error: 'Invalid API key' } } },
      quota: { response: { status: 429, data: { error: 'Rate limit exceeded' } } },
      server: { response: { status: 500, data: { error: 'Internal server error' } } }
    };

    mockAxios.post.mockRejectedValue(errors[errorType]);
  }

  /**
   * 創建模擬的流式響應
   */
  static createStreamingResponse(chunks: string[]) {
    let chunkIndex = 0;

    return {
      data: {
        on: sinon.stub().callsFake((event: string, callback: Function) => {
          if (event === 'data') {
            chunks.forEach((chunk, index) => {
              setTimeout(() => {
                callback(`data: ${JSON.stringify({
                  choices: [{
                    delta: {
                      content: chunk
                    }
                  }]
                })}\n\n`);
              }, index * 100);
            });

            setTimeout(() => {
              callback('data: [DONE]\n\n');
            }, chunks.length * 100);
          }
        }),
        pipe: sinon.stub()
      }
    };
  }

  /**
   * 創建模擬的 LLM 服務
   */
  static createMockLLMService() {
    return {
      generateCompletion: sinon.stub().callsFake(async (prompt: string, options: any = {}) => {
        const model = options.model || 'gpt-4';
        let content = '';

        // 根據模型類型生成不同的響應
        if (model.includes('gpt')) {
          content = `OpenAI ${model} response for: ${prompt.substring(0, 50)}...`;
        } else if (model.includes('claude')) {
          content = `Claude ${model} response for: ${prompt.substring(0, 50)}...`;
        } else if (model.includes('gemini')) {
          content = `Gemini ${model} response for: ${prompt.substring(0, 50)}...`;
        } else {
          content = `AI response for: ${prompt.substring(0, 50)}...`;
        }

        return {
          content,
          tokens: Math.floor(content.length / 4),
          model,
          timestamp: new Date()
        };
      }),

      checkAPIHealth: sinon.stub().callsFake(async () => ({
        openai: true,
        claude: true,
        gemini: true
      })),

      estimateTokens: sinon.stub().callsFake(async (text: string) => Math.floor(text.length / 4)),

      isOpenAIModel: sinon.stub().callsFake((model: string) => model.includes('gpt')),
      isClaudeModel: sinon.stub().callsFake((model: string) => model.includes('claude')),
      isGeminiModel: sinon.stub().callsFake((model: string) => model.includes('gemini'))
    };
  }

  /**
   * 創建特定場景的 LLM 響應
   */
  static createScenarioResponses() {
    return {
      codeAnalysis: {
        prompt: 'Analyze this code for potential improvements',
        response: `Code Analysis Results:

1. **Code Quality**: The code follows good practices with proper error handling and type safety.

2. **Potential Improvements**:
   - Consider extracting the validation logic into a separate utility function
   - Add JSDoc comments for better documentation
   - Implement unit tests for edge cases

3. **Performance**: No significant performance issues detected.

4. **Security**: No security vulnerabilities found.

Overall Score: 8/10`
      },

      commitMessage: {
        prompt: 'Generate a commit message for these changes',
        response: 'feat: add user authentication with JWT tokens\n\n- Implement login and registration endpoints\n- Add JWT token validation middleware\n- Create user model with password hashing\n- Add authentication tests'
      },

      refactoring: {
        prompt: 'Suggest refactoring for this code',
        response: `Refactoring Suggestions:

1. **Extract Method**: The function is doing too many things. Consider breaking it into smaller, focused functions.

2. **Reduce Complexity**: The nested if statements can be simplified using early returns.

3. **Improve Naming**: Some variable names could be more descriptive.

4. **Add Type Safety**: Consider adding more specific TypeScript types.

Here's the refactored version:

\`\`\`typescript
// Refactored code would go here
\`\`\``
      },

      documentation: {
        prompt: 'Generate documentation for this code',
        response: `# API Documentation

## Overview
This module provides user authentication functionality.

## Functions

### \`authenticate(username: string, password: string): Promise<AuthResult>\`
Authenticates a user with username and password.

**Parameters:**
- \`username\`: The user's username
- \`password\`: The user's password

**Returns:**
- \`Promise<AuthResult>\`: Authentication result with token if successful

**Example:**
\`\`\`typescript
const result = await authenticate('john_doe', 'password123');
if (result.success) {
  console.log('Token:', result.token);
}
\`\`\``
      }
    };
  }
}
