import * as vscode from 'vscode';
import * as path from 'path';

export interface GitFileStatus {
    uri: vscode.Uri;
    status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored';
    staged: boolean;
    relativePath: string;
}

export interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: Date;
    parents: string[];
    files: string[];
}

export interface GitBranch {
    name: string;
    current: boolean;
    remote?: string;
    ahead?: number;
    behind?: number;
}

export interface GitDiff {
    uri: vscode.Uri;
    hunks: GitDiffHunk[];
    additions: number;
    deletions: number;
}

export interface GitDiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: GitDiffLine[];
}

export interface GitDiffLine {
    type: 'context' | 'addition' | 'deletion';
    text: string;
    oldLineNumber?: number;
    newLineNumber?: number;
}

export class GitIntegration {
    private gitExtension: vscode.Extension<any> | undefined;
    private git: any;

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
            } else {
                console.warn('Git 擴展未找到');
            }
        } catch (error) {
            console.error('初始化 Git 擴展失敗:', error);
        }
    }

    /**
     * 獲取當前倉庫
     */
    private getCurrentRepository(): any {
        if (!this.git || !this.git.repositories || this.git.repositories.length === 0) {
            return null;
        }

        // 獲取當前工作區的倉庫
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return this.git.repositories[0];
        }

        const repo = this.git.repositories.find((r: any) =>
            workspaceFolder.uri.fsPath.startsWith(r.rootUri.fsPath)
        );

        return repo || this.git.repositories[0];
    }

    /**
     * 獲取文件狀態
     */
    async getFileStatus(uri?: vscode.Uri): Promise<GitFileStatus[]> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return [];
        }

        try {
            const statuses: GitFileStatus[] = [];

            // 獲取工作區變更
            for (const change of repo.state.workingTreeChanges) {
                statuses.push({
                    uri: change.uri,
                    status: this.mapGitStatus(change.status),
                    staged: false,
                    relativePath: vscode.workspace.asRelativePath(change.uri)
                });
            }

            // 獲取暫存區變更
            for (const change of repo.state.indexChanges) {
                const existing = statuses.find(s => s.uri.toString() === change.uri.toString());
                if (existing) {
                    existing.staged = true;
                } else {
                    statuses.push({
                        uri: change.uri,
                        status: this.mapGitStatus(change.status),
                        staged: true,
                        relativePath: vscode.workspace.asRelativePath(change.uri)
                    });
                }
            }

            // 如果指定了特定文件，過濾結果
            if (uri) {
                return statuses.filter(s => s.uri.toString() === uri.toString());
            }

            return statuses;

        } catch (error) {
            console.error('獲取文件狀態失敗:', error);
            return [];
        }
    }

    /**
     * 獲取文件歷史
     */
    async getFileHistory(uri: vscode.Uri, maxCount: number = 50): Promise<GitCommit[]> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return [];
        }

        try {
            const relativePath = path.relative(repo.rootUri.fsPath, uri.fsPath);

            // 使用 Git 命令獲取文件歷史
            const log = await repo.log({
                maxEntries: maxCount,
                path: relativePath
            });

            return log.map((commit: any) => ({
                hash: commit.hash,
                message: commit.message,
                author: `${commit.authorName} <${commit.authorEmail}>`,
                date: new Date(commit.authorDate),
                parents: commit.parents,
                files: [relativePath]
            }));

        } catch (error) {
            console.error('獲取文件歷史失敗:', error);
            return [];
        }
    }

    /**
     * 獲取文件差異
     */
    async getFileDiff(uri: vscode.Uri, ref1?: string, ref2?: string): Promise<GitDiff | null> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return null;
        }

        try {
            const relativePath = path.relative(repo.rootUri.fsPath, uri.fsPath);

            // 獲取差異
            const diff = await repo.diffWithHEAD(relativePath);

            if (!diff) {
                return null;
            }

            return this.parseDiff(uri, diff);

        } catch (error) {
            console.error('獲取文件差異失敗:', error);
            return null;
        }
    }

    /**
     * 暫存文件
     */
    async stageFile(uri: vscode.Uri): Promise<boolean> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return false;
        }

        try {
            await repo.add([uri]);
            return true;
        } catch (error) {
            console.error('暫存文件失敗:', error);
            return false;
        }
    }

    /**
     * 取消暫存文件
     */
    async unstageFile(uri: vscode.Uri): Promise<boolean> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return false;
        }

        try {
            await repo.revert([uri]);
            return true;
        } catch (error) {
            console.error('取消暫存文件失敗:', error);
            return false;
        }
    }

    /**
     * 提交變更
     */
    async commit(message: string, files?: vscode.Uri[]): Promise<boolean> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return false;
        }

        try {
            if (files && files.length > 0) {
                // 暫存指定文件
                await repo.add(files);
            }

            await repo.commit(message);
            return true;
        } catch (error) {
            console.error('提交失敗:', error);
            return false;
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

        try {
            const branches: GitBranch[] = [];

            // 本地分支
            for (const branch of repo.state.refs) {
                if (branch.type === 1) { // HEAD
                    branches.push({
                        name: branch.name || 'HEAD',
                        current: true
                    });
                } else if (branch.type === 2) { // Local branch
                    branches.push({
                        name: branch.name || '',
                        current: false
                    });
                }
            }

            return branches;

        } catch (error) {
            console.error('獲取分支列表失敗:', error);
            return [];
        }
    }

    /**
     * 切換分支
     */
    async checkoutBranch(branchName: string): Promise<boolean> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return false;
        }

        try {
            await repo.checkout(branchName);
            return true;
        } catch (error) {
            console.error('切換分支失敗:', error);
            return false;
        }
    }

    /**
     * 創建分支
     */
    async createBranch(branchName: string, checkout: boolean = true): Promise<boolean> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return false;
        }

        try {
            await repo.createBranch(branchName, checkout);
            return true;
        } catch (error) {
            console.error('創建分支失敗:', error);
            return false;
        }
    }

    /**
     * 獲取倉庫狀態
     */
    async getRepositoryStatus(): Promise<{
        branch: string;
        ahead: number;
        behind: number;
        workingTreeChanges: number;
        indexChanges: number;
        mergeChanges: number;
    } | null> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return null;
        }

        try {
            const state = repo.state;

            return {
                branch: state.HEAD?.name || 'detached',
                ahead: state.HEAD?.ahead || 0,
                behind: state.HEAD?.behind || 0,
                workingTreeChanges: state.workingTreeChanges.length,
                indexChanges: state.indexChanges.length,
                mergeChanges: state.mergeChanges.length
            };

        } catch (error) {
            console.error('獲取倉庫狀態失敗:', error);
            return null;
        }
    }

    /**
     * 顯示文件在特定提交的內容
     */
    async showFileAtCommit(uri: vscode.Uri, commitHash: string): Promise<string | null> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return null;
        }

        try {
            const relativePath = path.relative(repo.rootUri.fsPath, uri.fsPath);
            const content = await repo.show(commitHash, relativePath);
            return content;

        } catch (error) {
            console.error('獲取文件歷史內容失敗:', error);
            return null;
        }
    }

    /**
     * 恢復文件到特定版本
     */
    async revertFileToCommit(uri: vscode.Uri, commitHash: string): Promise<boolean> {
        const repo = this.getCurrentRepository();
        if (!repo) {
            return false;
        }

        try {
            const relativePath = path.relative(repo.rootUri.fsPath, uri.fsPath);
            await repo.checkout(commitHash, [relativePath]);
            return true;

        } catch (error) {
            console.error('恢復文件失敗:', error);
            return false;
        }
    }

    /**
     * 映射 Git 狀態
     */
    private mapGitStatus(status: number): GitFileStatus['status'] {
        // VS Code Git 擴展的狀態映射
        switch (status) {
            case 0: return 'untracked';
            case 1: return 'added';
            case 2: return 'modified';
            case 3: return 'deleted';
            case 4: return 'renamed';
            case 5: return 'copied';
            case 6: return 'ignored';
            default: return 'modified';
        }
    }

    /**
     * 解析差異
     */
    private parseDiff(uri: vscode.Uri, diffText: string): GitDiff {
        const lines = diffText.split('\n');
        const hunks: GitDiffHunk[] = [];
        let currentHunk: GitDiffHunk | null = null;
        let additions = 0;
        let deletions = 0;

        for (const line of lines) {
            if (line.startsWith('@@')) {
                // 新的 hunk
                const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
                if (match) {
                    if (currentHunk) {
                        hunks.push(currentHunk);
                    }

                    currentHunk = {
                        oldStart: parseInt(match[1]),
                        oldLines: parseInt(match[2]) || 1,
                        newStart: parseInt(match[3]),
                        newLines: parseInt(match[4]) || 1,
                        lines: []
                    };
                }
            } else if (currentHunk) {
                let type: GitDiffLine['type'] = 'context';
                let text = line;

                if (line.startsWith('+')) {
                    type = 'addition';
                    text = line.substring(1);
                    additions++;
                } else if (line.startsWith('-')) {
                    type = 'deletion';
                    text = line.substring(1);
                    deletions++;
                } else if (line.startsWith(' ')) {
                    text = line.substring(1);
                }

                currentHunk.lines.push({
                    type,
                    text
                });
            }
        }

        if (currentHunk) {
            hunks.push(currentHunk);
        }

        return {
            uri,
            hunks,
            additions,
            deletions
        };
    }

    /**
     * 檢查是否為 Git 倉庫
     */
    isGitRepository(): boolean {
        return this.getCurrentRepository() !== null;
    }

    /**
     * 獲取倉庫根目錄
     */
    getRepositoryRoot(): vscode.Uri | null {
        const repo = this.getCurrentRepository();
        return repo ? repo.rootUri : null;
    }

    /**
     * 刷新 Git 狀態
     */
    async refresh(): Promise<void> {
        const repo = this.getCurrentRepository();
        if (repo) {
            try {
                await repo.status();
            } catch (error) {
                console.error('刷新 Git 狀態失敗:', error);
            }
        }
    }
}
