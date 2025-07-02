import * as vscode from 'vscode';
import { IntegrationConfig, IntegrationResult } from '../IntegrationEngine';
import { ErrorHandlingUtils } from '../../utils/ErrorHandlingUtils';

/**
 * Confluence 空間信息
 */
export interface ConfluenceSpace {
  id: number;
  key: string;
  name: string;
  description: {
    plain: {
      value: string;
    };
  };
  homepage: {
    id: string;
    title: string;
  };
  type: 'global' | 'personal';
  status: 'current' | 'archived';
  _links: {
    webui: string;
    self: string;
  };
}

/**
 * Confluence 頁面信息
 */
export interface ConfluencePage {
  id: string;
  type: 'page' | 'blogpost';
  status: 'current' | 'trashed' | 'historical' | 'draft';
  title: string;
  space: {
    id: number;
    key: string;
    name: string;
  };
  history: {
    latest: boolean;
    createdBy: ConfluenceUser;
    createdDate: string;
    lastUpdated: {
      by: ConfluenceUser;
      when: string;
    };
  };
  version: {
    number: number;
    message?: string;
    minorEdit: boolean;
  };
  ancestors?: ConfluencePage[];
  children?: {
    page?: {
      results: ConfluencePage[];
    };
  };
  body?: {
    storage?: {
      value: string;
      representation: 'storage';
    };
    view?: {
      value: string;
      representation: 'view';
    };
  };
  _links: {
    webui: string;
    self: string;
    tinyui: string;
  };
}

/**
 * Confluence 用戶信息
 */
export interface ConfluenceUser {
  type: 'known' | 'unknown' | 'anonymous';
  accountId: string;
  displayName: string;
  profilePicture: {
    path: string;
    width: number;
    height: number;
    isDefault: boolean;
  };
  _links: {
    self: string;
  };
}

/**
 * Confluence 內容信息
 */
export interface ConfluenceContent {
  id: string;
  type: 'page' | 'blogpost' | 'comment' | 'attachment';
  status: string;
  title: string;
  space: ConfluenceSpace;
  history: any;
  version: any;
  ancestors: ConfluenceContent[];
  operations: any[];
  children: any;
  descendants: any;
  container: any;
  body: any;
  restrictions: any;
  _links: {
    webui: string;
    edit: string;
    tinyui: string;
    self: string;
  };
}

/**
 * Confluence 搜索結果
 */
export interface ConfluenceSearchResult {
  content: ConfluenceContent;
  title: string;
  excerpt: string;
  url: string;
  resultGlobalContainer: {
    title: string;
    displayUrl: string;
  };
  breadcrumbs: Array<{
    label: string;
    url: string;
    separator: string;
  }>;
  entityType: string;
  iconCssClass: string;
  lastModified: string;
  friendlyLastModified: string;
}

/**
 * Confluence 整合實現
 */
export class ConfluenceIntegration {
  private config: IntegrationConfig;
  private baseUrl: string;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl || `https://${config.organization}.atlassian.net/wiki`;
  }

  /**
   * 測試連接
   */
  async testConnection(): Promise<IntegrationResult<boolean>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', '/rest/api/user/current');
        return { success: true, data: response.ok };
      },
      'Confluence 連接測試',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取空間列表
   */
  async getSpaces(
    type?: 'global' | 'personal',
    status?: 'current' | 'archived',
    limit: number = 25,
    start: number = 0
  ): Promise<IntegrationResult<{ results: ConfluenceSpace[]; size: number; start: number; limit: number }>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let url = `/rest/api/space?limit=${limit}&start=${start}`;
        
        if (type) {
          url += `&type=${type}`;
        }
        
        if (status) {
          url += `&status=${status}`;
        }

        const response = await this.makeRequest('GET', url);
        const spaces = await response.json();
        return { success: true, data: spaces };
      },
      '獲取 Confluence 空間',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取空間詳情
   */
  async getSpace(spaceKey: string): Promise<IntegrationResult<ConfluenceSpace>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', `/rest/api/space/${spaceKey}`);
        const space = await response.json();
        return { success: true, data: space };
      },
      '獲取 Confluence 空間詳情',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取空間內容
   */
  async getSpaceContent(
    spaceKey: string,
    type: 'page' | 'blogpost' = 'page',
    limit: number = 25,
    start: number = 0
  ): Promise<IntegrationResult<{ results: ConfluencePage[]; size: number; start: number; limit: number }>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const url = `/rest/api/space/${spaceKey}/content/${type}?limit=${limit}&start=${start}&expand=history,space,version`;
        const response = await this.makeRequest('GET', url);
        const content = await response.json();
        return { success: true, data: content };
      },
      '獲取 Confluence 空間內容',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取頁面詳情
   */
  async getPage(
    pageId: string,
    expand?: string[]
  ): Promise<IntegrationResult<ConfluencePage>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let url = `/rest/api/content/${pageId}`;
        
        if (expand && expand.length > 0) {
          url += `?expand=${expand.join(',')}`;
        }

        const response = await this.makeRequest('GET', url);
        const page = await response.json();
        return { success: true, data: page };
      },
      '獲取 Confluence 頁面詳情',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 創建頁面
   */
  async createPage(pageData: {
    spaceKey: string;
    title: string;
    content: string;
    parentId?: string;
    type?: 'page' | 'blogpost';
  }): Promise<IntegrationResult<ConfluencePage>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const createData = {
          type: pageData.type || 'page',
          title: pageData.title,
          space: {
            key: pageData.spaceKey
          },
          body: {
            storage: {
              value: pageData.content,
              representation: 'storage'
            }
          },
          ...(pageData.parentId && {
            ancestors: [{ id: pageData.parentId }]
          })
        };

        const response = await this.makeRequest('POST', '/rest/api/content', createData);
        const page = await response.json();
        return { success: true, data: page };
      },
      '創建 Confluence 頁面',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 更新頁面
   */
  async updatePage(
    pageId: string,
    updateData: {
      title?: string;
      content?: string;
      version: number;
      minorEdit?: boolean;
    }
  ): Promise<IntegrationResult<ConfluencePage>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 先獲取當前頁面信息
        const currentPageResult = await this.getPage(pageId, ['space', 'version']);
        if (!currentPageResult.success || !currentPageResult.data) {
          throw new Error('無法獲取當前頁面信息');
        }

        const currentPage = currentPageResult.data;
        
        const updatePayload = {
          id: pageId,
          type: currentPage.type,
          title: updateData.title || currentPage.title,
          space: currentPage.space,
          version: {
            number: updateData.version,
            minorEdit: updateData.minorEdit || false
          },
          ...(updateData.content && {
            body: {
              storage: {
                value: updateData.content,
                representation: 'storage'
              }
            }
          })
        };

        const response = await this.makeRequest('PUT', `/rest/api/content/${pageId}`, updatePayload);
        const page = await response.json();
        return { success: true, data: page };
      },
      '更新 Confluence 頁面',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 刪除頁面
   */
  async deletePage(pageId: string): Promise<IntegrationResult<boolean>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('DELETE', `/rest/api/content/${pageId}`);
        return { success: true, data: response.ok };
      },
      '刪除 Confluence 頁面',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 搜索內容
   */
  async searchContent(
    query: string,
    type?: 'page' | 'blogpost',
    spaceKey?: string,
    limit: number = 25,
    start: number = 0
  ): Promise<IntegrationResult<{ results: ConfluenceSearchResult[]; totalSize: number; start: number; limit: number }>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let cql = `text ~ "${query}"`;
        
        if (type) {
          cql += ` AND type = ${type}`;
        }
        
        if (spaceKey) {
          cql += ` AND space = ${spaceKey}`;
        }

        const url = `/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}&start=${start}`;
        const response = await this.makeRequest('GET', url);
        const searchResult = await response.json();
        return { success: true, data: searchResult };
      },
      '搜索 Confluence 內容',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取頁面子頁面
   */
  async getChildPages(
    pageId: string,
    limit: number = 25,
    start: number = 0
  ): Promise<IntegrationResult<{ results: ConfluencePage[]; size: number; start: number; limit: number }>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const url = `/rest/api/content/${pageId}/child/page?limit=${limit}&start=${start}&expand=history,space,version`;
        const response = await this.makeRequest('GET', url);
        const children = await response.json();
        return { success: true, data: children };
      },
      '獲取 Confluence 子頁面',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取頁面附件
   */
  async getPageAttachments(
    pageId: string,
    limit: number = 25,
    start: number = 0
  ): Promise<IntegrationResult<any>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const url = `/rest/api/content/${pageId}/child/attachment?limit=${limit}&start=${start}`;
        const response = await this.makeRequest('GET', url);
        const attachments = await response.json();
        return { success: true, data: attachments };
      },
      '獲取 Confluence 頁面附件',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取當前用戶信息
   */
  async getCurrentUser(): Promise<IntegrationResult<ConfluenceUser>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeRequest('GET', '/rest/api/user/current');
        const user = await response.json();
        return { success: true, data: user };
      },
      '獲取 Confluence 用戶信息',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 獲取頁面歷史版本
   */
  async getPageHistory(
    pageId: string,
    limit: number = 25,
    start: number = 0
  ): Promise<IntegrationResult<any>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const url = `/rest/api/content/${pageId}/history?limit=${limit}&start=${start}`;
        const response = await this.makeRequest('GET', url);
        const history = await response.json();
        return { success: true, data: history };
      },
      '獲取 Confluence 頁面歷史',
      { logError: true, showToUser: false }
    );
  }

  /**
   * 執行 HTTP 請求
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
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
      throw new Error(`Confluence API 錯誤 ${response.status}: ${errorText}`);
    }

    return response;
  }

  /**
   * 將 Markdown 轉換為 Confluence Storage 格式
   */
  static markdownToStorage(markdown: string): string {
    // 簡化的 Markdown 到 Confluence Storage 格式轉換
    let storage = markdown;

    // 標題
    storage = storage.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    storage = storage.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    storage = storage.replace(/^### (.+)$/gm, '<h3>$1</h3>');

    // 粗體和斜體
    storage = storage.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    storage = storage.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 代碼塊
    storage = storage.replace(/```(\w+)?\n([\s\S]*?)```/g, '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">$1</ac:parameter><ac:plain-text-body><![CDATA[$2]]></ac:plain-text-body></ac:structured-macro>');

    // 行內代碼
    storage = storage.replace(/`(.+?)`/g, '<code>$1</code>');

    // 鏈接
    storage = storage.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    // 列表
    storage = storage.replace(/^- (.+)$/gm, '<li>$1</li>');
    storage = storage.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // 段落
    storage = storage.replace(/\n\n/g, '</p><p>');
    storage = `<p>${storage}</p>`;

    return storage;
  }

  /**
   * 將 Confluence Storage 格式轉換為 Markdown
   */
  static storageToMarkdown(storage: string): string {
    // 簡化的 Confluence Storage 格式到 Markdown 轉換
    let markdown = storage;

    // 移除 HTML 標籤並轉換為 Markdown
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/g, '# $1');
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/g, '## $1');
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/g, '### $1');
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*');
    markdown = markdown.replace(/<code>(.*?)<\/code>/g, '`$1`');
    markdown = markdown.replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)');
    markdown = markdown.replace(/<li>(.*?)<\/li>/g, '- $1');
    markdown = markdown.replace(/<\/?[pu]l>/g, '');
    markdown = markdown.replace(/<\/?p>/g, '\n\n');

    // 清理多餘的換行
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim();

    return markdown;
  }
}
