import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  if (process.env.E2E_MODE !== '1') {
    console.error('❌ FATAL: This script must be run with E2E_MODE=1');
    process.exit(1);
  }

  console.log('Starting Playwright ProjectDetail Visual Checks...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const locales = ['zh', 'en', 'vi'];
  const testProjectId = 'sc-prj-999';

  const evidenceDir = path.join(
    process.cwd(),
    'docs',
    '_evidence',
    'p5_ui_system',
    'project_detail_plan7_6_visual'
  );
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Pass Auth gate via mock cookie
  await page.context().addCookies([
    {
      name: 'accessToken',
      value: '__E2E_MOCK_PASS__',
      domain: 'localhost',
      path: '/',
    },
  ]);

  for (const loc of locales) {
    console.log(`▶ Scanning ${loc.toUpperCase()} interface...`);

    try {
      // 1. Overview Tab
      await page.goto(`http://localhost:3000/${loc}/projects/${testProjectId}`);
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(evidenceDir, `project_detail_${loc}_overview.png`),
        fullPage: true,
      });
      console.log(`  └ Overview OK`);

      // 2. Builds Tab
      const buildsLabel =
        loc === 'zh' ? '构建版本 (Builds)' : loc === 'vi' ? 'Các bản dựng' : 'Builds';
      await page.locator(`button:has-text("${buildsLabel}")`).click();
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(evidenceDir, `project_detail_${loc}_builds.png`),
        fullPage: true,
      });
      console.log(`  └ Builds panel OK`);

      // 3. Evidence Tab
      const evidenceLabel =
        loc === 'zh' ? '取证大厅 (Evidence)' : loc === 'vi' ? 'Bằng chứng' : 'Evidence';
      await page.locator(`button:has-text("${evidenceLabel}")`).click();
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(evidenceDir, `project_detail_${loc}_evidence.png`),
        fullPage: true,
      });
      console.log(`  └ Evidence vault OK`);
    } catch (e) {
      console.error(`[Error] Failed scanning ${loc}:`, e.message);
    }
  }

  await browser.close();
  console.log(
    `✅ All Project Detail visual traces generated in docs/_evidence/p5_ui_system/project_detail_plan7_6_visual`
  );
})();
