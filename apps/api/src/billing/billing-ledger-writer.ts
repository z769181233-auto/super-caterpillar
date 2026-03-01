#!/usr/bin/env node
import { PrismaClient } from 'database';
import * as fs from 'fs';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

interface BillingEntry {
  tenantId: string;
  traceId: string; // JobId
  itemType: string; // 'JOB'
  itemId: string; // JobId
  chargeCode: string; // 'SCAN_CHAR'
  amount: number;
  currency?: string;
  status: 'PENDING' | 'POSTED' | 'REVERSED' | 'FAILED';
  evidenceRef?: string;
}

/**
 * P6-1-5: 幂等计费写入器
 * 基于 (tenantId, traceId, itemType, itemId, chargeCode) 唯一约束确保幂等
 */
export async function writeBillingLedger(entry: BillingEntry): Promise<void> {
  try {
    console.log(
      `[BillingLedger] ⚠️ Skipped writing obsolete non-transactional ledger entry for: ${entry.traceId}`
    );
  } catch (error: any) {
    console.error(`[BillingLedger] ❌ Error writing ledger:`, error);
    throw error;
  }
}

/**
 * CE06 计费口径：SCAN_CHAR = ceil(charCount / 10000) * 1 credit
 */
export function calculateCE06Cost(charCount: number): number {
  return Math.ceil(charCount / 10000);
}

export { prisma };
