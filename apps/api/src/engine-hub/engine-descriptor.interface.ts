/**
 * Engine Descriptor
 * Stage2: 引擎描述符，用于 EngineRegistry 维护引擎配置
 */

/**
 * 引擎描述符
 */
export interface EngineDescriptor {
  /**
   * 引擎标识（如 "novel_analysis"）
   */
  key: string;

  /**
   * 引擎版本（如 "default" | "v1"）
   */
  version: string;

  /**
   * 调用模式（本地或 HTTP）
   */
  mode: 'local' | 'http';

  /**
   * Nest 注入 Token（用于本地 adapter）
   */
  adapterToken?: any;

  /**
   * HTTP 配置（用于 HTTP adapter）
   */
  httpConfig?: {
    baseUrl: string;
    path: string;
    timeoutMs?: number;
    [key: string]: unknown;
  };
}
