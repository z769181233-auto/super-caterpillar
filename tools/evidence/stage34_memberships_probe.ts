/**
 * Stage 34 Day 2: Memberships Probe (只读对照脚本)
 * 用途：证明 "memberships: 0" 是查询口径问题，而非数据缺失
 */

import { PrismaClient } from 'database';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
    const args: Args = {};
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const s = raw.slice(2);
        const eq = s.indexOf('=');
        if (eq >= 0) args[s.slice(0, eq)] = s.slice(eq + 1);
        else args[s] = true;
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const dbUrl = (args['database-url'] || args['db'] || process.env.DATABASE_URL) as string | undefined;
    const email = (args['email'] as string | undefined) ?? 'stage34-day1-test@example.com';

    if (!dbUrl) throw new Error('DATABASE_URL missing. Provide --database-url=... or set env DATABASE_URL');

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

    try {
        // 环境自证
        const dbInfo = await prisma.$queryRawUnsafe<any[]>('select current_database() as db, current_schema() as schema');
        console.log('[stage34_memberships_probe] db_info=', dbInfo?.[0] ?? '(no row)');

        const userCount = await prisma.user.count();
        console.log('[stage34_memberships_probe] user_count=', userCount);

        const memberCount = await (prisma as any).organizationMember?.count?.();
        console.log('[stage34_memberships_probe] organization_member_count=', typeof memberCount === 'number' ? memberCount : '(model not found)');

        // Email 反查
        const userByEmail = await prisma.user.findUnique({
            where: { email } as any,
            select: { id: true, email: true, defaultOrganizationId: true } as any,
        });

        console.log('[stage34_memberships_probe] lookup_email=', email);
        console.log('[stage34_memberships_probe] user_by_email=', userByEmail);

        const resolvedUserId = (userByEmail as any)?.id ?? null;
        if (!resolvedUserId) {
            console.log('[stage34_memberships_probe] RESULT=PASS (email_not_found_in_current_db)');
            await prisma.$disconnect();
            process.exit(0);
        }

        console.log('[stage34_memberships_probe] resolved_user_id=', resolvedUserId);
        const defaultOrgId = (userByEmail as any)?.defaultOrganizationId ?? null;

        // 口径 A：用 count 作为权威（不依赖 include/关系字段名）
        const memberCountA = await (prisma as any).organizationMember.count({ where: { userId: resolvedUserId } });
        console.log('[probe] memberCountA(OrganizationMember.count where userId)=', memberCountA);

        // 口径 B：按 defaultOrganizationId 再核一次（更贴近"默认组织下是否有成员"）
        console.log('[probe] user.defaultOrganizationId=', defaultOrgId);

        let memberCountB = null as null | number;
        if (defaultOrgId) {
            memberCountB = await (prisma as any).organizationMember.count({
                where: { userId: resolvedUserId, organizationId: defaultOrgId }
            });
        }
        console.log('[probe] memberCountB(OrganizationMember.count in defaultOrg)=', memberCountB);

        // 口径 C：旧口径等价查询（RAW SQL，不触发 Prisma enum 解码）
        console.log('[probe] === 旧口径等价查询（RAW SQL，不触发 Prisma enum 解码） ===');

        const oldMembershipRows = await prisma.$queryRawUnsafe<any[]>(
            'SELECT om.id, om."organizationId" FROM organization_members om WHERE om."userId" = $1',
            resolvedUserId
        );

        console.log('[probe] old_query_membership_rows_count=', oldMembershipRows.length);

        const oldMembershipInDefaultOrgCount = defaultOrgId
            ? oldMembershipRows.filter((r: any) => r.organizationId === defaultOrgId).length
            : null;

        console.log('[probe] old_query_membership_in_default_org_count=', oldMembershipInDefaultOrgCount);

        console.log('[stage34_memberships_probe] RESULT=PASS');
    } catch (e: any) {
        console.error('[stage34_memberships_probe] RESULT=FAIL');
        console.error('[probe] ERROR=', e?.message ?? e);
        throw e;
    } finally {
        await prisma.$disconnect().catch(() => { });
    }
}

main().catch((e) => {
    console.error('[stage34_memberships_probe] FATAL=', e?.message ?? e);
    process.exit(1);
});
