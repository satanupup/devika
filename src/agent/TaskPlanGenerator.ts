import * as vscode from 'vscode';
import { LLMService } from '../llm/LLMService';
import { TaskPlan, TaskStep } from './AgentTaskReviewer';
import { CodeContextService } from '../context/CodeContextService';

export interface TaskRequest {
    description: string;
    context?: {
        selectedFiles?: string[];
        codeSnippets?: any[];
        workspaceInfo?: any;
    };
    constraints?: {
        maxSteps?: number;
        maxTime?: number; // in minutes
        allowedOperations?: string[];
    };
}

export class TaskPlanGenerator {
    private llmService: LLMService;
    private codeContextService: CodeContextService;

    constructor(
        llmService: LLMService,
        codeContextService: CodeContextService
    ) {
        this.llmService = llmService;
        this.codeContextService = codeContextService;
    }

    async generateTaskPlan(request: TaskRequest): Promise<TaskPlan> {
        try {
            // Gather context information
            const contextInfo = await this.gatherContextInfo(request);
            
            // Generate the plan using LLM
            const planPrompt = this.buildPlanPrompt(request, contextInfo);
            const llmResult = await this.llmService.generateCompletion(planPrompt);
            const llmResponse = llmResult.content;
            
            // Parse the LLM response into a structured plan
            const plan = this.parseLLMResponseToPlan(llmResponse, request);
            
            // Validate and optimize the plan
            const validatedPlan = this.validateAndOptimizePlan(plan);
            
            return validatedPlan;

        } catch (error) {
            throw new Error(`Failed to generate task plan: ${error}`);
        }
    }

    private async gatherContextInfo(request: TaskRequest): Promise<any> {
        const context: any = {
            workspaceFiles: [],
            projectStructure: {},
            dependencies: [],
            codePatterns: []
        };

        // Get workspace information
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            context.workspaceRoot = workspaceFolders[0].uri.fsPath;
            
            // Get basic project structure
            const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 50);
            context.workspaceFiles = files.map(f => f.fsPath);
        }

        // Get selected files context
        if (request.context?.selectedFiles) {
            context.selectedFilesContent = {};
            for (const filePath of request.context.selectedFiles) {
                try {
                    const uri = vscode.Uri.file(filePath);
                    const document = await vscode.workspace.openTextDocument(uri);
                    context.selectedFilesContent[filePath] = document.getText();
                } catch (error) {
                    console.warn(`Failed to read file ${filePath}: ${error}`);
                }
            }
        }

        // Get code snippets context
        if (request.context?.codeSnippets) {
            context.codeSnippets = request.context.codeSnippets;
        }

        return context;
    }

    private buildPlanPrompt(request: TaskRequest, contextInfo: any): string {
        return `
You are an AI assistant that creates detailed task execution plans for software development tasks.

TASK REQUEST:
${request.description}

CONTEXT INFORMATION:
- Workspace Root: ${contextInfo.workspaceRoot || 'Unknown'}
- Available Files: ${contextInfo.workspaceFiles?.slice(0, 10).join(', ')}${contextInfo.workspaceFiles?.length > 10 ? '...' : ''}
- Selected Files: ${request.context?.selectedFiles?.join(', ') || 'None'}

CONSTRAINTS:
- Max Steps: ${request.constraints?.maxSteps || 20}
- Max Time: ${request.constraints?.maxTime || 60} minutes
- Allowed Operations: ${request.constraints?.allowedOperations?.join(', ') || 'All'}

Please create a detailed task execution plan with the following structure:

{
  "title": "Brief title for the task",
  "description": "Detailed description of what will be accomplished",
  "steps": [
    {
      "id": "step_1",
      "description": "What this step does",
      "type": "file_create|file_modify|file_delete|command_execute|analysis",
      "filePath": "path/to/file (if applicable)",
      "content": "file content or code (if creating/modifying files)",
      "changes": "description of changes (if modifying files)",
      "command": "command to execute (if command_execute)",
      "estimated_time": 5,
      "dependencies": ["step_id_that_must_complete_first"]
    }
  ]
}

GUIDELINES:
1. Break down the task into logical, manageable steps
2. Each step should be atomic and clearly defined
3. Include realistic time estimates (in minutes)
4. Specify dependencies between steps
5. Include actual code content when creating or modifying files
6. Be specific about file paths and operations
7. Consider error handling and validation steps
8. Ensure the plan is executable and practical

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON.
        `;
    }

    private parseLLMResponseToPlan(llmResponse: string, request: TaskRequest): TaskPlan {
        try {
            // Clean up the response to extract JSON
            let jsonStr = llmResponse.trim();
            
            // Remove any markdown code blocks
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            const planData = JSON.parse(jsonStr);

            // Create TaskStep objects
            const steps: TaskStep[] = planData.steps.map((stepData: any, index: number) => ({
                id: stepData.id || `step_${index + 1}`,
                description: stepData.description,
                type: stepData.type,
                filePath: stepData.filePath,
                content: stepData.content,
                changes: stepData.changes,
                command: stepData.command,
                estimated_time: stepData.estimated_time || 5,
                dependencies: stepData.dependencies || [],
                approved: false,
                completed: false
            }));

            // Calculate total estimated time
            const totalEstimatedTime = steps.reduce((total, step) => total + step.estimated_time, 0);

            const plan: TaskPlan = {
                id: this.generatePlanId(),
                title: planData.title,
                description: planData.description,
                steps: steps,
                totalEstimatedTime: totalEstimatedTime,
                created: new Date().toISOString(),
                status: 'draft'
            };

            return plan;

        } catch (error) {
            throw new Error(`Failed to parse LLM response: ${error}\nResponse: ${llmResponse}`);
        }
    }

    private validateAndOptimizePlan(plan: TaskPlan): TaskPlan {
        // Validate step dependencies
        const stepIds = new Set(plan.steps.map(s => s.id));
        
        for (const step of plan.steps) {
            // Check if all dependencies exist
            for (const depId of step.dependencies) {
                if (!stepIds.has(depId)) {
                    console.warn(`Step ${step.id} has invalid dependency: ${depId}`);
                    step.dependencies = step.dependencies.filter(id => stepIds.has(id));
                }
            }
        }

        // Sort steps by dependencies (topological sort)
        const sortedSteps = this.topologicalSort(plan.steps);
        plan.steps = sortedSteps;

        // Validate file paths
        for (const step of plan.steps) {
            if (step.filePath && !this.isValidFilePath(step.filePath)) {
                console.warn(`Step ${step.id} has invalid file path: ${step.filePath}`);
            }
        }

        // Optimize time estimates
        this.optimizeTimeEstimates(plan);

        return plan;
    }

    private topologicalSort(steps: TaskStep[]): TaskStep[] {
        const result: TaskStep[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const stepMap = new Map(steps.map(s => [s.id, s]));

        const visit = (stepId: string) => {
            if (visiting.has(stepId)) {
                throw new Error(`Circular dependency detected involving step: ${stepId}`);
            }
            if (visited.has(stepId)) {
                return;
            }

            visiting.add(stepId);
            const step = stepMap.get(stepId);
            if (step) {
                for (const depId of step.dependencies) {
                    visit(depId);
                }
                visiting.delete(stepId);
                visited.add(stepId);
                result.push(step);
            }
        };

        for (const step of steps) {
            if (!visited.has(step.id)) {
                visit(step.id);
            }
        }

        return result;
    }

    private isValidFilePath(filePath: string): boolean {
        // Basic validation for file paths
        if (!filePath || filePath.trim() === '') return false;
        if (filePath.includes('..')) return false; // Prevent directory traversal
        if (filePath.startsWith('/') && process.platform === 'win32') return false;
        return true;
    }

    private optimizeTimeEstimates(plan: TaskPlan): void {
        // Adjust time estimates based on step complexity
        for (const step of plan.steps) {
            switch (step.type) {
                case 'file_create':
                    if (step.content && step.content.length > 1000) {
                        step.estimated_time = Math.max(step.estimated_time, 10);
                    }
                    break;
                case 'file_modify':
                    if (step.changes && step.changes.length > 500) {
                        step.estimated_time = Math.max(step.estimated_time, 8);
                    }
                    break;
                case 'command_execute':
                    // Commands might take longer due to compilation, testing, etc.
                    step.estimated_time = Math.max(step.estimated_time, 3);
                    break;
            }
        }

        // Recalculate total time
        plan.totalEstimatedTime = plan.steps.reduce((total, step) => total + step.estimated_time, 0);
    }

    private generatePlanId(): string {
        return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async generatePlanFromUserInput(userInput: string): Promise<TaskPlan> {
        // Get current editor context
        const editor = vscode.window.activeTextEditor;
        const selectedFiles: string[] = [];
        
        if (editor) {
            selectedFiles.push(editor.document.fileName);
        }

        // Get code snippets from context service
        const codeSnippets = this.codeContextService.getCodeSnippets();

        const request: TaskRequest = {
            description: userInput,
            context: {
                selectedFiles,
                codeSnippets
            },
            constraints: {
                maxSteps: 15,
                maxTime: 45
            }
        };

        return this.generateTaskPlan(request);
    }

    async refineTaskPlan(plan: TaskPlan, feedback: string): Promise<TaskPlan> {
        const refinementPrompt = `
Please refine the following task plan based on the user feedback:

ORIGINAL PLAN:
${JSON.stringify(plan, null, 2)}

USER FEEDBACK:
${feedback}

Please provide an improved version of the plan that addresses the feedback.
Respond ONLY with valid JSON in the same format as the original plan.
        `;

        const llmResult = await this.llmService.generateCompletion(refinementPrompt);
        const llmResponse = llmResult.content;
        const refinedPlan = this.parseLLMResponseToPlan(llmResponse, {
            description: plan.description
        });

        // Preserve the original ID and creation time
        refinedPlan.id = plan.id;
        refinedPlan.created = plan.created;
        refinedPlan.status = 'under_review';

        return this.validateAndOptimizePlan(refinedPlan);
    }
}
