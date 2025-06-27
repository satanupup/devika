import * as vscode from 'vscode';
import * as path from 'path';

export interface FileEdit {
    filePath: string;
    type: 'create' | 'modify' | 'delete';
    content?: string;
    changes?: TextEdit[];
    backup?: string; // Original content for rollback
}

export interface TextEdit {
    range: vscode.Range;
    newText: string;
    description?: string;
}

export interface FileDependency {
    filePath: string;
    dependencies: string[];
    dependents: string[];
    type: 'import' | 'reference' | 'config' | 'asset';
}

export interface BatchEditResult {
    success: boolean;
    completedEdits: FileEdit[];
    failedEdits: { edit: FileEdit; error: string }[];
    conflicts: ConflictInfo[];
}

export interface ConflictInfo {
    filePath: string;
    type: 'concurrent_edit' | 'dependency_conflict' | 'syntax_error';
    description: string;
    suggestions: string[];
}

export class MultiFileEditor {
    private dependencyGraph: Map<string, FileDependency> = new Map();
    private activeEdits: Map<string, FileEdit> = new Map();

    constructor() {
        this.buildDependencyGraph();
    }

    async analyzeDependencies(files: string[]): Promise<FileDependency[]> {
        const dependencies: FileDependency[] = [];

        for (const filePath of files) {
            try {
                const dependency = await this.analyzeFileDependencies(filePath);
                dependencies.push(dependency);
                this.dependencyGraph.set(filePath, dependency);
            } catch (error) {
                console.warn(`Failed to analyze dependencies for ${filePath}: ${error}`);
            }
        }

        return dependencies;
    }

    private async analyzeFileDependencies(filePath: string): Promise<FileDependency> {
        const dependencies: string[] = [];
        const dependents: string[] = [];

        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const content = document.getText();
            const language = document.languageId;

            // Extract imports/requires based on language
            const imports = this.extractImports(content, language);
            
            // Resolve import paths to actual file paths
            for (const importPath of imports) {
                const resolvedPath = await this.resolveImportPath(importPath, filePath);
                if (resolvedPath) {
                    dependencies.push(resolvedPath);
                }
            }

            // Find files that depend on this file
            const workspaceFiles = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,py,java,cs}');
            for (const file of workspaceFiles) {
                if (file.fsPath === filePath) continue;
                
                const fileContent = await vscode.workspace.fs.readFile(file);
                const fileText = Buffer.from(fileContent).toString('utf8');
                
                if (this.fileReferencesTarget(fileText, filePath, file.fsPath)) {
                    dependents.push(file.fsPath);
                }
            }

        } catch (error) {
            console.warn(`Error analyzing dependencies for ${filePath}: ${error}`);
        }

        return {
            filePath,
            dependencies,
            dependents,
            type: this.determineFileType(filePath)
        };
    }

    private extractImports(content: string, language: string): string[] {
        const imports: string[] = [];

        switch (language) {
            case 'typescript':
            case 'javascript':
            case 'typescriptreact':
            case 'javascriptreact':
                // ES6 imports and CommonJS requires
                const importRegex = /(?:import.*from\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\))/g;
                let match;
                while ((match = importRegex.exec(content)) !== null) {
                    imports.push(match[1] || match[2]);
                }
                break;

            case 'python':
                // Python imports
                const pythonImportRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
                while ((match = pythonImportRegex.exec(content)) !== null) {
                    imports.push(match[1] || match[2]);
                }
                break;

            case 'java':
                // Java imports
                const javaImportRegex = /import\s+([^;]+);/g;
                while ((match = javaImportRegex.exec(content)) !== null) {
                    imports.push(match[1]);
                }
                break;
        }

        return imports;
    }

    private async resolveImportPath(importPath: string, fromFile: string): Promise<string | null> {
        // Handle relative imports
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const basePath = path.dirname(fromFile);
            const resolvedPath = path.resolve(basePath, importPath);
            
            // Try different extensions
            const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java'];
            for (const ext of extensions) {
                const fullPath = resolvedPath + ext;
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
                    return fullPath;
                } catch {
                    // File doesn't exist, try next extension
                }
            }
        }

        // Handle absolute imports (would need more sophisticated resolution)
        return null;
    }

    private fileReferencesTarget(content: string, targetPath: string, fromPath: string): boolean {
        const targetName = path.basename(targetPath, path.extname(targetPath));
        const relativePath = path.relative(path.dirname(fromPath), targetPath);
        
        // Check for various reference patterns
        const patterns = [
            new RegExp(`['"\`]${relativePath.replace(/\\/g, '/')}['"\`]`),
            new RegExp(`['"\`]\\./${relativePath.replace(/\\/g, '/')}['"\`]`),
            new RegExp(`\\b${targetName}\\b`)
        ];

        return patterns.some(pattern => pattern.test(content));
    }

    private determineFileType(filePath: string): 'import' | 'reference' | 'config' | 'asset' {
        const ext = path.extname(filePath).toLowerCase();
        const basename = path.basename(filePath).toLowerCase();

        if (['.json', '.yaml', '.yml', '.toml', '.ini'].includes(ext)) {
            return 'config';
        }
        if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.scss', '.less'].includes(ext)) {
            return 'asset';
        }
        if (basename.includes('config') || basename.includes('setting')) {
            return 'config';
        }
        return 'import';
    }

    async detectConflicts(edits: FileEdit[]): Promise<ConflictInfo[]> {
        const conflicts: ConflictInfo[] = [];

        // Check for concurrent edits
        for (const edit of edits) {
            if (this.activeEdits.has(edit.filePath)) {
                conflicts.push({
                    filePath: edit.filePath,
                    type: 'concurrent_edit',
                    description: `File ${edit.filePath} is already being edited`,
                    suggestions: ['Wait for current edit to complete', 'Merge changes manually']
                });
            }
        }

        // Check for dependency conflicts
        for (const edit of edits) {
            const dependency = this.dependencyGraph.get(edit.filePath);
            if (dependency) {
                // Check if any dependencies are being modified in incompatible ways
                for (const depPath of dependency.dependencies) {
                    const depEdit = edits.find(e => e.filePath === depPath);
                    if (depEdit && this.wouldBreakDependency(edit, depEdit)) {
                        conflicts.push({
                            filePath: edit.filePath,
                            type: 'dependency_conflict',
                            description: `Changes to ${depPath} may break ${edit.filePath}`,
                            suggestions: ['Update import statements', 'Refactor affected code']
                        });
                    }
                }
            }
        }

        return conflicts;
    }

    private wouldBreakDependency(edit: FileEdit, dependencyEdit: FileEdit): boolean {
        // Simple heuristic - if we're deleting a file that others depend on
        if (dependencyEdit.type === 'delete') {
            return true;
        }

        // More sophisticated analysis would check for:
        // - Renamed exports
        // - Changed function signatures
        // - Removed public methods/properties
        return false;
    }

    async executeBatchEdits(edits: FileEdit[]): Promise<BatchEditResult> {
        const result: BatchEditResult = {
            success: true,
            completedEdits: [],
            failedEdits: [],
            conflicts: []
        };

        // Detect conflicts first
        result.conflicts = await this.detectConflicts(edits);
        
        if (result.conflicts.length > 0) {
            result.success = false;
            return result;
        }

        // Sort edits by dependency order
        const sortedEdits = this.sortEditsByDependencies(edits);

        // Execute edits in order
        for (const edit of sortedEdits) {
            try {
                this.activeEdits.set(edit.filePath, edit);
                await this.executeFileEdit(edit);
                result.completedEdits.push(edit);
            } catch (error) {
                result.failedEdits.push({
                    edit,
                    error: error instanceof Error ? error.message : String(error)
                });
                result.success = false;
            } finally {
                this.activeEdits.delete(edit.filePath);
            }
        }

        return result;
    }

    private sortEditsByDependencies(edits: FileEdit[]): FileEdit[] {
        // Topological sort based on dependencies
        const editMap = new Map(edits.map(e => [e.filePath, e]));
        const result: FileEdit[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (filePath: string) => {
            if (visiting.has(filePath)) return; // Circular dependency
            if (visited.has(filePath)) return;

            visiting.add(filePath);
            const dependency = this.dependencyGraph.get(filePath);
            if (dependency) {
                for (const depPath of dependency.dependencies) {
                    if (editMap.has(depPath)) {
                        visit(depPath);
                    }
                }
            }
            visiting.delete(filePath);
            visited.add(filePath);
            
            const edit = editMap.get(filePath);
            if (edit) {
                result.push(edit);
            }
        };

        for (const edit of edits) {
            visit(edit.filePath);
        }

        return result;
    }

    private async executeFileEdit(edit: FileEdit): Promise<void> {
        const uri = vscode.Uri.file(edit.filePath);

        switch (edit.type) {
            case 'create':
                if (edit.content) {
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(edit.content, 'utf8'));
                }
                break;

            case 'modify':
                // Backup original content
                try {
                    const originalContent = await vscode.workspace.fs.readFile(uri);
                    edit.backup = Buffer.from(originalContent).toString('utf8');
                } catch {
                    // File might not exist
                }

                if (edit.content) {
                    // Replace entire content
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(edit.content, 'utf8'));
                } else if (edit.changes) {
                    // Apply specific text edits
                    const document = await vscode.workspace.openTextDocument(uri);
                    const workspaceEdit = new vscode.WorkspaceEdit();
                    
                    for (const change of edit.changes) {
                        workspaceEdit.replace(uri, change.range, change.newText);
                    }
                    
                    await vscode.workspace.applyEdit(workspaceEdit);
                }
                break;

            case 'delete':
                // Backup before deletion
                try {
                    const originalContent = await vscode.workspace.fs.readFile(uri);
                    edit.backup = Buffer.from(originalContent).toString('utf8');
                } catch {
                    // File might not exist
                }
                
                await vscode.workspace.fs.delete(uri);
                break;
        }
    }

    async previewBatchEdits(edits: FileEdit[]): Promise<string> {
        let preview = '# Batch Edit Preview\n\n';
        
        const conflicts = await this.detectConflicts(edits);
        if (conflicts.length > 0) {
            preview += '## ⚠️ Conflicts Detected\n\n';
            for (const conflict of conflicts) {
                preview += `- **${conflict.filePath}**: ${conflict.description}\n`;
            }
            preview += '\n';
        }

        preview += '## 📝 Planned Changes\n\n';
        
        const sortedEdits = this.sortEditsByDependencies(edits);
        for (let i = 0; i < sortedEdits.length; i++) {
            const edit = sortedEdits[i];
            preview += `### ${i + 1}. ${edit.type.toUpperCase()}: ${edit.filePath}\n\n`;
            
            if (edit.type === 'create' && edit.content) {
                preview += '```\n' + edit.content.substring(0, 500) + 
                          (edit.content.length > 500 ? '\n... (truncated)' : '') + '\n```\n\n';
            } else if (edit.type === 'modify' && edit.changes) {
                preview += `${edit.changes.length} change(s):\n`;
                for (const change of edit.changes.slice(0, 3)) {
                    preview += `- Line ${change.range.start.line + 1}: ${change.description || 'Text replacement'}\n`;
                }
                if (edit.changes.length > 3) {
                    preview += `- ... and ${edit.changes.length - 3} more changes\n`;
                }
                preview += '\n';
            }
        }

        return preview;
    }

    private async buildDependencyGraph(): Promise<void> {
        try {
            const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,py,java}', '**/node_modules/**');
            const filePaths = files.map(f => f.fsPath);
            await this.analyzeDependencies(filePaths.slice(0, 100)); // Limit for performance
        } catch (error) {
            console.warn('Failed to build dependency graph:', error);
        }
    }

    async rollbackEdit(edit: FileEdit): Promise<void> {
        if (!edit.backup) {
            throw new Error('No backup available for rollback');
        }

        const uri = vscode.Uri.file(edit.filePath);
        
        if (edit.type === 'delete') {
            // Restore deleted file
            await vscode.workspace.fs.writeFile(uri, Buffer.from(edit.backup, 'utf8'));
        } else {
            // Restore original content
            await vscode.workspace.fs.writeFile(uri, Buffer.from(edit.backup, 'utf8'));
        }
    }
}
