import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: { title?: string; index?: number }) {
    // 1. Verify Project
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    // 2. Determine Index
    let index = dto.index;
    if (index === undefined) {
      const max = await this.prisma.season.findFirst({
        where: { projectId },
        orderBy: { index: 'desc' },
        select: { index: true },
      });
      index = (max?.index ?? 0) + 1;
    }

    // 3. Create
    const season = await this.prisma.season.create({
      data: {
        projectId,
        title: dto.title ?? (dto as any).name ?? `Season ${index}`,
        index,
      },
    });

    return season;
  }

  async list(projectId: string) {
    return this.prisma.season.findMany({
      where: { projectId },
      orderBy: { index: 'asc' },
    });
  }
}
