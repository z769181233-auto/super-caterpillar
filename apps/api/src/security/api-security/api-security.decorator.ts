import { SetMetadata } from '@nestjs/common';

/**
 * 元数据键：标记需要签名验证的端点
 */
export const REQUIRE_SIGNATURE_KEY = 'requireSignature';

/**
 * @RequireSignature() 装饰器
 *
 * 用于标记高成本/敏感接口，强制要求 HMAC 签名验证
 *
 * 使用方式：
 * ```typescript
 * @Post('import-file')
 * @RequireSignature()
 * async importFile(@UploadedFile() file: Express.Multer.File) {
 *   // ...
 * }
 * ```
 *
 * 参考文档：
 * - 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》
 */
export const RequireSignature = () => SetMetadata(REQUIRE_SIGNATURE_KEY, true);
