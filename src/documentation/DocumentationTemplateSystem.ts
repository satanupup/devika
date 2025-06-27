import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface DocumentTemplate {
    id: string;
    name: string;
    description: string;
    category: DocumentCategory;
    language: 'zh' | 'en' | 'auto';
    fileExtension: string;
    template: string;
    variables: TemplateVariable[];
    sections: TemplateSection[];
    metadata: TemplateMetadata;
    customizable: boolean;
    tags: string[];
}

export enum DocumentCategory {
    README = 'readme',
    API = 'api',
    CONTRIBUTING = 'contributing',
    CHANGELOG = 'changelog',
    LICENSE = 'license',
    SECURITY = 'security',
    CODE_OF_CONDUCT = 'code_of_conduct',
    ISSUE_TEMPLATE = 'issue_template',
    PR_TEMPLATE = 'pr_template',
    DEPLOYMENT = 'deployment',
    ARCHITECTURE = 'architecture',
    USER_GUIDE = 'user_guide',
    DEVELOPER_GUIDE = 'developer_guide',
    TROUBLESHOOTING = 'troubleshooting',
    FAQ = 'faq'
}

export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
    description: string;
    required: boolean;
    defaultValue?: any;
    validation?: VariableValidation;
    options?: string[]; // For enum-like variables
}

export interface VariableValidation {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
}

export interface TemplateSection {
    id: string;
    name: string;
    description: string;
    required: boolean;
    order: number;
    template: string;
    condition?: string; // JavaScript expression
    variables: string[];
}

export interface TemplateMetadata {
    version: string;
    author: string;
    created: Date;
    updated: Date;
    projectTypes: string[];
    frameworks: string[];
    languages: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedTime: string;
}

export interface DocumentGenerationOptions {
    templateId: string;
    variables: { [key: string]: any };
    sections?: string[];
    outputPath?: string;
    overwrite?: boolean;
    format?: 'markdown' | 'html' | 'pdf';
    style?: 'minimal' | 'standard' | 'comprehensive';
}

export interface GeneratedDocument {
    content: string;
    metadata: DocumentMetadata;
    sections: GeneratedSection[];
    variables: { [key: string]: any };
    template: DocumentTemplate;
}

export interface DocumentMetadata {
    title: string;
    description: string;
    author: string;
    created: Date;
    wordCount: number;
    estimatedReadTime: number;
    language: string;
    tags: string[];
}

export interface GeneratedSection {
    id: string;
    name: string;
    content: string;
    order: number;
    wordCount: number;
}

export class DocumentationTemplateSystem {
    private templates: Map<string, DocumentTemplate> = new Map();
    private customTemplates: Map<string, DocumentTemplate> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.initializeBuiltInTemplates();
        this.loadCustomTemplates();
    }

    /**
     * 生成文檔
     */
    async generateDocument(options: DocumentGenerationOptions): Promise<GeneratedDocument> {
        const template = this.getTemplate(options.templateId);
        if (!template) {
            throw new Error(`模板不存在: ${options.templateId}`);
        }

        // 驗證變數
        this.validateVariables(template, options.variables);

        // 生成內容
        const content = await this.renderTemplate(template, options);

        // 生成元數據
        const metadata = this.generateMetadata(content, template, options);

        // 生成章節
        const sections = this.generateSections(template, options.variables);

        const document: GeneratedDocument = {
            content,
            metadata,
            sections,
            variables: options.variables,
            template
        };

        // 保存文檔
        if (options.outputPath) {
            await this.saveDocument(document, options.outputPath, options.overwrite);
        }

        return document;
    }

    /**
     * 獲取模板
     */
    getTemplate(templateId: string): DocumentTemplate | undefined {
        return this.templates.get(templateId) || this.customTemplates.get(templateId);
    }

    /**
     * 獲取所有模板
     */
    getAllTemplates(): DocumentTemplate[] {
        return [...this.templates.values(), ...this.customTemplates.values()];
    }

    /**
     * 按類別獲取模板
     */
    getTemplatesByCategory(category: DocumentCategory): DocumentTemplate[] {
        return this.getAllTemplates().filter(template => template.category === category);
    }

    /**
     * 創建自定義模板
     */
    async createCustomTemplate(template: Omit<DocumentTemplate, 'id' | 'metadata'>): Promise<string> {
        const id = this.generateTemplateId(template.name);
        const fullTemplate: DocumentTemplate = {
            ...template,
            id,
            metadata: {
                version: '1.0.0',
                author: 'User',
                created: new Date(),
                updated: new Date(),
                projectTypes: [],
                frameworks: [],
                languages: [],
                complexity: 'simple',
                estimatedTime: '5-10 分鐘'
            }
        };

        this.customTemplates.set(id, fullTemplate);
        await this.saveCustomTemplates();

        return id;
    }

    /**
     * 更新自定義模板
     */
    async updateCustomTemplate(templateId: string, updates: Partial<DocumentTemplate>): Promise<void> {
        const template = this.customTemplates.get(templateId);
        if (!template) {
            throw new Error(`自定義模板不存在: ${templateId}`);
        }

        const updatedTemplate = {
            ...template,
            ...updates,
            metadata: {
                ...template.metadata,
                ...updates.metadata,
                updated: new Date()
            }
        };

        this.customTemplates.set(templateId, updatedTemplate);
        await this.saveCustomTemplates();
    }

    /**
     * 刪除自定義模板
     */
    async deleteCustomTemplate(templateId: string): Promise<void> {
        if (!this.customTemplates.has(templateId)) {
            throw new Error(`自定義模板不存在: ${templateId}`);
        }

        this.customTemplates.delete(templateId);
        await this.saveCustomTemplates();
    }

    /**
     * 驗證變數
     */
    private validateVariables(template: DocumentTemplate, variables: { [key: string]: any }): void {
        for (const variable of template.variables) {
            const value = variables[variable.name];

            if (variable.required && (value === undefined || value === null || value === '')) {
                throw new Error(`必需變數缺失: ${variable.name}`);
            }

            if (value !== undefined && variable.validation) {
                this.validateVariableValue(variable, value);
            }
        }
    }

    /**
     * 驗證變數值
     */
    private validateVariableValue(variable: TemplateVariable, value: any): void {
        const validation = variable.validation!;

        if (variable.type === 'string' && typeof value === 'string') {
            if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
                throw new Error(`變數 ${variable.name} 格式不正確`);
            }
            if (validation.minLength && value.length < validation.minLength) {
                throw new Error(`變數 ${variable.name} 長度不足`);
            }
            if (validation.maxLength && value.length > validation.maxLength) {
                throw new Error(`變數 ${variable.name} 長度超限`);
            }
        }

        if (variable.type === 'number' && typeof value === 'number') {
            if (validation.min !== undefined && value < validation.min) {
                throw new Error(`變數 ${variable.name} 值過小`);
            }
            if (validation.max !== undefined && value > validation.max) {
                throw new Error(`變數 ${variable.name} 值過大`);
            }
        }
    }

    /**
     * 渲染模板
     */
    private async renderTemplate(template: DocumentTemplate, options: DocumentGenerationOptions): Promise<string> {
        let content = template.template;

        // 替換變數
        for (const [key, value] of Object.entries(options.variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            content = content.replace(regex, this.formatValue(value));
        }

        // 處理條件章節
        if (options.sections) {
            const sectionsToInclude = template.sections.filter(section => 
                options.sections!.includes(section.id) && this.evaluateCondition(section.condition, options.variables)
            );

            const sectionContent = sectionsToInclude
                .sort((a, b) => a.order - b.order)
                .map(section => this.renderSection(section, options.variables))
                .join('\n\n');

            content = content.replace('{{sections}}', sectionContent);
        }

        // 處理內建函數
        content = await this.processBuiltInFunctions(content, options);

        return content;
    }

    /**
     * 渲染章節
     */
    private renderSection(section: TemplateSection, variables: { [key: string]: any }): string {
        let content = section.template;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            content = content.replace(regex, this.formatValue(value));
        }

        return content;
    }

    /**
     * 評估條件
     */
    private evaluateCondition(condition: string | undefined, variables: { [key: string]: any }): boolean {
        if (!condition) return true;

        try {
            // 簡單的條件評估（生產環境中應使用更安全的方法）
            const func = new Function(...Object.keys(variables), `return ${condition}`);
            return func(...Object.values(variables));
        } catch {
            return false;
        }
    }

    /**
     * 格式化值
     */
    private formatValue(value: any): string {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        return String(value);
    }

    /**
     * 處理內建函數
     */
    private async processBuiltInFunctions(content: string, options: DocumentGenerationOptions): Promise<string> {
        // 處理日期函數
        content = content.replace(/{{date\(\)}}/g, new Date().toLocaleDateString());
        content = content.replace(/{{datetime\(\)}}/g, new Date().toLocaleString());

        // 處理文件信息函數
        if (options.outputPath) {
            const fileName = path.basename(options.outputPath, path.extname(options.outputPath));
            content = content.replace(/{{filename}}/g, fileName);
        }

        return content;
    }

    /**
     * 生成元數據
     */
    private generateMetadata(content: string, template: DocumentTemplate, options: DocumentGenerationOptions): DocumentMetadata {
        const wordCount = content.split(/\s+/).length;
        const estimatedReadTime = Math.ceil(wordCount / 200); // 假設每分鐘讀200字

        return {
            title: options.variables.title || template.name,
            description: options.variables.description || template.description,
            author: options.variables.author || 'Unknown',
            created: new Date(),
            wordCount,
            estimatedReadTime,
            language: template.language === 'auto' ? 'zh' : template.language,
            tags: template.tags
        };
    }

    /**
     * 生成章節
     */
    private generateSections(template: DocumentTemplate, variables: { [key: string]: any }): GeneratedSection[] {
        return template.sections.map(section => ({
            id: section.id,
            name: section.name,
            content: this.renderSection(section, variables),
            order: section.order,
            wordCount: this.renderSection(section, variables).split(/\s+/).length
        }));
    }

    /**
     * 保存文檔
     */
    private async saveDocument(document: GeneratedDocument, outputPath: string, overwrite: boolean = false): Promise<void> {
        const uri = vscode.Uri.file(outputPath);

        // 檢查文件是否存在
        try {
            await vscode.workspace.fs.stat(uri);
            if (!overwrite) {
                const choice = await vscode.window.showWarningMessage(
                    `文件 ${outputPath} 已存在，是否覆蓋？`,
                    '覆蓋',
                    '取消'
                );
                if (choice !== '覆蓋') {
                    return;
                }
            }
        } catch {
            // 文件不存在，可以創建
        }

        await vscode.workspace.fs.writeFile(uri, Buffer.from(document.content, 'utf8'));
    }

    /**
     * 初始化內建模板
     */
    private initializeBuiltInTemplates(): void {
        // README 模板
        this.templates.set('readme-standard', {
            id: 'readme-standard',
            name: '標準 README',
            description: '標準的項目 README 模板',
            category: DocumentCategory.README,
            language: 'auto',
            fileExtension: '.md',
            template: `# {{projectName}}

{{description}}

## 功能特性

{{#each features}}
- {{this}}
{{/each}}

## 安裝

\`\`\`bash
{{installCommand}}
\`\`\`

## 使用方法

{{usage}}

## 貢獻

歡迎貢獻！請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md) 了解詳情。

## 許可證

{{license}}
`,
            variables: [
                {
                    name: 'projectName',
                    type: 'string',
                    description: '項目名稱',
                    required: true
                },
                {
                    name: 'description',
                    type: 'string',
                    description: '項目描述',
                    required: true
                },
                {
                    name: 'features',
                    type: 'array',
                    description: '功能特性列表',
                    required: false,
                    defaultValue: []
                },
                {
                    name: 'installCommand',
                    type: 'string',
                    description: '安裝命令',
                    required: false,
                    defaultValue: 'npm install'
                },
                {
                    name: 'usage',
                    type: 'string',
                    description: '使用說明',
                    required: false,
                    defaultValue: '請參考文檔'
                },
                {
                    name: 'license',
                    type: 'string',
                    description: '許可證',
                    required: false,
                    defaultValue: 'MIT'
                }
            ],
            sections: [],
            metadata: {
                version: '1.0.0',
                author: 'Devika',
                created: new Date(),
                updated: new Date(),
                projectTypes: ['all'],
                frameworks: ['all'],
                languages: ['all'],
                complexity: 'simple',
                estimatedTime: '5-10 分鐘'
            },
            customizable: true,
            tags: ['readme', 'documentation', 'standard']
        });

        // CONTRIBUTING 模板
        this.templates.set('contributing-standard', {
            id: 'contributing-standard',
            name: '貢獻指南',
            description: '標準的貢獻指南模板',
            category: DocumentCategory.CONTRIBUTING,
            language: 'auto',
            fileExtension: '.md',
            template: `# 貢獻指南

感謝您對 {{projectName}} 的關注！我們歡迎各種形式的貢獻。

## 如何貢獻

### 報告問題

如果您發現了 bug 或有功能建議，請：

1. 檢查是否已有相關 issue
2. 創建新的 issue，詳細描述問題
3. 提供重現步驟和環境信息

### 提交代碼

1. Fork 本倉庫
2. 創建功能分支：\`git checkout -b feature/amazing-feature\`
3. 提交更改：\`git commit -m 'Add amazing feature'\`
4. 推送分支：\`git push origin feature/amazing-feature\`
5. 創建 Pull Request

## 開發環境設置

{{developmentSetup}}

## 代碼規範

{{codeStandards}}

## 測試

{{testingGuidelines}}

## 許可證

通過貢獻，您同意您的貢獻將在 {{license}} 許可證下授權。
`,
            variables: [
                {
                    name: 'projectName',
                    type: 'string',
                    description: '項目名稱',
                    required: true
                },
                {
                    name: 'developmentSetup',
                    type: 'string',
                    description: '開發環境設置說明',
                    required: false,
                    defaultValue: '請參考 README.md'
                },
                {
                    name: 'codeStandards',
                    type: 'string',
                    description: '代碼規範',
                    required: false,
                    defaultValue: '遵循項目現有代碼風格'
                },
                {
                    name: 'testingGuidelines',
                    type: 'string',
                    description: '測試指南',
                    required: false,
                    defaultValue: '確保所有測試通過'
                },
                {
                    name: 'license',
                    type: 'string',
                    description: '許可證',
                    required: false,
                    defaultValue: 'MIT'
                }
            ],
            sections: [],
            metadata: {
                version: '1.0.0',
                author: 'Devika',
                created: new Date(),
                updated: new Date(),
                projectTypes: ['all'],
                frameworks: ['all'],
                languages: ['all'],
                complexity: 'simple',
                estimatedTime: '10-15 分鐘'
            },
            customizable: true,
            tags: ['contributing', 'guidelines', 'collaboration']
        });
    }

    /**
     * 生成模板 ID
     */
    private generateTemplateId(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    }

    /**
     * 載入自定義模板
     */
    private loadCustomTemplates(): void {
        const templates = this.context.globalState.get<any[]>('customTemplates', []);
        for (const template of templates) {
            this.customTemplates.set(template.id, {
                ...template,
                metadata: {
                    ...template.metadata,
                    created: new Date(template.metadata.created),
                    updated: new Date(template.metadata.updated)
                }
            });
        }
    }

    /**
     * 保存自定義模板
     */
    private async saveCustomTemplates(): Promise<void> {
        const templates = Array.from(this.customTemplates.values());
        await this.context.globalState.update('customTemplates', templates);
    }

    /**
     * 導出模板
     */
    async exportTemplate(templateId: string): Promise<string> {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`模板不存在: ${templateId}`);
        }

        return JSON.stringify(template, null, 2);
    }

    /**
     * 導入模板
     */
    async importTemplate(templateJson: string): Promise<string> {
        try {
            const template = JSON.parse(templateJson) as DocumentTemplate;
            
            // 驗證模板格式
            this.validateTemplate(template);

            // 生成新 ID 避免衝突
            const newId = this.generateTemplateId(template.name);
            template.id = newId;

            this.customTemplates.set(newId, template);
            await this.saveCustomTemplates();

            return newId;
        } catch (error) {
            throw new Error(`導入模板失敗: ${error}`);
        }
    }

    /**
     * 驗證模板格式
     */
    private validateTemplate(template: any): void {
        const requiredFields = ['name', 'description', 'category', 'template', 'variables'];
        for (const field of requiredFields) {
            if (!template[field]) {
                throw new Error(`模板缺少必需字段: ${field}`);
            }
        }
    }

    /**
     * 清理資源
     */
    dispose(): void {
        // 清理資源
    }
}
