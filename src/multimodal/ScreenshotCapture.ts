import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';
import { ScreenshotOptions, ImageFormat, BoundingBox } from './MultimodalProcessor';

/**
 * 截圖來源
 */
export enum CaptureSource {
  SCREEN = 'screen',
  WINDOW = 'window',
  REGION = 'region',
  VSCODE_EDITOR = 'vscode_editor',
  BROWSER = 'browser'
}

/**
 * 截圖配置
 */
export interface CaptureConfig {
  source: CaptureSource;
  quality: number;
  format: ImageFormat;
  delay: number;
  includeUI: boolean;
  savePath?: string;
  filename?: string;
}

/**
 * 截圖結果
 */
export interface CaptureResult {
  success: boolean;
  filePath?: string;
  uri?: vscode.Uri;
  metadata?: {
    width: number;
    height: number;
    timestamp: Date;
    source: CaptureSource;
    fileSize: number;
  };
  error?: string;
}

/**
 * 螢幕截圖捕獲器
 * 提供多種截圖功能
 */
export class ScreenshotCapture {
  private static instance: ScreenshotCapture;
  private tempDir: string;
  private captureCount = 0;

  private constructor() {
    this.tempDir = this.getTempDirectory();
    this.ensureTempDirectory();
  }

  static getInstance(): ScreenshotCapture {
    if (!ScreenshotCapture.instance) {
      ScreenshotCapture.instance = new ScreenshotCapture();
    }
    return ScreenshotCapture.instance;
  }

  /**
   * 截取整個螢幕
   */
  async captureScreen(config: Partial<CaptureConfig> = {}): Promise<CaptureResult> {
    const fullConfig: CaptureConfig = {
      source: CaptureSource.SCREEN,
      quality: 90,
      format: ImageFormat.PNG,
      delay: 0,
      includeUI: true,
      ...config
    };

    return this.executeCapture(fullConfig);
  }

  /**
   * 截取指定區域
   */
  async captureRegion(region: BoundingBox, config: Partial<CaptureConfig> = {}): Promise<CaptureResult> {
    const fullConfig: CaptureConfig = {
      source: CaptureSource.REGION,
      quality: 90,
      format: ImageFormat.PNG,
      delay: 0,
      includeUI: false,
      ...config
    };

    return this.executeCaptureWithRegion(fullConfig, region);
  }

  /**
   * 截取當前 VS Code 編輯器
   */
  async captureVSCodeEditor(config: Partial<CaptureConfig> = {}): Promise<CaptureResult> {
    const fullConfig: CaptureConfig = {
      source: CaptureSource.VSCODE_EDITOR,
      quality: 90,
      format: ImageFormat.PNG,
      delay: 0,
      includeUI: false,
      ...config
    };

    return this.captureVSCodeWindow(fullConfig);
  }

  /**
   * 截取瀏覽器內容
   */
  async captureBrowser(url?: string, config: Partial<CaptureConfig> = {}): Promise<CaptureResult> {
    const fullConfig: CaptureConfig = {
      source: CaptureSource.BROWSER,
      quality: 90,
      format: ImageFormat.PNG,
      delay: 1000, // 等待頁面載入
      includeUI: false,
      ...config
    };

    return this.captureBrowserContent(fullConfig, url);
  }

  /**
   * 延遲截圖
   */
  async captureWithDelay(delayMs: number, config: Partial<CaptureConfig> = {}): Promise<CaptureResult> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return this.captureScreen(config);
  }

  /**
   * 批量截圖
   */
  async captureBatch(configs: Partial<CaptureConfig>[], interval: number = 1000): Promise<CaptureResult[]> {
    const results: CaptureResult[] = [];

    for (let i = 0; i < configs.length; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      const result = await this.captureScreen(configs[i]);
      results.push(result);
    }

    return results;
  }

  /**
   * 執行截圖
   */
  private async executeCapture(config: CaptureConfig): Promise<CaptureResult> {
    return ErrorHandlingUtils.executeWithErrorHandling(
      async () => {
        // 延遲執行
        if (config.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, config.delay));
        }

        const filename = this.generateFilename(config);
        const filePath = path.join(config.savePath || this.tempDir, filename);

        // 根據平台選擇截圖方法
        const success = await this.performCapture(config, filePath);

        if (!success) {
          throw new Error('截圖失敗');
        }

        // 獲取文件資訊
        const stats = await fs.promises.stat(filePath);
        const imageSize = await this.getImageDimensions(filePath);

        const result: CaptureResult = {
          success: true,
          filePath,
          uri: vscode.Uri.file(filePath),
          metadata: {
            width: imageSize.width,
            height: imageSize.height,
            timestamp: new Date(),
            source: config.source,
            fileSize: stats.size
          }
        };

        return result;
      },
      `執行截圖 (${config.source})`,
      { logError: true, showToUser: false }
    ).then(result => {
      if (result.success) {
        return result.data!;
      } else {
        return {
          success: false,
          error: result.error?.message || '截圖失敗'
        };
      }
    });
  }

  /**
   * 執行區域截圖
   */
  private async executeCaptureWithRegion(config: CaptureConfig, region: BoundingBox): Promise<CaptureResult> {
    // 先截取整個螢幕，然後裁剪指定區域
    const fullScreenResult = await this.executeCapture({
      ...config,
      source: CaptureSource.SCREEN
    });

    if (!fullScreenResult.success || !fullScreenResult.filePath) {
      return fullScreenResult;
    }

    // 裁剪圖像
    const croppedPath = await this.cropImage(fullScreenResult.filePath, region);

    if (!croppedPath) {
      return {
        success: false,
        error: '圖像裁剪失敗'
      };
    }

    // 刪除原始文件
    try {
      await fs.promises.unlink(fullScreenResult.filePath);
    } catch (error) {
      console.warn('刪除臨時文件失敗:', error);
    }

    // 更新結果
    const stats = await fs.promises.stat(croppedPath);

    return {
      success: true,
      filePath: croppedPath,
      uri: vscode.Uri.file(croppedPath),
      metadata: {
        width: region.width,
        height: region.height,
        timestamp: new Date(),
        source: config.source,
        fileSize: stats.size
      }
    };
  }

  /**
   * 截取 VS Code 視窗
   */
  private async captureVSCodeWindow(config: CaptureConfig): Promise<CaptureResult> {
    // 嘗試使用 VS Code 的內建 API
    try {
      // 這裡可以實現 VS Code 特定的截圖邏輯
      // 例如使用 webview 或其他 VS Code API
      return await this.executeCapture(config);
    } catch (error) {
      return {
        success: false,
        error: `VS Code 截圖失敗: ${error}`
      };
    }
  }

  /**
   * 截取瀏覽器內容
   */
  private async captureBrowserContent(config: CaptureConfig, url?: string): Promise<CaptureResult> {
    // 這裡可以整合 Puppeteer 或其他瀏覽器自動化工具
    try {
      if (url) {
        // 打開 URL 並截圖
        console.log(`準備截取網頁: ${url}`);
      }

      return await this.executeCapture(config);
    } catch (error) {
      return {
        success: false,
        error: `瀏覽器截圖失敗: ${error}`
      };
    }
  }

  /**
   * 執行實際截圖操作
   */
  private async performCapture(config: CaptureConfig, filePath: string): Promise<boolean> {
    const platform = process.platform;

    try {
      switch (platform) {
        case 'win32':
          return await this.captureWindows(config, filePath);
        case 'darwin':
          return await this.captureMacOS(config, filePath);
        case 'linux':
          return await this.captureLinux(config, filePath);
        default:
          throw new Error(`不支援的平台: ${platform}`);
      }
    } catch (error) {
      console.error('截圖執行失敗:', error);
      return false;
    }
  }

  /**
   * Windows 截圖
   */
  private async captureWindows(config: CaptureConfig, filePath: string): Promise<boolean> {
    // 使用 PowerShell 或其他 Windows 工具
    const { spawn } = require('child_process');

    return new Promise(resolve => {
      // 這裡可以使用 PowerShell 腳本或第三方工具
      // 例如: Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen

      // 模擬截圖成功
      setTimeout(() => {
        // 創建一個空文件作為示例
        fs.writeFileSync(filePath, Buffer.alloc(0));
        resolve(true);
      }, 100);
    });
  }

  /**
   * macOS 截圖
   */
  private async captureMacOS(config: CaptureConfig, filePath: string): Promise<boolean> {
    const { spawn } = require('child_process');

    return new Promise(resolve => {
      // 使用 screencapture 命令
      const args = ['-x', '-t', config.format, filePath];

      if (config.source === CaptureSource.REGION) {
        args.push('-s'); // 選擇區域
      }

      const screencapture = spawn('screencapture', args);

      screencapture.on('close', (code: number | null) => {
        resolve(code === 0);
      });

      screencapture.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Linux 截圖
   */
  private async captureLinux(config: CaptureConfig, filePath: string): Promise<boolean> {
    const { spawn } = require('child_process');

    return new Promise(resolve => {
      // 嘗試使用 gnome-screenshot 或 scrot
      const tools = ['gnome-screenshot', 'scrot', 'import'];

      const tryTool = (toolIndex: number) => {
        if (toolIndex >= tools.length) {
          resolve(false);
          return;
        }

        const tool = tools[toolIndex];
        let args: string[] = [];

        switch (tool) {
          case 'gnome-screenshot':
            args = ['-f', filePath];
            break;
          case 'scrot':
            args = [filePath];
            break;
          case 'import':
            args = ['-window', 'root', filePath];
            break;
        }

        const process = spawn(tool, args);

        process.on('close', (code: number | null) => {
          if (code === 0) {
            resolve(true);
          } else {
            tryTool(toolIndex + 1);
          }
        });

        process.on('error', () => {
          tryTool(toolIndex + 1);
        });
      };

      tryTool(0);
    });
  }

  /**
   * 裁剪圖像
   */
  private async cropImage(imagePath: string, region: BoundingBox): Promise<string | null> {
    // 這裡可以使用 sharp 或其他圖像處理庫
    // 目前返回原始路徑作為示例
    return imagePath;
  }

  /**
   * 獲取圖像尺寸
   */
  private async getImageDimensions(imagePath: string): Promise<{ width: number; height: number }> {
    // 這裡可以使用圖像處理庫獲取實際尺寸
    // 目前返回默認值
    return { width: 1920, height: 1080 };
  }

  /**
   * 生成文件名
   */
  private generateFilename(config: CaptureConfig): string {
    if (config.filename) {
      return config.filename;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const counter = String(++this.captureCount).padStart(3, '0');

    return `screenshot-${timestamp}-${counter}.${config.format}`;
  }

  /**
   * 獲取臨時目錄
   */
  private getTempDirectory(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return path.join(workspaceFolder.uri.fsPath, '.vscode', 'screenshots');
    }

    return path.join(require('os').tmpdir(), 'devika-screenshots');
  }

  /**
   * 確保臨時目錄存在
   */
  private ensureTempDirectory(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch (error) {
      console.error('創建截圖目錄失敗:', error);
    }
  }

  /**
   * 清理臨時文件
   */
  async cleanupTempFiles(olderThanDays: number = 7): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.tempDir);
      const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.promises.stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('清理臨時文件失敗:', error);
    }
  }

  /**
   * 獲取截圖歷史
   */
  async getScreenshotHistory(): Promise<vscode.Uri[]> {
    try {
      const files = await fs.promises.readdir(this.tempDir);
      const imageFiles = files.filter(file => this.supportedImageFormats.includes(path.extname(file).toLowerCase()));

      return imageFiles.map(file => vscode.Uri.file(path.join(this.tempDir, file)));
    } catch (error) {
      console.error('獲取截圖歷史失敗:', error);
      return [];
    }
  }

  private supportedImageFormats = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
}
