/**
 * Stage 22.0: 项目空态判定单一真相源 (SSOT)
 */

/**
 * 判定项目是否处于“空态”（即尚未导入小说或生成结构）
 * 根据用户指令：仅当状态严格等于 'EMPTY' 时返回 true。
 *
 * @param structureStatus 后端返回的原始状态字段
 */
export function isProjectEmpty(structureStatus: unknown): boolean {
  // 归一化处理
  const status = typeof structureStatus === 'string' ? structureStatus.trim().toUpperCase() : '';

  // 环境隔离日志：仅在开发模式下打印真值，协助定位判定失效问题
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[Stage22 EmptyState] structureStatus=${status}`);
  }

  // 终极判定：默认只认 EMPTY
  return status === 'EMPTY';
}
