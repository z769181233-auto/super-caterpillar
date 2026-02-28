const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
        await page.goto('http://localhost:3001/builds/bf67cbdc-79a9-42be-b074-6239a2719064');
        await page.waitForTimeout(4000);
        await page.screenshot({ path: '/Users/adam/.gemini/antigravity/brain/54cba90b-70e2-44d5-acc5-64c5e604df8e/luxury_black_gold_final.png', fullPage: true });
        console.log('Screenshot saved to luxury_black_gold_final.png');
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
