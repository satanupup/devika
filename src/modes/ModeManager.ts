import * as vscode from 'vscode';

export interface AIMode {
    id: string;
    name: string;
    description: string;
    icon: string;
    systemPrompt: string;
    allowedTools: string[];
    autoApprove: boolean;
    temperature: number;
    maxTokens: number;
    customInstructions?: string;
    examples?: string[];
    shortcuts?: { [key: string]: string };
}

export interface CustomMode extends AIMode {
    isCustom: true;
    createdBy: string;
    createdAt: Date;
    tags: string[];
}

export class ModeManager {
    private modes: Map<string, AIMode> = new Map();
    private currentMode: AIMode;
    private customModes: Map<string, CustomMode> = new Map();

    private onModeChangedEmitter = new vscode.EventEmitter<AIMode>();
    public readonly onModeChanged = this.onModeChangedEmitter.event;

    constructor(private context: vscode.ExtensionContext) {
        this.registerBuiltinModes();
        this.loadCustomModes();
        this.currentMode = this.modes.get('code')!;
    }

    /**
     * 註冊內建模式
     */
    private registerBuiltinModes(): void {
        // 代碼模式
        this.registerMode({
            id: 'code',
            name: '代碼模式',
            description: '專門用於代碼生成、編輯和重構的模式',
            icon: '$(code)',
            systemPrompt: `你是一個專業的程式設計助手。你的主要職責是：

1. 根據用戶需求生成高質量的代碼
2. 幫助重構和優化現有代碼
3. 解釋代碼邏輯和最佳實踐
4. 提供代碼審查和改進建議
5. 協助調試和修復錯誤

請始終：
- 遵循最佳實踐和編碼標準
- 提供清晰的註釋和文檔
- 考慮性能和可維護性
- 使用適當的設計模式
- 確保代碼的安全性

當需要修改文件時，請使用 write_to_file 工具。
當需要分析代碼結構時，請使用 list_code_definition_names 工具。
當需要搜索相關代碼時，請使用 search_files 工具。`,
            allowedTools: [
                'read_file', 'write_to_file', 'list_files', 'search_files',
                'list_code_definition_names', 'apply_diff', 'execute_command'
            ],
            autoApprove: false,
            temperature: 0.3,
            maxTokens: 4000
        });

        // 架構師模式
        this.registerMode({
            id: 'architect',
            name: '架構師模式',
            description: '專門用於系統設計、架構規劃和技術決策的模式',
            icon: '$(organization)',
            systemPrompt: `你是一個資深的軟體架構師。你的主要職責是：

1. 設計系統架構和技術方案
2. 評估技術選型和架構決策
3. 規劃項目結構和模組劃分
4. 提供擴展性和可維護性建議
5. 制定開發標準和最佳實踐

請始終：
- 考慮系統的可擴展性和性能
- 評估技術債務和風險
- 提供清晰的架構圖和文檔
- 考慮團隊技能和項目約束
- 關注安全性和合規性

當需要創建文檔時，請使用 write_to_file 工具。
當需要分析現有架構時，請使用 list_files 和 search_files 工具。
當需要與用戶討論方案時，請使用 ask_followup_question 工具。`,
            allowedTools: [
                'read_file', 'write_to_file', 'list_files', 'search_files',
                'ask_followup_question', 'new_task'
            ],
            autoApprove: false,
            temperature: 0.5,
            maxTokens: 6000
        });

        // 提問模式
        this.registerMode({
            id: 'ask',
            name: '提問模式',
            description: '專門用於回答問題和提供信息的模式',
            icon: '$(question)',
            systemPrompt: `你是一個知識淵博的技術顧問。你的主要職責是：

1. 回答用戶的技術問題
2. 提供清晰詳細的解釋
3. 分享最佳實踐和經驗
4. 推薦相關資源和工具
5. 幫助用戶理解複雜概念

請始終：
- 提供準確和最新的信息
- 使用清晰易懂的語言
- 提供具體的例子和示例
- 承認不確定性並建議進一步研究
- 鼓勵深入學習和探索

當需要查看代碼來回答問題時，請使用 read_file 工具。
當需要搜索相關信息時，請使用 search_files 工具。
當需要澄清問題時，請使用 ask_followup_question 工具。`,
            allowedTools: [
                'read_file', 'list_files', 'search_files',
                'ask_followup_question', 'list_code_definition_names'
            ],
            autoApprove: true,
            temperature: 0.7,
            maxTokens: 3000
        });

        // 調試模式
        this.registerMode({
            id: 'debug',
            name: '調試模式',
            description: '專門用於問題診斷和系統調試的模式',
            icon: '$(debug)',
            systemPrompt: `你是一個專業的調試專家。你的主要職責是：

1. 診斷和分析系統問題
2. 識別錯誤的根本原因
3. 提供修復方案和建議
4. 協助性能分析和優化
5. 幫助設置調試環境

請始終：
- 系統性地分析問題
- 收集足夠的診斷信息
- 提供具體的修復步驟
- 考慮問題的影響範圍
- 建議預防措施

當需要查看錯誤日誌時，請使用 read_file 工具。
當需要執行診斷命令時，請使用 execute_command 工具。
當需要搜索相關問題時，請使用 search_files 工具。
當需要了解更多細節時，請使用 ask_followup_question 工具。`,
            allowedTools: [
                'read_file', 'list_files', 'search_files', 'execute_command',
                'list_code_definition_names', 'ask_followup_question'
            ],
            autoApprove: false,
            temperature: 0.2,
            maxTokens: 4000
        });

        // 文檔模式
        this.registerMode({
            id: 'documentation',
            name: '文檔模式',
            description: '專門用於編寫和維護技術文檔的模式',
            icon: '$(book)',
            systemPrompt: `你是一個專業的技術文檔編寫者。你的主要職責是：

1. 編寫清晰準確的技術文檔
2. 創建用戶指南和API文檔
3. 維護項目README和說明
4. 生成代碼註釋和文檔
5. 確保文檔的一致性和完整性

請始終：
- 使用清晰簡潔的語言
- 提供具體的例子和示例
- 保持文檔結構的一致性
- 考慮不同技能水平的讀者
- 及時更新過時的信息

當需要創建文檔時，請使用 write_to_file 工具。
當需要分析現有文檔時，請使用 read_file 和 search_files 工具。
當需要了解代碼結構時，請使用 list_code_definition_names 工具。`,
            allowedTools: [
                'read_file', 'write_to_file', 'list_files', 'search_files',
                'list_code_definition_names'
            ],
            autoApprove: false,
            temperature: 0.4,
            maxTokens: 5000
        });
    }

    /**
     * 註冊模式
     */
    registerMode(mode: AIMode): void {
        this.modes.set(mode.id, mode);
    }

    /**
     * 獲取模式
     */
    getMode(id: string): AIMode | undefined {
        return this.modes.get(id) || this.customModes.get(id);
    }

    /**
     * 獲取所有模式
     */
    getAllModes(): AIMode[] {
        return [
            ...Array.from(this.modes.values()),
            ...Array.from(this.customModes.values())
        ];
    }

    /**
     * 獲取當前模式
     */
    getCurrentMode(): AIMode {
        return this.currentMode;
    }

    /**
     * 切換模式
     */
    async switchMode(modeId: string): Promise<boolean> {
        const mode = this.getMode(modeId);
        if (!mode) {
            vscode.window.showErrorMessage(`模式 "${modeId}" 不存在`);
            return false;
        }

        const previousMode = this.currentMode;
        this.currentMode = mode;

        // 保存當前模式到設置
        await this.context.globalState.update('currentMode', modeId);

        // 觸發模式變更事件
        this.onModeChangedEmitter.fire(mode);

        vscode.window.showInformationMessage(
            `已切換到 ${mode.name} 模式`,
            '了解更多'
        ).then(selection => {
            if (selection === '了解更多') {
                this.showModeInfo(mode);
            }
        });

        return true;
    }

    /**
     * 創建自定義模式
     */
    async createCustomMode(): Promise<CustomMode | undefined> {
        // 獲取模式基本信息
        const name = await vscode.window.showInputBox({
            prompt: '輸入模式名稱',
            placeHolder: '例如：安全審計模式'
        });

        if (!name) return undefined;

        const description = await vscode.window.showInputBox({
            prompt: '輸入模式描述',
            placeHolder: '描述這個模式的用途和特點'
        });

        if (!description) return undefined;

        // 選擇基礎模式
        const baseModes = Array.from(this.modes.values());
        const selectedBase = await vscode.window.showQuickPick(
            baseModes.map(mode => ({
                label: mode.name,
                description: mode.description,
                mode
            })),
            { placeHolder: '選擇基礎模式' }
        );

        if (!selectedBase) return undefined;

        // 輸入自定義系統提示
        const systemPrompt = await vscode.window.showInputBox({
            prompt: '輸入自定義系統提示（可選）',
            placeHolder: '留空使用基礎模式的提示'
        });

        // 創建自定義模式
        const customMode: CustomMode = {
            ...selectedBase.mode,
            id: `custom_${Date.now()}`,
            name,
            description,
            systemPrompt: systemPrompt || selectedBase.mode.systemPrompt,
            isCustom: true,
            createdBy: 'user',
            createdAt: new Date(),
            tags: []
        };

        this.customModes.set(customMode.id, customMode);
        await this.saveCustomModes();

        vscode.window.showInformationMessage(`自定義模式 "${name}" 創建成功！`);
        return customMode;
    }

    /**
     * 編輯自定義模式
     */
    async editCustomMode(modeId: string): Promise<void> {
        const mode = this.customModes.get(modeId);
        if (!mode) {
            vscode.window.showErrorMessage('找不到指定的自定義模式');
            return;
        }

        const options = [
            { label: '編輯名稱', value: 'name' },
            { label: '編輯描述', value: 'description' },
            { label: '編輯系統提示', value: 'systemPrompt' },
            { label: '編輯允許的工具', value: 'tools' },
            { label: '編輯溫度設置', value: 'temperature' }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '選擇要編輯的屬性'
        });

        if (!selected) return;

        switch (selected.value) {
            case 'name':
                const newName = await vscode.window.showInputBox({
                    prompt: '輸入新的模式名稱',
                    value: mode.name
                });
                if (newName) mode.name = newName;
                break;

            case 'description':
                const newDescription = await vscode.window.showInputBox({
                    prompt: '輸入新的模式描述',
                    value: mode.description
                });
                if (newDescription) mode.description = newDescription;
                break;

            case 'systemPrompt':
                const newPrompt = await vscode.window.showInputBox({
                    prompt: '輸入新的系統提示',
                    value: mode.systemPrompt
                });
                if (newPrompt) mode.systemPrompt = newPrompt;
                break;

            case 'temperature':
                const newTemp = await vscode.window.showInputBox({
                    prompt: '輸入新的溫度值 (0.0-1.0)',
                    value: mode.temperature.toString(),
                    validateInput: (value) => {
                        const num = parseFloat(value);
                        if (isNaN(num) || num < 0 || num > 1) {
                            return '請輸入 0.0 到 1.0 之間的數值';
                        }
                        return undefined;
                    }
                });
                if (newTemp) mode.temperature = parseFloat(newTemp);
                break;
        }

        await this.saveCustomModes();
        vscode.window.showInformationMessage('自定義模式已更新');
    }

    /**
     * 刪除自定義模式
     */
    async deleteCustomMode(modeId: string): Promise<void> {
        const mode = this.customModes.get(modeId);
        if (!mode) {
            vscode.window.showErrorMessage('找不到指定的自定義模式');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `確定要刪除自定義模式 "${mode.name}" 嗎？`,
            { modal: true },
            '確定'
        );

        if (confirm === '確定') {
            this.customModes.delete(modeId);
            
            // 如果刪除的是當前模式，切換到默認模式
            if (this.currentMode.id === modeId) {
                await this.switchMode('code');
            }

            await this.saveCustomModes();
            vscode.window.showInformationMessage('自定義模式已刪除');
        }
    }

    /**
     * 顯示模式信息
     */
    private async showModeInfo(mode: AIMode): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'modeInfo',
            `模式信息: ${mode.name}`,
            vscode.ViewColumn.Beside,
            { enableScripts: false }
        );

        panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${mode.name}</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 20px; 
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .mode-header { 
                    border-bottom: 1px solid var(--vscode-panel-border); 
                    padding-bottom: 10px; 
                    margin-bottom: 20px; 
                }
                .mode-title { 
                    font-size: 24px; 
                    font-weight: bold; 
                    margin-bottom: 5px; 
                }
                .mode-description { 
                    color: var(--vscode-descriptionForeground); 
                    font-size: 14px; 
                }
                .section { 
                    margin: 20px 0; 
                }
                .section-title { 
                    font-size: 16px; 
                    font-weight: bold; 
                    margin-bottom: 10px; 
                }
                .tool-list { 
                    list-style: none; 
                    padding: 0; 
                }
                .tool-item { 
                    background: var(--vscode-editor-selectionBackground); 
                    padding: 5px 10px; 
                    margin: 2px 0; 
                    border-radius: 3px; 
                }
                .prompt-box { 
                    background: var(--vscode-textCodeBlock-background); 
                    padding: 15px; 
                    border-radius: 5px; 
                    white-space: pre-wrap; 
                    font-family: monospace; 
                    font-size: 12px; 
                }
            </style>
        </head>
        <body>
            <div class="mode-header">
                <div class="mode-title">${mode.icon} ${mode.name}</div>
                <div class="mode-description">${mode.description}</div>
            </div>

            <div class="section">
                <div class="section-title">配置</div>
                <p><strong>溫度:</strong> ${mode.temperature}</p>
                <p><strong>最大令牌:</strong> ${mode.maxTokens}</p>
                <p><strong>自動批准:</strong> ${mode.autoApprove ? '是' : '否'}</p>
            </div>

            <div class="section">
                <div class="section-title">允許的工具</div>
                <ul class="tool-list">
                    ${mode.allowedTools.map(tool => `<li class="tool-item">${tool}</li>`).join('')}
                </ul>
            </div>

            <div class="section">
                <div class="section-title">系統提示</div>
                <div class="prompt-box">${mode.systemPrompt}</div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * 保存自定義模式
     */
    private async saveCustomModes(): Promise<void> {
        const customModesData = Array.from(this.customModes.values());
        await this.context.globalState.update('customModes', customModesData);
    }

    /**
     * 載入自定義模式
     */
    private loadCustomModes(): void {
        const customModesData = this.context.globalState.get<CustomMode[]>('customModes', []);
        
        for (const mode of customModesData) {
            // 恢復日期對象
            mode.createdAt = new Date(mode.createdAt);
            this.customModes.set(mode.id, mode);
        }

        // 載入上次使用的模式
        const lastModeId = this.context.globalState.get<string>('currentMode', 'code');
        const lastMode = this.getMode(lastModeId);
        if (lastMode) {
            this.currentMode = lastMode;
        }
    }

    /**
     * 導出模式配置
     */
    async exportModes(): Promise<void> {
        const modes = {
            builtin: Array.from(this.modes.values()),
            custom: Array.from(this.customModes.values())
        };

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('devika-modes.json'),
            filters: {
                'JSON': ['json']
            }
        });

        if (uri) {
            const content = JSON.stringify(modes, null, 2);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            vscode.window.showInformationMessage(`模式配置已導出到 ${uri.fsPath}`);
        }
    }

    /**
     * 導入模式配置
     */
    async importModes(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'JSON': ['json']
            }
        });

        if (uris && uris.length > 0) {
            try {
                const content = await vscode.workspace.fs.readFile(uris[0]);
                const data = JSON.parse(new TextDecoder().decode(content));

                if (data.custom && Array.isArray(data.custom)) {
                    for (const mode of data.custom) {
                        mode.createdAt = new Date(mode.createdAt);
                        this.customModes.set(mode.id, mode);
                    }

                    await this.saveCustomModes();
                    vscode.window.showInformationMessage(`成功導入 ${data.custom.length} 個自定義模式`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`導入失敗: ${error}`);
            }
        }
    }

    /**
     * 清理資源
     */
    dispose(): void {
        this.onModeChangedEmitter.dispose();
    }
}
