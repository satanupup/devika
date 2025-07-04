/**
 * 命名約定檢查器
 * 檢查代碼中的命名是否符合最佳實踐
 */

export enum NamingConvention {
    CAMEL_CASE = 'camelCase',
    PASCAL_CASE = 'PascalCase',
    SNAKE_CASE = 'snake_case',
    KEBAB_CASE = 'kebab-case',
    SCREAMING_SNAKE_CASE = 'SCREAMING_SNAKE_CASE'
}

export interface NamingIssue {
    type: 'variable' | 'function' | 'class' | 'interface' | 'enum' | 'constant';
    name: string;
    line: number;
    column: number;
    expectedConvention: NamingConvention;
    actualConvention: NamingConvention | 'unknown';
    suggestion: string;
    severity: 'error' | 'warning' | 'info';
}

export interface NamingRules {
    variables: NamingConvention;
    functions: NamingConvention;
    classes: NamingConvention;
    interfaces: NamingConvention;
    enums: NamingConvention;
    constants: NamingConvention;
    privateMembers: {
        prefix?: string;
        convention: NamingConvention;
    };
}

export class NamingConventionChecker {
    private readonly defaultRules: Record<string, NamingRules> = {
        typescript: {
            variables: NamingConvention.CAMEL_CASE,
            functions: NamingConvention.CAMEL_CASE,
            classes: NamingConvention.PASCAL_CASE,
            interfaces: NamingConvention.PASCAL_CASE,
            enums: NamingConvention.PASCAL_CASE,
            constants: NamingConvention.SCREAMING_SNAKE_CASE,
            privateMembers: {
                prefix: '_',
                convention: NamingConvention.CAMEL_CASE
            }
        },
        javascript: {
            variables: NamingConvention.CAMEL_CASE,
            functions: NamingConvention.CAMEL_CASE,
            classes: NamingConvention.PASCAL_CASE,
            interfaces: NamingConvention.PASCAL_CASE,
            enums: NamingConvention.PASCAL_CASE,
            constants: NamingConvention.SCREAMING_SNAKE_CASE,
            privateMembers: {
                prefix: '_',
                convention: NamingConvention.CAMEL_CASE
            }
        },
        python: {
            variables: NamingConvention.SNAKE_CASE,
            functions: NamingConvention.SNAKE_CASE,
            classes: NamingConvention.PASCAL_CASE,
            interfaces: NamingConvention.PASCAL_CASE,
            enums: NamingConvention.PASCAL_CASE,
            constants: NamingConvention.SCREAMING_SNAKE_CASE,
            privateMembers: {
                prefix: '_',
                convention: NamingConvention.SNAKE_CASE
            }
        }
    };

    /**
     * 檢查代碼的命名約定
     */
    public checkNamingConventions(content: string, language: string): NamingIssue[] {
        const rules = this.getRulesForLanguage(language);
        const issues: NamingIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            // 檢查變數聲明
            issues.push(...this.checkVariableDeclarations(line, lineNumber, rules));

            // 檢查函數聲明
            issues.push(...this.checkFunctionDeclarations(line, lineNumber, rules));

            // 檢查類別聲明
            issues.push(...this.checkClassDeclarations(line, lineNumber, rules));

            // 檢查介面聲明
            issues.push(...this.checkInterfaceDeclarations(line, lineNumber, rules));

            // 檢查枚舉聲明
            issues.push(...this.checkEnumDeclarations(line, lineNumber, rules));

            // 檢查常數聲明
            issues.push(...this.checkConstantDeclarations(line, lineNumber, rules));
        }

        return issues;
    }

    /**
     * 獲取語言的命名規則
     */
    private getRulesForLanguage(language: string): NamingRules {
        return this.defaultRules[language] || this.defaultRules.typescript;
    }

    /**
     * 檢查變數聲明
     */
    private checkVariableDeclarations(line: string, lineNumber: number, rules: NamingRules): NamingIssue[] {
        const issues: NamingIssue[] = [];

        // TypeScript/JavaScript 變數聲明模式
        const patterns = [
            /(?:let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /(?:const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const variableName = match[1];
                const column = match.index + match[0].indexOf(variableName);

                if (!this.followsConvention(variableName, rules.variables)) {
                    issues.push({
                        type: 'variable',
                        name: variableName,
                        line: lineNumber,
                        column,
                        expectedConvention: rules.variables,
                        actualConvention: this.detectConvention(variableName),
                        suggestion: this.convertToConvention(variableName, rules.variables),
                        severity: 'warning'
                    });
                }
            }
        }

        return issues;
    }

    /**
     * 檢查函數聲明
     */
    private checkFunctionDeclarations(line: string, lineNumber: number, rules: NamingRules): NamingIssue[] {
        const issues: NamingIssue[] = [];

        // 函數聲明模式
        const patterns = [
            /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
            /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*)?=>/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const functionName = match[1];
                const column = match.index + match[0].indexOf(functionName);

                // 跳過一些常見的非函數名稱
                if (this.isLikelyNotFunction(functionName, line)) {
                    continue;
                }

                if (!this.followsConvention(functionName, rules.functions)) {
                    issues.push({
                        type: 'function',
                        name: functionName,
                        line: lineNumber,
                        column,
                        expectedConvention: rules.functions,
                        actualConvention: this.detectConvention(functionName),
                        suggestion: this.convertToConvention(functionName, rules.functions),
                        severity: 'warning'
                    });
                }
            }
        }

        return issues;
    }

    /**
     * 檢查類別聲明
     */
    private checkClassDeclarations(line: string, lineNumber: number, rules: NamingRules): NamingIssue[] {
        const issues: NamingIssue[] = [];
        const pattern = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

        let match;
        while ((match = pattern.exec(line)) !== null) {
            const className = match[1];
            const column = match.index + match[0].indexOf(className);

            if (!this.followsConvention(className, rules.classes)) {
                issues.push({
                    type: 'class',
                    name: className,
                    line: lineNumber,
                    column,
                    expectedConvention: rules.classes,
                    actualConvention: this.detectConvention(className),
                    suggestion: this.convertToConvention(className, rules.classes),
                    severity: 'error'
                });
            }
        }

        return issues;
    }

    /**
     * 檢查介面聲明
     */
    private checkInterfaceDeclarations(line: string, lineNumber: number, rules: NamingRules): NamingIssue[] {
        const issues: NamingIssue[] = [];
        const pattern = /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

        let match;
        while ((match = pattern.exec(line)) !== null) {
            const interfaceName = match[1];
            const column = match.index + match[0].indexOf(interfaceName);

            if (!this.followsConvention(interfaceName, rules.interfaces)) {
                issues.push({
                    type: 'interface',
                    name: interfaceName,
                    line: lineNumber,
                    column,
                    expectedConvention: rules.interfaces,
                    actualConvention: this.detectConvention(interfaceName),
                    suggestion: this.convertToConvention(interfaceName, rules.interfaces),
                    severity: 'error'
                });
            }
        }

        return issues;
    }

    /**
     * 檢查枚舉聲明
     */
    private checkEnumDeclarations(line: string, lineNumber: number, rules: NamingRules): NamingIssue[] {
        const issues: NamingIssue[] = [];
        const pattern = /enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

        let match;
        while ((match = pattern.exec(line)) !== null) {
            const enumName = match[1];
            const column = match.index + match[0].indexOf(enumName);

            if (!this.followsConvention(enumName, rules.enums)) {
                issues.push({
                    type: 'enum',
                    name: enumName,
                    line: lineNumber,
                    column,
                    expectedConvention: rules.enums,
                    actualConvention: this.detectConvention(enumName),
                    suggestion: this.convertToConvention(enumName, rules.enums),
                    severity: 'error'
                });
            }
        }

        return issues;
    }

    /**
     * 檢查常數聲明
     */
    private checkConstantDeclarations(line: string, lineNumber: number, rules: NamingRules): NamingIssue[] {
        const issues: NamingIssue[] = [];
        const pattern = /const\s+([A-Z_][A-Z0-9_]*)\s*=/g;

        let match;
        while ((match = pattern.exec(line)) !== null) {
            const constantName = match[1];
            const column = match.index + match[0].indexOf(constantName);

            if (!this.followsConvention(constantName, rules.constants)) {
                issues.push({
                    type: 'constant',
                    name: constantName,
                    line: lineNumber,
                    column,
                    expectedConvention: rules.constants,
                    actualConvention: this.detectConvention(constantName),
                    suggestion: this.convertToConvention(constantName, rules.constants),
                    severity: 'info'
                });
            }
        }

        return issues;
    }

    /**
     * 檢查名稱是否遵循指定約定
     */
    private followsConvention(name: string, convention: NamingConvention): boolean {
        switch (convention) {
            case NamingConvention.CAMEL_CASE:
                return /^[a-z][a-zA-Z0-9]*$/.test(name);
            case NamingConvention.PASCAL_CASE:
                return /^[A-Z][a-zA-Z0-9]*$/.test(name);
            case NamingConvention.SNAKE_CASE:
                return /^[a-z][a-z0-9_]*$/.test(name);
            case NamingConvention.KEBAB_CASE:
                return /^[a-z][a-z0-9-]*$/.test(name);
            case NamingConvention.SCREAMING_SNAKE_CASE:
                return /^[A-Z][A-Z0-9_]*$/.test(name);
            default:
                return true;
        }
    }

    /**
     * 檢測名稱的約定類型
     */
    private detectConvention(name: string): NamingConvention | 'unknown' {
        if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
            return NamingConvention.CAMEL_CASE;
        }
        if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
            return NamingConvention.PASCAL_CASE;
        }
        if (/^[a-z][a-z0-9_]*$/.test(name)) {
            return NamingConvention.SNAKE_CASE;
        }
        if (/^[a-z][a-z0-9-]*$/.test(name)) {
            return NamingConvention.KEBAB_CASE;
        }
        if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
            return NamingConvention.SCREAMING_SNAKE_CASE;
        }
        return 'unknown';
    }

    /**
     * 將名稱轉換為指定約定
     */
    private convertToConvention(name: string, convention: NamingConvention): string {
        // 先將名稱分解為單詞
        const words = this.splitIntoWords(name);

        switch (convention) {
            case NamingConvention.CAMEL_CASE:
                return words[0].toLowerCase() + words.slice(1).map(w => this.capitalize(w)).join('');
            case NamingConvention.PASCAL_CASE:
                return words.map(w => this.capitalize(w)).join('');
            case NamingConvention.SNAKE_CASE:
                return words.map(w => w.toLowerCase()).join('_');
            case NamingConvention.KEBAB_CASE:
                return words.map(w => w.toLowerCase()).join('-');
            case NamingConvention.SCREAMING_SNAKE_CASE:
                return words.map(w => w.toUpperCase()).join('_');
            default:
                return name;
        }
    }

    /**
     * 將名稱分解為單詞
     */
    private splitIntoWords(name: string): string[] {
        // 處理各種命名約定
        return name
            .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
            .replace(/[_-]/g, ' ') // snake_case, kebab-case -> space
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    /**
     * 首字母大寫
     */
    private capitalize(word: string): string {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    /**
     * 檢查是否可能不是函數名稱
     */
    private isLikelyNotFunction(name: string, line: string): boolean {
        // 跳過一些常見的非函數模式
        const nonFunctionPatterns = [
            /\b(if|while|for|switch|catch)\s*\(/,
            /\b(import|export)\s/,
            /\b(class|interface|enum)\s/,
            /\b(const|let|var)\s/
        ];

        return nonFunctionPatterns.some(pattern => pattern.test(line));
    }
}
