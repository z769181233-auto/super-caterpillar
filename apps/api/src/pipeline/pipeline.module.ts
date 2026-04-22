import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PipelineController],
  providers: [PipelineService],
})
export class PipelineModule {}
