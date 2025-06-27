import * as vscode from 'vscode';

export interface AIOperation {
    id: string;
    name: string;
    description: string;
    category: 'file' | 'editor' | 'workspace' | 'debug' | 'terminal' | 'ui' | 'extension';
    intent: string;
    parameters: OperationParameter[];
    requiredAPIs: string[];
    optionalAPIs: string[];
    securityLevel: 'safe' | 'moderate' | 'restricted' | 'dangerous';
    examples: string[];
    implementation?: string;
}

export interface OperationParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file' | 'directory';
    required: boolean;
    description: string;
    validation?: ParameterValidation;
    defaultValue?: any;
}

export interface ParameterValidation {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    allowedValues?: any[];
}

export interface APIMapping {
    operation: string;
    vsCodeAPI: string;
    mapping: ParameterMapping[];
    preConditions: string[];
    postActions: string[];
    errorHandling: ErrorHandling[];
    securityChecks: SecurityCheck[];
}

export interface ParameterMapping {
    operationParam: string;
    apiParam: string;
    transform?: string; // JavaScript transformation function
    validation?: string;
}

export interface ErrorHandling {
    errorType: string;
    action: 'retry' | 'fallback' | 'abort' | 'prompt';
    message: string;
    fallbackAPI?: string;
}

export interface SecurityCheck {
    type: 'permission' | 'path' | 'content' | 'rate_limit';
    condition: string;
    action: 'allow' | 'deny' | 'prompt';
    message: string;
}

export interface ExecutionContext {
    operation: AIOperation;
    parameters: { [key: string]: any };
    user: string;
    workspace: string;
    timestamp: Date;
    sessionId: string;
}

export interface ExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    warnings: string[];
    apisCalled: string[];
    executionTime: number;
    securityChecks: SecurityCheckResult[];
}

export interface SecurityCheckResult {
    check: SecurityCheck;
    passed: boolean;
    message?: string;
    userResponse?: 'allow' | 'deny';
}

export class AIOperationAPIMapping {
    private operations: Map<string, AIOperation> = new Map();
    private mappings: Map<string, APIMapping[]> = new Map();
    private executionHistory: ExecutionContext[] = [];
    private securityPolicy: SecurityPolicy;

    constructor(private context: vscode.ExtensionContext) {
        this.securityPolicy = this.loadSecurityPolicy();
        this.initializeOperations();
        this.initializeMappings();
    }

    /**
     * 執行 AI 操作
     */
    async executeOperation(
        operationId: string,
        parameters: { [key: string]: any },
        context: Partial<ExecutionContext> = {}
    ): Promise<ExecutionResult> {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new Error(`操作不存在: ${operationId}`);
        }

        const executionContext: ExecutionContext = {
            operation,
            parameters,
            user: context.user || 'unknown',
            workspace: context.workspace || vscode.workspace.name || 'unknown',
            timestamp: new Date(),
            sessionId: context.sessionId || this.generateSessionId()
        };

        const startTime = Date.now();
        const result: ExecutionResult = {
            success: false,
            warnings: [],
            apisCalled: [],
            executionTime: 0,
            securityChecks: []
        };

        try {
            // 驗證參數
            this.validateParameters(operation, parameters);

            // 執行安全檢查
            const securityResults = await this.performSecurityChecks(executionContext);
            result.securityChecks = securityResults;

            // 檢查是否被安全策略阻止
            if (securityResults.some(check => !check.passed)) {
                throw new Error('操作被安全策略阻止');
            }

            // 獲取 API 映射
            const mappings = this.mappings.get(operationId) || [];
            if (mappings.length === 0) {
                throw new Error(`操作 ${operationId} 沒有 API 映射`);
            }

            // 執行 API 調用
            result.result = await this.executeAPIMappings(mappings, parameters, result);
            result.success = true;

            // 記錄執行歷史
            this.executionHistory.push(executionContext);

        } catch (error) {
            result.error = String(error);
            result.success = false;
        } finally {
            result.executionTime = Date.now() - startTime;
        }

        return result;
    }

    /**
     * 註冊新操作
     */
    registerOperation(operation: AIOperation): void {
        this.operations.set(operation.id, operation);
    }

    /**
     * 註冊 API 映射
     */
    registerAPIMapping(operationId: string, mapping: APIMapping): void {
        if (!this.mappings.has(operationId)) {
            this.mappings.set(operationId, []);
        }
        this.mappings.get(operationId)!.push(mapping);
    }

    /**
     * 獲取可用操作
     */
    getAvailableOperations(category?: string): AIOperation[] {
        const operations = Array.from(this.operations.values());
        return category ? operations.filter(op => op.category === category) : operations;
    }

    /**
     * 搜索操作
     */
    searchOperations(query: string): AIOperation[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.operations.values()).filter(op =>
            op.name.toLowerCase().includes(lowerQuery) ||
            op.description.toLowerCase().includes(lowerQuery) ||
            op.intent.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * 初始化操作
     */
    private initializeOperations(): void {
        // 文件操作
        this.operations.set('create-file', {
            id: 'create-file',
            name: '創建文件',
            description: '在指定路徑創建新文件',
            category: 'file',
            intent: '創建新文件',
            parameters: [
                {
                    name: 'path',
                    type: 'string',
                    required: true,
                    description: '文件路徑',
                    validation: { pattern: '^[^<>:"|?*]+$' }
                },
                {
                    name: 'content',
                    type: 'string',
                    required: false,
                    description: '文件內容',
                    defaultValue: ''
                }
            ],
            requiredAPIs: ['workspace.fs.writeFile'],
            optionalAPIs: ['window.showTextDocument'],
            securityLevel: 'moderate',
            examples: ['創建一個名為 test.txt 的文件']
        });

        this.operations.set('open-file', {
            id: 'open-file',
            name: '打開文件',
            description: '在編輯器中打開指定文件',
            category: 'editor',
            intent: '打開文件進行編輯',
            parameters: [
                {
                    name: 'path',
                    type: 'string',
                    required: true,
                    description: '文件路徑'
                },
                {
                    name: 'viewColumn',
                    type: 'number',
                    required: false,
                    description: '編輯器列',
                    defaultValue: 1
                }
            ],
            requiredAPIs: ['window.showTextDocument'],
            optionalAPIs: ['workspace.openTextDocument'],
            securityLevel: 'safe',
            examples: ['打開 README.md 文件']
        });

        this.operations.set('run-command', {
            id: 'run-command',
            name: '執行命令',
            description: '執行 VS Code 命令',
            category: 'workspace',
            intent: '執行特定的 VS Code 命令',
            parameters: [
                {
                    name: 'command',
                    type: 'string',
                    required: true,
                    description: '命令 ID'
                },
                {
                    name: 'args',
                    type: 'array',
                    required: false,
                    description: '命令參數',
                    defaultValue: []
                }
            ],
            requiredAPIs: ['commands.executeCommand'],
            optionalAPIs: [],
            securityLevel: 'restricted',
            examples: ['執行格式化文檔命令']
        });

        this.operations.set('show-message', {
            id: 'show-message',
            name: '顯示消息',
            description: '向用戶顯示消息',
            category: 'ui',
            intent: '向用戶顯示信息',
            parameters: [
                {
                    name: 'message',
                    type: 'string',
                    required: true,
                    description: '消息內容'
                },
                {
                    name: 'type',
                    type: 'string',
                    required: false,
                    description: '消息類型',
                    validation: { allowedValues: ['info', 'warning', 'error'] },
                    defaultValue: 'info'
                }
            ],
            requiredAPIs: ['window.showInformationMessage'],
            optionalAPIs: ['window.showWarningMessage', 'window.showErrorMessage'],
            securityLevel: 'safe',
            examples: ['顯示歡迎消息']
        });
    }

    /**
     * 初始化映射
     */
    private initializeMappings(): void {
        // 創建文件映射
        this.mappings.set('create-file', [{
            operation: 'create-file',
            vsCodeAPI: 'workspace.fs.writeFile',
            mapping: [
                { operationParam: 'path', apiParam: 'uri', transform: 'vscode.Uri.file(value)' },
                { operationParam: 'content', apiParam: 'content', transform: 'Buffer.from(value, "utf8")' }
            ],
            preConditions: ['workspace.workspaceFolders.length > 0'],
            postActions: ['window.showTextDocument'],
            errorHandling: [
                {
                    errorType: 'FileSystemError',
                    action: 'prompt',
                    message: '文件創建失敗，是否重試？'
                }
            ],
            securityChecks: [
                {
                    type: 'path',
                    condition: 'isWithinWorkspace(path)',
                    action: 'deny',
                    message: '只能在工作區內創建文件'
                }
            ]
        }]);

        // 打開文件映射
        this.mappings.set('open-file', [{
            operation: 'open-file',
            vsCodeAPI: 'window.showTextDocument',
            mapping: [
                { operationParam: 'path', apiParam: 'uri', transform: 'vscode.Uri.file(value)' },
                { operationParam: 'viewColumn', apiParam: 'viewColumn' }
            ],
            preConditions: ['fs.existsSync(path)'],
            postActions: [],
            errorHandling: [
                {
                    errorType: 'FileNotFound',
                    action: 'prompt',
                    message: '文件不存在，是否創建？'
                }
            ],
            securityChecks: [
                {
                    type: 'path',
                    condition: 'isWithinWorkspace(path)',
                    action: 'prompt',
                    message: '文件在工作區外，是否繼續？'
                }
            ]
        }]);

        // 執行命令映射
        this.mappings.set('run-command', [{
            operation: 'run-command',
            vsCodeAPI: 'commands.executeCommand',
            mapping: [
                { operationParam: 'command', apiParam: 'command' },
                { operationParam: 'args', apiParam: 'rest', transform: '...value' }
            ],
            preConditions: ['isValidCommand(command)'],
            postActions: [],
            errorHandling: [
                {
                    errorType: 'CommandNotFound',
                    action: 'abort',
                    message: '命令不存在'
                }
            ],
            securityChecks: [
                {
                    type: 'permission',
                    condition: 'isAllowedCommand(command)',
                    action: 'deny',
                    message: '命令被安全策略禁止'
                }
            ]
        }]);

        // 顯示消息映射
        this.mappings.set('show-message', [{
            operation: 'show-message',
            vsCodeAPI: 'window.showInformationMessage',
            mapping: [
                { operationParam: 'message', apiParam: 'message' }
            ],
            preConditions: [],
            postActions: [],
            errorHandling: [],
            securityChecks: [
                {
                    type: 'content',
                    condition: 'isValidMessage(message)',
                    action: 'deny',
                    message: '消息內容不合適'
                }
            ]
        }]);
    }

    /**
     * 驗證參數
     */
    private validateParameters(operation: AIOperation, parameters: { [key: string]: any }): void {
        for (const param of operation.parameters) {
            const value = parameters[param.name];

            if (param.required && (value === undefined || value === null)) {
                throw new Error(`缺少必需參數: ${param.name}`);
            }

            if (value !== undefined && param.validation) {
                this.validateParameterValue(param, value);
            }
        }
    }

    /**
     * 驗證參數值
     */
    private validateParameterValue(param: OperationParameter, value: any): void {
        const validation = param.validation!;

        if (param.type === 'string' && typeof value === 'string') {
            if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
                throw new Error(`參數 ${param.name} 格式不正確`);
            }
            if (validation.minLength && value.length < validation.minLength) {
                throw new Error(`參數 ${param.name} 長度不足`);
            }
            if (validation.maxLength && value.length > validation.maxLength) {
                throw new Error(`參數 ${param.name} 長度超限`);
            }
        }

        if (validation.allowedValues && !validation.allowedValues.includes(value)) {
            throw new Error(`參數 ${param.name} 值不在允許範圍內`);
        }
    }

    /**
     * 執行安全檢查
     */
    private async performSecurityChecks(context: ExecutionContext): Promise<SecurityCheckResult[]> {
        const results: SecurityCheckResult[] = [];
        const mappings = this.mappings.get(context.operation.id) || [];

        for (const mapping of mappings) {
            for (const check of mapping.securityChecks) {
                const result: SecurityCheckResult = {
                    check,
                    passed: false
                };

                try {
                    // 評估安全條件
                    const passed = this.evaluateSecurityCondition(check.condition, context);
                    
                    if (passed) {
                        result.passed = true;
                    } else {
                        if (check.action === 'prompt') {
                            // 詢問用戶
                            const response = await vscode.window.showWarningMessage(
                                check.message,
                                '允許',
                                '拒絕'
                            );
                            result.passed = response === '允許';
                            result.userResponse = response === '允許' ? 'allow' : 'deny';
                        } else {
                            result.passed = check.action === 'allow';
                        }
                        result.message = check.message;
                    }
                } catch (error) {
                    result.passed = false;
                    result.message = `安全檢查失敗: ${error}`;
                }

                results.push(result);
            }
        }

        return results;
    }

    /**
     * 執行 API 映射
     */
    private async executeAPIMappings(
        mappings: APIMapping[],
        parameters: { [key: string]: any },
        result: ExecutionResult
    ): Promise<any> {
        let lastResult: any;

        for (const mapping of mappings) {
            try {
                // 檢查前置條件
                for (const condition of mapping.preConditions) {
                    if (!this.evaluateCondition(condition, parameters)) {
                        throw new Error(`前置條件不滿足: ${condition}`);
                    }
                }

                // 準備 API 參數
                const apiParams = this.prepareAPIParameters(mapping, parameters);

                // 調用 VS Code API
                const apiResult = await this.callVSCodeAPI(mapping.vsCodeAPI, apiParams);
                result.apisCalled.push(mapping.vsCodeAPI);
                lastResult = apiResult;

                // 執行後續動作
                for (const action of mapping.postActions) {
                    await this.executePostAction(action, apiResult);
                }

            } catch (error) {
                // 處理錯誤
                const handled = await this.handleMappingError(mapping, error, result);
                if (!handled) {
                    throw error;
                }
            }
        }

        return lastResult;
    }

    /**
     * 準備 API 參數
     */
    private prepareAPIParameters(mapping: APIMapping, parameters: { [key: string]: any }): any[] {
        const apiParams: any[] = [];

        for (const paramMapping of mapping.mapping) {
            let value = parameters[paramMapping.operationParam];

            if (paramMapping.transform) {
                // 應用轉換
                value = this.applyTransform(paramMapping.transform, value);
            }

            apiParams.push(value);
        }

        return apiParams;
    }

    /**
     * 調用 VS Code API
     */
    private async callVSCodeAPI(apiPath: string, params: any[]): Promise<any> {
        const apiParts = apiPath.split('.');
        let api: any = vscode;

        for (const part of apiParts) {
            api = api[part];
            if (!api) {
                throw new Error(`API 不存在: ${apiPath}`);
            }
        }

        if (typeof api === 'function') {
            return await api(...params);
        } else {
            throw new Error(`${apiPath} 不是函數`);
        }
    }

    // 輔助方法
    private evaluateSecurityCondition(condition: string, context: ExecutionContext): boolean {
        // 簡化的安全條件評估
        try {
            const func = new Function('context', 'parameters', `return ${condition}`);
            return func(context, context.parameters);
        } catch {
            return false;
        }
    }

    private evaluateCondition(condition: string, parameters: { [key: string]: any }): boolean {
        try {
            const func = new Function('parameters', `return ${condition}`);
            return func(parameters);
        } catch {
            return false;
        }
    }

    private applyTransform(transform: string, value: any): any {
        try {
            const func = new Function('value', 'vscode', `return ${transform}`);
            return func(value, vscode);
        } catch {
            return value;
        }
    }

    private async executePostAction(action: string, result: any): Promise<void> {
        // 執行後續動作的實作
    }

    private async handleMappingError(mapping: APIMapping, error: any, result: ExecutionResult): Promise<boolean> {
        for (const errorHandler of mapping.errorHandling) {
            if (error.name === errorHandler.errorType || error.message.includes(errorHandler.errorType)) {
                switch (errorHandler.action) {
                    case 'retry':
                        // 重試邏輯
                        return true;
                    case 'fallback':
                        if (errorHandler.fallbackAPI) {
                            // 使用備用 API
                            return true;
                        }
                        break;
                    case 'prompt':
                        const response = await vscode.window.showErrorMessage(
                            errorHandler.message,
                            '重試',
                            '取消'
                        );
                        return response === '重試';
                    case 'abort':
                        result.warnings.push(errorHandler.message);
                        return false;
                }
            }
        }
        return false;
    }

    private loadSecurityPolicy(): SecurityPolicy {
        return {
            allowedCommands: [
                'editor.action.formatDocument',
                'workbench.action.files.save',
                'workbench.action.files.saveAll'
            ],
            restrictedPaths: [
                '/etc',
                '/System',
                'C:\\Windows'
            ],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            rateLimits: {
                'file-operations': { count: 100, window: 60000 },
                'command-execution': { count: 50, window: 60000 }
            }
        };
    }

    private generateSessionId(): string {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 獲取執行歷史
     */
    getExecutionHistory(limit: number = 100): ExecutionContext[] {
        return this.executionHistory.slice(-limit);
    }

    /**
     * 清理資源
     */
    dispose(): void {
        this.operations.clear();
        this.mappings.clear();
        this.executionHistory = [];
    }
}

interface SecurityPolicy {
    allowedCommands: string[];
    restrictedPaths: string[];
    maxFileSize: number;
    rateLimits: { [operation: string]: { count: number; window: number } };
}
