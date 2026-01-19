import { Module } from '@nestjs/common';
import { StoryController } from './story.controller';
import { JobModule } from '../job/job.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [JobModule, AuthModule, PrismaModule],
  controllers: [StoryController],
})
export class StoryModule {}
