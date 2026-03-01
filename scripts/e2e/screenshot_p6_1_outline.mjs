#!/usr/bin/env node
/**
 * P6.1 Outline Smart Sync - Evidence Screenshot Script
 * 绕过 Playwright spec 版本冲突，直接用 API 级别运行截图
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.SNAP_BASE_URL || 'http://localhost:3001';
const OUT_DIR = 'docs/_evidence/p6_studio_polish/p6_1_outline_screenshots';

// 确保输出目录存在（相对于项目根目录）
const ROOT = process.cwd();
const ABS_OUT = path.join(ROOT, OUT_DIR);
fs.mkdirSync(ABS_OUT, { recursive: true });

// E2E 安全门禁 — 只在测试模式下运行
if (process.env.NODE_ENV === 'production' || (process.env.E2E_MODE !== '1' && !process.env.CI)) {
  process.env.E2E_MODE = '1';
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  const LANGS = ['zh', 'en', 'vi'];

  console.log('[P6.1] Starting screenshot evidence pass...');

  for (const lang of LANGS) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      // E2E bypass cookie
      storageState: undefined,
    });

    // Inject E2E mock cookie
    await ctx.addCookies([
      {
        name: 'accessToken',
        value: 'mock-pass',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Clear localStorage for each language to ensure clean autoFocus state
    ctx.on('page', async (page) => {
      await page.addInitScript(() => {
        localStorage.removeItem('studio:outline:storage');
      });
    });

    const page = await ctx.newPage();

    // =====================
    // 截图 1: Studio 首页默认状态 (大纲默认折叠)
    // =====================
    // Use a test build ID that returns real or mock data
    // The studio URL pattern typically is /[locale]/studio/[buildId]
    // We navigate to projects first if studio requires a build ID
    try {
      await page.goto(`${BASE_URL}/${lang}/projects`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await page.waitForTimeout(1500);
      const snap1Path = path.join(ABS_OUT, `01_projects_page_${lang}.png`);
      await page.screenshot({ path: snap1Path, fullPage: false });
      console.log(`[P6.1] ✅ Captured: ${snap1Path}`);
    } catch (err) {
      console.error(`[P6.1] ⚠️ Lang ${lang} projects screenshot failed:`, err.message);
    }

    // =====================
    // 截图 2: 尝试登录态 Studio 视图（若已有真实 buildId）
    // =====================
    const BUILD_ID = process.env.E2E_BUILD_ID;
    if (BUILD_ID) {
      try {
        await page.goto(`${BASE_URL}/${lang}/studio/${BUILD_ID}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        await page.waitForTimeout(2500);
        const snap2Path = path.join(ABS_OUT, `02_studio_outline_${lang}.png`);
        await page.screenshot({ path: snap2Path, fullPage: false });
        console.log(`[P6.1] ✅ Captured: ${snap2Path}`);

        // 验证大纲面板存在
        const outlinePanel = page.locator('.panelTitle').first();
        const panelText = await outlinePanel.textContent().catch(() => '');
        console.log(`[P6.1] Outline panel found: "${panelText}"`);
      } catch (err) {
        console.error(`[P6.1] ⚠️ Lang ${lang} studio screenshot failed:`, err.message);
      }
    } else {
      console.log(`[P6.1] Skipping studio screenshot (no E2E_BUILD_ID), lang=${lang}`);
    }

    await ctx.close();
  }

  await browser.close();

  // --- Summary ---
  const files = fs.readdirSync(ABS_OUT).filter((f) => f.endsWith('.png'));
  console.log(`\n[P6.1] Evidence summary: ${files.length} screenshots saved to ${OUT_DIR}`);
  files.forEach((f) => console.log(`  - ${f}`));
}

run().catch((err) => {
  console.error('[P6.1] Fatal:', err);
  process.exit(1);
});
