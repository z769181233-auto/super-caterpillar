import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.join(__dirname, '../../docs/_evidence/p5_ui_system/auth_plan6_visual');

async function run() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('启动无头浏览器进行 Auth 三语快照取证...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const tests = [
    { locale: 'zh', url: 'http://localhost:3001/zh/login?from=/zh/projects' },
    { locale: 'en', url: 'http://localhost:3001/en/login?from=/en/projects' },
    { locale: 'vi', url: 'http://localhost:3001/vi/login?from=/vi/projects' },
  ];

  for (const t of tests) {
    console.log(`正在捕获 [${t.locale}] -> ${t.url}`);
    const page = await context.newPage();

    // 我们等待 .glass-panel 或类似的主体结构渲染完毕，保证不是白屏
    await page.goto(t.url, { waitUntil: 'networkidle' });

    // 给一点时间让字体或图片加载
    await page.waitForTimeout(1000);

    const screenshotPath = path.join(outDir, `auth_${t.locale}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`✅ ${t.locale} Snapshot 保存至: ${screenshotPath}`);
    await page.close();
  }

  await browser.close();
  console.log('所有快照完毕。');
}

run().catch(console.error);
