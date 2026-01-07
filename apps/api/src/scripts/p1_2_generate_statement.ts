// apps/api/src/scripts/p1_2_generate_statement.ts
import { PrismaClient } from "database";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
}

function stableStringify(items: any[]) {
    // items 已经是规整对象数组;这里做稳定序列化
    return JSON.stringify(items);
}

async function main() {
    const projectId = mustEnv("PROJECT_ID");
    const start = new Date(mustEnv("PERIOD_START"));
    const end = new Date(mustEnv("PERIOD_END"));

    const ledgers = await prisma.costLedger.findMany({
        where: {
            projectId,
            createdAt: { gte: start, lte: end },
        },
        select: {
            jobId: true,
            jobType: true,
            cost: true,
            createdAt: true,
        },
    });

    const normalized = ledgers
        .map((l) => ({
            jobId: l.jobId,
            jobType: String(l.jobType),
            cost: Number(l.cost),
            createdAt: l.createdAt.toISOString(),
        }))
        .sort((a, b) => {
            if (a.jobType !== b.jobType) return a.jobType.localeCompare(b.jobType);
            if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
            return a.createdAt.localeCompare(b.createdAt);
        });

    const canonical = stableStringify(normalized);
    const checksum = createHash("sha256").update(canonical).digest("hex");

    console.log(`CHECKSUM=${checksum}`);
}

main()
    .catch((e) => {
        console.error(String(e?.stack ?? e));
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
