import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';

export interface Checkpoint {
    id: string;
    name: string;
    description: string;
    timestamp: string;
    files: CheckpointFile[];
    metadata: CheckpointMetadata;
}

export interface CheckpointFile {
    filePath: string;
    content: string;
    hash: string;
    size: number;
    lastModified: string;
}

export interface CheckpointMetadata {
    taskId?: string;
    agentAction?: string;
    userInitiated: boolean;
    tags: string[];
    branchName?: string;
    commitHash?: string;
}

export interface RollbackResult {
    success: boolean;
    restoredFiles: string[];
    failedFiles: { filePath: string; error: string }[];
    conflicts: string[];
}

export class CheckpointManager {
    private checkpoints: Map<string, Checkpoint> = new Map();
    private maxCheckpoints = 50;
    private storageKey = 'devika.checkpoints';

    constructor(private context: vscode.ExtensionContext) {
        this.loadCheckpoints();
    }

    async createCheckpoint(
        name: string,
        description: string,
        files: string[],
        metadata: Partial<CheckpointMetadata> = {}
    ): Promise<string> {
        const checkpointId = this.generateCheckpointId();
        const checkpointFiles: CheckpointFile[] = [];

        // Capture current state of specified files
        for (const filePath of files) {
            try {
                const checkpointFile = await this.captureFileState(filePath);
                checkpointFiles.push(checkpointFile);
            } catch (error) {
                console.warn(`Failed to capture file ${filePath}:`, error);
            }
        }

        const checkpoint: Checkpoint = {
            id: checkpointId,
            name,
            description,
            timestamp: new Date().toISOString(),
            files: checkpointFiles,
            metadata: {
                userInitiated: true,
                tags: [],
                ...metadata
            }
        };

        this.checkpoints.set(checkpointId, checkpoint);
        await this.saveCheckpoints();

        // Clean up old checkpoints if we exceed the limit
        await this.cleanupOldCheckpoints();

        vscode.window.showInformationMessage(
            `检查点 "${name}" 已创建，包含 ${checkpointFiles.length} 个文件`
        );

        return checkpointId;
    }

    private async captureFileState(filePath: string): Promise<CheckpointFile> {
        const uri = vscode.Uri.file(filePath);
        const stat = await vscode.workspace.fs.stat(uri);
        const content = await vscode.workspace.fs.readFile(uri);
        const contentStr = Buffer.from(content).toString('utf8');
        const hash = crypto.createHash('sha256').update(contentStr).digest('hex');

        return {
            filePath,
            content: contentStr,
            hash,
            size: stat.size,
            lastModified: new Date(stat.mtime).toISOString()
        };
    }

    async createAutoCheckpoint(
        taskId: string,
        agentAction: string,
        affectedFiles: string[]
    ): Promise<string> {
        const name = `Auto: ${agentAction}`;
        const description = `Automatic checkpoint before ${agentAction} (Task: ${taskId})`;
        
        return this.createCheckpoint(name, description, affectedFiles, {
            taskId,
            agentAction,
            userInitiated: false,
            tags: ['auto', 'agent']
        });
    }

    async rollbackToCheckpoint(checkpointId: string): Promise<RollbackResult> {
        const checkpoint = this.checkpoints.get(checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }

        const result: RollbackResult = {
            success: true,
            restoredFiles: [],
            failedFiles: [],
            conflicts: []
        };

        // Check for conflicts before rolling back
        const conflicts = await this.detectRollbackConflicts(checkpoint);
        if (conflicts.length > 0) {
            result.conflicts = conflicts;
            
            const proceed = await vscode.window.showWarningMessage(
                `检测到 ${conflicts.length} 个冲突文件。是否继续回滚？`,
                { modal: true },
                '继续',
                '取消'
            );

            if (proceed !== '继续') {
                result.success = false;
                return result;
            }
        }

        // Perform the rollback
        for (const file of checkpoint.files) {
            try {
                await this.restoreFile(file);
                result.restoredFiles.push(file.filePath);
            } catch (error) {
                result.failedFiles.push({
                    filePath: file.filePath,
                    error: error instanceof Error ? error.message : String(error)
                });
                result.success = false;
            }
        }

        if (result.success) {
            vscode.window.showInformationMessage(
                `成功回滚到检查点 "${checkpoint.name}"，恢复了 ${result.restoredFiles.length} 个文件`
            );
        } else {
            vscode.window.showWarningMessage(
                `回滚部分成功：${result.restoredFiles.length} 个文件已恢复，${result.failedFiles.length} 个文件失败`
            );
        }

        return result;
    }

    private async detectRollbackConflicts(checkpoint: Checkpoint): Promise<string[]> {
        const conflicts: string[] = [];

        for (const file of checkpoint.files) {
            try {
                const uri = vscode.Uri.file(file.filePath);
                const currentContent = await vscode.workspace.fs.readFile(uri);
                const currentContentStr = Buffer.from(currentContent).toString('utf8');
                const currentHash = crypto.createHash('sha256').update(currentContentStr).digest('hex');

                if (currentHash !== file.hash) {
                    conflicts.push(file.filePath);
                }
            } catch (error) {
                // File might not exist anymore, which is also a conflict
                conflicts.push(file.filePath);
            }
        }

        return conflicts;
    }

    private async restoreFile(file: CheckpointFile): Promise<void> {
        const uri = vscode.Uri.file(file.filePath);
        
        // Ensure directory exists
        const dirPath = path.dirname(file.filePath);
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
        } catch {
            // Directory might already exist
        }

        // Restore file content
        await vscode.workspace.fs.writeFile(uri, Buffer.from(file.content, 'utf8'));
    }

    getCheckpoints(): Checkpoint[] {
        return Array.from(this.checkpoints.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    getCheckpoint(id: string): Checkpoint | undefined {
        return this.checkpoints.get(id);
    }

    async deleteCheckpoint(id: string): Promise<boolean> {
        const deleted = this.checkpoints.delete(id);
        if (deleted) {
            await this.saveCheckpoints();
            vscode.window.showInformationMessage('检查点已删除');
        }
        return deleted;
    }

    async showCheckpointManager(): Promise<void> {
        const checkpoints = this.getCheckpoints();
        
        if (checkpoints.length === 0) {
            vscode.window.showInformationMessage('暂无检查点');
            return;
        }

        const items = checkpoints.map(checkpoint => ({
            label: `$(history) ${checkpoint.name}`,
            description: new Date(checkpoint.timestamp).toLocaleString(),
            detail: `${checkpoint.description} (${checkpoint.files.length} 个文件)`,
            checkpoint
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择检查点操作',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const action = await vscode.window.showQuickPick([
                { label: '$(history) 回滚到此检查点', action: 'rollback' },
                { label: '$(eye) 查看检查点详情', action: 'view' },
                { label: '$(diff) 比较与当前状态', action: 'compare' },
                { label: '$(trash) 删除检查点', action: 'delete' }
            ], {
                placeHolder: '选择操作'
            });

            if (action) {
                switch (action.action) {
                    case 'rollback':
                        await this.rollbackToCheckpoint(selected.checkpoint.id);
                        break;
                    case 'view':
                        await this.showCheckpointDetails(selected.checkpoint);
                        break;
                    case 'compare':
                        await this.compareWithCurrent(selected.checkpoint);
                        break;
                    case 'delete':
                        await this.deleteCheckpoint(selected.checkpoint.id);
                        break;
                }
            }
        }
    }

    private async showCheckpointDetails(checkpoint: Checkpoint): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'checkpointDetails',
            `检查点详情: ${checkpoint.name}`,
            vscode.ViewColumn.Two,
            { enableScripts: false }
        );

        panel.webview.html = this.getCheckpointDetailsHtml(checkpoint);
    }

    private getCheckpointDetailsHtml(checkpoint: Checkpoint): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .file-list {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                }
                .file-item {
                    margin-bottom: 10px;
                    padding: 8px;
                    background: var(--vscode-list-hoverBackground);
                    border-radius: 4px;
                }
                .file-path {
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                }
                .file-meta {
                    font-size: 0.9em;
                    opacity: 0.8;
                    margin-top: 4px;
                }
                .metadata {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    margin-top: 20px;
                }
                .tag {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 0.8em;
                    margin-right: 5px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📸 ${checkpoint.name}</h1>
                <p>${checkpoint.description}</p>
                <p><strong>创建时间:</strong> ${new Date(checkpoint.timestamp).toLocaleString()}</p>
                <p><strong>文件数量:</strong> ${checkpoint.files.length}</p>
            </div>

            <h3>📁 包含的文件</h3>
            <div class="file-list">
                ${checkpoint.files.map(file => `
                    <div class="file-item">
                        <div class="file-path">${file.filePath}</div>
                        <div class="file-meta">
                            大小: ${(file.size / 1024).toFixed(1)} KB | 
                            修改时间: ${new Date(file.lastModified).toLocaleString()} |
                            哈希: ${file.hash.substring(0, 8)}...
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="metadata">
                <h3>📋 元数据</h3>
                <p><strong>任务ID:</strong> ${checkpoint.metadata.taskId || 'N/A'}</p>
                <p><strong>代理操作:</strong> ${checkpoint.metadata.agentAction || 'N/A'}</p>
                <p><strong>用户发起:</strong> ${checkpoint.metadata.userInitiated ? '是' : '否'}</p>
                <p><strong>分支:</strong> ${checkpoint.metadata.branchName || 'N/A'}</p>
                <p><strong>标签:</strong> 
                    ${checkpoint.metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </p>
            </div>
        </body>
        </html>
        `;
    }

    private async compareWithCurrent(checkpoint: Checkpoint): Promise<void> {
        let differences = 0;
        
        for (const file of checkpoint.files) {
            try {
                const uri = vscode.Uri.file(file.filePath);
                const currentContent = await vscode.workspace.fs.readFile(uri);
                const currentContentStr = Buffer.from(currentContent).toString('utf8');
                
                if (currentContentStr !== file.content) {
                    differences++;
                    
                    // Show diff for first few files
                    if (differences <= 3) {
                        const tempUri = vscode.Uri.parse(`untitled:${path.basename(file.filePath)}.checkpoint`);
                        const tempDoc = await vscode.workspace.openTextDocument(tempUri);
                        const edit = new vscode.WorkspaceEdit();
                        edit.insert(tempUri, new vscode.Position(0, 0), file.content);
                        await vscode.workspace.applyEdit(edit);
                        
                        await vscode.commands.executeCommand('vscode.diff', tempUri, uri, 
                            `${path.basename(file.filePath)}: 检查点 ↔ 当前`);
                    }
                }
            } catch (error) {
                differences++;
            }
        }

        if (differences === 0) {
            vscode.window.showInformationMessage('检查点与当前状态完全一致');
        } else {
            vscode.window.showInformationMessage(
                `发现 ${differences} 个文件有差异${differences > 3 ? '（仅显示前3个差异）' : ''}`
            );
        }
    }

    private generateCheckpointId(): string {
        return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async loadCheckpoints(): Promise<void> {
        try {
            const saved = this.context.globalState.get<Checkpoint[]>(this.storageKey, []);
            this.checkpoints.clear();
            for (const checkpoint of saved) {
                this.checkpoints.set(checkpoint.id, checkpoint);
            }
        } catch (error) {
            console.warn('Failed to load checkpoints:', error);
        }
    }

    private async saveCheckpoints(): Promise<void> {
        try {
            const checkpointsArray = Array.from(this.checkpoints.values());
            await this.context.globalState.update(this.storageKey, checkpointsArray);
        } catch (error) {
            console.warn('Failed to save checkpoints:', error);
        }
    }

    private async cleanupOldCheckpoints(): Promise<void> {
        const checkpoints = this.getCheckpoints();
        
        if (checkpoints.length > this.maxCheckpoints) {
            const toDelete = checkpoints.slice(this.maxCheckpoints);
            for (const checkpoint of toDelete) {
                this.checkpoints.delete(checkpoint.id);
            }
            await this.saveCheckpoints();
        }
    }

    async createWorkspaceCheckpoint(): Promise<string> {
        // Create a checkpoint of all modified files in the workspace
        const modifiedFiles: string[] = [];
        
        // Get all open editors
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.isDirty) {
                modifiedFiles.push(editor.document.fileName);
            }
        }

        // Get recently modified files from Git (if available)
        try {
            const gitFiles = await vscode.workspace.findFiles('**/*', '.git/**', 100);
            for (const file of gitFiles.slice(0, 20)) { // Limit for performance
                modifiedFiles.push(file.fsPath);
            }
        } catch {
            // Git not available or no git repo
        }

        const uniqueFiles = [...new Set(modifiedFiles)];
        
        return this.createCheckpoint(
            '工作区快照',
            `工作区状态快照 (${uniqueFiles.length} 个文件)`,
            uniqueFiles,
            { tags: ['workspace', 'manual'] }
        );
    }
}
