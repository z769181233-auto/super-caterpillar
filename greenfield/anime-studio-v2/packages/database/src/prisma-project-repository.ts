import type {
  AssetLibraryItem,
  CharacterProfile,
  ConsistencyIssue,
  EpisodeOutline,
  ImportJob,
  NovelChapter,
  NovelImport,
  NovelUploadSession,
  PreviewAsset,
  PreviewVideoJob,
  ProjectSnapshot,
  RenderArtifact,
  RenderJob,
  SceneScript,
  ShotScript,
  StoredFile,
  VersionRecord
} from '../../domain/src';
import { Prisma, PrismaClient } from '@prisma/client';
import type { ProjectRecord, ProjectRepository } from '../../../apps/api/src/repository';

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: ProjectRecord): Promise<ProjectRecord> {
    return this.save(record);
  }

  async list(): Promise<ProjectSnapshot[]> {
    const projects = await this.prisma.project.findMany({
      include: projectInclude
    });

    return projects.map(mapProjectRecord);
  }

  async get(projectId: string): Promise<ProjectRecord | undefined> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: projectInclude
    });

    return project ? mapProjectRecord(project) : undefined;
  }

  async save(record: ProjectRecord): Promise<ProjectRecord> {
    await this.prisma.$transaction(async (tx) => {
      await tx.project.upsert({
        where: { id: record.project.id },
        create: {
          id: record.project.id,
          name: record.project.name,
          description: record.project.description,
          stage: record.project.stage
        },
        update: {
          name: record.project.name,
          description: record.project.description,
          stage: record.project.stage,
          updatedAt: new Date(record.project.updatedAt)
        }
      });

      await tx.novel.deleteMany({ where: { projectId: record.project.id } });
      if (record.novel) {
        await tx.novel.create({
          data: {
            id: record.novel.id,
            projectId: record.novel.projectId,
            title: record.novel.title,
            author: record.novel.author,
            wordCount: record.novel.wordCount,
            chapterCount: record.novel.chapterCount,
            createdAt: new Date(record.novel.createdAt),
            chapters: {
              create: record.novel.chapters.map((chapter) => ({
                id: chapter.id,
                chapterNo: chapter.chapterNo,
                title: chapter.title,
                summary: chapter.summary,
                excerpt: chapter.excerpt,
                wordCount: chapter.wordCount
              }))
            }
          }
        });
      }

      await tx.characterProfile.deleteMany({ where: { projectId: record.project.id } });
      if (record.characters.length > 0) {
        await tx.characterProfile.createMany({
          data: record.characters.map((character) => ({
            id: character.id,
            projectId: record.project.id,
            name: character.name,
            role: character.role,
            identitySummary: character.identitySummary,
            speechStyle: character.speechStyle
          }))
        });
      }

      await tx.episodeOutline.deleteMany({ where: { projectId: record.project.id } });
      for (const outline of record.episodeOutlines) {
        await tx.episodeOutline.create({
          data: {
            id: outline.id,
            projectId: record.project.id,
            episodeNo: outline.episodeNo,
            adaptationMode: outline.adaptationMode,
            estimatedMinutes: outline.estimatedMinutes,
            title: outline.title,
            theme: outline.theme,
            logline: outline.logline,
            storyGoal: outline.storyGoal,
            progressPoint: outline.progressPoint,
            climax: outline.climax,
            endingHook: outline.endingHook,
            createdAt: new Date(outline.createdAt)
          }
        });
      }

      await tx.sceneScript.deleteMany({ where: { projectId: record.project.id } });
      for (const scene of record.scenes) {
        await tx.sceneScript.create({
          data: {
            id: scene.id,
            projectId: record.project.id,
            episodeOutlineId: scene.episodeOutlineId,
            sceneNo: scene.sceneNo,
            title: scene.title,
            location: scene.location,
            timeOfDay: scene.timeOfDay,
            characters: scene.characters,
            sceneGoal: scene.sceneGoal,
            conflictSource: scene.conflictSource,
            actionText: scene.actionText,
            dialogueText: scene.dialogueText,
            emotionGoal: scene.emotionGoal,
            exitResult: scene.exitResult,
            evidenceLevel: scene.evidenceLevel
          }
        });
      }

      await tx.shotScript.deleteMany({ where: { projectId: record.project.id } });
      for (const shot of record.shots) {
        await tx.shotScript.create({
          data: {
            id: shot.id,
            projectId: record.project.id,
            sceneId: shot.sceneId,
            shotNo: shot.shotNo,
            shotType: shot.shotType,
            cameraAngle: shot.cameraAngle,
            cameraMove: shot.cameraMove,
            durationSec: shot.durationSec,
            visualFocus: shot.visualFocus,
            performanceFocus: shot.performanceFocus
          }
        });
      }

      await tx.consistencyIssue.deleteMany({ where: { projectId: record.project.id } });
      if (record.issues.length > 0) {
        await tx.consistencyIssue.createMany({
          data: record.issues.map((issue) => ({
            id: issue.id,
            projectId: record.project.id,
            type: issue.type,
            severity: issue.severity,
            description: issue.description,
            suggestion: issue.suggestion
          }))
        });
      }

      await tx.projectVersion.deleteMany({ where: { projectId: record.project.id } });
      if (record.versions.length > 0) {
        await tx.projectVersion.createMany({
          data: record.versions.map((version) => ({
            id: version.id,
            projectId: record.project.id,
            versionNo: version.versionNo,
            stage: version.stage,
            action: version.action,
            summary: version.summary,
            detail: version.detail,
            metadata: version.metadata,
            createdAt: new Date(version.createdAt)
          }))
        });
      }

      await tx.previewVideoJob.deleteMany({ where: { projectId: record.project.id } });
      for (const previewJob of record.previewJobs) {
        await tx.previewVideoJob.create({
          data: {
            id: previewJob.id,
            projectId: record.project.id,
            episodeOutlineId: previewJob.episodeOutlineId,
            episodeNo: previewJob.episodeNo,
            provider: previewJob.provider,
            status: previewJob.status,
            objective: previewJob.objective,
            requestSummary: previewJob.requestSummary,
            promptPacket: previewJob.promptPacket,
            sceneCount: previewJob.sceneCount,
            shotCount: previewJob.shotCount,
            warnings: previewJob.warnings,
            assets: previewJob.assets as unknown as Prisma.InputJsonValue,
            createdAt: new Date(previewJob.createdAt),
            updatedAt: new Date(previewJob.updatedAt)
          }
        });
      }

      await tx.renderJob.deleteMany({ where: { projectId: record.project.id } });
      for (const renderJob of record.renderJobs) {
        await tx.renderJob.create({
          data: {
            id: renderJob.id,
            projectId: record.project.id,
            previewJobId: renderJob.previewJobId,
            episodeNo: renderJob.episodeNo,
            provider: renderJob.provider,
            status: renderJob.status,
            qualityPreset: renderJob.qualityPreset,
            requestSummary: renderJob.requestSummary,
            outputSummary: renderJob.outputSummary,
            externalJobId: renderJob.externalJobId,
            warnings: renderJob.warnings,
            artifacts: renderJob.artifacts as unknown as Prisma.InputJsonValue,
            createdAt: new Date(renderJob.createdAt),
            updatedAt: new Date(renderJob.updatedAt)
          }
        });
      }

      await tx.novelUploadSession.deleteMany({ where: { projectId: record.project.id } });
      for (const session of record.uploadSessions) {
        await tx.novelUploadSession.create({
          data: {
            id: session.id,
            projectId: record.project.id,
            title: session.title,
            author: session.author,
            totalChunks: session.totalChunks,
            receivedChunks: session.receivedChunks,
            totalCharacters: session.totalCharacters,
            status: session.status,
            chunks: session.chunks as unknown as Prisma.InputJsonValue,
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(session.updatedAt)
          }
        });
      }

      await tx.storedFile.deleteMany({ where: { projectId: record.project.id } });
      if (record.storedFiles.length > 0) {
        await tx.storedFile.createMany({
          data: record.storedFiles.map((file) => ({
            id: file.id,
            projectId: record.project.id,
            name: file.name,
            kind: file.kind,
            mimeType: file.mimeType,
            byteSize: file.byteSize,
            absolutePath: file.absolutePath,
            createdAt: new Date(file.createdAt)
          }))
        });
      }

      await tx.assetLibraryItem.deleteMany({ where: { projectId: record.project.id } });
      if (record.assets.length > 0) {
        await tx.assetLibraryItem.createMany({
          data: record.assets.map((asset) => ({
            id: asset.id,
            projectId: record.project.id,
            name: asset.name,
            type: asset.type,
            status: asset.status,
            description: asset.description,
            sourceUrl: asset.sourceUrl,
            sourceFileId: asset.sourceFileId,
            tags: asset.tags,
            promptHint: asset.promptHint,
            createdAt: new Date(asset.createdAt),
            updatedAt: new Date(asset.updatedAt)
          }))
        });
      }

      await tx.importJob.deleteMany({ where: { projectId: record.project.id } });
      if (record.importJobs.length > 0) {
        await tx.importJob.createMany({
          data: record.importJobs.map((job) => ({
            id: job.id,
            projectId: record.project.id,
            fileId: job.fileId,
            title: job.title,
            author: job.author,
            status: job.status,
            errorMessage: job.errorMessage,
            importedWordCount: job.importedWordCount,
            createdAt: new Date(job.createdAt),
            updatedAt: new Date(job.updatedAt)
          }))
        });
      }
    });

    return (await this.get(record.project.id)) as ProjectRecord;
  }
}

const projectInclude = {
  novel: {
    include: {
      chapters: {
        orderBy: {
          chapterNo: 'asc' as const
        }
      }
    }
  },
  characters: true,
  episodeOutlines: {
    orderBy: {
      episodeNo: 'asc' as const
    }
  },
  scenes: {
    orderBy: {
      sceneNo: 'asc' as const
    }
  },
  shots: {
    orderBy: {
      shotNo: 'asc' as const
    }
  },
  issues: true,
  versions: {
    orderBy: {
      versionNo: 'asc' as const
    }
  },
  previewJobs: {
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  renderJobs: {
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  uploadSessions: {
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  assets: {
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  storedFiles: {
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  importJobs: {
    orderBy: {
      createdAt: 'asc' as const
    }
  }
};

function mapProjectRecord(project: {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  createdAt: Date;
  updatedAt: Date;
  novel: ({
    id: string;
    projectId: string;
    title: string;
    author: string | null;
    wordCount: number;
    chapterCount: number;
    createdAt: Date;
    chapters: {
      id: string;
      chapterNo: number;
      title: string;
      summary: string;
      excerpt: string;
      wordCount: number;
    }[];
  }) | null;
  characters: {
    id: string;
    name: string;
    role: string;
    identitySummary: string;
    speechStyle: string;
  }[];
  episodeOutlines: {
    id: string;
    episodeNo: number;
    adaptationMode: string;
    estimatedMinutes: number;
    title: string;
    theme: string;
    logline: string;
    storyGoal: string;
    progressPoint: string;
    climax: string;
    endingHook: string;
    createdAt: Date;
  }[];
  scenes: {
    id: string;
    episodeOutlineId: string;
    sceneNo: number;
    title: string;
    location: string;
    timeOfDay: string;
    characters: unknown;
    sceneGoal: string;
    conflictSource: string;
    actionText: string;
    dialogueText: string;
    emotionGoal: string;
    exitResult: string;
    evidenceLevel: string;
  }[];
  shots: {
    id: string;
    sceneId: string;
    shotNo: number;
    shotType: string;
    cameraAngle: string;
    cameraMove: string;
    durationSec: number;
    visualFocus: string;
    performanceFocus: string;
  }[];
  issues: {
    id: string;
    type: string;
    severity: string;
    description: string;
    suggestion: string;
  }[];
  versions: {
    id: string;
    versionNo: number;
    stage: string;
    action: string;
    summary: string;
    detail: string;
    metadata: unknown;
    createdAt: Date;
  }[];
  previewJobs: {
    id: string;
    episodeOutlineId: string;
    episodeNo: number;
    provider: string;
    status: string;
    objective: string;
    requestSummary: string;
    promptPacket: string;
    sceneCount: number;
    shotCount: number;
    warnings: string[];
    assets: unknown;
    createdAt: Date;
    updatedAt: Date;
  }[];
  renderJobs: {
    id: string;
    previewJobId: string;
    episodeNo: number;
    provider: string;
    status: string;
    qualityPreset: string;
    requestSummary: string;
    outputSummary: string;
    externalJobId: string | null;
    warnings: string[];
    artifacts: unknown;
    createdAt: Date;
    updatedAt: Date;
  }[];
  uploadSessions: {
    id: string;
    title: string;
    author: string | null;
    totalChunks: number;
    receivedChunks: number;
    totalCharacters: number;
    status: string;
    chunks: unknown;
    createdAt: Date;
    updatedAt: Date;
  }[];
  assets: {
    id: string;
    name: string;
    type: string;
    status: string;
    description: string;
    sourceUrl: string | null;
    sourceFileId: string | null;
    tags: string[];
    promptHint: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  storedFiles: {
    id: string;
    name: string;
    kind: string;
    mimeType: string;
    byteSize: number;
    absolutePath: string;
    createdAt: Date;
  }[];
  importJobs: {
    id: string;
    fileId: string;
    title: string;
    author: string | null;
    status: string;
    errorMessage: string | null;
    importedWordCount: number | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
}): ProjectRecord {
  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description || undefined,
      stage: project.stage as ProjectRecord['project']['stage'],
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    },
    novel: project.novel ? mapNovel(project.novel) : undefined,
    characters: project.characters.map(mapCharacter),
    episodeOutlines: project.episodeOutlines.map(mapEpisodeOutline(project.id)),
    scenes: project.scenes.map(mapScene(project.id)),
    shots: project.shots.map(mapShot(project.id)),
    issues: project.issues.map(mapIssue(project.id)),
    versions: project.versions.map(mapVersion(project.id)),
    previewJobs: project.previewJobs.map(mapPreviewJob(project.id)),
    renderJobs: project.renderJobs.map(mapRenderJob(project.id)),
    uploadSessions: project.uploadSessions.map(mapUploadSession(project.id)),
    assets: project.assets.map(mapAsset(project.id)),
    storedFiles: project.storedFiles.map(mapStoredFile(project.id)),
    importJobs: project.importJobs.map(mapImportJob(project.id))
  };
}

function mapNovel(novel: {
  id: string;
  projectId: string;
  title: string;
  author: string | null;
  wordCount: number;
  chapterCount: number;
  createdAt: Date;
  chapters: {
    id: string;
    chapterNo: number;
    title: string;
    summary: string;
    excerpt: string;
    wordCount: number;
  }[];
}): NovelImport {
  return {
    id: novel.id,
    projectId: novel.projectId,
    title: novel.title,
    author: novel.author || undefined,
    wordCount: novel.wordCount,
    chapterCount: novel.chapterCount,
    chapters: novel.chapters.map(mapChapter),
    createdAt: novel.createdAt.toISOString()
  };
}

function mapChapter(chapter: {
  id: string;
  chapterNo: number;
  title: string;
  summary: string;
  excerpt: string;
  wordCount: number;
}): NovelChapter {
  return { ...chapter };
}

function mapCharacter(character: {
  id: string;
  name: string;
  role: string;
  identitySummary: string;
  speechStyle: string;
}): CharacterProfile {
  return {
    id: character.id,
    name: character.name,
    role: character.role as CharacterProfile['role'],
    identitySummary: character.identitySummary,
    speechStyle: character.speechStyle
  };
}

function mapEpisodeOutline(projectId: string) {
  return (outline: {
    id: string;
    episodeNo: number;
    adaptationMode: string;
    estimatedMinutes: number;
    title: string;
    theme: string;
    logline: string;
    storyGoal: string;
    progressPoint: string;
    climax: string;
    endingHook: string;
    createdAt: Date;
  }): EpisodeOutline => ({
    id: outline.id,
    projectId,
    episodeNo: outline.episodeNo,
    adaptationMode: outline.adaptationMode as EpisodeOutline['adaptationMode'],
    estimatedMinutes: outline.estimatedMinutes,
    title: outline.title,
    theme: outline.theme,
    logline: outline.logline,
    storyGoal: outline.storyGoal,
    progressPoint: outline.progressPoint,
    climax: outline.climax,
    endingHook: outline.endingHook,
    createdAt: outline.createdAt.toISOString()
  });
}

function mapScene(projectId: string) {
  return (scene: {
    id: string;
    episodeOutlineId: string;
    sceneNo: number;
    title: string;
    location: string;
    timeOfDay: string;
    characters: unknown;
    sceneGoal: string;
    conflictSource: string;
    actionText: string;
    dialogueText: string;
    emotionGoal: string;
    exitResult: string;
    evidenceLevel: string;
  }): SceneScript => ({
    id: scene.id,
    projectId,
    episodeOutlineId: scene.episodeOutlineId,
    sceneNo: scene.sceneNo,
    title: scene.title,
    location: scene.location,
    timeOfDay: scene.timeOfDay,
    characters: (scene.characters as string[]) || [],
    sceneGoal: scene.sceneGoal,
    conflictSource: scene.conflictSource,
    actionText: scene.actionText,
    dialogueText: scene.dialogueText,
    emotionGoal: scene.emotionGoal,
    exitResult: scene.exitResult,
    evidenceLevel: scene.evidenceLevel as SceneScript['evidenceLevel']
  });
}

function mapShot(projectId: string) {
  return (shot: {
    id: string;
    sceneId: string;
    shotNo: number;
    shotType: string;
    cameraAngle: string;
    cameraMove: string;
    durationSec: number;
    visualFocus: string;
    performanceFocus: string;
  }): ShotScript => ({
    id: shot.id,
    projectId,
    sceneId: shot.sceneId,
    shotNo: shot.shotNo,
    shotType: shot.shotType as ShotScript['shotType'],
    cameraAngle: shot.cameraAngle,
    cameraMove: shot.cameraMove,
    durationSec: shot.durationSec,
    visualFocus: shot.visualFocus,
    performanceFocus: shot.performanceFocus
  });
}

function mapIssue(projectId: string) {
  return (issue: {
    id: string;
    type: string;
    severity: string;
    description: string;
    suggestion: string;
  }): ConsistencyIssue => ({
    id: issue.id,
    projectId,
    type: issue.type as ConsistencyIssue['type'],
    severity: issue.severity as ConsistencyIssue['severity'],
    description: issue.description,
    suggestion: issue.suggestion
  });
}

function mapVersion(projectId: string) {
  return (version: {
    id: string;
    versionNo: number;
    stage: string;
    action: string;
    summary: string;
    detail: string;
    metadata: unknown;
    createdAt: Date;
  }): VersionRecord => ({
    id: version.id,
    projectId,
    versionNo: version.versionNo,
    stage: version.stage as VersionRecord['stage'],
    action: version.action as VersionRecord['action'],
    summary: version.summary,
    detail: version.detail,
    metadata: (version.metadata as VersionRecord['metadata']) || undefined,
    createdAt: version.createdAt.toISOString()
  });
}

function mapPreviewJob(projectId: string) {
  return (previewJob: {
    id: string;
    episodeOutlineId: string;
    episodeNo: number;
    provider: string;
    status: string;
    objective: string;
    requestSummary: string;
    promptPacket: string;
    sceneCount: number;
    shotCount: number;
    warnings: string[];
    assets: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): PreviewVideoJob => ({
    id: previewJob.id,
    projectId,
    episodeOutlineId: previewJob.episodeOutlineId,
    episodeNo: previewJob.episodeNo,
    provider: previewJob.provider as PreviewVideoJob['provider'],
    status: previewJob.status as PreviewVideoJob['status'],
    objective: previewJob.objective,
    requestSummary: previewJob.requestSummary,
    promptPacket: previewJob.promptPacket,
    sceneCount: previewJob.sceneCount,
    shotCount: previewJob.shotCount,
    warnings: previewJob.warnings || [],
    assets: ((previewJob.assets as PreviewAsset[]) || []).map((asset) => ({
      kind: asset.kind,
      title: asset.title,
      content: asset.content
    })),
    createdAt: previewJob.createdAt.toISOString(),
    updatedAt: previewJob.updatedAt.toISOString()
  });
}

function mapRenderJob(projectId: string) {
  return (renderJob: {
    id: string;
    previewJobId: string;
    episodeNo: number;
    provider: string;
    status: string;
    qualityPreset: string;
    requestSummary: string;
    outputSummary: string;
    externalJobId: string | null;
    warnings: string[];
    artifacts: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): RenderJob => ({
    id: renderJob.id,
    projectId,
    previewJobId: renderJob.previewJobId,
    episodeNo: renderJob.episodeNo,
    provider: renderJob.provider as RenderJob['provider'],
    status: renderJob.status as RenderJob['status'],
    qualityPreset: renderJob.qualityPreset as RenderJob['qualityPreset'],
    requestSummary: renderJob.requestSummary,
    outputSummary: renderJob.outputSummary,
    externalJobId: renderJob.externalJobId || undefined,
    warnings: renderJob.warnings || [],
    artifacts: ((renderJob.artifacts as RenderArtifact[]) || []).map((artifact) => ({
      kind: artifact.kind,
      title: artifact.title,
      url: artifact.url,
      mimeType: artifact.mimeType
    })),
    createdAt: renderJob.createdAt.toISOString(),
    updatedAt: renderJob.updatedAt.toISOString()
  });
}

function mapUploadSession(projectId: string) {
  return (session: {
    id: string;
    title: string;
    author: string | null;
    totalChunks: number;
    receivedChunks: number;
    totalCharacters: number;
    status: string;
    chunks: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): NovelUploadSession => ({
    id: session.id,
    projectId,
    title: session.title,
    author: session.author || undefined,
    totalChunks: session.totalChunks,
    receivedChunks: session.receivedChunks,
    totalCharacters: session.totalCharacters,
    status: session.status as NovelUploadSession['status'],
    chunks: ((session.chunks as string[]) || []).map((chunk) => chunk || ''),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  });
}

function mapAsset(projectId: string) {
  return (asset: {
    id: string;
    name: string;
    type: string;
    status: string;
    description: string;
    sourceUrl: string | null;
    sourceFileId: string | null;
    tags: string[];
    promptHint: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AssetLibraryItem => ({
    id: asset.id,
    projectId,
    name: asset.name,
    type: asset.type as AssetLibraryItem['type'],
    status: asset.status as AssetLibraryItem['status'],
    description: asset.description,
    sourceUrl: asset.sourceUrl || undefined,
    sourceFileId: asset.sourceFileId || undefined,
    tags: asset.tags || [],
    promptHint: asset.promptHint || undefined,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString()
  });
}

function mapStoredFile(projectId: string) {
  return (file: {
    id: string;
    name: string;
    kind: string;
    mimeType: string;
    byteSize: number;
    absolutePath: string;
    createdAt: Date;
  }): StoredFile => ({
    id: file.id,
    projectId,
    name: file.name,
    kind: file.kind as StoredFile['kind'],
    mimeType: file.mimeType,
    byteSize: file.byteSize,
    absolutePath: file.absolutePath,
    createdAt: file.createdAt.toISOString()
  });
}

function mapImportJob(projectId: string) {
  return (job: {
    id: string;
    fileId: string;
    title: string;
    author: string | null;
    status: string;
    errorMessage: string | null;
    importedWordCount: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): ImportJob => ({
    id: job.id,
    projectId,
    fileId: job.fileId,
    title: job.title,
    author: job.author || undefined,
    status: job.status as ImportJob['status'],
    errorMessage: job.errorMessage || undefined,
    importedWordCount: job.importedWordCount || undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  });
}
