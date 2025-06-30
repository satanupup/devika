import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { GitService } from '../GitService';
import { simpleGit } from 'simple-git';

// Mock simple-git
jest.mock('simple-git');
const mockSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;

// Mock vscode
const mockVscode = {
  workspace: {
    workspaceFolders: [
      { uri: { fsPath: '/test/workspace' } }
    ]
  }
};

jest.mock('vscode', () => mockVscode, { virtual: true });

describe('GitService', () => {
  let gitService: GitService;
  let mockGit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGit = {
      status: jest.fn(),
      log: jest.fn(),
      add: jest.fn(),
      commit: jest.fn(),
      push: jest.fn(),
      pull: jest.fn(),
      branch: jest.fn(),
      checkout: jest.fn(),
      diff: jest.fn(),
      show: jest.fn(),
      raw: jest.fn()
    };

    mockSimpleGit.mockReturnValue(mockGit);
    gitService = new GitService();
  });

  describe('Repository Status', () => {
    test('should get repository status', async () => {
      const mockStatus = {
        current: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        staged: ['file1.ts'],
        modified: ['file2.ts'],
        not_added: ['file3.ts'],
        deleted: [],
        renamed: [],
        conflicted: []
      };

      mockGit.status.mockResolvedValue(mockStatus);

      const status = await gitService.getStatus();

      expect(status).toEqual(mockStatus);
      expect(mockGit.status).toHaveBeenCalled();
    });

    test('should handle git status errors', async () => {
      mockGit.status.mockRejectedValue(new Error('Not a git repository'));

      await expect(gitService.getStatus()).rejects.toThrow('Not a git repository');
    });
  });

  describe('Commit History', () => {
    test('should get commit history', async () => {
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            date: '2023-01-01',
            message: 'Initial commit',
            author_name: 'Test User',
            author_email: 'test@example.com'
          },
          {
            hash: 'def456',
            date: '2023-01-02',
            message: 'Add feature',
            author_name: 'Test User',
            author_email: 'test@example.com'
          }
        ],
        total: 2,
        latest: {
          hash: 'def456',
          date: '2023-01-02',
          message: 'Add feature',
          author_name: 'Test User',
          author_email: 'test@example.com'
        }
      };

      mockGit.log.mockResolvedValue(mockLog);

      const history = await gitService.getCommitHistory(10);

      expect(history).toEqual(mockLog.all);
      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 10 });
    });

    test('should get commit history with default limit', async () => {
      const mockLog = { all: [] };
      mockGit.log.mockResolvedValue(mockLog);

      await gitService.getCommitHistory();

      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 50 });
    });
  });

  describe('Commit Operations', () => {
    test('should stage and commit files', async () => {
      mockGit.add.mockResolvedValue(undefined);
      mockGit.commit.mockResolvedValue({ commit: 'abc123' });

      const result = await gitService.commitFiles(['file1.ts', 'file2.ts'], 'Test commit message');

      expect(mockGit.add).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
      expect(mockGit.commit).toHaveBeenCalledWith('Test commit message');
      expect(result).toEqual({ commit: 'abc123' });
    });

    test('should stage all files when no specific files provided', async () => {
      mockGit.add.mockResolvedValue(undefined);
      mockGit.commit.mockResolvedValue({ commit: 'def456' });

      await gitService.commitFiles([], 'Commit all changes');

      expect(mockGit.add).toHaveBeenCalledWith('.');
    });

    test('should handle commit errors', async () => {
      mockGit.add.mockResolvedValue(undefined);
      mockGit.commit.mockRejectedValue(new Error('Nothing to commit'));

      await expect(gitService.commitFiles(['file1.ts'], 'Test commit')).rejects.toThrow('Nothing to commit');
    });
  });

  describe('Branch Operations', () => {
    test('should get current branch', async () => {
      const mockBranch = {
        current: 'feature-branch',
        all: ['main', 'feature-branch', 'remotes/origin/main']
      };

      mockGit.branch.mockResolvedValue(mockBranch);

      const currentBranch = await gitService.getCurrentBranch();

      expect(currentBranch).toBe('feature-branch');
      expect(mockGit.branch).toHaveBeenCalled();
    });

    test('should get all branches', async () => {
      const mockBranch = {
        current: 'main',
        all: ['main', 'feature-branch', 'remotes/origin/main'],
        branches: {
          'main': { current: true, name: 'main' },
          'feature-branch': { current: false, name: 'feature-branch' }
        }
      };

      mockGit.branch.mockResolvedValue(mockBranch);

      const branches = await gitService.getBranches();

      expect(branches).toEqual(['main', 'feature-branch', 'remotes/origin/main']);
    });

    test('should checkout branch', async () => {
      mockGit.checkout.mockResolvedValue(undefined);

      await gitService.checkoutBranch('feature-branch');

      expect(mockGit.checkout).toHaveBeenCalledWith('feature-branch');
    });

    test('should create and checkout new branch', async () => {
      mockGit.checkout.mockResolvedValue(undefined);

      await gitService.createBranch('new-feature');

      expect(mockGit.checkout).toHaveBeenCalledWith(['-b', 'new-feature']);
    });
  });

  describe('Diff Operations', () => {
    test('should get diff for staged files', async () => {
      const mockDiff = 'diff --git a/file1.ts b/file1.ts\n+added line';
      mockGit.diff.mockResolvedValue(mockDiff);

      const diff = await gitService.getDiff(true);

      expect(diff).toBe(mockDiff);
      expect(mockGit.diff).toHaveBeenCalledWith(['--cached']);
    });

    test('should get diff for unstaged files', async () => {
      const mockDiff = 'diff --git a/file2.ts b/file2.ts\n-removed line';
      mockGit.diff.mockResolvedValue(mockDiff);

      const diff = await gitService.getDiff(false);

      expect(diff).toBe(mockDiff);
      expect(mockGit.diff).toHaveBeenCalledWith();
    });

    test('should get diff for specific file', async () => {
      const mockDiff = 'diff --git a/specific.ts b/specific.ts\n+change';
      mockGit.diff.mockResolvedValue(mockDiff);

      const diff = await gitService.getFileDiff('specific.ts');

      expect(diff).toBe(mockDiff);
      expect(mockGit.diff).toHaveBeenCalledWith(['specific.ts']);
    });
  });

  describe('Remote Operations', () => {
    test('should push changes', async () => {
      mockGit.push.mockResolvedValue(undefined);

      await gitService.push();

      expect(mockGit.push).toHaveBeenCalled();
    });

    test('should push to specific remote and branch', async () => {
      mockGit.push.mockResolvedValue(undefined);

      await gitService.push('origin', 'feature-branch');

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'feature-branch');
    });

    test('should pull changes', async () => {
      mockGit.pull.mockResolvedValue(undefined);

      await gitService.pull();

      expect(mockGit.pull).toHaveBeenCalled();
    });

    test('should pull from specific remote and branch', async () => {
      mockGit.pull.mockResolvedValue(undefined);

      await gitService.pull('origin', 'main');

      expect(mockGit.pull).toHaveBeenCalledWith('origin', 'main');
    });
  });

  describe('Commit Message Generation', () => {
    test('should generate commit message based on changes', async () => {
      const mockStatus = {
        staged: ['src/feature.ts', 'src/test.ts'],
        modified: ['README.md'],
        not_added: ['temp.log']
      };

      const mockDiff = `
diff --git a/src/feature.ts b/src/feature.ts
+++ b/src/feature.ts
+export function newFeature() {
+  return 'new feature';
+}

diff --git a/src/test.ts b/src/test.ts
+++ b/src/test.ts
+test('new feature test', () => {
+  expect(newFeature()).toBe('new feature');
+});
      `;

      mockGit.status.mockResolvedValue(mockStatus);
      mockGit.diff.mockResolvedValue(mockDiff);

      const commitMessage = await gitService.generateCommitMessage();

      expect(commitMessage).toContain('feat:');
      expect(commitMessage.length).toBeGreaterThan(10);
      expect(mockGit.status).toHaveBeenCalled();
      expect(mockGit.diff).toHaveBeenCalledWith(['--cached']);
    });

    test('should handle empty changes', async () => {
      const mockStatus = {
        staged: [],
        modified: [],
        not_added: []
      };

      mockGit.status.mockResolvedValue(mockStatus);

      const commitMessage = await gitService.generateCommitMessage();

      expect(commitMessage).toBe('chore: update files');
    });
  });

  describe('File History', () => {
    test('should get file history', async () => {
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            date: '2023-01-01',
            message: 'Add file',
            author_name: 'Test User'
          }
        ]
      };

      mockGit.log.mockResolvedValue(mockLog);

      const history = await gitService.getFileHistory('src/file.ts');

      expect(history).toEqual(mockLog.all);
      expect(mockGit.log).toHaveBeenCalledWith({ file: 'src/file.ts' });
    });
  });

  describe('Error Handling', () => {
    test('should handle git not available', async () => {
      mockSimpleGit.mockImplementation(() => {
        throw new Error('git not found');
      });

      expect(() => new GitService()).toThrow('git not found');
    });

    test('should handle workspace not available', () => {
      const originalWorkspace = mockVscode.workspace.workspaceFolders;
      mockVscode.workspace.workspaceFolders = undefined as any;

      expect(() => new GitService()).toThrow('No workspace folder found');

      mockVscode.workspace.workspaceFolders = originalWorkspace;
    });
  });
});
