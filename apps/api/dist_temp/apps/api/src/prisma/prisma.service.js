"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("database");
let PrismaService = PrismaService_1 = class PrismaService extends database_1.PrismaClient {
    logger = new common_1.Logger(PrismaService_1.name);
    constructor() {
        super({});
        if (process.env.NODE_ENV !== 'production') {
            try {
                this.logger.log('[PrismaService] Prisma Client 诊断信息:', {
                    prismaClientSource: this.constructor.name,
                    prismaClientPath: require.resolve('database'),
                    hasNonceStore: 'nonceStore' in this,
                    modelKeys: Object.keys(this)
                        .filter((k) => !k.startsWith('_') && !k.startsWith('$'))
                        .slice(0, 30),
                });
            }
            catch (e) {
                this.logger.log('[PrismaService] Prisma Client 诊断信息:', {
                    prismaClientSource: this.constructor.name,
                    hasNonceStore: 'nonceStore' in this,
                    modelKeys: Object.keys(this)
                        .filter((k) => !k.startsWith('_') && !k.startsWith('$'))
                        .slice(0, 30),
                    note: 'database 包路径解析失败（可能为 TypeScript 路径映射）',
                });
            }
        }
        const dbUrl = process.env.DATABASE_URL;
        const mockUrl = process.env.MOCK_DATABASE_URL;
        const isProd = process.env.NODE_ENV === 'production' || process.env.GATE_MODE === '1';
        let source = 'fallback/missing';
        let activeUrl = 'unknown';
        if (dbUrl) {
            source = 'DATABASE_URL';
            activeUrl = dbUrl;
        }
        else if (mockUrl) {
            source = 'MOCK_DATABASE_URL';
            activeUrl = mockUrl;
        }
        if (isProd && source !== 'DATABASE_URL') {
            const errMsg = `[P1-1] FATAL: DATABASE_URL is missing or using fallback/mock in production. Fail-fast triggered.`;
            console.error(errMsg);
            throw new Error(errMsg);
        }
        try {
            if (activeUrl && activeUrl !== 'unknown') {
                const parsed = new URL(activeUrl);
                const host = parsed.hostname;
                const port = parsed.port || '5432';
                const db = parsed.pathname.substring(1);
                const auditMsg = `[DB_URL_AUDIT] source=${source} host=${host} port=${port} db=${db}`;
                console.log(auditMsg);
                this.logger.log(auditMsg);
            }
        }
        catch (e) {
            const auditMsg = `[DB_URL_AUDIT] source=${source} unparseable_url`;
            console.log(auditMsg);
            this.logger.log(auditMsg);
        }
    }
    async onModuleInit() {
        console.log('[DEBUG_BOOT] PrismaService.onModuleInit start ($connect)');
        try {
            await this.$connect();
            console.log('[DEBUG_BOOT] PrismaService.onModuleInit end ($connect)');
        }
        catch (e) {
            console.error('[DEBUG_BOOT] PrismaService.onModuleInit FAILED', e);
            this.logger.warn(`[PrismaService] Failed to connect to DB at startup: ${e}`);
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map