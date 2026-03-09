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
var PermissionCache_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionCache = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
const USER_KEY = (userId) => `perm:user:${userId}`;
const PROJECT_KEY = (projectId, userId) => `perm:project:${projectId}:${userId}`;
const TTL_SECONDS = 10;
let PermissionCache = PermissionCache_1 = class PermissionCache {
    redis;
    logger = new common_1.Logger(PermissionCache_1.name);
    constructor(redis) {
        this.redis = redis;
    }
    async getUserPerms(userId) {
        if (this.redis) {
            const result = await this.redis.getJson(USER_KEY(userId));
            return result;
        }
        return null;
    }
    async setUserPerms(userId, perms) {
        if (this.redis) {
            const success = await this.redis.setJson(USER_KEY(userId), perms, TTL_SECONDS);
            if (!success) {
                this.logger.warn(`Failed to cache user permissions for ${userId}`);
            }
        }
    }
    async getProjectPerms(projectId, userId) {
        if (this.redis) {
            const result = await this.redis.getJson(PROJECT_KEY(projectId, userId));
            return result;
        }
        return null;
    }
    async setProjectPerms(projectId, userId, perms) {
        if (this.redis) {
            const success = await this.redis.setJson(PROJECT_KEY(projectId, userId), perms, TTL_SECONDS);
            if (!success) {
                this.logger.warn(`Failed to cache project permissions for ${projectId}:${userId}`);
            }
        }
    }
    async clear(projectId, userId) {
        if (this.redis) {
            await Promise.all([
                this.redis.del(USER_KEY(userId)),
                this.redis.del(PROJECT_KEY(projectId, userId)),
            ]);
        }
    }
};
exports.PermissionCache = PermissionCache;
exports.PermissionCache = PermissionCache = PermissionCache_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], PermissionCache);
//# sourceMappingURL=permission.cache.js.map