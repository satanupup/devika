import * as vscode from 'vscode';
import { IntegrationConfig, IntegrationResult } from '../IntegrationEngine';
import { ErrorHandlingUtils } from '../../utils/ErrorHandlingUtils';

/**
 * Jira 項目信息
 */
export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description: string;
  projectTypeKey: string;
  lead: JiraUser;
  avatarUrls: Record<string, string>;
  projectCategory?: {
    id: string;
    name: string;
    description: string;
  };
}

/**
 * Jira Issue 信息
 */
export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: string;
    issuetype: JiraIssueType;
    status: JiraStatus;
    priority: JiraPriority;
    assignee: JiraUser | null;
    reporter: JiraUser;
    project: JiraProject;
    created: string;
    updated: string;
    resolutiondate: string | null;
    labels: string[];
    components: JiraComponent[];
    fixVersions: JiraVersion[];
    affectedVersions: JiraVersion[];
    parent?: {
      id: string;
      key: string;
      fields: {
        summary: string;
        status: JiraStatus;
        priority: JiraPriority;
        issuetype: JiraIssueType;
      };
    };
  };
}

/**
 * Jira 用戶信息
 */
export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: Record<string, string>;
  active: boolean;
}

/**
 * Jira Issue 類型
 */
export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
}

/**
 * Jira 狀態
 */
export interface JiraStatus {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  statusCategory: {
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

/**
 * Jira 優先級
 */
export interface JiraPriority {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
}

/**
 * Jira 組件
 */
export interface JiraComponent {
  id: string;
  name: string;
  description: string;
  lead?: JiraUser;
}

/**
 * Jira 版本
 */
export interface JiraVersion {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  released: boolean;
  releaseDate?: string;
}

/**
 * Jira Sprint 信息
 */
export interface JiraSprint {
  id: number;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
}

/**
 * Jira 看板信息
 */
export interface JiraBoard {
  id: number;
  name: string;
  type: string;
  location: {
    projectId: number;
    projectName: string;
    projectKey: string;
  };
}

/**
 * Jira 整合實現
 */
export class JiraIntegration {
  private config: IntegrationConfig;
  private baseUrl: string;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || `https://${config.organization}.atlassian.net`;
  }

  /**
   * 測試連接
   */
  async testConnection(): Promise<IntegrationResult<boolean>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', '/rest/api/3/myself');
        return response.ok;
      },
      'Jira 連接測試',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || 'Jira 連接測試失敗' };
    }
  }

  /**
   * 獲取項目列表
   */
  async getProjects(): Promise<IntegrationResult<JiraProject[]>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', '/rest/api/3/project');
        return await response.json();
      },
      '獲取 Jira 項目',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取 Jira 項目失敗' };
    }
  }

  /**
   * 獲取項目詳情
   */
  async getProject(projectKey: string): Promise<IntegrationResult<JiraProject>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/rest/api/3/project/${projectKey}`);
        return await response.json();
      },
      '獲取 Jira 項目詳情',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取 Jira 項目詳情失敗' };
    }
  }

  /**
   * 搜索 Issues
   */
  async searchIssues(
    jql: string,
    startAt: number = 0,
    maxResults: number = 50,
    fields?: string[]
  ): Promise<IntegrationResult<{ issues: JiraIssue[]; total: number; startAt: number; maxResults: number }>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const searchData = {
          jql,
          startAt,
          maxResults,
          fields: fields || ['*all']
        };

        const response = await this.makeRequest('POST', '/rest/api/3/search', searchData);
        return await response.json();
      },
      '搜索 Jira Issues',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '搜索 Jira Issues 失敗' };
    }
  }

  /**
   * 獲取 Issue 詳情
   */
  async getIssue(issueKey: string): Promise<IntegrationResult<JiraIssue>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/rest/api/3/issue/${issueKey}`);
        return await response.json();
      },
      '獲取 Jira Issue 詳情',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取 Jira Issue 詳情失敗' };
    }
  }

  /**
   * 創建 Issue
   */
  async createIssue(issueData: {
    projectKey: string;
    summary: string;
    description?: string;
    issueType: string;
    priority?: string;
    assignee?: string;
    labels?: string[];
    components?: string[];
  }): Promise<IntegrationResult<JiraIssue>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const createData = {
          fields: {
            project: { key: issueData.projectKey },
            summary: issueData.summary,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: issueData.description || ''
                    }
                  ]
                }
              ]
            },
            issuetype: { name: issueData.issueType },
            ...(issueData.priority && { priority: { name: issueData.priority } }),
            ...(issueData.assignee && { assignee: { accountId: issueData.assignee } }),
            ...(issueData.labels && { labels: issueData.labels }),
            ...(issueData.components && { components: issueData.components.map(name => ({ name })) })
          }
        };

        const response = await this.makeRequest('POST', '/rest/api/3/issue', createData);
        return await response.json();
      },
      '創建 Jira Issue',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '創建 Jira Issue 失敗' };
    }
  }

  /**
   * 更新 Issue
   */
  async updateIssue(
    issueKey: string,
    updateData: {
      summary?: string;
      description?: string;
      assignee?: string;
      priority?: string;
      labels?: string[];
    }
  ): Promise<IntegrationResult<boolean>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const fields: any = {};

        if (updateData.summary) {
          fields.summary = updateData.summary;
        }

        if (updateData.description) {
          fields.description = {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: updateData.description
                  }
                ]
              }
            ]
          };
        }

        if (updateData.assignee) {
          fields.assignee = { accountId: updateData.assignee };
        }

        if (updateData.priority) {
          fields.priority = { name: updateData.priority };
        }

        if (updateData.labels) {
          fields.labels = updateData.labels;
        }

        const response = await this.makeRequest('PUT', `/rest/api/3/issue/${issueKey}`, { fields });
        return response.ok;
      },
      '更新 Jira Issue',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '更新 Jira Issue 失敗' };
    }
  }

  /**
   * 轉換 Issue 狀態
   */
  async transitionIssue(issueKey: string, transitionId: string): Promise<IntegrationResult<boolean>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const transitionData = {
          transition: { id: transitionId }
        };

        const response = await this.makeRequest('POST', `/rest/api/3/issue/${issueKey}/transitions`, transitionData);
        return response.ok;
      },
      '轉換 Jira Issue 狀態',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '轉換 Jira Issue 狀態失敗' };
    }
  }

  /**
   * 獲取 Issue 可用轉換
   */
  async getIssueTransitions(issueKey: string): Promise<IntegrationResult<any[]>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/rest/api/3/issue/${issueKey}/transitions`);
        const result = await response.json();
        return result.transitions;
      },
      '獲取 Jira Issue 轉換',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取 Jira Issue 轉換失敗' };
    }
  }

  /**
   * 獲取看板列表
   */
  async getBoards(projectKeyOrId?: string): Promise<IntegrationResult<JiraBoard[]>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let url = '/rest/agile/1.0/board';
        if (projectKeyOrId) {
          url += `?projectKeyOrId=${projectKeyOrId}`;
        }

        const response = await this.makeRequest('GET', url);
        const result = await response.json();
        return result.values;
      },
      '獲取 Jira 看板',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取 Jira 看板失敗' };
    }
  }

  /**
   * 獲取 Sprint 列表
   */
  async getSprints(boardId: number, state?: 'future' | 'active' | 'closed'): Promise<IntegrationResult<JiraSprint[]>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let url = `/rest/agile/1.0/board/${boardId}/sprint`;
        if (state) {
          url += `?state=${state}`;
        }

        const response = await this.makeRequest('GET', url);
        const result = await response.json();
        return result.values;
      },
      '獲取 Jira Sprints',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取 Jira Sprints 失敗' };
    }
  }

  /**
   * 獲取 Sprint Issues
   */
  async getSprintIssues(sprintId: number): Promise<IntegrationResult<JiraIssue[]>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/rest/agile/1.0/sprint/${sprintId}/issue`);
        const result = await response.json();
        return result.issues;
      },
      '獲取 Sprint Issues',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取 Sprint Issues 失敗' };
    }
  }

  /**
   * 獲取當前用戶信息
   */
  async getCurrentUser(): Promise<IntegrationResult<JiraUser>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', '/rest/api/3/myself');
        return await response.json();
      },
      '獲取 Jira 用戶信息',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取 Jira 用戶信息失敗' };
    }
  }

  /**
   * 獲取項目的 Issue 類型
   */
  async getProjectIssueTypes(projectKey: string): Promise<IntegrationResult<JiraIssueType[]>> {
    const opResult = await ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/rest/api/3/project/${projectKey}/statuses`);
        const statuses = await response.json();

        // 提取 Issue 類型
        const issueTypes: JiraIssueType[] = [];
        statuses.forEach((status: any) => {
          if (!issueTypes.find(type => type.id === status.id)) {
            issueTypes.push(status);
          }
        });

        return issueTypes;
      },
      '獲取項目 Issue 類型',
      { logError: true, showToUser: false }
    );

    if (opResult.success) {
      return { success: true, data: opResult.data };
    } else {
      return { success: false, error: opResult.error?.message || '獲取項目 Issue 類型失敗' };
    }
  }

  /**
   * 執行 HTTP 請求
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };

    // 添加認證
    if (this.config.username && this.config.apiKey) {
      const auth = Buffer.from(`${this.config.username}:${this.config.apiKey}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    } else if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    const options: RequestInit = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API 錯誤 ${response.status}: ${errorText}`);
    }

    return response;
  }

  /**
   * 構建常用的 JQL 查詢
   */
  static buildJQL(filters: {
    project?: string;
    assignee?: string;
    status?: string;
    issueType?: string;
    priority?: string;
    labels?: string[];
    sprint?: string;
    fixVersion?: string;
    created?: string;
    updated?: string;
  }): string {
    const conditions: string[] = [];

    if (filters.project) {
      conditions.push(`project = "${filters.project}"`);
    }

    if (filters.assignee) {
      if (filters.assignee === 'currentUser()') {
        conditions.push('assignee = currentUser()');
      } else {
        conditions.push(`assignee = "${filters.assignee}"`);
      }
    }

    if (filters.status) {
      conditions.push(`status = "${filters.status}"`);
    }

    if (filters.issueType) {
      conditions.push(`issuetype = "${filters.issueType}"`);
    }

    if (filters.priority) {
      conditions.push(`priority = "${filters.priority}"`);
    }

    if (filters.labels && filters.labels.length > 0) {
      const labelConditions = filters.labels.map(label => `labels = "${label}"`);
      conditions.push(`(${labelConditions.join(' OR ')})`);
    }

    if (filters.sprint) {
      conditions.push(`sprint = "${filters.sprint}"`);
    }

    if (filters.fixVersion) {
      conditions.push(`fixVersion = "${filters.fixVersion}"`);
    }

    if (filters.created) {
      conditions.push(`created >= "${filters.created}"`);
    }

    if (filters.updated) {
      conditions.push(`updated >= "${filters.updated}"`);
    }

    return conditions.join(' AND ');
  }
}
