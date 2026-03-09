"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldBypassSignature = shouldBypassSignature;
exports.shouldRequireSignature = shouldRequireSignature;
const SIGN_EXEMPT_PREFIX = [
    '/api/auth',
    '/api/health',
    '/api/public',
    '/health',
    '/metrics',
    '/ping',
    '/',
];
const INTERNAL_HMAC_ONLY_PREFIX = ['/api/_internal'];
function shouldBypassSignature(pathname) {
    const path = (pathname || '').split('?')[0];
    return SIGN_EXEMPT_PREFIX.some((p) => path.startsWith(p));
}
function shouldRequireSignature(pathname) {
    return !shouldBypassSignature(pathname);
}
//# sourceMappingURL=signature-path.utils.js.map