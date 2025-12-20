import { test, expect, request } from '@playwright/test';

test.describe('Stage 4 UI Verification', () => {
    // Shared Project ID across tests within this file if we run them serially,
    // but better to isolate. We will use a unique project per test run.

    test('完整流程：创建项目 -> 创建结构 -> 触发语义分析 -> 验证面板数据', async ({ page }) => {
        // ... (Login logic)

        // ... (Project Create logic)

        // 获取 API Context
        const apiContext = await request.newContext();
        // 1. 登录
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/projects/, { timeout: 30000 });

        // 2. 创建新项目
        const newProjectBtn = page.locator('text=+ New Project');
        await newProjectBtn.waitFor({ state: 'visible', timeout: 30000 });
        // Ensure it's stable
        await page.waitForTimeout(500);
        await newProjectBtn.click();

        const projectName = `S4 UI Test ${Date.now()}`;
        await page.fill('input#project-name', projectName);
        await page.fill('textarea#project-desc', 'Testing Stage 4 UI Panels');
        await page.click('button[type="submit"]:has-text("Create")');

        // 等待跳转到详情
        await page.waitForURL(/\/projects\/[^/]+/, { timeout: 60000 });
        const projectId = page.url().split('/').pop();
        console.log(`Created Project: ${projectId}`);

        // 3. 创建结构 (Season -> Episode -> Scene)
        // 假设有 "+ 新增" 按钮在左侧树或者内容区域
        // 这里可能依赖具体的 UI 实现，如果找不到按钮，我们可以尝试直接调用 API 创建结构?
        // 在 Playwright 中混合 API 调用是允许的。为了稳健性，我们用 API 辅助创建数据，专注于验证 UI 读取。

        // 获取 API Context (Created at top)
        // 登录获取 token (Playwright context shares cookies but for APIRequest might need manual login depending on auth)
        // 简单点，直接在 UI 上操作如果链路通的话。
        // "StudioTree" shows seasons.
        // Assume there is a button to add Season.

        // Better Strategy: Use UI to verify "Empty State" -> Trigger -> "Data State"
        // But we need a Scene first.

        // Let's use the UI to drill down if possible, or fallback to API for setup
        // Given complexity of UI tree interaction in test, let's use API to seed data.
        const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
        const loginRes = await apiContext.post(`${baseURL}/api/auth/login`, {
            data: { email: 'admin@example.com', password: 'password123' }
        });
        const token = (await loginRes.json()).access_token;
        const headers = { Authorization: `Bearer ${token}` };

        // Create Scene via API
        const sRes = await apiContext.post(`${baseURL}/api/projects/${projectId}/seasons`, {
            data: { title: 'S1', index: 1 }, headers
        });
        const seasonId = (await sRes.json()).id;

        const eRes = await apiContext.post(`${baseURL}/api/seasons/${seasonId}/episodes`, {
            data: { title: 'E1', index: 1 }, headers
        });
        const episodeId = (await eRes.json()).id;

        const scRes = await apiContext.post(`${baseURL}/api/episodes/${episodeId}/scenes`, {
            data: { title: 'Scene 1', index: 1, summary: 'A testing scene.' }, headers
        });
        const sceneId = (await scRes.json()).id;

        // Reload page to fetch tree
        await page.reload();
        await page.waitForSelector(`text=Scene 1`); // Wait for tree item

        // 4. 选择 Scene
        await page.click(`text=Scene 1`);

        // 5. 验证右侧 "语义信息" 面板
        // 初始状态可能为空或 "暂无语义信息"
        // 查找面板标题
        await expect(page.locator('text=语义信息')).toBeVisible();

        // 点击 "重新生成" (或 "生成")
        const generateBtn = page.locator('button:has-text("重新生成"), button:has-text("生成")').first();
        if (await generateBtn.isVisible()) {
            await generateBtn.click();
        }

        // 6. 等待数据加载
        // 桩数据通常包含 "摘要" 和 "关键词"
        await expect(page.locator('text=摘要')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=关键词')).toBeVisible();

        // 验证 Mock 数据的特征 (LocalAdapter returns summary substring)
        // "A testing scene." -> substring(0,100)
        await expect(page.locator('text=A testing scene')).toBeVisible();
    });
});
