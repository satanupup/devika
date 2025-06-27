import * as vscode from 'vscode';

export interface UsageEvent {
    eventType: 'plugin_execution' | 'chat_message' | 'code_analysis' | 'error' | 'feedback';
    pluginId?: string;
    timestamp: string;
    duration?: number;
    success: boolean;
    errorMessage?: string;
    metadata?: any;
}

export interface PluginStats {
    pluginId: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    lastUsed: string;
    userRating?: number;
    userFeedback?: string[];
}

export class UsageAnalytics {
    private events: UsageEvent[] = [];
    private readonly maxEvents = 1000;

    constructor(private context: vscode.ExtensionContext) {
        this.loadEvents();
    }

    private loadEvents(): void {
        const savedEvents = this.context.globalState.get<UsageEvent[]>('usageEvents', []);
        this.events = savedEvents;
    }

    private async saveEvents(): Promise<void> {
        // Keep only the most recent events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
        await this.context.globalState.update('usageEvents', this.events);
    }

    async recordEvent(event: Omit<UsageEvent, 'timestamp'>): Promise<void> {
        const fullEvent: UsageEvent = {
            ...event,
            timestamp: new Date().toISOString()
        };

        this.events.push(fullEvent);
        await this.saveEvents();
    }

    async recordPluginExecution(
        pluginId: string, 
        success: boolean, 
        duration: number, 
        errorMessage?: string
    ): Promise<void> {
        await this.recordEvent({
            eventType: 'plugin_execution',
            pluginId,
            success,
            duration,
            errorMessage
        });
    }

    async recordChatMessage(success: boolean, duration: number): Promise<void> {
        await this.recordEvent({
            eventType: 'chat_message',
            success,
            duration
        });
    }

    async recordError(errorMessage: string, context?: any): Promise<void> {
        await this.recordEvent({
            eventType: 'error',
            success: false,
            errorMessage,
            metadata: context
        });
    }

    async recordFeedback(pluginId: string, rating: number, feedback: string): Promise<void> {
        await this.recordEvent({
            eventType: 'feedback',
            pluginId,
            success: true,
            metadata: { rating, feedback }
        });

        // Also save feedback separately for easy access
        const feedbackKey = `feedback_${pluginId}`;
        const existingFeedback = this.context.globalState.get<any[]>(feedbackKey, []);
        existingFeedback.push({
            rating,
            feedback,
            timestamp: new Date().toISOString()
        });
        await this.context.globalState.update(feedbackKey, existingFeedback);
    }

    getPluginStats(pluginId: string): PluginStats {
        const pluginEvents = this.events.filter(e => e.pluginId === pluginId);
        const executions = pluginEvents.filter(e => e.eventType === 'plugin_execution');
        
        const totalExecutions = executions.length;
        const successfulExecutions = executions.filter(e => e.success).length;
        const failedExecutions = totalExecutions - successfulExecutions;
        
        const durations = executions.filter(e => e.duration).map(e => e.duration!);
        const averageDuration = durations.length > 0 
            ? durations.reduce((a, b) => a + b, 0) / durations.length 
            : 0;

        const lastUsed = executions.length > 0 
            ? executions[executions.length - 1].timestamp 
            : '';

        // Get feedback
        const feedbackKey = `feedback_${pluginId}`;
        const feedback = this.context.globalState.get<any[]>(feedbackKey, []);
        const ratings = feedback.map(f => f.rating).filter(r => r !== undefined);
        const userRating = ratings.length > 0 
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
            : undefined;

        return {
            pluginId,
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            averageDuration,
            lastUsed,
            userRating,
            userFeedback: feedback.map(f => f.feedback)
        };
    }

    getAllPluginStats(): PluginStats[] {
        const pluginIds = [...new Set(this.events
            .filter(e => e.pluginId)
            .map(e => e.pluginId!))];
        
        return pluginIds.map(id => this.getPluginStats(id));
    }

    getOverallStats(): {
        totalEvents: number;
        totalPluginExecutions: number;
        successRate: number;
        averageSessionDuration: number;
        mostUsedPlugin: string | null;
        errorRate: number;
    } {
        const totalEvents = this.events.length;
        const pluginExecutions = this.events.filter(e => e.eventType === 'plugin_execution');
        const totalPluginExecutions = pluginExecutions.length;
        const successfulExecutions = pluginExecutions.filter(e => e.success).length;
        const successRate = totalPluginExecutions > 0 ? successfulExecutions / totalPluginExecutions : 0;

        const errors = this.events.filter(e => e.eventType === 'error');
        const errorRate = totalEvents > 0 ? errors.length / totalEvents : 0;

        // Calculate average session duration (time between first and last event in a session)
        const sessions = this.groupEventsBySessions();
        const sessionDurations = sessions.map(session => {
            if (session.length < 2) return 0;
            const start = new Date(session[0].timestamp).getTime();
            const end = new Date(session[session.length - 1].timestamp).getTime();
            return end - start;
        });
        const averageSessionDuration = sessionDurations.length > 0 
            ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length 
            : 0;

        // Find most used plugin
        const pluginUsage = new Map<string, number>();
        pluginExecutions.forEach(e => {
            if (e.pluginId) {
                pluginUsage.set(e.pluginId, (pluginUsage.get(e.pluginId) || 0) + 1);
            }
        });
        const mostUsedPlugin = pluginUsage.size > 0 
            ? [...pluginUsage.entries()].sort((a, b) => b[1] - a[1])[0][0] 
            : null;

        return {
            totalEvents,
            totalPluginExecutions,
            successRate,
            averageSessionDuration,
            mostUsedPlugin,
            errorRate
        };
    }

    private groupEventsBySessions(): UsageEvent[][] {
        const sessions: UsageEvent[][] = [];
        let currentSession: UsageEvent[] = [];
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes

        for (const event of this.events) {
            const eventTime = new Date(event.timestamp).getTime();
            
            if (currentSession.length === 0) {
                currentSession.push(event);
            } else {
                const lastEventTime = new Date(currentSession[currentSession.length - 1].timestamp).getTime();
                
                if (eventTime - lastEventTime > sessionTimeout) {
                    // Start new session
                    sessions.push(currentSession);
                    currentSession = [event];
                } else {
                    currentSession.push(event);
                }
            }
        }

        if (currentSession.length > 0) {
            sessions.push(currentSession);
        }

        return sessions;
    }

    async showAnalyticsDashboard(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'devikaAnalytics',
            'Devika 使用统计',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const overallStats = this.getOverallStats();
        const pluginStats = this.getAllPluginStats();

        panel.webview.html = this.getAnalyticsHtml(overallStats, pluginStats);
    }

    private getAnalyticsHtml(overallStats: any, pluginStats: PluginStats[]): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Devika 使用统计</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                }
                .stat-value {
                    font-size: 2em;
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                }
                .stat-label {
                    margin-top: 10px;
                    opacity: 0.8;
                }
                .plugin-stats {
                    margin-top: 30px;
                }
                .plugin-item {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                .plugin-name {
                    font-weight: bold;
                    font-size: 1.2em;
                    margin-bottom: 10px;
                }
                .plugin-metrics {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 10px;
                }
                .metric {
                    text-align: center;
                }
                .metric-value {
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                }
            </style>
        </head>
        <body>
            <h1>📊 Devika 使用统计</h1>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${overallStats.totalEvents}</div>
                    <div class="stat-label">总事件数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${overallStats.totalPluginExecutions}</div>
                    <div class="stat-label">插件执行次数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(overallStats.successRate * 100).toFixed(1)}%</div>
                    <div class="stat-label">成功率</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(overallStats.averageSessionDuration / 60000).toFixed(1)}分钟</div>
                    <div class="stat-label">平均会话时长</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${overallStats.mostUsedPlugin || 'N/A'}</div>
                    <div class="stat-label">最常用插件</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(overallStats.errorRate * 100).toFixed(1)}%</div>
                    <div class="stat-label">错误率</div>
                </div>
            </div>

            <div class="plugin-stats">
                <h2>🔌 插件统计</h2>
                ${pluginStats.map(plugin => `
                    <div class="plugin-item">
                        <div class="plugin-name">${plugin.pluginId}</div>
                        <div class="plugin-metrics">
                            <div class="metric">
                                <div class="metric-value">${plugin.totalExecutions}</div>
                                <div>总执行次数</div>
                            </div>
                            <div class="metric">
                                <div class="metric-value">${plugin.successfulExecutions}</div>
                                <div>成功次数</div>
                            </div>
                            <div class="metric">
                                <div class="metric-value">${plugin.averageDuration.toFixed(0)}ms</div>
                                <div>平均耗时</div>
                            </div>
                            <div class="metric">
                                <div class="metric-value">${plugin.userRating ? plugin.userRating.toFixed(1) : 'N/A'}</div>
                                <div>用户评分</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
        `;
    }

    async clearAnalytics(): Promise<void> {
        const result = await vscode.window.showWarningMessage(
            '确定要清除所有使用统计数据吗？',
            { modal: true },
            '确定',
            '取消'
        );

        if (result === '确定') {
            this.events = [];
            await this.context.globalState.update('usageEvents', []);
            
            // Clear feedback data
            const keys = this.context.globalState.keys();
            for (const key of keys) {
                if (key.startsWith('feedback_')) {
                    await this.context.globalState.update(key, undefined);
                }
            }

            vscode.window.showInformationMessage('使用统计数据已清除');
        }
    }
}
