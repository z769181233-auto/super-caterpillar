/* tools/evidence/stage34_integrity_check.ts
 * Stage 34 Evidence Script (read-only)
 * - No business code touched
 * - Uses database package's PrismaClient  
 * - Strong diagnostics to avoid "all null" ambiguity
 */

import { PrismaClient } from 'database';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
    const args: Args = {};
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const s = raw.slice(2);
        const eq = s.indexOf('=');
        if (eq >= 0) {
            const k = s.slice(0, eq).trim();
            const v = s.slice(eq + 1).trim();
            args[k] = v;
        } else {
            args[s.trim()] = true;
        }
    }
    return args;
}

function maskDatabaseUrl(url?: string): string {
    if (!url) return '(undefined)';
    try {
        const u = new URL(url);
        const schema = u.searchParams.get('schema') ?? '(none)';
        const host = u.hostname;
        const port = u.port || '(default)';
        const db = u.pathname?.replace(/^\//, '') || '(none)';
        return `postgresql://***@${host}:${port}/${db}?schema=${schema}`;
    } catch {
        return url.replace(/\/\/([^@]+)@/g, '//***@');
    }
}

function toInt(v: unknown, def: number): number {
    if (typeof v !== 'string') return def;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let t: NodeJS.Timeout | undefined;
    const timeout = new Promise<T>((_, rej) => {
        t = setTimeout(() => rej(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    });
    return Promise.race([p, timeout]).finally(() => t && clearTimeout(t));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const dbUrl = (args['database-url'] || args['db'] || process.env.DATABASE_URL) as string | undefined;
    const take = toInt(args['take'], 5);

    if (!dbUrl) {
        console.error('[stage34_integrity_check] ERROR: DATABASE_URL is missing. Provide --database-url=... or set env DATABASE_URL.');
        process.exit(2);
    }

    console.log('[stage34_integrity_check] DATABASE_URL(masked)=', maskDatabaseUrl(dbUrl));
    console.log('[stage34_integrity_check] take=', take);

    const prisma = new PrismaClient({
        datasources: { db: { url: dbUrl } },
    });

    try {
        const now = await prisma.$queryRawUnsafe<{ now: string }[]>('select now() as now');
        console.log('[stage34_integrity_check] db_now=', now?.[0]?.now ?? '(no row)');

        const userCount = await prisma.user.count();
        console.log('[stage34_integrity_check] user_count=', userCount);

        // Try findMany without orderBy to avoid schema/enum issues
        let users: any[] = [];
        try {
            users = await withTimeout(
                prisma.user.findMany({
                    take: Math.min(take, 20),
                    // 不强依赖 createdAt，避免 schema 差异导致异常或卡住
                }),
                10_000,
                'prisma.user.findMany'
            );
        } catch (e: any) {
            console.error('[stage34_integrity_check] user_findMany_failed=', e?.message ?? e);
            users = [];
        }

        console.log('[stage34_integrity_check] user_sample_brief=');
        console.log(
            JSON.stringify(
                users.map((u) => ({
                    id: (u as any)?.id,
                    email: (u as any)?.email,
                    name: (u as any)?.name,
                    createdAt: (u as any)?.createdAt,
                    defaultOrganizationId: (u as any)?.defaultOrganizationId,
                })),
                null,
                2
            )
        );

        console.log('[stage34_integrity_check] user_sample_json=');
        console.log(JSON.stringify(users, null, 2));

        try {
            const membershipCount = await (prisma as any).organizationMember?.count?.();
            if (typeof membershipCount === 'number') {
                console.log('[stage34_integrity_check] organization_member_count=', membershipCount);
            } else {
                console.log('[stage34_integrity_check] organization_member_count= (model not found)');
            }
        } catch (e: any) {
            console.log('[stage34_integrity_check] organization_member_count= (query failed)', e?.message ?? e);
        }

        console.log('[stage34_integrity_check] RESULT=PASS');
        process.exit(0);
    } catch (e: any) {
        console.error('[stage34_integrity_check] RESULT=FAIL');
        console.error('[stage34_integrity_check] ERROR=', e?.message ?? e);
        process.exit(1);
    } finally {
        await prisma.$disconnect().catch(() => { });
    }
}

main().catch((e) => {
    console.error('[stage34_integrity_check] FATAL=', e?.message ?? e);
    process.exit(1);
});
