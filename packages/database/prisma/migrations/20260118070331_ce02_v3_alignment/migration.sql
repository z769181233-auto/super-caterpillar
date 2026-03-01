-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'CE02_VISUAL_DENSITY';

-- AlterTable
ALTER TABLE "novel_chapters" ADD COLUMN     "visual_density_meta" JSONB;

-- AlterTable
ALTER TABLE "novel_scenes" ADD COLUMN     "visual_density_meta" JSONB;
