"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMError = void 0;
/**
 * LLM 錯誤
 */
class LLMError extends Error {
    constructor(message, provider, originalError, errorCode) {
        super(message);
        this.provider = provider;
        this.originalError = originalError;
        this.errorCode = errorCode;
        this.name = 'LLMError';
    }
}
exports.LLMError = LLMError;
//# sourceMappingURL=types.js.map