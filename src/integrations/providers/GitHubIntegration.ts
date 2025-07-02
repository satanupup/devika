import * as vscode from 'vscode';
import { IntegrationConfig, IntegrationResult, IntegrationType } from '../IntegrationEngine';
import { ErrorHandlingUtils } from '../../utils/ErrorHandlingUtils';

/**
 * GitHub 倉庫信息
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * GitHub Issue 信息
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

/**
 * GitHub Pull Request 信息
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
}

/**
 * GitHub 用戶信息
 */
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
}

/**
 * GitHub 標籤信息
 */
export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

/**
 * GitHub 里程碑信息
 */
export interface GitHubMilestone {
  id: number;
  title: string;
  description: string;
  state: 'open' | 'closed';
  due_on: string | null;
}

/**
 * GitHub 提交信息
 */
export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: GitHubUser;
  html_url: string;
}

/**
 * GitHub 整合實現
 */
export class GitHubIntegration {
  private config: IntegrationConfig;
  private baseUrl: string;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || 'https://api.github.com';
  }

  /**
   * 測試連接
   */
  async testConnection(): Promise<IntegrationResult<boolean>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', '/user');
        return { success: true, data: response.ok };
      },
      'GitHub 連接測試',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取用戶倉庫
   */
  async getRepositories(page: number = 1, perPage: number = 30): Promise<IntegrationResult<GitHubRepository[]>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/user/repos?page=${page}&per_page=${perPage}&sort=updated`);
        const repositories = await response.json();
        return { success: true, data: repositories };
      },
      '獲取 GitHub 倉庫',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取倉庫詳情
   */
  async getRepository(owner: string, repo: string): Promise<IntegrationResult<GitHubRepository>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/repos/${owner}/${repo}`);
        const repository = await response.json();
        return { success: true, data: repository };
      },
      '獲取 GitHub 倉庫詳情',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取倉庫 Issues
   */
  async getIssues(
    owner: string, 
    repo: string, 
    state: 'open' | 'closed' | 'all' = 'open',
    page: number = 1,
    perPage: number = 30
  ): Promise<IntegrationResult<GitHubIssue[]>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest(
          'GET', 
          `/repos/${owner}/${repo}/issues?state=${state}&page=${page}&per_page=${perPage}`
        );
        const issues = await response.json();
        return { success: true, data: issues };
      },
      '獲取 GitHub Issues',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 創建 Issue
   */
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    labels?: string[],
    assignees?: string[]
  ): Promise<IntegrationResult<GitHubIssue>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const issueData = {
          title,
          body: body || '',
          labels: labels || [],
          assignees: assignees || []
        };

        const response = await this.makeRequest('POST', `/repos/${owner}/${repo}/issues`, issueData);
        const issue = await response.json();
        return { success: true, data: issue };
      },
      '創建 GitHub Issue',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取 Pull Requests
   */
  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    page: number = 1,
    perPage: number = 30
  ): Promise<IntegrationResult<GitHubPullRequest[]>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest(
          'GET',
          `/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&per_page=${perPage}`
        );
        const pullRequests = await response.json();
        return { success: true, data: pullRequests };
      },
      '獲取 GitHub Pull Requests',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取提交歷史
   */
  async getCommits(
    owner: string,
    repo: string,
    branch?: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<IntegrationResult<GitHubCommit[]>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let url = `/repos/${owner}/${repo}/commits?page=${page}&per_page=${perPage}`;
        if (branch) {
          url += `&sha=${branch}`;
        }

        const response = await this.makeRequest('GET', url);
        const commits = await response.json();
        return { success: true, data: commits };
      },
      '獲取 GitHub 提交歷史',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 搜索倉庫
   */
  async searchRepositories(
    query: string,
    sort: 'stars' | 'forks' | 'updated' = 'updated',
    order: 'asc' | 'desc' = 'desc',
    page: number = 1,
    perPage: number = 30
  ): Promise<IntegrationResult<{ total_count: number; items: GitHubRepository[] }>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest(
          'GET',
          `/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=${order}&page=${page}&per_page=${perPage}`
        );
        const searchResult = await response.json();
        return { success: true, data: searchResult };
      },
      '搜索 GitHub 倉庫',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 搜索 Issues
   */
  async searchIssues(
    query: string,
    sort: 'created' | 'updated' | 'comments' = 'updated',
    order: 'asc' | 'desc' = 'desc',
    page: number = 1,
    perPage: number = 30
  ): Promise<IntegrationResult<{ total_count: number; items: GitHubIssue[] }>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest(
          'GET',
          `/search/issues?q=${encodeURIComponent(query)}&sort=${sort}&order=${order}&page=${page}&per_page=${perPage}`
        );
        const searchResult = await response.json();
        return { success: true, data: searchResult };
      },
      '搜索 GitHub Issues',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取倉庫標籤
   */
  async getLabels(owner: string, repo: string): Promise<IntegrationResult<GitHubLabel[]>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/repos/${owner}/${repo}/labels`);
        const labels = await response.json();
        return { success: true, data: labels };
      },
      '獲取 GitHub 標籤',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取倉庫里程碑
   */
  async getMilestones(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<IntegrationResult<GitHubMilestone[]>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/repos/${owner}/${repo}/milestones?state=${state}`);
        const milestones = await response.json();
        return { success: true, data: milestones };
      },
      '獲取 GitHub 里程碑',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取當前用戶信息
   */
  async getCurrentUser(): Promise<IntegrationResult<GitHubUser>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', '/user');
        const user = await response.json();
        return { success: true, data: user };
      },
      '獲取 GitHub 用戶信息',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 創建 Webhook
   */
  async createWebhook(
    owner: string,
    repo: string,
    url: string,
    events: string[] = ['push', 'pull_request', 'issues']
  ): Promise<IntegrationResult<any>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const webhookData = {
          name: 'web',
          active: true,
          events,
          config: {
            url,
            content_type: 'json'
          }
        };

        const response = await this.makeRequest('POST', `/repos/${owner}/${repo}/hooks`, webhookData);
        const webhook = await response.json();
        return { success: true, data: webhook };
      },
      '創建 GitHub Webhook',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 執行 HTTP 請求
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Devika-VSCode-Extension'
    };

    // 添加認證
    if (this.config.token) {
      headers['Authorization'] = `token ${this.config.token}`;
    } else if (this.config.username && this.config.apiKey) {
      const auth = Buffer.from(`${this.config.username}:${this.config.apiKey}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const options: RequestInit = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API 錯誤 ${response.status}: ${errorText}`);
    }

    return response;
  }

  /**
   * 解析倉庫信息從 Git URL
   */
  static parseRepositoryFromUrl(url: string): { owner: string; repo: string } | null {
    const patterns = [
      /github\.com[\/:]([^\/]+)\/([^\/\.]+)/,
      /github\.com\/([^\/]+)\/([^\/]+)\.git/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2]
        };
      }
    }

    return null;
  }

  /**
   * 獲取當前工作區的 GitHub 倉庫信息
   */
  static async getCurrentWorkspaceRepository(): Promise<{ owner: string; repo: string } | null> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
      }

      // 嘗試從 Git 配置獲取遠程 URL
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (gitExtension) {
        const git = gitExtension.exports.getAPI(1);
        const repository = git.repositories[0];
        
        if (repository) {
          const remotes = repository.state.remotes;
          const origin = remotes.find((remote: any) => remote.name === 'origin');
          
          if (origin && origin.fetchUrl) {
            return GitHubIntegration.parseRepositoryFromUrl(origin.fetchUrl);
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('獲取當前工作區 GitHub 倉庫信息失敗:', error);
      return null;
    }
  }
}
