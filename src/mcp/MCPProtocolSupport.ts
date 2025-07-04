import * as vscode from 'vscode';

export interface MCPServer {
    id: string;
    name: string;
    description: string;
    version: string;
    capabilities: MCPCapabilities;
    connection: MCPConnection;
    status: 'connected' | 'disconnected' | 'error' | 'connecting';
    lastPing: Date;
    metadata: { [key: string]: any };
}

export interface MCPCapabilities {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    sampling: boolean;
    logging: boolean;
    roots: boolean;
}

export interface MCPConnection {
    type: 'stdio' | 'sse' | 'websocket';
    transport: MCPTransport;
    config: ConnectionConfig;
}

export interface MCPTransport {
    send(message: MCPMessage): Promise<void>;
    receive(): Promise<MCPMessage>;
    close(): Promise<void>;
    onMessage(handler: (message: MCPMessage) => void): void;
    onError(handler: (error: Error) => void): void;
    onClose(handler: () => void): void;
}

export interface ConnectionConfig {
    command?: string;
    args?: string[];
    env?: { [key: string]: string };
    url?: string;
    headers?: { [key: string]: string };
    timeout?: number;
    retries?: number;
}

export interface MCPMessage {
    jsonrpc: '2.0';
    id?: string | number;
    method?: string;
    params?: any;
    result?: any;
    error?: MCPError;
}

export interface MCPError {
    code: number;
    message: string;
    data?: any;
}

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: any; // JSON Schema
    serverId: string;
}

export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
    serverId: string;
}

export interface MCPPrompt {
    name: string;
    description: string;
    arguments?: MCPPromptArgument[];
    serverId: string;
}

export interface MCPPromptArgument {
    name: string;
    description: string;
    required: boolean;
    type: string;
}

export interface MCPSamplingRequest {
    messages: MCPMessage[];
    modelPreferences?: ModelPreferences;
    systemPrompt?: string;
    includeContext?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface ModelPreferences {
    hints?: ModelHint[];
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
}

export interface ModelHint {
    name?: string;
}

export class MCPProtocolSupport {
    private servers: Map<string, MCPServer> = new Map();
    private tools: Map<string, MCPTool> = new Map();
    private resources: Map<string, MCPResource> = new Map();
    private prompts: Map<string, MCPPrompt> = new Map();
    private messageHandlers: Map<string, (message: MCPMessage) => void> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.loadServerConfigurations();
    }

    /**
     * 連接到 MCP 服務器
     */
    async connectToServer(config: {
        id: string;
        name: string;
        description: string;
        connection: MCPConnection;
    }): Promise<void> {
        try {
            const server: MCPServer = {
                id: config.id,
                name: config.name,
                description: config.description,
                version: '1.0.0',
                capabilities: {
                    tools: false,
                    resources: false,
                    prompts: false,
                    sampling: false,
                    logging: false,
                    roots: false
                },
                connection: config.connection,
                status: 'connecting',
                lastPing: new Date(),
                metadata: {}
            };

            this.servers.set(config.id, server);

            // 建立連接
            await this.establishConnection(server);

            // 初始化握手
            await this.performHandshake(server);

            // 獲取服務器能力
            await this.getServerCapabilities(server);

            // 載入工具、資源和提示
            await this.loadServerAssets(server);

            server.status = 'connected';
            console.log(`已連接到 MCP 服務器: ${server.name}`);

        } catch (error) {
            console.error(`連接 MCP 服務器失敗: ${error}`);
            const server = this.servers.get(config.id);
            if (server) {
                server.status = 'error';
            }
            throw error;
        }
    }

    /**
     * 調用 MCP 工具
     */
    async callTool(toolName: string, arguments_: any): Promise<any> {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`工具不存在: ${toolName}`);
        }

        const server = this.servers.get(tool.serverId);
        if (!server || server.status !== 'connected') {
            throw new Error(`服務器未連接: ${tool.serverId}`);
        }

        // 驗證輸入參數
        this.validateToolArguments(tool, arguments_);

        // 發送工具調用請求
        const message: MCPMessage = {
            jsonrpc: '2.0',
            id: this.generateMessageId(),
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: arguments_
            }
        };

        const response = await this.sendMessage(server, message);

        if (response.error) {
            throw new Error(`工具調用失敗: ${response.error.message}`);
        }

        return response.result;
    }

    /**
     * 獲取 MCP 資源
     */
    async getResource(uri: string): Promise<any> {
        const resource = this.resources.get(uri);
        if (!resource) {
            throw new Error(`資源不存在: ${uri}`);
        }

        const server = this.servers.get(resource.serverId);
        if (!server || server.status !== 'connected') {
            throw new Error(`服務器未連接: ${resource.serverId}`);
        }

        const message: MCPMessage = {
            jsonrpc: '2.0',
            id: this.generateMessageId(),
            method: 'resources/read',
            params: { uri }
        };

        const response = await this.sendMessage(server, message);

        if (response.error) {
            throw new Error(`獲取資源失敗: ${response.error.message}`);
        }

        return response.result;
    }

    /**
     * 獲取 MCP 提示
     */
    async getPrompt(name: string, arguments_?: any): Promise<any> {
        const prompt = this.prompts.get(name);
        if (!prompt) {
            throw new Error(`提示不存在: ${name}`);
        }

        const server = this.servers.get(prompt.serverId);
        if (!server || server.status !== 'connected') {
            throw new Error(`服務器未連接: ${prompt.serverId}`);
        }

        const message: MCPMessage = {
            jsonrpc: '2.0',
            id: this.generateMessageId(),
            method: 'prompts/get',
            params: {
                name,
                arguments: arguments_ || {}
            }
        };

        const response = await this.sendMessage(server, message);

        if (response.error) {
            throw new Error(`獲取提示失敗: ${response.error.message}`);
        }

        return response.result;
    }

    /**
     * 請求採樣
     */
    async requestSampling(serverId: string, request: MCPSamplingRequest): Promise<any> {
        const server = this.servers.get(serverId);
        if (!server || server.status !== 'connected') {
            throw new Error(`服務器未連接: ${serverId}`);
        }

        if (!server.capabilities.sampling) {
            throw new Error(`服務器不支援採樣: ${serverId}`);
        }

        const message: MCPMessage = {
            jsonrpc: '2.0',
            id: this.generateMessageId(),
            method: 'sampling/createMessage',
            params: request
        };

        const response = await this.sendMessage(server, message);

        if (response.error) {
            throw new Error(`採樣請求失敗: ${response.error.message}`);
        }

        return response.result;
    }

    /**
     * 建立連接
     */
    private async establishConnection(server: MCPServer): Promise<void> {
        const transport = server.connection.transport;

        // 設置事件處理器
        transport.onMessage((message) => {
            this.handleIncomingMessage(server.id, message);
        });

        transport.onError((error) => {
            console.error(`MCP 服務器錯誤 ${server.name}:`, error);
            server.status = 'error';
        });

        transport.onClose(() => {
            console.log(`MCP 服務器連接關閉: ${server.name}`);
            server.status = 'disconnected';
        });

        // 根據連接類型建立連接
        switch (server.connection.type) {
            case 'stdio':
                await this.establishStdioConnection(server);
                break;
            case 'sse':
                await this.establishSSEConnection(server);
                break;
            case 'websocket':
                await this.establishWebSocketConnection(server);
                break;
        }
    }

    /**
     * 執行握手
     */
    private async performHandshake(server: MCPServer): Promise<void> {
        const initMessage: MCPMessage = {
            jsonrpc: '2.0',
            id: this.generateMessageId(),
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    roots: { listChanged: true },
                    sampling: {}
                },
                clientInfo: {
                    name: 'Devika VS Code Extension',
                    version: '1.0.0'
                }
            }
        };

        const response = await this.sendMessage(server, initMessage);

        if (response.error) {
            throw new Error(`握手失敗: ${response.error.message}`);
        }

        // 發送初始化完成通知
        const initializedMessage: MCPMessage = {
            jsonrpc: '2.0',
            method: 'notifications/initialized'
        };

        await server.connection.transport.send(initializedMessage);
    }

    /**
     * 獲取服務器能力
     */
    private async getServerCapabilities(server: MCPServer): Promise<void> {
        // 檢查工具能力
        try {
            const toolsMessage: MCPMessage = {
                jsonrpc: '2.0',
                id: this.generateMessageId(),
                method: 'tools/list'
            };

            const toolsResponse = await this.sendMessage(server, toolsMessage);
            if (!toolsResponse.error) {
                server.capabilities.tools = true;
            }
        } catch {
            server.capabilities.tools = false;
        }

        // 檢查資源能力
        try {
            const resourcesMessage: MCPMessage = {
                jsonrpc: '2.0',
                id: this.generateMessageId(),
                method: 'resources/list'
            };

            const resourcesResponse = await this.sendMessage(server, resourcesMessage);
            if (!resourcesResponse.error) {
                server.capabilities.resources = true;
            }
        } catch {
            server.capabilities.resources = false;
        }

        // 檢查提示能力
        try {
            const promptsMessage: MCPMessage = {
                jsonrpc: '2.0',
                id: this.generateMessageId(),
                method: 'prompts/list'
            };

            const promptsResponse = await this.sendMessage(server, promptsMessage);
            if (!promptsResponse.error) {
                server.capabilities.prompts = true;
            }
        } catch {
            server.capabilities.prompts = false;
        }
    }

    /**
     * 載入服務器資產
     */
    private async loadServerAssets(server: MCPServer): Promise<void> {
        // 載入工具
        if (server.capabilities.tools) {
            const toolsMessage: MCPMessage = {
                jsonrpc: '2.0',
                id: this.generateMessageId(),
                method: 'tools/list'
            };

            const toolsResponse = await this.sendMessage(server, toolsMessage);
            if (toolsResponse.result?.tools) {
                for (const tool of toolsResponse.result.tools) {
                    this.tools.set(tool.name, {
                        ...tool,
                        serverId: server.id
                    });
                }
            }
        }

        // 載入資源
        if (server.capabilities.resources) {
            const resourcesMessage: MCPMessage = {
                jsonrpc: '2.0',
                id: this.generateMessageId(),
                method: 'resources/list'
            };

            const resourcesResponse = await this.sendMessage(server, resourcesMessage);
            if (resourcesResponse.result?.resources) {
                for (const resource of resourcesResponse.result.resources) {
                    this.resources.set(resource.uri, {
                        ...resource,
                        serverId: server.id
                    });
                }
            }
        }

        // 載入提示
        if (server.capabilities.prompts) {
            const promptsMessage: MCPMessage = {
                jsonrpc: '2.0',
                id: this.generateMessageId(),
                method: 'prompts/list'
            };

            const promptsResponse = await this.sendMessage(server, promptsMessage);
            if (promptsResponse.result?.prompts) {
                for (const prompt of promptsResponse.result.prompts) {
                    this.prompts.set(prompt.name, {
                        ...prompt,
                        serverId: server.id
                    });
                }
            }
        }
    }

    /**
     * 發送消息
     */
    private async sendMessage(server: MCPServer, message: MCPMessage): Promise<MCPMessage> {
        return new Promise((resolve, reject) => {
            const messageId = message.id;

            if (messageId) {
                // 設置響應處理器
                const timeout = setTimeout(() => {
                    this.messageHandlers.delete(String(messageId));
                    reject(new Error('消息超時'));
                }, 30000);

                this.messageHandlers.set(String(messageId), (response) => {
                    clearTimeout(timeout);
                    this.messageHandlers.delete(String(messageId));
                    resolve(response);
                });
            }

            // 發送消息
            server.connection.transport.send(message).catch(reject);

            // 如果沒有 ID（通知消息），立即解析
            if (!messageId) {
                resolve({ jsonrpc: '2.0' });
            }
        });
    }

    /**
     * 處理傳入消息
     */
    private handleIncomingMessage(serverId: string, message: MCPMessage): void {
        if (message.id && this.messageHandlers.has(String(message.id))) {
            // 這是對請求的響應
            const handler = this.messageHandlers.get(String(message.id));
            if (handler) {
                handler(message);
            }
        } else if (message.method) {
            // 這是來自服務器的請求或通知
            this.handleServerRequest(serverId, message);
        }
    }

    /**
     * 處理服務器請求
     */
    private handleServerRequest(serverId: string, message: MCPMessage): void {
        const server = this.servers.get(serverId);
        if (!server) {return;}

        switch (message.method) {
            case 'notifications/message':
                this.handleLogMessage(message.params);
                break;
            case 'notifications/resources/updated':
                this.handleResourcesUpdated(serverId);
                break;
            case 'notifications/tools/updated':
                this.handleToolsUpdated(serverId);
                break;
            case 'notifications/prompts/updated':
                this.handlePromptsUpdated(serverId);
                break;
        }
    }

    // 連接實作方法
    private async establishStdioConnection(server: MCPServer): Promise<void> {
        // STDIO 連接實作
    }

    private async establishSSEConnection(server: MCPServer): Promise<void> {
        // SSE 連接實作
    }

    private async establishWebSocketConnection(server: MCPServer): Promise<void> {
        // WebSocket 連接實作
    }

    // 事件處理方法
    private handleLogMessage(params: any): void {
        console.log('MCP 日誌:', params);
    }

    private async handleResourcesUpdated(serverId: string): Promise<void> {
        const server = this.servers.get(serverId);
        if (server && server.capabilities.resources) {
            await this.loadServerAssets(server);
        }
    }

    private async handleToolsUpdated(serverId: string): Promise<void> {
        const server = this.servers.get(serverId);
        if (server && server.capabilities.tools) {
            await this.loadServerAssets(server);
        }
    }

    private async handlePromptsUpdated(serverId: string): Promise<void> {
        const server = this.servers.get(serverId);
        if (server && server.capabilities.prompts) {
            await this.loadServerAssets(server);
        }
    }

    // 輔助方法
    private validateToolArguments(tool: MCPTool, arguments_: any): void {
        // JSON Schema 驗證實作
    }

    private generateMessageId(): string {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    private loadServerConfigurations(): void {
        // 載入服務器配置
    }

    /**
     * 斷開服務器連接
     */
    async disconnectServer(serverId: string): Promise<void> {
        const server = this.servers.get(serverId);
        if (server) {
            await server.connection.transport.close();
            server.status = 'disconnected';

            // 清理相關資產
            for (const [name, tool] of this.tools) {
                if (tool.serverId === serverId) {
                    this.tools.delete(name);
                }
            }

            for (const [uri, resource] of this.resources) {
                if (resource.serverId === serverId) {
                    this.resources.delete(uri);
                }
            }

            for (const [name, prompt] of this.prompts) {
                if (prompt.serverId === serverId) {
                    this.prompts.delete(name);
                }
            }
        }
    }

    /**
     * 獲取可用工具
     */
    getAvailableTools(): MCPTool[] {
        return Array.from(this.tools.values());
    }

    /**
     * 獲取可用資源
     */
    getAvailableResources(): MCPResource[] {
        return Array.from(this.resources.values());
    }

    /**
     * 獲取可用提示
     */
    getAvailablePrompts(): MCPPrompt[] {
        return Array.from(this.prompts.values());
    }

    /**
     * 獲取連接的服務器
     */
    getConnectedServers(): MCPServer[] {
        return Array.from(this.servers.values()).filter(s => s.status === 'connected');
    }

    /**
     * 清理資源
     */
    async dispose(): Promise<void> {
        for (const server of this.servers.values()) {
            await this.disconnectServer(server.id);
        }
        this.servers.clear();
        this.tools.clear();
        this.resources.clear();
        this.prompts.clear();
        this.messageHandlers.clear();
    }
}
