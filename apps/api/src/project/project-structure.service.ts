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
    private readonly projectService: ProjectService
  ) { }

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
    if (!project.novelSources && (project.id === SMOKE_PROJECT_ID || isDemoName)) {
      sourceType = 'DEMO';
    }

    // Determine structureStatus
    let structureStatus: 'EMPTY' | 'READY' = 'EMPTY';

    // 4. Fetch Hierarchy (Efficient Single Query) - Directly via Project
    const episodes = await this.prisma.episode.findMany({
      where: { projectId },
      include: {
        scenes: {
          include: {
            shots: {
              include: {
                assets: true,
              },
              orderBy: { index: 'asc' },
            },
          },
          orderBy: { sceneIndex: 'asc' },
        },
      },
      orderBy: { index: 'asc' },
    });

    if (episodes.length > 0) {
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

    const tree: any[] = episodes.map((episode: any) => {
      episodesCount++;
      // Auto-select first episode if nothing selected
      if (!defaultSelection) defaultSelection = { nodeId: episode.id, nodeType: 'episode' };

      const scenes: ProjectStructureSceneNode[] = episode.scenes.map((scene: any) => {
        scenesCount++;
        if (defaultSelection?.nodeType === 'episode' && defaultSelection.nodeId === episode.id) {
          defaultSelection = { nodeId: scene.id, nodeType: 'scene' };
        }

        const shots: ProjectStructureShotNode[] = scene.shots.map((shot: any) => {
          shotsCount++;

          const videoAsset = shot.assets?.find((a: any) => a.type === 'VIDEO');
          let videoUrl = null;
          if (videoAsset) {
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
      } as ProjectStructureEpisodeNode;
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
        seasons: 0,
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
