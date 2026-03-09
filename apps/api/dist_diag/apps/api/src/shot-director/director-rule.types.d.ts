export declare enum RuleType {
    DURATION_RANGE = "DURATION_RANGE",
    PROMPT_REQUIRED = "PROMPT_REQUIRED",
    MOTION_DURATION_COUPLING = "MOTION_DURATION_COUPLING",
    COMPOSITION_TYPE_COMPATIBILITY = "COMPOSITION_TYPE_COMPATIBILITY",
    REQUIRED_FIELDS = "REQUIRED_FIELDS",
    PROMPT_LENGTH = "PROMPT_LENGTH"
}
export type Severity = 'ERROR' | 'WARNING';
export type FixAction = 'REPLACE' | 'APPEND' | 'REMOVE' | 'ADJUST';
export interface FixSuggestion {
    action: FixAction;
    field: string;
    value: unknown;
    reason: string;
}
export interface ConstraintViolation {
    ruleId: string;
    ruleType: RuleType;
    severity: Severity;
    field: string;
    currentValue: unknown;
    message: string;
    suggestions?: FixSuggestion[];
}
export interface ValidationResult {
    isValid: boolean;
    violations: ConstraintViolation[];
    suggestions: FixSuggestion[];
    metadata: {
        shotId: string;
        validatedAtIso: string;
        ruleCount: number;
    };
}
export type ShotType = 'CLOSE_UP' | 'WIDE_SHOT' | 'MEDIUM_SHOT' | 'DEFAULT';
export type MotionType = 'NONE' | 'PAN' | 'ZOOM';
export type CompositionType = 'TIGHT' | 'NORMAL' | 'WIDE';
export interface DirectorShotParams {
    prompt?: string;
    durationSec?: number;
    motion?: MotionType;
    composition?: CompositionType;
}
export interface DirectorShotInput {
    id: string;
    type: ShotType;
    params: DirectorShotParams;
}
export type DurationRangeConfig = {
    minSec: number;
    maxSec: number;
};
export type PromptRequiredConfig = {
    minChars: number;
};
export type MotionDurationCouplingConfig = {
    fastMotions: MotionType[];
    maxSecWhenFast: number;
};
export type CompositionCompatibilityConfig = {
    allowed: Record<ShotType, CompositionType[]>;
};
export type RequiredFieldsConfig = {
    fields: string[];
};
export type PromptLengthConfig = {
    maxChars: number;
};
export type RuleConfig = {
    type: RuleType.DURATION_RANGE;
    config: DurationRangeConfig;
} | {
    type: RuleType.PROMPT_REQUIRED;
    config: PromptRequiredConfig;
} | {
    type: RuleType.MOTION_DURATION_COUPLING;
    config: MotionDurationCouplingConfig;
} | {
    type: RuleType.COMPOSITION_TYPE_COMPATIBILITY;
    config: CompositionCompatibilityConfig;
} | {
    type: RuleType.REQUIRED_FIELDS;
    config: RequiredFieldsConfig;
} | {
    type: RuleType.PROMPT_LENGTH;
    config: PromptLengthConfig;
};
export interface DirectorRuleBase {
    id: string;
    severity: Severity;
    message: string;
}
export type DirectorRule = DirectorRuleBase & RuleConfig;
