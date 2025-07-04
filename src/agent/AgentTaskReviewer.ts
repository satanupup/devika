import * as vscode from 'vscode';

export interface TaskStep {
    id: string;
    description: string;
    type: 'file_create' | 'file_modify' | 'file_delete' | 'command_execute' | 'analysis';
    filePath?: string;
    content?: string;
    changes?: string;
    command?: string;
    estimated_time: number; // in minutes
    dependencies: string[]; // IDs of steps this depends on
    approved: boolean;
    completed: boolean;
}

export interface TaskPlan {
    id: string;
    title: string;
    description: string;
    steps: TaskStep[];
    totalEstimatedTime: number;
    created: string;
    status: 'draft' | 'under_review' | 'approved' | 'executing' | 'completed' | 'cancelled';
}

export interface ReviewResult {
    approved: boolean;
    modifiedSteps?: TaskStep[];
    feedback?: string;
    approvedSteps?: string[]; // IDs of individually approved steps
}

export class AgentTaskReviewer {
    private currentPlan: TaskPlan | undefined;
    private reviewPanel: vscode.WebviewPanel | undefined;

    constructor(private context: vscode.ExtensionContext) {}

    async showTaskPlanForReview(plan: TaskPlan): Promise<ReviewResult> {
        this.currentPlan = plan;

        return new Promise((resolve) => {
            this.reviewPanel = vscode.window.createWebviewPanel(
                'agentTaskReview',
                `任务计划审查: ${plan.title}`,
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.reviewPanel.webview.html = this.getReviewHtml(plan);

            this.reviewPanel.webview.onDidReceiveMessage(
                (message) => {
                    switch (message.command) {
                        case 'approve':
                            resolve({
                                approved: true,
                                approvedSteps: message.approvedSteps
                            });
                            this.reviewPanel?.dispose();
                            break;
                        case 'reject':
                            resolve({
                                approved: false,
                                feedback: message.feedback
                            });
                            this.reviewPanel?.dispose();
                            break;
                        case 'modify':
                            resolve({
                                approved: true,
                                modifiedSteps: message.modifiedSteps,
                                feedback: message.feedback
                            });
                            this.reviewPanel?.dispose();
                            break;
                        case 'stepToggle':
                            this.handleStepToggle(message.stepId, message.approved);
                            break;
                        case 'stepModify':
                            this.handleStepModify(message.stepId, message.changes);
                            break;
                    }
                },
                undefined,
                this.context.subscriptions
            );

            this.reviewPanel.onDidDispose(() => {
                resolve({ approved: false });
                this.reviewPanel = undefined;
            });
        });
    }

    private handleStepToggle(stepId: string, approved: boolean): void {
        if (!this.currentPlan) {return;}

        const step = this.currentPlan.steps.find(s => s.id === stepId);
        if (step) {
            step.approved = approved;
            // Update the UI
            this.updateStepInUI(stepId, { approved });
        }
    }

    private handleStepModify(stepId: string, changes: any): void {
        if (!this.currentPlan) {return;}

        const step = this.currentPlan.steps.find(s => s.id === stepId);
        if (step) {
            Object.assign(step, changes);
            // Update the UI
            this.updateStepInUI(stepId, changes);
        }
    }

    private updateStepInUI(stepId: string, changes: any): void {
        if (this.reviewPanel) {
            this.reviewPanel.webview.postMessage({
                command: 'updateStep',
                stepId,
                changes
            });
        }
    }

    private getReviewHtml(plan: TaskPlan): string {
        return `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>任务计划审查</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                }
                .plan-header {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .plan-title {
                    font-size: 1.5em;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .plan-meta {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }
                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .steps-container {
                    margin-bottom: 30px;
                }
                .step-item {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    margin-bottom: 15px;
                    overflow: hidden;
                }
                .step-header {
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    background: var(--vscode-list-hoverBackground);
                }
                .step-checkbox {
                    width: 18px;
                    height: 18px;
                }
                .step-type {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8em;
                }
                .step-description {
                    flex: 1;
                    font-weight: bold;
                }
                .step-time {
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                }
                .step-details {
                    padding: 15px;
                    border-top: 1px solid var(--vscode-panel-border);
                    display: none;
                }
                .step-details.expanded {
                    display: block;
                }
                .step-content {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 10px;
                    margin: 10px 0;
                    white-space: pre-wrap;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                }
                .step-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 10px;
                }
                .btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                }
                .btn-edit {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .btn-delete {
                    background: var(--vscode-errorForeground);
                    color: white;
                }
                .review-actions {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 15px;
                    display: flex;
                    gap: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                .btn-primary {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 10px 20px;
                }
                .btn-secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    padding: 10px 20px;
                }
                .btn-danger {
                    background: var(--vscode-errorForeground);
                    color: white;
                    padding: 10px 20px;
                }
                .feedback-area {
                    margin-top: 20px;
                }
                .feedback-textarea {
                    width: 100%;
                    min-height: 100px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    padding: 10px;
                    border-radius: 4px;
                    font-family: inherit;
                    resize: vertical;
                }
                .summary-stats {
                    display: flex;
                    gap: 20px;
                    margin-top: 10px;
                }
                .stat {
                    text-align: center;
                }
                .stat-value {
                    font-size: 1.2em;
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                }
                .stat-label {
                    font-size: 0.9em;
                    opacity: 0.8;
                }
            </style>
        </head>
        <body>
            <div class="plan-header">
                <div class="plan-title">📋 ${plan.title}</div>
                <div class="plan-description">${plan.description}</div>
                <div class="plan-meta">
                    <div class="meta-item">
                        <span>📊 总步骤:</span>
                        <span>${plan.steps.length}</span>
                    </div>
                    <div class="meta-item">
                        <span>⏱️ 预计时间:</span>
                        <span>${plan.totalEstimatedTime} 分钟</span>
                    </div>
                    <div class="meta-item">
                        <span>📅 创建时间:</span>
                        <span>${new Date(plan.created).toLocaleString()}</span>
                    </div>
                    <div class="meta-item">
                        <span>🔄 状态:</span>
                        <span>${this.getStatusText(plan.status)}</span>
                    </div>
                </div>
                <div class="summary-stats">
                    <div class="stat">
                        <div class="stat-value" id="approvedCount">0</div>
                        <div class="stat-label">已批准</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" id="pendingCount">${plan.steps.length}</div>
                        <div class="stat-label">待审查</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" id="estimatedTime">${plan.totalEstimatedTime}</div>
                        <div class="stat-label">预计分钟</div>
                    </div>
                </div>
            </div>

            <div class="steps-container">
                <h3>📝 执行步骤</h3>
                ${plan.steps.map((step, index) => `
                    <div class="step-item" data-step-id="${step.id}">
                        <div class="step-header" onclick="toggleStepDetails('${step.id}')">
                            <input type="checkbox" class="step-checkbox" 
                                   ${step.approved ? 'checked' : ''} 
                                   onclick="toggleStepApproval('${step.id}', this.checked); event.stopPropagation();">
                            <span class="step-type">${this.getStepTypeText(step.type)}</span>
                            <span class="step-description">${step.description}</span>
                            <span class="step-time">${step.estimated_time}分钟</span>
                        </div>
                        <div class="step-details" id="details-${step.id}">
                            ${step.filePath ? `<div><strong>文件:</strong> ${step.filePath}</div>` : ''}
                            ${step.content ? `<div><strong>内容:</strong><div class="step-content">${step.content}</div></div>` : ''}
                            ${step.changes ? `<div><strong>变更:</strong><div class="step-content">${step.changes}</div></div>` : ''}
                            ${step.command ? `<div><strong>命令:</strong><div class="step-content">${step.command}</div></div>` : ''}
                            ${step.dependencies.length > 0 ? `<div><strong>依赖:</strong> ${step.dependencies.join(', ')}</div>` : ''}
                            <div class="step-actions">
                                <button class="btn btn-edit" onclick="editStep('${step.id}')">✏️ 编辑</button>
                                <button class="btn btn-delete" onclick="deleteStep('${step.id}')">🗑️ 删除</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="feedback-area">
                <h3>💬 审查反馈</h3>
                <textarea class="feedback-textarea" id="reviewFeedback" 
                          placeholder="请提供您的审查意见、建议或修改要求..."></textarea>
            </div>

            <div class="review-actions">
                <button class="btn btn-primary" onclick="approveAll()">✅ 批准执行</button>
                <button class="btn btn-secondary" onclick="approveSelected()">✅ 批准选中</button>
                <button class="btn btn-secondary" onclick="modifyPlan()">✏️ 修改计划</button>
                <button class="btn btn-danger" onclick="rejectPlan()">❌ 拒绝计划</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const planData = ${JSON.stringify(plan)};

                function toggleStepDetails(stepId) {
                    const details = document.getElementById('details-' + stepId);
                    details.classList.toggle('expanded');
                }

                function toggleStepApproval(stepId, approved) {
                    vscode.postMessage({
                        command: 'stepToggle',
                        stepId: stepId,
                        approved: approved
                    });
                    updateStats();
                }

                function updateStats() {
                    const checkboxes = document.querySelectorAll('.step-checkbox');
                    const approvedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
                    const pendingCount = checkboxes.length - approvedCount;
                    
                    document.getElementById('approvedCount').textContent = approvedCount;
                    document.getElementById('pendingCount').textContent = pendingCount;
                }

                function approveAll() {
                    const approvedSteps = planData.steps.map(step => step.id);
                    vscode.postMessage({
                        command: 'approve',
                        approvedSteps: approvedSteps
                    });
                }

                function approveSelected() {
                    const checkboxes = document.querySelectorAll('.step-checkbox:checked');
                    const approvedSteps = Array.from(checkboxes).map(cb => 
                        cb.closest('.step-item').dataset.stepId
                    );
                    
                    if (approvedSteps.length === 0) {
                        alert('请至少选择一个步骤进行批准');
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'approve',
                        approvedSteps: approvedSteps
                    });
                }

                function modifyPlan() {
                    const feedback = document.getElementById('reviewFeedback').value;
                    vscode.postMessage({
                        command: 'modify',
                        modifiedSteps: planData.steps,
                        feedback: feedback
                    });
                }

                function rejectPlan() {
                    const feedback = document.getElementById('reviewFeedback').value;
                    if (!feedback.trim()) {
                        alert('请提供拒绝原因');
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'reject',
                        feedback: feedback
                    });
                }

                function editStep(stepId) {
                    // TODO: Implement step editing
                    alert('步骤编辑功能开发中...');
                }

                function deleteStep(stepId) {
                    if (confirm('确定要删除这个步骤吗？')) {
                        // TODO: Implement step deletion
                        alert('步骤删除功能开发中...');
                    }
                }

                // Initialize stats
                updateStats();
            </script>
        </body>
        </html>
        `;
    }

    private getStatusText(status: string): string {
        const statusMap: { [key: string]: string } = {
            'draft': '草稿',
            'under_review': '审查中',
            'approved': '已批准',
            'executing': '执行中',
            'completed': '已完成',
            'cancelled': '已取消'
        };
        return statusMap[status] || status;
    }

    private getStepTypeText(type: string): string {
        const typeMap: { [key: string]: string } = {
            'file_create': '创建文件',
            'file_modify': '修改文件',
            'file_delete': '删除文件',
            'command_execute': '执行命令',
            'analysis': '分析'
        };
        return typeMap[type] || type;
    }

    dispose(): void {
        if (this.reviewPanel) {
            this.reviewPanel.dispose();
        }
    }
}
