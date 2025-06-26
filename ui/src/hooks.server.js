"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = void 0;
const handle = async ({ event, resolve }) => {
    if (event.url.pathname === '/appspecific/com.chrome.devtools.json') {
        return new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    return resolve(event);
};
exports.handle = handle;
//# sourceMappingURL=hooks.server.js.map