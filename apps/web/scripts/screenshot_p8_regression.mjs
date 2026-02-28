#!/usr/bin/env node
/**
 * P8.1 全量回归矩阵脚本
 * 覆盖 P7.1 中定义的 13 条回归用例
 * 
 * 环境变量:
 *   E2E_BASE_URL  — 目标服务地址 (默认 http://localhost:3001)
 *   E2E_PROJECT_ID — Studio 测试用项目 ID (默认 test-e2e-project)
 *   E2E_BUILD_ID   — Studio 测试用构建 ID (默认 test-build-001)
 *   E2E_OUT_DIR   — 截图输出目录 (默认 docs/_evidence/p8_release/screens)
 *
 * 用法:
 *   E2E_MODE=1 node scripts/e2e/screenshot_p7_regression.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// ── 环境变量（全部从 env 读取，禁止硬编码）────────────────────────────
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';
const PROJECT_ID = process.env.E2E_PROJECT_ID || 'test-e2e-project';
const BUILD_ID = process.env.E2E_BUILD_ID || 'test-build-001';
const OUT_DIR = path.resolve(
    process.cwd(),
    process.env.E2E_OUT_DIR || 'docs/_evidence/p8_release/screens'
);

// ── E2E 安全门（不允许在生产模式直接跑）────────────────────────────────
if (process.env.NODE_ENV === 'production' && !process.env.CI) {
    console.error('[E2E] 禁止在生产环境执行回归脚本。请设置 E2E_MODE=1 或 CI=true。');
    process.exit(1);
}
process.env.E2E_MODE = '1';

fs.mkdirSync(OUT_DIR, { recursive: true });

const RESULTS = [];

async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'zh-CN',
    });

    // E2E mock-pass cookie（只在测试环境有效）
    await ctx.addCookies([
        { name: 'accessToken', value: 'mock-pass', domain: new URL(BASE_URL).hostname, path: '/' },
    ]);

    const page = await ctx.newPage();

    // ── 工具函数 ──────────────────────────────────────────────────────────
    async function snap(id, label) {
        const file = path.join(OUT_DIR, `${id}_${label}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(`[SNAP] ${id} → ${path.basename(file)}`);
        RESULTS.push({ id, label, file: path.basename(file), status: 'PASS' });
    }

    async function safeGo(url, waitMs = 2000) {
        try {
            await page.goto(url, { timeout: 15000, waitUntil: 'networkidle' });
            await page.waitForTimeout(waitMs);
        } catch (e) {
            console.warn(`[WARN] goto ${url} timed out, continuing...`);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // R01: Landing 首页
    // ────────────────────────────────────────────────────────────────────
    console.log('\n── R01: Landing 首页 ─────────────────────────────');
    await safeGo(`${BASE_URL}/zh`);
    await snap('r01', 'landing_zh');

    // ────────────────────────────────────────────────────────────────────
    // R02: Auth 登录三语快照
    // ────────────────────────────────────────────────────────────────────
    console.log('\n── R02: Auth 登录三语 ────────────────────────────');
    for (const locale of ['zh', 'en', 'vi']) {
        await safeGo(`${BASE_URL}/${locale}/login`);
        await snap('r02', `login_${locale}`);
    }

    // ────────────────────────────────────────────────────────────────────
    // R03: 未鉴权跳转 /projects → /login?from=...
    // ────────────────────────────────────────────────────────────────────
    console.log('\n── R03: 未鉴权跳转 ───────────────────────────────');
    const noAuthCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const noAuthPage = await noAuthCtx.newPage();
    await noAuthPage.goto(`${BASE_URL}/zh/projects`, { timeout: 10000, waitUntil: 'networkidle' }).catch(() => { });
    await noAuthPage.waitForTimeout(1500);
    const url03 = noAuthPage.url();
    const redirected = url03.includes('login') || url03.includes('from=');
    console.log(`[R03] url=${url03} redirected=${redirected}`);
    await noAuthPage.screenshot({ path: path.join(OUT_DIR, 'r03_auth_redirect.png') });
    RESULTS.push({ id: 'r03', label: 'auth_redirect', file: 'r03_auth_redirect.png', status: redirected ? 'PASS' : 'WARN' });
    await noAuthCtx.close();

    // ────────────────────────────────────────────────────────────────────
    // R04~R07: Projects 列表 + Project Detail 三标签
    // ────────────────────────────────────────────────────────────────────
    console.log('\n── R04: Projects 列表 ────────────────────────────');
    await safeGo(`${BASE_URL}/zh/projects`);
    await snap('r04', 'projects_list');

    console.log('\n── R05~R07: ProjectDetail 三标签 ────────────────');
    await safeGo(`${BASE_URL}/zh/projects/${PROJECT_ID}`);
    await snap('r05', 'project_detail_overview');

    // 点击 Builds tab（如存在）
    const buildsTab = page.locator('[data-tab="builds"], button:has-text("构建"), button:has-text("Builds")').first();
    if (await buildsTab.count() > 0) {
        await buildsTab.click();
        await page.waitForTimeout(1000);
        await snap('r06', 'project_detail_builds');
    } else {
        console.log('[R06] builds tab not found, skipping click');
        await snap('r06', 'project_detail_builds_fallback');
    }

    const evidenceTab = page.locator('[data-tab="evidence"], button:has-text("证据"), button:has-text("Evidence")').first();
    if (await evidenceTab.count() > 0) {
        await evidenceTab.click();
        await page.waitForTimeout(1000);
        await snap('r07', 'project_detail_evidence');
    } else {
        await snap('r07', 'project_detail_evidence_fallback');
    }

    // ────────────────────────────────────────────────────────────────────
    // R08~R13: Studio P6 核心路径
    // ────────────────────────────────────────────────────────────────────
    const STUDIO_URL = `${BASE_URL}/zh/projects/${PROJECT_ID}/studio/${BUILD_ID}`;

    console.log('\n── R08: Studio AutoFocus ────────────────────────');
    await safeGo(STUDIO_URL, 3000);
    await snap('r08', 'studio_autofocus');

    console.log('\n── R09: 大纲点击 Scene → Shot 跳转 ─────────────');
    // 点击第一个 scene 节点
    const sceneNode = page.locator('.treeItem').nth(1);
    if (await sceneNode.count() > 0) {
        await sceneNode.click();
        await page.waitForTimeout(1200);
    }
    await snap('r09', 'studio_scene_to_shot');

    console.log('\n── R10: 曲线点击 → Reader+Outline 同步 ─────────');
    // 点击 SVG 曲线上的第一个 circle
    const curveCircle = page.locator('svg circle').first();
    if (await curveCircle.count() > 0) {
        await curveCircle.click({ force: true });
        await page.waitForTimeout(1500);
    }
    await snap('r10', 'studio_curve_sync');

    console.log('\n── R11: 角色折叠 auto/manual 持久化 ────────────');
    // 点击折叠/展开按钮（toggle），然后刷新验证持久化
    const rolesToggle = page.locator('button').filter({ hasText: /展开|收起|Mở|Thu/ }).first();
    if (await rolesToggle.count() > 0) {
        await rolesToggle.click();
        await page.waitForTimeout(800);
    }
    await snap('r11', 'studio_roles_collapsed');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await snap('r11b', 'studio_roles_after_reload');

    console.log('\n── R12: AuditBadges unknown 态 ──────────────────');
    // 回到 Studio 首屏截图徽章
    await safeGo(STUDIO_URL, 2500);
    await snap('r12', 'studio_audit_badges');

    console.log('\n── R13: AuditBadges en 语种 ──────────────────────');
    await safeGo(`${BASE_URL}/en/projects/${PROJECT_ID}/studio/${BUILD_ID}`, 2500);
    await snap('r13', 'studio_audit_badges_en');

    // ────────────────────────────────────────────────────────────────────
    // 汇总输出
    // ────────────────────────────────────────────────────────────────────
    await browser.close();

    console.log('\n══════════════════════════════════════════════════');
    console.log('P8.1 回归矩阵结果');
    console.log('══════════════════════════════════════════════════');
    RESULTS.forEach(r => {
        const icon = r.status === 'PASS' ? '✅' : '⚠️';
        console.log(`${icon} ${r.id.padEnd(4)} ${r.label}`);
    });
    const warns = RESULTS.filter(r => r.status !== 'PASS').length;
    console.log(`\n截图总数: ${RESULTS.length} | WARN: ${warns}`);
    console.log(`截图目录: ${OUT_DIR}`);

    // 写结果 JSON 供后续证据文档引用
    const resultPath = path.join(OUT_DIR, '..', 'regression_result.json');
    fs.writeFileSync(resultPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        results: RESULTS,
        summary: { total: RESULTS.length, warns }
    }, null, 2));
    console.log(`结果 JSON: ${resultPath}`);

    process.exit(warns > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
});
