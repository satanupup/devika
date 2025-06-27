import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface DependencyNode {
    name: string;
    version: string;
    type: 'production' | 'development' | 'peer' | 'optional';
    source: string;
    dependencies: DependencyNode[];
    dependents: string[];
    isCircular: boolean;
    depth: number;
    size?: number;
    license?: string;
    vulnerabilities: SecurityVulnerability[];
    outdated: boolean;
    latestVersion?: string;
}

export interface SecurityVulnerability {
    id: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
    description: string;
    affectedVersions: string;
    patchedVersions?: string;
    references: string[];
    cwe?: string[];
    cvss?: number;
}

export interface DependencyGraph {
    nodes: Map<string, DependencyNode>;
    edges: Array<{ from: string; to: string; type: string }>;
    circularDependencies: string[][];
    totalSize: number;
    vulnerabilityCount: number;
    outdatedCount: number;
}

export interface DependencyAnalysisResult {
    graph: DependencyGraph;
    statistics: DependencyStatistics;
    recommendations: DependencyRecommendation[];
    securityReport: SecurityReport;
}

export interface DependencyStatistics {
    totalDependencies: number;
    directDependencies: number;
    transitiveDependencies: number;
    productionDependencies: number;
    developmentDependencies: number;
    peerDependencies: number;
    optionalDependencies: number;
    duplicatedDependencies: number;
    averageDepth: number;
    maxDepth: number;
    totalSize: number;
}

export interface DependencyRecommendation {
    type: 'update' | 'remove' | 'replace' | 'security' | 'optimization';
    priority: 'high' | 'medium' | 'low';
    dependency: string;
    currentVersion: string;
    recommendedVersion?: string;
    reason: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
}

export interface SecurityReport {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    moderateVulnerabilities: number;
    lowVulnerabilities: number;
    affectedDependencies: string[];
    recommendations: SecurityRecommendation[];
}

export interface SecurityRecommendation {
    dependency: string;
    vulnerability: SecurityVulnerability;
    action: 'update' | 'replace' | 'remove';
    targetVersion?: string;
    alternativePackage?: string;
}

export class DependencyAnalyzer {
    private cache: Map<string, DependencyAnalysisResult> = new Map();
    private vulnerabilityDatabase: Map<string, SecurityVulnerability[]> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.loadVulnerabilityDatabase();
    }

    /**
     * 分析項目依賴
     */
    async analyzeDependencies(projectPath: string): Promise<DependencyAnalysisResult> {
        // 檢查緩存
        const cached = this.cache.get(projectPath);
        if (cached && this.isCacheValid(projectPath)) {
            return cached;
        }

        try {
            // 檢測項目類型
            const projectType = await this.detectProjectType(projectPath);
            
            // 構建依賴圖
            const graph = await this.buildDependencyGraph(projectPath, projectType);
            
            // 計算統計信息
            const statistics = this.calculateStatistics(graph);
            
            // 生成建議
            const recommendations = await this.generateRecommendations(graph);
            
            // 生成安全報告
            const securityReport = this.generateSecurityReport(graph);

            const result: DependencyAnalysisResult = {
                graph,
                statistics,
                recommendations,
                securityReport
            };

            // 緩存結果
            this.cache.set(projectPath, result);

            return result;

        } catch (error) {
            console.error('依賴分析失敗:', error);
            throw error;
        }
    }

    /**
     * 構建依賴圖
     */
    private async buildDependencyGraph(projectPath: string, projectType: string): Promise<DependencyGraph> {
        const nodes = new Map<string, DependencyNode>();
        const edges: Array<{ from: string; to: string; type: string }> = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const circularDependencies: string[][] = [];

        // 根據項目類型解析依賴
        const rootDependencies = await this.parseRootDependencies(projectPath, projectType);

        // 遞歸構建依賴樹
        for (const dep of rootDependencies) {
            await this.buildDependencyNode(
                dep, 
                nodes, 
                edges, 
                visited, 
                visiting, 
                circularDependencies, 
                0,
                projectPath
            );
        }

        // 計算總大小和漏洞數量
        let totalSize = 0;
        let vulnerabilityCount = 0;
        let outdatedCount = 0;

        for (const node of nodes.values()) {
            totalSize += node.size || 0;
            vulnerabilityCount += node.vulnerabilities.length;
            if (node.outdated) {
                outdatedCount++;
            }
        }

        return {
            nodes,
            edges,
            circularDependencies,
            totalSize,
            vulnerabilityCount,
            outdatedCount
        };
    }

    /**
     * 遞歸構建依賴節點
     */
    private async buildDependencyNode(
        dependency: any,
        nodes: Map<string, DependencyNode>,
        edges: Array<{ from: string; to: string; type: string }>,
        visited: Set<string>,
        visiting: Set<string>,
        circularDependencies: string[][],
        depth: number,
        projectPath: string,
        parent?: string
    ): Promise<void> {
        const nodeId = `${dependency.name}@${dependency.version}`;

        // 檢測循環依賴
        if (visiting.has(nodeId)) {
            const cycle = Array.from(visiting).concat(nodeId);
            circularDependencies.push(cycle);
            return;
        }

        // 如果已經訪問過，只添加邊
        if (visited.has(nodeId)) {
            if (parent) {
                edges.push({
                    from: parent,
                    to: nodeId,
                    type: dependency.type
                });
            }
            return;
        }

        visiting.add(nodeId);

        // 獲取依賴信息
        const vulnerabilities = await this.getVulnerabilities(dependency.name, dependency.version);
        const latestVersion = await this.getLatestVersion(dependency.name);
        const outdated = this.isOutdated(dependency.version, latestVersion);
        const size = await this.getPackageSize(dependency.name, dependency.version);
        const license = await this.getPackageLicense(dependency.name, dependency.version);

        // 創建節點
        const node: DependencyNode = {
            name: dependency.name,
            version: dependency.version,
            type: dependency.type,
            source: dependency.source,
            dependencies: [],
            dependents: [],
            isCircular: false,
            depth,
            size,
            license,
            vulnerabilities,
            outdated,
            latestVersion
        };

        nodes.set(nodeId, node);
        visited.add(nodeId);

        // 添加邊
        if (parent) {
            edges.push({
                from: parent,
                to: nodeId,
                type: dependency.type
            });
            
            // 更新依賴關係
            const parentNode = nodes.get(parent);
            if (parentNode) {
                parentNode.dependencies.push(node);
            }
            node.dependents.push(parent);
        }

        // 遞歸處理子依賴
        const childDependencies = await this.getChildDependencies(
            dependency.name, 
            dependency.version, 
            projectPath
        );

        for (const childDep of childDependencies) {
            await this.buildDependencyNode(
                childDep,
                nodes,
                edges,
                visited,
                visiting,
                circularDependencies,
                depth + 1,
                projectPath,
                nodeId
            );
        }

        visiting.delete(nodeId);
    }

    /**
     * 解析根依賴
     */
    private async parseRootDependencies(projectPath: string, projectType: string): Promise<any[]> {
        switch (projectType) {
            case 'nodejs':
                return this.parsePackageJsonDependencies(projectPath);
            case 'python':
                return this.parsePythonDependencies(projectPath);
            case 'java':
                return this.parseJavaDependencies(projectPath);
            case 'csharp':
                return this.parseCSharpDependencies(projectPath);
            case 'go':
                return this.parseGoDependencies(projectPath);
            case 'rust':
                return this.parseRustDependencies(projectPath);
            default:
                return [];
        }
    }

    /**
     * 解析 package.json 依賴
     */
    private async parsePackageJsonDependencies(projectPath: string): Promise<any[]> {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const content = await fs.promises.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);

            const dependencies: any[] = [];

            // 生產依賴
            if (packageJson.dependencies) {
                for (const [name, version] of Object.entries(packageJson.dependencies)) {
                    dependencies.push({
                        name,
                        version: version as string,
                        type: 'production',
                        source: 'package.json'
                    });
                }
            }

            // 開發依賴
            if (packageJson.devDependencies) {
                for (const [name, version] of Object.entries(packageJson.devDependencies)) {
                    dependencies.push({
                        name,
                        version: version as string,
                        type: 'development',
                        source: 'package.json'
                    });
                }
            }

            // 對等依賴
            if (packageJson.peerDependencies) {
                for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
                    dependencies.push({
                        name,
                        version: version as string,
                        type: 'peer',
                        source: 'package.json'
                    });
                }
            }

            // 可選依賴
            if (packageJson.optionalDependencies) {
                for (const [name, version] of Object.entries(packageJson.optionalDependencies)) {
                    dependencies.push({
                        name,
                        version: version as string,
                        type: 'optional',
                        source: 'package.json'
                    });
                }
            }

            return dependencies;

        } catch (error) {
            console.error('解析 package.json 失敗:', error);
            return [];
        }
    }

    /**
     * 計算統計信息
     */
    private calculateStatistics(graph: DependencyGraph): DependencyStatistics {
        const nodes = Array.from(graph.nodes.values());
        
        let totalDepth = 0;
        let maxDepth = 0;
        let directCount = 0;

        for (const node of nodes) {
            totalDepth += node.depth;
            maxDepth = Math.max(maxDepth, node.depth);
            if (node.depth === 0) {
                directCount++;
            }
        }

        const typeCount = {
            production: 0,
            development: 0,
            peer: 0,
            optional: 0
        };

        for (const node of nodes) {
            typeCount[node.type]++;
        }

        // 檢測重複依賴
        const nameCount = new Map<string, number>();
        for (const node of nodes) {
            nameCount.set(node.name, (nameCount.get(node.name) || 0) + 1);
        }
        const duplicatedCount = Array.from(nameCount.values()).filter(count => count > 1).length;

        return {
            totalDependencies: nodes.length,
            directDependencies: directCount,
            transitiveDependencies: nodes.length - directCount,
            productionDependencies: typeCount.production,
            developmentDependencies: typeCount.development,
            peerDependencies: typeCount.peer,
            optionalDependencies: typeCount.optional,
            duplicatedDependencies: duplicatedCount,
            averageDepth: nodes.length > 0 ? totalDepth / nodes.length : 0,
            maxDepth,
            totalSize: graph.totalSize
        };
    }

    /**
     * 生成建議
     */
    private async generateRecommendations(graph: DependencyGraph): Promise<DependencyRecommendation[]> {
        const recommendations: DependencyRecommendation[] = [];

        for (const node of graph.nodes.values()) {
            // 過時依賴建議
            if (node.outdated && node.latestVersion) {
                recommendations.push({
                    type: 'update',
                    priority: 'medium',
                    dependency: node.name,
                    currentVersion: node.version,
                    recommendedVersion: node.latestVersion,
                    reason: '依賴版本過時',
                    impact: '獲得新功能和錯誤修復',
                    effort: 'low'
                });
            }

            // 安全漏洞建議
            for (const vuln of node.vulnerabilities) {
                const priority = vuln.severity === 'critical' || vuln.severity === 'high' ? 'high' : 'medium';
                
                recommendations.push({
                    type: 'security',
                    priority,
                    dependency: node.name,
                    currentVersion: node.version,
                    recommendedVersion: vuln.patchedVersions,
                    reason: `安全漏洞: ${vuln.title}`,
                    impact: `修復 ${vuln.severity} 級別安全漏洞`,
                    effort: 'medium'
                });
            }

            // 未使用依賴建議
            if (node.dependents.length === 0 && node.depth === 0) {
                recommendations.push({
                    type: 'remove',
                    priority: 'low',
                    dependency: node.name,
                    currentVersion: node.version,
                    reason: '依賴似乎未被使用',
                    impact: '減少包大小和潛在安全風險',
                    effort: 'low'
                });
            }
        }

        // 循環依賴建議
        for (const cycle of graph.circularDependencies) {
            recommendations.push({
                type: 'optimization',
                priority: 'medium',
                dependency: cycle.join(' -> '),
                currentVersion: '',
                reason: '檢測到循環依賴',
                impact: '改善代碼結構和構建性能',
                effort: 'high'
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * 生成安全報告
     */
    private generateSecurityReport(graph: DependencyGraph): SecurityReport {
        const vulnerabilities = new Map<string, SecurityVulnerability>();
        const affectedDependencies = new Set<string>();
        const recommendations: SecurityRecommendation[] = [];

        let criticalCount = 0;
        let highCount = 0;
        let moderateCount = 0;
        let lowCount = 0;

        for (const node of graph.nodes.values()) {
            for (const vuln of node.vulnerabilities) {
                vulnerabilities.set(vuln.id, vuln);
                affectedDependencies.add(node.name);

                switch (vuln.severity) {
                    case 'critical':
                        criticalCount++;
                        break;
                    case 'high':
                        highCount++;
                        break;
                    case 'moderate':
                        moderateCount++;
                        break;
                    case 'low':
                        lowCount++;
                        break;
                }

                // 生成安全建議
                recommendations.push({
                    dependency: node.name,
                    vulnerability: vuln,
                    action: vuln.patchedVersions ? 'update' : 'replace',
                    targetVersion: vuln.patchedVersions
                });
            }
        }

        return {
            totalVulnerabilities: vulnerabilities.size,
            criticalVulnerabilities: criticalCount,
            highVulnerabilities: highCount,
            moderateVulnerabilities: moderateCount,
            lowVulnerabilities: lowCount,
            affectedDependencies: Array.from(affectedDependencies),
            recommendations
        };
    }

    /**
     * 檢測項目類型
     */
    private async detectProjectType(projectPath: string): Promise<string> {
        const files = await fs.promises.readdir(projectPath);
        
        if (files.includes('package.json')) return 'nodejs';
        if (files.includes('requirements.txt') || files.includes('setup.py')) return 'python';
        if (files.includes('pom.xml') || files.includes('build.gradle')) return 'java';
        if (files.some(f => f.endsWith('.csproj'))) return 'csharp';
        if (files.includes('go.mod')) return 'go';
        if (files.includes('Cargo.toml')) return 'rust';
        
        return 'unknown';
    }

    /**
     * 輔助方法（需要實際實作）
     */
    private async getVulnerabilities(name: string, version: string): Promise<SecurityVulnerability[]> {
        return this.vulnerabilityDatabase.get(`${name}@${version}`) || [];
    }

    private async getLatestVersion(name: string): Promise<string | undefined> {
        // 實際實作中應該查詢包註冊表
        return undefined;
    }

    private isOutdated(currentVersion: string, latestVersion?: string): boolean {
        // 簡化的版本比較
        return latestVersion ? currentVersion !== latestVersion : false;
    }

    private async getPackageSize(name: string, version: string): Promise<number | undefined> {
        // 實際實作中應該查詢包大小
        return undefined;
    }

    private async getPackageLicense(name: string, version: string): Promise<string | undefined> {
        // 實際實作中應該查詢包許可證
        return undefined;
    }

    private async getChildDependencies(name: string, version: string, projectPath: string): Promise<any[]> {
        // 實際實作中應該解析子依賴
        return [];
    }

    private async loadVulnerabilityDatabase(): Promise<void> {
        // 載入漏洞數據庫
    }

    private isCacheValid(projectPath: string): boolean {
        // 檢查緩存是否有效
        return false;
    }

    // 其他項目類型的依賴解析方法（佔位符）
    private async parsePythonDependencies(projectPath: string): Promise<any[]> { return []; }
    private async parseJavaDependencies(projectPath: string): Promise<any[]> { return []; }
    private async parseCSharpDependencies(projectPath: string): Promise<any[]> { return []; }
    private async parseGoDependencies(projectPath: string): Promise<any[]> { return []; }
    private async parseRustDependencies(projectPath: string): Promise<any[]> { return []; }
}
