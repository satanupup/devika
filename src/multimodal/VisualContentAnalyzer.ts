import * as vscode from 'vscode';
import { MediaContent, UIElement, DesignPattern, BoundingBox, ExtractedText } from './MultimodalProcessor';
import { ErrorHandlingUtils } from '../utils/ErrorHandlingUtils';

/**
 * 顏色資訊
 */
export interface ColorInfo {
    hex: string;
    rgb: [number, number, number];
    hsl: [number, number, number];
    name?: string;
    usage: 'primary' | 'secondary' | 'accent' | 'background' | 'text';
}

/**
 * 字體資訊
 */
export interface FontInfo {
    family: string;
    size: number;
    weight: number;
    style: 'normal' | 'italic' | 'oblique';
    color: string;
    usage: 'heading' | 'body' | 'caption' | 'button';
}

/**
 * 佈局資訊
 */
export interface LayoutInfo {
    type: 'grid' | 'flexbox' | 'absolute' | 'float' | 'table';
    columns?: number;
    rows?: number;
    gaps?: number;
    alignment: 'left' | 'center' | 'right' | 'justify';
    spacing: {
        margin: number;
        padding: number;
    };
}

/**
 * 設計系統資訊
 */
export interface DesignSystemInfo {
    colors: ColorInfo[];
    fonts: FontInfo[];
    spacing: number[];
    borderRadius: number[];
    shadows: string[];
    breakpoints: Record<string, number>;
}

/**
 * 組件識別結果
 */
export interface ComponentIdentification {
    name: string;
    type: 'atomic' | 'molecular' | 'organism' | 'template' | 'page';
    props?: Record<string, any>;
    children?: ComponentIdentification[];
    codeExample: string;
    framework: 'react' | 'vue' | 'angular' | 'html' | 'flutter';
}

/**
 * 視覺內容分析器
 * 專門處理圖像和設計分析
 */
export class VisualContentAnalyzer {
    private static instance: VisualContentAnalyzer;

    private constructor() {}

    static getInstance(): VisualContentAnalyzer {
        if (!VisualContentAnalyzer.instance) {
            VisualContentAnalyzer.instance = new VisualContentAnalyzer();
        }
        return VisualContentAnalyzer.instance;
    }

    /**
     * 分析設計系統
     */
    async analyzeDesignSystem(mediaContent: MediaContent): Promise<DesignSystemInfo> {
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const designSystem: DesignSystemInfo = {
                    colors: await this.extractColors(mediaContent),
                    fonts: await this.extractFonts(mediaContent),
                    spacing: await this.extractSpacing(mediaContent),
                    borderRadius: await this.extractBorderRadius(mediaContent),
                    shadows: await this.extractShadows(mediaContent),
                    breakpoints: await this.extractBreakpoints(mediaContent)
                };

                return designSystem;
            },
            '分析設計系統',
            { logError: true, showToUser: false }
        ).then(result => result.success ? result.data! : this.getDefaultDesignSystem());
    }

    /**
     * 識別 UI 組件
     */
    async identifyComponents(mediaContent: MediaContent): Promise<ComponentIdentification[]> {
        return ErrorHandlingUtils.executeWithErrorHandling(
            async () => {
                const components: ComponentIdentification[] = [];
                
                if (!mediaContent.analysisResult?.uiElements) {
                    return components;
                }

                // 分析每個 UI 元素
                for (const element of mediaContent.analysisResult.uiElements) {
                    const component = await this.analyzeUIElement(element, mediaContent);
                    if (component) {
                        components.push(component);
                    }
                }

                // 識別複合組件
                const compositeComponents = await this.identifyCompositeComponents(components);
                components.push(...compositeComponents);

                return components;
            },
            '識別 UI 組件',
            { logError: true, showToUser: false }
        ).then(result => result.success ? result.data! : []);
    }

    /**
     * 生成響應式設計建議
     */
    async generateResponsiveDesignSuggestions(mediaContent: MediaContent): Promise<string[]> {
        const suggestions: string[] = [];
        
        if (!mediaContent.metadata.width || !mediaContent.metadata.height) {
            return suggestions;
        }

        const aspectRatio = mediaContent.metadata.width / mediaContent.metadata.height;
        
        // 基於寬高比提供建議
        if (aspectRatio > 2) {
            suggestions.push('考慮為寬螢幕設計添加側邊欄或多欄佈局');
        } else if (aspectRatio < 0.7) {
            suggestions.push('考慮為行動裝置優化垂直滾動體驗');
        }

        // 分析元素密度
        const elementDensity = this.calculateElementDensity(mediaContent);
        if (elementDensity > 0.8) {
            suggestions.push('元素密度較高，建議在小螢幕上簡化介面');
        }

        // 檢查文字大小
        const textElements = mediaContent.analysisResult?.extractedText || [];
        const smallTextCount = textElements.filter(text => (text.fontSize || 16) < 14).length;
        if (smallTextCount > textElements.length * 0.3) {
            suggestions.push('部分文字可能在行動裝置上過小，建議增大字體');
        }

        return suggestions;
    }

    /**
     * 生成無障礙建議
     */
    async generateAccessibilitySuggestions(mediaContent: MediaContent): Promise<string[]> {
        const suggestions: string[] = [];
        
        if (!mediaContent.analysisResult) {
            return suggestions;
        }

        const { accessibility, uiElements } = mediaContent.analysisResult;

        // 檢查顏色對比度
        if (accessibility?.colorContrast && accessibility.colorContrast < 4.5) {
            suggestions.push('顏色對比度不足，建議提高文字與背景的對比度');
        }

        // 檢查 alt 文字
        const imageElements = uiElements?.filter(el => el.type === 'image') || [];
        if (imageElements.length > 0 && (!accessibility?.altTexts || accessibility.altTexts.length === 0)) {
            suggestions.push('圖片缺少替代文字，建議添加 alt 屬性');
        }

        // 檢查鍵盤導航
        if (accessibility?.keyboardNavigation === false) {
            suggestions.push('介面可能不支援鍵盤導航，建議添加 tabindex 和鍵盤事件處理');
        }

        // 檢查按鈕大小
        const buttons = uiElements?.filter(el => el.type === 'button') || [];
        const smallButtons = buttons.filter(btn => 
            btn.boundingBox.width < 44 || btn.boundingBox.height < 44
        );
        if (smallButtons.length > 0) {
            suggestions.push('部分按鈕尺寸過小，建議最小尺寸為 44x44 像素');
        }

        return suggestions;
    }

    /**
     * 生成代碼框架建議
     */
    async generateFrameworkSuggestions(mediaContent: MediaContent): Promise<Record<string, string[]>> {
        const suggestions: Record<string, string[]> = {
            react: [],
            vue: [],
            angular: [],
            html: [],
            flutter: []
        };

        if (!mediaContent.analysisResult?.uiElements) {
            return suggestions;
        }

        for (const element of mediaContent.analysisResult.uiElements) {
            // React 建議
            suggestions.react.push(this.generateReactCode(element));
            
            // Vue 建議
            suggestions.vue.push(this.generateVueCode(element));
            
            // Angular 建議
            suggestions.angular.push(this.generateAngularCode(element));
            
            // HTML 建議
            suggestions.html.push(this.generateHTMLCode(element));
            
            // Flutter 建議
            suggestions.flutter.push(this.generateFlutterCode(element));
        }

        return suggestions;
    }

    /**
     * 提取顏色
     */
    private async extractColors(mediaContent: MediaContent): Promise<ColorInfo[]> {
        // 實現顏色提取邏輯
        // 這裡可以使用圖像處理庫分析主要顏色
        return [
            {
                hex: '#007ACC',
                rgb: [0, 122, 204],
                hsl: [207, 100, 40],
                name: 'VS Code Blue',
                usage: 'primary'
            },
            {
                hex: '#FFFFFF',
                rgb: [255, 255, 255],
                hsl: [0, 0, 100],
                name: 'White',
                usage: 'background'
            }
        ];
    }

    /**
     * 提取字體
     */
    private async extractFonts(mediaContent: MediaContent): Promise<FontInfo[]> {
        // 實現字體提取邏輯
        return [
            {
                family: 'Segoe UI',
                size: 16,
                weight: 400,
                style: 'normal',
                color: '#333333',
                usage: 'body'
            }
        ];
    }

    /**
     * 提取間距
     */
    private async extractSpacing(mediaContent: MediaContent): Promise<number[]> {
        // 實現間距提取邏輯
        return [4, 8, 12, 16, 24, 32, 48, 64];
    }

    /**
     * 提取邊框圓角
     */
    private async extractBorderRadius(mediaContent: MediaContent): Promise<number[]> {
        // 實現邊框圓角提取邏輯
        return [0, 4, 8, 12, 16, 24];
    }

    /**
     * 提取陰影
     */
    private async extractShadows(mediaContent: MediaContent): Promise<string[]> {
        // 實現陰影提取邏輯
        return [
            '0 1px 3px rgba(0,0,0,0.12)',
            '0 4px 6px rgba(0,0,0,0.1)',
            '0 10px 25px rgba(0,0,0,0.15)'
        ];
    }

    /**
     * 提取斷點
     */
    private async extractBreakpoints(mediaContent: MediaContent): Promise<Record<string, number>> {
        // 基於圖像尺寸推斷斷點
        const width = mediaContent.metadata.width || 1920;
        
        return {
            mobile: 375,
            tablet: 768,
            desktop: width > 1200 ? 1200 : width,
            wide: 1920
        };
    }

    /**
     * 分析 UI 元素
     */
    private async analyzeUIElement(element: UIElement, mediaContent: MediaContent): Promise<ComponentIdentification | null> {
        const component: ComponentIdentification = {
            name: this.generateComponentName(element),
            type: this.determineComponentType(element),
            props: this.extractElementProps(element),
            codeExample: this.generateReactCode(element),
            framework: 'react'
        };

        return component;
    }

    /**
     * 識別複合組件
     */
    private async identifyCompositeComponents(components: ComponentIdentification[]): Promise<ComponentIdentification[]> {
        const compositeComponents: ComponentIdentification[] = [];
        
        // 識別卡片組件
        const cardComponents = this.identifyCardComponents(components);
        compositeComponents.push(...cardComponents);
        
        // 識別導航組件
        const navComponents = this.identifyNavigationComponents(components);
        compositeComponents.push(...navComponents);
        
        return compositeComponents;
    }

    /**
     * 識別卡片組件
     */
    private identifyCardComponents(components: ComponentIdentification[]): ComponentIdentification[] {
        // 實現卡片組件識別邏輯
        return [];
    }

    /**
     * 識別導航組件
     */
    private identifyNavigationComponents(components: ComponentIdentification[]): ComponentIdentification[] {
        // 實現導航組件識別邏輯
        return [];
    }

    /**
     * 計算元素密度
     */
    private calculateElementDensity(mediaContent: MediaContent): number {
        if (!mediaContent.analysisResult?.uiElements || !mediaContent.metadata.width || !mediaContent.metadata.height) {
            return 0;
        }

        const totalArea = mediaContent.metadata.width * mediaContent.metadata.height;
        const elementArea = mediaContent.analysisResult.uiElements.reduce((sum, element) => {
            return sum + (element.boundingBox.width * element.boundingBox.height);
        }, 0);

        return elementArea / totalArea;
    }

    /**
     * 生成組件名稱
     */
    private generateComponentName(element: UIElement): string {
        const typeMap: Record<string, string> = {
            button: 'Button',
            input: 'Input',
            text: 'Text',
            image: 'Image',
            container: 'Container',
            navigation: 'Navigation',
            form: 'Form'
        };

        return typeMap[element.type] || 'Component';
    }

    /**
     * 確定組件類型
     */
    private determineComponentType(element: UIElement): 'atomic' | 'molecular' | 'organism' | 'template' | 'page' {
        switch (element.type) {
            case 'button':
            case 'input':
            case 'text':
            case 'image':
                return 'atomic';
            case 'form':
                return 'molecular';
            case 'navigation':
            case 'container':
                return 'organism';
            default:
                return 'atomic';
        }
    }

    /**
     * 提取元素屬性
     */
    private extractElementProps(element: UIElement): Record<string, any> {
        const props: Record<string, any> = {};
        
        if (element.label) {
            props.label = element.label;
        }
        
        props.width = element.boundingBox.width;
        props.height = element.boundingBox.height;
        
        if (element.properties) {
            Object.assign(props, element.properties);
        }
        
        return props;
    }

    /**
     * 生成 React 代碼
     */
    private generateReactCode(element: UIElement): string {
        switch (element.type) {
            case 'button':
                return `<Button onClick={handleClick}>${element.label || 'Button'}</Button>`;
            case 'input':
                return `<Input placeholder="${element.label || 'Enter text'}" />`;
            case 'text':
                return `<Text>{${element.label || 'Text content'}}</Text>`;
            case 'image':
                return `<Image src="image.jpg" alt="${element.label || 'Image'}" />`;
            case 'container':
                return `<div className="container">\n  {children}\n</div>`;
            default:
                return `<div>{/* ${element.type} */}</div>`;
        }
    }

    /**
     * 生成 Vue 代碼
     */
    private generateVueCode(element: UIElement): string {
        switch (element.type) {
            case 'button':
                return `<button @click="handleClick">${element.label || 'Button'}</button>`;
            case 'input':
                return `<input v-model="value" :placeholder="${element.label || 'Enter text'}" />`;
            default:
                return `<div><!-- ${element.type} --></div>`;
        }
    }

    /**
     * 生成 Angular 代碼
     */
    private generateAngularCode(element: UIElement): string {
        switch (element.type) {
            case 'button':
                return `<button (click)="handleClick()">${element.label || 'Button'}</button>`;
            case 'input':
                return `<input [(ngModel)]="value" placeholder="${element.label || 'Enter text'}" />`;
            default:
                return `<div><!-- ${element.type} --></div>`;
        }
    }

    /**
     * 生成 HTML 代碼
     */
    private generateHTMLCode(element: UIElement): string {
        switch (element.type) {
            case 'button':
                return `<button type="button">${element.label || 'Button'}</button>`;
            case 'input':
                return `<input type="text" placeholder="${element.label || 'Enter text'}" />`;
            default:
                return `<div><!-- ${element.type} --></div>`;
        }
    }

    /**
     * 生成 Flutter 代碼
     */
    private generateFlutterCode(element: UIElement): string {
        switch (element.type) {
            case 'button':
                return `ElevatedButton(\n  onPressed: () {},\n  child: Text('${element.label || 'Button'}'),\n)`;
            case 'input':
                return `TextField(\n  decoration: InputDecoration(\n    hintText: '${element.label || 'Enter text'}',\n  ),\n)`;
            default:
                return `Container(/* ${element.type} */)`;
        }
    }

    /**
     * 獲取默認設計系統
     */
    private getDefaultDesignSystem(): DesignSystemInfo {
        return {
            colors: [],
            fonts: [],
            spacing: [4, 8, 12, 16, 24, 32],
            borderRadius: [0, 4, 8, 12],
            shadows: [],
            breakpoints: {
                mobile: 375,
                tablet: 768,
                desktop: 1200,
                wide: 1920
            }
        };
    }
}
