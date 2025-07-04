import * as vscode from 'vscode';
import { CodeUnderstandingEngine, CodeSymbol, CodeAnalysis } from './CodeUnderstandingEngine';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';
import { FileOperationUtils } from '../utils/FileOperationUtils';

/**
 * 上下文類型
 */
export enum ContextType {
    FILE = 'file',
    SYMBOL = 'symbol',
    SELECTION = 'selection',
    WORKSPACE = 'workspace',
    CONVERSATION = 'conversation',
    TASK = 'task',
    ERROR = 'error'
}

/**
 * 上下文項目接口
 */
export interface ContextItem {
    id: string;
    type: ContextType;
    content: string;
    metadata: ContextMetadata;
    relevanceScore: number;
    timestamp: Date;
    size: number;
}

/**
 * 上下文元數據
 */
export interface ContextMetadata {
    uri?: vscode.Uri;
    range?: vscode.Range;
    language?: string;
    symbols?: CodeSymbol[];
    dependencies?: string[];
    tags?: string[];
    userIntent?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 上下文查詢接口
 */
export interface ContextQuery {
    query: string;
    types?: ContextType[];
    maxResults?: number;
    minRelevance?: number;
    timeRange?: {
        start: Date;
        end: Date;
    };
    includeMetadata?: boolean;
}

/**
 * 上下文摘要接口
 */
export interface ContextSummary {
    totalItems: number;
    totalSize: number;
    typeDistribution: Record<ContextType, number>;
    relevanceDistribution: {
        high: number;
        medium: number;
        low: number;
    };
    recentActivity: ContextItem[];
    topSymbols: CodeSymbol[];
}

/**
 * 上下文感知系統
 * 實現 200K 上下文容量的智能上下文管理
 */
export class ContextAwareSystem {
    private static instance: ContextAwareSystem;
    private contextItems: Map<string, ContextItem> = new Map();
    private codeEngine: CodeUnderstandingEngine;
    private readonly maxContextSize = 200 * 1024; // 200K characters
    private readonly maxItems = 1000;
    private currentContextSize = 0;

    private constructor() {
        this.codeEngine = CodeUnderstandingEngine.getInstance();
        this.setupEventListeners();
    }

    static getInstance(): ContextAwareSystem {
        if (!ContextAwareSystem.instance) {
            ContextAwareSystem.instance = new ContextAwareSystem();
        }
        return ContextAwareSystem.instance;
    }

    /**
     * 添加上下文項目
     */
    async addContext(
        type: ContextType,
        content: string,
        metadata: ContextMetadata = {}
    ): Promise<string> {
        const id = this.generateContextId();
        const size = content.length;

        // 檢查是否需要清理空間
        if (this.currentContextSize + size > this.maxContextSize) {
            await this.cleanupContext(size);
        }

        const contextItem: ContextItem = {
            id,
            type,
            content,
            metadata,
            relevanceScore: await this.calculateRelevance(content, metadata),
            timestamp: new Date(),
            size
        };

        this.contextItems.set(id, contextItem);
        this.currentContextSize += size;

        return id;
    }

    /**
     * 添加文件上下文
     */
    async addFileContext(uri: vscode.Uri): Promise<string> {
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const content = await FileOperationUtils.readFile(uri);
                if (!content) {
                    throw new Error('無法讀取文件內容');
                }

                const analysis = await this.codeEngine.analyzeFile(uri);

                return this.addContext(ContextType.FILE, content, {
                    uri,
                    language: this.getLanguageFromUri(uri),
                    symbols: analysis.symbols,
                    dependencies: analysis.dependencies,
                    priority: 'medium'
                });
            },
            `添加文件上下文 ${uri.fsPath}`,
            { logError: true, showToUser: false }
        ).then(result => result.success ? result.data! : '');
    }

    /**
     * 添加選擇上下文
     */
    async addSelectionContext(
        uri: vscode.Uri,
        range: vscode.Range,
        content: string
    ): Promise<string> {
        const symbols = await this.getSymbolsInRange(uri, range);

        return this.addContext(ContextType.SELECTION, content, {
            uri,
            range,
            language: this.getLanguageFromUri(uri),
            symbols,
            priority: 'high'
        });
    }

    /**
     * 添加符號上下文
     */
    async addSymbolContext(symbol: CodeSymbol): Promise<string> {
        const content = await this.getSymbolContent(symbol);

        return this.addContext(ContextType.SYMBOL, content, {
            uri: symbol.uri,
            range: symbol.range,
            symbols: [symbol],
            tags: [symbol.type],
            priority: 'medium'
        });
    }

    /**
     * 添加對話上下文
     */
    async addConversationContext(
        userMessage: string,
        assistantResponse: string,
        intent?: string
    ): Promise<string> {
        const content = `User: ${userMessage}\nAssistant: ${assistantResponse}`;

        return this.addContext(ContextType.CONVERSATION, content, {
            userIntent: intent,
            priority: 'high'
        });
    }

    /**
     * 查詢上下文
     */
    async queryContext(query: ContextQuery): Promise<ContextItem[]> {
        const items = Array.from(this.contextItems.values());

        let filteredItems = items;

        // 按類型過濾
        if (query.types && query.types.length > 0) {
            filteredItems = filteredItems.filter(item =>
                query.types!.includes(item.type)
            );
        }

        // 按時間範圍過濾
        if (query.timeRange) {
            filteredItems = filteredItems.filter(item =>
                item.timestamp >= query.timeRange!.start &&
                item.timestamp <= query.timeRange!.end
            );
        }

        // 按相關性過濾
        if (query.minRelevance) {
            filteredItems = filteredItems.filter(item =>
                item.relevanceScore >= query.minRelevance!
            );
        }

        // 文本搜索
        if (query.query) {
            filteredItems = filteredItems.filter(item =>
                this.matchesQuery(item, query.query)
            );
        }

        // 按相關性排序
        filteredItems.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // 限制結果數量
        if (query.maxResults) {
            filteredItems = filteredItems.slice(0, query.maxResults);
        }

        return filteredItems;
    }

    /**
     * 獲取當前上下文摘要
     */
    getContextSummary(): ContextSummary {
        const items = Array.from(this.contextItems.values());

        const typeDistribution: Record<ContextType, number> = {
            [ContextType.FILE]: 0,
            [ContextType.SYMBOL]: 0,
            [ContextType.SELECTION]: 0,
            [ContextType.WORKSPACE]: 0,
            [ContextType.CONVERSATION]: 0,
            [ContextType.TASK]: 0,
            [ContextType.ERROR]: 0
        };

        const relevanceDistribution = {
            high: 0,
            medium: 0,
            low: 0
        };

        let totalSize = 0;
        const allSymbols: CodeSymbol[] = [];

        items.forEach(item => {
            typeDistribution[item.type]++;
            totalSize += item.size;

            if (item.relevanceScore >= 0.7) {
                relevanceDistribution.high++;
            } else if (item.relevanceScore >= 0.4) {
                relevanceDistribution.medium++;
            } else {
                relevanceDistribution.low++;
            }

            if (item.metadata.symbols) {
                allSymbols.push(...item.metadata.symbols);
            }
        });

        // 獲取最近活動
        const recentActivity = items
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 10);

        // 獲取頂級符號
        const symbolCounts = new Map<string, number>();
        allSymbols.forEach(symbol => {
            const count = symbolCounts.get(symbol.name) || 0;
            symbolCounts.set(symbol.name, count + 1);
        });

        const topSymbols = Array.from(symbolCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name]) => allSymbols.find(s => s.name === name)!)
            .filter(Boolean);

        return {
            totalItems: items.length,
            totalSize,
            typeDistribution,
            relevanceDistribution,
            recentActivity,
            topSymbols
        };
    }

    /**
     * 獲取相關上下文
     */
    async getRelevantContext(
        query: string,
        maxTokens: number = 150000 // 約 200K 字符
    ): Promise<ContextItem[]> {
        const allItems = Array.from(this.contextItems.values());

        // 計算每個項目與查詢的相關性
        const scoredItems = await Promise.all(
            allItems.map(async item => ({
                item,
                score: await this.calculateQueryRelevance(item, query)
            }))
        );

        // 按分數排序
        scoredItems.sort((a, b) => b.score - a.score);

        // 選擇最相關的項目，直到達到令牌限制
        const selectedItems: ContextItem[] = [];
        let currentTokens = 0;

        for (const { item } of scoredItems) {
            if (currentTokens + item.size <= maxTokens) {
                selectedItems.push(item);
                currentTokens += item.size;
            } else {
                break;
            }
        }

        return selectedItems;
    }

    /**
     * 清理上下文
     */
    private async cleanupContext(requiredSpace: number): Promise<void> {
        const items = Array.from(this.contextItems.values());

        // 按優先級和時間排序（優先級低且時間久的先清理）
        items.sort((a, b) => {
            const priorityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
            const aPriority = priorityOrder[a.metadata.priority || 'medium'];
            const bPriority = priorityOrder[b.metadata.priority || 'medium'];

            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }

            return a.timestamp.getTime() - b.timestamp.getTime();
        });

        let freedSpace = 0;
        for (const item of items) {
            if (freedSpace >= requiredSpace) {break;}

            this.contextItems.delete(item.id);
            this.currentContextSize -= item.size;
            freedSpace += item.size;
        }
    }

    /**
     * 計算相關性分數
     */
    private async calculateRelevance(
        content: string,
        metadata: ContextMetadata
    ): Promise<number> {
        let score = 0.5; // 基礎分數

        // 根據類型調整分數
        if (metadata.priority) {
            const priorityBonus = {
                low: 0,
                medium: 0.1,
                high: 0.2,
                critical: 0.3
            };
            score += priorityBonus[metadata.priority];
        }

        // 根據符號數量調整分數
        if (metadata.symbols && metadata.symbols.length > 0) {
            score += Math.min(0.2, metadata.symbols.length * 0.02);
        }

        // 根據內容長度調整分數（適中長度得分更高）
        const contentLength = content.length;
        if (contentLength > 100 && contentLength < 5000) {
            score += 0.1;
        }

        return Math.min(1.0, score);
    }

    /**
     * 計算查詢相關性
     */
    private async calculateQueryRelevance(
        item: ContextItem,
        query: string
    ): Promise<number> {
        let score = item.relevanceScore;

        // 文本匹配
        const queryLower = query.toLowerCase();
        const contentLower = item.content.toLowerCase();

        if (contentLower.includes(queryLower)) {
            score += 0.3;
        }

        // 符號匹配
        if (item.metadata.symbols) {
            const symbolMatch = item.metadata.symbols.some(symbol =>
                symbol.name.toLowerCase().includes(queryLower)
            );
            if (symbolMatch) {
                score += 0.2;
            }
        }

        // 標籤匹配
        if (item.metadata.tags) {
            const tagMatch = item.metadata.tags.some(tag =>
                tag.toLowerCase().includes(queryLower)
            );
            if (tagMatch) {
                score += 0.1;
            }
        }

        return Math.min(1.0, score);
    }

    /**
     * 檢查項目是否匹配查詢
     */
    private matchesQuery(item: ContextItem, query: string): boolean {
        const queryLower = query.toLowerCase();

        // 檢查內容
        if (item.content.toLowerCase().includes(queryLower)) {
            return true;
        }

        // 檢查符號名稱
        if (item.metadata.symbols) {
            const symbolMatch = item.metadata.symbols.some(symbol =>
                symbol.name.toLowerCase().includes(queryLower)
            );
            if (symbolMatch) {return true;}
        }

        // 檢查標籤
        if (item.metadata.tags) {
            const tagMatch = item.metadata.tags.some(tag =>
                tag.toLowerCase().includes(queryLower)
            );
            if (tagMatch) {return true;}
        }

        return false;
    }

    /**
     * 設置事件監聽器
     */
    private setupEventListeners(): void {
        // 監聽文件變更
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            await this.addFileContext(event.document.uri);
        });

        // 監聽選擇變更
        vscode.window.onDidChangeTextEditorSelection(async (event) => {
            if (!event.selections[0].isEmpty) {
                const selection = event.selections[0];
                const content = event.textEditor.document.getText(selection);
                await this.addSelectionContext(
                    event.textEditor.document.uri,
                    selection,
                    content
                );
            }
        });
    }

    /**
     * 輔助方法
     */
    private generateContextId(): string {
        return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private getLanguageFromUri(uri: vscode.Uri): string {
        const ext = uri.fsPath.split('.').pop()?.toLowerCase();
        const languageMap: Record<string, string> = {
            'ts': 'typescript',
            'js': 'javascript',
            'py': 'python',
            'java': 'java',
            'cs': 'csharp',
            'cpp': 'cpp',
            'c': 'c',
            'go': 'go',
            'rs': 'rust',
            'php': 'php',
            'rb': 'ruby'
        };
        return languageMap[ext || ''] || 'plaintext';
    }

    private async getSymbolsInRange(
        uri: vscode.Uri,
        range: vscode.Range
    ): Promise<CodeSymbol[]> {
        const analysis = await this.codeEngine.analyzeFile(uri);
        return analysis.symbols.filter(symbol =>
            symbol.range.intersection(range) !== undefined
        );
    }

    private async getSymbolContent(symbol: CodeSymbol): Promise<string> {
        const content = await FileOperationUtils.readFile(symbol.uri);
        if (!content) {return '';}

        const lines = content.split('\n');
        const startLine = symbol.range.start.line;
        const endLine = symbol.range.end.line;

        return lines.slice(startLine, endLine + 1).join('\n');
    }

    /**
     * 清除所有上下文
     */
    clearContext(): void {
        this.contextItems.clear();
        this.currentContextSize = 0;
    }

    /**
     * 移除特定上下文項目
     */
    removeContext(id: string): boolean {
        const item = this.contextItems.get(id);
        if (item) {
            this.contextItems.delete(id);
            this.currentContextSize -= item.size;
            return true;
        }
        return false;
    }
}
