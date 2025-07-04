import * as vscode from 'vscode';
import { VSCodeAPIManager } from '../api/VSCodeAPIManager';
import { DatabaseManager } from '../storage/DatabaseManager';

export class APICommands {
    private apiManager: VSCodeAPIManager;

    constructor(private context: vscode.ExtensionContext, dbManager: DatabaseManager) {
        this.apiManager = new VSCodeAPIManager(dbManager, {
            enableAutoUpdate: false, // 預設關閉自動更新
            notificationLevel: 'important'
        });

        this.registerCommands();
        this.setupEventListeners();
    }

    /**
     * 註冊所有 API 相關命令
     */
    private registerCommands(): void {
        const commands = [
            // 主要掃描命令
            vscode.commands.registerCommand('devika.scanVSCodeAPI', () => this.scanVSCodeAPI()),
            vscode.commands.registerCommand('devika.checkAPIUpdates', () => this.checkAPIUpdates()),
            vscode.commands.registerCommand('devika.generateUpdatePlan', () => this.generateUpdatePlan()),

            // API 查詢命令
            vscode.commands.registerCommand('devika.searchAPI', () => this.searchAPI()),
            vscode.commands.registerCommand('devika.showAPICoverage', () => this.showAPICoverage()),
            vscode.commands.registerCommand('devika.showAPIDetails', (apiId?: string) => this.showAPIDetails(apiId)),

            // 配置命令
            vscode.commands.registerCommand('devika.configureAPIScanning', () => this.configureAPIScanning()),
            vscode.commands.registerCommand('devika.enableAutoScan', () => this.enableAutoScan()),
            vscode.commands.registerCommand('devika.disableAutoScan', () => this.disableAutoScan()),

            // 報告命令
            vscode.commands.registerCommand('devika.exportAPIReport', () => this.exportAPIReport()),
            vscode.commands.registerCommand('devika.showUnusedAPIs', () => this.showUnusedAPIs()),
            vscode.commands.registerCommand('devika.showDeprecatedAPIs', () => this.showDeprecatedAPIs())
        ];

        this.context.subscriptions.push(...commands);
    }

    /**
     * 設置事件監聽器
     */
    private setupEventListeners(): void {
        // 監聽掃描完成事件
        this.apiManager.onScanComplete(result => {
            if (result.success) {
                console.log(`API 掃描完成，耗時 ${result.duration}ms`);
            } else {
                console.error(`API 掃描失敗: ${result.error}`);
            }
        });
    }

    /**
     * 掃描 VS Code API
     */
    async scanVSCodeAPI(): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "掃描 VS Code API",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "正在爬取 API 文檔..." });

                const result = await this.apiManager.performFullScan();

                if (result.success) {
                    progress.report({ increment: 100, message: "掃描完成！" });

                    const action = await vscode.window.showInformationMessage(
                        `API 掃描完成！發現 ${result.crawlResult?.totalAPIs} 個 API`,
                        '查看更新計畫',
                        '查看覆蓋率報告'
                    );

                    if (action === '查看更新計畫' && result.updatePlanPath) {
                        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(result.updatePlanPath));
                    } else if (action === '查看覆蓋率報告') {
                        await this.showAPICoverage();
                    }
                } else {
                    vscode.window.showErrorMessage(`掃描失敗: ${result.error}`);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`掃描失敗: ${error}`);
        }
    }

    /**
     * 檢查 API 更新
     */
    async checkAPIUpdates(): Promise<void> {
        try {
            const updates = await this.apiManager.checkForUpdates();

            if (updates.hasUpdates) {
                const message = `發現 API 更新！新增: ${updates.newAPIs}, 更新: ${updates.updatedAPIs}, 已棄用: ${updates.deprecatedAPIs}`;
                const action = await vscode.window.showInformationMessage(
                    message,
                    '執行完整掃描',
                    '稍後提醒'
                );

                if (action === '執行完整掃描') {
                    await this.scanVSCodeAPI();
                }
            } else {
                const lastScan = updates.lastScanDate
                    ? `上次掃描: ${updates.lastScanDate.toLocaleString()}`
                    : '尚未進行過掃描';

                vscode.window.showInformationMessage(`沒有發現 API 更新。${lastScan}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`檢查更新失敗: ${error}`);
        }
    }

    /**
     * 生成更新計畫
     */
    async generateUpdatePlan(): Promise<void> {
        const action = await vscode.window.showInformationMessage(
            '生成更新計畫需要先掃描最新的 API。是否繼續？',
            '是',
            '否'
        );

        if (action === '是') {
            await this.scanVSCodeAPI();
        }
    }

    /**
     * 搜索 API
     */
    async searchAPI(): Promise<void> {
        const query = await vscode.window.showInputBox({
            prompt: '輸入要搜索的 API 名稱或關鍵字',
            placeHolder: '例如: window, workspace, commands'
        });

        if (!query) {
            return;
        }

        try {
            const results = await this.apiManager.searchAPIs(query);

            if (results.length === 0) {
                vscode.window.showInformationMessage(`沒有找到匹配 "${query}" 的 API`);
                return;
            }

            // 創建快速選擇列表
            const quickPickItems = results.map(api => ({
                label: `${api.namespace}.${api.name}`,
                description: api.type,
                detail: api.description,
                api: api
            }));

            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `找到 ${results.length} 個匹配的 API`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                // 顯示 API 詳細信息
                await this.showAPIInfo(selected.api);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`搜索失敗: ${error}`);
        }
    }

    /**
     * 顯示 API 覆蓋率
     */
    async showAPICoverage(): Promise<void> {
        try {
            const report = await this.apiManager.getAPICoverageReport();

            // 創建 Webview 顯示覆蓋率報告
            const panel = vscode.window.createWebviewPanel(
                'apiCoverage',
                'API 覆蓋率報告',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            panel.webview.html = this.generateCoverageReportHTML(report);
        } catch (error) {
            vscode.window.showErrorMessage(`獲取覆蓋率報告失敗: ${error}`);
        }
    }

    /**
     * 顯示 API 詳細信息
     */
    async showAPIDetails(apiId?: string): Promise<void> {
        if (!apiId) {
            vscode.window.showErrorMessage('請提供 API ID');
            return;
        }

        try {
            const details = await this.apiManager.getAPIDetails(apiId);

            if (!details) {
                vscode.window.showErrorMessage('找不到指定的 API');
                return;
            }

            // 創建 Webview 顯示詳細信息
            const panel = vscode.window.createWebviewPanel(
                'apiDetails',
                `API 詳情: ${details.endpoint.name}`,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            panel.webview.html = this.generateAPIDetailsHTML(details);
        } catch (error) {
            vscode.window.showErrorMessage(`獲取 API 詳情失敗: ${error}`);
        }
    }

    /**
     * 配置 API 掃描
     */
    async configureAPIScanning(): Promise<void> {
        const options = [
            { label: '啟用自動掃描', description: '每24小時自動掃描一次' },
            { label: '設置掃描間隔', description: '自定義自動掃描間隔' },
            { label: '設置通知級別', description: '配置掃描結果通知' },
            { label: '設置輸出目錄', description: '配置更新計畫文件輸出位置' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '選擇要配置的選項'
        });

        if (!selected) {
            return;
        }

        switch (selected.label) {
            case '啟用自動掃描':
                await this.enableAutoScan();
                break;
            case '設置掃描間隔':
                await this.configureScanInterval();
                break;
            case '設置通知級別':
                await this.configureNotificationLevel();
                break;
            case '設置輸出目錄':
                await this.configureOutputDirectory();
                break;
        }
    }

    /**
     * 啟用自動掃描
     */
    async enableAutoScan(): Promise<void> {
        this.apiManager.updateConfig({ enableAutoUpdate: true });
        vscode.window.showInformationMessage('自動掃描已啟用');
    }

    /**
     * 停用自動掃描
     */
    async disableAutoScan(): Promise<void> {
        this.apiManager.updateConfig({ enableAutoUpdate: false });
        vscode.window.showInformationMessage('自動掃描已停用');
    }

    /**
     * 配置掃描間隔
     */
    private async configureScanInterval(): Promise<void> {
        const input = await vscode.window.showInputBox({
            prompt: '輸入掃描間隔（小時）',
            value: '24',
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1) {
                    return '請輸入有效的小時數（大於0）';
                }
                return undefined;
            }
        });

        if (input) {
            const hours = parseInt(input);
            this.apiManager.updateConfig({ autoScanInterval: hours });
            vscode.window.showInformationMessage(`掃描間隔已設置為 ${hours} 小時`);
        }
    }

    /**
     * 配置通知級別
     */
    private async configureNotificationLevel(): Promise<void> {
        const levels = [
            { label: '全部', description: '顯示所有掃描結果通知', value: 'all' },
            { label: '重要', description: '只顯示重要變更通知', value: 'important' },
            { label: '無', description: '不顯示通知', value: 'none' }
        ];

        const selected = await vscode.window.showQuickPick(levels, {
            placeHolder: '選擇通知級別'
        });

        if (selected) {
            this.apiManager.updateConfig({ notificationLevel: selected.value as any });
            vscode.window.showInformationMessage(`通知級別已設置為: ${selected.label}`);
        }
    }

    /**
     * 配置輸出目錄
     */
    private async configureOutputDirectory(): Promise<void> {
        const folders = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: '選擇輸出目錄'
        });

        if (folders && folders.length > 0) {
            const outputDir = folders[0].fsPath;
            this.apiManager.updateConfig({ outputDirectory: outputDir });
            vscode.window.showInformationMessage(`輸出目錄已設置為: ${outputDir}`);
        }
    }

    /**
     * 顯示 API 信息
     */
    private async showAPIInfo(api: any): Promise<void> {
        const message = `
**${api.namespace}.${api.name}**

類型: ${api.type}
狀態: ${api.isUsed ? '已使用' : '未使用'}${api.isDeprecated ? ' (已棄用)' : ''}

${api.description}
        `;

        const actions = ['查看詳情'];
        if (api.url) {
            actions.push('查看文檔');
        }

        const action = await vscode.window.showInformationMessage(message, ...actions);

        if (action === '查看文檔' && api.url) {
            vscode.env.openExternal(vscode.Uri.parse(api.url));
        }
    }

    /**
     * 生成覆蓋率報告 HTML
     */
    private generateCoverageReportHTML(report: any): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>API 覆蓋率報告</title>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                .metric { margin: 10px 0; padding: 10px; border-left: 3px solid var(--vscode-accent-color); }
                .progress-bar { width: 100%; height: 20px; background: var(--vscode-editor-background); border-radius: 10px; overflow: hidden; }
                .progress-fill { height: 100%; background: var(--vscode-charts-green); transition: width 0.3s; }
                .api-list { margin: 10px 0; }
                .api-item { padding: 5px; margin: 2px 0; background: var(--vscode-editor-background); border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>API 覆蓋率報告</h1>
            
            <div class="metric">
                <h3>總體覆蓋率: ${report.coveragePercentage.toFixed(1)}%</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${report.coveragePercentage}%"></div>
                </div>
                <p>已使用 ${report.usedAPIs} / ${report.totalAPIs} 個 API</p>
            </div>

            <div class="metric">
                <h3>最常用的 API</h3>
                <div class="api-list">
                    ${report.mostUsedAPIs.map((api: any) =>
                        `<div class="api-item">${api.namespace}.${api.name} (使用 ${api.usage_count} 次)</div>`
                    ).join('')}
                </div>
            </div>

            ${report.deprecatedAPIsInUse.length > 0 ? `
            <div class="metric">
                <h3>⚠️ 使用中的已棄用 API</h3>
                <div class="api-list">
                    ${report.deprecatedAPIsInUse.map((api: any) =>
                        `<div class="api-item">${api.namespace}.${api.name} (使用 ${api.usage_count} 次)</div>`
                    ).join('')}
                </div>
            </div>
            ` : ''}

            <div class="metric">
                <h3>建議</h3>
                <ul>
                    ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * 生成 API 詳情 HTML
     */
    private generateAPIDetailsHTML(details: any): string {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>API 詳情</title>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                .section { margin: 20px 0; }
                .parameter { margin: 5px 0; padding: 5px; background: var(--vscode-editor-background); }
                .example { margin: 10px 0; padding: 10px; background: var(--vscode-editor-background); border-radius: 5px; }
                code { background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>${details.namespace.name}.${details.endpoint.name}</h1>
            
            <div class="section">
                <h3>基本信息</h3>
                <p><strong>類型:</strong> ${details.endpoint.type}</p>
                <p><strong>描述:</strong> ${details.endpoint.description}</p>
                ${details.endpoint.signature ? `<p><strong>簽名:</strong> <code>${details.endpoint.signature}</code></p>` : ''}
                ${details.endpoint.return_type ? `<p><strong>返回類型:</strong> <code>${details.endpoint.return_type}</code></p>` : ''}
            </div>

            ${details.parameters.length > 0 ? `
            <div class="section">
                <h3>參數</h3>
                ${details.parameters.map((param: any) => `
                    <div class="parameter">
                        <strong>${param.name}</strong> (${param.type})${param.optional ? ' - 可選' : ''}
                        <br>${param.description}
                    </div>
                `).join('')}
            </div>
            ` : ''}

            ${details.examples.length > 0 ? `
            <div class="section">
                <h3>範例</h3>
                ${details.examples.map((example: string) => `
                    <div class="example">
                        <pre><code>${example}</code></pre>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            ${details.usageLocations.length > 0 ? `
            <div class="section">
                <h3>使用位置</h3>
                ${details.usageLocations.map((usage: any) => `
                    <div class="parameter">
                        <strong>${usage.file}:${usage.line}</strong>
                        <br><code>${usage.context}</code>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </body>
        </html>
        `;
    }

    /**
     * 導出 API 報告
     */
    async exportAPIReport(): Promise<void> {
        // 實作導出功能
        vscode.window.showInformationMessage('導出功能開發中...');
    }

    /**
     * 顯示未使用的 API
     */
    async showUnusedAPIs(): Promise<void> {
        // 實作顯示未使用 API 功能
        vscode.window.showInformationMessage('未使用 API 列表功能開發中...');
    }

    /**
     * 顯示已棄用的 API
     */
    async showDeprecatedAPIs(): Promise<void> {
        // 實作顯示已棄用 API 功能
        vscode.window.showInformationMessage('已棄用 API 列表功能開發中...');
    }

    /**
     * 清理資源
     */
    dispose(): void {
        this.apiManager.dispose();
    }
}
