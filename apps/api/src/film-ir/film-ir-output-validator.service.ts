import { Injectable, Logger } from '@nestjs/common';
import type {
  FilmIRDraftFields,
  FilmIRValidationResult,
  FilmIRValidationError,
  FilmIRValidationWarning,
} from './dto/plan-film-ir.dto';
import {
  VALID_DRAMATIC_FUNCTIONS,
  VALID_SHOT_PATTERNS,
  VALID_CAMERA_MOTIONS,
  VALID_LIGHTING_STYLES,
  VALID_AUDIENCE_INFO_MODES,
} from './dto/plan-film-ir.dto';

/**
 * Film IR Output Validator（P2.1 + P2.2 收口版）
 *
 * P2.2 变更（字段校验升级）：
 * - shot_pattern：warnings → **strict errors**（P3 依赖此字段）
 * - camera_motion_style：warnings → **strict errors**（P3 依赖此字段）
 * - lighting_style：warnings → **strict errors**（ShotPlanner 依赖光线策略）
 * - audience_information_mode：保持 warnings（可为 null）
 * - continuity_constraints：保持 warnings（自由 JSON）
 * - avg_shot_length：收紧范围 0.5~120s，非法值 fallback 4s + warning
 *
 * 校验优先级：
 * - errors：阻断写 DB（必填缺失 + 枚举非法值）
 * - warnings：记录不阻断（可为 null / 宽松约束）
 *   例外：FILM_IR_PLANNER_STRICT_MODE=true 时 warnings 也阻断
 */
@Injectable()
export class FilmIROutputValidator {
  private readonly logger = new Logger(FilmIROutputValidator.name);

  /** 必填字段（errors 级别）*/
  private readonly REQUIRED_FIELDS: (keyof FilmIRDraftFields)[] = [
    'dramatic_function',
    'dramatic_goal',
    'emotional_target',
    'visual_strategy',
    'blocking_strategy',
    'shot_pattern',
    'avg_shot_length',
    'camera_motion_style',
    'composition_style',
    'lighting_style',
    'color_strategy',
    'sound_strategy',
    'why_this_choice',
    'alternative_rejected_reason',
  ];

  validate(fields: Partial<FilmIRDraftFields>): FilmIRValidationResult {
    const errors: FilmIRValidationError[] = [];
    const warnings: FilmIRValidationWarning[] = [];

    // 1. 必填字段存在性
    for (const field of this.REQUIRED_FIELDS) {
      const value = fields[field];
      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          message: `必填字段 ${field} 缺失或为空`,
          received: value,
        });
      }
    }

    // 2. dramatic_function — strict enum（errors）
    if (fields.dramatic_function &&
      !VALID_DRAMATIC_FUNCTIONS.includes(fields.dramatic_function as any)) {
      errors.push({
        field: 'dramatic_function',
        message: `dramatic_function 非法枚举值 "${fields.dramatic_function}"，合法值：${VALID_DRAMATIC_FUNCTIONS.join('|')}`,
        received: fields.dramatic_function,
      });
    }

    // 3. shot_pattern — P2.2 升级为 strict errors（P3 直接依赖）
    if (fields.shot_pattern &&
      !VALID_SHOT_PATTERNS.includes(fields.shot_pattern as any)) {
      errors.push({
        field: 'shot_pattern',
        message: `shot_pattern 非法枚举值 "${fields.shot_pattern}"，合法值：${VALID_SHOT_PATTERNS.join('|')}`,
        received: fields.shot_pattern,
      });
    }

    // 4. camera_motion_style — P2.2 升级为 strict errors（P3 直接依赖）
    if (fields.camera_motion_style &&
      !VALID_CAMERA_MOTIONS.includes(fields.camera_motion_style as any)) {
      errors.push({
        field: 'camera_motion_style',
        message: `camera_motion_style 非法枚举值 "${fields.camera_motion_style}"，合法值：${VALID_CAMERA_MOTIONS.join('|')}`,
        received: fields.camera_motion_style,
      });
    }

    // 5. lighting_style — P2.2 升级为 strict errors（ShotPlanner 依赖）
    if (fields.lighting_style &&
      !VALID_LIGHTING_STYLES.includes(fields.lighting_style as any)) {
      errors.push({
        field: 'lighting_style',
        message: `lighting_style 非法枚举值 "${fields.lighting_style}"，合法值：${VALID_LIGHTING_STYLES.join('|')}`,
        received: fields.lighting_style,
      });
    }

    // 6. audience_information_mode — 保持 warnings（可为 null）
    if (fields.audience_information_mode !== null &&
      fields.audience_information_mode !== undefined &&
      !VALID_AUDIENCE_INFO_MODES.includes(fields.audience_information_mode as any)) {
      warnings.push({
        field: 'audience_information_mode',
        message: `audience_information_mode 非标准枚举值 "${fields.audience_information_mode}"`,
        fallback_applied: '将保留原值（可为 null）',
      });
    }

    // 7. avg_shot_length 范围检查（P2.2 收紧：0.5~120s）
    if (fields.avg_shot_length !== undefined && fields.avg_shot_length !== null) {
      if (typeof fields.avg_shot_length !== 'number' || isNaN(fields.avg_shot_length)) {
        errors.push({
          field: 'avg_shot_length',
          message: `avg_shot_length 必须为数字，received: ${fields.avg_shot_length}`,
          received: fields.avg_shot_length,
        });
      } else if (fields.avg_shot_length <= 0 || fields.avg_shot_length < 0.5) {
        errors.push({
          field: 'avg_shot_length',
          message: `avg_shot_length=${fields.avg_shot_length}s 低于最小值 0.5s`,
          received: fields.avg_shot_length,
        });
      } else if (fields.avg_shot_length > 120) {
        warnings.push({
          field: 'avg_shot_length',
          message: `avg_shot_length=${fields.avg_shot_length}s 超过 120s 上限，建议复查`,
          fallback_applied: '保留原值，请人工审核',
        });
      }
    }

    // 8. continuity_constraints 格式检查（warnings）
    if (fields.continuity_constraints !== undefined &&
      fields.continuity_constraints !== null &&
      typeof fields.continuity_constraints !== 'object') {
      warnings.push({
        field: 'continuity_constraints',
        message: 'continuity_constraints 应为 JSON 对象，实际为非对象类型',
        fallback_applied: '{}',
      });
    }

    const valid = errors.length === 0;

    if (!valid) {
      this.logger.warn(`[FilmIRValidator] 校验失败 ${errors.length} 个 errors`, { errors });
    } else if (warnings.length > 0) {
      this.logger.warn(`[FilmIRValidator] 校验通过，有 ${warnings.length} 个 warnings`, { warnings });
    } else {
      this.logger.debug('[FilmIRValidator] 校验全部通过（0 errors, 0 warnings）');
    }

    return { valid, errors, warnings };
  }

  applyFallbacks(fields: Partial<FilmIRDraftFields>): FilmIRDraftFields {
    return {
      dramatic_function: fields.dramatic_function ?? 'CONFLICT',
      dramatic_goal: fields.dramatic_goal ?? '（系统补全：导演目标未提供）',
      emotional_target: fields.emotional_target ?? '（系统补全：情绪目标未提供）',
      pov_character: fields.pov_character ?? null,
      audience_information_mode: fields.audience_information_mode ?? null,
      visual_strategy: fields.visual_strategy ?? '（系统补全）',
      blocking_strategy: fields.blocking_strategy ?? '（系统补全）',
      shot_pattern: fields.shot_pattern ?? 'MIXED',
      avg_shot_length: (typeof fields.avg_shot_length === 'number' &&
        fields.avg_shot_length >= 0.5 && fields.avg_shot_length <= 120)
        ? fields.avg_shot_length : 4.0,
      camera_motion_style: fields.camera_motion_style ?? 'STATIC',
      composition_style: fields.composition_style ?? '（系统补全）',
      lighting_style: fields.lighting_style ?? 'NATURAL',
      color_strategy: fields.color_strategy ?? '（系统补全）',
      sound_strategy: fields.sound_strategy ?? '（系统补全）',
      continuity_constraints:
        (typeof fields.continuity_constraints === 'object' && fields.continuity_constraints !== null)
          ? fields.continuity_constraints : {},
      why_this_choice: fields.why_this_choice ?? '（系统补全）',
      alternative_rejected_reason: fields.alternative_rejected_reason ?? '（系统补全）',
    };
  }
}
