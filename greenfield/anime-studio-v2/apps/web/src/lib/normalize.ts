import type { ProjectSnapshot } from './types';

export function normalizeProjectSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  return {
    ...snapshot,
    characters: snapshot.characters ?? [],
    episodeOutlines: snapshot.episodeOutlines ?? [],
    scenes: snapshot.scenes ?? [],
    shots: snapshot.shots ?? [],
    issues: snapshot.issues ?? [],
    versions: snapshot.versions ?? [],
    previewJobs: snapshot.previewJobs ?? [],
    renderJobs: snapshot.renderJobs ?? [],
    uploadSessions: snapshot.uploadSessions ?? [],
    assets: snapshot.assets ?? [],
    storedFiles: snapshot.storedFiles ?? [],
    importJobs: snapshot.importJobs ?? []
  };
}
