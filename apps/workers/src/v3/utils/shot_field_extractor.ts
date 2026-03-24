/**
 * V3.0 P1-1: Shot Field Extractor
 * 从 params 中提取导演控制字段，确保显式列落盘。
 */

export interface DirectorControls {
  shotType?: string | null;
  cameraMovement?: string | null;
  cameraAngle?: string | null;
  lightingPreset?: string | null;
}

export function extractDirectorControls(params: unknown): DirectorControls {
  if (!params || typeof params !== 'object') {
    return {};
  }

  const record = params as Record<string, unknown>;
  return {
    shotType: (record.shot_type as string | undefined) || (record.shotType as string | undefined) || null,
    cameraMovement:
      (record.camera_movement as string | undefined) || (record.cameraMovement as string | undefined) || null,
    cameraAngle:
      (record.camera_angle as string | undefined) || (record.cameraAngle as string | undefined) || null,
    lightingPreset:
      (record.lighting_preset as string | undefined) || (record.lightingPreset as string | undefined) || null,
  };
}

/**
 * 将提取的字段合并到 Prisma 数据对象中
 */
export function hydrateShotWithDirectorControls<T extends Record<string, unknown>>(
  data: T,
  params: unknown
): T & DirectorControls {
  const controls = extractDirectorControls(params);
  return {
    ...data,
    ...controls,
  } as T & DirectorControls;
}
