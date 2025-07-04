import * as vscode from 'vscode';
import { TaskPlan, TaskStep } from '../agent/AgentTaskReviewer';
import { MultiFileEditor, FileEdit } from '../agent/MultiFileEditor';
import { CheckpointManager } from '../agent/CheckpointManager';

export interface TaskExecution {
    id: string;
    planId: string;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    currentStepIndex: number;
    startTime: string;
    endTime?: string;
    results: StepResult[];
    checkpointId?: string;
}

export interface StepResult {
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: string;
    endTime?: string;
    duration?: number;
    output?: string;
    error?: string;
    filesModified?: string[];
}

export interface TaskTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    steps: TaskStep[];
    variables: { [key: string]: any };
    tags: string[];
}

export class TaskEngine {
    private activeExecutions: Map<string, TaskExecution> = new Map();
    private templates: Map<string, TaskTemplate> = new Map();
    private multiFileEditor: MultiFileEditor;
    private checkpointManager: CheckpointManager;

    constructor(
        private context: vscode.ExtensionContext,
        multiFileEditor: MultiFileEditor,
        checkpointManager: CheckpointManager
    ) {
        this.multiFileEditor = multiFileEditor;
        this.checkpointManager = checkpointManager;
        this.loadTemplates();
    }

    async executeTaskPlan(plan: TaskPlan): Promise<TaskExecution> {
        const executionId = this.generateExecutionId();

        // Create checkpoint before execution
        const affectedFiles = this.getAffectedFiles(plan);
        const checkpointId = await this.checkpointManager.createAutoCheckpoint(
            plan.id,
            `Execute plan: ${plan.title}`,
            affectedFiles
        );

        const execution: TaskExecution = {
            id: executionId,
            planId: plan.id,
            status: 'pending',
            currentStepIndex: 0,
            startTime: new Date().toISOString(),
            results: plan.steps.map(step => ({
                stepId: step.id,
                status: 'pending'
            })),
            checkpointId
        };

        this.activeExecutions.set(executionId, execution);

        // Start execution
        this.executeStepsSequentially(execution, plan.steps);

        return execution;
    }

    private async executeStepsSequentially(execution: TaskExecution, steps: TaskStep[]): Promise<void> {
        execution.status = 'running';

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            execution.currentStepIndex = i;

            // Check if execution was cancelled or failed
            if (execution.status !== 'running') {
                break;
            }

            // Check dependencies
            if (!this.areDependenciesMet(step, execution.results)) {
                execution.results[i].status = 'skipped';
                execution.results[i].error = 'Dependencies not met';
                continue;
            }

            // Execute step
            try {
                execution.results[i].status = 'running';
                execution.results[i].startTime = new Date().toISOString();

                const result = await this.executeStep(step);

                execution.results[i].status = 'completed';
                execution.results[i].endTime = new Date().toISOString();
                execution.results[i].duration = this.calculateDuration(
                    execution.results[i].startTime!,
                    execution.results[i].endTime!
                );
                execution.results[i].output = result.output;
                execution.results[i].filesModified = result.filesModified;

            } catch (error) {
                execution.results[i].status = 'failed';
                execution.results[i].endTime = new Date().toISOString();
                execution.results[i].error = error instanceof Error ? error.message : String(error);

                // Decide whether to continue or stop
                const shouldContinue = await this.handleStepFailure(step, error, execution);
                if (!shouldContinue) {
                    execution.status = 'failed';
                    break;
                }
            }
        }

        // Finalize execution
        if (execution.status === 'running') {
            execution.status = 'completed';
        }
        execution.endTime = new Date().toISOString();

        // Notify completion
        this.notifyExecutionComplete(execution);
    }

    private async executeStep(step: TaskStep): Promise<{ output: string; filesModified: string[] }> {
        const filesModified: string[] = [];
        let output = '';

        switch (step.type) {
            case 'file_create':
                if (step.filePath && step.content) {
                    const edit: FileEdit = {
                        filePath: step.filePath,
                        type: 'create',
                        content: step.content
                    };
                    await this.multiFileEditor.executeBatchEdits([edit]);
                    filesModified.push(step.filePath);
                    output = `Created file: ${step.filePath}`;
                }
                break;

            case 'file_modify':
                if (step.filePath && (step.content || step.changes)) {
                    const edit: FileEdit = {
                        filePath: step.filePath,
                        type: 'modify',
                        content: step.content
                    };
                    await this.multiFileEditor.executeBatchEdits([edit]);
                    filesModified.push(step.filePath);
                    output = `Modified file: ${step.filePath}`;
                }
                break;

            case 'file_delete':
                if (step.filePath) {
                    const edit: FileEdit = {
                        filePath: step.filePath,
                        type: 'delete'
                    };
                    await this.multiFileEditor.executeBatchEdits([edit]);
                    filesModified.push(step.filePath);
                    output = `Deleted file: ${step.filePath}`;
                }
                break;

            case 'command_execute':
                if (step.command) {
                    output = await this.executeCommand(step.command);
                }
                break;

            case 'analysis':
                output = await this.performAnalysis(step);
                break;

            default:
                throw new Error(`Unknown step type: ${step.type}`);
        }

        return { output, filesModified };
    }

    private async executeCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const terminal = vscode.window.createTerminal('Devika Task');
            terminal.sendText(command);

            // For now, just return the command that was executed
            // In a real implementation, you'd capture the output
            resolve(`Executed: ${command}`);
        });
    }

    private async performAnalysis(step: TaskStep): Promise<string> {
        // Placeholder for analysis tasks
        return `Analysis completed: ${step.description}`;
    }

    private areDependenciesMet(step: TaskStep, results: StepResult[]): boolean {
        for (const depId of step.dependencies) {
            const depResult = results.find(r => r.stepId === depId);
            if (!depResult || depResult.status !== 'completed') {
                return false;
            }
        }
        return true;
    }

    private async handleStepFailure(
        step: TaskStep,
        error: any,
        execution: TaskExecution
    ): Promise<boolean> {
        const choice = await vscode.window.showErrorMessage(
            `步骤 "${step.description}" 执行失败: ${error}`,
            { modal: true },
            '继续执行',
            '暂停执行',
            '取消执行'
        );

        switch (choice) {
            case '继续执行':
                return true;
            case '暂停执行':
                execution.status = 'paused';
                return false;
            case '取消执行':
                execution.status = 'cancelled';
                return false;
            default:
                return false;
        }
    }

    private calculateDuration(startTime: string, endTime: string): number {
        return new Date(endTime).getTime() - new Date(startTime).getTime();
    }

    private getAffectedFiles(plan: TaskPlan): string[] {
        const files = new Set<string>();
        for (const step of plan.steps) {
            if (step.filePath) {
                files.add(step.filePath);
            }
        }
        return Array.from(files);
    }

    private notifyExecutionComplete(execution: TaskExecution): void {
        const completedSteps = execution.results.filter(r => r.status === 'completed').length;
        const totalSteps = execution.results.length;

        if (execution.status === 'completed') {
            vscode.window.showInformationMessage(
                `任务执行完成！${completedSteps}/${totalSteps} 个步骤成功执行`
            );
        } else {
            vscode.window.showWarningMessage(
                `任务执行${execution.status}！${completedSteps}/${totalSteps} 个步骤已完成`
            );
        }
    }

    async pauseExecution(executionId: string): Promise<void> {
        const execution = this.activeExecutions.get(executionId);
        if (execution && execution.status === 'running') {
            execution.status = 'paused';
        }
    }

    async resumeExecution(executionId: string): Promise<void> {
        const execution = this.activeExecutions.get(executionId);
        if (execution && execution.status === 'paused') {
            execution.status = 'running';
            // Resume from current step
        }
    }

    async cancelExecution(executionId: string): Promise<void> {
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
            execution.status = 'cancelled';
            execution.endTime = new Date().toISOString();
        }
    }

    getActiveExecutions(): TaskExecution[] {
        return Array.from(this.activeExecutions.values());
    }

    getExecution(id: string): TaskExecution | undefined {
        return this.activeExecutions.get(id);
    }

    // Template management
    async createTemplate(template: Omit<TaskTemplate, 'id'>): Promise<string> {
        const id = this.generateTemplateId();
        const fullTemplate: TaskTemplate = { id, ...template };
        this.templates.set(id, fullTemplate);
        await this.saveTemplates();
        return id;
    }

    getTemplates(): TaskTemplate[] {
        return Array.from(this.templates.values());
    }

    getTemplate(id: string): TaskTemplate | undefined {
        return this.templates.get(id);
    }

    async deleteTemplate(id: string): Promise<boolean> {
        const deleted = this.templates.delete(id);
        if (deleted) {
            await this.saveTemplates();
        }
        return deleted;
    }

    private generateExecutionId(): string {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateTemplateId(): string {
        return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async loadTemplates(): Promise<void> {
        try {
            const saved = this.context.globalState.get<TaskTemplate[]>('taskTemplates', []);
            this.templates.clear();
            for (const template of saved) {
                this.templates.set(template.id, template);
            }
        } catch (error) {
            console.warn('Failed to load task templates:', error);
        }
    }

    private async saveTemplates(): Promise<void> {
        try {
            const templatesArray = Array.from(this.templates.values());
            await this.context.globalState.update('taskTemplates', templatesArray);
        } catch (error) {
            console.warn('Failed to save task templates:', error);
        }
    }
}
