import { resolve } from 'node:path';
import { createPrismaClient, PrismaProjectRepository } from '../../../packages/database/src';
import type { ProjectRepository } from './repository';
import { FileProjectRepository } from './file-repository';
import { InMemoryProjectRepository } from './store';

function resolveRepository(): ProjectRepository {
  const mode = process.env.ANIME_STUDIO_V2_REPOSITORY || 'file';

  if (mode === 'memory') {
    return new InMemoryProjectRepository();
  }

  if (mode === 'prisma') {
    return new PrismaProjectRepository(createPrismaClient());
  }

  const filePath =
    process.env.ANIME_STUDIO_V2_STORE_PATH ||
    resolve(process.cwd(), '../../.runtime/projects.json');

  return new FileProjectRepository(filePath);
}

export const projectRepository = resolveRepository();
