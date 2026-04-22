import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditInsightController } from './audit-insight.controller';
import { AuditInsightService } from './audit-insight.service';
import { AuditNovelController } from './audit-novel.controller';
import { ShotDirectorModule } from '../shot-director/shot-director.module';

@Module({
  imports: [PrismaModule, ShotDirectorModule, AuthModule],
  controllers: [AuditInsightController, AuditNovelController],
  providers: [AuditInsightService],
})
export class AuditInsightModule {}
