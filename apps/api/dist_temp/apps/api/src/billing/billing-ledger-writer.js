#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.writeBillingLedger = writeBillingLedger;
exports.calculateCE06Cost = calculateCE06Cost;
const database_1 = require("database");
const prisma = new database_1.PrismaClient({});
exports.prisma = prisma;
async function writeBillingLedger(entry) {
    try {
        console.log(`[BillingLedger] ⚠️ Skipped writing obsolete non-transactional ledger entry for: ${entry.traceId}`);
    }
    catch (error) {
        console.error(`[BillingLedger] ❌ Error writing ledger:`, error);
        throw error;
    }
}
function calculateCE06Cost(charCount) {
    return Math.ceil(charCount / 10000);
}
//# sourceMappingURL=billing-ledger-writer.js.map