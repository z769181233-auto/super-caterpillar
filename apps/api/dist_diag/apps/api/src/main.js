"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    console.log('[DIAG_BOOT] Calling NestFactory.create(AppModule)...');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bufferLogs: false,
    });
    console.log('[DIAG_BOOT] NestFactory.create() returned successfully');
    await app.close();
}
bootstrap().catch(e => {
    console.error('[DIAG_FATAL] Error during NestFactory.create:');
    console.error(e);
    if (e.stack)
        console.error(e.stack);
    process.exit(1);
});
//# sourceMappingURL=main.js.map