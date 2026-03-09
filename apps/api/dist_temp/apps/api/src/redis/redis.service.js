"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const redis_1 = require("redis");
const config_1 = require("@scu/config");
let RedisService = RedisService_1 = class RedisService {
    logger = new common_1.Logger(RedisService_1.name);
    client = null;
    isConnected = false;
    async onModuleInit() {
        try {
            const redisUrl = config_1.env.redisUrl || 'redis://localhost:6379';
            this.logger.log(`Connecting to Redis: ${redisUrl.replace(/\/\/.*@/, '//***@')}`);
            this.client = (0, redis_1.createClient)({
                url: redisUrl,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > 10) {
                            this.logger.error('Redis connection failed after 10 retries, giving up');
                            return false;
                        }
                        return Math.min(retries * 100, 3000);
                    },
                },
            });
            this.client.on('error', (err) => {
                this.logger.error('Redis Client Error:', err);
                this.isConnected = false;
            });
            this.client.on('connect', () => {
                this.logger.log('Redis connected');
                this.isConnected = true;
            });
            this.client.on('disconnect', () => {
                this.logger.warn('Redis disconnected');
                this.isConnected = false;
            });
            await this.client.connect();
            this.logger.log('Redis service initialized');
        }
        catch (error) {
            this.logger.error(`Failed to connect to Redis: ${error.message}`);
            this.logger.warn('Redis operations will be disabled, falling back to direct DB queries');
            this.client = null;
            this.isConnected = false;
        }
    }
    async onModuleDestroy() {
        if (this.client) {
            try {
                await this.client.quit();
                this.logger.log('Redis connection closed');
            }
            catch (error) {
                this.logger.error(`Error closing Redis connection: ${error.message}`);
            }
        }
    }
    isAvailable() {
        return this.client !== null && this.isConnected;
    }
    async get(key) {
        if (!this.isAvailable()) {
            return null;
        }
        try {
            const value = await this.client.get(key);
            return value === null ? null : (typeof value === 'string' ? value : value.toString());
        }
        catch (error) {
            this.logger.warn(`Redis GET failed for key ${key}: ${error.message}`);
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.isAvailable()) {
            return false;
        }
        try {
            if (ttlSeconds) {
                await this.client.setEx(key, ttlSeconds, value);
            }
            else {
                await this.client.set(key, value);
            }
            return true;
        }
        catch (error) {
            this.logger.warn(`Redis SET failed for key ${key}: ${error.message}`);
            return false;
        }
    }
    async del(key) {
        if (!this.isAvailable()) {
            return false;
        }
        try {
            await this.client.del(key);
            return true;
        }
        catch (error) {
            this.logger.warn(`Redis DEL failed for key ${key}: ${error.message}`);
            return false;
        }
    }
    async getJson(key) {
        const value = await this.get(key);
        if (!value) {
            return null;
        }
        try {
            return JSON.parse(value);
        }
        catch (error) {
            this.logger.warn(`Redis GET JSON failed for key ${key}: ${error.message}`);
            return null;
        }
    }
    async setJson(key, value, ttlSeconds) {
        try {
            const jsonString = JSON.stringify(value);
            return await this.set(key, jsonString, ttlSeconds);
        }
        catch (error) {
            this.logger.warn(`Redis SET JSON failed for key ${key}: ${error.message}`);
            return false;
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)()
], RedisService);
//# sourceMappingURL=redis.service.js.map