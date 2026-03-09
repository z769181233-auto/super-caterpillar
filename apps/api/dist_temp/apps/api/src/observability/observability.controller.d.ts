import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
export declare class ObservabilityController {
    private readonly health;
    private readonly memory;
    private readonly prisma;
    constructor(health: HealthCheckService, memory: MemoryHealthIndicator, prisma: PrismaService);
    check(): Promise<import("@nestjs/terminus").HealthCheckResult<import("@nestjs/terminus").HealthIndicatorResult<string, import("@nestjs/terminus").HealthIndicatorStatus, Record<string, any>> & {
        database: {
            status: "up";
        };
    } & import("@nestjs/terminus").HealthIndicatorResult<"memory_heap">, Partial<import("@nestjs/terminus").HealthIndicatorResult<string, import("@nestjs/terminus").HealthIndicatorStatus, Record<string, any>> & {
        database: {
            status: "up";
        };
    } & import("@nestjs/terminus").HealthIndicatorResult<"memory_heap">> | undefined, Partial<import("@nestjs/terminus").HealthIndicatorResult<string, import("@nestjs/terminus").HealthIndicatorStatus, Record<string, any>> & {
        database: {
            status: "up";
        };
    } & import("@nestjs/terminus").HealthIndicatorResult<"memory_heap">> | undefined>>;
    getBatchProgress(projectId: string): Promise<{
        projectId: string;
        timestamp: number;
        succeeded: number;
        failed: number;
        pending: number;
    }>;
}
