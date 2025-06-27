export interface DatabaseSchema {
    version: number;
    tables: TableDefinition[];
}

export interface TableDefinition {
    name: string;
    columns: ColumnDefinition[];
    indexes?: IndexDefinition[];
    constraints?: ConstraintDefinition[];
}

export interface ColumnDefinition {
    name: string;
    type: 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB' | 'DATETIME';
    primaryKey?: boolean;
    autoIncrement?: boolean;
    notNull?: boolean;
    unique?: boolean;
    defaultValue?: any;
    foreignKey?: {
        table: string;
        column: string;
        onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
        onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    };
}

export interface IndexDefinition {
    name: string;
    columns: string[];
    unique?: boolean;
}

export interface ConstraintDefinition {
    name: string;
    type: 'CHECK' | 'UNIQUE' | 'FOREIGN KEY';
    definition: string;
}

// 數據庫架構定義
export const DATABASE_SCHEMA: DatabaseSchema = {
    version: 1,
    tables: [
        // 任務表
        {
            name: 'tasks',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'title', type: 'TEXT', notNull: true },
                { name: 'description', type: 'TEXT' },
                { name: 'status', type: 'TEXT', notNull: true, defaultValue: 'pending' },
                { name: 'type', type: 'TEXT', notNull: true },
                { name: 'priority', type: 'TEXT', notNull: true, defaultValue: 'medium' },
                { name: 'assignee', type: 'TEXT' },
                { name: 'estimated_time', type: 'INTEGER' },
                { name: 'actual_time', type: 'INTEGER' },
                { name: 'file_path', type: 'TEXT' },
                { name: 'line_start', type: 'INTEGER' },
                { name: 'line_end', type: 'INTEGER' },
                { name: 'created_at', type: 'DATETIME', notNull: true },
                { name: 'updated_at', type: 'DATETIME' },
                { name: 'completed_at', type: 'DATETIME' },
                { name: 'metadata', type: 'TEXT' } // JSON 格式存儲額外數據
            ],
            indexes: [
                { name: 'idx_tasks_status', columns: ['status'] },
                { name: 'idx_tasks_type', columns: ['type'] },
                { name: 'idx_tasks_priority', columns: ['priority'] },
                { name: 'idx_tasks_created_at', columns: ['created_at'] },
                { name: 'idx_tasks_file_path', columns: ['file_path'] }
            ]
        },

        // 任務標籤表
        {
            name: 'task_tags',
            columns: [
                { name: 'task_id', type: 'TEXT', notNull: true, foreignKey: { table: 'tasks', column: 'id', onDelete: 'CASCADE' } },
                { name: 'tag', type: 'TEXT', notNull: true }
            ],
            indexes: [
                { name: 'idx_task_tags_task_id', columns: ['task_id'] },
                { name: 'idx_task_tags_tag', columns: ['tag'] }
            ]
        },

        // 任務依賴關係表
        {
            name: 'task_dependencies',
            columns: [
                { name: 'task_id', type: 'TEXT', notNull: true, foreignKey: { table: 'tasks', column: 'id', onDelete: 'CASCADE' } },
                { name: 'depends_on_task_id', type: 'TEXT', notNull: true, foreignKey: { table: 'tasks', column: 'id', onDelete: 'CASCADE' } },
                { name: 'created_at', type: 'DATETIME', notNull: true }
            ],
            indexes: [
                { name: 'idx_task_deps_task_id', columns: ['task_id'] },
                { name: 'idx_task_deps_depends_on', columns: ['depends_on_task_id'] }
            ]
        },

        // 任務層級關係表（父子關係）
        {
            name: 'task_hierarchy',
            columns: [
                { name: 'parent_task_id', type: 'TEXT', notNull: true, foreignKey: { table: 'tasks', column: 'id', onDelete: 'CASCADE' } },
                { name: 'child_task_id', type: 'TEXT', notNull: true, foreignKey: { table: 'tasks', column: 'id', onDelete: 'CASCADE' } },
                { name: 'order_index', type: 'INTEGER', defaultValue: 0 },
                { name: 'created_at', type: 'DATETIME', notNull: true }
            ],
            indexes: [
                { name: 'idx_task_hierarchy_parent', columns: ['parent_task_id'] },
                { name: 'idx_task_hierarchy_child', columns: ['child_task_id'] },
                { name: 'idx_task_hierarchy_order', columns: ['parent_task_id', 'order_index'] }
            ]
        },

        // 項目表
        {
            name: 'projects',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'name', type: 'TEXT', notNull: true },
                { name: 'description', type: 'TEXT' },
                { name: 'type', type: 'TEXT', notNull: true },
                { name: 'path', type: 'TEXT', notNull: true, unique: true },
                { name: 'language', type: 'TEXT' },
                { name: 'framework', type: 'TEXT' },
                { name: 'source_files_count', type: 'INTEGER', defaultValue: 0 },
                { name: 'lines_of_code', type: 'INTEGER', defaultValue: 0 },
                { name: 'last_analyzed', type: 'DATETIME' },
                { name: 'created_at', type: 'DATETIME', notNull: true },
                { name: 'updated_at', type: 'DATETIME' },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_projects_type', columns: ['type'] },
                { name: 'idx_projects_language', columns: ['language'] },
                { name: 'idx_projects_path', columns: ['path'] }
            ]
        },

        // 文件分析表
        {
            name: 'file_analysis',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'project_id', type: 'TEXT', foreignKey: { table: 'projects', column: 'id', onDelete: 'CASCADE' } },
                { name: 'file_path', type: 'TEXT', notNull: true },
                { name: 'file_type', type: 'TEXT', notNull: true },
                { name: 'language', type: 'TEXT' },
                { name: 'lines_of_code', type: 'INTEGER', defaultValue: 0 },
                { name: 'complexity_score', type: 'REAL', defaultValue: 0 },
                { name: 'maintainability_index', type: 'REAL', defaultValue: 0 },
                { name: 'last_modified', type: 'DATETIME' },
                { name: 'analyzed_at', type: 'DATETIME', notNull: true },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_file_analysis_project', columns: ['project_id'] },
                { name: 'idx_file_analysis_path', columns: ['file_path'] },
                { name: 'idx_file_analysis_type', columns: ['file_type'] },
                { name: 'idx_file_analysis_language', columns: ['language'] }
            ]
        },

        // 代碼符號表
        {
            name: 'code_symbols',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'file_analysis_id', type: 'TEXT', notNull: true, foreignKey: { table: 'file_analysis', column: 'id', onDelete: 'CASCADE' } },
                { name: 'name', type: 'TEXT', notNull: true },
                { name: 'kind', type: 'TEXT', notNull: true },
                { name: 'line_start', type: 'INTEGER', notNull: true },
                { name: 'line_end', type: 'INTEGER', notNull: true },
                { name: 'column_start', type: 'INTEGER' },
                { name: 'column_end', type: 'INTEGER' },
                { name: 'parent_symbol_id', type: 'TEXT', foreignKey: { table: 'code_symbols', column: 'id', onDelete: 'CASCADE' } },
                { name: 'detail', type: 'TEXT' },
                { name: 'created_at', type: 'DATETIME', notNull: true }
            ],
            indexes: [
                { name: 'idx_code_symbols_file', columns: ['file_analysis_id'] },
                { name: 'idx_code_symbols_name', columns: ['name'] },
                { name: 'idx_code_symbols_kind', columns: ['kind'] },
                { name: 'idx_code_symbols_parent', columns: ['parent_symbol_id'] }
            ]
        },

        // 問題記錄表
        {
            name: 'diagnostics',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'file_path', type: 'TEXT', notNull: true },
                { name: 'line', type: 'INTEGER', notNull: true },
                { name: 'column', type: 'INTEGER' },
                { name: 'severity', type: 'TEXT', notNull: true },
                { name: 'message', type: 'TEXT', notNull: true },
                { name: 'source', type: 'TEXT' },
                { name: 'code', type: 'TEXT' },
                { name: 'status', type: 'TEXT', defaultValue: 'active' },
                { name: 'first_seen', type: 'DATETIME', notNull: true },
                { name: 'last_seen', type: 'DATETIME', notNull: true },
                { name: 'resolved_at', type: 'DATETIME' },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_diagnostics_file', columns: ['file_path'] },
                { name: 'idx_diagnostics_severity', columns: ['severity'] },
                { name: 'idx_diagnostics_status', columns: ['status'] },
                { name: 'idx_diagnostics_source', columns: ['source'] }
            ]
        },

        // 終端命令歷史表
        {
            name: 'terminal_history',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'command', type: 'TEXT', notNull: true },
                { name: 'working_directory', type: 'TEXT', notNull: true },
                { name: 'exit_code', type: 'INTEGER' },
                { name: 'output', type: 'TEXT' },
                { name: 'error_output', type: 'TEXT' },
                { name: 'execution_time', type: 'INTEGER' },
                { name: 'executed_at', type: 'DATETIME', notNull: true },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_terminal_history_command', columns: ['command'] },
                { name: 'idx_terminal_history_directory', columns: ['working_directory'] },
                { name: 'idx_terminal_history_executed_at', columns: ['executed_at'] }
            ]
        },

        // 配置表
        {
            name: 'configurations',
            columns: [
                { name: 'key', type: 'TEXT', primaryKey: true },
                { name: 'value', type: 'TEXT' },
                { name: 'type', type: 'TEXT', notNull: true },
                { name: 'description', type: 'TEXT' },
                { name: 'created_at', type: 'DATETIME', notNull: true },
                { name: 'updated_at', type: 'DATETIME' }
            ]
        },

        // 搜索歷史表
        {
            name: 'search_history',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'query', type: 'TEXT', notNull: true },
                { name: 'type', type: 'TEXT', notNull: true },
                { name: 'results_count', type: 'INTEGER', defaultValue: 0 },
                { name: 'execution_time', type: 'INTEGER' },
                { name: 'searched_at', type: 'DATETIME', notNull: true },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_search_history_query', columns: ['query'] },
                { name: 'idx_search_history_type', columns: ['type'] },
                { name: 'idx_search_history_searched_at', columns: ['searched_at'] }
            ]
        },

        // 編譯記錄表
        {
            name: 'build_history',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'project_id', type: 'TEXT', foreignKey: { table: 'projects', column: 'id', onDelete: 'CASCADE' } },
                { name: 'build_type', type: 'TEXT', notNull: true },
                { name: 'command', type: 'TEXT', notNull: true },
                { name: 'success', type: 'INTEGER', notNull: true },
                { name: 'duration', type: 'INTEGER' },
                { name: 'output', type: 'TEXT' },
                { name: 'error_output', type: 'TEXT' },
                { name: 'started_at', type: 'DATETIME', notNull: true },
                { name: 'completed_at', type: 'DATETIME' },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_build_history_project', columns: ['project_id'] },
                { name: 'idx_build_history_type', columns: ['build_type'] },
                { name: 'idx_build_history_success', columns: ['success'] },
                { name: 'idx_build_history_started_at', columns: ['started_at'] }
            ]
        },

        // VS Code API 命名空間表
        {
            name: 'vscode_api_namespaces',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'name', type: 'TEXT', notNull: true, unique: true },
                { name: 'description', type: 'TEXT' },
                { name: 'parent_namespace_id', type: 'TEXT', foreignKey: { table: 'vscode_api_namespaces', column: 'id', onDelete: 'CASCADE' } },
                { name: 'url', type: 'TEXT' },
                { name: 'first_discovered', type: 'DATETIME', notNull: true },
                { name: 'last_updated', type: 'DATETIME', notNull: true },
                { name: 'is_active', type: 'INTEGER', defaultValue: 1 },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_api_namespaces_name', columns: ['name'] },
                { name: 'idx_api_namespaces_parent', columns: ['parent_namespace_id'] },
                { name: 'idx_api_namespaces_active', columns: ['is_active'] }
            ]
        },

        // VS Code API 端點表
        {
            name: 'vscode_api_endpoints',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'namespace_id', type: 'TEXT', notNull: true, foreignKey: { table: 'vscode_api_namespaces', column: 'id', onDelete: 'CASCADE' } },
                { name: 'name', type: 'TEXT', notNull: true },
                { name: 'type', type: 'TEXT', notNull: true }, // 'class', 'interface', 'function', 'enum', 'variable'
                { name: 'description', type: 'TEXT' },
                { name: 'signature', type: 'TEXT' },
                { name: 'return_type', type: 'TEXT' },
                { name: 'since_version', type: 'TEXT' },
                { name: 'deprecated', type: 'INTEGER', defaultValue: 0 },
                { name: 'deprecated_since', type: 'TEXT' },
                { name: 'url', type: 'TEXT' },
                { name: 'first_discovered', type: 'DATETIME', notNull: true },
                { name: 'last_updated', type: 'DATETIME', notNull: true },
                { name: 'is_active', type: 'INTEGER', defaultValue: 1 },
                { name: 'usage_count', type: 'INTEGER', defaultValue: 0 },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_api_endpoints_namespace', columns: ['namespace_id'] },
                { name: 'idx_api_endpoints_name', columns: ['name'] },
                { name: 'idx_api_endpoints_type', columns: ['type'] },
                { name: 'idx_api_endpoints_deprecated', columns: ['deprecated'] },
                { name: 'idx_api_endpoints_active', columns: ['is_active'] },
                { name: 'idx_api_endpoints_usage', columns: ['usage_count'] },
                { name: 'idx_api_endpoints_full_name', columns: ['namespace_id', 'name'] }
            ]
        },

        // API 參數表
        {
            name: 'vscode_api_parameters',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'endpoint_id', type: 'TEXT', notNull: true, foreignKey: { table: 'vscode_api_endpoints', column: 'id', onDelete: 'CASCADE' } },
                { name: 'name', type: 'TEXT', notNull: true },
                { name: 'type', type: 'TEXT', notNull: true },
                { name: 'optional', type: 'INTEGER', defaultValue: 0 },
                { name: 'description', type: 'TEXT' },
                { name: 'default_value', type: 'TEXT' },
                { name: 'order_index', type: 'INTEGER', defaultValue: 0 },
                { name: 'created_at', type: 'DATETIME', notNull: true }
            ],
            indexes: [
                { name: 'idx_api_parameters_endpoint', columns: ['endpoint_id'] },
                { name: 'idx_api_parameters_name', columns: ['name'] },
                { name: 'idx_api_parameters_order', columns: ['endpoint_id', 'order_index'] }
            ]
        },

        // API 範例表
        {
            name: 'vscode_api_examples',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'endpoint_id', type: 'TEXT', notNull: true, foreignKey: { table: 'vscode_api_endpoints', column: 'id', onDelete: 'CASCADE' } },
                { name: 'title', type: 'TEXT' },
                { name: 'description', type: 'TEXT' },
                { name: 'code', type: 'TEXT', notNull: true },
                { name: 'language', type: 'TEXT', defaultValue: 'typescript' },
                { name: 'category', type: 'TEXT' },
                { name: 'difficulty', type: 'TEXT' }, // 'beginner', 'intermediate', 'advanced'
                { name: 'order_index', type: 'INTEGER', defaultValue: 0 },
                { name: 'created_at', type: 'DATETIME', notNull: true },
                { name: 'updated_at', type: 'DATETIME' }
            ],
            indexes: [
                { name: 'idx_api_examples_endpoint', columns: ['endpoint_id'] },
                { name: 'idx_api_examples_category', columns: ['category'] },
                { name: 'idx_api_examples_difficulty', columns: ['difficulty'] },
                { name: 'idx_api_examples_order', columns: ['endpoint_id', 'order_index'] }
            ]
        },

        // API 關聯表
        {
            name: 'vscode_api_relations',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'source_endpoint_id', type: 'TEXT', notNull: true, foreignKey: { table: 'vscode_api_endpoints', column: 'id', onDelete: 'CASCADE' } },
                { name: 'target_endpoint_id', type: 'TEXT', notNull: true, foreignKey: { table: 'vscode_api_endpoints', column: 'id', onDelete: 'CASCADE' } },
                { name: 'relation_type', type: 'TEXT', notNull: true }, // 'extends', 'implements', 'uses', 'related', 'deprecated_by'
                { name: 'description', type: 'TEXT' },
                { name: 'created_at', type: 'DATETIME', notNull: true }
            ],
            indexes: [
                { name: 'idx_api_relations_source', columns: ['source_endpoint_id'] },
                { name: 'idx_api_relations_target', columns: ['target_endpoint_id'] },
                { name: 'idx_api_relations_type', columns: ['relation_type'] },
                { name: 'idx_api_relations_unique', columns: ['source_endpoint_id', 'target_endpoint_id', 'relation_type'], unique: true }
            ]
        },

        // API 爬取歷史表
        {
            name: 'api_crawl_history',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'timestamp', type: 'DATETIME', notNull: true },
                { name: 'version', type: 'TEXT', notNull: true },
                { name: 'total_apis', type: 'INTEGER', defaultValue: 0 },
                { name: 'new_apis', type: 'TEXT' }, // JSON array
                { name: 'updated_apis', type: 'TEXT' }, // JSON array
                { name: 'deprecated_apis', type: 'TEXT' }, // JSON array
                { name: 'namespaces', type: 'TEXT' }, // JSON object
                { name: 'crawl_duration', type: 'INTEGER' }, // milliseconds
                { name: 'success', type: 'INTEGER', defaultValue: 1 },
                { name: 'error_message', type: 'TEXT' },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_crawl_history_timestamp', columns: ['timestamp'] },
                { name: 'idx_crawl_history_version', columns: ['version'] },
                { name: 'idx_crawl_history_success', columns: ['success'] }
            ]
        },

        // 擴充套件 API 使用記錄表
        {
            name: 'extension_api_usage',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'endpoint_id', type: 'TEXT', notNull: true, foreignKey: { table: 'vscode_api_endpoints', column: 'id', onDelete: 'CASCADE' } },
                { name: 'file_path', type: 'TEXT', notNull: true },
                { name: 'line_number', type: 'INTEGER' },
                { name: 'usage_context', type: 'TEXT' }, // 使用上下文代碼
                { name: 'usage_type', type: 'TEXT' }, // 'import', 'call', 'instantiate', 'extend'
                { name: 'first_used', type: 'DATETIME', notNull: true },
                { name: 'last_scanned', type: 'DATETIME', notNull: true },
                { name: 'is_active', type: 'INTEGER', defaultValue: 1 },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_extension_usage_endpoint', columns: ['endpoint_id'] },
                { name: 'idx_extension_usage_file', columns: ['file_path'] },
                { name: 'idx_extension_usage_type', columns: ['usage_type'] },
                { name: 'idx_extension_usage_active', columns: ['is_active'] },
                { name: 'idx_extension_usage_unique', columns: ['endpoint_id', 'file_path', 'line_number'], unique: true }
            ]
        },

        // API 覆蓋率分析表
        {
            name: 'api_coverage_analysis',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'analysis_date', type: 'DATETIME', notNull: true },
                { name: 'total_available_apis', type: 'INTEGER', notNull: true },
                { name: 'used_apis_count', type: 'INTEGER', notNull: true },
                { name: 'coverage_percentage', type: 'REAL', notNull: true },
                { name: 'unused_apis', type: 'TEXT' }, // JSON array of unused API IDs
                { name: 'most_used_apis', type: 'TEXT' }, // JSON array of most used API IDs
                { name: 'deprecated_apis_used', type: 'TEXT' }, // JSON array of deprecated API IDs still in use
                { name: 'recommendations', type: 'TEXT' }, // JSON array of recommendations
                { name: 'analysis_duration', type: 'INTEGER' }, // milliseconds
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_coverage_analysis_date', columns: ['analysis_date'] },
                { name: 'idx_coverage_analysis_percentage', columns: ['coverage_percentage'] }
            ]
        },

        // AI 操作日誌表
        {
            name: 'ai_operation_logs',
            columns: [
                { name: 'id', type: 'TEXT', primaryKey: true },
                { name: 'operation_type', type: 'TEXT', notNull: true }, // 'api_call', 'file_operation', 'command_execution'
                { name: 'api_endpoint_id', type: 'TEXT', foreignKey: { table: 'vscode_api_endpoints', column: 'id' } },
                { name: 'operation_details', type: 'TEXT', notNull: true }, // JSON object
                { name: 'parameters', type: 'TEXT' }, // JSON object
                { name: 'result', type: 'TEXT' }, // JSON object
                { name: 'success', type: 'INTEGER', notNull: true },
                { name: 'error_message', type: 'TEXT' },
                { name: 'execution_time', type: 'INTEGER' }, // milliseconds
                { name: 'user_context', type: 'TEXT' }, // User's request context
                { name: 'timestamp', type: 'DATETIME', notNull: true },
                { name: 'metadata', type: 'TEXT' }
            ],
            indexes: [
                { name: 'idx_ai_logs_type', columns: ['operation_type'] },
                { name: 'idx_ai_logs_api', columns: ['api_endpoint_id'] },
                { name: 'idx_ai_logs_success', columns: ['success'] },
                { name: 'idx_ai_logs_timestamp', columns: ['timestamp'] }
            ]
        }
    ]
};

// 數據庫遷移腳本
export const MIGRATION_SCRIPTS: { [version: number]: string[] } = {
    1: [
        // 初始化腳本在 DatabaseManager 中處理
    ]
};
