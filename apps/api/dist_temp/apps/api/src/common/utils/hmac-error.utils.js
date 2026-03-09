"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHmacError = buildHmacError;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
function buildHmacError(code, message, debug) {
    const body = {
        success: false,
        code,
        error: { code, message },
        requestId: (0, crypto_1.randomUUID)(),
        timestamp: new Date().toISOString(),
        path: debug?.path,
        method: debug?.method,
    };
    const status = code === '4003' ? 401 : 403;
    return new common_1.HttpException(body, status);
}
//# sourceMappingURL=hmac-error.utils.js.map