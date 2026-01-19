// apps/api/src/project/project-structure.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from './project.service';
import { TaskStatus } from 'database';
import {
  ProjectStructureTree,
  ProjectStructureSeasonNode,
  ProjectStructureEpisodeNode,
  ProjectStructureSceneNode,
  ProjectStructureShotNode,
} from '@scu/shared-types';

@Injectable()
export class ProjectStructureService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProjectService)) private readonly projectService: ProjectService
  ) {}

  /**
   * S3-C: Authoritative Project Structure Tree
   * Returns: context + tree + counts + defaultSelection + statusSummary
   */
  async getProjectStructureTree(
    projectId: string,
    userId: string,
    organizationId: string
  ): Promise<ProjectStructureTree> {
    // 1. Check Ownership
    await this.projectService.checkOwnership(projectId, userId);

    // 2. Fetch Project & Recent Tasks
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        status: true, // Fetch Status for DTO
        tasks: {
          where: { type: 'NOVEL_ANALYSIS' },
          select: { id: true, status: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        novelSources: {
          // Fetch for sourceType determination
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 3. Status Summary Logic
    let analysisStatus: 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED' = 'PENDING';
    if (project.tasks && project.tasks.length > 0) {
      const task = project.tasks[0];
      if (task.status === TaskStatus.SUCCEEDED) analysisStatus = 'DONE';
      else if (task.status === TaskStatus.FAILED) analysisStatus = 'FAILED';
      else if (['PENDING', 'RUNNING', 'RETRYING'].includes(task.status))
        analysisStatus = 'ANALYZING';
    }

    // [Start] Strict Status Mapping Logic (Mirrors ProjectService)
    const SMOKE_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
    let sourceType: 'DEMO' | 'NOVEL' = 'NOVEL';
    const isDemoName = project.name.includes('Demo') || project.name.includes('示例');
    // If no novel source and has demo name or ID -> DEMO
    if (
      (!project.novelSources || project.novelSources.length === 0) &&
      (project.id === SMOKE_PROJECT_ID || isDemoName)
    ) {
      sourceType = 'DEMO';
    }

    // Determine structureStatus
    let structureStatus: 'EMPTY' | 'READY' = 'EMPTY';

    // 4. Fetch Hierarchy (Efficient Single Query)
    const seasons = await this.prisma.season.findMany({
      where: { projectId },
      include: {
        episodes: {
          include: {
            scenes: {
              include: {
                shots: {
                  include: {
                    assets: true, // Stage 8: Include assets
                  },
                  orderBy: { index: 'asc' },
                },
              },
              orderBy: { sceneIndex: 'asc' },
            },
          },
          orderBy: { index: 'asc' },
        },
      },
      orderBy: { index: 'asc' },
    });

    if (seasons.length > 0) {
      structureStatus = 'READY';
    }

    // Determine productionStatus
    let productionStatus: 'IDLE' | 'READY' | 'RUNNING' | 'DONE' = 'IDLE';

    if (sourceType === 'DEMO') {
      productionStatus = 'IDLE';
    } else {
      if (analysisStatus === 'ANALYZING') {
        productionStatus = 'RUNNING';
      } else if (analysisStatus === 'DONE') {
        productionStatus = 'DONE';
      } else if (structureStatus === 'READY') {
        productionStatus = 'READY';
      } else {
        productionStatus = 'IDLE';
      }
    }
    // [End] Strict Status Mapping Logic

    // 5. Build Tree & Statistics
    let episodesCount = 0;
    let scenesCount = 0;
    let shotsCount = 0;

    let defaultSelection: ProjectStructureTree['defaultSelection'] = null;

    const tree: ProjectStructureSeasonNode[] = seasons.map((season: any) => {
      // Auto-select first season if nothing selected
      if (!defaultSelection) defaultSelection = { nodeId: season.id, nodeType: 'season' };

      const episodes: ProjectStructureEpisodeNode[] = season.episodes.map((episode: any) => {
        episodesCount++;
        if (defaultSelection?.nodeType === 'season' && defaultSelection.nodeId === season.id) {
          defaultSelection = { nodeId: episode.id, nodeType: 'episode' };
        }

        const scenes: ProjectStructureSceneNode[] = episode.scenes.map((scene: any) => {
          scenesCount++;
          if (defaultSelection?.nodeType === 'episode' && defaultSelection.nodeId === episode.id) {
            defaultSelection = { nodeId: scene.id, nodeType: 'scene' };
          }

          const shots: ProjectStructureShotNode[] = scene.shots.map((shot: any) => {
            shotsCount++;

            // Stage 8: Map assets to videoUrl
            const videoAsset = shot.assets?.find((a: any) => a.type === 'VIDEO');
            let videoUrl = null;
            if (videoAsset) {
              // MVP: Assume storageKey is URL if it starts with http, else prepend local serve path
              // But simplified logic: assume storageKey is valid for now, usually pre-signed or public
              videoUrl = videoAsset.storageKey;
            }

            return {
              type: 'shot',
              id: shot.id,
              index: shot.index,
              title: shot.title,
              description: shot.description,
              shotType: shot.type,
              params: shot.params,
              qualityScore: shot.qualityScore,
              videoUrl,
              assets: shot.assets,
            };
          });

          return {
            type: 'scene',
            id: scene.id,
            index: scene.sceneIndex,
            title: scene.title,
            summary: scene.summary,
            visualDensityScore: scene.visualDensityScore,
            enrichedText: scene.enrichedText,
            shots,
          };
        });

        return {
          type: 'episode',
          id: episode.id,
          index: episode.index,
          name: episode.name,
          summary: episode.summary,
          scenes,
        };
      });

      return {
        type: 'season',
        id: season.id,
        index: season.index,
        title: season.title,
        summary: season.description,
        episodes,
      };
    });

    return {
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      // Status Fields
      sourceType,
      productionStatus,
      structureStatus,
      tree,
      counts: {
        seasons: seasons.length,
        episodes: episodesCount,
        scenes: scenesCount,
        shots: shotsCount,
      },
      defaultSelection,
      statusSummary: {
        analysis: analysisStatus,
        render: 'PENDING',
      },
    };
  }
}
