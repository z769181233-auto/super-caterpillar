/**
 * 模型价格表（SSOT - Single Source of Truth）
 * 
 * 单位：Credits per 1,000 tokens
 * 换算：1 Credit = 0.05 RMB（根据 CostBillingSpec）
 * 
 * Stage-3-B: CE06 Credits 计费闭环
 */

export const MODEL_PRICE_TABLE: Record<string, number> = {
    // Gemini 系列
    'gemini-2.0-flash': 0.4,        // 0.02 RMB / 1k tokens = 0.4 credits
    'gemini-1.5-pro': 2.0,          // 0.10 RMB / 1k tokens = 2.0 credits
    'gemini-1.5-flash': 0.2,        // 0.01 RMB / 1k tokens = 0.2 credits

    // Mock/Replay（用于测试和门禁）
    'ce06-replay-mock': 0.2,        // 0.01 RMB / 1k tokens = 0.2 credits
    'sdxl-turbo-stub': 50.0,        // High Cost Render: 2.5 RMB / 1k "tokens" (units) = 50.0 credits

    // 默认值（未知模型）
    'default': 1.0,                 // 0.05 RMB / 1k tokens = 1.0 credits
};

/**
 * 根据模型名称获取价格（Credits per 1k tokens）
 * 
 * @param modelName - 模型名称（如 "gemini-2.0-flash"）
 * @returns Credits per 1k tokens
 */
export function getModelPrice(modelName: string): number {
    const price = MODEL_PRICE_TABLE[modelName];
    if (!price) {
        console.warn(`[ModelPriceTable] Unknown model: ${modelName}, using default price`);
        return MODEL_PRICE_TABLE['default'];
    }
    return price;
}

/**
 * 计算 Token 使用的总 Credits
 * 
 * @param tokens - Token 数量
 * @param modelName - 模型名称
 * @returns 总 Credits
 * 
 * @example
 * ```
 * const credits = calculateTotalCredits(1000, 'gemini-2.0-flash');
 * // => (1000 / 1000) × 0.4 = 0.4 credits
 * // => 0.4 × 0.05 RMB = 0.02 RMB
 * ```
 */
export function calculateTotalCredits(tokens: number, modelName: string): number {
    const pricePerK = getModelPrice(modelName);
    return (tokens / 1000) * pricePerK;
}

/**
 * 将 Credits 转换为人民币
 * 
 * @param credits - Credits 数量
 * @returns 人民币金额
 */
export function creditsToRMB(credits: number): number {
    return credits * 0.05;
}
