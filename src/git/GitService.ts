import * as vscode from 'vscode';
import { simpleGit, SimpleGit, StatusResult, DiffResult } from 'simple-git';
import * as path from 'path';

export interface GitChange {
    file: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked';
    diff?: string;
}

export interface GitCommitInfo {
    hash: string;
    message: string;
    author: string;
    date: Date;
    files: string[];
}

export class GitService {
    private git: SimpleGit | null = null;
    private workspaceRoot: string | null = null;

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        this.git = simpleGit(this.workspaceRoot);

        try {
            await this.git.checkIsRepo();
        } catch (error) {
            console.log('目前工作區不是 Git 儲存庫');
            this.git = null;
        }
    }

    async isGitRepository(): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.checkIsRepo();
            return true;
        } catch {
            return false;
        }
    }

    async getStatus(): Promise<StatusResult | null> {
        if (!this.git) {
            return null;
        }

        try {
            return await this.git.status();
        } catch (error) {
            console.error('取得 Git 狀態失敗:', error);
            return null;
        }
    }

    async getStagedChanges(): Promise<string[]> {
        if (!this.git) {
            return [];
        }

        try {
            const status = await this.git.status();
            const stagedFiles = [
                ...status.staged,
                ...status.created,
                ...status.modified.filter(file => status.staged.includes(file))
            ];

            const changes: string[] = [];

            for (const file of stagedFiles) {
                try {
                    const diff = await this.git.diff(['--cached', file]);
                    changes.push(`檔案: ${file}\n${diff}`);
                } catch (error) {
                    console.error(`取得 ${file} 的 diff 失敗:`, error);
                }
            }

            return changes;
        } catch (error) {
            console.error('取得暫存變更失敗:', error);
            return [];
        }
    }

    async getUnstagedChanges(): Promise<GitChange[]> {
        if (!this.git) {
            return [];
        }

        try {
            const status = await this.git.status();
            const changes: GitChange[] = [];

            // 處理修改的檔案
            for (const file of status.modified) {
                if (!status.staged.includes(file)) {
                    const diff = await this.git.diff([file]);
                    changes.push({
                        file,
                        status: 'modified',
                        diff
                    });
                }
            }

            // 處理新增的檔案
            for (const file of status.not_added) {
                changes.push({
                    file,
                    status: 'untracked'
                });
            }

            // 處理刪除的檔案
            for (const file of status.deleted) {
                if (!status.staged.includes(file)) {
                    changes.push({
                        file,
                        status: 'deleted'
                    });
                }
            }

            return changes;
        } catch (error) {
            console.error('取得未暫存變更失敗:', error);
            return [];
        }
    }

    async stageFile(filePath: string): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.add(filePath);
            return true;
        } catch (error) {
            console.error(`暫存檔案 ${filePath} 失敗:`, error);
            return false;
        }
    }

    async stageAllChanges(): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.add('.');
            return true;
        } catch (error) {
            console.error('暫存所有變更失敗:', error);
            return false;
        }
    }

    async unstageFile(filePath: string): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.reset(['HEAD', filePath]);
            return true;
        } catch (error) {
            console.error(`取消暫存檔案 ${filePath} 失敗:`, error);
            return false;
        }
    }

    async commit(message: string): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.commit(message);
            return true;
        } catch (error) {
            console.error('提交失敗:', error);
            return false;
        }
    }

    async commitWithFiles(message: string, files: string[]): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            // 先暫存指定的檔案
            for (const file of files) {
                await this.git.add(file);
            }

            // 然後提交
            await this.git.commit(message);
            return true;
        } catch (error) {
            console.error('提交指定檔案失敗:', error);
            return false;
        }
    }

    async getCommitHistory(limit: number = 10): Promise<GitCommitInfo[]> {
        if (!this.git) {
            return [];
        }

        try {
            const log = await this.git.log({ maxCount: limit });
            return log.all.map(commit => ({
                hash: commit.hash,
                message: commit.message,
                author: `${commit.author_name} <${commit.author_email}>`,
                date: new Date(commit.date),
                files: commit.diff?.files?.map(f => f.file) || []
            }));
        } catch (error) {
            console.error('取得提交歷史失敗:', error);
            return [];
        }
    }

    async getDiffBetweenCommits(fromCommit: string, toCommit: string): Promise<string> {
        if (!this.git) {
            return '';
        }

        try {
            return await this.git.diff([`${fromCommit}..${toCommit}`]);
        } catch (error) {
            console.error('取得提交間差異失敗:', error);
            return '';
        }
    }

    async getCurrentBranch(): Promise<string | null> {
        if (!this.git) {
            return null;
        }

        try {
            const status = await this.git.status();
            return status.current || null;
        } catch (error) {
            console.error('取得目前分支失敗:', error);
            return null;
        }
    }

    async getBranches(): Promise<string[]> {
        if (!this.git) {
            return [];
        }

        try {
            const branches = await this.git.branchLocal();
            return branches.all;
        } catch (error) {
            console.error('取得分支列表失敗:', error);
            return [];
        }
    }

    async createBranch(branchName: string): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.checkoutLocalBranch(branchName);
            return true;
        } catch (error) {
            console.error(`建立分支 ${branchName} 失敗:`, error);
            return false;
        }
    }

    async switchBranch(branchName: string): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.checkout(branchName);
            return true;
        } catch (error) {
            console.error(`切換到分支 ${branchName} 失敗:`, error);
            return false;
        }
    }

    async getFileHistory(filePath: string, limit: number = 10): Promise<GitCommitInfo[]> {
        if (!this.git) {
            return [];
        }

        try {
            const log = await this.git.log({ file: filePath, maxCount: limit });
            return log.all.map(commit => ({
                hash: commit.hash,
                message: commit.message,
                author: `${commit.author_name} <${commit.author_email}>`,
                date: new Date(commit.date),
                files: [filePath]
            }));
        } catch (error) {
            console.error(`取得檔案 ${filePath} 歷史失敗:`, error);
            return [];
        }
    }

    async getFileDiff(filePath: string, commitHash?: string): Promise<string> {
        if (!this.git) {
            return '';
        }

        try {
            if (commitHash) {
                return await this.git.diff([commitHash, filePath]);
            } else {
                return await this.git.diff([filePath]);
            }
        } catch (error) {
            console.error(`取得檔案 ${filePath} 差異失敗:`, error);
            return '';
        }
    }

    async hasUncommittedChanges(): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            const status = await this.git.status();
            return status.files.length > 0;
        } catch (error) {
            console.error('檢查未提交變更失敗:', error);
            return false;
        }
    }

    async generateCommitMessage(changes: string[]): Promise<string> {
        // 基於變更內容生成簡單的提交訊息
        if (changes.length === 0) {
            return 'Empty commit';
        }

        const fileCount = changes.length;
        if (fileCount === 1) {
            const fileName = path.basename(changes[0]);
            return `Update ${fileName}`;
        } else {
            return `Update ${fileCount} files`;
        }
    }

    async validateCommitMessage(message: string): Promise<{ isValid: boolean; errors: string[] }> {
        const errors: string[] = [];

        if (!message.trim()) {
            errors.push('提交訊息不能為空');
        }

        if (message.length > 72) {
            errors.push('提交訊息第一行不應超過 72 個字元');
        }

        if (message.startsWith(' ') || message.endsWith(' ')) {
            errors.push('提交訊息不應以空格開始或結束');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    getWorkspaceRoot(): string | null {
        return this.workspaceRoot;
    }
}
