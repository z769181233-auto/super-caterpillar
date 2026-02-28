import { PrismaClient } from 'database';

const prisma = new PrismaClient();

export class UsageMeter {
    /**
     * Records a novel import event.
     * @param organizationId Organization ID
     * @param bytes Total bytes of the novel source
     */
    static async recordImport(organizationId: string, bytes: number) {
        const billingCycleId = new Date().toISOString().substring(0, 7); // YYYY-MM

        console.log(`[UsageMeter] Recording import for Org ${organizationId}: ${bytes} bytes`);

        await prisma.usageRecord.upsert({
            where: {
                organizationId_billingCycleId: {
                    organizationId,
                    billingCycleId
                }
            },
            update: {
                novelCount: { increment: 1 },
                totalBytes: { increment: BigInt(bytes) }
            },
            create: {
                organizationId,
                billingCycleId,
                novelCount: 1,
                totalBytes: BigInt(bytes)
            }
        });
    }

    /**
     * Records processing effort (compute time, counts).
     */
    static async recordProcessing(organizationId: string, computeTimeMs: number, metadata: any) {
        const billingCycleId = new Date().toISOString().substring(0, 7);

        console.log(`[UsageMeter] Recording processing for Org ${organizationId}: ${computeTimeMs}ms`);

        await prisma.usageRecord.upsert({
            where: {
                organizationId_billingCycleId: {
                    organizationId,
                    billingCycleId
                }
            },
            update: {
                updatedAt: new Date()
                // Future: add computeTime aggregation if field added to schema
            },
            create: {
                organizationId,
                billingCycleId,
                novelCount: 0,
                totalBytes: BigInt(0)
            }
        });
    }

    /**
     * Gets current usage for an organization.
     */
    static async getUsage(organizationId: string) {
        const billingCycleId = new Date().toISOString().substring(0, 7);
        return await prisma.usageRecord.findUnique({
            where: {
                organizationId_billingCycleId: {
                    organizationId,
                    billingCycleId
                }
            }
        });
    }
}
