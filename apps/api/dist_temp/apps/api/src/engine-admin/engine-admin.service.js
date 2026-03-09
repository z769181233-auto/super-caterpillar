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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineAdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let EngineAdminService = class EngineAdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        const engines = await this.prisma.engine.findMany({
            orderBy: { engineKey: 'asc' },
            include: {
                versions: {
                    orderBy: { versionName: 'asc' },
                },
            },
        });
        return engines.map((engine) => ({
            engineKey: engine.engineKey,
            adapterName: engine.adapterName,
            adapterType: engine.adapterType,
            defaultVersion: engine.defaultVersion,
            versions: engine.versions || [],
            enabled: engine.enabled ?? true,
            config: engine.config,
            createdAt: engine.createdAt,
            updatedAt: engine.updatedAt,
        }));
    }
    async createOrReplace(input) {
        return this.prisma.engine.upsert({
            where: { engineKey: input.engineKey },
            create: {
                engineKey: input.engineKey,
                adapterName: input.adapterName,
                adapterType: input.adapterType,
                config: input.config ?? {},
                enabled: input.enabled ?? true,
                version: input.version ?? null,
                code: input.engineKey,
                name: input.adapterName,
                type: input.adapterType,
                isActive: input.enabled ?? true,
            },
            update: {
                adapterName: input.adapterName,
                adapterType: input.adapterType,
                config: input.config ?? {},
                enabled: input.enabled ?? true,
                version: input.version ?? null,
                name: input.adapterName,
                type: input.adapterType,
                isActive: input.enabled ?? true,
            },
        });
    }
    async update(engineKey, input) {
        const existing = await this.prisma.engine.findUnique({ where: { engineKey } });
        if (!existing) {
            throw new common_1.NotFoundException(`Engine not found: ${engineKey}`);
        }
        return this.prisma.engine.update({
            where: { engineKey },
            data: {
                adapterName: input.adapterName ?? existing.adapterName,
                adapterType: input.adapterType ?? existing.adapterType,
                config: input.config ?? existing.config,
                enabled: input.enabled ?? existing.enabled,
                version: input.version ?? existing.version,
            },
        });
    }
    async delete(engineKey) {
        await this.prisma.engine.delete({ where: { engineKey } });
    }
    async listVersions(engineKey) {
        const engine = await this.prisma.engine.findUnique({
            where: { engineKey },
            include: { versions: true },
        });
        return engine?.versions ?? [];
    }
    async createOrUpdateVersion(engineKey, input) {
        const engine = await this.prisma.engine.findUnique({ where: { engineKey } });
        if (!engine) {
            throw new common_1.NotFoundException(`Engine not found: ${engineKey}`);
        }
        return this.prisma.engineVersion.upsert({
            where: { engineId_versionName: { engineId: engine.id, versionName: input.versionName } },
            create: {
                engineId: engine.id,
                versionName: input.versionName,
                config: input.config ?? {},
                enabled: input.enabled ?? true,
                rolloutWeight: input.rolloutWeight ?? null,
            },
            update: {
                config: input.config ?? {},
                enabled: input.enabled ?? true,
                rolloutWeight: input.rolloutWeight ?? null,
            },
        });
    }
    async updateVersion(engineKey, versionName, input) {
        const engine = await this.prisma.engine.findUnique({ where: { engineKey } });
        if (!engine)
            throw new common_1.NotFoundException(`Engine not found: ${engineKey}`);
        const existing = await this.prisma.engineVersion.findUnique({
            where: { engineId_versionName: { engineId: engine.id, versionName } },
        });
        if (!existing)
            throw new common_1.NotFoundException(`Engine version not found: ${engineKey}/${versionName}`);
        return this.prisma.engineVersion.update({
            where: { engineId_versionName: { engineId: engine.id, versionName } },
            data: {
                config: input.config ?? existing.config,
                enabled: input.enabled ?? existing.enabled,
                rolloutWeight: input.rolloutWeight ?? existing.rolloutWeight,
            },
        });
    }
    async deleteVersion(engineKey, versionName) {
        const engine = await this.prisma.engine.findUnique({ where: { engineKey } });
        if (!engine)
            throw new common_1.NotFoundException(`Engine not found: ${engineKey}`);
        const isDefault = engine.defaultVersion === versionName;
        if (isDefault) {
            await this.prisma.engine.update({
                where: { engineKey },
                data: { defaultVersion: null },
            });
        }
        await this.prisma.engineVersion.delete({
            where: { engineId_versionName: { engineId: engine.id, versionName } },
        });
    }
    async updateDefaultVersion(engineKey, defaultVersion) {
        const engine = await this.prisma.engine.findUnique({ where: { engineKey } });
        if (!engine)
            throw new common_1.NotFoundException(`Engine not found: ${engineKey}`);
        if (defaultVersion) {
            const ver = await this.prisma.engineVersion.findUnique({
                where: { engineId_versionName: { engineId: engine.id, versionName: defaultVersion } },
            });
            if (!ver)
                throw new common_1.NotFoundException(`Engine version not found: ${engineKey}/${defaultVersion}`);
        }
        return this.prisma.engine.update({
            where: { engineKey },
            data: { defaultVersion },
        });
    }
};
exports.EngineAdminService = EngineAdminService;
exports.EngineAdminService = EngineAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EngineAdminService);
//# sourceMappingURL=engine-admin.service.js.map