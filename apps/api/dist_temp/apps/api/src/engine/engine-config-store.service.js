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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineConfigStoreService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const findProjectRoot = () => {
    let current = __dirname;
    while (current !== path.dirname(current)) {
        if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
            return current;
        }
        current = path.dirname(current);
    }
    return path.resolve(__dirname, '../../../..');
};
const projectRoot = findProjectRoot();
const enginesJsonPath = path.join(projectRoot, 'apps/api/config/engines.json');
const enginesJson = JSON.parse(fs.readFileSync(enginesJsonPath, 'utf-8'));
let EngineConfigStoreService = class EngineConfigStoreService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByEngineKey(engineKey) {
        return this.prisma.engine?.findUnique({ where: { engineKey } }) ?? null;
    }
    async findVersion(engineKey, versionName) {
        const engine = await this.prisma.engine?.findUnique({
            where: { engineKey },
            include: { versions: true },
        });
        if (!engine)
            return null;
        return engine.versions?.find((v) => v.versionName === versionName) ?? null;
    }
    async listVersions(engineKey) {
        const engine = await this.prisma.engine?.findUnique({
            where: { engineKey },
            include: { versions: true },
        });
        return engine?.versions ?? [];
    }
    async listAllEngines() {
        if (!this.prisma.engine)
            return [];
        return this.prisma.engine.findMany({ orderBy: { engineKey: 'asc' } });
    }
    mergeConfig(dbEngine, jsonConfig) {
        const merged = {
            engineKey: jsonConfig?.engineKey ?? dbEngine?.engineKey,
            adapterName: jsonConfig?.adapterName ?? dbEngine?.adapterName,
            adapterType: jsonConfig?.adapterType ?? dbEngine?.adapterType,
            enabled: dbEngine?.enabled ?? jsonConfig?.enabled ?? true,
            modelInfo: jsonConfig?.modelInfo ?? undefined,
            httpConfig: jsonConfig?.httpConfig ?? undefined,
            isDefaultForJobTypes: jsonConfig?.isDefaultForJobTypes ?? undefined,
        };
        if (dbEngine?.adapterName)
            merged.adapterName = dbEngine.adapterName;
        if (dbEngine?.adapterType)
            merged.adapterType = dbEngine.adapterType;
        if (dbEngine?.config) {
            const cfg = dbEngine.config;
            if (cfg.httpConfig || cfg.adapterType === 'http') {
                merged.httpConfig = {
                    ...(merged.httpConfig || {}),
                    ...(cfg.httpConfig ?? cfg),
                };
            }
            else {
                merged.config = { ...(merged.config || {}), ...cfg };
            }
            if (cfg.modelInfo) {
                merged.modelInfo = { ...(merged.modelInfo || {}), ...cfg.modelInfo };
            }
            if (typeof cfg.enabled === 'boolean') {
                merged.enabled = cfg.enabled;
            }
        }
        return merged;
    }
    deepMerge(...sources) {
        const result = {};
        for (const src of sources) {
            if (!src || typeof src !== 'object')
                continue;
            for (const key of Object.keys(src)) {
                const prev = result[key];
                const next = src[key];
                if (Array.isArray(prev) && Array.isArray(next)) {
                    result[key] = next;
                }
                else if (prev &&
                    typeof prev === 'object' &&
                    next &&
                    typeof next === 'object' &&
                    !Array.isArray(prev) &&
                    !Array.isArray(next)) {
                    result[key] = this.deepMerge(prev, next);
                }
                else {
                    result[key] = next;
                }
            }
        }
        return result;
    }
    async resolveEngineConfig(engineKey, requestedVersion) {
        const jsonConfig = this.getJsonConfig(engineKey);
        const engine = await this.findByEngineKey(engineKey);
        let versionConfig = null;
        if (requestedVersion) {
            const ver = await this.findVersion(engineKey, requestedVersion);
            versionConfig = ver?.config ?? null;
        }
        else if (engine?.defaultVersion) {
            const ver = await this.findVersion(engineKey, engine.defaultVersion);
            versionConfig = ver?.config ?? null;
        }
        const merged = this.deepMerge(jsonConfig ?? {}, engine?.config ?? {}, versionConfig ?? {});
        return merged;
    }
    getJsonConfig(engineKey) {
        return enginesJson.engines.find((e) => e.engineKey === engineKey);
    }
};
exports.EngineConfigStoreService = EngineConfigStoreService;
exports.EngineConfigStoreService = EngineConfigStoreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EngineConfigStoreService);
//# sourceMappingURL=engine-config-store.service.js.map