const fs = require('fs');

/**
 * Engine Adapter Interface (Phase F) - IRenderTemplateExecutor
 * Ensures Script -> RenderPlan -> Engine isolation.
 */

class IRenderTemplateExecutor {
    constructor(engineName) {
        this.engineName = engineName;
        this.executors = {};
    }

    registerTemplate(templateId, executorFn) {
        this.executors[templateId] = executorFn;
    }

    async execute(shotPlan) {
        const { templateId, shotId, durationFrames } = shotPlan;

        console.log(`[${this.engineName}] Executing Shot: ${shotId} (Template: ${templateId})`);

        if (!this.executors[templateId]) {
            throw new Error(`Template Executor not found: ${templateId}`);
        }

        // Enforcement: durationFrames is immutable for the engine
        return await this.executors[templateId](shotPlan);
    }
}

// Concrete Dispatcher
const EngineAdapter = new IRenderTemplateExecutor("MockRealEngine");

// Register 4 Mock Templates for Dry-Run
const mockExecutor = async (shot) => ({
    status: "OK",
    framesRendered: shot.durationFrames,
    clipPath: `.runtime/clips/${shot.shotId}.mp4`
});

["T_DIALOGUE_MS", "T_DIALOGUE_CU", "T_ACTION_WIDE", "T_ESTABLISHING"].forEach(t => {
    EngineAdapter.registerTemplate(t, mockExecutor);
});

module.exports = { EngineAdapter };
