import { ErrorHandlingUtils, OperationResult, BatchOperationResult } from '../../utils/ErrorHandlingUtils';

describe('ErrorHandlingUtils', () => {
    beforeEach(() => {
        // 清理任何現有的狀態
        jest.clearAllMocks();
    });

    describe('executeWithErrorHandling', () => {
        it('should return success result for successful operation', async () => {
            const operation = jest.fn().mockResolvedValue('test result');
            
            const result = await ErrorHandlingUtils.executeWithErrorHandling(
                operation,
                'test operation'
            );

            expect(result.success).toBe(true);
            expect(result.data).toBe('test result');
            expect(result.error).toBeUndefined();
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should return error result for failed operation', async () => {
            const error = new Error('test error');
            const operation = jest.fn().mockRejectedValue(error);
            
            const result = await ErrorHandlingUtils.executeWithErrorHandling(
                operation,
                'test operation'
            );

            expect(result.success).toBe(false);
            expect(result.data).toBeUndefined();
            expect(result.error).toBe(error);
            expect(result.message).toContain('test operation');
        });

        it('should retry operation when retryCount is specified', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new Error('first failure'))
                .mockRejectedValueOnce(new Error('second failure'))
                .mockResolvedValue('success on third try');
            
            const result = await ErrorHandlingUtils.executeWithErrorHandling(
                operation,
                'test operation',
                { retryCount: 2 }
            );

            expect(result.success).toBe(true);
            expect(result.data).toBe('success on third try');
            expect(operation).toHaveBeenCalledTimes(3);
        });

        it('should not show error to user by default', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const operation = jest.fn().mockRejectedValue(new Error('test error'));
            
            await ErrorHandlingUtils.executeWithErrorHandling(
                operation,
                'test operation'
            );

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('executeWithErrorHandlingSync', () => {
        it('should return success result for successful sync operation', () => {
            const operation = jest.fn().mockReturnValue('sync result');
            
            const result = ErrorHandlingUtils.executeWithErrorHandlingSync(
                operation,
                'sync operation'
            );

            expect(result.success).toBe(true);
            expect(result.data).toBe('sync result');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should return error result for failed sync operation', () => {
            const error = new Error('sync error');
            const operation = jest.fn().mockImplementation(() => { throw error; });
            
            const result = ErrorHandlingUtils.executeWithErrorHandlingSync(
                operation,
                'sync operation'
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe(error);
        });
    });

    describe('executeBatchWithErrorHandling', () => {
        it('should process all items successfully', async () => {
            const items = [1, 2, 3];
            const operation = jest.fn().mockImplementation((item: number) => 
                Promise.resolve(item * 2)
            );
            
            const result = await ErrorHandlingUtils.executeBatchWithErrorHandling(
                items,
                operation,
                'batch operation'
            );

            expect(result.success).toBe(true);
            expect(result.results).toEqual([2, 4, 6]);
            expect(result.errors).toEqual([]);
            expect(result.totalCount).toBe(3);
            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);
        });

        it('should handle partial failures with continueOnError=true', async () => {
            const items = [1, 2, 3];
            const operation = jest.fn()
                .mockResolvedValueOnce(2)
                .mockRejectedValueOnce(new Error('item 2 failed'))
                .mockResolvedValueOnce(6);
            
            const result = await ErrorHandlingUtils.executeBatchWithErrorHandling(
                items,
                operation,
                'batch operation',
                { continueOnError: true }
            );

            expect(result.success).toBe(false);
            expect(result.results).toEqual([2, 6]);
            expect(result.errors).toHaveLength(1);
            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(1);
        });

        it('should stop on first error with continueOnError=false', async () => {
            const items = [1, 2, 3];
            const operation = jest.fn()
                .mockResolvedValueOnce(2)
                .mockRejectedValueOnce(new Error('item 2 failed'));
            
            const result = await ErrorHandlingUtils.executeBatchWithErrorHandling(
                items,
                operation,
                'batch operation',
                { continueOnError: false }
            );

            expect(result.success).toBe(false);
            expect(result.results).toEqual([2]);
            expect(result.errors).toHaveLength(1);
            expect(operation).toHaveBeenCalledTimes(2);
        });
    });

    describe('normalizeError', () => {
        it('should return Error instance as-is', () => {
            const error = new Error('test error');
            const normalized = ErrorHandlingUtils.normalizeError(error);
            
            expect(normalized).toBe(error);
        });

        it('should convert string to Error', () => {
            const normalized = ErrorHandlingUtils.normalizeError('string error');
            
            expect(normalized).toBeInstanceOf(Error);
            expect(normalized.message).toBe('string error');
        });

        it('should convert object with message to Error', () => {
            const errorObj = { message: 'object error', code: 500 };
            const normalized = ErrorHandlingUtils.normalizeError(errorObj);
            
            expect(normalized).toBeInstanceOf(Error);
            expect(normalized.message).toBe('object error');
        });

        it('should handle unknown error types', () => {
            const normalized = ErrorHandlingUtils.normalizeError(null);
            
            expect(normalized).toBeInstanceOf(Error);
            expect(normalized.message).toBe('未知錯誤');
        });
    });

    describe('createContextualError', () => {
        it('should create error with context', () => {
            const error = ErrorHandlingUtils.createContextualError(
                'operation failed',
                'test context'
            );
            
            expect(error.message).toBe('test context: operation failed');
        });

        it('should include original error stack', () => {
            const originalError = new Error('original');
            const error = ErrorHandlingUtils.createContextualError(
                'operation failed',
                'test context',
                originalError
            );
            
            expect(error.stack).toContain('原始錯誤:');
        });
    });

    describe('safeExecute', () => {
        it('should return operation result on success', () => {
            const operation = jest.fn().mockReturnValue('success');
            const result = ErrorHandlingUtils.safeExecute(
                operation,
                'fallback',
                'test context'
            );
            
            expect(result).toBe('success');
        });

        it('should return fallback on error', () => {
            const operation = jest.fn().mockImplementation(() => {
                throw new Error('operation failed');
            });
            const result = ErrorHandlingUtils.safeExecute(
                operation,
                'fallback',
                'test context'
            );
            
            expect(result).toBe('fallback');
        });
    });

    describe('safeExecuteAsync', () => {
        it('should return operation result on success', async () => {
            const operation = jest.fn().mockResolvedValue('async success');
            const result = await ErrorHandlingUtils.safeExecuteAsync(
                operation,
                'fallback',
                'test context'
            );
            
            expect(result).toBe('async success');
        });

        it('should return fallback on error', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('async failed'));
            const result = await ErrorHandlingUtils.safeExecuteAsync(
                operation,
                'fallback',
                'test context'
            );
            
            expect(result).toBe('fallback');
        });
    });

    describe('edge cases', () => {
        it('should handle undefined operation result', async () => {
            const operation = jest.fn().mockResolvedValue(undefined);
            const result = await ErrorHandlingUtils.executeWithErrorHandling(
                operation,
                'test operation'
            );
            
            expect(result.success).toBe(true);
            expect(result.data).toBeUndefined();
        });

        it('should handle null operation result', async () => {
            const operation = jest.fn().mockResolvedValue(null);
            const result = await ErrorHandlingUtils.executeWithErrorHandling(
                operation,
                'test operation'
            );
            
            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });

        it('should handle empty batch operation', async () => {
            const result = await ErrorHandlingUtils.executeBatchWithErrorHandling(
                [],
                jest.fn(),
                'empty batch'
            );
            
            expect(result.success).toBe(true);
            expect(result.results).toEqual([]);
            expect(result.totalCount).toBe(0);
        });
    });
});
