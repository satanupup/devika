import * as vscode from 'vscode';
import { DependencyAnalyzer, DependencyGraph, DependencyNode } from './DependencyAnalyzer';

export interface GraphNode {
    id: string;
    label: string;
    type: 'production' | 'development' | 'peer' | 'optional';
    version: string;
    size?: number;
    vulnerabilities: number;
    outdated: boolean;
    level: number;
    x?: number;
    y?: number;
}

export interface GraphEdge {
    source: string;
    target: string;
    type: 'dependency' | 'devDependency' | 'peerDependency' | 'optionalDependency';
    weight: number;
}

export interface GraphLayout {
    nodes: GraphNode[];
    edges: GraphEdge[];
    clusters: GraphCluster[];
    metrics: GraphMetrics;
}

export interface GraphCluster {
    id: string;
    label: string;
    nodes: string[];
    color: string;
    type: 'framework' | 'utility' | 'testing' | 'build' | 'other';
}

export interface GraphMetrics {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    circularDependencies: number;
    criticalPath: string[];
    complexity: number;
}

export interface VisualizationOptions {
    layout: 'hierarchical' | 'force' | 'circular' | 'tree';
    showVersions: boolean;
    showVulnerabilities: boolean;
    showOutdated: boolean;
    groupByType: boolean;
    highlightCriticalPath: boolean;
    filterByType?: ('production' | 'development' | 'peer' | 'optional')[];
    maxDepth?: number;
}

export class DependencyGraphGenerator {
    private dependencyAnalyzer: DependencyAnalyzer;

    constructor(private context: vscode.ExtensionContext) {
        this.dependencyAnalyzer = new DependencyAnalyzer(context);
    }

    /**
     * 生成依賴關係圖
     */
    async generateDependencyGraph(
        projectPath: string,
        options: VisualizationOptions = {
            layout: 'hierarchical',
            showVersions: true,
            showVulnerabilities: true,
            showOutdated: true,
            groupByType: true,
            highlightCriticalPath: false
        }
    ): Promise<GraphLayout> {
        // 分析依賴
        const analysis = await this.dependencyAnalyzer.analyzeDependencies(projectPath);

        // 轉換為圖形數據
        const graphLayout = this.convertToGraphLayout(analysis.graph, options);

        // 應用佈局算法
        this.applyLayout(graphLayout, options.layout);

        // 生成集群
        if (options.groupByType) {
            this.generateClusters(graphLayout);
        }

        // 計算指標
        graphLayout.metrics = this.calculateGraphMetrics(graphLayout, analysis.graph);

        return graphLayout;
    }

    /**
     * 轉換為圖形佈局
     */
    private convertToGraphLayout(
        dependencyGraph: DependencyGraph,
        options: VisualizationOptions
    ): GraphLayout {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        // 轉換節點
        for (const [nodeId, depNode] of dependencyGraph.nodes) {
            // 應用過濾器
            if (options.filterByType && !options.filterByType.includes(depNode.type)) {
                continue;
            }

            if (options.maxDepth && depNode.depth > options.maxDepth) {
                continue;
            }

            const graphNode: GraphNode = {
                id: nodeId,
                label: this.formatNodeLabel(depNode, options),
                type: depNode.type,
                version: depNode.version,
                size: depNode.size,
                vulnerabilities: depNode.vulnerabilities.length,
                outdated: depNode.outdated,
                level: depNode.depth
            };

            nodes.push(graphNode);
        }

        // 轉換邊
        for (const edge of dependencyGraph.edges) {
            // 檢查節點是否存在（可能被過濾掉）
            const sourceExists = nodes.some(n => n.id === edge.from);
            const targetExists = nodes.some(n => n.id === edge.to);

            if (sourceExists && targetExists) {
                const graphEdge: GraphEdge = {
                    source: edge.from,
                    target: edge.to,
                    type: this.mapEdgeType(edge.type),
                    weight: 1
                };

                edges.push(graphEdge);
            }
        }

        return {
            nodes,
            edges,
            clusters: [],
            metrics: {
                totalNodes: 0,
                totalEdges: 0,
                maxDepth: 0,
                circularDependencies: 0,
                criticalPath: [],
                complexity: 0
            }
        };
    }

    /**
     * 格式化節點標籤
     */
    private formatNodeLabel(node: DependencyNode, options: VisualizationOptions): string {
        let label = node.name;

        if (options.showVersions) {
            label += `\n${node.version}`;
        }

        const indicators: string[] = [];

        if (options.showVulnerabilities && node.vulnerabilities.length > 0) {
            indicators.push(`🚨 ${node.vulnerabilities.length}`);
        }

        if (options.showOutdated && node.outdated) {
            indicators.push('📅');
        }

        if (indicators.length > 0) {
            label += `\n${indicators.join(' ')}`;
        }

        return label;
    }

    /**
     * 映射邊類型
     */
    private mapEdgeType(type: string): GraphEdge['type'] {
        switch (type) {
            case 'production': return 'dependency';
            case 'development': return 'devDependency';
            case 'peer': return 'peerDependency';
            case 'optional': return 'optionalDependency';
            default: return 'dependency';
        }
    }

    /**
     * 應用佈局算法
     */
    private applyLayout(graphLayout: GraphLayout, layoutType: VisualizationOptions['layout']): void {
        switch (layoutType) {
            case 'hierarchical':
                this.applyHierarchicalLayout(graphLayout);
                break;
            case 'force':
                this.applyForceLayout(graphLayout);
                break;
            case 'circular':
                this.applyCircularLayout(graphLayout);
                break;
            case 'tree':
                this.applyTreeLayout(graphLayout);
                break;
        }
    }

    /**
     * 階層式佈局
     */
    private applyHierarchicalLayout(graphLayout: GraphLayout): void {
        const levelGroups = new Map<number, GraphNode[]>();

        // 按層級分組
        for (const node of graphLayout.nodes) {
            if (!levelGroups.has(node.level)) {
                levelGroups.set(node.level, []);
            }
            levelGroups.get(node.level)!.push(node);
        }

        // 計算位置
        const levelHeight = 100;
        const nodeSpacing = 150;

        for (const [level, nodes] of levelGroups) {
            const y = level * levelHeight;
            const totalWidth = (nodes.length - 1) * nodeSpacing;
            const startX = -totalWidth / 2;

            nodes.forEach((node, index) => {
                node.x = startX + index * nodeSpacing;
                node.y = y;
            });
        }
    }

    /**
     * 力導向佈局
     */
    private applyForceLayout(graphLayout: GraphLayout): void {
        // 簡化的力導向佈局實作
        const nodes = graphLayout.nodes;
        const edges = graphLayout.edges;

        // 初始化隨機位置
        nodes.forEach(node => {
            node.x = Math.random() * 800 - 400;
            node.y = Math.random() * 600 - 300;
        });

        // 簡化的力計算（實際應該使用更複雜的算法）
        for (let iteration = 0; iteration < 100; iteration++) {
            // 排斥力
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const node1 = nodes[i];
                    const node2 = nodes[j];

                    const dx = node2.x! - node1.x!;
                    const dy = node2.y! - node1.y!;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                    const force = 1000 / (distance * distance);
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;

                    node1.x! -= fx;
                    node1.y! -= fy;
                    node2.x! += fx;
                    node2.y! += fy;
                }
            }

            // 吸引力（邊）
            for (const edge of edges) {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);

                if (source && target) {
                    const dx = target.x! - source.x!;
                    const dy = target.y! - source.y!;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                    const force = distance * 0.01;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;

                    source.x! += fx;
                    source.y! += fy;
                    target.x! -= fx;
                    target.y! -= fy;
                }
            }
        }
    }

    /**
     * 圓形佈局
     */
    private applyCircularLayout(graphLayout: GraphLayout): void {
        const nodes = graphLayout.nodes;
        const radius = Math.max(200, nodes.length * 10);
        const angleStep = (2 * Math.PI) / nodes.length;

        nodes.forEach((node, index) => {
            const angle = index * angleStep;
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
        });
    }

    /**
     * 樹狀佈局
     */
    private applyTreeLayout(graphLayout: GraphLayout): void {
        // 找到根節點（沒有入邊的節點）
        const inDegree = new Map<string, number>();

        for (const node of graphLayout.nodes) {
            inDegree.set(node.id, 0);
        }

        for (const edge of graphLayout.edges) {
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        const roots = graphLayout.nodes.filter(node => inDegree.get(node.id) === 0);

        if (roots.length === 0) {
            // 如果沒有根節點，使用第一個節點
            roots.push(graphLayout.nodes[0]);
        }

        // 簡化的樹狀佈局
        this.layoutTree(roots[0], graphLayout, 0, 0, new Set());
    }

    /**
     * 遞歸樹狀佈局
     */
    private layoutTree(
        node: GraphNode,
        graphLayout: GraphLayout,
        x: number,
        y: number,
        visited: Set<string>
    ): void {
        if (visited.has(node.id)) {return;}

        visited.add(node.id);
        node.x = x;
        node.y = y;

        // 找到子節點
        const children = graphLayout.edges
            .filter(edge => edge.source === node.id)
            .map(edge => graphLayout.nodes.find(n => n.id === edge.target))
            .filter(n => n && !visited.has(n.id)) as GraphNode[];

        // 佈局子節點
        const childSpacing = 150;
        const startX = x - (children.length - 1) * childSpacing / 2;

        children.forEach((child, index) => {
            this.layoutTree(
                child,
                graphLayout,
                startX + index * childSpacing,
                y + 100,
                visited
            );
        });
    }

    /**
     * 生成集群
     */
    private generateClusters(graphLayout: GraphLayout): void {
        const clusters = new Map<string, GraphNode[]>();

        // 按類型分組
        for (const node of graphLayout.nodes) {
            const clusterKey = this.getClusterKey(node);
            if (!clusters.has(clusterKey)) {
                clusters.set(clusterKey, []);
            }
            clusters.get(clusterKey)!.push(node);
        }

        // 轉換為集群對象
        graphLayout.clusters = Array.from(clusters.entries()).map(([key, nodes]) => ({
            id: key,
            label: this.getClusterLabel(key),
            nodes: nodes.map(n => n.id),
            color: this.getClusterColor(key),
            type: this.getClusterType(key)
        }));
    }

    /**
     * 獲取集群鍵
     */
    private getClusterKey(node: GraphNode): string {
        // 根據包名推斷類型
        if (node.id.includes('react') || node.id.includes('vue') || node.id.includes('angular')) {
            return 'framework';
        }
        if (node.id.includes('test') || node.id.includes('jest') || node.id.includes('mocha')) {
            return 'testing';
        }
        if (node.id.includes('webpack') || node.id.includes('babel') || node.id.includes('rollup')) {
            return 'build';
        }
        if (node.id.includes('lodash') || node.id.includes('axios') || node.id.includes('moment')) {
            return 'utility';
        }
        return node.type;
    }

    /**
     * 獲取集群標籤
     */
    private getClusterLabel(key: string): string {
        const labels: { [key: string]: string } = {
            'framework': '框架',
            'testing': '測試',
            'build': '構建工具',
            'utility': '工具庫',
            'production': '生產依賴',
            'development': '開發依賴',
            'peer': '對等依賴',
            'optional': '可選依賴'
        };
        return labels[key] || key;
    }

    /**
     * 獲取集群顏色
     */
    private getClusterColor(key: string): string {
        const colors: { [key: string]: string } = {
            'framework': '#ff6b6b',
            'testing': '#4ecdc4',
            'build': '#45b7d1',
            'utility': '#96ceb4',
            'production': '#feca57',
            'development': '#ff9ff3',
            'peer': '#54a0ff',
            'optional': '#5f27cd'
        };
        return colors[key] || '#ddd';
    }

    /**
     * 獲取集群類型
     */
    private getClusterType(key: string): GraphCluster['type'] {
        if (['framework'].includes(key)) {return 'framework';}
        if (['testing'].includes(key)) {return 'testing';}
        if (['build'].includes(key)) {return 'build';}
        if (['utility'].includes(key)) {return 'utility';}
        return 'other';
    }

    /**
     * 計算圖形指標
     */
    private calculateGraphMetrics(graphLayout: GraphLayout, dependencyGraph: DependencyGraph): GraphMetrics {
        const maxDepth = Math.max(...graphLayout.nodes.map(n => n.level));
        const criticalPath = this.findCriticalPath(graphLayout);
        const complexity = this.calculateComplexity(graphLayout);

        return {
            totalNodes: graphLayout.nodes.length,
            totalEdges: graphLayout.edges.length,
            maxDepth,
            circularDependencies: dependencyGraph.circularDependencies.length,
            criticalPath,
            complexity
        };
    }

    /**
     * 找到關鍵路徑
     */
    private findCriticalPath(graphLayout: GraphLayout): string[] {
        // 簡化的關鍵路徑算法
        // 找到最長的依賴鏈
        const visited = new Set<string>();
        let longestPath: string[] = [];

        for (const node of graphLayout.nodes) {
            if (node.level === 0) { // 根節點
                const path = this.dfsLongestPath(node.id, graphLayout, visited, []);
                if (path.length > longestPath.length) {
                    longestPath = path;
                }
            }
        }

        return longestPath;
    }

    /**
     * DFS 找最長路徑
     */
    private dfsLongestPath(
        nodeId: string,
        graphLayout: GraphLayout,
        visited: Set<string>,
        currentPath: string[]
    ): string[] {
        if (visited.has(nodeId)) {
            return currentPath;
        }

        visited.add(nodeId);
        currentPath.push(nodeId);

        let longestPath = [...currentPath];

        // 找到所有子節點
        const children = graphLayout.edges
            .filter(edge => edge.source === nodeId)
            .map(edge => edge.target);

        for (const child of children) {
            const path = this.dfsLongestPath(child, graphLayout, new Set(visited), [...currentPath]);
            if (path.length > longestPath.length) {
                longestPath = path;
            }
        }

        return longestPath;
    }

    /**
     * 計算複雜度
     */
    private calculateComplexity(graphLayout: GraphLayout): number {
        // 基於節點數、邊數和最大深度的複雜度計算
        const nodeCount = graphLayout.nodes.length;
        const edgeCount = graphLayout.edges.length;
        const maxDepth = Math.max(...graphLayout.nodes.map(n => n.level));

        return Math.round((nodeCount + edgeCount * 2 + maxDepth * 5) / 10);
    }

    /**
     * 導出圖形數據
     */
    async exportGraph(
        graphLayout: GraphLayout,
        format: 'json' | 'dot' | 'svg' | 'png' = 'json'
    ): Promise<string> {
        switch (format) {
            case 'json':
                return JSON.stringify(graphLayout, null, 2);
            case 'dot':
                return this.convertToDot(graphLayout);
            case 'svg':
                return this.convertToSVG(graphLayout);
            default:
                throw new Error(`不支援的格式: ${format}`);
        }
    }

    /**
     * 轉換為 DOT 格式
     */
    private convertToDot(graphLayout: GraphLayout): string {
        let dot = 'digraph dependencies {\n';
        dot += '  rankdir=TB;\n';
        dot += '  node [shape=box];\n\n';

        // 添加節點
        for (const node of graphLayout.nodes) {
            const color = node.vulnerabilities > 0 ? 'red' : node.outdated ? 'orange' : 'lightblue';
            dot += `  "${node.id}" [label="${node.label}" fillcolor="${color}" style="filled"];\n`;
        }

        dot += '\n';

        // 添加邊
        for (const edge of graphLayout.edges) {
            const style = edge.type === 'devDependency' ? 'dashed' : 'solid';
            dot += `  "${edge.source}" -> "${edge.target}" [style="${style}"];\n`;
        }

        dot += '}\n';
        return dot;
    }

    /**
     * 轉換為 SVG 格式
     */
    private convertToSVG(graphLayout: GraphLayout): string {
        // 簡化的 SVG 生成
        let svg = '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">\n';

        // 添加邊
        for (const edge of graphLayout.edges) {
            const source = graphLayout.nodes.find(n => n.id === edge.source);
            const target = graphLayout.nodes.find(n => n.id === edge.target);

            if (source && target) {
                svg += `  <line x1="${source.x! + 400}" y1="${source.y! + 300}" `;
                svg += `x2="${target.x! + 400}" y2="${target.y! + 300}" `;
                svg += `stroke="black" stroke-width="1"/>\n`;
            }
        }

        // 添加節點
        for (const node of graphLayout.nodes) {
            const color = node.vulnerabilities > 0 ? 'red' : node.outdated ? 'orange' : 'lightblue';
            svg += `  <circle cx="${node.x! + 400}" cy="${node.y! + 300}" r="20" `;
            svg += `fill="${color}" stroke="black"/>\n`;
            svg += `  <text x="${node.x! + 400}" y="${node.y! + 305}" `;
            svg += `text-anchor="middle" font-size="10">${node.id}</text>\n`;
        }

        svg += '</svg>\n';
        return svg;
    }
}
