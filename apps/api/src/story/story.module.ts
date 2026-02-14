import { Module } from '@nestjs/common';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { JobModule } from '../job/job.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NovelImportModule } from '../novel-import/novel-import.module';

@Module({
  imports: [JobModule, AuthModule, PrismaModule, AuditLogModule, NovelImportModule],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
