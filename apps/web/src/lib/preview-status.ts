export type PreviewStatus = 'NONE' | 'PENDING' | 'READY' | 'FAILED';

export function getPreviewStatus(shot: any): PreviewStatus {
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

export function getPreviewUrl(shot: any): string | null {
  return shot.resultImageUrl || shot.resultVideoUrl || null;
}
