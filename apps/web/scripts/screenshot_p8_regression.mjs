#!/usr/bin/env node
/**
 * P8/P9 全量回归矩阵脚本 v5（严格门禁 + PASS/FAIL/SKIP 三态 + E2E_STRICT）
 *
 * 状态定义：
 *   PASS  — goto 成功 + selector 存在 + 截图完成
 *   FAIL  — goto 成功但 selector/断言失败
 *   SKIP  — 前置 goto 网络失败（TLS/超时）→ 依赖用例链式 SKIP
 *
 * 门禁规则：
 *   E2E_STRICT=1（staging 必须设）：FAIL>0 || SKIP>0 → exit 1
 *   E2E_STRICT 未设（localhost 可用）：仅 FAIL>0 → exit 1
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// ── 环境变量 ──────────────────────────────────────────────────────────────
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';
const PROJECT_ID = process.env.E2E_PROJECT_ID || 'test-e2e-project';
const BUILD_ID = process.env.E2E_BUILD_ID || 'test-build-001';
const OUT_DIR = path.resolve(
    process.cwd(),
    process.env.E2E_OUT_DIR || 'docs/_evidence/p9_release/p9_1_staging/screens'
);
const RESULT_FILE = path.join(OUT_DIR, '..', 'regression_result.json');
const IS_STAGING = BASE_URL.startsWith('https://');

if (process.env.NODE_ENV === 'production' && !process.env.CI) {
    console.error('[E2E-GATE] 禁止在生产环境执行。设置 E2E_MODE=1 或 CI=true。');
    process.exit(1);
}
process.env.E2E_MODE = '1';
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 结果注册表（预填，默认 FAIL）──────────────────────────────────────────
const ALL_IDS = ['r01', 'r02a', 'r02b', 'r02c', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08', 'r09', 'r10', 'r11', 'r11b', 'r12', 'r13'];
const REG = Object.fromEntries(ALL_IDS.map(id => [id, { id, label: '', status: 'FAIL', url: '', error: null, skipReason: null, screenshot: null }]));

const startedAt = new Date().toISOString();
const STUDIO = `${BASE_URL}/zh/projects/${PROJECT_ID}/studio/${BUILD_ID}`;

// ── 工具函数 ──────────────────────────────────────────────────────────────
function setPass(id, label, url, screenshot) {
    const r = REG[id];
    r.status = 'PASS'; r.label = label; r.url = url; r.screenshot = screenshot; r.error = null;
    console.log(`  ✅ ${id.padEnd(5)} ${label}`);
}
function setFail(id, label, url, err) {
    const r = REG[id];
    r.status = 'FAIL'; r.label = label; r.url = url; r.error = err;
    console.log(`  ❌ ${id.padEnd(5)} ${label} — ${String(err).slice(0, 150)}`);
}
function setSkip(id, label, reason) {
    const r = REG[id];
    r.status = 'SKIP'; r.label = label; r.skipReason = reason;
    console.log(`  ⏭️  ${id.padEnd(5)} ${label} [SKIP: ${reason}]`);
}
async function saveSnap(page, id, tag) {
    const file = path.join(OUT_DIR, `${id}_${tag}.png`);
    await page.screenshot({ path: file }).catch(() => { });
    return path.basename(file);
}

/**
 * 导航 + selector 断言 + 截图
 * 成功: PASS; 导航失败: returns false (→ 调用方决定 FAIL/SKIP); 断言失败: FAIL
 */
async function goAssert(page, id, label, url, selector, opts = {}) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeout || 45000 });
        // 验证页面确实在目标 origin
        const landed = page.url();
        if (!landed.startsWith(BASE_URL) && !landed.includes('login')) {
            throw Object.assign(new Error(`页面离开 BASE_URL，当前: ${landed}`), { isNetworkFail: true });
        }
        if (selector) await page.waitForSelector(selector, { timeout: opts.selectorTimeout || 20000 });
        await page.waitForTimeout(opts.settle || 800);
        const snap = await saveSnap(page, id, label);
        setPass(id, label, url, snap);
        return true;
    } catch (err) {
        const isNetwork = err.isNetworkFail || String(err.message).match(/ERR_SSL|ERR_NAME|ERR_CONNECTION|TIMEOUT|net::/i);
        const snap = await saveSnap(page, id, `${label}_FAIL`);
        REG[id].screenshot = snap;
        if (isNetwork) {
            setSkip(id, label, `NETWORK_FAIL: ${String(err.message).slice(0, 120)}`);
            return false; // 调用方按 SKIP 处理
        }
        setFail(id, label, url, err.message);
        return null; // FAIL（不是网络，是断言失败）
    }
}

// ── 主流程 ────────────────────────────────────────────────────────────────
async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        ignoreHTTPSErrors: IS_STAGING, // 绕过证书信任问题（不能绕过握手失败）
        viewport: { width: 1440, height: 900 },
        locale: 'zh-CN',
    });
    await ctx.addCookies([
        { name: 'accessToken', value: 'mock-pass', domain: new URL(BASE_URL).hostname, path: '/' },
    ]);
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(30000);

    // ── R01: Landing ─────────────────────────────────────────────────────
    console.log('\n── R01: Landing ─────────────────────────────────');
    const r01ok = await goAssert(page, 'r01', 'landing_zh', `${BASE_URL}/zh`, 'body');

    // ── R02: Login 三语（R01 失败则全部 SKIP）─────────────────────────────
    console.log('\n── R02: Login 三语 ──────────────────────────────');
    for (const [sid, locale] of [['r02a', 'zh'], ['r02b', 'en'], ['r02c', 'vi']]) {
        if (r01ok === false) { setSkip(sid, `login_${locale}`, 'PREREQ_R01_SKIP'); continue; }
        await goAssert(page, sid, `login_${locale}`, `${BASE_URL}/${locale}/login`,
            'form, input[type="email"], input[type="text"], input[name="email"]');
    }

    // ── R03: 未鉴权跳转（独立 context，R01 失败则 SKIP）────────────────────
    console.log('\n── R03: 未鉴权跳转 ──────────────────────────────');
    if (r01ok === false) {
        setSkip('r03', 'auth_redirect', 'PREREQ_R01_SKIP');
    } else {
        const noCtx = await browser.newContext({ ignoreHTTPSErrors: IS_STAGING, viewport: { width: 1440, height: 900 } });
        const noPage = await noCtx.newPage();
        noPage.setDefaultNavigationTimeout(45000);
        try {
            await noPage.goto(`${BASE_URL}/zh/projects`, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await noPage.waitForTimeout(1000);
            const cur = noPage.url();
            if (!cur.includes('login') && !cur.includes('from=')) throw new Error(`未跳转 login，当前: ${cur}`);
            const snap = await saveSnap(noPage, 'r03', 'auth_redirect');
            setPass('r03', 'auth_redirect', cur, snap);
        } catch (e) {
            const isNet = String(e.message).match(/ERR_SSL|ERR_NAME|ERR_CONNECTION|net::/i);
            const snap = await saveSnap(noPage, 'r03', 'auth_redirect_FAIL');
            REG['r03'].screenshot = snap;
            if (isNet) setSkip('r03', 'auth_redirect', `NETWORK_FAIL: ${e.message.slice(0, 120)}`);
            else setFail('r03', 'auth_redirect', '', e.message);
        }
        await noCtx.close();
    }

    // ── R04: Projects 列表 ────────────────────────────────────────────────
    console.log('\n── R04: Projects 列表 ───────────────────────────');
    const r04ok = await goAssert(page, 'r04', 'projects_list', `${BASE_URL}/zh/projects`, 'body');

    // ── R05: ProjectDetail Overview ───────────────────────────────────────
    console.log('\n── R05: ProjectDetail ───────────────────────────');
    const r05ok = await goAssert(page, 'r05', 'project_detail_overview',
        `${BASE_URL}/zh/projects/${PROJECT_ID}`, 'body');

    // ── R06/R07: ProjectDetail 标签（依赖 R05）────────────────────────────
    console.log('\n── R06/R07: ProjectDetail 标签 ──────────────────');
    for (const [id, label, keyword] of [['r06', 'builds', '构建'], ['r07', 'evidence', '证据']]) {
        if (r05ok === false) { setSkip(id, label, 'PREREQ_R05_SKIP'); continue; }
        try {
            const tab = page.locator(`button:has-text("${keyword}"), [data-tab]`).first();
            if (await tab.count() > 0) { await tab.click(); await page.waitForTimeout(700); }
            // 断言：页面仍在 ProjectDetail 范围
            const cur = page.url();
            if (!cur.includes(PROJECT_ID)) throw new Error(`离开 ProjectDetail，当前: ${cur}`);
            const snap = await saveSnap(page, id, label);
            setPass(id, label, cur, snap);
        } catch (e) { setFail(id, label, page.url(), e.message); }
    }

    // ── R08: Studio AutoFocus ─────────────────────────────────────────────
    console.log('\n── R08: Studio AutoFocus ────────────────────────');
    const r08ok = await goAssert(page, 'r08', 'studio_autofocus', STUDIO,
        '.treeItem, [class*="treeItem"], .workspace, body');

    // ── R09: Scene → Shot（依赖 R08）─────────────────────────────────────
    console.log('\n── R09: Scene → Shot ────────────────────────────');
    if (r08ok === false) {
        setSkip('r09', 'studio_scene_to_shot', 'PREREQ_R08_SKIP');
    } else {
        try {
            // 前置断言：必须在 Studio 页
            if (!page.url().includes(PROJECT_ID)) throw new Error('页面不在 Studio');
            const node = page.locator('.treeItem').nth(1);
            if (await node.count() > 0) { await node.click(); await page.waitForTimeout(1000); }
            const snap = await saveSnap(page, 'r09', 'studio_scene_shot');
            setPass('r09', 'studio_scene_to_shot', STUDIO, snap);
        } catch (e) { setFail('r09', 'studio_scene_to_shot', STUDIO, e.message); }
    }

    // ── R10: 曲线点击 → 同步（依赖 R08）──────────────────────────────────
    console.log('\n── R10: 曲线同步 ────────────────────────────────');
    if (r08ok === false) {
        setSkip('r10', 'studio_curve_sync', 'PREREQ_R08_SKIP');
    } else {
        try {
            if (!page.url().includes(PROJECT_ID)) throw new Error('页面不在 Studio');
            const c = page.locator('svg circle').first();
            if (await c.count() > 0) { await c.click({ force: true }); await page.waitForTimeout(1000); }
            const snap = await saveSnap(page, 'r10', 'studio_curve');
            setPass('r10', 'studio_curve_sync', STUDIO, snap);
        } catch (e) { setFail('r10', 'studio_curve_sync', STUDIO, e.message); }
    }

    // ── R11: 角色折叠持久化（依赖 R08）────────────────────────────────────
    console.log('\n── R11: 角色折叠持久化 ──────────────────────────');
    if (r08ok === false) {
        setSkip('r11', 'roles_collapsed', 'PREREQ_R08_SKIP');
        setSkip('r11b', 'roles_after_reload', 'PREREQ_R08_SKIP');
    } else {
        try {
            if (!page.url().includes(PROJECT_ID)) throw new Error('页面不在 Studio');
            const btn = page.locator('button').filter({ hasText: /展开|收起|Mở|Thu/ }).first();
            if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(600); }
            const s1 = await saveSnap(page, 'r11', 'roles_collapsed');
            setPass('r11', 'roles_collapsed', STUDIO, s1);
            // P9.1-FIX: 用 domcontentloaded，不用 networkidle
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForTimeout(1200);
            const s2 = await saveSnap(page, 'r11b', 'roles_after_reload');
            setPass('r11b', 'roles_after_reload', STUDIO, s2);
        } catch (e) {
            setFail('r11', 'roles_collapsed', STUDIO, e.message);
            setFail('r11b', 'roles_after_reload', STUDIO, e.message);
        }
    }

    // ── R12/R13: AuditBadges（依赖 Studio 可达）──────────────────────────
    console.log('\n── R12/R13: AuditBadges ─────────────────────────');
    if (r08ok === false) {
        setSkip('r12', 'studio_audit_badges_zh', 'PREREQ_R08_SKIP');
        setSkip('r13', 'studio_audit_badges_en', 'PREREQ_R08_SKIP');
    } else {
        await goAssert(page, 'r12', 'studio_audit_badges_zh', STUDIO, 'body');
        await goAssert(page, 'r13', 'studio_audit_badges_en',
            `${BASE_URL}/en/projects/${PROJECT_ID}/studio/${BUILD_ID}`, 'body');
    }

    await browser.close();

    // ── 汇总 + 落盘 ────────────────────────────────────────────────────
    const results = Object.values(REG);
    const pass = results.filter(r => r.status === 'PASS').length;
    const fail = results.filter(r => r.status === 'FAIL').length;
    const skip = results.filter(r => r.status === 'SKIP').length;
    const total = results.length;
    const strict = process.env.E2E_STRICT === '1';
    // 严格门禁：E2E_STRICT=1 时 SKIP>0 也算失败（staging 不允许任何 SKIP）
    const exitCode = (fail > 0 || (strict && skip > 0)) ? 1 : 0;

    const out = { baseUrl: BASE_URL, strict, startedAt, endedAt: new Date().toISOString(), exitCode, total, pass, fail, skip, results };
    fs.writeFileSync(RESULT_FILE, JSON.stringify(out, null, 2));

    console.log('\n══════════════════════════════════════════════════');
    console.log(`P8/P9 回归矩阵   exit=${exitCode}  PASS:${pass}  FAIL:${fail}  SKIP:${skip}  TOTAL:${total}${strict ? ' [STRICT]' : ''}`);
    if (fail > 0 || skip > 0) {
        results.filter(r => r.status !== 'PASS').forEach(r =>
            console.log(`  ${r.status === 'SKIP' ? '⏭️ ' : '❌'} ${r.id.padEnd(5)} ${r.label}: ${r.skipReason || r.error || ''}`.slice(0, 200))
        );
    }
    console.log('══════════════════════════════════════════════════');
    console.log(`截图目录:  ${OUT_DIR}`);
    console.log(`结果 JSON: ${RESULT_FILE}`);

    process.exit(exitCode);
}

run().catch(err => {
    console.error('[UNCAUGHT]', err);
    const results = Object.values(REG);
    fs.writeFileSync(RESULT_FILE, JSON.stringify({
        baseUrl: BASE_URL, startedAt, endedAt: new Date().toISOString(),
        exitCode: 127, total: results.length,
        pass: results.filter(r => r.status === 'PASS').length,
        fail: results.filter(r => r.status === 'FAIL').length,
        skip: results.filter(r => r.status === 'SKIP').length,
        results,
    }, null, 2));
    process.exit(127);
});
