import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface EnhancedPlugin {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    main: string;
    enabled: boolean;
    dependencies: string[];
    permissions: PluginPermission[];
    metadata: PluginMetadata;
    instance?: any;
}

export interface PluginMetadata {
    category: PluginCategory;
    tags: string[];
    homepage?: string;
    repository?: string;
    license: string;
    engines: { [key: string]: string };
    activationEvents: string[];
    contributes: PluginContributions;
    installDate: Date;
    lastUsed?: Date;
    usageCount: number;
}

export interface PluginContributions {
    commands?: PluginCommand[];
    menus?: PluginMenu[];
    keybindings?: PluginKeybinding[];
    languages?: PluginLanguage[];
    themes?: PluginTheme[];
    snippets?: PluginSnippet[];
    grammars?: PluginGrammar[];
    debuggers?: PluginDebugger[];
}

export interface PluginCommand {
    command: string;
    title: string;
    category?: string;
    icon?: string;
    enablement?: string;
}

export interface PluginMenu {
    commandPalette?: PluginMenuItem[];
    editor?: PluginMenuItem[];
    explorer?: PluginMenuItem[];
}

export interface PluginMenuItem {
    command: string;
    when?: string;
    group?: string;
}

export interface PluginKeybinding {
    command: string;
    key: string;
    mac?: string;
    linux?: string;
    when?: string;
}

export interface PluginLanguage {
    id: string;
    aliases: string[];
    extensions: string[];
    configuration?: string;
}

export interface PluginTheme {
    label: string;
    uiTheme: 'vs' | 'vs-dark' | 'hc-black';
    path: string;
}

export interface PluginSnippet {
    language: string;
    path: string;
}

export interface PluginGrammar {
    language: string;
    scopeName: string;
    path: string;
}

export interface PluginDebugger {
    type: string;
    label: string;
    program: string;
    runtime?: string;
}

export enum PluginCategory {
    Language = 'language',
    Theme = 'theme',
    Debugger = 'debugger',
    Formatter = 'formatter',
    Linter = 'linter',
    Snippet = 'snippet',
    Keybinding = 'keybinding',
    Other = 'other'
}

export enum PluginPermission {
    FileSystem = 'filesystem',
    Network = 'network',
    Terminal = 'terminal',
    Workspace = 'workspace',
    Settings = 'settings',
    Extensions = 'extensions'
}

export interface PluginAPI {
    vscode: typeof vscode;
    registerCommand: (command: string, callback: (...args: any[]) => any) => vscode.Disposable;
    registerProvider: (selector: vscode.DocumentSelector, provider: any) => vscode.Disposable;
    showMessage: (message: string, type?: 'info' | 'warning' | 'error') => void;
    getWorkspaceFolder: () => vscode.WorkspaceFolder | undefined;
    getActiveEditor: () => vscode.TextEditor | undefined;
    onDidChangeActiveEditor: vscode.Event<vscode.TextEditor | undefined>;
    onDidChangeTextDocument: vscode.Event<vscode.TextDocumentChangeEvent>;
}

export interface PluginLoadResult {
    success: boolean;
    plugin?: EnhancedPlugin;
    error?: string;
}

export class EnhancedPluginManager {
    private plugins: Map<string, EnhancedPlugin> = new Map();
    private pluginInstances: Map<string, any> = new Map();
    private pluginDirectory: string;
    private disposables: vscode.Disposable[] = [];

    private onPluginLoadedEmitter = new vscode.EventEmitter<EnhancedPlugin>();
    public readonly onPluginLoaded = this.onPluginLoadedEmitter.event;

    private onPluginUnloadedEmitter = new vscode.EventEmitter<string>();
    public readonly onPluginUnloaded = this.onPluginUnloadedEmitter.event;

    constructor(private context: vscode.ExtensionContext) {
        this.pluginDirectory = path.join(context.globalStorageUri.fsPath, 'plugins');
        this.ensurePluginDirectory();
        this.loadInstalledPlugins();
    }

    /**
     * 確保插件目錄存在
     */
    private async ensurePluginDirectory(): Promise<void> {
        try {
            await fs.promises.mkdir(this.pluginDirectory, { recursive: true });
        } catch (error) {
            console.error('創建插件目錄失敗:', error);
        }
    }

    /**
     * 載入已安裝的插件
     */
    private async loadInstalledPlugins(): Promise<void> {
        try {
            const pluginDirs = await fs.promises.readdir(this.pluginDirectory);
            
            for (const dir of pluginDirs) {
                const pluginPath = path.join(this.pluginDirectory, dir);
                const stat = await fs.promises.stat(pluginPath);
                
                if (stat.isDirectory()) {
                    await this.loadPlugin(pluginPath);
                }
            }
        } catch (error) {
            console.error('載入插件失敗:', error);
        }
    }

    /**
     * 載入單個插件
     */
    async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
        try {
            // 讀取插件清單
            const manifestPath = path.join(pluginPath, 'package.json');
            const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestContent);

            // 驗證插件清單
            const validationError = this.validatePluginManifest(manifest);
            if (validationError) {
                return { success: false, error: validationError };
            }

            // 創建插件對象
            const plugin: EnhancedPlugin = {
                id: manifest.name,
                name: manifest.displayName || manifest.name,
                version: manifest.version,
                description: manifest.description || '',
                author: manifest.author || '',
                main: manifest.main || 'index.js',
                enabled: true,
                dependencies: manifest.dependencies ? Object.keys(manifest.dependencies) : [],
                permissions: this.parsePermissions(manifest.permissions || []),
                metadata: {
                    category: this.parseCategory(manifest.category),
                    tags: manifest.keywords || [],
                    homepage: manifest.homepage,
                    repository: manifest.repository?.url,
                    license: manifest.license || 'Unknown',
                    engines: manifest.engines || {},
                    activationEvents: manifest.activationEvents || [],
                    contributes: this.parseContributions(manifest.contributes || {}),
                    installDate: new Date(),
                    usageCount: 0
                }
            };

            // 檢查依賴
            const dependencyError = await this.checkDependencies(plugin);
            if (dependencyError) {
                return { success: false, error: dependencyError };
            }

            // 載入插件代碼
            const loadError = await this.loadPluginCode(plugin, pluginPath);
            if (loadError) {
                return { success: false, error: loadError };
            }

            // 註冊插件
            this.plugins.set(plugin.id, plugin);

            // 如果插件啟用，激活它
            if (plugin.enabled) {
                await this.activatePlugin(plugin.id);
            }

            this.onPluginLoadedEmitter.fire(plugin);
            console.log(`插件載入成功: ${plugin.name} v${plugin.version}`);

            return { success: true, plugin };

        } catch (error) {
            const errorMessage = `載入插件失敗: ${error}`;
            console.error(errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * 載入插件代碼
     */
    private async loadPluginCode(plugin: EnhancedPlugin, pluginPath: string): Promise<string | null> {
        try {
            const mainPath = path.join(pluginPath, plugin.main);
            
            // 檢查主文件是否存在
            await fs.promises.access(mainPath);

            // 動態載入插件模組
            delete require.cache[require.resolve(mainPath)];
            const pluginModule = require(mainPath);

            // 驗證插件導出
            if (typeof pluginModule.activate !== 'function') {
                return '插件必須導出 activate 函數';
            }

            plugin.instance = pluginModule;
            return null;

        } catch (error) {
            return `載入插件代碼失敗: ${error}`;
        }
    }

    /**
     * 激活插件
     */
    async activatePlugin(pluginId: string): Promise<boolean> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin || !plugin.instance) {
            return false;
        }

        try {
            // 創建插件 API
            const pluginAPI = this.createPluginAPI(plugin);

            // 調用插件的 activate 函數
            const result = await plugin.instance.activate(pluginAPI);
            
            // 存儲插件實例
            this.pluginInstances.set(pluginId, result);

            // 註冊插件貢獻
            await this.registerPluginContributions(plugin);

            // 更新使用統計
            plugin.metadata.lastUsed = new Date();
            plugin.metadata.usageCount++;

            console.log(`插件激活成功: ${plugin.name}`);
            return true;

        } catch (error) {
            console.error(`激活插件失敗: ${plugin.name}`, error);
            return false;
        }
    }

    /**
     * 創建插件 API
     */
    private createPluginAPI(plugin: EnhancedPlugin): PluginAPI {
        return {
            vscode,
            registerCommand: (command: string, callback: (...args: any[]) => any) => {
                const disposable = vscode.commands.registerCommand(command, callback);
                this.disposables.push(disposable);
                return disposable;
            },
            registerProvider: (selector: vscode.DocumentSelector, provider: any) => {
                // 這裡需要根據 provider 類型註冊不同的提供者
                return new vscode.Disposable(() => {});
            },
            showMessage: (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
                switch (type) {
                    case 'info':
                        vscode.window.showInformationMessage(message);
                        break;
                    case 'warning':
                        vscode.window.showWarningMessage(message);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message);
                        break;
                }
            },
            getWorkspaceFolder: () => vscode.workspace.workspaceFolders?.[0],
            getActiveEditor: () => vscode.window.activeTextEditor,
            onDidChangeActiveEditor: vscode.window.onDidChangeActiveTextEditor,
            onDidChangeTextDocument: vscode.workspace.onDidChangeTextDocument
        };
    }

    /**
     * 獲取所有插件
     */
    getAllPlugins(): EnhancedPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * 獲取啟用的插件
     */
    getEnabledPlugins(): EnhancedPlugin[] {
        return Array.from(this.plugins.values()).filter(plugin => plugin.enabled);
    }

    /**
     * 輔助方法
     */
    private validatePluginManifest(manifest: any): string | null {
        if (!manifest.name) return '插件清單缺少 name 字段';
        if (!manifest.version) return '插件清單缺少 version 字段';
        if (!manifest.description) return '插件清單缺少 description 字段';
        return null;
    }

    private async checkDependencies(plugin: EnhancedPlugin): Promise<string | null> {
        return null;
    }

    private parsePermissions(permissions: string[]): PluginPermission[] {
        return permissions.map(permission => {
            switch (permission) {
                case 'filesystem': return PluginPermission.FileSystem;
                case 'network': return PluginPermission.Network;
                case 'terminal': return PluginPermission.Terminal;
                case 'workspace': return PluginPermission.Workspace;
                case 'settings': return PluginPermission.Settings;
                case 'extensions': return PluginPermission.Extensions;
                default: return PluginPermission.FileSystem;
            }
        });
    }

    private parseCategory(category: string): PluginCategory {
        switch (category) {
            case 'language': return PluginCategory.Language;
            case 'theme': return PluginCategory.Theme;
            case 'debugger': return PluginCategory.Debugger;
            case 'formatter': return PluginCategory.Formatter;
            case 'linter': return PluginCategory.Linter;
            case 'snippet': return PluginCategory.Snippet;
            case 'keybinding': return PluginCategory.Keybinding;
            default: return PluginCategory.Other;
        }
    }

    private parseContributions(contributes: any): PluginContributions {
        return {
            commands: contributes.commands || [],
            menus: contributes.menus || {},
            keybindings: contributes.keybindings || [],
            languages: contributes.languages || [],
            themes: contributes.themes || [],
            snippets: contributes.snippets || [],
            grammars: contributes.grammars || [],
            debuggers: contributes.debuggers || []
        };
    }

    private async registerPluginContributions(plugin: EnhancedPlugin): Promise<void> {
        // 註冊插件貢獻
    }

    /**
     * 清理資源
     */
    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.onPluginLoadedEmitter.dispose();
        this.onPluginUnloadedEmitter.dispose();
    }
}
