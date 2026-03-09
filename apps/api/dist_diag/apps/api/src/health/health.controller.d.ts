import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class HealthController {
    private readonly prisma;
    private readonly redisService?;
    constructor(prisma: PrismaService, redisService?: RedisService | undefined);
    health(): {
        ok: boolean;
        service: string;
        mode: string;
        stub: number;
        missing_envs: any;
        gate_mode: number;
        ts: string;
    };
    apiHealth(): {
        ok: boolean;
        service: string;
        status: string;
        mode: string;
        stub: number;
        missing_envs: any;
        gate_mode: number;
        ts: string;
    };
    live(): {
        ok: boolean;
        status: string;
        ts: string;
    };
    ready(): Promise<{
        ok: boolean;
        status: string;
        checks: Record<string, boolean | null>;
        ts: string;
    }>;
    gpu(): {
        available: boolean;
        reason: string;
        ts: string;
    };
    ping(): {
        ok: boolean;
        pong: boolean;
        ts: string;
    };
    metrics(): Promise<string>;
    readyAlias(): Promise<{
        ok: boolean;
        status: string;
        checks: Record<string, boolean | null>;
        ts: string;
    }>;
    liveAlias(): {
        ok: boolean;
        status: string;
        ts: string;
    };
    gpuAlias(): {
        available: boolean;
        reason: string;
        ts: string;
    };
}
