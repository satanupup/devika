import { DatabaseManager } from './DatabaseManager';
import { APIEndpoint, APINamespace, APIParameter, CrawlResult } from '../crawler/VSCodeAPICrawler';

export interface APIEndpointRecord {
    id: string;
    namespace_id: string;
    name: string;
    type: string;
    description?: string;
    signature?: string;
    return_type?: string;
    since_version?: string;
    deprecated: number;
    deprecated_since?: string;
    url?: string;
    first_discovered: string;
    last_updated: string;
    is_active: number;
    usage_count: number;
    metadata?: string;
}

export interface APINamespaceRecord {
    id: string;
    name: string;
    description?: string;
    parent_namespace_id?: string;
    url?: string;
    first_discovered: string;
    last_updated: string;
    is_active: number;
    metadata?: string;
}

export interface APIUsageRecord {
    id: string;
    endpoint_id: string;
    file_path: string;
    line_number?: number;
    usage_context?: string;
    usage_type: string;
    first_used: string;
    last_scanned: string;
    is_active: number;
    metadata?: string;
}

export interface APICoverageAnalysis {
    id: string;
    analysis_date: string;
    total_available_apis: number;
    used_apis_count: number;
    coverage_percentage: number;
    unused_apis: string[];
    most_used_apis: string[];
    deprecated_apis_used: string[];
    recommendations: string[];
    analysis_duration: number;
    metadata?: any;
}

export class APIDAO {
    constructor(private dbManager: DatabaseManager) {}

    /**
     * 保存 API 命名空間
     */
    async saveNamespace(namespace: APINamespace, parentId?: string): Promise<string> {
        const id = this.generateId();
        const now = new Date().toISOString();

        await this.dbManager.run(`
            INSERT OR REPLACE INTO vscode_api_namespaces (
                id, name, description, parent_namespace_id, url,
                first_discovered, last_updated, is_active, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            namespace.name,
            namespace.description,
            parentId,
            namespace.url || null,
            now,
            now,
            1,
            JSON.stringify({ subNamespaces: namespace.subNamespaces.length })
        ]);

        // 遞歸保存子命名空間
        for (const subNamespace of namespace.subNamespaces) {
            await this.saveNamespace(subNamespace, id);
        }

        return id;
    }

    /**
     * 保存 API 端點
     */
    async saveEndpoint(endpoint: APIEndpoint, namespaceId: string): Promise<string> {
        const id = this.generateId();
        const now = new Date().toISOString();

        await this.dbManager.run(`
            INSERT OR REPLACE INTO vscode_api_endpoints (
                id, namespace_id, name, type, description, signature, return_type,
                since_version, deprecated, deprecated_since, url, first_discovered,
                last_updated, is_active, usage_count, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            namespaceId,
            endpoint.name,
            endpoint.type,
            endpoint.description,
            endpoint.signature,
            endpoint.returnType,
            endpoint.since,
            endpoint.deprecated ? 1 : 0,
            endpoint.deprecated ? endpoint.since : null,
            endpoint.url,
            now,
            now,
            1,
            0,
            JSON.stringify({
                examples: endpoint.examples,
                relatedAPIs: endpoint.relatedAPIs
            })
        ]);

        // 保存參數
        if (endpoint.parameters) {
            for (let i = 0; i < endpoint.parameters.length; i++) {
                await this.saveParameter(endpoint.parameters[i], id, i);
            }
        }

        // 保存範例
        if (endpoint.examples) {
            for (let i = 0; i < endpoint.examples.length; i++) {
                await this.saveExample(endpoint.examples[i], id, i);
            }
        }

        return id;
    }

    /**
     * 保存 API 參數
     */
    async saveParameter(parameter: APIParameter, endpointId: string, orderIndex: number): Promise<void> {
        const id = this.generateId();

        await this.dbManager.run(`
            INSERT OR REPLACE INTO vscode_api_parameters (
                id, endpoint_id, name, type, optional, description,
                default_value, order_index, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            endpointId,
            parameter.name,
            parameter.type,
            parameter.optional ? 1 : 0,
            parameter.description,
            null, // default_value 暫時為空
            orderIndex,
            new Date().toISOString()
        ]);
    }

    /**
     * 保存 API 範例
     */
    async saveExample(example: string, endpointId: string, orderIndex: number): Promise<void> {
        const id = this.generateId();

        await this.dbManager.run(`
            INSERT OR REPLACE INTO vscode_api_examples (
                id, endpoint_id, title, description, code, language,
                category, difficulty, order_index, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            endpointId,
            `範例 ${orderIndex + 1}`,
            '',
            example,
            'typescript',
            'general',
            'beginner',
            orderIndex,
            new Date().toISOString()
        ]);
    }

    /**
     * 獲取所有命名空間
     */
    async getAllNamespaces(): Promise<APINamespaceRecord[]> {
        return await this.dbManager.query<APINamespaceRecord>(`
            SELECT * FROM vscode_api_namespaces 
            WHERE is_active = 1 
            ORDER BY name
        `);
    }

    /**
     * 根據命名空間獲取 API 端點
     */
    async getEndpointsByNamespace(namespaceId: string): Promise<APIEndpointRecord[]> {
        return await this.dbManager.query<APIEndpointRecord>(`
            SELECT * FROM vscode_api_endpoints 
            WHERE namespace_id = ? AND is_active = 1 
            ORDER BY name
        `, [namespaceId]);
    }

    /**
     * 搜索 API 端點
     */
    async searchEndpoints(query: string): Promise<APIEndpointRecord[]> {
        return await this.dbManager.query<APIEndpointRecord>(`
            SELECT e.*, n.name as namespace_name 
            FROM vscode_api_endpoints e
            JOIN vscode_api_namespaces n ON e.namespace_id = n.id
            WHERE (e.name LIKE ? OR e.description LIKE ? OR n.name LIKE ?)
            AND e.is_active = 1
            ORDER BY e.usage_count DESC, e.name
        `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    }

    /**
     * 獲取 API 端點詳細信息
     */
    async getEndpointDetails(endpointId: string): Promise<{
        endpoint: APIEndpointRecord;
        parameters: APIParameter[];
        examples: string[];
        namespace: APINamespaceRecord;
    } | null> {
        const endpoint = await this.dbManager.get<APIEndpointRecord>(`
            SELECT * FROM vscode_api_endpoints WHERE id = ?
        `, [endpointId]);

        if (!endpoint) {
            return null;
        }

        const [parameters, examples, namespace] = await Promise.all([
            this.dbManager.query<any>(`
                SELECT name, type, optional, description, default_value 
                FROM vscode_api_parameters 
                WHERE endpoint_id = ? 
                ORDER BY order_index
            `, [endpointId]),
            this.dbManager.query<any>(`
                SELECT code 
                FROM vscode_api_examples 
                WHERE endpoint_id = ? 
                ORDER BY order_index
            `, [endpointId]),
            this.dbManager.get<APINamespaceRecord>(`
                SELECT * FROM vscode_api_namespaces WHERE id = ?
            `, [endpoint.namespace_id])
        ]);

        return {
            endpoint,
            parameters: parameters.map(p => ({
                name: p.name,
                type: p.type,
                optional: p.optional === 1,
                description: p.description
            })),
            examples: examples.map(e => e.code),
            namespace: namespace!
        };
    }

    /**
     * 記錄 API 使用情況
     */
    async recordAPIUsage(
        endpointId: string,
        filePath: string,
        lineNumber: number,
        usageContext: string,
        usageType: 'import' | 'call' | 'instantiate' | 'extend'
    ): Promise<void> {
        const id = this.generateId();
        const now = new Date().toISOString();

        await this.dbManager.run(`
            INSERT OR REPLACE INTO extension_api_usage (
                id, endpoint_id, file_path, line_number, usage_context,
                usage_type, first_used, last_scanned, is_active, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            endpointId,
            filePath,
            lineNumber,
            usageContext,
            usageType,
            now,
            now,
            1,
            JSON.stringify({ detected_at: now })
        ]);

        // 更新 API 使用計數
        await this.dbManager.run(`
            UPDATE vscode_api_endpoints 
            SET usage_count = usage_count + 1 
            WHERE id = ?
        `, [endpointId]);
    }

    /**
     * 獲取 API 使用統計
     */
    async getAPIUsageStats(): Promise<{
        totalAPIs: number;
        usedAPIs: number;
        unusedAPIs: number;
        mostUsedAPIs: Array<{ name: string; namespace: string; usage_count: number }>;
        deprecatedAPIsInUse: Array<{ name: string; namespace: string; usage_count: number }>;
    }> {
        const [totalResult, usedResult, mostUsed, deprecatedInUse] = await Promise.all([
            this.dbManager.get<{ count: number }>(`
                SELECT COUNT(*) as count FROM vscode_api_endpoints WHERE is_active = 1
            `),
            this.dbManager.get<{ count: number }>(`
                SELECT COUNT(*) as count FROM vscode_api_endpoints 
                WHERE is_active = 1 AND usage_count > 0
            `),
            this.dbManager.query<any>(`
                SELECT e.name, n.name as namespace, e.usage_count 
                FROM vscode_api_endpoints e
                JOIN vscode_api_namespaces n ON e.namespace_id = n.id
                WHERE e.is_active = 1 AND e.usage_count > 0
                ORDER BY e.usage_count DESC
                LIMIT 10
            `),
            this.dbManager.query<any>(`
                SELECT e.name, n.name as namespace, e.usage_count 
                FROM vscode_api_endpoints e
                JOIN vscode_api_namespaces n ON e.namespace_id = n.id
                WHERE e.is_active = 1 AND e.deprecated = 1 AND e.usage_count > 0
                ORDER BY e.usage_count DESC
            `)
        ]);

        const totalAPIs = totalResult?.count || 0;
        const usedAPIs = usedResult?.count || 0;

        return {
            totalAPIs,
            usedAPIs,
            unusedAPIs: totalAPIs - usedAPIs,
            mostUsedAPIs: mostUsed.map(api => ({
                name: api.name,
                namespace: api.namespace,
                usage_count: api.usage_count
            })),
            deprecatedAPIsInUse: deprecatedInUse.map(api => ({
                name: api.name,
                namespace: api.namespace,
                usage_count: api.usage_count
            }))
        };
    }

    /**
     * 保存覆蓋率分析結果
     */
    async saveCoverageAnalysis(analysis: Omit<APICoverageAnalysis, 'id'>): Promise<void> {
        const id = this.generateId();

        await this.dbManager.run(`
            INSERT INTO api_coverage_analysis (
                id, analysis_date, total_available_apis, used_apis_count,
                coverage_percentage, unused_apis, most_used_apis,
                deprecated_apis_used, recommendations, analysis_duration, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            analysis.analysis_date,
            analysis.total_available_apis,
            analysis.used_apis_count,
            analysis.coverage_percentage,
            JSON.stringify(analysis.unused_apis),
            JSON.stringify(analysis.most_used_apis),
            JSON.stringify(analysis.deprecated_apis_used),
            JSON.stringify(analysis.recommendations),
            analysis.analysis_duration,
            JSON.stringify(analysis.metadata)
        ]);
    }

    /**
     * 獲取最新的覆蓋率分析
     */
    async getLatestCoverageAnalysis(): Promise<APICoverageAnalysis | null> {
        const result = await this.dbManager.get<any>(`
            SELECT * FROM api_coverage_analysis 
            ORDER BY analysis_date DESC 
            LIMIT 1
        `);

        if (!result) {
            return null;
        }

        return {
            id: result.id,
            analysis_date: result.analysis_date,
            total_available_apis: result.total_available_apis,
            used_apis_count: result.used_apis_count,
            coverage_percentage: result.coverage_percentage,
            unused_apis: JSON.parse(result.unused_apis || '[]'),
            most_used_apis: JSON.parse(result.most_used_apis || '[]'),
            deprecated_apis_used: JSON.parse(result.deprecated_apis_used || '[]'),
            recommendations: JSON.parse(result.recommendations || '[]'),
            analysis_duration: result.analysis_duration,
            metadata: JSON.parse(result.metadata || '{}')
        };
    }

    /**
     * 記錄 AI 操作日誌
     */
    async logAIOperation(
        operationType: string,
        apiEndpointId: string | null,
        operationDetails: any,
        parameters: any,
        result: any,
        success: boolean,
        errorMessage?: string,
        executionTime?: number,
        userContext?: string
    ): Promise<void> {
        const id = this.generateId();

        await this.dbManager.run(`
            INSERT INTO ai_operation_logs (
                id, operation_type, api_endpoint_id, operation_details,
                parameters, result, success, error_message, execution_time,
                user_context, timestamp, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            operationType,
            apiEndpointId,
            JSON.stringify(operationDetails),
            JSON.stringify(parameters),
            JSON.stringify(result),
            success ? 1 : 0,
            errorMessage,
            executionTime,
            userContext,
            new Date().toISOString(),
            JSON.stringify({ logged_at: new Date().toISOString() })
        ]);
    }

    /**
     * 獲取未使用的 API
     */
    async getUnusedAPIs(): Promise<APIEndpointRecord[]> {
        return await this.dbManager.query<APIEndpointRecord>(`
            SELECT e.*, n.name as namespace_name 
            FROM vscode_api_endpoints e
            JOIN vscode_api_namespaces n ON e.namespace_id = n.id
            WHERE e.is_active = 1 AND e.usage_count = 0
            ORDER BY n.name, e.name
        `);
    }

    /**
     * 獲取已棄用但仍在使用的 API
     */
    async getDeprecatedAPIsInUse(): Promise<APIEndpointRecord[]> {
        return await this.dbManager.query<APIEndpointRecord>(`
            SELECT e.*, n.name as namespace_name 
            FROM vscode_api_endpoints e
            JOIN vscode_api_namespaces n ON e.namespace_id = n.id
            WHERE e.is_active = 1 AND e.deprecated = 1 AND e.usage_count > 0
            ORDER BY e.usage_count DESC
        `);
    }

    /**
     * 生成唯一 ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}
