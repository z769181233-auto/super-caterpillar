"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LoggingInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let LoggingInterceptor = LoggingInterceptor_1 = class LoggingInterceptor {
    logger = new common_1.Logger(LoggingInterceptor_1.name);
    intercept(context, next) {
        const now = Date.now();
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        const method = req?.method;
        const url = req?.url;
        const traceId = req?.headers?.['x-trace-id'] || crypto.randomUUID();
        if (req?.headers) {
            req.headers['x-trace-id'] = traceId;
        }
        this.logger.log(`REQ_IN traceId=${traceId} method=${method} url=${url}`);
        return next.handle().pipe((0, operators_1.tap)({
            next: () => {
                const costMs = Date.now() - now;
                const status = res?.statusCode || 200;
                this.logger.log(`REQ_OUT traceId=${traceId} status=${status} costMs=${costMs}`);
            },
            error: (err) => {
                const costMs = Date.now() - now;
                const status = err?.status || res?.statusCode || 500;
                this.logger.error(`REQ_OUT traceId=${traceId} status=${status} costMs=${costMs} error=${err?.message}`);
            },
        }));
    }
};
exports.LoggingInterceptor = LoggingInterceptor;
exports.LoggingInterceptor = LoggingInterceptor = LoggingInterceptor_1 = __decorate([
    (0, common_1.Injectable)()
], LoggingInterceptor);
//# sourceMappingURL=logging.interceptor.js.map