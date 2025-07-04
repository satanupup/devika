import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface LanguageConfig {
    code: string; // ISO 639-1 language code
    name: string;
    nativeName: string;
    direction: 'ltr' | 'rtl';
    enabled: boolean;
    fallback?: string;
    translationProgress: number;
}

export interface TranslationEntry {
    key: string;
    sourceText: string;
    translatedText: string;
    context?: string;
    notes?: string;
    status: 'pending' | 'translated' | 'reviewed' | 'approved';
    lastUpdated: Date;
    translator?: string;
    reviewer?: string;
}

export interface DocumentTranslation {
    sourceLanguage: string;
    targetLanguage: string;
    sourceFile: string;
    targetFile: string;
    entries: TranslationEntry[];
    metadata: TranslationMetadata;
    progress: TranslationProgress;
}

export interface TranslationMetadata {
    title: string;
    description: string;
    version: string;
    created: Date;
    updated: Date;
    sourceWordCount: number;
    translatedWordCount: number;
    estimatedTime: string;
}

export interface TranslationProgress {
    totalEntries: number;
    translatedEntries: number;
    reviewedEntries: number;
    approvedEntries: number;
    percentage: number;
    estimatedCompletion: Date;
}

export interface TranslationProject {
    id: string;
    name: string;
    description: string;
    sourceLanguage: string;
    targetLanguages: string[];
    documents: DocumentTranslation[];
    settings: ProjectSettings;
    collaborators: Collaborator[];
    created: Date;
    updated: Date;
}

export interface ProjectSettings {
    autoTranslate: boolean;
    requireReview: boolean;
    translationMemory: boolean;
    glossary: boolean;
    qualityChecks: boolean;
    notifications: boolean;
}

export interface Collaborator {
    id: string;
    name: string;
    email: string;
    role: 'translator' | 'reviewer' | 'manager';
    languages: string[];
    permissions: string[];
}

export interface TranslationMemory {
    sourceText: string;
    targetText: string;
    sourceLanguage: string;
    targetLanguage: string;
    context: string;
    quality: number;
    usage: number;
    created: Date;
}

export interface GlossaryEntry {
    term: string;
    definition: string;
    translation: string;
    language: string;
    category: string;
    notes?: string;
    approved: boolean;
}

export interface QualityCheck {
    type: 'spelling' | 'grammar' | 'terminology' | 'consistency' | 'formatting';
    severity: 'error' | 'warning' | 'suggestion';
    message: string;
    position: { line: number; column: number };
    suggestion?: string;
}

export class MultiLanguageDocumentationSupport {
    private languages: Map<string, LanguageConfig> = new Map();
    private projects: Map<string, TranslationProject> = new Map();
    private translationMemory: TranslationMemory[] = [];
    private glossary: Map<string, GlossaryEntry[]> = new Map();
    private currentProject: TranslationProject | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.initializeLanguages();
        this.loadProjects();
        this.loadTranslationMemory();
        this.loadGlossary();
    }

    /**
     * 創建翻譯項目
     */
    async createTranslationProject(
        name: string,
        description: string,
        sourceLanguage: string,
        targetLanguages: string[]
    ): Promise<string> {
        const projectId = this.generateProjectId(name);

        const project: TranslationProject = {
            id: projectId,
            name,
            description,
            sourceLanguage,
            targetLanguages,
            documents: [],
            settings: {
                autoTranslate: false,
                requireReview: true,
                translationMemory: true,
                glossary: true,
                qualityChecks: true,
                notifications: true
            },
            collaborators: [],
            created: new Date(),
            updated: new Date()
        };

        this.projects.set(projectId, project);
        await this.saveProjects();

        return projectId;
    }

    /**
     * 添加文檔到翻譯項目
     */
    async addDocumentToProject(
        projectId: string,
        sourceFile: string,
        targetLanguages?: string[]
    ): Promise<void> {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`項目不存在: ${projectId}`);
        }

        const languages = targetLanguages || project.targetLanguages;

        for (const targetLanguage of languages) {
            const translation = await this.createDocumentTranslation(
                project.sourceLanguage,
                targetLanguage,
                sourceFile
            );

            project.documents.push(translation);
        }

        project.updated = new Date();
        await this.saveProjects();
    }

    /**
     * 創建文檔翻譯
     */
    private async createDocumentTranslation(
        sourceLanguage: string,
        targetLanguage: string,
        sourceFile: string
    ): Promise<DocumentTranslation> {
        const targetFile = this.generateTargetFileName(sourceFile, targetLanguage);

        // 解析源文檔
        const sourceContent = await this.readFile(sourceFile);
        const entries = await this.extractTranslatableEntries(sourceContent);

        // 計算元數據
        const metadata: TranslationMetadata = {
            title: path.basename(sourceFile),
            description: `${sourceLanguage} to ${targetLanguage} translation`,
            version: '1.0.0',
            created: new Date(),
            updated: new Date(),
            sourceWordCount: this.countWords(sourceContent),
            translatedWordCount: 0,
            estimatedTime: this.estimateTranslationTime(entries.length)
        };

        // 計算進度
        const progress: TranslationProgress = {
            totalEntries: entries.length,
            translatedEntries: 0,
            reviewedEntries: 0,
            approvedEntries: 0,
            percentage: 0,
            estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };

        return {
            sourceLanguage,
            targetLanguage,
            sourceFile,
            targetFile,
            entries,
            metadata,
            progress
        };
    }

    /**
     * 提取可翻譯條目
     */
    private async extractTranslatableEntries(content: string): Promise<TranslationEntry[]> {
        const entries: TranslationEntry[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 提取標題
            const titleMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (titleMatch) {
                entries.push({
                    key: `title_${i}`,
                    sourceText: titleMatch[2],
                    translatedText: '',
                    context: 'title',
                    status: 'pending',
                    lastUpdated: new Date()
                });
                continue;
            }

            // 提取段落文本
            if (line.trim() && !line.startsWith('```') && !line.startsWith('|')) {
                entries.push({
                    key: `text_${i}`,
                    sourceText: line.trim(),
                    translatedText: '',
                    context: 'paragraph',
                    status: 'pending',
                    lastUpdated: new Date()
                });
            }
        }

        return entries;
    }

    /**
     * 自動翻譯文檔
     */
    async autoTranslateDocument(
        projectId: string,
        documentIndex: number,
        provider: 'google' | 'microsoft' | 'deepl' = 'google'
    ): Promise<void> {
        const project = this.projects.get(projectId);
        if (!project || !project.documents[documentIndex]) {
            throw new Error('項目或文檔不存在');
        }

        const document = project.documents[documentIndex];

        for (const entry of document.entries) {
            if (entry.status === 'pending') {
                try {
                    // 檢查翻譯記憶庫
                    const memoryMatch = this.findTranslationMemoryMatch(
                        entry.sourceText,
                        document.sourceLanguage,
                        document.targetLanguage
                    );

                    if (memoryMatch && memoryMatch.quality > 0.8) {
                        entry.translatedText = memoryMatch.targetText;
                        entry.status = 'translated';
                        entry.notes = 'From translation memory';
                    } else {
                        // 使用自動翻譯服務
                        entry.translatedText = await this.translateText(
                            entry.sourceText,
                            document.sourceLanguage,
                            document.targetLanguage,
                            provider
                        );
                        entry.status = 'translated';
                        entry.notes = `Auto-translated using ${provider}`;
                    }

                    entry.lastUpdated = new Date();
                } catch (error) {
                    console.error(`翻譯失敗: ${entry.sourceText}`, error);
                }
            }
        }

        // 更新進度
        this.updateTranslationProgress(document);

        // 保存到翻譯記憶庫
        await this.saveToTranslationMemory(document);

        await this.saveProjects();
    }

    /**
     * 生成翻譯文檔
     */
    async generateTranslatedDocument(projectId: string, documentIndex: number): Promise<string> {
        const project = this.projects.get(projectId);
        if (!project || !project.documents[documentIndex]) {
            throw new Error('項目或文檔不存在');
        }

        const document = project.documents[documentIndex];
        const sourceContent = await this.readFile(document.sourceFile);

        let translatedContent = sourceContent;

        // 替換翻譯內容
        for (const entry of document.entries) {
            if (entry.translatedText && entry.status !== 'pending') {
                translatedContent = translatedContent.replace(
                    entry.sourceText,
                    entry.translatedText
                );
            }
        }

        // 保存翻譯文檔
        await this.writeFile(document.targetFile, translatedContent);

        return document.targetFile;
    }

    /**
     * 質量檢查
     */
    async performQualityCheck(projectId: string, documentIndex: number): Promise<QualityCheck[]> {
        const project = this.projects.get(projectId);
        if (!project || !project.documents[documentIndex]) {
            throw new Error('項目或文檔不存在');
        }

        const document = project.documents[documentIndex];
        const checks: QualityCheck[] = [];

        for (let i = 0; i < document.entries.length; i++) {
            const entry = document.entries[i];

            if (!entry.translatedText) {
                checks.push({
                    type: 'consistency',
                    severity: 'error',
                    message: '缺少翻譯',
                    position: { line: i + 1, column: 1 }
                });
                continue;
            }

            // 檢查術語一致性
            const glossaryIssues = this.checkGlossaryConsistency(entry, document.targetLanguage);
            checks.push(...glossaryIssues);

            // 檢查格式一致性
            const formatIssues = this.checkFormatConsistency(entry);
            checks.push(...formatIssues);

            // 檢查長度合理性
            const lengthIssues = this.checkLengthConsistency(entry);
            checks.push(...lengthIssues);
        }

        return checks;
    }

    /**
     * 導出翻譯項目
     */
    async exportTranslationProject(
        projectId: string,
        format: 'xliff' | 'tmx' | 'csv' | 'json' = 'json'
    ): Promise<string> {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`項目不存在: ${projectId}`);
        }

        switch (format) {
            case 'json':
                return JSON.stringify(project, null, 2);
            case 'csv':
                return this.exportToCSV(project);
            case 'xliff':
                return this.exportToXLIFF(project);
            case 'tmx':
                return this.exportToTMX(project);
            default:
                throw new Error(`不支援的格式: ${format}`);
        }
    }

    /**
     * 導入翻譯項目
     */
    async importTranslationProject(data: string, format: 'json' | 'csv' | 'xliff' = 'json'): Promise<string> {
        let project: TranslationProject;

        switch (format) {
            case 'json':
                project = JSON.parse(data);
                break;
            case 'csv':
                project = this.importFromCSV(data);
                break;
            case 'xliff':
                project = this.importFromXLIFF(data);
                break;
            default:
                throw new Error(`不支援的格式: ${format}`);
        }

        // 生成新 ID 避免衝突
        project.id = this.generateProjectId(project.name);
        project.updated = new Date();

        this.projects.set(project.id, project);
        await this.saveProjects();

        return project.id;
    }

    /**
     * 獲取翻譯統計
     */
    getTranslationStatistics(projectId: string): any {
        const project = this.projects.get(projectId);
        if (!project) {
            throw new Error(`項目不存在: ${projectId}`);
        }

        const stats = {
            totalDocuments: project.documents.length,
            totalEntries: 0,
            translatedEntries: 0,
            reviewedEntries: 0,
            approvedEntries: 0,
            overallProgress: 0,
            languageProgress: {} as { [key: string]: number }
        };

        for (const document of project.documents) {
            stats.totalEntries += document.progress.totalEntries;
            stats.translatedEntries += document.progress.translatedEntries;
            stats.reviewedEntries += document.progress.reviewedEntries;
            stats.approvedEntries += document.progress.approvedEntries;

            stats.languageProgress[document.targetLanguage] = document.progress.percentage;
        }

        stats.overallProgress = stats.totalEntries > 0
            ? Math.round((stats.translatedEntries / stats.totalEntries) * 100)
            : 0;

        return stats;
    }

    // 私有輔助方法
    private initializeLanguages(): void {
        const languages: LanguageConfig[] = [
            { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', enabled: true, translationProgress: 100 },
            { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', enabled: true, translationProgress: 100 },
            { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', enabled: true, translationProgress: 0 },
            { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', enabled: true, translationProgress: 0 },
            { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', enabled: true, translationProgress: 0 },
            { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', enabled: true, translationProgress: 0 },
            { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', enabled: true, translationProgress: 0 },
            { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', enabled: true, translationProgress: 0 }
        ];

        for (const lang of languages) {
            this.languages.set(lang.code, lang);
        }
    }

    private generateProjectId(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    }

    private generateTargetFileName(sourceFile: string, targetLanguage: string): string {
        const ext = path.extname(sourceFile);
        const base = path.basename(sourceFile, ext);
        const dir = path.dirname(sourceFile);
        return path.join(dir, `${base}.${targetLanguage}${ext}`);
    }

    private countWords(text: string): number {
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }

    private estimateTranslationTime(entryCount: number): string {
        const hoursPerEntry = 0.1; // 假設每個條目需要6分鐘
        const totalHours = entryCount * hoursPerEntry;

        if (totalHours < 1) {return '< 1 小時';}
        if (totalHours < 24) {return `${Math.ceil(totalHours)} 小時`;}
        return `${Math.ceil(totalHours / 24)} 天`;
    }

    private findTranslationMemoryMatch(
        sourceText: string,
        sourceLanguage: string,
        targetLanguage: string
    ): TranslationMemory | undefined {
        return this.translationMemory.find(tm =>
            tm.sourceText === sourceText &&
            tm.sourceLanguage === sourceLanguage &&
            tm.targetLanguage === targetLanguage
        );
    }

    private async translateText(
        text: string,
        sourceLanguage: string,
        targetLanguage: string,
        provider: string
    ): Promise<string> {
        // 模擬翻譯服務調用
        // 實際實作中應該調用真實的翻譯 API
        return `[${targetLanguage.toUpperCase()}] ${text}`;
    }

    private updateTranslationProgress(document: DocumentTranslation): void {
        const progress = document.progress;
        progress.translatedEntries = document.entries.filter(e => e.status !== 'pending').length;
        progress.reviewedEntries = document.entries.filter(e => e.status === 'reviewed' || e.status === 'approved').length;
        progress.approvedEntries = document.entries.filter(e => e.status === 'approved').length;
        progress.percentage = Math.round((progress.translatedEntries / progress.totalEntries) * 100);
    }

    private async saveToTranslationMemory(document: DocumentTranslation): Promise<void> {
        for (const entry of document.entries) {
            if (entry.translatedText && entry.status !== 'pending') {
                const existing = this.findTranslationMemoryMatch(
                    entry.sourceText,
                    document.sourceLanguage,
                    document.targetLanguage
                );

                if (!existing) {
                    this.translationMemory.push({
                        sourceText: entry.sourceText,
                        targetText: entry.translatedText,
                        sourceLanguage: document.sourceLanguage,
                        targetLanguage: document.targetLanguage,
                        context: entry.context || '',
                        quality: 0.8,
                        usage: 1,
                        created: new Date()
                    });
                } else {
                    existing.usage++;
                }
            }
        }

        await this.saveTranslationMemory();
    }

    private checkGlossaryConsistency(entry: TranslationEntry, targetLanguage: string): QualityCheck[] {
        const checks: QualityCheck[] = [];
        const glossaryEntries = this.glossary.get(targetLanguage) || [];

        for (const glossaryEntry of glossaryEntries) {
            if (entry.sourceText.includes(glossaryEntry.term) &&
                !entry.translatedText.includes(glossaryEntry.translation)) {
                checks.push({
                    type: 'terminology',
                    severity: 'warning',
                    message: `術語 "${glossaryEntry.term}" 應翻譯為 "${glossaryEntry.translation}"`,
                    position: { line: 1, column: 1 },
                    suggestion: entry.translatedText.replace(glossaryEntry.term, glossaryEntry.translation)
                });
            }
        }

        return checks;
    }

    private checkFormatConsistency(entry: TranslationEntry): QualityCheck[] {
        const checks: QualityCheck[] = [];

        // 檢查 Markdown 格式
        const sourceMarkdown = entry.sourceText.match(/`[^`]+`/g) || [];
        const targetMarkdown = entry.translatedText.match(/`[^`]+`/g) || [];

        if (sourceMarkdown.length !== targetMarkdown.length) {
            checks.push({
                type: 'formatting',
                severity: 'warning',
                message: 'Markdown 代碼塊數量不一致',
                position: { line: 1, column: 1 }
            });
        }

        return checks;
    }

    private checkLengthConsistency(entry: TranslationEntry): QualityCheck[] {
        const checks: QualityCheck[] = [];
        const sourceLength = entry.sourceText.length;
        const targetLength = entry.translatedText.length;
        const ratio = targetLength / sourceLength;

        // 翻譯長度異常檢查
        if (ratio > 3 || ratio < 0.3) {
            checks.push({
                type: 'consistency',
                severity: 'warning',
                message: `翻譯長度異常 (比例: ${ratio.toFixed(2)})`,
                position: { line: 1, column: 1 }
            });
        }

        return checks;
    }

    private exportToCSV(project: TranslationProject): string {
        const headers = ['Source Language', 'Target Language', 'Source Text', 'Translated Text', 'Status', 'Context'];
        const rows = [headers.join(',')];

        for (const document of project.documents) {
            for (const entry of document.entries) {
                const row = [
                    document.sourceLanguage,
                    document.targetLanguage,
                    `"${entry.sourceText.replace(/"/g, '""')}"`,
                    `"${entry.translatedText.replace(/"/g, '""')}"`,
                    entry.status,
                    entry.context || ''
                ];
                rows.push(row.join(','));
            }
        }

        return rows.join('\n');
    }

    private exportToXLIFF(project: TranslationProject): string {
        // 簡化的 XLIFF 導出
        return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file source-language="${project.sourceLanguage}" target-language="${project.targetLanguages[0]}">
    <body>
      ${project.documents[0]?.entries.map(entry => `
      <trans-unit id="${entry.key}">
        <source>${entry.sourceText}</source>
        <target>${entry.translatedText}</target>
      </trans-unit>`).join('')}
    </body>
  </file>
</xliff>`;
    }

    private exportToTMX(project: TranslationProject): string {
        // 簡化的 TMX 導出
        return `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header>
    <prop type="x-filename">${project.name}.tmx</prop>
  </header>
  <body>
    ${this.translationMemory.map(tm => `
    <tu>
      <tuv xml:lang="${tm.sourceLanguage}">
        <seg>${tm.sourceText}</seg>
      </tuv>
      <tuv xml:lang="${tm.targetLanguage}">
        <seg>${tm.targetText}</seg>
      </tuv>
    </tu>`).join('')}
  </body>
</tmx>`;
    }

    private importFromCSV(data: string): TranslationProject {
        // 簡化的 CSV 導入
        throw new Error('CSV 導入功能尚未實作');
    }

    private importFromXLIFF(data: string): TranslationProject {
        // 簡化的 XLIFF 導入
        throw new Error('XLIFF 導入功能尚未實作');
    }

    private async readFile(filePath: string): Promise<string> {
        return await fs.promises.readFile(filePath, 'utf8');
    }

    private async writeFile(filePath: string, content: string): Promise<void> {
        await fs.promises.writeFile(filePath, content, 'utf8');
    }

    private loadProjects(): void {
        const projects = this.context.globalState.get<any[]>('translationProjects', []);
        for (const project of projects) {
            this.projects.set(project.id, {
                ...project,
                created: new Date(project.created),
                updated: new Date(project.updated)
            });
        }
    }

    private async saveProjects(): Promise<void> {
        const projects = Array.from(this.projects.values());
        await this.context.globalState.update('translationProjects', projects);
    }

    private loadTranslationMemory(): void {
        const memory = this.context.globalState.get<any[]>('translationMemory', []);
        this.translationMemory = memory.map(tm => ({
            ...tm,
            created: new Date(tm.created)
        }));
    }

    private async saveTranslationMemory(): Promise<void> {
        await this.context.globalState.update('translationMemory', this.translationMemory);
    }

    private loadGlossary(): void {
        const glossary = this.context.globalState.get<any>('glossary', {});
        for (const [language, entries] of Object.entries(glossary)) {
            this.glossary.set(language, entries as GlossaryEntry[]);
        }
    }

    private async saveGlossary(): Promise<void> {
        const glossaryObj = Object.fromEntries(this.glossary);
        await this.context.globalState.update('glossary', glossaryObj);
    }

    /**
     * 清理資源
     */
    dispose(): void {
        // 清理資源
    }
}
