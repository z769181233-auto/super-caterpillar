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

export function extractDirectorControls(params: any): DirectorControls {
    if (!params || typeof params !== 'object') {
        return {};
    }

    return {
        shotType: params.shot_type || params.shotType || null,
        cameraMovement: params.camera_movement || params.cameraMovement || null,
        cameraAngle: params.camera_angle || params.cameraAngle || null,
        lightingPreset: params.lighting_preset || params.lightingPreset || null,
    } as any;
}

/**
 * 将提取的字段合并到 Prisma 数据对象中
 */
export function hydrateShotWithDirectorControls(data: any, params: any) {
    const controls = extractDirectorControls(params);
    return {
        ...data,
        ...controls,
    };
}
