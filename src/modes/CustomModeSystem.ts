import * as vscode from 'vscode';
import { LLMService } from '../llm/LLMService';

export interface CustomMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'development' | 'analysis' | 'automation' | 'documentation' | 'testing' | 'custom';
  systemPrompt: string;
  capabilities: ModeCapability[];
  tools: ModeTool[];
  shortcuts: ModeShortcut[];
  settings: ModeSettings;
  metadata: ModeMetadata;
  enabled: boolean;
}

export interface ModeCapability {
  type: 'code_generation' | 'code_analysis' | 'file_operations' | 'terminal_access' | 'browser_control' | 'api_calls';
  enabled: boolean;
  config: { [key: string]: any };
}

export interface ModeTool {
  id: string;
  name: string;
  description: string;
  command: string;
  parameters: ToolParameter[];
  icon?: string;
  category?: string;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file' | 'directory';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: ParameterValidation;
}

export interface ParameterValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  allowedValues?: any[];
}

export interface ModeShortcut {
  key: string;
  command: string;
  description: string;
  when?: string;
}

export interface ModeSettings {
  temperature: number;
  maxTokens: number;
  model: string;
  autoSave: boolean;
  confirmActions: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customSettings: { [key: string]: any };
}

export interface ModeMetadata {
  version: string;
  author: string;
  created: Date;
  updated: Date;
  tags: string[];
  dependencies: string[];
  compatibility: string[];
}

export interface ModeExecution {
  id: string;
  modeId: string;
  input: string;
  output: string;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  toolsUsed: string[];
  filesModified: string[];
  error?: string;
  metadata: { [key: string]: any };
}

export interface ModeTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: Partial<CustomMode>;
  examples: ModeExample[];
  documentation: string;
}

export interface ModeExample {
  title: string;
  description: string;
  input: string;
  expectedOutput: string;
  tools?: string[];
}

export class CustomModeSystem {
  private modes: Map<string, CustomMode> = new Map();
  private templates: Map<string, ModeTemplate> = new Map();
  private executions: Map<string, ModeExecution> = new Map();
  private currentMode: CustomMode | undefined;
  private executionHistory: ModeExecution[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private llmService: LLMService
  ) {
    this.initializeBuiltInModes();
    this.initializeTemplates();
    this.loadCustomModes();
    this.setupCommands();
  }

  /**
   * 創建自定義模式
   */
  async createCustomMode(mode: Omit<CustomMode, 'id' | 'metadata'>): Promise<string> {
    const modeId = this.generateModeId(mode.name);
    const fullMode: CustomMode = {
      ...mode,
      id: modeId,
      metadata: {
        version: '1.0.0',
        author: 'User',
        created: new Date(),
        updated: new Date(),
        tags: [],
        dependencies: [],
        compatibility: ['vscode']
      }
    };

    this.modes.set(modeId, fullMode);
    await this.saveCustomModes();

    return modeId;
  }

  /**
   * 從模板創建模式
   */
  async createModeFromTemplate(templateId: string, customizations: Partial<CustomMode> = {}): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    const mode: Omit<CustomMode, 'id' | 'metadata'> = {
      name: customizations.name || template.name,
      description: customizations.description || template.description,
      icon: customizations.icon || template.template.icon || '🤖',
      category: customizations.category || template.template.category || 'custom',
      systemPrompt: customizations.systemPrompt || template.template.systemPrompt || '',
      capabilities: customizations.capabilities || template.template.capabilities || [],
      tools: customizations.tools || template.template.tools || [],
      shortcuts: customizations.shortcuts || template.template.shortcuts || [],
      settings: {
        ...template.template.settings,
        ...customizations.settings
      } as ModeSettings,
      enabled: customizations.enabled !== undefined ? customizations.enabled : true
    };

    return await this.createCustomMode(mode);
  }

  /**
   * 激活模式
   */
  async activateMode(modeId: string): Promise<void> {
    const mode = this.modes.get(modeId);
    if (!mode) {
      throw new Error(`模式不存在: ${modeId}`);
    }

    if (!mode.enabled) {
      throw new Error(`模式已禁用: ${modeId}`);
    }

    // 停用當前模式
    if (this.currentMode) {
      await this.deactivateCurrentMode();
    }

    this.currentMode = mode;

    // 註冊模式工具
    this.registerModeTools(mode);

    // 註冊快捷鍵
    this.registerModeShortcuts(mode);

    // 更新狀態欄
    this.updateStatusBar(mode);

    // 發送激活事件
    vscode.commands.executeCommand('setContext', 'devika.activeMode', modeId);

    vscode.window.showInformationMessage(`已激活模式: ${mode.name}`);
  }

  /**
   * 執行模式
   */
  async executeMode(
    input: string,
    options: {
      modeId?: string;
      tools?: string[];
      settings?: Partial<ModeSettings>;
    } = {}
  ): Promise<ModeExecution> {
    const mode = options.modeId ? this.modes.get(options.modeId) : this.currentMode;
    if (!mode) {
      throw new Error('沒有激活的模式');
    }

    const executionId = this.generateExecutionId();
    const execution: ModeExecution = {
      id: executionId,
      modeId: mode.id,
      input,
      output: '',
      status: 'running',
      startTime: new Date(),
      toolsUsed: [],
      filesModified: [],
      metadata: {}
    };

    this.executions.set(executionId, execution);

    try {
      // 準備系統提示
      const systemPrompt = this.buildSystemPrompt(mode, options.tools);

      // 準備設置
      const settings = { ...mode.settings, ...options.settings };

      // 執行 LLM 請求
      const fullPrompt = `${systemPrompt}\n\n---\n\nHuman: ${input}`;
      const llmResponse = await this.llmService.generateCompletion(fullPrompt, {
        temperature: settings.temperature,
        maxTokens: settings.maxTokens
      });

      execution.output = llmResponse.content;
      execution.status = 'completed';

      // 解析和執行工具調用
      await this.processToolCalls(execution, llmResponse.content);
    } catch (error) {
      execution.status = 'error';
      execution.error = String(error);
    } finally {
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.executionHistory.push(execution);
      this.saveExecutionHistory();
    }

    return execution;
  }

  /**
   * 構建系統提示
   */
  private buildSystemPrompt(mode: CustomMode, availableTools?: string[]): string {
    let prompt = mode.systemPrompt;

    // 添加能力描述
    if (mode.capabilities.length > 0) {
      prompt += '\n\n你具有以下能力:\n';
      for (const capability of mode.capabilities.filter(c => c.enabled)) {
        prompt += `- ${this.getCapabilityDescription(capability.type)}\n`;
      }
    }

    // 添加工具描述
    const tools = availableTools ? mode.tools.filter(t => availableTools.includes(t.id)) : mode.tools;

    if (tools.length > 0) {
      prompt += '\n\n可用工具:\n';
      for (const tool of tools) {
        prompt += `- ${tool.name}: ${tool.description}\n`;
        if (tool.parameters.length > 0) {
          prompt += `  參數: ${tool.parameters.map(p => `${p.name}(${p.type})`).join(', ')}\n`;
        }
      }
    }

    // 添加使用指南
    prompt += '\n\n請根據用戶的請求，使用適當的工具和能力來完成任務。';

    return prompt;
  }

  /**
   * 處理工具調用
   */
  private async processToolCalls(execution: ModeExecution, response: string): Promise<void> {
    // 解析響應中的工具調用
    const toolCalls = this.parseToolCalls(response);

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall.tool, toolCall.parameters);
        execution.toolsUsed.push(toolCall.tool);
        execution.metadata[`tool_${toolCall.tool}_result`] = result;
      } catch (error) {
        console.error(`工具執行失敗 ${toolCall.tool}:`, error);
      }
    }
  }

  /**
   * 執行工具
   */
  private async executeTool(toolId: string, parameters: any): Promise<any> {
    const mode = this.currentMode;
    if (!mode) {
      throw new Error('沒有激活的模式');
    }

    const tool = mode.tools.find(t => t.id === toolId);
    if (!tool) {
      throw new Error(`工具不存在: ${toolId}`);
    }

    // 驗證參數
    this.validateToolParameters(tool, parameters);

    // 執行工具命令
    return await vscode.commands.executeCommand(tool.command, parameters);
  }

  /**
   * 初始化內建模式
   */
  private initializeBuiltInModes(): void {
    // 代碼生成模式
    this.modes.set('code-generator', {
      id: 'code-generator',
      name: '代碼生成器',
      description: '專門用於生成高品質代碼的模式',
      icon: '💻',
      category: 'development',
      systemPrompt: '你是一個專業的代碼生成助手。請根據用戶需求生成清晰、高效、符合最佳實踐的代碼。',
      capabilities: [
        { type: 'code_generation', enabled: true, config: {} },
        { type: 'file_operations', enabled: true, config: {} }
      ],
      tools: [
        {
          id: 'create-file',
          name: '創建文件',
          description: '創建新的代碼文件',
          command: 'devika.createFile',
          parameters: [
            { name: 'path', type: 'string', required: true, description: '文件路徑' },
            { name: 'content', type: 'string', required: true, description: '文件內容' }
          ]
        }
      ],
      shortcuts: [{ key: 'ctrl+shift+g', command: 'devika.generateCode', description: '生成代碼' }],
      settings: {
        temperature: 0.3,
        maxTokens: 2000,
        model: 'gpt-4',
        autoSave: true,
        confirmActions: false,
        logLevel: 'info',
        customSettings: {}
      },
      metadata: {
        version: '1.0.0',
        author: 'Devika',
        created: new Date(),
        updated: new Date(),
        tags: ['code', 'generation', 'development'],
        dependencies: [],
        compatibility: ['vscode']
      },
      enabled: true
    });

    // 代碼分析模式
    this.modes.set('code-analyzer', {
      id: 'code-analyzer',
      name: '代碼分析師',
      description: '深度分析代碼品質和結構的模式',
      icon: '🔍',
      category: 'analysis',
      systemPrompt: '你是一個代碼分析專家。請仔細分析代碼的品質、結構、性能和安全性，並提供改進建議。',
      capabilities: [
        { type: 'code_analysis', enabled: true, config: {} },
        { type: 'file_operations', enabled: true, config: {} }
      ],
      tools: [
        {
          id: 'analyze-file',
          name: '分析文件',
          description: '分析指定文件的代碼品質',
          command: 'devika.analyzeFile',
          parameters: [{ name: 'path', type: 'file', required: true, description: '要分析的文件路徑' }]
        }
      ],
      shortcuts: [{ key: 'ctrl+shift+a', command: 'devika.analyzeCode', description: '分析代碼' }],
      settings: {
        temperature: 0.1,
        maxTokens: 3000,
        model: 'gpt-4',
        autoSave: false,
        confirmActions: true,
        logLevel: 'info',
        customSettings: {}
      },
      metadata: {
        version: '1.0.0',
        author: 'Devika',
        created: new Date(),
        updated: new Date(),
        tags: ['analysis', 'quality', 'review'],
        dependencies: [],
        compatibility: ['vscode']
      },
      enabled: true
    });
  }

  /**
   * 初始化模板
   */
  private initializeTemplates(): void {
    this.templates.set('basic-assistant', {
      id: 'basic-assistant',
      name: '基礎助手',
      description: '通用的 AI 助手模板',
      category: 'general',
      template: {
        icon: '🤖',
        category: 'custom',
        systemPrompt: '你是一個有用的 AI 助手。請根據用戶的請求提供幫助。',
        capabilities: [{ type: 'code_generation', enabled: true, config: {} }],
        tools: [],
        shortcuts: [],
        settings: {
          temperature: 0.7,
          maxTokens: 1500,
          model: 'gpt-3.5-turbo',
          autoSave: false,
          confirmActions: true,
          logLevel: 'info',
          customSettings: {}
        }
      },
      examples: [
        {
          title: '基本對話',
          description: '與助手進行基本對話',
          input: '你好，請介紹一下自己',
          expectedOutput: '你好！我是你的 AI 助手...'
        }
      ],
      documentation: '這是一個基礎的 AI 助手模板，適合初學者使用。'
    });

    this.templates.set('documentation-writer', {
      id: 'documentation-writer',
      name: '文檔撰寫者',
      description: '專門用於撰寫技術文檔的模板',
      category: 'documentation',
      template: {
        icon: '📝',
        category: 'documentation',
        systemPrompt: '你是一個專業的技術文檔撰寫者。請創建清晰、詳細、易於理解的文檔。',
        capabilities: [{ type: 'file_operations', enabled: true, config: {} }],
        tools: [
          {
            id: 'create-readme',
            name: '創建 README',
            description: '創建項目 README 文件',
            command: 'devika.createReadme',
            parameters: []
          }
        ],
        shortcuts: [{ key: 'ctrl+shift+d', command: 'devika.generateDocs', description: '生成文檔' }],
        settings: {
          temperature: 0.5,
          maxTokens: 2500,
          model: 'gpt-4',
          autoSave: true,
          confirmActions: false,
          logLevel: 'info',
          customSettings: {}
        }
      },
      examples: [
        {
          title: '創建 API 文檔',
          description: '為 REST API 創建文檔',
          input: '請為我的用戶管理 API 創建文檔',
          expectedOutput: '# 用戶管理 API\n\n## 概述\n...'
        }
      ],
      documentation: '專門用於撰寫各種技術文檔的模板。'
    });
  }

  // 輔助方法
  private getCapabilityDescription(type: string): string {
    const descriptions = {
      code_generation: '生成和編寫代碼',
      code_analysis: '分析代碼品質和結構',
      file_operations: '創建、讀取和修改文件',
      terminal_access: '執行終端命令',
      browser_control: '控制瀏覽器操作',
      api_calls: '調用外部 API'
    };
    return descriptions[type as keyof typeof descriptions] || type;
  }

  private parseToolCalls(response: string): { tool: string; parameters: any }[] {
    // 簡化的工具調用解析
    const toolCalls: { tool: string; parameters: any }[] = [];
    const toolCallRegex = /\[TOOL:(\w+)\](.*?)\[\/TOOL\]/gs;
    let match;

    while ((match = toolCallRegex.exec(response)) !== null) {
      try {
        const tool = match[1];
        const parameters = JSON.parse(match[2] || '{}');
        toolCalls.push({ tool, parameters });
      } catch (error) {
        console.error('解析工具調用失敗:', error);
      }
    }

    return toolCalls;
  }

  private validateToolParameters(tool: ModeTool, parameters: any): void {
    for (const param of tool.parameters) {
      const value = parameters[param.name];

      if (param.required && (value === undefined || value === null)) {
        throw new Error(`缺少必需參數: ${param.name}`);
      }

      if (value !== undefined && param.validation) {
        this.validateParameterValue(param, value);
      }
    }
  }

  private validateParameterValue(param: ToolParameter, value: any): void {
    const validation = param.validation!;

    if (param.type === 'string' && typeof value === 'string') {
      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        throw new Error(`參數 ${param.name} 格式不正確`);
      }
      if (validation.minLength && value.length < validation.minLength) {
        throw new Error(`參數 ${param.name} 長度不足`);
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        throw new Error(`參數 ${param.name} 長度超限`);
      }
    }

    if (validation.allowedValues && !validation.allowedValues.includes(value)) {
      throw new Error(`參數 ${param.name} 值不在允許範圍內`);
    }
  }

  private registerModeTools(mode: CustomMode): void {
    // 註冊模式工具到 VS Code 命令系統
    for (const tool of mode.tools) {
      vscode.commands.registerCommand(`devika.mode.${mode.id}.${tool.id}`, async (...args) => {
        return await this.executeTool(tool.id, args[0] || {});
      });
    }
  }

  private registerModeShortcuts(mode: CustomMode): void {
    // 註冊快捷鍵（簡化實作）
    for (const shortcut of mode.shortcuts) {
      // 實際實作需要在 package.json 中定義快捷鍵
      console.log(`註冊快捷鍵: ${shortcut.key} -> ${shortcut.command}`);
    }
  }

  private updateStatusBar(mode: CustomMode): void {
    // 更新狀態欄顯示當前模式
    vscode.window.setStatusBarMessage(`${mode.icon} ${mode.name}`, 5000);
  }

  private async deactivateCurrentMode(): Promise<void> {
    if (this.currentMode) {
      // 清理當前模式的註冊
      vscode.commands.executeCommand('setContext', 'devika.activeMode', undefined);
      this.currentMode = undefined;
    }
  }

  private setupCommands(): void {
    // 設置模式相關命令
    this.context.subscriptions.push(
      vscode.commands.registerCommand('devika.activateMode', async () => {
        const modes = Array.from(this.modes.values()).filter(m => m.enabled);
        const items = modes.map(mode => ({
          label: `${mode.icon} ${mode.name}`,
          description: mode.description,
          mode
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '選擇要激活的模式'
        });

        if (selected) {
          await this.activateMode(selected.mode.id);
        }
      })
    );
  }

  private generateModeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
  }

  private generateExecutionId(): string {
    return 'exec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  private loadCustomModes(): void {
    const modes = this.context.globalState.get<any[]>('customModes', []);
    for (const mode of modes) {
      this.modes.set(mode.id, {
        ...mode,
        metadata: {
          ...mode.metadata,
          created: new Date(mode.metadata.created),
          updated: new Date(mode.metadata.updated)
        }
      });
    }
  }

  private async saveCustomModes(): Promise<void> {
    const customModes = Array.from(this.modes.values()).filter(
      m => !['code-generator', 'code-analyzer'].includes(m.id)
    );
    await this.context.globalState.update('customModes', customModes);
  }

  private saveExecutionHistory(): void {
    // 保持最近100次執行記錄
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }
    this.context.globalState.update('executionHistory', this.executionHistory);
  }

  /**
   * 獲取所有模式
   */
  getAllModes(): CustomMode[] {
    return Array.from(this.modes.values());
  }

  /**
   * 獲取當前模式
   */
  getCurrentMode(): CustomMode | undefined {
    return this.currentMode;
  }

  /**
   * 獲取執行歷史
   */
  getExecutionHistory(): ModeExecution[] {
    return [...this.executionHistory];
  }

  /**
   * 清理資源
   */
  dispose(): void {
    this.deactivateCurrentMode();
  }
}
