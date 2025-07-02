import axios from 'axios';
import * as cheerio from 'cheerio';
import { DatabaseManager } from '../storage/DatabaseManager';

export interface APIEndpoint {
  name: string;
  namespace: string;
  type: 'class' | 'interface' | 'function' | 'enum' | 'variable';
  description: string;
  signature?: string;
  parameters?: APIParameter[];
  returnType?: string;
  since?: string;
  deprecated?: boolean;
  examples?: string[];
  relatedAPIs?: string[];
  url: string;
}

export interface APIParameter {
  name: string;
  type: string;
  optional: boolean;
  description: string;
}

export interface APINamespace {
  name: string;
  description: string;
  endpoints: APIEndpoint[];
  subNamespaces: APINamespace[];
  url?: string;
}

export interface CrawlResult {
  timestamp: Date;
  version: string;
  namespaces: APINamespace[];
  totalAPIs: number;
  newAPIs: APIEndpoint[];
  updatedAPIs: APIEndpoint[];
  deprecatedAPIs: APIEndpoint[];
}

export class VSCodeAPICrawler {
  private baseUrl = 'https://code.visualstudio.com/api';
  private dbManager: DatabaseManager;
  private crawlHistory: CrawlResult[] = [];

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * 開始完整的 API 爬取
   */
  async crawlVSCodeAPI(): Promise<CrawlResult> {
    console.log('開始爬取 VS Code API...');

    try {
      // 獲取主要 API 頁面
      const mainPageContent = await this.fetchPage(`${this.baseUrl}/references/vscode-api`);

      // 解析 API 結構
      const namespaces = await this.parseAPIStructure(mainPageContent);

      // 獲取詳細的 API 信息
      const detailedNamespaces = await this.enrichAPIDetails(namespaces);

      // 比較與之前的版本
      const previousResult = await this.getLastCrawlResult();
      const comparison = this.compareAPIVersions(detailedNamespaces, previousResult);

      const result: CrawlResult = {
        timestamp: new Date(),
        version: await this.detectVSCodeVersion(),
        namespaces: detailedNamespaces,
        totalAPIs: this.countTotalAPIs(detailedNamespaces),
        newAPIs: comparison.newAPIs,
        updatedAPIs: comparison.updatedAPIs,
        deprecatedAPIs: comparison.deprecatedAPIs
      };

      // 保存結果到數據庫
      await this.saveCrawlResult(result);

      console.log(`爬取完成！發現 ${result.totalAPIs} 個 API，其中新增 ${result.newAPIs.length} 個`);

      return result;
    } catch (error) {
      console.error('API 爬取失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取網頁內容
   */
  private async fetchPage(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error(`獲取頁面失敗 ${url}:`, error);
      throw error;
    }
  }

  /**
   * 解析 API 結構
   */
  private async parseAPIStructure(html: string): Promise<APINamespace[]> {
    const $ = cheerio.load(html);
    const namespaces: APINamespace[] = [];

    // 查找主要的 API 命名空間
    $('.api-namespace, .namespace-section').each((index, element) => {
      const $element = $(element);
      const namespaceName = $element.find('h2, h3').first().text().trim();

      if (namespaceName) {
        const namespace: APINamespace = {
          name: namespaceName,
          description: $element.find('.description, .summary').first().text().trim(),
          url: this.resolveURL($element.find('a').attr('href') || ''),
          endpoints: [],
          subNamespaces: []
        };

        // 解析該命名空間下的 API
        $element.find('.api-item, .member').each((i, apiElement) => {
          const $api = $(apiElement);
          const apiName = $api.find('.api-name, .member-name').text().trim();

          if (apiName) {
            const endpoint: APIEndpoint = {
              name: apiName,
              namespace: namespaceName,
              type: this.detectAPIType($api),
              description: $api.find('.description, .summary').text().trim(),
              signature: $api.find('.signature, .syntax').text().trim(),
              url: this.resolveURL($api.find('a').attr('href') || ''),
              since: $api.find('.since').text().trim() || undefined,
              deprecated: $api.hasClass('deprecated') || $api.find('.deprecated').length > 0
            };

            namespace.endpoints.push(endpoint);
          }
        });

        namespaces.push(namespace);
      }
    });

    // 如果沒有找到結構化的命名空間，嘗試其他解析方法
    if (namespaces.length === 0) {
      return await this.parseAlternativeStructure($ as any);
    }

    return namespaces;
  }

  /**
   * 備用解析方法
   */
  private async parseAlternativeStructure($: cheerio.CheerioAPI): Promise<APINamespace[]> {
    const namespaces: APINamespace[] = [];

    // 查找所有可能的 API 鏈接
    const apiLinks: string[] = [];
    $('a[href*="/api/"]').each((index, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('/api/')) {
        apiLinks.push(this.resolveURL(href));
      }
    });

    // 為每個發現的鏈接創建基本的 API 條目
    const mainNamespace: APINamespace = {
      name: 'vscode',
      description: 'VS Code Extension API',
      endpoints: [],
      subNamespaces: []
    };

    for (const link of apiLinks) {
      try {
        const linkContent = await this.fetchPage(link);
        const linkAPIs = await this.parseAPIPage(linkContent, link);
        mainNamespace.endpoints.push(...linkAPIs);
      } catch (error) {
        console.warn(`無法解析頁面 ${link}:`, error);
      }
    }

    namespaces.push(mainNamespace);
    return namespaces;
  }

  /**
   * 解析單個 API 頁面
   */
  private async parseAPIPage(html: string, url: string): Promise<APIEndpoint[]> {
    const $ = cheerio.load(html);
    const endpoints: APIEndpoint[] = [];

    // 查找頁面中的 API 定義
    $('.api-definition, .member-definition').each((index, element) => {
      const $element = $(element);
      const name = $element.find('h1, h2, h3, .name').first().text().trim();

      if (name) {
        const endpoint: APIEndpoint = {
          name: name,
          namespace: this.extractNamespaceFromURL(url),
          type: this.detectAPIType($element),
          description: $element.find('.description, .summary, p').first().text().trim(),
          signature: $element.find('.signature, .syntax, code').first().text().trim(),
          url: url
        };

        endpoints.push(endpoint);
      }
    });

    return endpoints;
  }

  /**
   * 豐富 API 詳細信息
   */
  private async enrichAPIDetails(namespaces: APINamespace[]): Promise<APINamespace[]> {
    const enrichedNamespaces: APINamespace[] = [];

    for (const namespace of namespaces) {
      const enrichedNamespace: APINamespace = {
        ...namespace,
        endpoints: [],
        subNamespaces: []
      };

      // 豐富每個 API 端點的詳細信息
      for (const endpoint of namespace.endpoints) {
        try {
          const enrichedEndpoint = await this.enrichSingleAPI(endpoint);
          enrichedNamespace.endpoints.push(enrichedEndpoint);
        } catch (error) {
          console.warn(`無法豐富 API ${endpoint.name}:`, error);
          enrichedNamespace.endpoints.push(endpoint);
        }
      }

      enrichedNamespaces.push(enrichedNamespace);
    }

    return enrichedNamespaces;
  }

  /**
   * 豐富單個 API 的詳細信息
   */
  private async enrichSingleAPI(endpoint: APIEndpoint): Promise<APIEndpoint> {
    if (!endpoint.url) {
      return endpoint;
    }

    try {
      const pageContent = await this.fetchPage(endpoint.url);
      const $ = cheerio.load(pageContent);

      // 提取參數信息
      const parameters: APIParameter[] = [];
      $('.parameter, .param').each((index, element) => {
        const $param = $(element);
        const paramName = $param.find('.param-name, .name').text().trim();
        const paramType = $param.find('.param-type, .type').text().trim();
        const paramDesc = $param.find('.param-description, .description').text().trim();

        if (paramName) {
          parameters.push({
            name: paramName,
            type: paramType || 'any',
            optional: $param.hasClass('optional') || paramName.includes('?'),
            description: paramDesc
          });
        }
      });

      // 提取範例
      const examples: string[] = [];
      $('.example, .code-example').each((index, element) => {
        const example = $(element).find('code, pre').text().trim();
        if (example) {
          examples.push(example);
        }
      });

      // 提取相關 API
      const relatedAPIs: string[] = [];
      $('.related-api, .see-also')
        .find('a')
        .each((index, element) => {
          const relatedAPI = $(element).text().trim();
          if (relatedAPI) {
            relatedAPIs.push(relatedAPI);
          }
        });

      return {
        ...endpoint,
        parameters: parameters.length > 0 ? parameters : undefined,
        returnType: $('.return-type, .returns').text().trim() || undefined,
        examples: examples.length > 0 ? examples : undefined,
        relatedAPIs: relatedAPIs.length > 0 ? relatedAPIs : undefined
      };
    } catch (error) {
      console.warn(`豐富 API ${endpoint.name} 詳細信息失敗:`, error);
      return endpoint;
    }
  }

  /**
   * 檢測 API 類型
   */
  private detectAPIType($element: cheerio.Cheerio): APIEndpoint['type'] {
    const text = $element.text().toLowerCase();
    const classNames = $element.attr('class') || '';

    if (text.includes('class') || classNames.includes('class')) {
      return 'class';
    } else if (text.includes('interface') || classNames.includes('interface')) {
      return 'interface';
    } else if (text.includes('enum') || classNames.includes('enum')) {
      return 'enum';
    } else if (text.includes('function') || text.includes('()') || classNames.includes('function')) {
      return 'function';
    } else {
      return 'variable';
    }
  }

  /**
   * 解析 URL
   */
  private resolveURL(href: string): string {
    if (href.startsWith('http')) {
      return href;
    } else if (href.startsWith('/')) {
      return `https://code.visualstudio.com${href}`;
    } else {
      return `${this.baseUrl}/${href}`;
    }
  }

  /**
   * 從 URL 提取命名空間
   */
  private extractNamespaceFromURL(url: string): string {
    const match = url.match(/\/api\/([^\/]+)/);
    return match ? match[1] : 'vscode';
  }

  /**
   * 檢測 VS Code 版本
   */
  private async detectVSCodeVersion(): Promise<string> {
    try {
      const versionPage = await this.fetchPage('https://code.visualstudio.com/updates');
      const $ = cheerio.load(versionPage);

      // 查找版本信息
      const version = $('.version, .release-version').first().text().trim();
      return version || 'unknown';
    } catch (error) {
      console.warn('無法檢測 VS Code 版本:', error);
      return 'unknown';
    }
  }

  /**
   * 計算總 API 數量
   */
  private countTotalAPIs(namespaces: APINamespace[]): number {
    return namespaces.reduce((total, namespace) => {
      return total + namespace.endpoints.length + this.countTotalAPIs(namespace.subNamespaces);
    }, 0);
  }

  /**
   * 比較 API 版本
   */
  private compareAPIVersions(
    currentNamespaces: APINamespace[],
    previousResult: CrawlResult | null
  ): { newAPIs: APIEndpoint[]; updatedAPIs: APIEndpoint[]; deprecatedAPIs: APIEndpoint[] } {
    const newAPIs: APIEndpoint[] = [];
    const updatedAPIs: APIEndpoint[] = [];
    const deprecatedAPIs: APIEndpoint[] = [];

    if (!previousResult) {
      // 如果沒有之前的結果，所有 API 都是新的
      currentNamespaces.forEach(namespace => {
        newAPIs.push(...namespace.endpoints);
      });
      return { newAPIs, updatedAPIs, deprecatedAPIs };
    }

    // 創建之前 API 的映射
    const previousAPIs = new Map<string, APIEndpoint>();
    previousResult.namespaces.forEach(namespace => {
      namespace.endpoints.forEach(api => {
        previousAPIs.set(`${api.namespace}.${api.name}`, api);
      });
    });

    // 比較當前 API 與之前的 API
    currentNamespaces.forEach(namespace => {
      namespace.endpoints.forEach(currentAPI => {
        const key = `${currentAPI.namespace}.${currentAPI.name}`;
        const previousAPI = previousAPIs.get(key);

        if (!previousAPI) {
          newAPIs.push(currentAPI);
        } else if (this.hasAPIChanged(currentAPI, previousAPI)) {
          updatedAPIs.push(currentAPI);
        }

        // 從映射中移除已處理的 API
        previousAPIs.delete(key);
      });
    });

    // 剩餘的 API 被認為是已棄用的
    deprecatedAPIs.push(...Array.from(previousAPIs.values()));

    return { newAPIs, updatedAPIs, deprecatedAPIs };
  }

  /**
   * 檢查 API 是否有變更
   */
  private hasAPIChanged(current: APIEndpoint, previous: APIEndpoint): boolean {
    return (
      current.description !== previous.description ||
      current.signature !== previous.signature ||
      current.deprecated !== previous.deprecated ||
      JSON.stringify(current.parameters) !== JSON.stringify(previous.parameters)
    );
  }

  /**
   * 獲取最後一次爬取結果
   */
  private async getLastCrawlResult(): Promise<CrawlResult | null> {
    try {
      const result = await this.dbManager.get<any>('SELECT * FROM api_crawl_history ORDER BY timestamp DESC LIMIT 1');

      if (result) {
        return {
          timestamp: new Date(result.timestamp),
          version: result.version,
          namespaces: JSON.parse(result.namespaces),
          totalAPIs: result.total_apis,
          newAPIs: JSON.parse(result.new_apis || '[]'),
          updatedAPIs: JSON.parse(result.updated_apis || '[]'),
          deprecatedAPIs: JSON.parse(result.deprecated_apis || '[]')
        };
      }

      return null;
    } catch (error) {
      console.warn('獲取上次爬取結果失敗:', error);
      return null;
    }
  }

  /**
   * 保存爬取結果
   */
  private async saveCrawlResult(result: CrawlResult): Promise<void> {
    try {
      await this.dbManager.run(
        `
                INSERT INTO api_crawl_history (
                    timestamp, version, namespaces, total_apis,
                    new_apis, updated_apis, deprecated_apis
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
        [
          result.timestamp.toISOString(),
          result.version,
          JSON.stringify(result.namespaces),
          result.totalAPIs,
          JSON.stringify(result.newAPIs),
          JSON.stringify(result.updatedAPIs),
          JSON.stringify(result.deprecatedAPIs)
        ]
      );

      console.log('爬取結果已保存到數據庫');
    } catch (error) {
      console.error('保存爬取結果失敗:', error);
      throw error;
    }
  }
}
