import fetch from 'node-fetch';

async function test() {
    console.log("Checking Forbidden Response when flag is disabled...");
    // 正常 smoke test 流程，但在 commit 阶段预期 403
    // 注意：Gate 运行环境需要设置环境变量以触发拦截
}
test();
