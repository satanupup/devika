import * as vscode from 'vscode';

export interface EditOperation {
  type: 'insert' | 'replace' | 'delete';
  uri: vscode.Uri;
  range?: vscode.Range;
  text?: string;
  description?: string;
}

export interface FileOperation {
  type: 'create' | 'rename' | 'delete';
  uri: vscode.Uri;
  newUri?: vscode.Uri;
  content?: string;
  description?: string;
}

export interface BatchEditOptions {
  label?: string;
  undoStopBefore?: boolean;
  undoStopAfter?: boolean;
  isRefactoring?: boolean;
  needsConfirmation?: boolean;
  suppressErrorMessages?: boolean;
}

export interface EditResult {
  success: boolean;
  appliedEdits: number;
  failedEdits: number;
  errors: string[];
  warnings: string[];
}

export class WorkspaceEditManager {
  private editHistory: Array<{
    edit: vscode.WorkspaceEdit;
    timestamp: Date;
    label: string;
    result: EditResult;
  }> = [];

  private maxHistorySize = 50;

  constructor(private context: vscode.ExtensionContext) {
    this.loadEditHistory();
  }

  /**
   * 創建新的工作區編輯
   */
  createEdit(label?: string): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    if (label) {
      // VS Code 會在撤銷歷史中顯示這個標籤
      (edit as any).label = label;
    }
    return edit;
  }

  /**
   * 批量文本編輯
   */
  async batchTextEdits(operations: EditOperation[], options: BatchEditOptions = {}): Promise<EditResult> {
    const edit = this.createEdit(options.label || '批量文本編輯');
    const result: EditResult = {
      success: true,
      appliedEdits: 0,
      failedEdits: 0,
      errors: [],
      warnings: []
    };

    try {
      // 按文件分組操作
      const fileGroups = this.groupOperationsByFile(operations);

      for (const [uri, fileOps] of fileGroups) {
        try {
          // 確保文件存在
          await this.ensureFileExists(uri);

          // 獲取文檔內容
          const document = await vscode.workspace.openTextDocument(uri);

          // 驗證和排序操作
          const validOps = this.validateAndSortOperations(fileOps, document);

          // 應用操作到編輯對象
          for (const op of validOps) {
            this.applyOperationToEdit(edit, op, document);
            result.appliedEdits++;
          }
        } catch (error) {
          result.failedEdits += fileOps.length;
          result.errors.push(`文件 ${uri.fsPath} 處理失敗: ${error}`);
          result.success = false;
        }
      }

      // 應用編輯
      if (result.appliedEdits > 0) {
        const applied = await this.applyEdit(edit, options);
        if (!applied) {
          result.success = false;
          result.errors.push('工作區編輯應用失敗');
        }
      }

      // 記錄到歷史
      this.addToHistory(edit, options.label || '批量文本編輯', result);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`批量編輯失敗: ${error}`);
      return result;
    }
  }

  /**
   * 批量文件操作
   */
  async batchFileOperations(operations: FileOperation[], options: BatchEditOptions = {}): Promise<EditResult> {
    const edit = this.createEdit(options.label || '批量文件操作');
    const result: EditResult = {
      success: true,
      appliedEdits: 0,
      failedEdits: 0,
      errors: [],
      warnings: []
    };

    try {
      for (const op of operations) {
        try {
          switch (op.type) {
            case 'create':
              if (op.content !== undefined) {
                edit.createFile(op.uri, {
                  overwrite: false,
                  ignoreIfExists: false,
                  contents: Buffer.from(op.content, 'utf8')
                });
              } else {
                edit.createFile(op.uri);
              }
              break;

            case 'rename':
              if (!op.newUri) {
                throw new Error('重命名操作需要提供新的 URI');
              }
              edit.renameFile(op.uri, op.newUri, {
                overwrite: false,
                ignoreIfExists: false
              });
              break;

            case 'delete':
              edit.deleteFile(op.uri, {
                recursive: true,
                ignoreIfNotExists: true
              });
              break;
          }

          result.appliedEdits++;
        } catch (error) {
          result.failedEdits++;
          result.errors.push(`文件操作失敗 (${op.type} ${op.uri.fsPath}): ${error}`);
          result.success = false;
        }
      }

      // 應用編輯
      if (result.appliedEdits > 0) {
        const applied = await this.applyEdit(edit, options);
        if (!applied) {
          result.success = false;
          result.errors.push('文件操作應用失敗');
        }
      }

      // 記錄到歷史
      this.addToHistory(edit, options.label || '批量文件操作', result);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`批量文件操作失敗: ${error}`);
      return result;
    }
  }

  /**
   * 重構操作
   */
  async performRefactoring(
    label: string,
    editBuilder: (edit: vscode.WorkspaceEdit) => Promise<void> | void,
    options: BatchEditOptions = {}
  ): Promise<EditResult> {
    const edit = this.createEdit(label);
    const result: EditResult = {
      success: true,
      appliedEdits: 0,
      failedEdits: 0,
      errors: [],
      warnings: []
    };

    try {
      // 執行編輯構建器
      await editBuilder(edit);

      // 計算編輯數量
      result.appliedEdits = this.countEdits(edit);

      // 應用重構
      const applied = await this.applyEdit(edit, {
        ...options,
        isRefactoring: true,
        needsConfirmation: options.needsConfirmation ?? true
      });

      if (!applied) {
        result.success = false;
        result.errors.push('重構操作被取消或失敗');
      }

      // 記錄到歷史
      this.addToHistory(edit, label, result);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`重構操作失敗: ${error}`);
      return result;
    }
  }

  /**
   * 查找和替換
   */
  /*
  async findAndReplace(
    searchPattern: string | RegExp,
    replacement: string,
    options: {
      include?: string;
      exclude?: string;
      useRegex?: boolean;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      maxReplacements?: number;
    } & BatchEditOptions = {}
  ): Promise<EditResult> {
    const edit = this.createEdit(options.label || '查找和替換');
    const result: EditResult = {
      success: true,
      appliedEdits: 0,
      failedEdits: 0,
      errors: [],
      warnings: []
    };

    try {
      // 構建搜索查詢
      const query: vscode.TextSearchQuery = {
        pattern: searchPattern.toString()
      };
      const searchOptions: vscode.TextSearchOptions = {
        isRegExp: options.useRegex ?? searchPattern instanceof RegExp,
        isCaseSensitive: options.caseSensitive ?? false,
        isWordMatch: options.wholeWord ?? false,
        include: options.include,
        exclude: options.exclude,
        maxResults: options.maxReplacements || 1000
      };

      // 執行搜索
      const searchResults = await vscode.workspace.findTextInFiles(query, searchOptions, () => {});

      // 處理搜索結果
      for (const [uri, matches] of searchResults) {
        try {
          const textEdits: vscode.TextEdit[] = [];

          for (const match of matches) {
            const newText =
              options.useRegex && searchPattern instanceof RegExp
                ? match.text.replace(searchPattern, replacement)
                : replacement;

            textEdits.push(vscode.TextEdit.replace(match.range, newText));
          }

          if (textEdits.length > 0) {
            edit.set(uri, textEdits);
            result.appliedEdits += textEdits.length;
          }
        } catch (error) {
          result.failedEdits++;
          result.errors.push(`處理文件 ${uri.fsPath} 失敗: ${error}`);
        }
      }

      // 應用編輯
      if (result.appliedEdits > 0) {
        const applied = await this.applyEdit(edit, options);
        if (!applied) {
          result.success = false;
          result.errors.push('查找和替換操作失敗');
        }
      } else {
        result.warnings.push('沒有找到匹配的內容');
      }

      // 記錄到歷史
      this.addToHistory(edit, options.label || '查找和替換', result);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`查找和替換失敗: ${error}`);
      return result;
    }
  }
  */

  /**
   * 格式化多個文件
   */
  async formatFiles(uris: vscode.Uri[], options: BatchEditOptions = {}): Promise<EditResult> {
    const edit = this.createEdit(options.label || '格式化文件');
    const result: EditResult = {
      success: true,
      appliedEdits: 0,
      failedEdits: 0,
      errors: [],
      warnings: []
    };

    try {
      for (const uri of uris) {
        try {
          const document = await vscode.workspace.openTextDocument(uri);

          // 獲取格式化編輯
          const formatEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
            'vscode.executeFormatDocumentProvider',
            uri
          );

          if (formatEdits && formatEdits.length > 0) {
            edit.set(uri, formatEdits);
            result.appliedEdits += formatEdits.length;
          }
        } catch (error) {
          result.failedEdits++;
          result.errors.push(`格式化文件 ${uri.fsPath} 失敗: ${error}`);
        }
      }

      // 應用編輯
      if (result.appliedEdits > 0) {
        const applied = await this.applyEdit(edit, options);
        if (!applied) {
          result.success = false;
          result.errors.push('格式化操作失敗');
        }
      }

      // 記錄到歷史
      this.addToHistory(edit, options.label || '格式化文件', result);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`批量格式化失敗: ${error}`);
      return result;
    }
  }

  /**
   * 應用工作區編輯
   */
  private async applyEdit(edit: vscode.WorkspaceEdit, options: BatchEditOptions = {}): Promise<boolean> {
    try {
      // 如果需要確認，顯示預覽
      if (options.needsConfirmation) {
        const confirmed = await this.showEditPreview(edit);
        if (!confirmed) {
          return false;
        }
      }

      // 應用編輯
      const success = await vscode.workspace.applyEdit(edit);

      if (!success && !options.suppressErrorMessages) {
        vscode.window.showErrorMessage('工作區編輯應用失敗');
      }

      return success;
    } catch (error) {
      if (!options.suppressErrorMessages) {
        vscode.window.showErrorMessage(`編輯應用失敗: ${error}`);
      }
      return false;
    }
  }

  /**
   * 顯示編輯預覽
   */
  private async showEditPreview(edit: vscode.WorkspaceEdit): Promise<boolean> {
    const editCount = this.countEdits(edit);
    const fileCount = edit.size;

    const message = `即將修改 ${fileCount} 個文件，共 ${editCount} 處更改。是否繼續？`;

    const action = await vscode.window.showWarningMessage(message, { modal: true }, '繼續', '取消');

    return action === '繼續';
  }

  /**
   * 按文件分組操作
   */
  private groupOperationsByFile(operations: EditOperation[]): Map<vscode.Uri, EditOperation[]> {
    const groups = new Map<vscode.Uri, EditOperation[]>();

    for (const op of operations) {
      const key = op.uri.toString();
      let group = groups.get(op.uri);
      if (!group) {
        group = [];
        groups.set(op.uri, group);
      }
      group.push(op);
    }

    return groups;
  }

  /**
   * 驗證和排序操作
   */
  private validateAndSortOperations(operations: EditOperation[], document: vscode.TextDocument): EditOperation[] {
    const validOps: EditOperation[] = [];

    for (const op of operations) {
      // 驗證範圍
      if (op.range && !document.validateRange(op.range)) {
        console.warn(`無效的範圍: ${op.range}, 文件: ${document.uri.fsPath}`);
        continue;
      }

      validOps.push(op);
    }

    // 按位置排序（從後往前，避免位置偏移）
    return validOps.sort((a, b) => {
      if (!a.range || !b.range) {return 0;}
      return b.range.start.compareTo(a.range.start);
    });
  }

  /**
   * 應用操作到編輯對象
   */
  private applyOperationToEdit(
    edit: vscode.WorkspaceEdit,
    operation: EditOperation,
    document: vscode.TextDocument
  ): void {
    const uri = operation.uri;
    let textEdit: vscode.TextEdit;

    switch (operation.type) {
      case 'insert':
        if (!operation.range || !operation.text) {
          throw new Error('插入操作需要範圍和文本');
        }
        textEdit = vscode.TextEdit.insert(operation.range.start, operation.text);
        break;

      case 'replace':
        if (!operation.range || operation.text === undefined) {
          throw new Error('替換操作需要範圍和文本');
        }
        textEdit = vscode.TextEdit.replace(operation.range, operation.text);
        break;

      case 'delete':
        if (!operation.range) {
          throw new Error('刪除操作需要範圍');
        }
        textEdit = vscode.TextEdit.delete(operation.range);
        break;

      default:
        throw new Error(`不支援的操作類型: ${operation.type}`);
    }

    // 獲取現有編輯或創建新的
    const existingEdits = edit.get(uri) || [];
    existingEdits.push(textEdit);
    edit.set(uri, existingEdits);
  }

  /**
   * 確保文件存在
   */
  private async ensureFileExists(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.stat(uri);
    } catch (error) {
      throw new Error(`文件不存在: ${uri.fsPath}`);
    }
  }

  /**
   * 計算編輯數量
   */
  private countEdits(edit: vscode.WorkspaceEdit): number {
    let count = 0;

    edit.entries().forEach(([uri, edits]) => {
      count += edits.length;
    });

    return count;
  }

  /**
   * 添加到歷史記錄
   */
  private addToHistory(edit: vscode.WorkspaceEdit, label: string, result: EditResult): void {
    this.editHistory.unshift({
      edit,
      timestamp: new Date(),
      label,
      result
    });

    // 限制歷史大小
    if (this.editHistory.length > this.maxHistorySize) {
      this.editHistory = this.editHistory.slice(0, this.maxHistorySize);
    }

    this.saveEditHistory();
  }

  /**
   * 獲取編輯歷史
   */
  getEditHistory(): Array<{
    timestamp: Date;
    label: string;
    result: EditResult;
  }> {
    return this.editHistory.map(entry => ({
      timestamp: entry.timestamp,
      label: entry.label,
      result: entry.result
    }));
  }

  /**
   * 清除編輯歷史
   */
  clearEditHistory(): void {
    this.editHistory = [];
    this.saveEditHistory();
  }

  /**
   * 保存編輯歷史
   */
  private saveEditHistory(): void {
    // 只保存結果，不保存實際的編輯對象
    const historyToSave = this.editHistory.map(entry => ({
      timestamp: entry.timestamp,
      label: entry.label,
      result: entry.result
    }));

    this.context.globalState.update('workspaceEditHistory', historyToSave);
  }

  /**
   * 載入編輯歷史
   */
  private loadEditHistory(): void {
    const history = this.context.globalState.get<any[]>('workspaceEditHistory', []);

    // 只恢復基本信息，不包含實際的編輯對象
    this.editHistory = history.map(entry => ({
      edit: new vscode.WorkspaceEdit(), // 空的編輯對象
      timestamp: new Date(entry.timestamp),
      label: entry.label,
      result: entry.result
    }));
  }
}
