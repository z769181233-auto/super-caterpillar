import {
    CompositionType,
    ConstraintViolation,
    DirectorRule,
    DirectorShotInput,
    FixSuggestion,
    RuleType,
    ValidationResult,
} from './director-rule.types';

function isoNow(): string {
    return new Date().toISOString();
}

function getByPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let cur: any = obj;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
    }
    return cur;
}

function uniqSuggestions(sugs: FixSuggestion[]): FixSuggestion[] {
    const seen = new Set<string>();
    const out: FixSuggestion[] = [];
    for (const s of sugs) {
        const key = `${s.action}|${s.field}|${JSON.stringify(s.value)}|${s.reason}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push(s);
        }
    }
    return out;
}

export class DirectorConstraintSolverService {
    private readonly rules: DirectorRule[];

    constructor(rules?: DirectorRule[]) {
        this.rules = rules ?? this.getDefaultRules();
    }

    validateShot(shot: DirectorShotInput): ValidationResult {
        const violations: ConstraintViolation[] = [];

        for (const rule of this.rules) {
            violations.push(...this.applyRule(rule, shot));
        }

        const allSuggestions = uniqSuggestions(
            violations.flatMap(v => v.suggestions ?? []),
        );

        return {
            isValid: violations.every(v => v.severity !== 'ERROR'),
            violations,
            suggestions: allSuggestions,
            metadata: {
                shotId: shot.id,
                validatedAtIso: isoNow(),
                ruleCount: this.rules.length,
            },
        };
    }

    suggestFix(shot: DirectorShotInput, violations: ConstraintViolation[]): FixSuggestion[] {
        // deterministic: only derive from shot + violations, no randomness
        return uniqSuggestions(violations.flatMap(v => v.suggestions ?? []));
    }

    private applyRule(rule: DirectorRule, shot: DirectorShotInput): ConstraintViolation[] {
        switch (rule.type) {
            case RuleType.DURATION_RANGE: {
                const dur = shot.params.durationSec;
                const { minSec, maxSec } = rule.config;
                if (typeof dur !== 'number') return []; // REQUIRED_FIELDS will catch
                if (dur < minSec || dur > maxSec) {
                    const clamped = Math.min(Math.max(dur, minSec), maxSec);
                    return [{
                        ruleId: rule.id,
                        ruleType: rule.type,
                        severity: rule.severity,
                        field: 'params.durationSec',
                        currentValue: dur,
                        message: rule.message.replace('{min}', String(minSec)).replace('{max}', String(maxSec)),
                        suggestions: [{
                            action: 'ADJUST',
                            field: 'params.durationSec',
                            value: clamped,
                            reason: `Clamp durationSec to [${minSec}, ${maxSec}]`,
                        }],
                    }];
                }
                return [];
            }

            case RuleType.PROMPT_REQUIRED: {
                const p = (shot.params.prompt ?? '').trim();
                const { minChars } = rule.config;
                if (p.length < minChars) {
                    const filler = p.length === 0 ? 'Describe the shot clearly.' : ' Add more detail.';
                    return [{
                        ruleId: rule.id,
                        ruleType: rule.type,
                        severity: rule.severity,
                        field: 'params.prompt',
                        currentValue: shot.params.prompt ?? '',
                        message: rule.message.replace('{minChars}', String(minChars)),
                        suggestions: [{
                            action: 'APPEND',
                            field: 'params.prompt',
                            value: filler,
                            reason: `Ensure prompt length >= ${minChars}`,
                        }],
                    }];
                }
                return [];
            }

            case RuleType.PROMPT_LENGTH: {
                const p = (shot.params.prompt ?? '').trim();
                const { maxChars } = rule.config;
                if (p.length > maxChars) {
                    return [{
                        ruleId: rule.id,
                        ruleType: rule.type,
                        severity: rule.severity,
                        field: 'params.prompt',
                        currentValue: p.length,
                        message: rule.message.replace('{maxChars}', String(maxChars)),
                        suggestions: [{
                            action: 'REPLACE',
                            field: 'params.prompt',
                            value: p.slice(0, maxChars),
                            reason: `Truncate prompt to max ${maxChars} chars`,
                        }],
                    }];
                }
                return [];
            }

            case RuleType.MOTION_DURATION_COUPLING: {
                const motion = shot.params.motion ?? 'NONE';
                const dur = shot.params.durationSec;
                const { fastMotions, maxSecWhenFast } = rule.config;

                if (!fastMotions.includes(motion)) return [];
                if (typeof dur !== 'number') return [];

                if (dur > maxSecWhenFast) {
                    return [{
                        ruleId: rule.id,
                        ruleType: rule.type,
                        severity: rule.severity,
                        field: 'params.durationSec',
                        currentValue: dur,
                        message: rule.message.replace('{max}', String(maxSecWhenFast)),
                        suggestions: [
                            {
                                action: 'ADJUST',
                                field: 'params.durationSec',
                                value: maxSecWhenFast,
                                reason: `Fast motion requires durationSec <= ${maxSecWhenFast}`,
                            },
                            {
                                action: 'REPLACE',
                                field: 'params.motion',
                                value: 'NONE',
                                reason: `Alternatively set motion=NONE to keep longer duration`,
                            },
                        ],
                    }];
                }
                return [];
            }

            case RuleType.COMPOSITION_TYPE_COMPATIBILITY: {
                const comp = shot.params.composition ?? 'NORMAL';
                const allowed = rule.config.allowed[shot.type] ?? [];
                if (!allowed.includes(comp as CompositionType)) {
                    const fallback = allowed[0] ?? 'NORMAL';
                    return [{
                        ruleId: rule.id,
                        ruleType: rule.type,
                        severity: rule.severity,
                        field: 'params.composition',
                        currentValue: comp,
                        message: rule.message,
                        suggestions: [{
                            action: 'REPLACE',
                            field: 'params.composition',
                            value: fallback,
                            reason: `Composition must be one of: ${allowed.join(', ')}`,
                        }],
                    }];
                }
                return [];
            }

            case RuleType.REQUIRED_FIELDS: {
                const missing: string[] = [];
                for (const fieldPath of rule.config.fields) {
                    const v = getByPath(shot, fieldPath);
                    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
                        missing.push(fieldPath);
                    }
                }
                if (missing.length === 0) return [];

                return missing.map(fp => ({
                    ruleId: rule.id,
                    ruleType: rule.type,
                    severity: rule.severity,
                    field: fp,
                    currentValue: getByPath(shot, fp),
                    message: `${rule.message}: missing ${fp}`,
                    suggestions: this.suggestDefaultForField(fp),
                }));
            }

            default:
                return [];
        }
    }

    private suggestDefaultForField(fieldPath: string): FixSuggestion[] {
        if (fieldPath === 'params.durationSec') {
            return [{ action: 'REPLACE', field: fieldPath, value: 4, reason: 'Set a default durationSec=4' }];
        }
        if (fieldPath === 'params.prompt') {
            return [{ action: 'REPLACE', field: fieldPath, value: 'A clear shot description with subject, mood, and action.', reason: 'Set a default prompt' }];
        }
        if (fieldPath === 'params.motion') {
            return [{ action: 'REPLACE', field: fieldPath, value: 'NONE', reason: 'Default motion=NONE' }];
        }
        if (fieldPath === 'params.composition') {
            return [{ action: 'REPLACE', field: fieldPath, value: 'NORMAL', reason: 'Default composition=NORMAL' }];
        }
        if (fieldPath === 'type') {
            return [{ action: 'REPLACE', field: fieldPath, value: 'DEFAULT', reason: 'Default type=DEFAULT' }];
        }
        return [];
    }

    private getDefaultRules(): DirectorRule[] {
        return [
            {
                id: 'DR_DUR_001',
                type: RuleType.DURATION_RANGE,
                severity: 'ERROR',
                message: 'durationSec must be in range [{min}, {max}]',
                config: { minSec: 1, maxSec: 12 },
            },
            {
                id: 'DR_REQ_001',
                type: RuleType.REQUIRED_FIELDS,
                severity: 'ERROR',
                message: 'required field missing',
                config: { fields: ['type', 'params.prompt', 'params.durationSec'] },
            },
            {
                id: 'DR_PROMPT_001',
                type: RuleType.PROMPT_REQUIRED,
                severity: 'ERROR',
                message: 'prompt must be non-empty and at least {minChars} chars',
                config: { minChars: 10 },
            },
            {
                id: 'DR_PROMPT_002',
                type: RuleType.PROMPT_LENGTH,
                severity: 'WARNING',
                message: 'prompt length must be <= {maxChars}',
                config: { maxChars: 500 },
            },
            {
                id: 'DR_MOTION_001',
                type: RuleType.MOTION_DURATION_COUPLING,
                severity: 'WARNING',
                message: 'fast motion requires durationSec <= {max}',
                config: { fastMotions: ['PAN', 'ZOOM'], maxSecWhenFast: 8 },
            },
            {
                id: 'DR_COMP_001',
                type: RuleType.COMPOSITION_TYPE_COMPATIBILITY,
                severity: 'ERROR',
                message: 'composition is not compatible with shot type',
                config: {
                    allowed: {
                        CLOSE_UP: ['TIGHT', 'NORMAL'],
                        MEDIUM_SHOT: ['TIGHT', 'NORMAL', 'WIDE'],
                        WIDE_SHOT: ['NORMAL', 'WIDE'],
                        DEFAULT: ['NORMAL'],
                    },
                },
            },
        ];
    }
}
