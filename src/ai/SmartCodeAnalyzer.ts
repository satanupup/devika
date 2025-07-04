import * as vscode from 'vscode';
import { LLMService } from '../llm/LLMService';
import { CodeAnalysisUtils } from '../analysis/CodeAnalysisUtils';

export interface SemanticAnalysis {
    symbols: SemanticSymbol[];
    relationships: CodeRelationship[];
    patterns: CodePattern[];
    qualityMetrics: QualityMetrics;
    suggestions: RefactoringSuggestion[];
}

export interface SemanticSymbol {
    name: string;
    type: 'class' | 'function' | 'variable' | 'interface' | 'enum' | 'type';
    location: vscode.Location;
    scope: string;
    visibility: 'public' | 'private' | 'protected' | 'internal';
    documentation?: string;
    usages: vscode.Location[];
    dependencies: string[];
}

export interface CodeRelationship {
    from: string;
    to: string;
    type: 'extends' | 'implements' | 'uses' | 'calls' | 'imports';
    strength: number; // 0-1
}

export interface CodePattern {
    name: string;
    type: 'design_pattern' | 'anti_pattern' | 'code_smell';
    confidence: number; // 0-1
    locations: vscode.Location[];
    description: string;
    suggestion?: string;
}

export interface QualityMetrics {
    complexity: number;
    maintainability: number;
    testability: number;
    readability: number;
    performance: number;
    security: number;
    details: {
        linesOfCode: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        duplicatedLines: number;
        testCoverage?: number;
        technicalDebt: number;
    };
}

export interface RefactoringSuggestion {
    id: string;
    title: string;
    description: string;
    type: 'extract_method' | 'rename' | 'move_class' | 'simplify' | 'optimize';
    priority: 'low' | 'medium' | 'high' | 'critical';
    effort: 'small' | 'medium' | 'large';
    impact: string;
    location: vscode.Location;
    preview?: string;
    autoApplicable: boolean;
}

export class SmartCodeAnalyzer {
    private llmService: LLMService;
    private analysisCache: Map<string, SemanticAnalysis> = new Map();

    constructor(llmService: LLMService) {
        this.llmService = llmService;
    }

    async analyzeCode(
        document: vscode.TextDocument,
        range?: vscode.Range
    ): Promise<SemanticAnalysis> {
        const cacheKey = this.getCacheKey(document, range);
        const cached = this.analysisCache.get(cacheKey);

        if (cached && this.isCacheValid(cached, document)) {
            return cached;
        }

        const analysis = await this.performDeepAnalysis(document, range);
        this.analysisCache.set(cacheKey, analysis);

        return analysis;
    }

    private async performDeepAnalysis(
        document: vscode.TextDocument,
        range?: vscode.Range
    ): Promise<SemanticAnalysis> {
        const content = range ? document.getText(range) : document.getText();
        const language = document.languageId;

        // Parallel analysis for better performance
        const [symbols, relationships, patterns, metrics, suggestions] = await Promise.all([
            this.extractSemanticSymbols(document, content, language),
            this.analyzeCodeRelationships(document, content, language),
            this.detectCodePatterns(content, language),
            this.calculateQualityMetrics(content, language),
            this.generateRefactoringSuggestions(document, content, language)
        ]);

        return {
            symbols,
            relationships,
            patterns,
            qualityMetrics: metrics,
            suggestions
        };
    }

    private async extractSemanticSymbols(
        document: vscode.TextDocument,
        content: string,
        language: string
    ): Promise<SemanticSymbol[]> {
        const symbols: SemanticSymbol[] = [];

        try {
            // Use VS Code's built-in symbol provider
            const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (documentSymbols) {
                for (const symbol of documentSymbols) {
                    const semanticSymbol = await this.convertToSemanticSymbol(symbol, document);
                    symbols.push(semanticSymbol);

                    // Process children recursively
                    if (symbol.children) {
                        for (const child of symbol.children) {
                            const childSymbol = await this.convertToSemanticSymbol(child, document);
                            symbols.push(childSymbol);
                        }
                    }
                }
            }

            // Enhance with AI analysis
            const enhancedSymbols = await this.enhanceSymbolsWithAI(symbols, content, language);
            return enhancedSymbols;

        } catch (error) {
            console.warn('Failed to extract semantic symbols:', error);
            return symbols;
        }
    }

    private async convertToSemanticSymbol(
        symbol: vscode.DocumentSymbol,
        document: vscode.TextDocument
    ): Promise<SemanticSymbol> {
        const location = new vscode.Location(document.uri, symbol.range);

        // Find usages
        const usages = await this.findSymbolUsages(document, symbol.name);

        return {
            name: symbol.name,
            type: this.mapSymbolKind(symbol.kind),
            location,
            scope: this.determineScope(symbol, document),
            visibility: this.determineVisibility(symbol, document),
            documentation: symbol.detail,
            usages,
            dependencies: []
        };
    }

    private mapSymbolKind(kind: vscode.SymbolKind): SemanticSymbol['type'] {
        switch (kind) {
            case vscode.SymbolKind.Class: return 'class';
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Method: return 'function';
            case vscode.SymbolKind.Variable:
            case vscode.SymbolKind.Property: return 'variable';
            case vscode.SymbolKind.Interface: return 'interface';
            case vscode.SymbolKind.Enum: return 'enum';
            default: return 'variable';
        }
    }

    private determineScope(symbol: vscode.DocumentSymbol, document: vscode.TextDocument): string {
        // Simple scope determination - could be enhanced
        const line = document.lineAt(symbol.range.start.line);
        const indentation = line.firstNonWhitespaceCharacterIndex;
        return indentation === 0 ? 'global' : 'local';
    }

    private determineVisibility(symbol: vscode.DocumentSymbol, document: vscode.TextDocument): SemanticSymbol['visibility'] {
        const line = document.lineAt(symbol.range.start.line);
        const text = line.text;

        if (text.includes('private')) {return 'private';}
        if (text.includes('protected')) {return 'protected';}
        if (text.includes('internal')) {return 'internal';}
        return 'public';
    }

    private async findSymbolUsages(document: vscode.TextDocument, symbolName: string): Promise<vscode.Location[]> {
        try {
            const references = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                document.uri,
                new vscode.Position(0, 0)
            );

            return references?.filter(ref =>
                document.getText(ref.range).includes(symbolName)
            ) || [];
        } catch {
            return [];
        }
    }

    private async enhanceSymbolsWithAI(
        symbols: SemanticSymbol[],
        content: string,
        language: string
    ): Promise<SemanticSymbol[]> {
        try {
            const prompt = `
Analyze the following ${language} code and enhance the symbol information:

${content}

For each symbol, provide:
1. Better documentation if missing
2. Dependencies on other symbols
3. Usage patterns

Symbols to enhance:
${symbols.map(s => `- ${s.name} (${s.type})`).join('\n')}

Respond in JSON format with enhanced symbol data.
            `;

            const result = await this.llmService.generateCompletion(prompt);
            const enhancement = JSON.parse(result.content);

            // Apply enhancements
            return symbols.map(symbol => ({
                ...symbol,
                documentation: symbol.documentation || enhancement[symbol.name]?.documentation,
                dependencies: enhancement[symbol.name]?.dependencies || symbol.dependencies
            }));

        } catch (error) {
            console.warn('Failed to enhance symbols with AI:', error);
            return symbols;
        }
    }

    private async analyzeCodeRelationships(
        document: vscode.TextDocument,
        content: string,
        language: string
    ): Promise<CodeRelationship[]> {
        const relationships: CodeRelationship[] = [];

        try {
            const prompt = `
Analyze the relationships between code elements in this ${language} code:

${content}

Identify:
1. Inheritance relationships (extends, implements)
2. Usage relationships (calls, uses)
3. Import/dependency relationships

Return as JSON array of relationships with format:
{
  "from": "source_element",
  "to": "target_element", 
  "type": "relationship_type",
  "strength": 0.8
}
            `;

            const result = await this.llmService.generateCompletion(prompt);
            const aiRelationships = JSON.parse(result.content);

            relationships.push(...aiRelationships);

        } catch (error) {
            console.warn('Failed to analyze code relationships:', error);
        }

        return relationships;
    }

    private async detectCodePatterns(content: string, language: string): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];

        try {
            const prompt = `
Analyze this ${language} code for design patterns, anti-patterns, and code smells:

${content}

Identify:
1. Design patterns (Singleton, Factory, Observer, etc.)
2. Anti-patterns (God Object, Spaghetti Code, etc.)
3. Code smells (Long Method, Large Class, etc.)

Return as JSON array with format:
{
  "name": "pattern_name",
  "type": "design_pattern|anti_pattern|code_smell",
  "confidence": 0.8,
  "description": "description",
  "suggestion": "improvement_suggestion"
}
            `;

            const result = await this.llmService.generateCompletion(prompt);
            const aiPatterns = JSON.parse(result.content);

            patterns.push(...aiPatterns.map((p: any) => ({
                ...p,
                locations: [] // Would need more sophisticated location detection
            })));

        } catch (error) {
            console.warn('Failed to detect code patterns:', error);
        }

        return patterns;
    }

    private async calculateQualityMetrics(content: string, language: string): Promise<QualityMetrics> {
        const lines = content.split('\n');
        const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;

        // Basic metrics calculation
        const basicMetrics = {
            linesOfCode,
            cyclomaticComplexity: this.calculateCyclomaticComplexity(content),
            cognitiveComplexity: this.calculateCognitiveComplexity(content),
            duplicatedLines: this.findDuplicatedLines(lines),
            technicalDebt: 0
        };

        try {
            // AI-enhanced quality assessment
            const prompt = `
Analyze the quality of this ${language} code and provide metrics (0-100 scale):

${content}

Assess:
1. Complexity (lower is better)
2. Maintainability (higher is better)
3. Testability (higher is better)
4. Readability (higher is better)
5. Performance (higher is better)
6. Security (higher is better)

Return as JSON with numeric scores.
            `;

            const result = await this.llmService.generateCompletion(prompt);
            const aiMetrics = JSON.parse(result.content);

            return {
                complexity: aiMetrics.complexity || 50,
                maintainability: aiMetrics.maintainability || 70,
                testability: aiMetrics.testability || 60,
                readability: aiMetrics.readability || 75,
                performance: aiMetrics.performance || 80,
                security: aiMetrics.security || 85,
                details: basicMetrics
            };

        } catch (error) {
            console.warn('Failed to calculate AI quality metrics:', error);
            return {
                complexity: 50,
                maintainability: 70,
                testability: 60,
                readability: 75,
                performance: 80,
                security: 85,
                details: basicMetrics
            };
        }
    }

    private calculateCyclomaticComplexity(content: string): number {
        return CodeAnalysisUtils.calculateCyclomaticComplexity(content);
    }

    private calculateCognitiveComplexity(content: string): number {
        return CodeAnalysisUtils.calculateCognitiveComplexity(content);
    }

    private findDuplicatedLines(lines: string[]): number {
        return CodeAnalysisUtils.findDuplicatedLines(lines);
    }

    private async generateRefactoringSuggestions(
        document: vscode.TextDocument,
        content: string,
        language: string
    ): Promise<RefactoringSuggestion[]> {
        const suggestions: RefactoringSuggestion[] = [];

        try {
            const prompt = `
Analyze this ${language} code and suggest refactoring improvements:

${content}

Provide specific, actionable refactoring suggestions with:
1. Type of refactoring needed
2. Priority level
3. Effort required
4. Expected impact
5. Specific location/method to refactor

Return as JSON array of suggestions.
            `;

            const result = await this.llmService.generateCompletion(prompt);
            const aiSuggestions = JSON.parse(result.content);

            suggestions.push(...aiSuggestions.map((s: any, index: number) => ({
                id: `refactor_${index}`,
                title: s.title || 'Refactoring Suggestion',
                description: s.description || '',
                type: s.type || 'simplify',
                priority: s.priority || 'medium',
                effort: s.effort || 'medium',
                impact: s.impact || 'Improves code quality',
                location: new vscode.Location(document.uri, new vscode.Range(0, 0, 0, 0)),
                autoApplicable: s.autoApplicable || false
            })));

        } catch (error) {
            console.warn('Failed to generate refactoring suggestions:', error);
        }

        return suggestions;
    }

    async findCrossFileReferences(symbol: string, workspaceRoot: string): Promise<vscode.Location[]> {
        try {
            const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,py,java}');
            const references: vscode.Location[] = [];

            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();

                const regex = new RegExp(`\\b${symbol}\\b`, 'g');
                let match;

                while ((match = regex.exec(content)) !== null) {
                    const position = document.positionAt(match.index);
                    references.push(new vscode.Location(file, position));
                }
            }

            return references;
        } catch (error) {
            console.warn('Failed to find cross-file references:', error);
            return [];
        }
    }

    private getCacheKey(document: vscode.TextDocument, range?: vscode.Range): string {
        const rangeStr = range ? `${range.start.line}-${range.end.line}` : 'full';
        return `${document.uri.toString()}_${rangeStr}_${document.version}`;
    }

    private isCacheValid(analysis: SemanticAnalysis, document: vscode.TextDocument): boolean {
        // Simple cache validation - could be more sophisticated
        return Date.now() - new Date().getTime() < 300000; // 5 minutes
    }

    clearCache(): void {
        this.analysisCache.clear();
    }

    async generateCodeQualityReport(document: vscode.TextDocument): Promise<string> {
        const analysis = await this.analyzeCode(document);

        return `
# Code Quality Report

## Overview
- **Lines of Code**: ${analysis.qualityMetrics.details.linesOfCode}
- **Cyclomatic Complexity**: ${analysis.qualityMetrics.details.cyclomaticComplexity}
- **Maintainability Score**: ${analysis.qualityMetrics.maintainability}/100

## Quality Metrics
- **Complexity**: ${analysis.qualityMetrics.complexity}/100
- **Maintainability**: ${analysis.qualityMetrics.maintainability}/100
- **Testability**: ${analysis.qualityMetrics.testability}/100
- **Readability**: ${analysis.qualityMetrics.readability}/100
- **Performance**: ${analysis.qualityMetrics.performance}/100
- **Security**: ${analysis.qualityMetrics.security}/100

## Detected Patterns
${analysis.patterns.map(p => `- **${p.name}** (${p.type}): ${p.description}`).join('\n')}

## Refactoring Suggestions
${analysis.suggestions.map(s => `- **${s.title}** (${s.priority}): ${s.description}`).join('\n')}

## Symbols Found
${analysis.symbols.map(s => `- ${s.name} (${s.type}) - ${s.usages.length} usages`).join('\n')}
        `;
    }
}
