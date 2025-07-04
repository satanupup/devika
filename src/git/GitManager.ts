import * as vscode from 'vscode';
import * as path from 'path';

export interface GitRepository {
    rootUri: vscode.Uri;
    state: GitRepositoryState;
    api: any; // Git API from VS Code Git extension
}

export interface GitRepositoryState {
    HEAD?: GitBranch;
    refs: GitRef[];
    remotes: GitRemote[];
    workingTreeChanges: GitChange[];
    indexChanges: GitChange[];
    mergeChanges: GitChange[];
    rebaseCommit?: GitCommit;
    isClean: boolean;
    onDidChange: vscode.Event<void>;
}

export interface GitBranch {
    name: string;
    commit?: GitCommit;
    upstream?: GitBranch;
    ahead: number;
    behind: number;
    type: GitRefType;
}

export interface GitRef {
    type: GitRefType;
    name?: string;
    commit?: GitCommit;
    remote?: string;
}

export interface GitRemote {
    name: string;
    fetchUrl?: string;
    pushUrl?: string;
    isReadOnly: boolean;
}

export interface GitChange {
    uri: vscode.Uri;
    originalUri: vscode.Uri;
    renameUri?: vscode.Uri;
    status: GitStatus;
}

export interface GitCommit {
    hash: string;
    message: string;
    parents: string[];
    authorDate?: Date;
    authorName?: string;
    authorEmail?: string;
    commitDate?: Date;
}

export enum GitRefType {
    Head,
    RemoteHead,
    Tag
}

export enum GitStatus {
    INDEX_MODIFIED,
    INDEX_ADDED,
    INDEX_DELETED,
    INDEX_RENAMED,
    INDEX_COPIED,
    MODIFIED,
    DELETED,
    UNTRACKED,
    IGNORED,
    INTENT_TO_ADD
}

export interface GitOperationResult {
    success: boolean;
    message?: string;
    error?: string;
    data?: any;
}

export interface GitCommitOptions {
    message: string;
    all?: boolean;
    amend?: boolean;
    signoff?: boolean;
    signCommit?: boolean;
    empty?: boolean;
    noVerify?: boolean;
}

export interface GitBranchOptions {
    name: string;
    checkout?: boolean;
    force?: boolean;
    upstream?: string;
}

export interface GitMergeOptions {
    branch: string;
    squash?: boolean;
    noCommit?: boolean;
    noFastForward?: boolean;
}

export class GitManager {
    private gitExtension: vscode.Extension<any> | undefined;
    private git: any;
    private repositories: Map<string, GitRepository> = new Map();

    private onRepositoryChangedEmitter = new vscode.EventEmitter<GitRepository>();
    public readonly onRepositoryChanged = this.onRepositoryChangedEmitter.event;

    constructor(private context: vscode.ExtensionContext) {
        this.initializeGitExtension();
    }

    /**
     * 初始化 Git 擴展
     */
    private async initializeGitExtension(): Promise<void> {
        try {
            this.gitExtension = vscode.extensions.getExtension('vscode.git');

            if (this.gitExtension) {
                if (!this.gitExtension.isActive) {
                    await this.gitExtension.activate();
                }

                this.git = this.gitExtension.exports.getAPI(1);

                // 監聽倉庫變更
                this.git.onDidOpenRepository((repo: any) => {
                    this.addRepository(repo);
                });

                this.git.onDidCloseRepository((repo: any) => {
                    this.removeRepository(repo);
                });

                // 初始化現有倉庫
                for (const repo of this.git.repositories) {
                    this.addRepository(repo);
                }

            } else {
                console.warn('Git 擴展未找到');
            }
        } catch (error) {
            console.error('初始化 Git 擴展失敗:', error);
        }
    }

    /**
     * 添加倉庫
     */
    private addRepository(repo: any): void {
        const gitRepo: GitRepository = {
            rootUri: repo.rootUri,
            state: this.mapRepositoryState(repo.state),
            api: repo
        };

        this.repositories.set(repo.rootUri.fsPath, gitRepo);

        // 監聽倉庫狀態變更
        repo.state.onDidChange(() => {
            gitRepo.state = this.mapRepositoryState(repo.state);
            this.onRepositoryChangedEmitter.fire(gitRepo);
        });

        console.log(`Git 倉庫已添加: ${repo.rootUri.fsPath}`);
    }

    /**
     * 移除倉庫
     */
    private removeRepository(repo: any): void {
        this.repositories.delete(repo.rootUri.fsPath);
        console.log(`Git 倉庫已移除: ${repo.rootUri.fsPath}`);
    }

    /**
     * 映射倉庫狀態
     */
    private mapRepositoryState(state: any): GitRepositoryState {
        return {
            HEAD: state.HEAD ? this.mapBranch(state.HEAD) : undefined,
            refs: state.refs.map((ref: any) => this.mapRef(ref)),
            remotes: state.remotes.map((remote: any) => this.mapRemote(remote)),
            workingTreeChanges: state.workingTreeChanges.map((change: any) => this.mapChange(change)),
            indexChanges: state.indexChanges.map((change: any) => this.mapChange(change)),
            mergeChanges: state.mergeChanges.map((change: any) => this.mapChange(change)),
            rebaseCommit: state.rebaseCommit ? this.mapCommit(state.rebaseCommit) : undefined,
            isClean: state.workingTreeChanges.length === 0 && state.indexChanges.length === 0,
            onDidChange: state.onDidChange
        };
    }

    /**
     * 獲取當前倉庫
     */
    getCurrentRepository(): GitRepository | undefined {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return Array.from(this.repositories.values())[0];
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (!workspaceFolder) {
            return Array.from(this.repositories.values())[0];
        }

        return this.repositories.get(workspaceFolder.uri.fsPath);
    }

    /**
     * 獲取所有倉庫
     */
    getAllRepositories(): GitRepository[] {
        return Array.from(this.repositories.values());
    }

    /**
     * 提交變更
     */
    async commit(options: GitCommitOptions): Promise<GitOperationResult> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return { success: false, error: '沒有找到 Git 倉庫' };
        }

        try {
            await repo.api.commit(options.message, {
                all: options.all,
                amend: options.amend,
                signoff: options.signoff,
                signCommit: options.signCommit,
                empty: options.empty,
                noVerify: options.noVerify
            });

            return {
                success: true,
                message: `成功提交: ${options.message}`
            };

        } catch (error) {
            return {
                success: false,
                error: `提交失敗: ${error}`
            };
        }
    }

    /**
     * 創建分支
     */
    async createBranch(options: GitBranchOptions): Promise<GitOperationResult> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return { success: false, error: '沒有找到 Git 倉庫' };
        }

        try {
            await repo.api.createBranch(options.name, options.checkout);

            if (options.upstream) {
                await repo.api.setBranchUpstream(options.name, options.upstream);
            }

            return {
                success: true,
                message: `成功創建分支: ${options.name}`
            };

        } catch (error) {
            return {
                success: false,
                error: `創建分支失敗: ${error}`
            };
        }
    }

    /**
     * 切換分支
     */
    async checkoutBranch(branchName: string): Promise<GitOperationResult> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return { success: false, error: '沒有找到 Git 倉庫' };
        }

        try {
            await repo.api.checkout(branchName);

            return {
                success: true,
                message: `成功切換到分支: ${branchName}`
            };

        } catch (error) {
            return {
                success: false,
                error: `切換分支失敗: ${error}`
            };
        }
    }

    /**
     * 合併分支
     */
    async mergeBranch(options: GitMergeOptions): Promise<GitOperationResult> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return { success: false, error: '沒有找到 Git 倉庫' };
        }

        try {
            await repo.api.merge(options.branch);

            return {
                success: true,
                message: `成功合併分支: ${options.branch}`
            };

        } catch (error) {
            return {
                success: false,
                error: `合併分支失敗: ${error}`
            };
        }
    }

    /**
     * 暫存文件
     */
    async stageFiles(files: vscode.Uri[]): Promise<GitOperationResult> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return { success: false, error: '沒有找到 Git 倉庫' };
        }

        try {
            await repo.api.add(files);

            return {
                success: true,
                message: `成功暫存 ${files.length} 個文件`
            };

        } catch (error) {
            return {
                success: false,
                error: `暫存文件失敗: ${error}`
            };
        }
    }

    /**
     * 取消暫存文件
     */
    async unstageFiles(files: vscode.Uri[]): Promise<GitOperationResult> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return { success: false, error: '沒有找到 Git 倉庫' };
        }

        try {
            await repo.api.revert(files);

            return {
                success: true,
                message: `成功取消暫存 ${files.length} 個文件`
            };

        } catch (error) {
            return {
                success: false,
                error: `取消暫存文件失敗: ${error}`
            };
        }
    }

    /**
     * 推送到遠程
     */
    async push(remote?: string, branch?: string, force?: boolean): Promise<GitOperationResult> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return { success: false, error: '沒有找到 Git 倉庫' };
        }

        try {
            await repo.api.push(remote, branch, force);

            return {
                success: true,
                message: '成功推送到遠程倉庫'
            };

        } catch (error) {
            return {
                success: false,
                error: `推送失敗: ${error}`
            };
        }
    }

    /**
     * 從遠程拉取
     */
    async pull(remote?: string, branch?: string): Promise<GitOperationResult> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return { success: false, error: '沒有找到 Git 倉庫' };
        }

        try {
            await repo.api.pull(remote, branch);

            return {
                success: true,
                message: '成功從遠程倉庫拉取'
            };

        } catch (error) {
            return {
                success: false,
                error: `拉取失敗: ${error}`
            };
        }
    }

    /**
     * 獲取提交歷史
     */
    async getCommitHistory(maxEntries: number = 50): Promise<GitCommit[]> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return [];
        }

        try {
            const log = await repo.api.log({ maxEntries });
            return log.map((commit: any) => this.mapCommit(commit));

        } catch (error) {
            console.error('獲取提交歷史失敗:', error);
            return [];
        }
    }

    /**
     * 獲取文件差異
     */
    async getFileDiff(uri: vscode.Uri, ref?: string): Promise<string | undefined> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return undefined;
        }

        try {
            const relativePath = path.relative(repo.rootUri.fsPath, uri.fsPath);
            return await repo.api.diffWithHEAD(relativePath);

        } catch (error) {
            console.error('獲取文件差異失敗:', error);
            return undefined;
        }
    }

    /**
     * 獲取分支列表
     */
    async getBranches(): Promise<GitBranch[]> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return [];
        }

        return repo.state.refs
            .filter(ref => ref.type === GitRefType.Head || ref.type === GitRefType.RemoteHead)
            .map(ref => this.mapBranch(ref));
    }

    /**
     * 獲取遠程列表
     */
    getRemotes(): GitRemote[] {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return [];
        }

        return repo.state.remotes;
    }

    /**
     * 獲取工作區變更
     */
    getWorkingTreeChanges(): GitChange[] {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return [];
        }

        return repo.state.workingTreeChanges;
    }

    /**
     * 獲取暫存區變更
     */
    getIndexChanges(): GitChange[] {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return [];
        }

        return repo.state.indexChanges;
    }

    /**
     * 檢查是否為 Git 倉庫
     */
    isGitRepository(): boolean {
        return this.repositories.size > 0;
    }

    /**
     * 刷新倉庫狀態
     */
    async refresh(): Promise<void> {
        const repo = this.getCurrentRepository();
        if (repo) {
            try {
                await repo.api.status();
            } catch (error) {
                console.error('刷新 Git 狀態失敗:', error);
            }
        }
    }

    /**
     * 映射輔助方法
     */
    private mapBranch(branch: any): GitBranch {
        return {
            name: branch.name || '',
            commit: branch.commit ? this.mapCommit(branch.commit) : undefined,
            upstream: branch.upstream ? this.mapBranch(branch.upstream) : undefined,
            ahead: branch.ahead || 0,
            behind: branch.behind || 0,
            type: branch.type || GitRefType.Head
        };
    }

    private mapRef(ref: any): GitRef {
        return {
            type: ref.type || GitRefType.Head,
            name: ref.name,
            commit: ref.commit ? this.mapCommit(ref.commit) : undefined,
            remote: ref.remote
        };
    }

    private mapRemote(remote: any): GitRemote {
        return {
            name: remote.name,
            fetchUrl: remote.fetchUrl,
            pushUrl: remote.pushUrl,
            isReadOnly: remote.isReadOnly || false
        };
    }

    private mapChange(change: any): GitChange {
        return {
            uri: change.uri,
            originalUri: change.originalUri,
            renameUri: change.renameUri,
            status: change.status
        };
    }

    private mapCommit(commit: any): GitCommit {
        return {
            hash: commit.hash,
            message: commit.message,
            parents: commit.parents || [],
            authorDate: commit.authorDate ? new Date(commit.authorDate) : undefined,
            authorName: commit.authorName,
            authorEmail: commit.authorEmail,
            commitDate: commit.commitDate ? new Date(commit.commitDate) : undefined
        };
    }

    /**
     * 清理資源
     */
    dispose(): void {
        this.onRepositoryChangedEmitter.dispose();
    }
}
