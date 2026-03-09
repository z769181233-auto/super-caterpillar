"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireSignature = exports.REQUIRE_SIGNATURE_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRE_SIGNATURE_KEY = 'requireSignature';
const RequireSignature = () => (0, common_1.SetMetadata)(exports.REQUIRE_SIGNATURE_KEY, true);
exports.RequireSignature = RequireSignature;
//# sourceMappingURL=api-security.decorator.js.map