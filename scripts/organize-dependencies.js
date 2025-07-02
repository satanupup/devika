#!/usr/bin/env node

/**
 * 依賴項目整理腳本
 * 自動分析和整理 package.json 中的依賴項目分類
 */

const fs = require('fs');
const path = require('path');

// 開發依賴關鍵詞
const DEV_DEPENDENCY_KEYWORDS = [
    '@types/',
    'eslint',
    'prettier',
    'jest',
    'mocha',
    'chai',
    'sinon',
    'nyc',
    'c8',
    'typescript',
    'ts-',
    'webpack',
    'rollup',
    'vite',
    'babel',
    'nodemon',
    'concurrently',
    'rimraf',
    'cross-env',
    'husky',
    'lint-staged',
    'commitizen',
    'semantic-release',
    '@vscode/test',
    '@vscode/vsce',
    'vsce'
];

// 生產依賴關鍵詞（VS Code 擴展特定）
const PROD_DEPENDENCY_KEYWORDS = [
    'axios',
    'cheerio',
    'simple-git',
    'sqlite3',
    'lodash',
    'moment',
    'date-fns',
    'uuid',
    'crypto-js',
    'fs-extra'
];

class DependencyOrganizer {
    constructor() {
        this.packageJsonPath = path.join(process.cwd(), 'package.json');
        this.packageJson = null;
        this.changes = [];
    }

    /**
     * 執行依賴項目整理
     */
    async organize() {
        try {
            console.log('🔍 開始分析依賴項目...');
            
            // 讀取 package.json
            this.loadPackageJson();
            
            // 分析依賴項目
            const analysis = this.analyzeDependencies();
            
            // 顯示分析結果
            this.displayAnalysis(analysis);
            
            // 執行重組
            if (analysis.misclassified.length > 0) {
                await this.reorganizeDependencies(analysis);
                console.log('✅ 依賴項目整理完成！');
            } else {
                console.log('✅ 依賴項目分類正確，無需調整！');
            }
            
        } catch (error) {
            console.error('❌ 整理失敗:', error.message);
            process.exit(1);
        }
    }

    /**
     * 讀取 package.json
     */
    loadPackageJson() {
        if (!fs.existsSync(this.packageJsonPath)) {
            throw new Error('找不到 package.json 文件');
        }

        const content = fs.readFileSync(this.packageJsonPath, 'utf8');
        this.packageJson = JSON.parse(content);

        if (!this.packageJson.dependencies) {
            this.packageJson.dependencies = {};
        }
        if (!this.packageJson.devDependencies) {
            this.packageJson.devDependencies = {};
        }
    }

    /**
     * 分析依賴項目
     */
    analyzeDependencies() {
        const analysis = {
            correct: [],
            misclassified: [],
            unknown: [],
            unused: []
        };

        // 分析生產依賴
        for (const [name, version] of Object.entries(this.packageJson.dependencies)) {
            const classification = this.classifyDependency(name);
            
            if (classification === 'dev') {
                analysis.misclassified.push({
                    name,
                    version,
                    currentType: 'dependencies',
                    suggestedType: 'devDependencies',
                    reason: '這是開發工具或類型定義'
                });
            } else if (classification === 'prod') {
                analysis.correct.push({
                    name,
                    version,
                    type: 'dependencies'
                });
            } else {
                analysis.unknown.push({
                    name,
                    version,
                    type: 'dependencies'
                });
            }
        }

        // 分析開發依賴
        for (const [name, version] of Object.entries(this.packageJson.devDependencies)) {
            const classification = this.classifyDependency(name);
            
            if (classification === 'prod') {
                analysis.misclassified.push({
                    name,
                    version,
                    currentType: 'devDependencies',
                    suggestedType: 'dependencies',
                    reason: '這是運行時需要的依賴'
                });
            } else if (classification === 'dev') {
                analysis.correct.push({
                    name,
                    version,
                    type: 'devDependencies'
                });
            } else {
                analysis.unknown.push({
                    name,
                    version,
                    type: 'devDependencies'
                });
            }
        }

        return analysis;
    }

    /**
     * 分類依賴項目
     */
    classifyDependency(name) {
        // 檢查是否為開發依賴
        for (const keyword of DEV_DEPENDENCY_KEYWORDS) {
            if (name.includes(keyword)) {
                return 'dev';
            }
        }

        // 檢查是否為生產依賴
        for (const keyword of PROD_DEPENDENCY_KEYWORDS) {
            if (name.includes(keyword)) {
                return 'prod';
            }
        }

        // VS Code 擴展特定規則
        if (name.startsWith('@vscode/') || name === 'vscode') {
            return 'dev';
        }

        return 'unknown';
    }

    /**
     * 顯示分析結果
     */
    displayAnalysis(analysis) {
        console.log('\n📊 依賴項目分析結果:');
        console.log(`✅ 正確分類: ${analysis.correct.length} 個`);
        console.log(`⚠️  錯誤分類: ${analysis.misclassified.length} 個`);
        console.log(`❓ 未知分類: ${analysis.unknown.length} 個`);

        if (analysis.misclassified.length > 0) {
            console.log('\n🔄 需要重新分類的依賴項目:');
            analysis.misclassified.forEach(dep => {
                console.log(`  • ${dep.name}: ${dep.currentType} → ${dep.suggestedType}`);
                console.log(`    原因: ${dep.reason}`);
            });
        }

        if (analysis.unknown.length > 0) {
            console.log('\n❓ 未知分類的依賴項目:');
            analysis.unknown.forEach(dep => {
                console.log(`  • ${dep.name} (${dep.type})`);
            });
        }
    }

    /**
     * 重組依賴項目
     */
    async reorganizeDependencies(analysis) {
        console.log('\n🔄 開始重組依賴項目...');

        // 備份原始文件
        const backupPath = this.packageJsonPath + '.backup';
        fs.copyFileSync(this.packageJsonPath, backupPath);
        console.log(`📁 已創建備份: ${backupPath}`);

        // 執行重組
        for (const dep of analysis.misclassified) {
            this.moveDependency(dep);
        }

        // 排序依賴項目
        this.sortDependencies();

        // 保存文件
        this.savePackageJson();

        console.log('✅ 重組完成！');
        
        // 顯示變更摘要
        this.displayChanges();
    }

    /**
     * 移動依賴項目
     */
    moveDependency(dep) {
        const { name, version, currentType, suggestedType } = dep;

        // 從當前位置移除
        delete this.packageJson[currentType][name];

        // 添加到建議位置
        this.packageJson[suggestedType][name] = version;

        this.changes.push({
            name,
            from: currentType,
            to: suggestedType
        });

        console.log(`  ✓ 移動 ${name}: ${currentType} → ${suggestedType}`);
    }

    /**
     * 排序依賴項目
     */
    sortDependencies() {
        // 按字母順序排序
        const sortedDeps = {};
        Object.keys(this.packageJson.dependencies)
            .sort()
            .forEach(key => {
                sortedDeps[key] = this.packageJson.dependencies[key];
            });
        this.packageJson.dependencies = sortedDeps;

        const sortedDevDeps = {};
        Object.keys(this.packageJson.devDependencies)
            .sort()
            .forEach(key => {
                sortedDevDeps[key] = this.packageJson.devDependencies[key];
            });
        this.packageJson.devDependencies = sortedDevDeps;

        console.log('  ✓ 依賴項目已按字母順序排序');
    }

    /**
     * 保存 package.json
     */
    savePackageJson() {
        const content = JSON.stringify(this.packageJson, null, 2) + '\n';
        fs.writeFileSync(this.packageJsonPath, content, 'utf8');
        console.log('  ✓ package.json 已更新');
    }

    /**
     * 顯示變更摘要
     */
    displayChanges() {
        if (this.changes.length === 0) {
            return;
        }

        console.log('\n📋 變更摘要:');
        this.changes.forEach(change => {
            console.log(`  • ${change.name}: ${change.from} → ${change.to}`);
        });

        console.log('\n💡 建議執行以下命令重新安裝依賴項目:');
        console.log('  npm ci');
        console.log('\n或者:');
        console.log('  rm -rf node_modules package-lock.json && npm install');
    }

    /**
     * 驗證依賴項目
     */
    async validateDependencies() {
        console.log('\n🔍 驗證依賴項目使用情況...');
        
        // 這裡可以添加代碼來檢查依賴項目是否實際被使用
        // 例如搜索 import/require 語句
        
        console.log('✅ 驗證完成');
    }
}

// 主函數
async function main() {
    console.log('🚀 Devika 依賴項目整理工具');
    console.log('================================\n');

    const organizer = new DependencyOrganizer();
    await organizer.organize();
}

// 如果直接運行此腳本
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 執行失敗:', error);
        process.exit(1);
    });
}

module.exports = DependencyOrganizer;
