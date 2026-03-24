export type TransitionHint = 'cut' | 'match_cut' | 'hold';
export type CoverageRole = 'establish' | 'performance' | 'detail' | 'insert';
export type RhythmClass = 'fast' | 'balanced' | 'linger';

export type ShotPlannerRuleMatch = {
  id: string;
  reason: string;
};

export type ShotPlannerTimelinePolicy = {
  ruleSetVersion: string;
  matchedRules: ShotPlannerRuleMatch[];
  transitionHint: TransitionHint;
  rhythmClass: RhythmClass;
  coverageRole: CoverageRole;
};

const RULE_SET_VERSION = 'shot-policy-v1';

function toUpper(value: unknown): string {
  return String(value || '').toUpperCase();
}

function toNumber(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function deriveTransitionHint(activeFilmIr: any): {
  value: TransitionHint;
  matchedRules: ShotPlannerRuleMatch[];
} {
  const rhythm = toUpper(activeFilmIr?.editingRhythmStrategy);
  const shotPattern = toUpper(activeFilmIr?.shotPattern);
  const avgShotLength = toNumber(activeFilmIr?.avgShotLengthSec);

  if (rhythm.includes('LINGER') || rhythm.includes('HOLD') || avgShotLength >= 6) {
    return {
      value: 'hold',
      matchedRules: [{ id: 'transition-hold', reason: 'linger rhythm or long avg shot' }],
    };
  }

  if (shotPattern.includes('MONTAGE') || shotPattern.includes('PARALLEL')) {
    return {
      value: 'match_cut',
      matchedRules: [{ id: 'transition-match-cut', reason: 'montage or parallel shot pattern' }],
    };
  }

  return {
    value: 'cut',
    matchedRules: [{ id: 'transition-cut-default', reason: 'default cut pacing' }],
  };
}

export function deriveCoverageRole(shotData: any): {
  value: CoverageRole;
  matchedRules: ShotPlannerRuleMatch[];
} {
  const shotType = toUpper(shotData?.shot_type);

  if (shotType.includes('WIDE') || shotType.includes('ESTABLISH') || shotType.includes('MASTER')) {
    return {
      value: 'establish',
      matchedRules: [{ id: 'coverage-establish', reason: 'wide/master establishing shot' }],
    };
  }

  if (shotType.includes('INSERT') || shotType.includes('CUTAWAY')) {
    return {
      value: 'insert',
      matchedRules: [{ id: 'coverage-insert', reason: 'insert/cutaway shot type' }],
    };
  }

  if (shotType.includes('CLOSE') || shotType.includes('DETAIL') || shotType.includes('EXTREME')) {
    return {
      value: 'detail',
      matchedRules: [{ id: 'coverage-detail', reason: 'close/detail framing' }],
    };
  }

  return {
    value: 'performance',
    matchedRules: [{ id: 'coverage-performance-default', reason: 'default performance coverage' }],
  };
}

export function deriveRhythmClass(activeFilmIr: any): {
  value: RhythmClass;
  matchedRules: ShotPlannerRuleMatch[];
} {
  const rhythm = toUpper(activeFilmIr?.editingRhythmStrategy);
  const avgShotLength = toNumber(activeFilmIr?.avgShotLengthSec);

  if (rhythm.includes('FAST') || rhythm.includes('TIGHT') || avgShotLength <= 2) {
    return {
      value: 'fast',
      matchedRules: [{ id: 'rhythm-fast', reason: 'fast/tight rhythm or short avg shot' }],
    };
  }

  if (rhythm.includes('LINGER') || rhythm.includes('HOLD') || avgShotLength >= 6) {
    return {
      value: 'linger',
      matchedRules: [{ id: 'rhythm-linger', reason: 'hold/linger rhythm or long avg shot' }],
    };
  }

  return {
    value: 'balanced',
    matchedRules: [{ id: 'rhythm-balanced-default', reason: 'default balanced rhythm' }],
  };
}

export function buildTimelinePolicy(activeFilmIr: any, shotData: any): ShotPlannerTimelinePolicy {
  const transition = deriveTransitionHint(activeFilmIr);
  const rhythm = deriveRhythmClass(activeFilmIr);
  const coverage = deriveCoverageRole(shotData);

  return {
    ruleSetVersion: RULE_SET_VERSION,
    matchedRules: [...transition.matchedRules, ...rhythm.matchedRules, ...coverage.matchedRules],
    transitionHint: transition.value,
    rhythmClass: rhythm.value,
    coverageRole: coverage.value,
  };
}

export function getShotPlannerRuleSetVersion() {
  return RULE_SET_VERSION;
}
