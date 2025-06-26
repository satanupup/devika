import { BaseAgent } from './BaseAgent';
import { TaskContext, TaskResult } from '../types';

export class DocumentationAgent extends BaseAgent {
    async executeTask(taskId: string, context: TaskContext): Promise<TaskResult> {
        try {
            switch (taskId) {
                case 'generate-contributing':
                    return await this.generateContributing(context);
                case 'generate-roadmap':
                    return await this.generateRoadmap(context);
                case 'generate-changelog':
                    return await this.generateChangelog(context);
                default:
                    throw new Error(`未知的任務: ${taskId}`);
            }
        } catch (error) {
            return await this.handleError(error as Error, context);
        }
    }

    private async generateContributing(context: TaskContext): Promise<TaskResult> {
        // 分析專案結構
        const projectAnalysis = await this.analyzeProjectStructure(context);
        const projectType = await this.detectProjectType(context);

        // 建立 prompt
        const prompt = await this.buildPrompt('contributing', {
            projectName: context.project.name,
            projectType,
            primaryLanguage: projectAnalysis.primaryLanguage,
            hasPackageJson: projectAnalysis.hasPackageJson,
            hasTsConfig: projectAnalysis.hasTsConfig,
            hasGit: projectAnalysis.hasGit,
            frameworks: projectAnalysis.frameworks.join(', '),
            testFramework: projectAnalysis.testFramework || '未檢測到',
            buildTool: projectAnalysis.buildTool || '未檢測到'
        });

        // 生成內容
        const contributingContent = await this.retryOperation(async () => {
            return await this.llmService.generateCompletion(prompt);
        });

        // 顯示預覽
        const confirmed = await context.ui.showPreview(
            'CONTRIBUTING.md',
            contributingContent,
            '這是為您的專案生成的貢獻指南，是否要建立這個檔案？'
        );

        if (confirmed) {
            await context.fileSystem.writeFile('CONTRIBUTING.md', contributingContent);
            await context.ui.showMessage('✅ CONTRIBUTING.md 已成功建立！', 'info');
            
            return {
                success: true,
                message: 'CONTRIBUTING.md 已成功建立',
                files: ['CONTRIBUTING.md']
            };
        }

        return {
            success: false,
            message: '使用者取消操作'
        };
    }

    private async generateRoadmap(context: TaskContext): Promise<TaskResult> {
        // 讀取專案資訊
        let readmeContent = '';
        try {
            readmeContent = await context.fileSystem.readFile('README.md');
        } catch (error) {
            readmeContent = '專案尚未建立 README.md 檔案';
        }

        const projectStructure = await context.fileSystem.getProjectStructure();
        const projectAnalysis = await this.analyzeProjectStructure(context);

        // 分析程式碼檔案
        const codeFiles = projectStructure.filter(file => 
            file.endsWith('.ts') || 
            file.endsWith('.js') || 
            file.endsWith('.py') || 
            file.endsWith('.java') ||
            file.endsWith('.go') ||
            file.endsWith('.rs')
        );

        // 建立 prompt
        const prompt = await this.buildPrompt('roadmap', {
            projectName: context.project.name,
            readme: readmeContent.substring(0, 2000), // 限制長度
            structure: projectStructure.slice(0, 50).join('\n'), // 限制檔案數量
            primaryLanguage: projectAnalysis.primaryLanguage,
            frameworks: projectAnalysis.frameworks.join(', '),
            codeFileCount: codeFiles.length,
            totalFiles: projectStructure.length
        });

        // 生成路線圖
        const roadmapContent = await this.retryOperation(async () => {
            return await this.llmService.generateCompletion(prompt);
        });

        // 顯示預覽
        const confirmed = await context.ui.showPreview(
            'ROADMAP.md',
            roadmapContent,
            '這是為您的專案生成的開發路線圖，是否要建立這個檔案？'
        );

        if (confirmed) {
            await context.fileSystem.writeFile('ROADMAP.md', roadmapContent);
            await context.ui.showMessage('✅ ROADMAP.md 已成功建立！', 'info');
            
            return {
                success: true,
                message: 'ROADMAP.md 已成功建立',
                files: ['ROADMAP.md']
            };
        }

        return {
            success: false,
            message: '使用者取消操作'
        };
    }

    private async generateChangelog(context: TaskContext): Promise<TaskResult> {
        // 檢查是否有 Git
        const projectAnalysis = await this.analyzeProjectStructure(context);
        if (!projectAnalysis.hasGit) {
            await context.ui.showMessage('此專案沒有 Git 版本控制，無法生成變更日誌', 'warning');
            return {
                success: false,
                message: '專案沒有 Git 版本控制'
            };
        }

        // 這裡應該整合 GitService 來獲取 Git 歷史
        // 暫時使用模擬資料
        const gitHistory = [
            'feat: 新增使用者認證功能',
            'fix: 修復登入頁面的錯誤處理',
            'docs: 更新 API 文件',
            'refactor: 重構資料庫連接邏輯',
            'test: 新增單元測試'
        ];

        // 建立 prompt
        const prompt = await this.buildPrompt('changelog', {
            projectName: context.project.name,
            gitHistory: gitHistory.join('\n'),
            version: '1.0.0', // 應該從 package.json 或 Git tags 獲取
            date: this.generateTimestamp()
        });

        // 生成變更日誌
        const changelogContent = await this.retryOperation(async () => {
            return await this.llmService.generateCompletion(prompt);
        });

        // 顯示預覽
        const confirmed = await context.ui.showPreview(
            'CHANGELOG.md',
            changelogContent,
            '這是根據 Git 歷史生成的變更日誌，是否要建立這個檔案？'
        );

        if (confirmed) {
            await context.fileSystem.writeFile('CHANGELOG.md', changelogContent);
            await context.ui.showMessage('✅ CHANGELOG.md 已成功建立！', 'info');
            
            return {
                success: true,
                message: 'CHANGELOG.md 已成功建立',
                files: ['CHANGELOG.md']
            };
        }

        return {
            success: false,
            message: '使用者取消操作'
        };
    }

    private async analyzeReadmeStructure(readmeContent: string): Promise<{
        hasInstallation: boolean;
        hasUsage: boolean;
        hasContributing: boolean;
        hasLicense: boolean;
        sections: string[];
    }> {
        const lines = readmeContent.split('\n');
        const headers = lines.filter(line => line.startsWith('#'));
        
        const sections = headers.map(header => 
            header.replace(/^#+\s*/, '').toLowerCase()
        );

        return {
            hasInstallation: sections.some(s => s.includes('install')),
            hasUsage: sections.some(s => s.includes('usage') || s.includes('使用')),
            hasContributing: sections.some(s => s.includes('contribut') || s.includes('貢獻')),
            hasLicense: sections.some(s => s.includes('license') || s.includes('授權')),
            sections: headers.map(h => h.replace(/^#+\s*/, ''))
        };
    }

    private async detectDocumentationGaps(context: TaskContext): Promise<string[]> {
        const gaps: string[] = [];
        
        // 檢查常見文件
        const commonDocs = [
            { file: 'README.md', name: 'README' },
            { file: 'CONTRIBUTING.md', name: '貢獻指南' },
            { file: 'LICENSE', name: '授權條款' },
            { file: 'CHANGELOG.md', name: '變更日誌' },
            { file: 'API.md', name: 'API 文件' }
        ];

        for (const doc of commonDocs) {
            if (!(await context.fileSystem.fileExists(doc.file))) {
                gaps.push(doc.name);
            }
        }

        return gaps;
    }
}
