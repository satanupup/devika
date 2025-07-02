import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';
import { FigmaImportOptions, MediaContent, MediaType } from './MultimodalProcessor';

/**
 * Figma 節點類型
 */
export enum FigmaNodeType {
  DOCUMENT = 'DOCUMENT',
  CANVAS = 'CANVAS',
  FRAME = 'FRAME',
  GROUP = 'GROUP',
  VECTOR = 'VECTOR',
  BOOLEAN_OPERATION = 'BOOLEAN_OPERATION',
  STAR = 'STAR',
  LINE = 'LINE',
  ELLIPSE = 'ELLIPSE',
  REGULAR_POLYGON = 'REGULAR_POLYGON',
  RECTANGLE = 'RECTANGLE',
  TEXT = 'TEXT',
  SLICE = 'SLICE',
  COMPONENT = 'COMPONENT',
  COMPONENT_SET = 'COMPONENT_SET',
  INSTANCE = 'INSTANCE'
}

/**
 * Figma 文件資訊
 */
export interface FigmaFileInfo {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
  link_access: string;
  version: string;
  role: string;
}

/**
 * Figma 節點
 */
export interface FigmaNode {
  id: string;
  name: string;
  type: FigmaNodeType;
  visible?: boolean;
  locked?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  constraints?: {
    vertical: string;
    horizontal: string;
  };
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  strokeAlign?: string;
  cornerRadius?: number;
  characters?: string;
  style?: FigmaTextStyle;
  componentId?: string;
  componentSetId?: string;
}

/**
 * Figma 填充
 */
export interface FigmaFill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE';
  visible?: boolean;
  opacity?: number;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  gradientStops?: Array<{
    position: number;
    color: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
  }>;
  imageRef?: string;
}

/**
 * Figma 描邊
 */
export interface FigmaStroke {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
  visible?: boolean;
  opacity?: number;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

/**
 * Figma 文字樣式
 */
export interface FigmaTextStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  lineHeightPx?: number;
  letterSpacing?: number;
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
}

/**
 * Figma 組件資訊
 */
export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks?: Array<{
    uri: string;
  }>;
}

/**
 * Figma 樣式
 */
export interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

/**
 * Figma 匯出設定
 */
export interface FigmaExportSettings {
  format: 'JPG' | 'PNG' | 'SVG' | 'PDF';
  suffix?: string;
  constraint?: {
    type: 'SCALE' | 'WIDTH' | 'HEIGHT';
    value: number;
  };
}

/**
 * Figma 整合器
 * 處理 Figma 設計文件的匯入和分析
 */
export class FigmaIntegration {
  private static instance: FigmaIntegration;
  private apiToken: string | null = null;
  private baseUrl = 'https://api.figma.com/v1';
  private cache: Map<string, any> = new Map();

  private constructor() {
    this.loadApiToken();
  }

  static getInstance(): FigmaIntegration {
    if (!FigmaIntegration.instance) {
      FigmaIntegration.instance = new FigmaIntegration();
    }
    return FigmaIntegration.instance;
  }

  /**
   * 設置 API Token
   */
  setApiToken(token: string): void {
    this.apiToken = token;
    this.saveApiToken(token);
  }

  /**
   * 獲取文件資訊
   */
  async getFileInfo(fileKey: string): Promise<FigmaFileInfo | null> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const cacheKey = `file-info-${fileKey}`;
        if (this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey);
        }

        const response = await this.makeApiRequest(`/files/${fileKey}`);
        const fileInfo: FigmaFileInfo = {
          key: fileKey,
          name: response.name,
          thumbnail_url: response.thumbnailUrl,
          last_modified: response.lastModified,
          link_access: response.linkAccess,
          version: response.version,
          role: response.role
        };

        this.cache.set(cacheKey, fileInfo);
        return fileInfo;
      },
      `獲取 Figma 文件資訊 ${fileKey}`,
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : null));
  }

  /**
   * 獲取文件節點
   */
  async getFileNodes(fileKey: string, nodeIds?: string[]): Promise<FigmaNode[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        let url = `/files/${fileKey}`;
        if (nodeIds && nodeIds.length > 0) {
          url += `/nodes?ids=${nodeIds.join(',')}`;
        }

        const response = await this.makeApiRequest(url);

        if (nodeIds) {
          // 返回特定節點
          return Object.values(response.nodes || {}).map((node: any) => node.document);
        } else {
          // 返回整個文件結構
          return [response.document];
        }
      },
      `獲取 Figma 節點 ${fileKey}`,
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : []));
  }

  /**
   * 匯出圖像
   */
  async exportImages(
    fileKey: string,
    nodeIds: string[],
    settings: FigmaExportSettings = { format: 'PNG' }
  ): Promise<Record<string, string>> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const params = new URLSearchParams({
          ids: nodeIds.join(','),
          format: settings.format.toLowerCase()
        });

        if (settings.constraint) {
          params.append('scale', settings.constraint.value.toString());
        }

        const response = await this.makeApiRequest(`/images/${fileKey}?${params}`);
        return response.images || {};
      },
      `匯出 Figma 圖像 ${fileKey}`,
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : {}));
  }

  /**
   * 獲取組件
   */
  async getComponents(fileKey: string): Promise<FigmaComponent[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeApiRequest(`/files/${fileKey}/components`);
        return Object.values(response.meta?.components || {}) as FigmaComponent[];
      },
      `獲取 Figma 組件 ${fileKey}`,
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : []));
  }

  /**
   * 獲取樣式
   */
  async getStyles(fileKey: string): Promise<FigmaStyle[]> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        const response = await this.makeApiRequest(`/files/${fileKey}/styles`);
        return Object.values(response.meta?.styles || {}) as FigmaStyle[];
      },
      `獲取 Figma 樣式 ${fileKey}`,
      { logError: true, showToUser: false }
    ).then(result => (result.success ? result.data! : []));
  }

  /**
   * 從 Figma 匯入設計
   */
  async importDesign(options: FigmaImportOptions): Promise<MediaContent | null> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 獲取文件資訊
        const fileInfo = await this.getFileInfo(options.fileKey);
        if (!fileInfo) {
          throw new Error('無法獲取 Figma 文件資訊');
        }

        // 確定要匯出的節點
        const nodeIds = options.nodeId ? [options.nodeId] : await this.getTopLevelFrames(options.fileKey);

        // 匯出圖像
        const exportSettings: FigmaExportSettings = {
          format: (options.format?.toUpperCase() as any) || 'PNG',
          constraint: options.scale
            ? {
                type: 'SCALE',
                value: options.scale
              }
            : undefined
        };

        const imageUrls = await this.exportImages(options.fileKey, nodeIds, exportSettings);

        if (Object.keys(imageUrls).length === 0) {
          throw new Error('無法匯出 Figma 圖像');
        }

        // 下載第一個圖像
        const firstNodeId = Object.keys(imageUrls)[0];
        const imageUrl = imageUrls[firstNodeId];
        const localPath = await this.downloadImage(imageUrl, options.fileKey, firstNodeId);

        // 創建媒體內容
        const mediaContent: MediaContent = {
          id: `figma-${options.fileKey}-${firstNodeId}`,
          type: MediaType.FIGMA,
          format: exportSettings.format.toLowerCase(),
          uri: vscode.Uri.file(localPath),
          metadata: {
            figmaFileKey: options.fileKey,
            figmaNodeId: firstNodeId,
            source: 'figma',
            description: fileInfo.name
          },
          createdAt: new Date(),
          size: 0 // 將在後續更新
        };

        // 如果需要包含元數據，獲取節點詳細資訊
        if (options.includeMetadata) {
          const nodes = await this.getFileNodes(options.fileKey, [firstNodeId]);
          if (nodes.length > 0) {
            const node = nodes[0];
            mediaContent.metadata.width = node.absoluteBoundingBox?.width;
            mediaContent.metadata.height = node.absoluteBoundingBox?.height;
            mediaContent.metadata.tags = [node.type.toLowerCase(), 'figma-design'];
          }
        }

        return mediaContent;
      },
      `從 Figma 匯入設計 ${options.fileKey}`,
      { logError: true, showToUser: true }
    ).then(result => (result.success ? result.data! : null));
  }

  /**
   * 分析 Figma 設計模式
   */
  async analyzeDesignPatterns(fileKey: string): Promise<{
    components: FigmaComponent[];
    styles: FigmaStyle[];
    designTokens: Record<string, any>;
    patterns: string[];
  }> {
    const components = await this.getComponents(fileKey);
    const styles = await this.getStyles(fileKey);
    const nodes = await this.getFileNodes(fileKey);

    // 分析設計令牌
    const designTokens = this.extractDesignTokens(nodes, styles);

    // 識別設計模式
    const patterns = this.identifyDesignPatterns(nodes, components);

    return {
      components,
      styles,
      designTokens,
      patterns
    };
  }

  /**
   * 生成代碼建議
   */
  async generateCodeFromFigma(
    fileKey: string,
    nodeId?: string
  ): Promise<{
    html: string;
    css: string;
    react: string;
    vue: string;
  }> {
    const nodes = await this.getFileNodes(fileKey, nodeId ? [nodeId] : undefined);

    if (nodes.length === 0) {
      return { html: '', css: '', react: '', vue: '' };
    }

    const node = nodes[0];

    return {
      html: this.generateHTML(node),
      css: this.generateCSS(node),
      react: this.generateReact(node),
      vue: this.generateVue(node)
    };
  }

  /**
   * 執行 API 請求
   */
  private async makeApiRequest(endpoint: string): Promise<any> {
    if (!this.apiToken) {
      throw new Error('Figma API Token 未設置');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'X-Figma-Token': this.apiToken
      }
    });

    if (!response.ok) {
      throw new Error(`Figma API 錯誤: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 獲取頂層框架
   */
  private async getTopLevelFrames(fileKey: string): Promise<string[]> {
    const nodes = await this.getFileNodes(fileKey);
    const frameIds: string[] = [];

    const findFrames = (node: FigmaNode) => {
      if (node.type === FigmaNodeType.FRAME) {
        frameIds.push(node.id);
      }
      if (node.children) {
        node.children.forEach(findFrames);
      }
    };

    nodes.forEach(findFrames);
    return frameIds;
  }

  /**
   * 下載圖像
   */
  private async downloadImage(url: string, fileKey: string, nodeId: string): Promise<string> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    const filename = `figma-${fileKey}-${nodeId}.png`;
    const tempDir = this.getTempDirectory();
    const filePath = path.join(tempDir, filename);

    await fs.promises.writeFile(filePath, Buffer.from(buffer));
    return filePath;
  }

  /**
   * 提取設計令牌
   */
  private extractDesignTokens(nodes: FigmaNode[], styles: FigmaStyle[]): Record<string, any> {
    const tokens: Record<string, any> = {
      colors: {},
      typography: {},
      spacing: {},
      borderRadius: {}
    };

    // 從樣式中提取令牌
    styles.forEach(style => {
      switch (style.styleType) {
        case 'FILL':
          tokens.colors[style.name] = style.key;
          break;
        case 'TEXT':
          tokens.typography[style.name] = style.key;
          break;
      }
    });

    return tokens;
  }

  /**
   * 識別設計模式
   */
  private identifyDesignPatterns(nodes: FigmaNode[], components: FigmaComponent[]): string[] {
    const patterns: string[] = [];

    // 基於組件識別模式
    components.forEach(component => {
      if (component.name.toLowerCase().includes('button')) {
        patterns.push('Button Pattern');
      }
      if (component.name.toLowerCase().includes('card')) {
        patterns.push('Card Pattern');
      }
      if (component.name.toLowerCase().includes('nav')) {
        patterns.push('Navigation Pattern');
      }
    });

    return [...new Set(patterns)];
  }

  /**
   * 生成 HTML
   */
  private generateHTML(node: FigmaNode): string {
    switch (node.type) {
      case FigmaNodeType.TEXT:
        return `<p>${node.characters || 'Text'}</p>`;
      case FigmaNodeType.RECTANGLE:
        return `<div class="rectangle"></div>`;
      case FigmaNodeType.FRAME:
        return `<div class="frame">\n  <!-- Frame content -->\n</div>`;
      default:
        return `<div class="${node.type.toLowerCase()}"></div>`;
    }
  }

  /**
   * 生成 CSS
   */
  private generateCSS(node: FigmaNode): string {
    const styles: string[] = [];

    if (node.absoluteBoundingBox) {
      styles.push(`width: ${node.absoluteBoundingBox.width}px;`);
      styles.push(`height: ${node.absoluteBoundingBox.height}px;`);
    }

    if (node.cornerRadius) {
      styles.push(`border-radius: ${node.cornerRadius}px;`);
    }

    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        const { r, g, b, a } = fill.color;
        styles.push(
          `background-color: rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a || 1});`
        );
      }
    }

    return `.${node.type.toLowerCase()} {\n  ${styles.join('\n  ')}\n}`;
  }

  /**
   * 生成 React
   */
  private generateReact(node: FigmaNode): string {
    const className = node.type.toLowerCase();
    const content = node.characters || 'Content';

    return `<div className="${className}">${content}</div>`;
  }

  /**
   * 生成 Vue
   */
  private generateVue(node: FigmaNode): string {
    const className = node.type.toLowerCase();
    const content = node.characters || 'Content';

    return `<div class="${className}">${content}</div>`;
  }

  /**
   * 載入 API Token
   */
  private loadApiToken(): void {
    const config = vscode.workspace.getConfiguration('devika');
    this.apiToken = config.get('figmaApiToken') || null;
  }

  /**
   * 保存 API Token
   */
  private saveApiToken(token: string): void {
    const config = vscode.workspace.getConfiguration('devika');
    config.update('figmaApiToken', token, vscode.ConfigurationTarget.Global);
  }

  /**
   * 獲取臨時目錄
   */
  private getTempDirectory(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const dir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'figma-imports');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    }

    const dir = path.join(require('os').tmpdir(), 'devika-figma');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * 清除緩存
   */
  clearCache(): void {
    this.cache.clear();
  }
}
