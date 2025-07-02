import * as vscode from 'vscode';

export interface BrowserAction {
    id: string;
    type: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'extract' | 'screenshot' | 'evaluate';
    description: string;
    parameters: { [key: string]: any };
    timeout?: number;
    retries?: number;
    condition?: string;
}

export interface BrowserSession {
    id: string;
    url: string;
    title: string;
    status: 'active' | 'loading' | 'error' | 'closed';
    webview: vscode.Webview;
    panel: vscode.WebviewPanel;
    history: string[];
    cookies: { [key: string]: string };
    localStorage: { [key: string]: string };
    createdAt: Date;
    lastActivity: Date;
}

export interface ActionResult {
    success: boolean;
    data?: any;
    error?: string;
    screenshot?: string;
    timing: {
        start: Date;
        end: Date;
        duration: number;
    };
    metadata: { [key: string]: any };
}

export interface BrowserAutomation {
    id: string;
    name: string;
    description: string;
    actions: BrowserAction[];
    variables: { [key: string]: any };
    schedule?: string;
    enabled: boolean;
    lastRun?: Date;
    results: AutomationResult[];
}

export interface AutomationResult {
    id: string;
    automationId: string;
    startTime: Date;
    endTime: Date;
    status: 'success' | 'failure' | 'partial';
    actionResults: ActionResult[];
    error?: string;
    summary: string;
}

export interface WebScrapingConfig {
    url: string;
    selectors: { [key: string]: string };
    pagination?: PaginationConfig;
    filters?: FilterConfig[];
    output: OutputConfig;
    schedule?: string;
}

export interface PaginationConfig {
    nextSelector: string;
    maxPages: number;
    waitTime: number;
}

export interface FilterConfig {
    field: string;
    operator: 'equals' | 'contains' | 'regex' | 'greater' | 'less';
    value: any;
}

export interface OutputConfig {
    format: 'json' | 'csv' | 'xml';
    file?: string;
    webhook?: string;
}

export class BrowserActionSystem {
    private sessions: Map<string, BrowserSession> = new Map();
    private automations: Map<string, BrowserAutomation> = new Map();
    private scrapingConfigs: Map<string, WebScrapingConfig> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.loadConfigurations();
    }

    /**
     * 創建瀏覽器會話
     */
    async createBrowserSession(url: string, options: {
        title?: string;
        viewColumn?: vscode.ViewColumn;
        enableScripts?: boolean;
        enableForms?: boolean;
    } = {}): Promise<string> {
        const sessionId = this.generateSessionId();

        const panel = vscode.window.createWebviewPanel(
            'browserSession',
            options.title || '瀏覽器',
            options.viewColumn || vscode.ViewColumn.Two,
            {
                enableScripts: options.enableScripts !== false,
                enableForms: options.enableForms !== false,
                retainContextWhenHidden: true
            }
        );

        const session: BrowserSession = {
            id: sessionId,
            url,
            title: options.title || '瀏覽器',
            status: 'loading',
            webview: panel.webview,
            panel,
            history: [url],
            cookies: {},
            localStorage: {},
            createdAt: new Date(),
            lastActivity: new Date()
        };

        // 設置 webview 內容
        panel.webview.html = this.generateBrowserHTML(url, sessionId);

        // 處理來自 webview 的消息
        panel.webview.onDidReceiveMessage(message => {
            this.handleWebviewMessage(sessionId, message);
        });

        // 處理面板關閉
        panel.onDidDispose(() => {
            this.closeBrowserSession(sessionId);
        });

        this.sessions.set(sessionId, session);

        return sessionId;
    }

    /**
     * 執行瀏覽器動作
     */
    async executeBrowserAction(sessionId: string, action: BrowserAction): Promise<ActionResult> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`瀏覽器會話不存在: ${sessionId}`);
        }

        const startTime = new Date();
        const result: ActionResult = {
            success: false,
            timing: {
                start: startTime,
                end: startTime,
                duration: 0
            },
            metadata: {}
        };

        try {
            session.lastActivity = new Date();

            switch (action.type) {
                case 'navigate':
                    result.data = await this.executeNavigate(session, action);
                    break;
                case 'click':
                    result.data = await this.executeClick(session, action);
                    break;
                case 'type':
                    result.data = await this.executeType(session, action);
                    break;
                case 'scroll':
                    result.data = await this.executeScroll(session, action);
                    break;
                case 'wait':
                    result.data = await this.executeWait(session, action);
                    break;
                case 'extract':
                    result.data = await this.executeExtract(session, action);
                    break;
                case 'screenshot':
                    result.data = await this.executeScreenshot(session, action);
                    break;
                case 'evaluate':
                    result.data = await this.executeEvaluate(session, action);
                    break;
                default:
                    throw new Error(`不支援的動作類型: ${action.type}`);
            }

            result.success = true;
        } catch (error) {
            result.error = String(error);
        } finally {
            result.timing.end = new Date();
            result.timing.duration = result.timing.end.getTime() - result.timing.start.getTime();
        }

        return result;
    }

    /**
     * 執行自動化腳本
     */
    async executeAutomation(automationId: string): Promise<AutomationResult> {
        const automation = this.automations.get(automationId);
        if (!automation) {
            throw new Error(`自動化腳本不存在: ${automationId}`);
        }

        const resultId = this.generateResultId();
        const startTime = new Date();
        const actionResults: ActionResult[] = [];
        let status: 'success' | 'failure' | 'partial' = 'success';
        let error: string | undefined;

        try {
            // 創建瀏覽器會話
            const sessionId = await this.createBrowserSession('about:blank', {
                title: `自動化: ${automation.name}`
            });

            // 執行動作序列
            for (const action of automation.actions) {
                try {
                    const result = await this.executeBrowserAction(sessionId, action);
                    actionResults.push(result);

                    if (!result.success) {
                        status = 'partial';
                        if (action.retries) {
                            // 重試邏輯
                            for (let i = 0; i < action.retries; i++) {
                                const retryResult = await this.executeBrowserAction(sessionId, action);
                                actionResults.push(retryResult);
                                if (retryResult.success) {
                                    break;
                                }
                            }
                        }
                    }
                } catch (actionError) {
                    status = 'failure';
                    error = String(actionError);
                    break;
                }
            }

            // 關閉會話
            await this.closeBrowserSession(sessionId);

        } catch (automationError) {
            status = 'failure';
            error = String(automationError);
        }

        const endTime = new Date();
        const result: AutomationResult = {
            id: resultId,
            automationId,
            startTime,
            endTime,
            status,
            actionResults,
            error,
            summary: this.generateAutomationSummary(actionResults, status)
        };

        automation.results.push(result);
        automation.lastRun = endTime;

        return result;
    }

    /**
     * 網頁抓取
     */
    async scrapeWebsite(config: WebScrapingConfig): Promise<any[]> {
        const results: any[] = [];

        try {
            const sessionId = await this.createBrowserSession(config.url, {
                title: `抓取: ${config.url}`
            });

            let currentPage = 1;
            let hasNextPage = true;

            while (hasNextPage && (!config.pagination || currentPage <= config.pagination.maxPages)) {
                // 等待頁面載入
                await this.executeBrowserAction(sessionId, {
                    id: 'wait-load',
                    type: 'wait',
                    description: '等待頁面載入',
                    parameters: { condition: 'domcontentloaded', timeout: 10000 }
                });

                // 提取數據
                const extractResult = await this.executeBrowserAction(sessionId, {
                    id: 'extract-data',
                    type: 'extract',
                    description: '提取頁面數據',
                    parameters: { selectors: config.selectors }
                });

                if (extractResult.success && extractResult.data) {
                    let pageData = Array.isArray(extractResult.data) ? extractResult.data : [extractResult.data];

                    // 應用過濾器
                    if (config.filters) {
                        pageData = this.applyFilters(pageData, config.filters);
                    }

                    results.push(...pageData);
                }

                // 檢查是否有下一頁
                if (config.pagination) {
                    const paginationConfig = config.pagination;
                    try {
                        await this.executeBrowserAction(sessionId, {
                            id: 'next-page',
                            type: 'click',
                            description: '點擊下一頁',
                            parameters: { selector: paginationConfig.nextSelector }
                        });

                        // 等待頁面載入
                        await new Promise(resolve => setTimeout(resolve, paginationConfig.waitTime));
                        currentPage++;
                    } catch {
                        hasNextPage = false;
                    }
                } else {
                    hasNextPage = false;
                }
            }

            await this.closeBrowserSession(sessionId);

            // 輸出結果
            await this.outputScrapingResults(results, config.output);

        } catch (error) {
            throw new Error(`網頁抓取失敗: ${error}`);
        }

        return results;
    }

    /**
     * 執行具體動作
     */
    private async executeNavigate(session: BrowserSession, action: BrowserAction): Promise<any> {
        const url = action.parameters.url;
        session.url = url;
        session.history.push(url);

        return new Promise((resolve, reject) => {
            session.webview.postMessage({
                command: 'navigate',
                url: url
            });

            const timeout = setTimeout(() => {
                reject(new Error('導航超時'));
            }, action.timeout || 30000);

            const messageHandler = (message: any) => {
                if (message.command === 'navigationComplete') {
                    clearTimeout(timeout);
                    session.webview.onDidReceiveMessage(messageHandler);
                    resolve({ url: message.url, title: message.title });
                }
            };

            session.webview.onDidReceiveMessage(messageHandler);
        });
    }

    private async executeClick(session: BrowserSession, action: BrowserAction): Promise<any> {
        return new Promise((resolve, reject) => {
            session.webview.postMessage({
                command: 'click',
                selector: action.parameters.selector,
                coordinates: action.parameters.coordinates
            });

            const timeout = setTimeout(() => {
                reject(new Error('點擊超時'));
            }, action.timeout || 5000);

            const messageHandler = (message: any) => {
                if (message.command === 'clickComplete') {
                    clearTimeout(timeout);
                    resolve({ success: message.success, element: message.element });
                }
            };

            session.webview.onDidReceiveMessage(messageHandler);
        });
    }

    private async executeType(session: BrowserSession, action: BrowserAction): Promise<any> {
        return new Promise((resolve, reject) => {
            session.webview.postMessage({
                command: 'type',
                selector: action.parameters.selector,
                text: action.parameters.text,
                clear: action.parameters.clear
            });

            const timeout = setTimeout(() => {
                reject(new Error('輸入超時'));
            }, action.timeout || 5000);

            const messageHandler = (message: any) => {
                if (message.command === 'typeComplete') {
                    clearTimeout(timeout);
                    resolve({ success: message.success, text: message.text });
                }
            };

            session.webview.onDidReceiveMessage(messageHandler);
        });
    }

    private async executeScroll(session: BrowserSession, action: BrowserAction): Promise<any> {
        return new Promise((resolve) => {
            session.webview.postMessage({
                command: 'scroll',
                direction: action.parameters.direction,
                amount: action.parameters.amount,
                selector: action.parameters.selector
            });

            setTimeout(() => {
                resolve({ success: true });
            }, 1000);
        });
    }

    private async executeWait(session: BrowserSession, action: BrowserAction): Promise<any> {
        const waitTime = action.parameters.time || 1000;
        const condition = action.parameters.condition;

        if (condition) {
            return new Promise((resolve, reject) => {
                session.webview.postMessage({
                    command: 'waitForCondition',
                    condition: condition,
                    timeout: action.timeout || 10000
                });

                const messageHandler = (message: any) => {
                    if (message.command === 'conditionMet') {
                        resolve({ success: true, condition: condition });
                    }
                };

                session.webview.onDidReceiveMessage(messageHandler);

                setTimeout(() => {
                    reject(new Error('等待條件超時'));
                }, action.timeout || 10000);
            });
        } else {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return { success: true, waitTime };
        }
    }

    private async executeExtract(session: BrowserSession, action: BrowserAction): Promise<any> {
        return new Promise((resolve, reject) => {
            session.webview.postMessage({
                command: 'extract',
                selectors: action.parameters.selectors,
                multiple: action.parameters.multiple
            });

            const timeout = setTimeout(() => {
                reject(new Error('提取數據超時'));
            }, action.timeout || 10000);

            const messageHandler = (message: any) => {
                if (message.command === 'extractComplete') {
                    clearTimeout(timeout);
                    resolve(message.data);
                }
            };

            session.webview.onDidReceiveMessage(messageHandler);
        });
    }

    private async executeScreenshot(session: BrowserSession, action: BrowserAction): Promise<any> {
        // 簡化實作 - 實際需要更複雜的截圖邏輯
        return { success: true, screenshot: 'base64-encoded-image-data' };
    }

    private async executeEvaluate(session: BrowserSession, action: BrowserAction): Promise<any> {
        return new Promise((resolve, reject) => {
            session.webview.postMessage({
                command: 'evaluate',
                script: action.parameters.script
            });

            const timeout = setTimeout(() => {
                reject(new Error('腳本執行超時'));
            }, action.timeout || 10000);

            const messageHandler = (message: any) => {
                if (message.command === 'evaluateComplete') {
                    clearTimeout(timeout);
                    resolve(message.result);
                }
            };

            session.webview.onDidReceiveMessage(messageHandler);
        });
    }

    /**
     * 生成瀏覽器 HTML
     */
    private generateBrowserHTML(url: string, sessionId: string): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>瀏覽器</title>
            <style>
                body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                .browser-header { background: #f0f0f0; padding: 10px; border-bottom: 1px solid #ccc; }
                .url-bar { width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 3px; }
                .browser-content { height: calc(100vh - 60px); }
                iframe { width: 100%; height: 100%; border: none; }
                .loading { text-align: center; padding: 50px; }
            </style>
        </head>
        <body>
            <div class="browser-header">
                <input type="text" class="url-bar" value="${url}" id="urlBar" />
                <button onclick="navigate()">前往</button>
                <button onclick="goBack()">後退</button>
                <button onclick="goForward()">前進</button>
                <button onclick="refresh()">刷新</button>
            </div>
            <div class="browser-content">
                <div class="loading" id="loading">載入中...</div>
                <iframe id="contentFrame" style="display: none;"></iframe>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentUrl = '${url}';

                function navigate(url) {
                    const targetUrl = url || document.getElementById('urlBar').value;
                    currentUrl = targetUrl;
                    document.getElementById('loading').style.display = 'block';
                    document.getElementById('contentFrame').style.display = 'none';

                    // 模擬導航
                    setTimeout(() => {
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('contentFrame').style.display = 'block';
                        document.getElementById('contentFrame').src = targetUrl;

                        vscode.postMessage({
                            command: 'navigationComplete',
                            url: targetUrl,
                            title: document.title
                        });
                    }, 1000);
                }

                function goBack() {
                    history.back();
                }

                function goForward() {
                    history.forward();
                }

                function refresh() {
                    navigate(currentUrl);
                }

                // 處理來自擴展的消息
                window.addEventListener('message', event => {
                    const message = event.data;

                    switch (message.command) {
                        case 'navigate':
                            navigate(message.url);
                            break;
                        case 'click':
                            simulateClick(message.selector, message.coordinates);
                            break;
                        case 'type':
                            simulateType(message.selector, message.text, message.clear);
                            break;
                        case 'extract':
                            extractData(message.selectors, message.multiple);
                            break;
                        case 'evaluate':
                            evaluateScript(message.script);
                            break;
                    }
                });

                function simulateClick(selector, coordinates) {
                    // 模擬點擊實作
                    vscode.postMessage({
                        command: 'clickComplete',
                        success: true,
                        element: selector
                    });
                }

                function simulateType(selector, text, clear) {
                    // 模擬輸入實作
                    vscode.postMessage({
                        command: 'typeComplete',
                        success: true,
                        text: text
                    });
                }

                function extractData(selectors, multiple) {
                    // 模擬數據提取
                    const data = {};
                    for (const [key, selector] of Object.entries(selectors)) {
                        data[key] = 'extracted-data-' + key;
                    }

                    vscode.postMessage({
                        command: 'extractComplete',
                        data: data
                    });
                }

                function evaluateScript(script) {
                    try {
                        const result = eval(script);
                        vscode.postMessage({
                            command: 'evaluateComplete',
                            result: result
                        });
                    } catch (error) {
                        vscode.postMessage({
                            command: 'evaluateComplete',
                            error: error.message
                        });
                    }
                }

                // 初始導航
                if ('${url}' !== 'about:blank') {
                    navigate('${url}');
                }
            </script>
        </body>
        </html>
        `;
    }

    // 輔助方法
    private handleWebviewMessage(sessionId: string, message: any): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        switch (message.command) {
            case 'navigationComplete':
                session.status = 'active';
                session.url = message.url;
                session.title = message.title;
                break;
            case 'error':
                session.status = 'error';
                break;
        }
    }

    private async closeBrowserSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = 'closed';
            session.panel.dispose();
            this.sessions.delete(sessionId);
        }
    }

    private applyFilters(data: any[], filters: FilterConfig[]): any[] {
        return data.filter(item => {
            return filters.every(filter => {
                const value = item[filter.field];
                switch (filter.operator) {
                    case 'equals':
                        return value === filter.value;
                    case 'contains':
                        return String(value).includes(String(filter.value));
                    case 'regex':
                        return new RegExp(filter.value).test(String(value));
                    case 'greater':
                        return Number(value) > Number(filter.value);
                    case 'less':
                        return Number(value) < Number(filter.value);
                    default:
                        return true;
                }
            });
        });
    }

    private async outputScrapingResults(results: any[], config: OutputConfig): Promise<void> {
        let output: string;

        switch (config.format) {
            case 'json':
                output = JSON.stringify(results, null, 2);
                break;
            case 'csv':
                output = this.convertToCSV(results);
                break;
            case 'xml':
                output = this.convertToXML(results);
                break;
            default:
                output = JSON.stringify(results, null, 2);
        }

        if (config.file) {
            const uri = vscode.Uri.file(config.file);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(output, 'utf8'));
        }

        if (config.webhook) {
            // 發送到 webhook
        }
    }

    private convertToCSV(data: any[]): string {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const rows = [headers.join(',')];

        for (const item of data) {
            const row = headers.map(header => {
                const value = item[header];
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
            });
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }

    private convertToXML(data: any[]): string {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';

        for (const item of data) {
            xml += '  <item>\n';
            for (const [key, value] of Object.entries(item)) {
                xml += `    <${key}>${value}</${key}>\n`;
            }
            xml += '  </item>\n';
        }

        xml += '</data>';
        return xml;
    }

    private generateAutomationSummary(results: ActionResult[], status: string): string {
        const total = results.length;
        const successful = results.filter(r => r.success).length;
        const failed = total - successful;

        return `執行了 ${total} 個動作，成功 ${successful} 個，失敗 ${failed} 個。狀態: ${status}`;
    }

    private generateSessionId(): string {
        return 'browser_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    private generateResultId(): string {
        return 'result_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    private loadConfigurations(): void {
        // 載入配置
    }

    private saveConfigurations(): void {
        // 保存配置
    }

    /**
     * 獲取活躍會話
     */
    getActiveSessions(): BrowserSession[] {
        return Array.from(this.sessions.values()).filter(s => s.status === 'active');
    }

    /**
     * 創建自動化腳本
     */
    createAutomation(automation: Omit<BrowserAutomation, 'id' | 'results'>): string {
        const id = this.generateSessionId();
        const fullAutomation: BrowserAutomation = {
            ...automation,
            id,
            results: []
        };

        this.automations.set(id, fullAutomation);
        return id;
    }

    /**
     * 清理資源
     */
    dispose(): void {
        for (const session of this.sessions.values()) {
            session.panel.dispose();
        }
        this.sessions.clear();
    }
}
