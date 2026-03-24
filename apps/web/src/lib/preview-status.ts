export type PreviewStatus = 'NONE' | 'PENDING' | 'READY' | 'FAILED';

interface PreviewShotLike {
  renderStatus?: string | null;
  resultImageUrl?: string | null;
  resultVideoUrl?: string | null;
}

export function getPreviewStatus(shot: PreviewShotLike): PreviewStatus {
  if (shot.renderStatus === 'SUCCEEDED' || shot.resultImageUrl || shot.resultVideoUrl) {
    return 'READY';
  }
  if (shot.renderStatus === 'PROCESSING' || shot.renderStatus === 'PENDING') {
    return 'PENDING';
  }
  if (shot.renderStatus === 'FAILED') {
    return 'FAILED';
  }
  return 'NONE';
}

export function getPreviewUrl(shot: PreviewShotLike): string | null {
  return shot.resultImageUrl || shot.resultVideoUrl || null;
}
