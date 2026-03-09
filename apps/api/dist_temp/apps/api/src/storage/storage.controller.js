"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var StorageController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const api_security_decorator_1 = require("../security/api-security/api-security.decorator");
const signed_url_service_1 = require("./signed-url.service");
const local_storage_service_1 = require("./local-storage.service");
const storage_auth_service_1 = require("./storage-auth.service");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const current_organization_decorator_1 = require("../auth/decorators/current-organization.decorator");
function normalizeStorageKey(keyDef) {
    if (!keyDef)
        return '';
    if (Array.isArray(keyDef)) {
        return keyDef.join('/');
    }
    return String(keyDef).replace(/^\/+/, '');
}
let StorageController = StorageController_1 = class StorageController {
    signedUrlService;
    localStorageService;
    storageAuthService;
    logger = new common_1.Logger(StorageController_1.name);
    constructor(signedUrlService, localStorageService, storageAuthService) {
        this.signedUrlService = signedUrlService;
        this.localStorageService = localStorageService;
        this.storageAuthService = storageAuthService;
    }
    probe() {
        return 'StorageController';
    }
    async signUrl(rawKey, user, orgId) {
        const key = normalizeStorageKey(rawKey);
        const { url, expiresAt } = this.signedUrlService.generateSignedUrl({
            key,
            tenantId: orgId || 'system-gate',
            userId: user?.userId || 'system-gate-user',
        });
        return { url, expiresAt };
    }
    async serveSigned(rawKey, expires, signature, tenantId, userId, req, res) {
        const key = normalizeStorageKey(rawKey);
        const method = req.method;
        const verifyMethod = method === 'HEAD' ? 'GET' : method;
        const isValid = this.signedUrlService.verifySignedUrl(key, parseInt(expires, 10), signature, tenantId, userId, verifyMethod);
        if (!isValid) {
            this.logger.warn(`Invalid or expired signature for key: ${key}`);
            return res.status(common_1.HttpStatus.NOT_FOUND).json({ error: 'FILE_NOT_FOUND' });
        }
        try {
            await this.storageAuthService.verifyAccess(key, tenantId, userId);
        }
        catch (e) {
            this.logger.error(`Access check failed for key ${key}: ${e.message}`);
        }
        if (!this.localStorageService.exists(key)) {
            this.logger.warn(`File not found: ${key}`);
            return res.status(common_1.HttpStatus.NOT_FOUND).json({ error: 'FILE_NOT_FOUND' });
        }
        const absPath = this.localStorageService.getAbsolutePath(key);
        const storageRoot = this.localStorageService.adapter.root;
        return res.sendFile(key, { root: storageRoot });
    }
    async uploadNovel(req, res) {
        const headerSha = String(req.header('X-Content-SHA256') || '').trim();
        const len = Number(req.header('content-length') || 0);
        if (!headerSha || !/^[a-f0-9]{64}$/i.test(headerSha)) {
            return res.status(common_1.HttpStatus.BAD_REQUEST).json({ error: 'INVALID_SHA256' });
        }
        if (!Number.isFinite(len) || len <= 0) {
            return res.status(common_1.HttpStatus.BAD_REQUEST).json({ error: 'INVALID_CONTENT_LENGTH' });
        }
        const MAX = Number(process.env.MAX_CONTENT_LENGTH || 64 * 1024 * 1024);
        if (len > MAX) {
            return res.status(common_1.HttpStatus.PAYLOAD_TOO_LARGE).json({ error: 'PAYLOAD_TOO_LARGE' });
        }
        const storageRoot = process.env.STORAGE_ROOT || path.resolve(process.cwd(), '.data/storage');
        const finalRel = `novels/${headerSha.toLowerCase()}.txt`;
        const finalPath = path.resolve(storageRoot, finalRel);
        fs.mkdirSync(path.dirname(finalPath), { recursive: true });
        fs.mkdirSync(path.resolve(storageRoot, 'novels/.tmp'), { recursive: true });
        if (fs.existsSync(finalPath)) {
            const st = fs.statSync(finalPath);
            if (st.size === len) {
                return res
                    .status(common_1.HttpStatus.OK)
                    .json({ storageKey: finalRel, sha256: headerSha.toLowerCase(), size: len, exists: true });
            }
        }
        const tmpPath = path.resolve(storageRoot, `novels/.tmp/${headerSha}.${process.pid}.${Date.now()}.tmp`);
        const out = fs.createWriteStream(tmpPath, { flags: 'wx' });
        const hash = (0, crypto_1.createHash)('sha256');
        let bytes = 0;
        req.on('data', (chunk) => {
            bytes += chunk.length;
            hash.update(chunk);
        });
        req.pipe(out);
        const cleanup = () => {
            try {
                if (fs.existsSync(tmpPath))
                    fs.unlinkSync(tmpPath);
            }
            catch {
            }
        };
        out.on('error', (e) => {
            cleanup();
            return res
                .status(common_1.HttpStatus.INTERNAL_SERVER_ERROR)
                .json({ error: 'WRITE_FAIL', message: String(e) });
        });
        out.on('finish', () => {
            const computed = hash.digest('hex');
            if (computed !== headerSha.toLowerCase() || bytes !== len) {
                cleanup();
                return res.status(common_1.HttpStatus.UNAUTHORIZED).json({
                    error: 'SHA_MISMATCH',
                    expected: headerSha.toLowerCase(),
                    computed,
                    expectedBytes: len,
                    receivedBytes: bytes,
                });
            }
            try {
                fs.renameSync(tmpPath, finalPath);
                return res
                    .status(common_1.HttpStatus.OK)
                    .json({ storageKey: finalRel, sha256: computed, size: bytes, exists: false });
            }
            catch (err) {
                cleanup();
                return res
                    .status(common_1.HttpStatus.INTERNAL_SERVER_ERROR)
                    .json({ error: 'RENAME_FAIL', message: String(err) });
            }
        });
    }
};
exports.StorageController = StorageController;
__decorate([
    (0, common_1.Get)('__probe'),
    (0, public_decorator_1.Public)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StorageController.prototype, "probe", null);
__decorate([
    (0, common_1.Get)('sign/*path'),
    __param(0, (0, common_1.Param)('path')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, current_organization_decorator_1.CurrentOrganization)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "signUrl", null);
__decorate([
    (0, common_1.Get)('signed/*path'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('path')),
    __param(1, (0, common_1.Query)('expires')),
    __param(2, (0, common_1.Query)('signature')),
    __param(3, (0, common_1.Query)('tenantId')),
    __param(4, (0, common_1.Query)('userId')),
    __param(5, (0, common_1.Req)()),
    __param(6, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "serveSigned", null);
__decorate([
    (0, common_1.Post)('/novels'),
    (0, api_security_decorator_1.RequireSignature)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "uploadNovel", null);
exports.StorageController = StorageController = StorageController_1 = __decorate([
    (0, common_1.Controller)('storage'),
    __metadata("design:paramtypes", [signed_url_service_1.SignedUrlService,
        local_storage_service_1.LocalStorageService,
        storage_auth_service_1.StorageAuthService])
], StorageController);
//# sourceMappingURL=storage.controller.js.map