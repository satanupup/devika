import * as vscode from 'vscode';
import { ContextAwareSystem, ContextType } from './ContextAwareSystem';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';
import { FileOperationUtils } from '../utils/FileOperationUtils';

/**
 * 記憶類型
 */
export enum MemoryType {
    USER_PREFERENCE = 'user_preference',
    CODE_PATTERN = 'code_pattern',
    CONVERSATION = 'conversation',
    SOLUTION = 'solution',
    ERROR_PATTERN = 'error_pattern',
    WORKFLOW = 'workflow'
}

/**
 * 記憶項目接口
 */
export interface MemoryItem {
    id: string;
    type: MemoryType;
    content: string;
    metadata: MemoryMetadata;
    strength: number; // 記憶強度 0-1
    lastAccessed: Date;
    accessCount: number;
    createdAt: Date;
    tags: string[];
}

/**
 * 記憶元數據
 */
export interface MemoryMetadata {
    context?: string;
    userId?: string;
    projectId?: string;
    language?: string;
    framework?: string;
    confidence?: number;
    relatedMemories?: string[];
    triggers?: string[];
}

/**
 * 學習模式
 */
export interface LearningPattern {
    pattern: string;
    frequency: number;
    contexts: string[];
    effectiveness: number;
    lastSeen: Date;
}

/**
 * 記憶與學習系統
 * 實現持續學習和記憶功能，自動更新並在對話中保持上下文
 */
export class MemorySystem {
    private static instance: MemorySystem;
    private memories: Map<string, MemoryItem> = new Map();
    private patterns: Map<string, LearningPattern> = new Map();
    private contextSystem: ContextAwareSystem;
    private memoryFile: vscode.Uri;

    private constructor() {
        this.contextSystem = ContextAwareSystem.getInstance();
        this.memoryFile = vscode.Uri.file(this.getMemoryFilePath());
        this.loadMemories();
        this.setupPeriodicSave();
    }

    static getInstance(): MemorySystem {
        if (!MemorySystem.instance) {
            MemorySystem.instance = new MemorySystem();
        }
        return MemorySystem.instance;
    }

    /**
     * 添加記憶
     */
    async addMemory(
        type: MemoryType,
        content: string,
        metadata: MemoryMetadata = {},
        strength: number = 0.5
    ): Promise<string> {
        const id = this.generateMemoryId();

        const memory: MemoryItem = {
            id,
            type,
            content,
            metadata,
            strength: Math.max(0, Math.min(1, strength)),
            lastAccessed: new Date(),
            accessCount: 1,
            createdAt: new Date(),
            tags: this.extractTags(content, metadata)
        };

        this.memories.set(id, memory);

        // 添加到上下文系統
        await this.contextSystem.addContext(
            ContextType.CONVERSATION,
            content,
            {
                tags: ['memory', type],
                priority: strength > 0.7 ? 'high' : 'medium'
            }
        );

        return id;
    }

    /**
     * 檢索相關記憶
     */
    async retrieveMemories(
        query: string,
        type?: MemoryType,
        maxResults: number = 10
    ): Promise<MemoryItem[]> {
        const queryLower = query.toLowerCase();
        let candidates = Array.from(this.memories.values());

        // 按類型過濾
        if (type) {
            candidates = candidates.filter(m => m.type === type);
        }

        // 計算相關性分數
        const scoredMemories = candidates.map(memory => ({
            memory,
            score: this.calculateRelevanceScore(memory, queryLower)
        }));

        // 排序並更新訪問統計
        const relevantMemories = scoredMemories
            .filter(item => item.score > 0.1)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(item => {
                item.memory.lastAccessed = new Date();
                item.memory.accessCount++;
                return item.memory;
            });

        return relevantMemories;
    }

    /**
     * 學習用戶偏好
     */
    async learnUserPreference(
        action: string,
        context: string,
        outcome: 'positive' | 'negative'
    ): Promise<void> {
        const content = `Action: ${action}, Context: ${context}, Outcome: ${outcome}`;
        const strength = outcome === 'positive' ? 0.8 : 0.3;

        await this.addMemory(
            MemoryType.USER_PREFERENCE,
            content,
            { context, confidence: strength },
            strength
        );

        // 更新學習模式
        this.updateLearningPattern(action, context, outcome === 'positive');
    }

    /**
     * 學習代碼模式
     */
    async learnCodePattern(
        pattern: string,
        language: string,
        effectiveness: number
    ): Promise<void> {
        await this.addMemory(
            MemoryType.CODE_PATTERN,
            pattern,
            { language, confidence: effectiveness },
            effectiveness
        );

        // 更新模式統計
        const patternKey = `${language}:${pattern}`;
        const existing = this.patterns.get(patternKey);

        if (existing) {
            existing.frequency++;
            existing.effectiveness = (existing.effectiveness + effectiveness) / 2;
            existing.lastSeen = new Date();
        } else {
            this.patterns.set(patternKey, {
                pattern,
                frequency: 1,
                contexts: [language],
                effectiveness,
                lastSeen: new Date()
            });
        }
    }

    /**
     * 記住解決方案
     */
    async rememberSolution(
        problem: string,
        solution: string,
        context: string,
        effectiveness: number
    ): Promise<void> {
        const content = `Problem: ${problem}\nSolution: ${solution}`;

        await this.addMemory(
            MemoryType.SOLUTION,
            content,
            { context, confidence: effectiveness },
            effectiveness
        );
    }

    /**
     * 獲取用戶偏好
     */
    async getUserPreferences(context?: string): Promise<MemoryItem[]> {
        let preferences = await this.retrieveMemories('', MemoryType.USER_PREFERENCE);

        if (context) {
            preferences = preferences.filter(p =>
                p.metadata.context?.includes(context) ||
                p.content.toLowerCase().includes(context.toLowerCase())
            );
        }

        return preferences.sort((a, b) => b.strength - a.strength);
    }

    /**
     * 獲取代碼模式建議
     */
    async getCodePatternSuggestions(language: string): Promise<LearningPattern[]> {
        return Array.from(this.patterns.values())
            .filter(p => p.contexts.includes(language))
            .sort((a, b) => b.effectiveness - a.effectiveness)
            .slice(0, 5);
    }

    /**
     * 強化記憶
     */
    reinforceMemory(memoryId: string, reinforcement: number): void {
        const memory = this.memories.get(memoryId);
        if (memory) {
            memory.strength = Math.min(1, memory.strength + reinforcement);
            memory.lastAccessed = new Date();
            memory.accessCount++;
        }
    }

    /**
     * 遺忘機制
     */
    async forgetOldMemories(): Promise<void> {
        const now = Date.now();
        const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

        for (const [id, memory] of this.memories.entries()) {
            // 計算遺忘因子
            const daysSinceAccess = (now - memory.lastAccessed.getTime()) / (24 * 60 * 60 * 1000);
            const forgetFactor = Math.exp(-daysSinceAccess / 30); // 30天半衰期

            memory.strength *= forgetFactor;

            // 移除非常弱的記憶
            if (memory.strength < 0.1 && memory.lastAccessed.getTime() < oneMonthAgo) {
                this.memories.delete(id);
            }
        }
    }

    /**
     * 計算相關性分數
     */
    private calculateRelevanceScore(memory: MemoryItem, query: string): number {
        let score = 0;

        // 內容匹配
        const contentLower = memory.content.toLowerCase();
        if (contentLower.includes(query)) {
            score += 0.5;
        }

        // 標籤匹配
        const tagMatch = memory.tags.some(tag =>
            tag.toLowerCase().includes(query) || query.includes(tag.toLowerCase())
        );
        if (tagMatch) {
            score += 0.3;
        }

        // 記憶強度
        score *= memory.strength;

        // 訪問頻率
        score *= Math.log(memory.accessCount + 1) / 10;

        // 時間衰減
        const daysSinceAccess = (Date.now() - memory.lastAccessed.getTime()) / (24 * 60 * 60 * 1000);
        score *= Math.exp(-daysSinceAccess / 30);

        return score;
    }

    /**
     * 更新學習模式
     */
    private updateLearningPattern(
        action: string,
        context: string,
        positive: boolean
    ): void {
        const patternKey = `${action}:${context}`;
        const existing = this.patterns.get(patternKey);

        if (existing) {
            existing.frequency++;
            existing.effectiveness = positive
                ? Math.min(1, existing.effectiveness + 0.1)
                : Math.max(0, existing.effectiveness - 0.1);
            existing.lastSeen = new Date();
        } else {
            this.patterns.set(patternKey, {
                pattern: action,
                frequency: 1,
                contexts: [context],
                effectiveness: positive ? 0.7 : 0.3,
                lastSeen: new Date()
            });
        }
    }

    /**
     * 提取標籤
     */
    private extractTags(content: string, metadata: MemoryMetadata): string[] {
        const tags: string[] = [];

        // 從內容中提取關鍵詞
        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        const keywords = words.filter(word =>
            word.length > 3 &&
            !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'who', 'oil', 'sit', 'set'].includes(word)
        );

        tags.push(...keywords.slice(0, 5));

        // 從元數據中添加標籤
        if (metadata.language) {tags.push(metadata.language);}
        if (metadata.framework) {tags.push(metadata.framework);}
        if (metadata.context) {tags.push(metadata.context);}

        return [...new Set(tags)]; // 去重
    }

    /**
     * 生成記憶 ID
     */
    private generateMemoryId(): string {
        return `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 獲取記憶文件路徑
     */
    private getMemoryFilePath(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return `${workspaceFolder.uri.fsPath}/.vscode/devika-memory.json`;
        }
        return `${require('os').homedir()}/.devika-memory.json`;
    }

    /**
     * 加載記憶
     */
    private async loadMemories(): Promise<void> {
        try {
            const content = await FileOperationUtils.readFile(this.memoryFile);
            if (content) {
                const data = JSON.parse(content);

                // 恢復記憶
                if (data.memories) {
                    for (const [id, memoryData] of Object.entries(data.memories)) {
                        const memory = memoryData as any;
                        memory.lastAccessed = new Date(memory.lastAccessed);
                        memory.createdAt = new Date(memory.createdAt);
                        this.memories.set(id, memory);
                    }
                }

                // 恢復模式
                if (data.patterns) {
                    for (const [key, patternData] of Object.entries(data.patterns)) {
                        const pattern = patternData as any;
                        pattern.lastSeen = new Date(pattern.lastSeen);
                        this.patterns.set(key, pattern);
                    }
                }
            }
        } catch (error) {
            console.warn('無法加載記憶文件:', error);
        }
    }

    /**
     * 保存記憶
     */
    private async saveMemories(): Promise<void> {
        try {
            const data = {
                memories: Object.fromEntries(this.memories),
                patterns: Object.fromEntries(this.patterns),
                lastSaved: new Date().toISOString()
            };

            await FileOperationUtils.writeFile(
                this.memoryFile,
                JSON.stringify(data, null, 2),
                { createDirectories: true, overwrite: true }
            );
        } catch (error) {
            console.error('保存記憶失敗:', error);
        }
    }

    /**
     * 設置定期保存
     */
    private setupPeriodicSave(): void {
        // 每5分鐘保存一次
        setInterval(() => {
            this.saveMemories();
        }, 5 * 60 * 1000);

        // 每小時執行一次遺忘機制
        setInterval(() => {
            this.forgetOldMemories();
        }, 60 * 60 * 1000);
    }

    /**
     * 獲取記憶統計
     */
    getMemoryStats(): {
        totalMemories: number;
        memoryTypes: Record<MemoryType, number>;
        averageStrength: number;
        totalPatterns: number;
    } {
        const memories = Array.from(this.memories.values());
        const memoryTypes: Record<MemoryType, number> = {
            [MemoryType.USER_PREFERENCE]: 0,
            [MemoryType.CODE_PATTERN]: 0,
            [MemoryType.CONVERSATION]: 0,
            [MemoryType.SOLUTION]: 0,
            [MemoryType.ERROR_PATTERN]: 0,
            [MemoryType.WORKFLOW]: 0
        };

        let totalStrength = 0;
        memories.forEach(memory => {
            memoryTypes[memory.type]++;
            totalStrength += memory.strength;
        });

        return {
            totalMemories: memories.length,
            memoryTypes,
            averageStrength: memories.length > 0 ? totalStrength / memories.length : 0,
            totalPatterns: this.patterns.size
        };
    }

    /**
     * 清除所有記憶
     */
    clearMemories(): void {
        this.memories.clear();
        this.patterns.clear();
        this.saveMemories();
    }
}
