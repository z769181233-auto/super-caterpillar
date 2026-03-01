import { Module } from '@nestjs/common';
import { ScriptBuildController, ShotsController } from './script-build.controller';
import { ScriptBuildService } from './script-build.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ScriptBuildController, ShotsController],
  providers: [ScriptBuildService],
  exports: [ScriptBuildService],
})
export class ScriptBuildModule {}
