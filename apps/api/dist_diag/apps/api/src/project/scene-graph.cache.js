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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SceneGraphCache_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneGraphCache = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
const SCENE_GRAPH_KEY = (projectId) => `scene_graph:project:${projectId}`;
const TTL_SECONDS = 5 * 60;
let SceneGraphCache = SceneGraphCache_1 = class SceneGraphCache {
    redis;
    logger = new common_1.Logger(SceneGraphCache_1.name);
    constructor(redis) {
        this.redis = redis;
    }
    async get(projectId) {
        if (this.redis) {
            const result = await this.redis.getJson(SCENE_GRAPH_KEY(projectId));
            return result;
        }
        return null;
    }
    async set(projectId, sceneGraph) {
        if (this.redis) {
            const success = await this.redis.setJson(SCENE_GRAPH_KEY(projectId), sceneGraph, TTL_SECONDS);
            if (!success) {
                this.logger.warn(`Failed to cache scene graph for project ${projectId}`);
            }
        }
    }
    async invalidate(projectId) {
        if (this.redis) {
            await this.redis.del(SCENE_GRAPH_KEY(projectId));
        }
    }
};
exports.SceneGraphCache = SceneGraphCache;
exports.SceneGraphCache = SceneGraphCache = SceneGraphCache_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], SceneGraphCache);
//# sourceMappingURL=scene-graph.cache.js.map