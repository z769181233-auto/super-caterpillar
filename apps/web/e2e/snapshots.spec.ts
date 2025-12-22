import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.SNAP_BASE_URL || 'http://localhost:3005';
const PROJECT_ID = process.env.SNAP_PROJECT_ID || '';
const OUT_DIR = process.env.SNAP_OUT_DIR || 'docs/ui_snapshots/2025-12-17';
const STORAGE_STATE = path.resolve('apps/web/e2e/.auth/storageState.json');

const EMAIL = process.env.SNAP_EMAIL || '';
const PASSWORD = process.env.SNAP_PASSWORD || '';

async function ensureLoggedIn(page) {
    // 访问 projects，未登录会被重定向到 login
    await page.goto(`${BASE_URL}/zh/projects`, { waitUntil: 'domcontentloaded' });

    // 如果已在 projects，直接返回
    if (page.url().includes('/zh/projects')) return;

    // 否则要求用环境变量登录（禁止硬编码）
    if (!EMAIL || !PASSWORD) {
        throw new Error('Missing SNAP_EMAIL/SNAP_PASSWORD env vars for headless login.');
    }

    // 下面选择器需要按你们实际 login 页面微调：优先使用 data-testid
    // Assuming login redirect happens
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    // Use CSS selectors for robustness
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    try {
        await page.waitForURL(/\/projects/, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    } catch (e) {
        console.log('Login navigation timed out. Taking debug screenshot...');
        await page.screenshot({ path: 'apps/web/e2e/debug-login-fail.png' });
        throw e;
    }
}

test('UI snapshots: overview + structure tree', async ({ page, context }) => {
    if (!PROJECT_ID) throw new Error('Missing SNAP_PROJECT_ID');

    // 如果已有 storageState，直接复用
    if (fs.existsSync(STORAGE_STATE)) {
        await context.storageState({ path: STORAGE_STATE });
    }

    await ensureLoggedIn(page);

    // 保存 storageState（不入库）
    fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
    await context.storageState({ path: STORAGE_STATE });

    // 进入项目页截图
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Overview ?module=overview
    const projectUrl = `${BASE_URL}/zh/projects/${PROJECT_ID}?module=overview`;
    await page.goto(projectUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // stable render
    await page.screenshot({ path: path.join(OUT_DIR, '01_project_overview.png'), fullPage: true });

    // Structure ?module=structure
    const structureUrl = `${BASE_URL}/zh/projects/${PROJECT_ID}?module=structure`;
    await page.goto(structureUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // stable render
    // 尝试滚动到结构树区域再截一张
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, '02_structure_tree.png'), fullPage: true });

    expect(fs.existsSync(path.join(OUT_DIR, '01_project_overview.png'))).toBeTruthy();
    expect(fs.existsSync(path.join(OUT_DIR, '02_structure_tree.png'))).toBeTruthy();
});
