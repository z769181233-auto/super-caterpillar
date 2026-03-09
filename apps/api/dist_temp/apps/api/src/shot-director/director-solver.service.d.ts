import { ConstraintViolation, DirectorRule, DirectorShotInput, FixSuggestion, ValidationResult } from './director-rule.types';
export declare class DirectorConstraintSolverService {
    private readonly rules;
    constructor(rules?: DirectorRule[]);
    validateShot(shot: DirectorShotInput): ValidationResult;
    suggestFix(shot: DirectorShotInput, violations: ConstraintViolation[]): FixSuggestion[];
    private applyRule;
    private suggestDefaultForField;
    private getDefaultRules;
}
