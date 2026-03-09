import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'database';
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    constructor();
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
