import * as vscode from 'vscode';
import { MultimodalProcessor, MediaContent, MediaType } from './MultimodalProcessor';
import { VisualContentAnalyzer, DesignSystemInfo, ComponentIdentification } from './VisualContentAnalyzer';
import { ScreenshotCapture, CaptureConfig, CaptureSource } from './ScreenshotCapture';
import { FigmaIntegration, FigmaImportOptions } from './FigmaIntegration';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 多模態命令處理器
 * 整合所有多模態功能並提供 VS Code 命令
 */
export class MultimodalCommands {
    private static instance: MultimodalCommands;
    private processor: MultimodalProcessor;
    private analyzer: VisualContentAnalyzer;
    private screenshotCapture: ScreenshotCapture;
    private figmaIntegration: FigmaIntegration;
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        this.processor = MultimodalProcessor.getInstance();
        this.analyzer = VisualContentAnalyzer.getInstance();
        this.screenshotCapture = ScreenshotCapture.getInstance();
        this.figmaIntegration = FigmaIntegration.getInstance();
        this.registerCommands();
    }

    static getInstance(): MultimodalCommands {
        if (!MultimodalCommands.instance) {
            MultimodalCommands.instance = new MultimodalCommands();
        }
        return MultimodalCommands.instance;
    }

    /**
     * 註冊所有命令
     */
    private registerCommands(): void {
        // 截圖相關命令
        this.disposables.push(
            vscode.commands.registerCommand('devika.takeScreenshot', () => this.takeScreenshot())
        );

        this.disposables.push(
            vscode.commands.registerCommand('devika.captureRegion', () => this.captureRegion())
        );

        this.disposables.push(
            vscode.commands.registerCommand('devika.captureVSCode', () => this.captureVSCode())
        );

        // Figma 相關命令
        this.disposables.push(
            vscode.commands.registerCommand('devika.importFromFigma', () => this.importFromFigma())
        );

        this.disposables.push(
            vscode.commands.registerCommand('devika.setFigmaToken', () => this.setFigmaToken())
        );

        // 分析相關命令
        this.disposables.push(
            vscode.commands.registerCommand('devika.analyzeImage', (uri?: vscode.Uri) => this.analyzeImage(uri))
        );

        this.disposables.push(
            vscode.commands.registerCommand('devika.generateCodeFromImage', (uri?: vscode.Uri) => this.generateCodeFromImage(uri))
        );

        this.disposables.push(
            vscode.commands.registerCommand('devika.analyzeDesignSystem', (uri?: vscode.Uri) => this.analyzeDesignSystem(uri))
        );

        // 工具命令
        this.disposables.push(
            vscode.commands.registerCommand('devika.showScreenshotHistory', () => this.showScreenshotHistory())
        );

        this.disposables.push(
            vscode.commands.registerCommand('devika.clearMultimodalCache', () => this.clearCache())
        );
    }

    /**
     * 截取螢幕截圖
     */
    async takeScreenshot(): Promise<void> {
        try {
            const options = await this.getScreenshotOptions();
            if (!options) return;

            const result = await this.screenshotCapture.captureScreen(options);
            
            if (result.success && result.uri) {
                await this.showCaptureResult(result.uri, '螢幕截圖已保存');
            } else {
                vscode.window.showErrorMessage(`截圖失敗: ${result.error}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`截圖失敗: ${error}`);
        }
    }

    /**
     * 截取指定區域
     */
    async captureRegion(): Promise<void> {
        try {
            vscode.window.showInformationMessage('請在螢幕上選擇要截取的區域');
            
            // 這裡可以實現區域選擇邏輯
            const region = { x: 0, y: 0, width: 800, height: 600 }; // 示例區域
            
            const result = await this.screenshotCapture.captureRegion(region);
            
            if (result.success && result.uri) {
                await this.showCaptureResult(result.uri, '區域截圖已保存');
            } else {
                vscode.window.showErrorMessage(`區域截圖失敗: ${result.error}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`區域截圖失敗: ${error}`);
        }
    }

    /**
     * 截取 VS Code 視窗
     */
    async captureVSCode(): Promise<void> {
        try {
            const result = await this.screenshotCapture.captureVSCodeEditor();
            
            if (result.success && result.uri) {
                await this.showCaptureResult(result.uri, 'VS Code 截圖已保存');
            } else {
                vscode.window.showErrorMessage(`VS Code 截圖失敗: ${result.error}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`VS Code 截圖失敗: ${error}`);
        }
    }

    /**
     * 從 Figma 匯入設計
     */
    async importFromFigma(): Promise<void> {
        try {
            const fileKey = await vscode.window.showInputBox({
                prompt: '請輸入 Figma 文件 Key 或 URL',
                placeholder: 'https://www.figma.com/file/ABC123/Design 或 ABC123'
            });

            if (!fileKey) return;

            const extractedKey = this.extractFigmaFileKey(fileKey);
            if (!extractedKey) {
                vscode.window.showErrorMessage('無效的 Figma 文件 Key 或 URL');
                return;
            }

            const options: FigmaImportOptions = {
                fileKey: extractedKey,
                includeMetadata: true
            };

            const mediaContent = await this.figmaIntegration.importDesign(options);
            
            if (mediaContent) {
                await this.showCaptureResult(mediaContent.uri, 'Figma 設計已匯入');
                
                // 自動分析設計
                const analysisResult = await this.analyzer.analyzeDesignSystem(mediaContent);
                await this.showDesignSystemAnalysis(analysisResult);
            } else {
                vscode.window.showErrorMessage('Figma 匯入失敗');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Figma 匯入失敗: ${error}`);
        }
    }

    /**
     * 設置 Figma API Token
     */
    async setFigmaToken(): Promise<void> {
        try {
            const token = await vscode.window.showInputBox({
                prompt: '請輸入 Figma API Token',
                password: true,
                placeHolder: 'figd_...'
            });

            if (token) {
                this.figmaIntegration.setApiToken(token);
                vscode.window.showInformationMessage('Figma API Token 已設置');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`設置 Figma Token 失敗: ${error}`);
        }
    }

    /**
     * 分析圖像
     */
    async analyzeImage(uri?: vscode.Uri): Promise<void> {
        try {
            const imageUri = uri || await this.selectImageFile();
            if (!imageUri) return;

            const mediaContent = await this.processor.processMedia(imageUri);
            if (!mediaContent) {
                vscode.window.showErrorMessage('無法處理圖像文件');
                return;
            }

            // 顯示分析結果
            await this.showAnalysisResults(mediaContent);
        } catch (error) {
            vscode.window.showErrorMessage(`圖像分析失敗: ${error}`);
        }
    }

    /**
     * 從圖像生成代碼
     */
    async generateCodeFromImage(uri?: vscode.Uri): Promise<void> {
        try {
            const imageUri = uri || await this.selectImageFile();
            if (!imageUri) return;

            const mediaContent = await this.processor.processMedia(imageUri);
            if (!mediaContent) {
                vscode.window.showErrorMessage('無法處理圖像文件');
                return;
            }

            // 識別組件
            const components = await this.analyzer.identifyComponents(mediaContent);
            
            // 生成代碼建議
            const codeSuggestions = await this.processor.generateCodeSuggestions(mediaContent);
            
            // 顯示代碼建議
            await this.showCodeSuggestions(components, codeSuggestions);
        } catch (error) {
            vscode.window.showErrorMessage(`代碼生成失敗: ${error}`);
        }
    }

    /**
     * 分析設計系統
     */
    async analyzeDesignSystem(uri?: vscode.Uri): Promise<void> {
        try {
            const imageUri = uri || await this.selectImageFile();
            if (!imageUri) return;

            const mediaContent = await this.processor.processMedia(imageUri);
            if (!mediaContent) {
                vscode.window.showErrorMessage('無法處理圖像文件');
                return;
            }

            const designSystem = await this.analyzer.analyzeDesignSystem(mediaContent);
            await this.showDesignSystemAnalysis(designSystem);
        } catch (error) {
            vscode.window.showErrorMessage(`設計系統分析失敗: ${error}`);
        }
    }

    /**
     * 顯示截圖歷史
     */
    async showScreenshotHistory(): Promise<void> {
        try {
            const screenshots = await this.screenshotCapture.getScreenshotHistory();
            
            if (screenshots.length === 0) {
                vscode.window.showInformationMessage('沒有截圖歷史');
                return;
            }

            const items = screenshots.map(uri => ({
                label: path.basename(uri.fsPath),
                description: uri.fsPath,
                uri
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '選擇要查看的截圖'
            });

            if (selected) {
                await vscode.commands.executeCommand('vscode.open', selected.uri);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`顯示截圖歷史失敗: ${error}`);
        }
    }

    /**
     * 清除緩存
     */
    async clearCache(): Promise<void> {
        try {
            this.processor.clearCache();
            this.figmaIntegration.clearCache();
            await this.screenshotCapture.cleanupTempFiles();
            
            vscode.window.showInformationMessage('多模態緩存已清除');
        } catch (error) {
            vscode.window.showErrorMessage(`清除緩存失敗: ${error}`);
        }
    }

    /**
     * 獲取截圖選項
     */
    private async getScreenshotOptions(): Promise<CaptureConfig | null> {
        const formatOptions = ['PNG', 'JPEG', 'WEBP'];
        const format = await vscode.window.showQuickPick(formatOptions, {
            placeHolder: '選擇圖像格式'
        });

        if (!format) return null;

        const qualityInput = await vscode.window.showInputBox({
            prompt: '圖像品質 (1-100)',
            value: '90',
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1 || num > 100) {
                    return '請輸入 1-100 之間的數字';
                }
                return null;
            }
        });

        if (!qualityInput) return null;

        return {
            source: CaptureSource.SCREEN,
            format: format.toLowerCase() as any,
            quality: parseInt(qualityInput),
            delay: 0,
            includeUI: true
        };
    }

    /**
     * 選擇圖像文件
     */
    private async selectImageFile(): Promise<vscode.Uri | null> {
        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: {
                'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
            }
        });

        return files && files.length > 0 ? files[0] : null;
    }

    /**
     * 顯示截圖結果
     */
    private async showCaptureResult(uri: vscode.Uri, message: string): Promise<void> {
        const action = await vscode.window.showInformationMessage(
            message,
            '查看圖像',
            '分析圖像',
            '生成代碼'
        );

        switch (action) {
            case '查看圖像':
                await vscode.commands.executeCommand('vscode.open', uri);
                break;
            case '分析圖像':
                await this.analyzeImage(uri);
                break;
            case '生成代碼':
                await this.generateCodeFromImage(uri);
                break;
        }
    }

    /**
     * 顯示分析結果
     */
    private async showAnalysisResults(mediaContent: MediaContent): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'imageAnalysis',
            '圖像分析結果',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.generateAnalysisHTML(mediaContent);
    }

    /**
     * 顯示代碼建議
     */
    private async showCodeSuggestions(components: ComponentIdentification[], suggestions: string[]): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'codeSuggestions',
            '代碼建議',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.generateCodeSuggestionsHTML(components, suggestions);
    }

    /**
     * 顯示設計系統分析
     */
    private async showDesignSystemAnalysis(designSystem: DesignSystemInfo): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'designSystem',
            '設計系統分析',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.generateDesignSystemHTML(designSystem);
    }

    /**
     * 提取 Figma 文件 Key
     */
    private extractFigmaFileKey(input: string): string | null {
        // 從 URL 中提取文件 Key
        const urlMatch = input.match(/figma\.com\/file\/([a-zA-Z0-9]+)/);
        if (urlMatch) {
            return urlMatch[1];
        }

        // 直接使用作為 Key
        if (/^[a-zA-Z0-9]+$/.test(input)) {
            return input;
        }

        return null;
    }

    /**
     * 生成分析結果 HTML
     */
    private generateAnalysisHTML(mediaContent: MediaContent): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>圖像分析結果</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .section { margin-bottom: 20px; }
                    .metadata { background: #f5f5f5; padding: 10px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>圖像分析結果</h1>
                <div class="section">
                    <h2>基本資訊</h2>
                    <div class="metadata">
                        <p><strong>類型:</strong> ${mediaContent.type}</p>
                        <p><strong>格式:</strong> ${mediaContent.format}</p>
                        <p><strong>尺寸:</strong> ${mediaContent.metadata.width || 'N/A'} x ${mediaContent.metadata.height || 'N/A'}</p>
                        <p><strong>大小:</strong> ${(mediaContent.size / 1024).toFixed(2)} KB</p>
                    </div>
                </div>
                ${mediaContent.analysisResult ? this.generateAnalysisDetailsHTML(mediaContent.analysisResult) : ''}
            </body>
            </html>
        `;
    }

    /**
     * 生成分析詳情 HTML
     */
    private generateAnalysisDetailsHTML(analysis: any): string {
        let html = '';

        if (analysis.uiElements && analysis.uiElements.length > 0) {
            html += `
                <div class="section">
                    <h2>UI 元素 (${analysis.uiElements.length})</h2>
                    <ul>
                        ${analysis.uiElements.map((el: any) => `<li>${el.type}: ${el.label || 'Unnamed'}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (analysis.extractedText && analysis.extractedText.length > 0) {
            html += `
                <div class="section">
                    <h2>提取的文字</h2>
                    <ul>
                        ${analysis.extractedText.map((text: any) => `<li>${text.text}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        return html;
    }

    /**
     * 生成代碼建議 HTML
     */
    private generateCodeSuggestionsHTML(components: ComponentIdentification[], suggestions: string[]): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>代碼建議</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .component { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
                    pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <h1>代碼建議</h1>
                ${components.map(comp => `
                    <div class="component">
                        <h3>${comp.name} (${comp.type})</h3>
                        <pre><code>${comp.codeExample}</code></pre>
                    </div>
                `).join('')}
                
                ${suggestions.length > 0 ? `
                    <h2>其他建議</h2>
                    ${suggestions.map(suggestion => `<pre><code>${suggestion}</code></pre>`).join('')}
                ` : ''}
            </body>
            </html>
        `;
    }

    /**
     * 生成設計系統 HTML
     */
    private generateDesignSystemHTML(designSystem: DesignSystemInfo): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>設計系統分析</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .color-swatch { display: inline-block; width: 50px; height: 50px; margin: 5px; border-radius: 3px; }
                    .section { margin-bottom: 30px; }
                </style>
            </head>
            <body>
                <h1>設計系統分析</h1>
                
                <div class="section">
                    <h2>顏色 (${designSystem.colors.length})</h2>
                    ${designSystem.colors.map(color => `
                        <div style="margin-bottom: 10px;">
                            <div class="color-swatch" style="background-color: ${color.hex};"></div>
                            <span>${color.hex} - ${color.usage}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="section">
                    <h2>字體 (${designSystem.fonts.length})</h2>
                    ${designSystem.fonts.map(font => `
                        <p><strong>${font.family}</strong> - ${font.size}px, ${font.weight}, ${font.usage}</p>
                    `).join('')}
                </div>
                
                <div class="section">
                    <h2>間距</h2>
                    <p>${designSystem.spacing.join('px, ')}px</p>
                </div>
                
                <div class="section">
                    <h2>圓角</h2>
                    <p>${designSystem.borderRadius.join('px, ')}px</p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * 銷毀資源
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
