import * as fs from 'fs';
import * as path from 'path';
import { LLMService } from '../../llm/LLMService';
import { ConfigManager } from '../../config/ConfigManager';
import { TaskContext, TaskResult, PromptTemplate } from '../types';

export abstract class BaseAgent {
    protected llmService: LLMService;
    protected configManager: ConfigManager;
    protected prompts: Map<string, PromptTemplate> = new Map();

    constructor() {
        this.configManager = ConfigManager.getInstance();
        this.llmService = new LLMService(this.configManager);
        this.loadPrompts();
    }

    abstract executeTask(taskId: string, context: TaskContext): Promise<TaskResult>;

    protected async loadPrompts(): Promise<void> {
        // 載入 prompt 模板
        const promptsDir = path.join(__dirname, '../../prompts');
        
        try {
            const promptFiles = [
                'contributing.prompt.txt',
                'roadmap.prompt.txt',
                'changelog.prompt.txt'
            ];

            for (const file of promptFiles) {
                const promptPath = path.join(promptsDir, file);
                if (fs.existsSync(promptPath)) {
                    const template = fs.readFileSync(promptPath, 'utf-8');
                    const name = path.basename(file, '.prompt.txt');
                    
                    this.prompts.set(name, {
                        name,
                        template,
                        variables: this.extractVariables(template)
                    });
                }
            }
        } catch (error) {
            console.warn('無法載入 prompt 模板:', error);
        }
    }

    protected async buildPrompt(promptName: string, variables: Record<string, any>): Promise<string> {
        const promptTemplate = this.prompts.get(promptName);
        if (!promptTemplate) {
            throw new Error(`找不到 prompt 模板: ${promptName}`);
        }

        let prompt = promptTemplate.template;

        // 替換變數
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
        }

        return prompt;
    }

    protected extractVariables(template: string): string[] {
        const variableRegex = /\{\{(\w+)\}\}/g;
        const variables: string[] = [];
        let match;

        while ((match = variableRegex.exec(template)) !== null) {
            if (!variables.includes(match[1])) {
                variables.push(match[1]);
            }
        }

        return variables;
    }

    protected async analyzeProjectStructure(context: TaskContext): Promise<{
        hasPackageJson: boolean;
        hasTsConfig: boolean;
        hasGit: boolean;
        primaryLanguage: string;
        frameworks: string[];
        testFramework?: string;
        buildTool?: string;
    }> {
        const structure = await context.fileSystem.getProjectStructure();
        
        const analysis = {
            hasPackageJson: structure.includes('package.json'),
            hasTsConfig: structure.includes('tsconfig.json'),
            hasGit: structure.includes('.git') || structure.some(f => f.startsWith('.git/')),
            primaryLanguage: context.project.primaryLanguage,
            frameworks: [] as string[],
            testFramework: undefined as string | undefined,
            buildTool: undefined as string | undefined
        };

        // 檢測框架
        if (analysis.hasPackageJson) {
            try {
                const packageJson = JSON.parse(await context.fileSystem.readFile('package.json'));
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

                // 檢測前端框架
                if (dependencies.react) analysis.frameworks.push('React');
                if (dependencies.vue) analysis.frameworks.push('Vue');
                if (dependencies.angular) analysis.frameworks.push('Angular');
                if (dependencies.svelte) analysis.frameworks.push('Svelte');

                // 檢測後端框架
                if (dependencies.express) analysis.frameworks.push('Express');
                if (dependencies.fastify) analysis.frameworks.push('Fastify');
                if (dependencies.nestjs) analysis.frameworks.push('NestJS');

                // 檢測測試框架
                if (dependencies.jest) analysis.testFramework = 'Jest';
                else if (dependencies.mocha) analysis.testFramework = 'Mocha';
                else if (dependencies.vitest) analysis.testFramework = 'Vitest';

                // 檢測建置工具
                if (dependencies.webpack) analysis.buildTool = 'Webpack';
                else if (dependencies.vite) analysis.buildTool = 'Vite';
                else if (dependencies.rollup) analysis.buildTool = 'Rollup';

            } catch (error) {
                console.warn('無法解析 package.json:', error);
            }
        }

        return analysis;
    }

    protected async detectProjectType(context: TaskContext): Promise<'library' | 'application' | 'extension' | 'unknown'> {
        try {
            if (await context.fileSystem.fileExists('package.json')) {
                const packageJson = JSON.parse(await context.fileSystem.readFile('package.json'));
                
                // VS Code Extension
                if (packageJson.engines?.vscode) {
                    return 'extension';
                }
                
                // Library (有 main 或 exports，但沒有 private: true)
                if ((packageJson.main || packageJson.exports) && !packageJson.private) {
                    return 'library';
                }
                
                // Application
                return 'application';
            }
            
            // Python 專案
            if (await context.fileSystem.fileExists('setup.py') || 
                await context.fileSystem.fileExists('pyproject.toml')) {
                return 'library';
            }
            
            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    protected formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    protected generateTimestamp(): string {
        return new Date().toISOString().split('T')[0];
    }

    protected sanitizeFileName(fileName: string): string {
        return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    }

    protected async validateInputs(context: TaskContext, requiredInputs: string[]): Promise<void> {
        const missingInputs = requiredInputs.filter(input => 
            !(input in context.inputs) || context.inputs[input] === undefined
        );

        if (missingInputs.length > 0) {
            throw new Error(`缺少必要的輸入參數: ${missingInputs.join(', ')}`);
        }
    }

    protected async handleError(error: Error, context: TaskContext): Promise<TaskResult> {
        await context.ui.showMessage(`執行失敗: ${error.message}`, 'error');
        
        return {
            success: false,
            message: error.message,
            error
        };
    }

    public getLLMService(): LLMService {
        return this.llmService;
    }

    protected async retryOperation<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        delay: number = 1000
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                
                if (attempt === maxRetries) {
                    throw lastError;
                }

                // 等待後重試
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }

        throw lastError!;
    }
}
