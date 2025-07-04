/**
 * 代碼分析工具類 - 提供共用的代碼分析功能
 */
export class CodeAnalysisUtils {
    /**
     * 計算圈複雜度
     */
    static calculateCyclomaticComplexity(content: string): number {
        const complexityKeywords = [
            'if', 'else if', 'while', 'for', 'switch', 'case',
            'catch', 'try', '&&', '||', '?', ':'
        ];

        let complexity = 1; // 基礎複雜度
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            // 跳過註釋和空行
            if (this.isCommentOrEmpty(trimmed)) {
                continue;
            }

            // 計算複雜度增加的語句
            for (const keyword of complexityKeywords) {
                const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                const matches = trimmed.match(regex);
                if (matches) {
                    complexity += matches.length;
                }
            }
        }

        return complexity;
    }

    /**
     * 計算認知複雜度
     */
    static calculateCognitiveComplexity(content: string): number {
        const lines = content.split('\n');
        let complexity = 0;
        let nestingLevel = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            if (this.isCommentOrEmpty(trimmed)) {
                continue;
            }

            // 增加嵌套級別的語句
            if (this.isNestingIncreasingStatement(trimmed)) {
                nestingLevel++;
                complexity += nestingLevel;
            }

            // 減少嵌套級別
            if (trimmed === '}') {
                nestingLevel = Math.max(0, nestingLevel - 1);
            }

            // 其他複雜度增加的語句
            if (this.isComplexityIncreasingStatement(trimmed)) {
                complexity += 1 + nestingLevel;
            }
        }

        return complexity;
    }

    /**
     * 查找重複行
     */
    static findDuplicatedLines(lines: string[]): number {
        const lineMap = new Map<string, number>();
        let duplicated = 0;

        for (const line of lines) {
            const normalized = this.normalizeLine(line);
            if (normalized) {
                const count = lineMap.get(normalized) || 0;
                lineMap.set(normalized, count + 1);

                if (count === 1) {
                    duplicated += 2; // 第一次發現重複
                } else if (count > 1) {
                    duplicated += 1; // 額外的重複
                }
            }
        }

        return duplicated;
    }

    /**
     * 檢測函數聲明
     */
    static isFunctionDeclaration(line: string): boolean {
        const patterns = [
            /function\s+\w+/,                                    // function name()
            /\w+\s*\([^)]*\)\s*{/,                              // name() {
            /=>\s*{/,                                           // => {
            /def\s+\w+/,                                        // Python def
            /(public|private|protected)?\s*(static)?\s*\w+\s*\([^)]*\)/ // Java/C# methods
        ];

        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * 檢測類聲明
     */
    static isClassDeclaration(line: string): boolean {
        const patterns = [
            /class\s+\w+/,                                      // class Name
            /interface\s+\w+/,                                  // interface Name
            /enum\s+\w+/,                                       // enum Name
            /type\s+\w+/,                                       // type Name
            /struct\s+\w+/                                      // struct Name (C#)
        ];

        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * 檢測複雜度增加的語句
     */
    static isComplexityIncreasingStatement(line: string): boolean {
        const patterns = [
            /\bif\b/,
            /\belse\s+if\b/,
            /\bwhile\b/,
            /\bfor\b/,
            /\bswitch\b/,
            /\bcase\b/,
            /\bcatch\b/,
            /\btry\b/,
            /&&/,
            /\|\|/,
            /\?.*:/
        ];

        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * 檢測嵌套增加的語句
     */
    static isNestingIncreasingStatement(line: string): boolean {
        const patterns = [
            /\bif\b.*{/,
            /\belse\b.*{/,
            /\bwhile\b.*{/,
            /\bfor\b.*{/,
            /\btry\b.*{/,
            /\bcatch\b.*{/,
            /\bfinally\b.*{/
        ];

        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * 檢查是否為註釋或空行
     */
    static isCommentOrEmpty(line: string): boolean {
        if (!line || line.trim() === '') {
            return true;
        }

        const trimmed = line.trim();

        // 單行註釋
        if (trimmed.startsWith('//') ||
            trimmed.startsWith('#') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('/*')) {
            return true;
        }

        return false;
    }

    /**
     * 標準化代碼行（用於重複檢測）
     */
    static normalizeLine(line: string): string | null {
        const trimmed = line.trim();

        // 跳過空行和註釋
        if (this.isCommentOrEmpty(trimmed)) {
            return null;
        }

        // 移除多餘的空格
        return trimmed.replace(/\s+/g, ' ');
    }

    /**
     * 計算函數長度
     */
    static calculateFunctionLengths(content: string): number[] {
        const lines = content.split('\n');
        const functionLengths: number[] = [];
        let currentFunctionLength = 0;
        let inFunction = false;
        let braceCount = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            if (this.isFunctionDeclaration(trimmed)) {
                if (inFunction && currentFunctionLength > 0) {
                    functionLengths.push(currentFunctionLength);
                }
                inFunction = true;
                currentFunctionLength = 1;
                braceCount = 0;
            }

            if (inFunction) {
                currentFunctionLength++;

                // 計算大括號
                const openBraces = (line.match(/{/g) || []).length;
                const closeBraces = (line.match(/}/g) || []).length;
                braceCount += openBraces - closeBraces;

                // 函數結束
                if (braceCount <= 0 && closeBraces > 0) {
                    functionLengths.push(currentFunctionLength);
                    inFunction = false;
                    currentFunctionLength = 0;
                }
            }
        }

        // 處理未結束的函數
        if (inFunction && currentFunctionLength > 0) {
            functionLengths.push(currentFunctionLength);
        }

        return functionLengths;
    }

    /**
     * 計算嵌套深度
     */
    static calculateMaxNestingDepth(content: string): number {
        const lines = content.split('\n');
        let maxDepth = 0;
        let currentDepth = 0;

        for (const line of lines) {
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;

            currentDepth += openBraces - closeBraces;
            maxDepth = Math.max(maxDepth, currentDepth);
        }

        return maxDepth;
    }

    /**
     * 提取代碼中的魔術數字
     */
    static findMagicNumbers(content: string): number[] {
        const magicNumbers: number[] = [];
        const lines = content.split('\n');

        for (const line of lines) {
            if (this.isCommentOrEmpty(line.trim())) {
                continue;
            }

            // 查找數字（排除常見的非魔術數字）
            const numberMatches = line.match(/\b\d+\.?\d*\b/g);
            if (numberMatches) {
                for (const match of numberMatches) {
                    const num = parseFloat(match);

                    // 排除常見的非魔術數字
                    if (!this.isCommonNumber(num)) {
                        magicNumbers.push(num);
                    }
                }
            }
        }

        return magicNumbers;
    }

    /**
     * 檢查是否為常見的非魔術數字
     */
    private static isCommonNumber(num: number): boolean {
        const commonNumbers = [0, 1, 2, 10, 100, 1000, -1];
        return commonNumbers.includes(num);
    }

    /**
     * 計算代碼行數（排除空行和註釋）
     */
    static countLinesOfCode(content: string): number {
        const lines = content.split('\n');
        let count = 0;

        for (const line of lines) {
            if (!this.isCommentOrEmpty(line.trim())) {
                count++;
            }
        }

        return count;
    }

    /**
     * 提取所有標識符
     */
    static extractIdentifiers(content: string): string[] {
        const identifierPattern = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
        const matches = content.match(identifierPattern) || [];

        // 過濾關鍵字
        const keywords = new Set([
            'if', 'else', 'for', 'while', 'function', 'class', 'const', 'let', 'var',
            'return', 'import', 'export', 'default', 'public', 'private', 'protected',
            'static', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'new'
        ]);

        return matches.filter(identifier => !keywords.has(identifier.toLowerCase()));
    }
}
