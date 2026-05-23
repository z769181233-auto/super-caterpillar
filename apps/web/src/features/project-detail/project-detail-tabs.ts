export type ProjectDetailTabType = 'overview' | 'script' | 'builds' | 'evidence';

export function getProjectDetailTabFromModule(module: string | null): ProjectDetailTabType {
  if (module === 'structure' || module === 'script') return 'script';
  if (module === 'builds') return 'builds';
  if (module === 'evidence') return 'evidence';
  return 'overview';
}
