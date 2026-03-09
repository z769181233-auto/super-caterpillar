#!/usr/bin/env node
import { PrismaClient } from 'database';
declare const prisma: PrismaClient<import("database").Prisma.PrismaClientOptions, never, import("../../../../packages/database/dist/generated/prisma/runtime/library").DefaultArgs>;
interface BillingEntry {
    tenantId: string;
    traceId: string;
    itemType: string;
    itemId: string;
    chargeCode: string;
    amount: number;
    currency?: string;
    status: 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED';
    evidenceRef?: string;
}
export declare function writeBillingLedger(entry: BillingEntry): Promise<void>;
export declare function calculateCE06Cost(charCount: number): number;
export { prisma };
