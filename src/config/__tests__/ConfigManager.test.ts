import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ConfigManager } from '../ConfigManager';

// Mock vscode module
const mockConfig = {
  get: jest.fn(),
  update: jest.fn(),
  has: jest.fn()
};

const mockVscode = {
  workspace: {
    getConfiguration: jest.fn(() => mockConfig)
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  }
};

jest.mock('vscode', () => mockVscode, { virtual: true });

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = ConfigManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('API Key Management', () => {
    test('should get OpenAI API key', () => {
      mockConfig.get.mockReturnValue('test-openai-key');
      const apiKey = configManager.getOpenAIApiKey();
      expect(mockConfig.get).toHaveBeenCalledWith('openaiApiKey', '');
      expect(apiKey).toBe('test-openai-key');
    });

    test('should set OpenAI API key', () => {
      configManager.setOpenAIApiKey('new-openai-key');
      expect(mockConfig.update).toHaveBeenCalledWith(
        'openaiApiKey', 
        'new-openai-key', 
        mockVscode.ConfigurationTarget.Global
      );
    });

    test('should get Claude API key', () => {
      mockConfig.get.mockReturnValue('test-claude-key');
      const apiKey = configManager.getClaudeApiKey();
      expect(mockConfig.get).toHaveBeenCalledWith('claudeApiKey', '');
      expect(apiKey).toBe('test-claude-key');
    });

    test('should set Claude API key', () => {
      configManager.setClaudeApiKey('new-claude-key');
      expect(mockConfig.update).toHaveBeenCalledWith(
        'claudeApiKey', 
        'new-claude-key', 
        mockVscode.ConfigurationTarget.Global
      );
    });

    test('should get Gemini API key', () => {
      mockConfig.get.mockReturnValue('test-gemini-key');
      const apiKey = configManager.getGeminiApiKey();
      expect(mockConfig.get).toHaveBeenCalledWith('geminiApiKey', '');
      expect(apiKey).toBe('test-gemini-key');
    });

    test('should set Gemini API key', () => {
      configManager.setGeminiApiKey('new-gemini-key');
      expect(mockConfig.update).toHaveBeenCalledWith(
        'geminiApiKey', 
        'new-gemini-key', 
        mockVscode.ConfigurationTarget.Global
      );
    });
  });

  describe('Model Configuration', () => {
    test('should get preferred model with default', () => {
      mockConfig.get.mockReturnValue(undefined);
      const model = configManager.getPreferredModel();
      expect(mockConfig.get).toHaveBeenCalledWith('preferredModel', 'gemini-2.5-flash');
    });

    test('should set preferred model', () => {
      configManager.setPreferredModel('claude-3-sonnet');
      expect(mockConfig.update).toHaveBeenCalledWith(
        'preferredModel', 
        'claude-3-sonnet', 
        mockVscode.ConfigurationTarget.Workspace
      );
    });
  });

  describe('Feature Toggles', () => {
    test('should get auto scan todos setting', () => {
      mockConfig.get.mockReturnValue(false);
      const autoScan = configManager.getAutoScanTodos();
      expect(mockConfig.get).toHaveBeenCalledWith('autoScanTodos', true);
      expect(autoScan).toBe(false);
    });

    test('should get enable code indexing setting', () => {
      mockConfig.get.mockReturnValue(true);
      const indexing = configManager.getEnableCodeIndexing();
      expect(mockConfig.get).toHaveBeenCalledWith('enableCodeIndexing', true);
      expect(indexing).toBe(true);
    });

    test('should get max context lines setting', () => {
      mockConfig.get.mockReturnValue(200);
      const maxLines = configManager.getMaxContextLines();
      expect(mockConfig.get).toHaveBeenCalledWith('maxContextLines', 100);
      expect(maxLines).toBe(200);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration with all API keys', () => {
      mockConfig.get
        .mockReturnValueOnce('openai-key')  // OpenAI
        .mockReturnValueOnce('claude-key')  // Claude
        .mockReturnValueOnce('gemini-key'); // Gemini

      const validation = configManager.validateConfiguration();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should validate configuration with missing API keys', () => {
      mockConfig.get
        .mockReturnValueOnce('')  // OpenAI
        .mockReturnValueOnce('')  // Claude
        .mockReturnValueOnce(''); // Gemini

      const validation = configManager.validateConfiguration();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('至少需要設定一個 API 金鑰');
    });

    test('should validate configuration with partial API keys', () => {
      mockConfig.get
        .mockReturnValueOnce('openai-key')  // OpenAI
        .mockReturnValueOnce('')           // Claude
        .mockReturnValueOnce('');          // Gemini

      const validation = configManager.validateConfiguration();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
