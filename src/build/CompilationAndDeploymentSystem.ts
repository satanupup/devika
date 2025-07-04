import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TerminalIntegrationSystem } from '../terminal/TerminalIntegrationSystem';

export interface BuildPipeline {
    id: string;
    name: string;
    description: string;
    projectType: 'npm' | 'android' | 'ios' | 'flutter' | 'react-native' | 'electron' | 'web' | 'custom';
    stages: BuildStage[];
    environment: { [key: string]: string };
    triggers: BuildTrigger[];
    notifications: NotificationConfig[];
    artifacts: ArtifactConfig[];
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface BuildStage {
    id: string;
    name: string;
    description: string;
    type: 'build' | 'test' | 'lint' | 'security' | 'deploy' | 'custom';
    commands: string[];
    workingDirectory?: string;
    environment?: { [key: string]: string };
    condition?: string;
    timeout: number;
    retryCount: number;
    continueOnFailure: boolean;
    parallel: boolean;
    dependencies: string[];
    artifacts: string[];
    order: number;
}

export interface BuildTrigger {
    type: 'manual' | 'git_push' | 'git_tag' | 'schedule' | 'file_change';
    condition?: string;
    branches?: string[];
    tags?: string[];
    schedule?: string; // cron expression
    filePatterns?: string[];
    enabled: boolean;
}

export interface NotificationConfig {
    type: 'email' | 'slack' | 'teams' | 'webhook' | 'vscode';
    target: string;
    events: ('start' | 'success' | 'failure' | 'cancelled')[];
    template?: string;
    enabled: boolean;
}

export interface ArtifactConfig {
    name: string;
    path: string;
    type: 'file' | 'directory' | 'archive';
    retention: number; // days
    publish: boolean;
    publishTarget?: string;
}

export interface BuildExecution {
    id: string;
    pipelineId: string;
    trigger: string;
    status: 'queued' | 'running' | 'success' | 'failure' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    stages: StageExecution[];
    artifacts: GeneratedArtifact[];
    logs: BuildLog[];
    environment: { [key: string]: string };
    metadata: { [key: string]: any };
}

export interface StageExecution {
    stageId: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'failure' | 'skipped' | 'cancelled';
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    exitCode?: number;
    output: string;
    error: string;
    artifacts: string[];
}

export interface GeneratedArtifact {
    name: string;
    path: string;
    size: number;
    checksum: string;
    createdAt: Date;
    published: boolean;
    publishUrl?: string;
}

export interface BuildLog {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    stage?: string;
    message: string;
    details?: any;
}

export interface DeploymentTarget {
    id: string;
    name: string;
    type: 'vercel' | 'netlify' | 'aws' | 'azure' | 'gcp' | 'docker' | 'ftp' | 'custom';
    configuration: { [key: string]: any };
    environment: 'development' | 'staging' | 'production';
    url?: string;
    healthCheck?: HealthCheckConfig;
    rollback?: RollbackConfig;
    enabled: boolean;
}

export interface HealthCheckConfig {
    url: string;
    method: 'GET' | 'POST' | 'HEAD';
    expectedStatus: number;
    timeout: number;
    retries: number;
    interval: number;
}

export interface RollbackConfig {
    enabled: boolean;
    strategy: 'automatic' | 'manual';
    conditions: string[];
    maxAttempts: number;
}

export class CompilationAndDeploymentSystem {
    private pipelines: Map<string, BuildPipeline> = new Map();
    private executions: Map<string, BuildExecution> = new Map();
    private deploymentTargets: Map<string, DeploymentTarget> = new Map();
    private activeBuilds: Set<string> = new Set();

    constructor(
        private context: vscode.ExtensionContext,
        private terminalSystem: TerminalIntegrationSystem
    ) {
        this.initializeDefaultPipelines();
        this.loadConfigurations();
        this.setupFileWatcher();
    }

    /**
     * 創建構建管道
     */
    async createPipeline(pipeline: Omit<BuildPipeline, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const pipelineId = this.generatePipelineId(pipeline.name);
        const fullPipeline: BuildPipeline = {
            ...pipeline,
            id: pipelineId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.pipelines.set(pipelineId, fullPipeline);
        await this.saveConfigurations();

        return pipelineId;
    }

    /**
     * 執行構建管道
     */
    async executePipeline(pipelineId: string, trigger: string = 'manual'): Promise<string> {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            throw new Error(`構建管道不存在: ${pipelineId}`);
        }

        if (!pipeline.enabled) {
            throw new Error(`構建管道已禁用: ${pipelineId}`);
        }

        const executionId = this.generateExecutionId();
        const execution: BuildExecution = {
            id: executionId,
            pipelineId,
            trigger,
            status: 'queued',
            startTime: new Date(),
            stages: pipeline.stages.map(stage => ({
                stageId: stage.id,
                name: stage.name,
                status: 'pending',
                output: '',
                error: '',
                artifacts: []
            })),
            artifacts: [],
            logs: [],
            environment: { ...pipeline.environment },
            metadata: {}
        };

        this.executions.set(executionId, execution);
        this.activeBuilds.add(executionId);

        // 發送開始通知
        await this.sendNotifications(pipeline, 'start', execution);

        // 異步執行構建
        this.runPipelineExecution(pipeline, execution).catch(error => {
            console.error('構建執行失敗:', error);
        });

        return executionId;
    }

    /**
     * 運行管道執行
     */
    private async runPipelineExecution(pipeline: BuildPipeline, execution: BuildExecution): Promise<void> {
        try {
            execution.status = 'running';
            this.addBuildLog(execution, 'info', `開始執行構建管道: ${pipeline.name}`);

            // 按順序執行階段
            const sortedStages = pipeline.stages.sort((a, b) => a.order - b.order);

            for (const stage of sortedStages) {
                // 檢查依賴
                if (!this.checkStageDependencies(stage, execution)) {
                    this.addBuildLog(execution, 'warn', `跳過階段 ${stage.name}: 依賴未滿足`);
                    this.updateStageStatus(execution, stage.id, 'skipped');
                    continue;
                }

                // 檢查條件
                if (stage.condition && !this.evaluateCondition(stage.condition, execution)) {
                    this.addBuildLog(execution, 'info', `跳過階段 ${stage.name}: 條件不滿足`);
                    this.updateStageStatus(execution, stage.id, 'skipped');
                    continue;
                }

                await this.executeStage(pipeline, stage, execution);

                // 檢查階段結果
                const stageExecution = execution.stages.find(s => s.stageId === stage.id);
                if (stageExecution?.status === 'failure' && !stage.continueOnFailure) {
                    execution.status = 'failure';
                    break;
                }
            }

            // 設置最終狀態
            if (execution.status === 'running') {
                const hasFailures = execution.stages.some(s => s.status === 'failure');
                execution.status = hasFailures ? 'failure' : 'success';
            }

            execution.endTime = new Date();
            execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

            this.addBuildLog(execution, 'info', `構建完成，狀態: ${execution.status}`);

            // 發送完成通知
            await this.sendNotifications(pipeline, execution.status as any, execution);

        } catch (error) {
            execution.status = 'failure';
            execution.endTime = new Date();
            execution.duration = execution.endTime!.getTime() - execution.startTime.getTime();

            this.addBuildLog(execution, 'error', `構建失敗: ${error}`);
            await this.sendNotifications(pipeline, 'failure', execution);
        } finally {
            this.activeBuilds.delete(execution.id);
        }
    }

    /**
     * 執行階段
     */
    private async executeStage(pipeline: BuildPipeline, stage: BuildStage, execution: BuildExecution): Promise<void> {
        const stageExecution = execution.stages.find(s => s.stageId === stage.id);
        if (!stageExecution) {return;}

        this.addBuildLog(execution, 'info', `開始執行階段: ${stage.name}`);

        stageExecution.status = 'running';
        stageExecution.startTime = new Date();

        try {
            // 創建終端會話
            const sessionId = await this.terminalSystem.createTerminalSession(
                `Build: ${pipeline.name} - ${stage.name}`,
                'build',
                {
                    workingDirectory: stage.workingDirectory,
                    environment: { ...execution.environment, ...stage.environment }
                }
            );

            // 執行命令
            for (const command of stage.commands) {
                const result = await this.terminalSystem.executeCommand(sessionId, command);

                stageExecution.output += result.output + '\n';
                if (result.error) {
                    stageExecution.error += result.error + '\n';
                }

                if (!result.success) {
                    stageExecution.exitCode = result.exitCode;
                    throw new Error(`命令執行失敗: ${command}`);
                }
            }

            // 收集產物
            await this.collectStageArtifacts(stage, execution, stageExecution);

            stageExecution.status = 'success';
            this.addBuildLog(execution, 'info', `階段 ${stage.name} 執行成功`);

        } catch (error) {
            stageExecution.status = 'failure';
            stageExecution.error += String(error);
            this.addBuildLog(execution, 'error', `階段 ${stage.name} 執行失敗: ${error}`);

            if (!stage.continueOnFailure) {
                throw error;
            }
        } finally {
            stageExecution.endTime = new Date();
            stageExecution.duration = stageExecution.endTime.getTime() - stageExecution.startTime!.getTime();
        }
    }

    /**
     * 部署到目標環境
     */
    async deployToTarget(targetId: string, artifactPath: string): Promise<void> {
        const target = this.deploymentTargets.get(targetId);
        if (!target) {
            throw new Error(`部署目標不存在: ${targetId}`);
        }

        if (!target.enabled) {
            throw new Error(`部署目標已禁用: ${targetId}`);
        }

        try {
            // 執行部署
            await this.performDeployment(target, artifactPath);

            // 健康檢查
            if (target.healthCheck) {
                await this.performHealthCheck(target);
            }

            vscode.window.showInformationMessage(`部署到 ${target.name} 成功`);

        } catch (error) {
            vscode.window.showErrorMessage(`部署到 ${target.name} 失敗: ${error}`);

            // 自動回滾
            if (target.rollback?.enabled && target.rollback.strategy === 'automatic') {
                await this.performRollback(target);
            }

            throw error;
        }
    }

    /**
     * NPM 項目支援
     */
    async buildNpmProject(options: {
        command?: string;
        environment?: string;
        watch?: boolean;
    } = {}): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('沒有打開的工作區');
        }

        const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            throw new Error('未找到 package.json 文件');
        }

        const command = options.command || 'build';
        const env = options.environment || 'production';

        // 創建 NPM 構建管道
        const pipelineId = await this.createPipeline({
            name: `NPM ${command}`,
            description: `NPM 項目 ${command} 構建`,
            projectType: 'npm',
            stages: [
                {
                    id: 'install',
                    name: '安裝依賴',
                    description: '安裝 NPM 依賴',
                    type: 'build',
                    commands: ['npm ci'],
                    timeout: 300000,
                    retryCount: 2,
                    continueOnFailure: false,
                    parallel: false,
                    dependencies: [],
                    artifacts: [],
                    order: 1
                },
                {
                    id: 'build',
                    name: '構建項目',
                    description: `執行 npm run ${command}`,
                    type: 'build',
                    commands: [`npm run ${command}`],
                    environment: { NODE_ENV: env },
                    timeout: 600000,
                    retryCount: 1,
                    continueOnFailure: false,
                    parallel: false,
                    dependencies: ['install'],
                    artifacts: ['dist/**/*', 'build/**/*'],
                    order: 2
                }
            ],
            environment: { NODE_ENV: env },
            triggers: [{ type: 'manual', enabled: true }],
            notifications: [
                {
                    type: 'vscode',
                    target: 'user',
                    events: ['success', 'failure'],
                    enabled: true
                }
            ],
            artifacts: [
                {
                    name: 'build-output',
                    path: 'dist',
                    type: 'directory',
                    retention: 30,
                    publish: false
                }
            ],
            enabled: true
        });

        return await this.executePipeline(pipelineId, 'manual');
    }

    /**
     * Android 項目支援
     */
    async buildAndroidProject(options: {
        buildType?: 'debug' | 'release';
        flavor?: string;
        tasks?: string[];
    } = {}): Promise<string> {
        const buildType = options.buildType || 'debug';
        const tasks = options.tasks || [`assemble${buildType.charAt(0).toUpperCase() + buildType.slice(1)}`];

        const pipelineId = await this.createPipeline({
            name: `Android ${buildType}`,
            description: `Android 項目 ${buildType} 構建`,
            projectType: 'android',
            stages: [
                {
                    id: 'gradle-build',
                    name: 'Gradle 構建',
                    description: '執行 Gradle 構建任務',
                    type: 'build',
                    commands: tasks.map(task => `./gradlew ${task}`),
                    timeout: 1800000, // 30 分鐘
                    retryCount: 1,
                    continueOnFailure: false,
                    parallel: false,
                    dependencies: [],
                    artifacts: ['app/build/outputs/**/*'],
                    order: 1
                }
            ],
            environment: { ANDROID_BUILD_TYPE: buildType },
            triggers: [{ type: 'manual', enabled: true }],
            notifications: [
                {
                    type: 'vscode',
                    target: 'user',
                    events: ['success', 'failure'],
                    enabled: true
                }
            ],
            artifacts: [
                {
                    name: 'android-apk',
                    path: 'app/build/outputs/apk',
                    type: 'directory',
                    retention: 30,
                    publish: false
                }
            ],
            enabled: true
        });

        return await this.executePipeline(pipelineId, 'manual');
    }

    // 私有輔助方法
    private initializeDefaultPipelines(): void {
        // 初始化默認管道配置
    }

    private checkStageDependencies(stage: BuildStage, execution: BuildExecution): boolean {
        if (stage.dependencies.length === 0) {return true;}

        return stage.dependencies.every(depId => {
            const depStage = execution.stages.find(s => s.stageId === depId);
            return depStage?.status === 'success';
        });
    }

    private evaluateCondition(condition: string, execution: BuildExecution): boolean {
        // 簡化的條件評估
        try {
            const func = new Function('execution', `return ${condition}`);
            return func(execution);
        } catch {
            return false;
        }
    }

    private updateStageStatus(execution: BuildExecution, stageId: string, status: StageExecution['status']): void {
        const stage = execution.stages.find(s => s.stageId === stageId);
        if (stage) {
            stage.status = status;
        }
    }

    private addBuildLog(execution: BuildExecution, level: BuildLog['level'], message: string, stage?: string): void {
        execution.logs.push({
            timestamp: new Date(),
            level,
            stage,
            message
        });
    }

    private async collectStageArtifacts(stage: BuildStage, execution: BuildExecution, stageExecution: StageExecution): Promise<void> {
        // 收集階段產物的實作
    }

    private async sendNotifications(pipeline: BuildPipeline, event: 'start' | 'success' | 'failure', execution: BuildExecution): Promise<void> {
        for (const notification of pipeline.notifications) {
            if (notification.enabled && notification.events.includes(event)) {
                if (notification.type === 'vscode') {
                    const message = `構建 ${pipeline.name} ${event === 'start' ? '開始' : event === 'success' ? '成功' : '失敗'}`;
                    if (event === 'success') {
                        vscode.window.showInformationMessage(message);
                    } else if (event === 'failure') {
                        vscode.window.showErrorMessage(message);
                    } else {
                        vscode.window.showInformationMessage(message);
                    }
                }
            }
        }
    }

    private async performDeployment(target: DeploymentTarget, artifactPath: string): Promise<void> {
        // 部署實作
    }

    private async performHealthCheck(target: DeploymentTarget): Promise<void> {
        // 健康檢查實作
    }

    private async performRollback(target: DeploymentTarget): Promise<void> {
        // 回滾實作
    }

    private setupFileWatcher(): void {
        // 設置文件監視器以觸發自動構建
    }

    private generatePipelineId(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    }

    private generateExecutionId(): string {
        return 'exec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    private loadConfigurations(): void {
        const configs = this.context.globalState.get<any>('buildConfigurations', {});

        if (configs.pipelines) {
            for (const pipeline of configs.pipelines) {
                this.pipelines.set(pipeline.id, {
                    ...pipeline,
                    createdAt: new Date(pipeline.createdAt),
                    updatedAt: new Date(pipeline.updatedAt)
                });
            }
        }

        if (configs.deploymentTargets) {
            for (const target of configs.deploymentTargets) {
                this.deploymentTargets.set(target.id, target);
            }
        }
    }

    private async saveConfigurations(): Promise<void> {
        const configs = {
            pipelines: Array.from(this.pipelines.values()),
            deploymentTargets: Array.from(this.deploymentTargets.values())
        };

        await this.context.globalState.update('buildConfigurations', configs);
    }

    /**
     * 獲取所有管道
     */
    getPipelines(): BuildPipeline[] {
        return Array.from(this.pipelines.values());
    }

    /**
     * 獲取執行歷史
     */
    getExecutions(pipelineId?: string): BuildExecution[] {
        const executions = Array.from(this.executions.values());
        return pipelineId ? executions.filter(e => e.pipelineId === pipelineId) : executions;
    }

    /**
     * 取消構建
     */
    async cancelExecution(executionId: string): Promise<void> {
        const execution = this.executions.get(executionId);
        if (execution && this.activeBuilds.has(executionId)) {
            execution.status = 'cancelled';
            execution.endTime = new Date();
            execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

            this.activeBuilds.delete(executionId);
            this.addBuildLog(execution, 'info', '構建已取消');
        }
    }

    /**
     * 清理資源
     */
    dispose(): void {
        // 取消所有活躍構建
        for (const executionId of this.activeBuilds) {
            this.cancelExecution(executionId);
        }
    }
}
