"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CE03LocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CE03LocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const engines_ce03_1 = require("@scu/engines-ce03");
let CE03LocalAdapter = CE03LocalAdapter_1 = class CE03LocalAdapter {
    name = 'ce03_local_adapter';
    logger = new common_1.Logger(CE03LocalAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'ce03_visual_density';
    }
    async invoke(input) {
        this.logger.log(`Invoking CE03 Local Adapter for jobType=${input.jobType}`);
        try {
            const engineInput = {
                structured_text: input.payload?.structured_text || '',
                context: {
                    ...input.context,
                    projectId: input.context?.projectId || 'unknown',
                },
            };
            const output = await engines_ce03_1.ce03RealEngine.run((engineInput));
            return {
                status: 'SUCCESS',
                output,
                metrics: {
                    usage: output.billing_usage,
                },
            };
        }
        catch (error) {
            this.logger.error(`CE03 Local execution failed: ${error.message}`);
            return {
                status: 'FAILED',
                error: {
                    message: error.message,
                    code: 'CE03_LOCAL_ERR',
                },
            };
        }
    }
};
exports.CE03LocalAdapter = CE03LocalAdapter;
exports.CE03LocalAdapter = CE03LocalAdapter = CE03LocalAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], CE03LocalAdapter);
//# sourceMappingURL=ce03_visual_density.adapter.js.map