import type { ProjectRecord } from './repository';

export function clearGeneratedOutputs(record: ProjectRecord, options?: { keepAssets?: boolean; keepUploadSessions?: boolean }) {
  record.episodeOutlines = [];
  record.scenes = [];
  record.shots = [];
  record.issues = [];
  record.previewJobs = [];
  record.renderJobs = [];

  if (!options?.keepUploadSessions) {
    record.uploadSessions = [];
  }

  if (!options?.keepAssets) {
    record.assets = [];
  }
}

export function clearImportState(record: ProjectRecord, options?: { keepAssets?: boolean; keepStoredFiles?: boolean }) {
  clearGeneratedOutputs(record, { keepAssets: options?.keepAssets, keepUploadSessions: false });
  record.uploadSessions = [];

  if (!options?.keepStoredFiles) {
    record.storedFiles = [];
  }

  record.importJobs = [];
}

export function clearEpisodeOutputs(record: ProjectRecord, episodeNo: number) {
  const replacedOutlineIds = record.episodeOutlines
    .filter((outline) => outline.episodeNo === episodeNo)
    .map((outline) => outline.id);
  const replacedSceneIds = new Set(
    record.scenes.filter((scene) => replacedOutlineIds.includes(scene.episodeOutlineId)).map((scene) => scene.id)
  );

  record.episodeOutlines = record.episodeOutlines.filter((outline) => outline.episodeNo !== episodeNo);
  record.scenes = record.scenes.filter((scene) => !replacedOutlineIds.includes(scene.episodeOutlineId));
  record.shots = record.shots.filter((shot) => !replacedSceneIds.has(shot.sceneId));
  record.issues = [];
  record.previewJobs = record.previewJobs.filter((job) => job.episodeNo !== episodeNo);
  record.renderJobs = record.renderJobs.filter((job) => job.episodeNo !== episodeNo);
}
