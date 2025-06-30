import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DatabaseManager } from '../DatabaseManager';
import * as fs from 'fs';
import * as path from 'path';

// Mock sqlite3
const mockDatabase = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  close: jest.fn(),
  serialize: jest.fn((callback: Function) => callback()),
  parallelize: jest.fn((callback: Function) => callback())
};

jest.mock('sqlite3', () => ({
  Database: jest.fn(() => mockDatabase)
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  dirname: jest.fn((path: string) => path.split('/').slice(0, -1).join('/'))
}));

describe('DatabaseManager', () => {
  let databaseManager: DatabaseManager;
  const testDbPath = '/test/path/test.db';

  beforeEach(() => {
    jest.clearAllMocks();
    databaseManager = new DatabaseManager(testDbPath);
  });

  afterEach(async () => {
    if (databaseManager) {
      await databaseManager.close();
    }
  });

  describe('Initialization', () => {
    test('should create database directory if it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await databaseManager.initialize();
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/path', { recursive: true });
    });

    test('should not create directory if it already exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      await databaseManager.initialize();
      
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    test('should initialize database schema', async () => {
      mockDatabase.run.mockImplementation((sql: string, callback?: Function) => {
        if (callback) callback(null);
      });

      await databaseManager.initialize();

      // Should call run for each table creation
      expect(mockDatabase.run).toHaveBeenCalledTimes(12); // 12 tables in schema
    });

    test('should handle initialization errors', async () => {
      mockDatabase.run.mockImplementation((sql: string, callback?: Function) => {
        if (callback) callback(new Error('Database error'));
      });

      await expect(databaseManager.initialize()).rejects.toThrow('Database error');
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(null);
      });
      await databaseManager.initialize();
    });

    test('should execute run queries', async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(null);
      });

      await databaseManager.run('INSERT INTO test (name) VALUES (?)', ['test']);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        'INSERT INTO test (name) VALUES (?)',
        ['test'],
        expect.any(Function)
      );
    });

    test('should execute get queries', async () => {
      const mockResult = { id: 1, name: 'test' };
      mockDatabase.get.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(null, mockResult);
      });

      const result = await databaseManager.get('SELECT * FROM test WHERE id = ?', [1]);

      expect(result).toEqual(mockResult);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE id = ?',
        [1],
        expect.any(Function)
      );
    });

    test('should execute query (all) operations', async () => {
      const mockResults = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' }
      ];
      mockDatabase.all.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(null, mockResults);
      });

      const results = await databaseManager.query('SELECT * FROM test', []);

      expect(results).toEqual(mockResults);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        'SELECT * FROM test',
        [],
        expect.any(Function)
      );
    });

    test('should handle query errors', async () => {
      mockDatabase.get.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(new Error('Query error'));
      });

      await expect(databaseManager.get('SELECT * FROM test', [])).rejects.toThrow('Query error');
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(null);
      });
      await databaseManager.initialize();
    });

    test('should execute transaction successfully', async () => {
      const operations = [
        () => databaseManager.run('INSERT INTO test (name) VALUES (?)', ['test1']),
        () => databaseManager.run('INSERT INTO test (name) VALUES (?)', ['test2'])
      ];

      await databaseManager.transaction(operations);

      expect(mockDatabase.run).toHaveBeenCalledWith('BEGIN TRANSACTION', [], expect.any(Function));
      expect(mockDatabase.run).toHaveBeenCalledWith('COMMIT', [], expect.any(Function));
    });

    test('should rollback transaction on error', async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (sql.includes('INSERT')) {
          if (callback) callback(new Error('Insert error'));
        } else {
          if (callback) callback(null);
        }
      });

      const operations = [
        () => databaseManager.run('INSERT INTO test (name) VALUES (?)', ['test1'])
      ];

      await expect(databaseManager.transaction(operations)).rejects.toThrow('Insert error');

      expect(mockDatabase.run).toHaveBeenCalledWith('ROLLBACK', [], expect.any(Function));
    });
  });

  describe('Backup and Restore', () => {
    beforeEach(async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(null);
      });
      await databaseManager.initialize();
    });

    test('should create backup', async () => {
      const backupPath = '/test/backup.db';
      
      await databaseManager.backup(backupPath);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('VACUUM INTO'),
        [],
        expect.any(Function)
      );
    });

    test('should handle backup errors', async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (sql.includes('VACUUM')) {
          if (callback) callback(new Error('Backup error'));
        } else {
          if (callback) callback(null);
        }
      });

      await expect(databaseManager.backup('/test/backup.db')).rejects.toThrow('Backup error');
    });
  });

  describe('Database Maintenance', () => {
    beforeEach(async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(null);
      });
      await databaseManager.initialize();
    });

    test('should vacuum database', async () => {
      await databaseManager.vacuum();

      expect(mockDatabase.run).toHaveBeenCalledWith('VACUUM', [], expect.any(Function));
    });

    test('should analyze database', async () => {
      await databaseManager.analyze();

      expect(mockDatabase.run).toHaveBeenCalledWith('ANALYZE', [], expect.any(Function));
    });

    test('should get database info', async () => {
      const mockInfo = [
        { name: 'page_count', value: '100' },
        { name: 'page_size', value: '4096' }
      ];

      mockDatabase.all.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(null, mockInfo);
      });

      const info = await databaseManager.getDatabaseInfo();

      expect(info).toEqual(mockInfo);
      expect(mockDatabase.all).toHaveBeenCalledWith('PRAGMA database_list', [], expect.any(Function));
    });
  });

  describe('Connection Management', () => {
    test('should close database connection', async () => {
      mockDatabase.close.mockImplementation((callback?: Function) => {
        if (callback) callback(null);
      });

      await databaseManager.close();

      expect(mockDatabase.close).toHaveBeenCalled();
    });

    test('should handle close errors', async () => {
      mockDatabase.close.mockImplementation((callback?: Function) => {
        if (callback) callback(new Error('Close error'));
      });

      await expect(databaseManager.close()).rejects.toThrow('Close error');
    });

    test('should check if database is connected', () => {
      expect(databaseManager.isConnected()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', () => {
      const sqlite3 = require('sqlite3');
      (sqlite3.Database as jest.Mock).mockImplementation(() => {
        throw new Error('Connection error');
      });

      expect(() => new DatabaseManager('/invalid/path')).toThrow('Connection error');
    });

    test('should provide meaningful error messages', async () => {
      mockDatabase.run.mockImplementation((sql: string, params: any[], callback?: Function) => {
        if (callback) callback(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed'));
      });

      await databaseManager.initialize();

      await expect(
        databaseManager.run('INSERT INTO test (id) VALUES (?)', [1])
      ).rejects.toThrow('SQLITE_CONSTRAINT: UNIQUE constraint failed');
    });
  });
});
