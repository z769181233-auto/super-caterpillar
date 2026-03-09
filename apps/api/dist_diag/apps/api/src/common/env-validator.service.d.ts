import { OnModuleInit } from '@nestjs/common';
export declare class EnvValidatorService implements OnModuleInit {
    private readonly logger;
    private readonly P0_REQUIRED_VARS;
    private readonly P1_RECOMMENDED_VARS;
    private readonly PRODUCTION_RULES;
    onModuleInit(): void;
    private getVarDescription;
    private maskSensitive;
    private printEnvironmentSummary;
    private extractDbHost;
}
