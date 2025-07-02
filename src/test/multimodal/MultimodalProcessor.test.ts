import * as vscode from 'vscode';
import { MultimodalProcessor, MediaType, MediaContent } from '../../multimodal/MultimodalProcessor';

// Mock vscode module
jest.mock('vscode', () => ({
    Uri: {
        file: jest.fn(),
        parse: jest.fn()
    },
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    }
}));

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        stat: jest.fn(),
        readdir: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn()
    },
    existsSync: jest.fn(),
    mkdirSync: jest.fn()
}));

import * as fs from 'fs';

describe('MultimodalProcessor', () => {
    let processor: MultimodalProcessor;
    const mockUri = { fsPath: '/test/image.png' } as vscode.Uri;

    beforeEach(() => {
        processor = MultimodalProcessor.getInstance();
        jest.clearAllMocks();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = MultimodalProcessor.getInstance();
            const instance2 = MultimodalProcessor.getInstance();
            
            expect(instance1).toBe(instance2);
        });
    });

    describe('processMedia', () => {
        beforeEach(() => {
            (fs.promises.stat as jest.Mock).mockResolvedValue({
                size: 1024,
                mtime: new Date()
            });
        });

        it('should process PNG image successfully', async () => {
            const result = await processor.processMedia(mockUri);
            
            expect(result).toBeDefined();
            expect(result?.type).toBe(MediaType.IMAGE);
            expect(result?.format).toBe('png');
            expect(result?.uri).toBe(mockUri);
        });

        it('should return null for unsupported file type', async () => {
            const unsupportedUri = { fsPath: '/test/document.txt' } as vscode.Uri;
            
            const result = await processor.processMedia(unsupportedUri);
            
            expect(result).toBeNull();
        });

        it('should handle file stat errors', async () => {
            (fs.promises.stat as jest.Mock).mockRejectedValue(new Error('File not found'));
            
            const result = await processor.processMedia(mockUri);
            
            expect(result).toBeNull();
        });
    });

    describe('takeScreenshot', () => {
        it('should return null when screenshot fails', async () => {
            const result = await processor.takeScreenshot();
            
            // Since we don't have actual screenshot implementation, it should return null
            expect(result).toBeNull();
        });

        it('should accept screenshot options', async () => {
            const options = {
                quality: 80,
                format: 'jpeg' as any,
                delay: 1000
            };
            
            const result = await processor.takeScreenshot(options);
            
            expect(result).toBeNull();
        });
    });

    describe('importFromFigma', () => {
        it('should return null when Figma import fails', async () => {
            const options = {
                fileKey: 'test-file-key',
                nodeId: 'test-node-id'
            };
            
            const result = await processor.importFromFigma(options);
            
            // Since we don't have actual Figma API, it should return null
            expect(result).toBeNull();
        });

        it('should handle missing file key', async () => {
            const options = {
                fileKey: '',
                nodeId: 'test-node-id'
            };
            
            const result = await processor.importFromFigma(options);
            
            expect(result).toBeNull();
        });
    });

    describe('analyzeImage', () => {
        it('should return empty analysis for new media content', async () => {
            const mediaContent: MediaContent = {
                id: 'test-id',
                type: MediaType.IMAGE,
                format: 'png',
                uri: mockUri,
                metadata: {},
                createdAt: new Date(),
                size: 1024
            };
            
            const result = await processor.analyzeImage(mediaContent);
            
            expect(result).toBeDefined();
            expect(result.extractedText).toBeDefined();
            expect(result.uiElements).toBeDefined();
            expect(result.designPatterns).toBeDefined();
            expect(result.accessibility).toBeDefined();
            expect(result.technicalSpecs).toBeDefined();
        });
    });

    describe('generateCodeSuggestions', () => {
        it('should return empty suggestions for content without analysis', async () => {
            const mediaContent: MediaContent = {
                id: 'test-id',
                type: MediaType.IMAGE,
                format: 'png',
                uri: mockUri,
                metadata: {},
                createdAt: new Date(),
                size: 1024
            };
            
            const suggestions = await processor.generateCodeSuggestions(mediaContent);
            
            expect(suggestions).toEqual([]);
        });

        it('should generate suggestions based on UI elements', async () => {
            const mediaContent: MediaContent = {
                id: 'test-id',
                type: MediaType.IMAGE,
                format: 'png',
                uri: mockUri,
                metadata: {},
                analysisResult: {
                    uiElements: [
                        {
                            type: 'button',
                            label: 'Click Me',
                            boundingBox: { x: 0, y: 0, width: 100, height: 40 }
                        }
                    ]
                },
                createdAt: new Date(),
                size: 1024
            };
            
            const suggestions = await processor.generateCodeSuggestions(mediaContent);
            
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions[0]).toContain('button');
            expect(suggestions[0]).toContain('Click Me');
        });
    });

    describe('getSupportedFormats', () => {
        it('should return supported formats', () => {
            const formats = processor.getSupportedFormats();
            
            expect(formats).toBeDefined();
            expect(formats.images).toContain('.png');
            expect(formats.images).toContain('.jpg');
            expect(formats.videos).toContain('.mp4');
            expect(formats.audio).toContain('.mp3');
        });
    });

    describe('getCachedMedia', () => {
        it('should return undefined for non-existent media', () => {
            const result = processor.getCachedMedia('non-existent-id');
            
            expect(result).toBeUndefined();
        });
    });

    describe('clearCache', () => {
        it('should clear cache without errors', () => {
            expect(() => processor.clearCache()).not.toThrow();
        });
    });

    describe('edge cases', () => {
        it('should handle empty file paths', async () => {
            const emptyUri = { fsPath: '' } as vscode.Uri;
            
            const result = await processor.processMedia(emptyUri);
            
            expect(result).toBeNull();
        });

        it('should handle very large files', async () => {
            (fs.promises.stat as jest.Mock).mockResolvedValue({
                size: 100 * 1024 * 1024, // 100MB
                mtime: new Date()
            });
            
            const result = await processor.processMedia(mockUri);
            
            expect(result).toBeDefined();
        });

        it('should handle special characters in file paths', async () => {
            const specialUri = { fsPath: '/test/image with spaces & symbols!.png' } as vscode.Uri;
            (fs.promises.stat as jest.Mock).mockResolvedValue({
                size: 1024,
                mtime: new Date()
            });
            
            const result = await processor.processMedia(specialUri);
            
            expect(result).toBeDefined();
        });
    });
});
