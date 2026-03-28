import type {
  CreateRenderJobInput,
  PreviewVideoJob,
  RenderArtifact,
  RenderJob,
  RenderProvider,
  RenderQualityPreset
} from '../../../packages/domain/src';
import { createId } from './id';

interface RenderProviderResult {
  status: RenderJob['status'];
  outputSummary: string;
  externalJobId?: string;
  warnings: string[];
  artifacts: RenderArtifact[];
}

interface RenderProviderAdapter {
  provider: RenderProvider;
  submit(input: {
    projectId: string;
    previewJob: PreviewVideoJob;
    qualityPreset: RenderQualityPreset;
  }): RenderProviderResult;
}

function now(): string {
  return new Date().toISOString();
}

const mockVideoAdapter: RenderProviderAdapter = {
  provider: 'mock_video',
  submit({ projectId, previewJob, qualityPreset }) {
    const baseUrl = `mock://anime-studio-v2/${projectId}/episode-${previewJob.episodeNo}/${qualityPreset}`;
    return {
      status: 'completed',
      outputSummary: `Mock 出片已完成，可用于打通自动化产线联调与下游播放器接入。`,
      warnings: previewJob.warnings,
      artifacts: [
        {
          kind: 'video',
          title: `第 ${previewJob.episodeNo} 集预演视频`,
          url: `${baseUrl}/preview.mp4`,
          mimeType: 'video/mp4'
        },
        {
          kind: 'thumbnail',
          title: `第 ${previewJob.episodeNo} 集封面图`,
          url: `${baseUrl}/cover.jpg`,
          mimeType: 'image/jpeg'
        },
        {
          kind: 'contact_sheet',
          title: `第 ${previewJob.episodeNo} 集镜头联系表`,
          url: `${baseUrl}/contact-sheet.jpg`,
          mimeType: 'image/jpeg'
        }
      ]
    };
  }
};

const placeholderAdapters: Record<'sora' | 'jimeng', RenderProviderAdapter> = {
  sora: {
    provider: 'sora',
    submit({ previewJob, qualityPreset }) {
      return {
        status: 'submitted',
        outputSummary: `已生成 Sora 提交包，等待外部视频引擎接管真实渲染。`,
        externalJobId: `sora_${previewJob.id}_${qualityPreset}`,
        warnings: previewJob.warnings.concat('当前为适配器占位状态，尚未接入真实 Sora API。'),
        artifacts: [
          {
            kind: 'provider_payload',
            title: `Sora 提交载荷`,
            url: `provider://sora/${previewJob.id}`,
            mimeType: 'application/json'
          }
        ]
      };
    }
  },
  jimeng: {
    provider: 'jimeng',
    submit({ previewJob, qualityPreset }) {
      return {
        status: 'submitted',
        outputSummary: `已生成即梦提交包，等待外部视频引擎接管真实渲染。`,
        externalJobId: `jimeng_${previewJob.id}_${qualityPreset}`,
        warnings: previewJob.warnings.concat('当前为适配器占位状态，尚未接入真实即梦 API。'),
        artifacts: [
          {
            kind: 'provider_payload',
            title: `即梦提交载荷`,
            url: `provider://jimeng/${previewJob.id}`,
            mimeType: 'application/json'
          }
        ]
      };
    }
  }
};

function resolveRenderProvider(provider: RenderProvider): RenderProviderAdapter {
  if (provider === 'mock_video') {
    return mockVideoAdapter;
  }

  return placeholderAdapters[provider];
}

export function dispatchRenderJob(input: {
  projectId: string;
  previewJob: PreviewVideoJob;
  request?: CreateRenderJobInput;
}): RenderJob {
  const provider: RenderProvider = input.request?.provider || 'mock_video';
  const qualityPreset: RenderQualityPreset = input.request?.qualityPreset || 'preview';
  const adapter = resolveRenderProvider(provider);
  const result = adapter.submit({
    projectId: input.projectId,
    previewJob: input.previewJob,
    qualityPreset
  });

  return {
    id: createId('render'),
    projectId: input.projectId,
    previewJobId: input.previewJob.id,
    episodeNo: input.previewJob.episodeNo,
    provider,
    status: result.status,
    qualityPreset,
    requestSummary: `为第 ${input.previewJob.episodeNo} 集提交 ${provider} 出片任务`,
    outputSummary: result.outputSummary,
    externalJobId: result.externalJobId,
    warnings: result.warnings,
    artifacts: result.artifacts,
    createdAt: now(),
    updatedAt: now()
  };
}
