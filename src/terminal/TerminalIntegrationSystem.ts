import * as vscode from 'vscode';
import { TaskManager, Task } from '../tasks/TaskManager';

export interface TerminalSession {
  id: string;
  name: string;
  terminal: vscode.Terminal;
  type: 'general' | 'build' | 'test' | 'debug' | 'deploy' | 'task';
  status: 'active' | 'idle' | 'busy' | 'error' | 'closed';
  workingDirectory: string;
  environment: { [key: string]: string };
  history: TerminalCommand[];
  createdAt: Date;
  lastUsed: Date;
  taskId?: string;
}

export interface TerminalCommand {
  id: string;
  command: string;
  args: string[];
  workingDirectory: string;
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
  output: string;
  error: string;
  duration?: number;
  success: boolean;
}

export interface TerminalTemplate {
  id: string;
  name: string;
  description: string;
  type: 'general' | 'build' | 'test' | 'debug' | 'deploy';
  commands: TemplateCommand[];
  environment: { [key: string]: string };
  workingDirectory?: string;
  autoStart: boolean;
  tags: string[];
}

export interface TemplateCommand {
  name: string;
  command: string;
  description: string;
  order: number;
  condition?: string;
  timeout?: number;
  retries?: number;
  continueOnError?: boolean;
}

export interface BuildConfiguration {
  name: string;
  type: 'npm' | 'webpack' | 'rollup' | 'vite' | 'gradle' | 'maven' | 'custom';
  commands: string[];
  environment: { [key: string]: string };
  outputPath: string;
  watchMode: boolean;
  sourceMaps: boolean;
  minify: boolean;
  target: 'development' | 'production' | 'test';
}

export interface TestConfiguration {
  name: string;
  framework: 'jest' | 'mocha' | 'jasmine' | 'vitest' | 'cypress' | 'playwright' | 'custom';
  commands: string[];
  testFiles: string[];
  coverage: boolean;
  watch: boolean;
  parallel: boolean;
  timeout: number;
  environment: { [key: string]: string };
}

export interface DeploymentConfiguration {
  name: string;
  platform: 'vercel' | 'netlify' | 'aws' | 'azure' | 'gcp' | 'docker' | 'custom';
  commands: string[];
  environment: { [key: string]: string };
  buildCommand?: string;
  outputDirectory?: string;
  environmentVariables: { [key: string]: string };
  hooks: {
    preDeploy?: string[];
    postDeploy?: string[];
  };
}

export class TerminalIntegrationSystem {
  private sessions: Map<string, TerminalSession> = new Map();
  private templates: Map<string, TerminalTemplate> = new Map();
  private buildConfigs: Map<string, BuildConfiguration> = new Map();
  private testConfigs: Map<string, TestConfiguration> = new Map();
  private deployConfigs: Map<string, DeploymentConfiguration> = new Map();
  private commandHistory: TerminalCommand[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private taskManager: TaskManager
  ) {
    this.initializeDefaultTemplates();
    this.loadConfigurations();
    this.setupTerminalListener();
  }

  /**
   * 創建新的終端會話
   */
  async createTerminalSession(
    name: string,
    type: TerminalSession['type'] = 'general',
    options?: {
      workingDirectory?: string;
      environment?: { [key: string]: string };
      taskId?: string;
    }
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const workingDirectory = options?.workingDirectory || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    const terminal = vscode.window.createTerminal({
      name,
      cwd: workingDirectory,
      env: options?.environment
    });

    const session: TerminalSession = {
      id: sessionId,
      name,
      terminal,
      type,
      status: 'active',
      workingDirectory,
      environment: options?.environment || {},
      history: [],
      createdAt: new Date(),
      lastUsed: new Date(),
      taskId: options?.taskId
    };

    this.sessions.set(sessionId, session);

    // 如果關聯了任務，更新任務狀態
    if (options?.taskId) {
      await this.taskManager.updateTask(options.taskId, {
        status: 'in-progress',
        metadata: { terminalSessionId: sessionId }
      });
    }

    return sessionId;
  }

  /**
   * 執行命令
   */
  async executeCommand(
    sessionId: string,
    command: string,
    args: string[] = [],
    options?: {
      timeout?: number;
      retries?: number;
      continueOnError?: boolean;
    }
  ): Promise<TerminalCommand> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`終端會話不存在: ${sessionId}`);
    }

    const commandId = this.generateCommandId();
    const fullCommand = `${command} ${args.join(' ')}`.trim();

    const terminalCommand: TerminalCommand = {
      id: commandId,
      command,
      args,
      workingDirectory: session.workingDirectory,
      startTime: new Date(),
      output: '',
      error: '',
      success: false
    };

    session.status = 'busy';
    session.lastUsed = new Date();

    try {
      // 發送命令到終端
      session.terminal.sendText(fullCommand);

      // 模擬命令執行（實際實作中需要監聽終端輸出）
      await this.simulateCommandExecution(terminalCommand, options);

      session.history.push(terminalCommand);
      this.commandHistory.push(terminalCommand);

      session.status = terminalCommand.success ? 'idle' : 'error';

      return terminalCommand;
    } catch (error) {
      session.status = 'error';
      terminalCommand.error = String(error);
      terminalCommand.endTime = new Date();
      terminalCommand.duration = terminalCommand.endTime.getTime() - terminalCommand.startTime.getTime();

      throw error;
    }
  }

  /**
   * 執行模板
   */
  async executeTemplate(templateId: string, sessionId?: string): Promise<TerminalCommand[]> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    // 創建新會話或使用現有會話
    const actualSessionId =
      sessionId ||
      (await this.createTerminalSession(template.name, template.type, {
        workingDirectory: template.workingDirectory,
        environment: template.environment
      }));

    const results: TerminalCommand[] = [];

    // 按順序執行命令
    for (const templateCommand of template.commands.sort((a, b) => a.order - b.order)) {
      try {
        const result = await this.executeCommand(actualSessionId, templateCommand.command, [], {
          timeout: templateCommand.timeout,
          retries: templateCommand.retries,
          continueOnError: templateCommand.continueOnError
        });

        results.push(result);

        // 如果命令失敗且不允許繼續，停止執行
        if (!result.success && !templateCommand.continueOnError) {
          break;
        }
      } catch (error) {
        if (!templateCommand.continueOnError) {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * 運行構建
   */
  async runBuild(
    configName: string,
    target: 'development' | 'production' | 'test' = 'development'
  ): Promise<TerminalCommand[]> {
    const config = this.buildConfigs.get(configName);
    if (!config) {
      throw new Error(`構建配置不存在: ${configName}`);
    }

    const sessionId = await this.createTerminalSession(`Build: ${config.name}`, 'build', {
      environment: { ...config.environment, NODE_ENV: target }
    });

    const results: TerminalCommand[] = [];

    for (const command of config.commands) {
      const result = await this.executeCommand(sessionId, command);
      results.push(result);

      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * 運行測試
   */
  async runTests(configName: string, options?: { watch?: boolean; coverage?: boolean }): Promise<TerminalCommand[]> {
    const config = this.testConfigs.get(configName);
    if (!config) {
      throw new Error(`測試配置不存在: ${configName}`);
    }

    const sessionId = await this.createTerminalSession(`Test: ${config.name}`, 'test', {
      environment: config.environment
    });

    const results: TerminalCommand[] = [];

    for (const command of config.commands) {
      let actualCommand = command;

      // 添加選項
      if (options?.watch && config.watch) {
        actualCommand += ' --watch';
      }
      if (options?.coverage && config.coverage) {
        actualCommand += ' --coverage';
      }

      const result = await this.executeCommand(sessionId, actualCommand);
      results.push(result);

      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * 執行部署
   */
  async deploy(configName: string, environment: string = 'production'): Promise<TerminalCommand[]> {
    const config = this.deployConfigs.get(configName);
    if (!config) {
      throw new Error(`部署配置不存在: ${configName}`);
    }

    const sessionId = await this.createTerminalSession(`Deploy: ${config.name}`, 'deploy', {
      environment: {
        ...config.environment,
        ...config.environmentVariables,
        DEPLOY_ENV: environment
      }
    });

    const results: TerminalCommand[] = [];

    try {
      // 執行預部署鉤子
      if (config.hooks.preDeploy) {
        for (const command of config.hooks.preDeploy) {
          const result = await this.executeCommand(sessionId, command);
          results.push(result);
          if (!result.success) throw new Error('預部署鉤子失敗');
        }
      }

      // 執行構建（如果配置了）
      if (config.buildCommand) {
        const result = await this.executeCommand(sessionId, config.buildCommand);
        results.push(result);
        if (!result.success) throw new Error('構建失敗');
      }

      // 執行部署命令
      for (const command of config.commands) {
        const result = await this.executeCommand(sessionId, command);
        results.push(result);
        if (!result.success) throw new Error('部署失敗');
      }

      // 執行後部署鉤子
      if (config.hooks.postDeploy) {
        for (const command of config.hooks.postDeploy) {
          const result = await this.executeCommand(sessionId, command);
          results.push(result);
          // 後部署鉤子失敗不中斷部署
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`部署失敗: ${error}`);
      throw error;
    }

    return results;
  }

  /**
   * 獲取會話列表
   */
  getSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 獲取活躍會話
   */
  getActiveSessions(): TerminalSession[] {
    return this.getSessions().filter(session => session.status === 'active' || session.status === 'busy');
  }

  /**
   * 關閉會話
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.terminal.dispose();
    session.status = 'closed';

    // 如果關聯了任務，更新任務狀態
    if (session.taskId) {
      await this.taskManager.updateTask(session.taskId, {
        status: 'completed',
        metadata: { terminalSessionClosed: new Date() }
      });
    }

    this.sessions.delete(sessionId);
  }

  /**
   * 獲取命令歷史
   */
  getCommandHistory(sessionId?: string): TerminalCommand[] {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      return session?.history || [];
    }
    return [...this.commandHistory];
  }

  /**
   * 創建模板
   */
  createTemplate(template: Omit<TerminalTemplate, 'id'>): string {
    const templateId = this.generateTemplateId(template.name);
    const fullTemplate: TerminalTemplate = {
      ...template,
      id: templateId
    };

    this.templates.set(templateId, fullTemplate);
    this.saveConfigurations();

    return templateId;
  }

  /**
   * 創建構建配置
   */
  createBuildConfig(config: Omit<BuildConfiguration, 'name'> & { name: string }): void {
    this.buildConfigs.set(config.name, config);
    this.saveConfigurations();
  }

  /**
   * 創建測試配置
   */
  createTestConfig(config: Omit<TestConfiguration, 'name'> & { name: string }): void {
    this.testConfigs.set(config.name, config);
    this.saveConfigurations();
  }

  /**
   * 創建部署配置
   */
  createDeployConfig(config: Omit<DeploymentConfiguration, 'name'> & { name: string }): void {
    this.deployConfigs.set(config.name, config);
    this.saveConfigurations();
  }

  // 私有方法
  private initializeDefaultTemplates(): void {
    // Node.js 項目模板
    this.templates.set('nodejs-setup', {
      id: 'nodejs-setup',
      name: 'Node.js 項目設置',
      description: '初始化 Node.js 項目的基本設置',
      type: 'general',
      commands: [
        { name: 'install', command: 'npm install', description: '安裝依賴', order: 1 },
        { name: 'build', command: 'npm run build', description: '構建項目', order: 2, continueOnError: true },
        { name: 'test', command: 'npm test', description: '運行測試', order: 3, continueOnError: true }
      ],
      environment: { NODE_ENV: 'development' },
      autoStart: false,
      tags: ['nodejs', 'setup']
    });

    // React 開發模板
    this.templates.set('react-dev', {
      id: 'react-dev',
      name: 'React 開發環境',
      description: '啟動 React 開發服務器',
      type: 'build',
      commands: [{ name: 'start', command: 'npm start', description: '啟動開發服務器', order: 1 }],
      environment: { NODE_ENV: 'development', BROWSER: 'none' },
      autoStart: true,
      tags: ['react', 'development']
    });
  }

  private async simulateCommandExecution(
    command: TerminalCommand,
    options?: { timeout?: number; retries?: number }
  ): Promise<void> {
    // 模擬命令執行時間
    const executionTime = Math.random() * 2000 + 500; // 0.5-2.5秒

    await new Promise(resolve => setTimeout(resolve, executionTime));

    // 模擬成功/失敗
    const success = Math.random() > 0.1; // 90% 成功率

    command.endTime = new Date();
    command.duration = command.endTime.getTime() - command.startTime.getTime();
    command.success = success;
    command.exitCode = success ? 0 : 1;

    if (success) {
      command.output = `Command '${command.command}' executed successfully`;
    } else {
      command.error = `Command '${command.command}' failed with exit code 1`;
    }
  }

  private setupTerminalListener(): void {
    vscode.window.onDidCloseTerminal(terminal => {
      // 查找對應的會話並標記為關閉
      for (const [sessionId, session] of this.sessions) {
        if (session.terminal === terminal) {
          session.status = 'closed';
          this.sessions.delete(sessionId);
          break;
        }
      }
    });
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateCommandId(): string {
    return 'cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateTemplateId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
  }

  private loadConfigurations(): void {
    const configs = this.context.globalState.get<any>('terminalConfigurations', {});

    if (configs.templates) {
      for (const template of configs.templates) {
        this.templates.set(template.id, template);
      }
    }

    if (configs.buildConfigs) {
      for (const config of configs.buildConfigs) {
        this.buildConfigs.set(config.name, config);
      }
    }

    if (configs.testConfigs) {
      for (const config of configs.testConfigs) {
        this.testConfigs.set(config.name, config);
      }
    }

    if (configs.deployConfigs) {
      for (const config of configs.deployConfigs) {
        this.deployConfigs.set(config.name, config);
      }
    }
  }

  private saveConfigurations(): void {
    const configs = {
      templates: Array.from(this.templates.values()),
      buildConfigs: Array.from(this.buildConfigs.values()),
      testConfigs: Array.from(this.testConfigs.values()),
      deployConfigs: Array.from(this.deployConfigs.values())
    };

    this.context.globalState.update('terminalConfigurations', configs);
  }

  /**
   * 清理資源
   */
  dispose(): void {
    // 關閉所有活躍會話
    for (const session of this.sessions.values()) {
      if (session.status !== 'closed') {
        session.terminal.dispose();
      }
    }
    this.sessions.clear();
  }
}
