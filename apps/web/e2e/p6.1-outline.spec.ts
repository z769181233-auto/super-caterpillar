import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.SNAP_BASE_URL || 'http://localhost:3001';
const PROJECT_ID = 'test-e2e-project';

const OUT_DIR = process.env.SNAP_OUT_DIR || 'docs/_evidence/p6_studio_polish/p6_1_outline_screenshots';

async function setupMockToken(context: any) {
    // E2E mock pass to bypass middleware guard for tests
    await context.addCookies([{
        name: 'accessToken',
        value: 'mock-pass',
        domain: 'localhost',
        path: '/'
    }]);
}

// Ensure directory exists at module load time
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 场景 1：单场空态防呆自动拦截 (Single Shot AutoFocus)
test('Scenario 1: Single Shot AutoFocus and Expand', async ({ page, context }) => {
    // Mock Auth
    await setupMockToken(context);

    // Intercept outline to supply exactly 1 Episode, 1 Scene, 1 Shot
    await page.route('**/api/builds/*/outline', async route => {
        const singleShotOutline = {
            build: { id: 'build-single', title: 'Single Shot Demo' },
            stats: { episodes: 1, scenes: 1, shots: 1 },
            episodes: [{
                id: 'ep-1', index: 1, title: 'Ep1',
                scenes: [{
                    id: 'sc-1', index: 1, title: 'Sc1',
                    shots: [{ id: 'sh-1', index: 1, summary: 'The Only Shot' }]
                }]
            }]
        };
        await route.fulfill({ json: singleShotOutline });
    });

    // Intercept shot source fetch
    await page.route('**/api/shots/*/source', async route => {
        await route.fulfill({
            json: { shotTitle: 'The Only Shot', text: 'This should be auto-focused.' }
        });
    });

    // [Lang Loop: zh, en, vi]
    for (const lang of ['zh', 'en', 'vi']) {
        // clear ui store to prevent autoFocus rejection
        await context.addInitScript(() => {
            window.localStorage.removeItem('studio:outline:storage');
        });
        await page.goto(`${BASE_URL}/${lang}/studio/${PROJECT_ID}`, { waitUntil: 'networkidle' });
        // Wait for stage to render
        await page.waitForTimeout(1000);
        // Assert and Capture
        const readerPanel = page.locator('.readerText');
        await expect(readerPanel).toContainText('This should be auto-focused.');
        await page.screenshot({ path: path.join(OUT_DIR, `01_single_shot_autofocus_${lang}.png`) });
    }
});

// 场景 2：普通多场项目 (Multi Shot) 的层级缩放动作
test('Scenario 2: Normal Focus and Node Expand', async ({ page, context }) => {
    // Mock Auth
    await setupMockToken(context);

    // Intercept outline to supply Multiple Episodes and Scenes
    await page.route('**/api/builds/*/outline', async route => {
        const multiShotOutline = {
            build: { id: 'build-multi', title: 'Multi Shot Demo' },
            stats: { episodes: 2, scenes: 2, shots: 2 },
            episodes: [
                {
                    id: 'ep-1', index: 1, title: 'Ep1',
                    scenes: [{
                        id: 'sc-1', index: 1, title: 'Sc1',
                        shots: [{ id: 'sh-1', index: 1, summary: 'First Shot' }]
                    }]
                },
                {
                    id: 'ep-2', index: 2, title: 'Ep2',
                    scenes: [{
                        id: 'sc-2', index: 1, title: 'Sc2_Longer',
                        shots: [{ id: 'sh-2', index: 1, summary: 'Shot In Ep2' }]
                    }]
                }
            ]
        };
        await route.fulfill({ json: multiShotOutline });
    });

    await page.route('**/api/shots/sh-2/source', async route => {
        await route.fulfill({
            json: { shotTitle: 'Shot In Ep2', text: 'You clicked to navigate here.' }
        });
    });

    // Just test in ZH for interactions
    await context.addInitScript(() => {
        window.localStorage.removeItem('studio:outline:storage');
    });
    await page.goto(`${BASE_URL}/zh/studio/${PROJECT_ID}`, { waitUntil: 'networkidle' });

    await page.waitForTimeout(500);

    // Act: By default it's contracted. We manually click Episode 2 -> Sc2_Longer
    // Click Ep 2
    await page.locator('.treeGroup').filter({ hasText: 'Ep2' }).locator('.treeItem').first().click();
    await page.waitForTimeout(200);

    // Click Scene 2 -> This will trigger auto expanding its children and selecting the first shot (sh-2)
    await page.locator('.treeGroup').filter({ hasText: 'Sc2_Longer' }).locator('.treeItem').first().click();

    await page.waitForTimeout(1000);

    const readerPanel = page.locator('.readerText');
    await expect(readerPanel).toContainText('You clicked to navigate here.');

    await page.screenshot({ path: path.join(OUT_DIR, `02_multi_shot_select_zh.png`) });
});
