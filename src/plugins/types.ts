import { LLMService } from '../llm/LLMService';

export interface TaskDefinition {
    id: string;
    name: string;
    description: string;
    agent: string;
    category: string;
    inputs: any;
    steps: string[];
    estimatedTime?: string;
    tags: string[];
}

export interface TaskContext {
    plugin: TaskDefinition;
    inputs: any;
    fileSystem: FileSystemInterface;
    ui: UIInterface;
    project: ProjectInterface;
    llmService: LLMService;
}

export interface TaskResult {
    success: boolean;
    message: string;
    files?: string[];
    data?: any;
    error?: Error;
}

export interface FileSystemInterface {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    fileExists(path: string): Promise<boolean>;
    getProjectStructure(): Promise<string[]>;
}

export interface UIInterface {
    showPreview(fileName: string, content: string, message: string): Promise<boolean>;
    showMessage(message: string, type?: 'info' | 'warning' | 'error'): Promise<void>;
}

export interface ProjectInterface {
    readonly primaryLanguage: string;
    readonly name: string;
}

export interface PromptTemplate {
    name: string;
    template: string;
    variables: string[];
}

export interface AgentCapabilities {
    canReadFiles: boolean;
    canWriteFiles: boolean;
    canAnalyzeCode: boolean;
    canGenerateCode: boolean;
    canInteractWithUser: boolean;
}

export interface PluginMetadata {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    category: string;
    tags: string[];
    requirements: {
        vscodeVersion: string;
        languages?: string[];
        dependencies?: string[];
    };
    capabilities: AgentCapabilities;
}

export interface WorkflowStep {
    id: string;
    name: string;
    description: string;
    agent: string;
    inputs: any;
    outputs: any;
    condition?: string;
}

export interface Workflow {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    triggers: string[];
}

export type PluginCategory =
    | 'documentation'
    | 'code-analysis'
    | 'refactoring'
    | 'testing'
    | 'git'
    | 'automation'
    | 'utility';

export type TaskStatus =
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface TaskExecution {
    id: string;
    pluginId: string;
    status: TaskStatus;
    startTime: Date;
    endTime?: Date;
    result?: TaskResult;
    progress: number;
    currentStep: string;
}
