import { NovelSceneCandidate } from '@scu/shared-types';

export const SCENE_CANDIDATE_EVIDENCE_PREFIX = 'scene-candidate:';

export interface ParsedSceneCandidateEvidence {
  candidateId: string;
  confidence: string | null;
  sourceBlocks: number[];
  characters: string[];
  location: string | null;
  dialogueBlockIndexes: number[];
  actionBlockIndexes: number[];
  text: string;
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseNumberList(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function parseNameList(value: string | undefined): string[] {
  if (!value) return [];
  return uniq(value.split('、'));
}

export function formatSceneCandidateEvidence(candidate: NovelSceneCandidate): string {
  const parts = [
    `${SCENE_CANDIDATE_EVIDENCE_PREFIX}${candidate.candidateId}`,
    `confidence:${candidate.confidence}`,
    candidate.sourceBlockIndexes.length > 0
      ? `sourceBlocks:${candidate.sourceBlockIndexes.join(',')}`
      : null,
    candidate.location ? `location:${candidate.location}` : null,
    candidate.characters.length > 0 ? `characters:${candidate.characters.join('、')}` : null,
    candidate.dialogueBlockIndexes.length > 0
      ? `dialogueBlocks:${candidate.dialogueBlockIndexes.join(',')}`
      : null,
    candidate.actionBlockIndexes.length > 0
      ? `actionBlocks:${candidate.actionBlockIndexes.join(',')}`
      : null,
    candidate.conflictSummary ? `conflict:${truncate(candidate.conflictSummary, 120)}` : null,
    `text:${truncate(candidate.text, 180)}`,
  ].filter(Boolean);
  return parts.join(' | ');
}

export function parseSceneCandidateEvidence(value: string): ParsedSceneCandidateEvidence | null {
  if (!value.includes(SCENE_CANDIDATE_EVIDENCE_PREFIX)) {
    return null;
  }

  const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
  const candidateToken = parts.find((part) => part.startsWith(SCENE_CANDIDATE_EVIDENCE_PREFIX));
  if (!candidateToken) {
    return null;
  }

  const fields = new Map<string, string>();
  for (const part of parts) {
    const separatorIndex = part.indexOf(':');
    if (separatorIndex <= 0) continue;
    const key = part.slice(0, separatorIndex).trim();
    const fieldValue = part.slice(separatorIndex + 1).trim();
    if (key !== 'scene-candidate') {
      fields.set(key, fieldValue);
    }
  }

  const candidateId = candidateToken.slice(SCENE_CANDIDATE_EVIDENCE_PREFIX.length).trim();
  const text = fields.get('text') || '';
  if (!candidateId) {
    return null;
  }

  return {
    candidateId,
    confidence: fields.get('confidence') || null,
    sourceBlocks: parseNumberList(fields.get('sourceBlocks')),
    characters: parseNameList(fields.get('characters')),
    location: fields.get('location') || null,
    dialogueBlockIndexes: parseNumberList(fields.get('dialogueBlocks')),
    actionBlockIndexes: parseNumberList(fields.get('actionBlocks')),
    text,
  };
}

export function isStableParsedSceneCandidateEvidence(evidence: ParsedSceneCandidateEvidence): boolean {
  const hasNarrativeBlock =
    evidence.dialogueBlockIndexes.length > 0 || evidence.actionBlockIndexes.length > 0;
  return Boolean(
    evidence.candidateId &&
      evidence.text &&
      evidence.confidence &&
      evidence.confidence !== 'low' &&
      evidence.sourceBlocks.length > 0 &&
      evidence.characters.length > 0 &&
      (evidence.location || hasNarrativeBlock)
  );
}

export function filterStableSceneCandidateEvidence(values: string[]): ParsedSceneCandidateEvidence[] {
  return values
    .map((value) => parseSceneCandidateEvidence(value))
    .filter((value): value is ParsedSceneCandidateEvidence => Boolean(value))
    .filter((value) => isStableParsedSceneCandidateEvidence(value));
}

export function sceneCandidateEvidenceSummary(evidence: ParsedSceneCandidateEvidence): string {
  return evidence.text || evidence.candidateId;
}

export function formatSceneCandidateEvidenceBlocker(layer: string, values: string[]): string {
  const parsed = values
    .map((value) => parseSceneCandidateEvidence(value))
    .filter((value): value is ParsedSceneCandidateEvidence => Boolean(value));
  const reasons = [
    parsed.length === 0 ? 'missing scene-candidate evidence' : null,
    parsed.some((item) => item.confidence === 'low') ? 'low confidence evidence' : null,
    parsed.some((item) => item.sourceBlocks.length === 0) ? 'missing sourceBlocks' : null,
    parsed.some((item) => item.characters.length === 0) ? 'missing characters' : null,
    parsed.some(
      (item) =>
        !item.location &&
        item.dialogueBlockIndexes.length === 0 &&
        item.actionBlockIndexes.length === 0
    )
      ? 'missing location/dialogue/action trace'
      : null,
    parsed.some((item) => !item.text) ? 'missing text' : null,
  ].filter(Boolean);

  return [
    `No stable scene candidate evidence found for ${layer} generation.`,
    'Required evidence: scene-candidate id, confidence, sourceBlocks, text, characters, and at least one location/dialogue/action trace.',
    `Evidence problems: ${reasons.length > 0 ? reasons.join('; ') : 'unknown'}.`,
    'Next action: rerun novel analysis quality pipeline and regenerate upstream Studio text outputs from coverageReport.sceneCandidates.',
  ].join('\n');
}
