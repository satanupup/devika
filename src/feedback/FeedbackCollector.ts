import * as vscode from 'vscode';
import { UsageAnalytics } from '../analytics/UsageAnalytics';

export interface FeedbackData {
    type: 'plugin' | 'general' | 'bug_report' | 'feature_request';
    pluginId?: string;
    rating: number; // 1-5 stars
    feedback: string;
    userEmail?: string;
    timestamp: string;
    version: string;
}

export class FeedbackCollector {
    private analytics: UsageAnalytics;

    constructor(
        private context: vscode.ExtensionContext,
        analytics: UsageAnalytics
    ) {
        this.analytics = analytics;
    }

    async showFeedbackDialog(pluginId?: string): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'devikaFeedback',
            '反馈与建议',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: false
            }
        );

        panel.webview.html = this.getFeedbackHtml(pluginId);

        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'submitFeedback':
                        await this.submitFeedback(message.feedback);
                        panel.dispose();
                        break;
                    case 'cancel':
                        panel.dispose();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private async submitFeedback(feedbackData: any): Promise<void> {
        try {
            const feedback: FeedbackData = {
                type: feedbackData.type,
                pluginId: feedbackData.pluginId,
                rating: parseInt(feedbackData.rating),
                feedback: feedbackData.feedback,
                userEmail: feedbackData.userEmail,
                timestamp: new Date().toISOString(),
                version: this.getExtensionVersion()
            };

            // Save feedback locally
            await this.saveFeedbackLocally(feedback);

            // Record in analytics
            if (feedback.pluginId) {
                await this.analytics.recordFeedback(
                    feedback.pluginId,
                    feedback.rating,
                    feedback.feedback
                );
            }

            // Show thank you message
            vscode.window.showInformationMessage(
                '感谢您的反馈！您的意见对我们很重要。'
            );

            // Optionally, send feedback to remote server
            // await this.sendFeedbackToServer(feedback);

        } catch (error) {
            vscode.window.showErrorMessage(`提交反馈失败: ${error}`);
        }
    }

    private async saveFeedbackLocally(feedback: FeedbackData): Promise<void> {
        const existingFeedback = this.context.globalState.get<FeedbackData[]>('userFeedback', []);
        existingFeedback.push(feedback);
        
        // Keep only the most recent 100 feedback entries
        if (existingFeedback.length > 100) {
            existingFeedback.splice(0, existingFeedback.length - 100);
        }

        await this.context.globalState.update('userFeedback', existingFeedback);
    }

    private getExtensionVersion(): string {
        const extension = vscode.extensions.getExtension('devika.vscode-extension');
        return extension?.packageJSON?.version || '0.0.0';
    }

    async showFeedbackHistory(): Promise<void> {
        const feedback = this.context.globalState.get<FeedbackData[]>('userFeedback', []);
        
        if (feedback.length === 0) {
            vscode.window.showInformationMessage('暂无反馈记录');
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'devikaFeedbackHistory',
            '反馈历史',
            vscode.ViewColumn.One,
            { enableScripts: false }
        );

        panel.webview.html = this.getFeedbackHistoryHtml(feedback);
    }

    private getFeedbackHtml(pluginId?: string): string {
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>反馈与建议</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .form-group {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                }
                select, input, textarea {
                    width: 100%;
                    padding: 10px;
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    font-family: inherit;
                }
                textarea {
                    min-height: 120px;
                    resize: vertical;
                }
                .rating {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 10px;
                }
                .star {
                    font-size: 24px;
                    color: #ccc;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .star.active {
                    color: #ffd700;
                }
                .star:hover {
                    color: #ffd700;
                }
                .actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 30px;
                }
                .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: inherit;
                }
                .btn-primary {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .optional {
                    opacity: 0.7;
                    font-size: 0.9em;
                }
            </style>
        </head>
        <body>
            <h1>💬 反馈与建议</h1>
            <p>您的反馈对我们改进 Devika AI 助理非常重要！</p>

            <form id="feedbackForm">
                <div class="form-group">
                    <label for="feedbackType">反馈类型:</label>
                    <select id="feedbackType" required>
                        <option value="">请选择...</option>
                        ${pluginId ? `<option value="plugin" selected>插件反馈</option>` : '<option value="plugin">插件反馈</option>'}
                        <option value="general">一般反馈</option>
                        <option value="bug_report">错误报告</option>
                        <option value="feature_request">功能建议</option>
                    </select>
                </div>

                ${pluginId ? `
                <div class="form-group">
                    <label>插件:</label>
                    <input type="text" value="${pluginId}" readonly>
                    <input type="hidden" id="pluginId" value="${pluginId}">
                </div>
                ` : `
                <div class="form-group" id="pluginGroup" style="display: none;">
                    <label for="pluginId">插件 ID:</label>
                    <input type="text" id="pluginId" placeholder="如果是插件相关反馈，请输入插件 ID">
                </div>
                `}

                <div class="form-group">
                    <label>评分:</label>
                    <div class="rating">
                        <span class="star" data-rating="1">★</span>
                        <span class="star" data-rating="2">★</span>
                        <span class="star" data-rating="3">★</span>
                        <span class="star" data-rating="4">★</span>
                        <span class="star" data-rating="5">★</span>
                    </div>
                    <input type="hidden" id="rating" required>
                </div>

                <div class="form-group">
                    <label for="feedback">详细反馈:</label>
                    <textarea id="feedback" placeholder="请详细描述您的反馈、建议或遇到的问题..." required></textarea>
                </div>

                <div class="form-group">
                    <label for="userEmail">邮箱 <span class="optional">(可选，用于后续沟通)</span>:</label>
                    <input type="email" id="userEmail" placeholder="your@email.com">
                </div>

                <div class="actions">
                    <button type="submit" class="btn btn-primary">📤 提交反馈</button>
                    <button type="button" class="btn btn-secondary" onclick="cancel()">❌ 取消</button>
                </div>
            </form>

            <script>
                const vscode = acquireVsCodeApi();
                let selectedRating = 0;

                // Rating system
                document.querySelectorAll('.star').forEach(star => {
                    star.addEventListener('click', function() {
                        selectedRating = parseInt(this.dataset.rating);
                        document.getElementById('rating').value = selectedRating;
                        updateStars();
                    });

                    star.addEventListener('mouseover', function() {
                        const rating = parseInt(this.dataset.rating);
                        highlightStars(rating);
                    });
                });

                document.querySelector('.rating').addEventListener('mouseleave', function() {
                    updateStars();
                });

                function highlightStars(rating) {
                    document.querySelectorAll('.star').forEach((star, index) => {
                        if (index < rating) {
                            star.classList.add('active');
                        } else {
                            star.classList.remove('active');
                        }
                    });
                }

                function updateStars() {
                    highlightStars(selectedRating);
                }

                // Show/hide plugin field based on feedback type
                document.getElementById('feedbackType').addEventListener('change', function() {
                    const pluginGroup = document.getElementById('pluginGroup');
                    if (pluginGroup) {
                        if (this.value === 'plugin') {
                            pluginGroup.style.display = 'block';
                        } else {
                            pluginGroup.style.display = 'none';
                        }
                    }
                });

                // Form submission
                document.getElementById('feedbackForm').addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    if (selectedRating === 0) {
                        alert('请选择评分');
                        return;
                    }

                    const feedbackData = {
                        type: document.getElementById('feedbackType').value,
                        pluginId: document.getElementById('pluginId').value,
                        rating: selectedRating,
                        feedback: document.getElementById('feedback').value,
                        userEmail: document.getElementById('userEmail').value
                    };

                    vscode.postMessage({
                        command: 'submitFeedback',
                        feedback: feedbackData
                    });
                });

                function cancel() {
                    vscode.postMessage({ command: 'cancel' });
                }
            </script>
        </body>
        </html>
        `;
    }

    private getFeedbackHistoryHtml(feedback: FeedbackData[]): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>反馈历史</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .feedback-item {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                .feedback-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .feedback-type {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8em;
                }
                .feedback-rating {
                    color: #ffd700;
                }
                .feedback-content {
                    margin: 10px 0;
                    line-height: 1.5;
                }
                .feedback-meta {
                    font-size: 0.9em;
                    opacity: 0.7;
                }
            </style>
        </head>
        <body>
            <h1>📋 反馈历史</h1>
            
            ${feedback.reverse().map(item => `
                <div class="feedback-item">
                    <div class="feedback-header">
                        <span class="feedback-type">${this.getFeedbackTypeText(item.type)}</span>
                        <span class="feedback-rating">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</span>
                    </div>
                    ${item.pluginId ? `<div><strong>插件:</strong> ${item.pluginId}</div>` : ''}
                    <div class="feedback-content">${item.feedback}</div>
                    <div class="feedback-meta">
                        ${new Date(item.timestamp).toLocaleString()} | 版本: ${item.version}
                    </div>
                </div>
            `).join('')}
        </body>
        </html>
        `;
    }

    private getFeedbackTypeText(type: string): string {
        const types: { [key: string]: string } = {
            'plugin': '插件反馈',
            'general': '一般反馈',
            'bug_report': '错误报告',
            'feature_request': '功能建议'
        };
        return types[type] || type;
    }

    async promptForFeedbackAfterPluginUse(pluginId: string): Promise<void> {
        // Only prompt occasionally to avoid being annoying
        const lastPromptKey = `lastFeedbackPrompt_${pluginId}`;
        const lastPrompt = this.context.globalState.get<string>(lastPromptKey);
        const now = new Date().getTime();
        
        if (lastPrompt) {
            const lastPromptTime = new Date(lastPrompt).getTime();
            const daysSinceLastPrompt = (now - lastPromptTime) / (1000 * 60 * 60 * 24);
            
            // Only prompt once per week per plugin
            if (daysSinceLastPrompt < 7) {
                return;
            }
        }

        // Random chance to show feedback prompt (20% chance)
        if (Math.random() > 0.2) {
            return;
        }

        const result = await vscode.window.showInformationMessage(
            `您刚刚使用了 ${pluginId} 插件，愿意分享您的使用体验吗？`,
            '提供反馈',
            '稍后提醒',
            '不再提醒'
        );

        await this.context.globalState.update(lastPromptKey, new Date().toISOString());

        if (result === '提供反馈') {
            await this.showFeedbackDialog(pluginId);
        } else if (result === '不再提醒') {
            // Set a far future date to effectively disable prompts for this plugin
            const farFuture = new Date();
            farFuture.setFullYear(farFuture.getFullYear() + 10);
            await this.context.globalState.update(lastPromptKey, farFuture.toISOString());
        }
    }
}
