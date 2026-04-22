import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilmIRController } from './film-ir.controller';
import { FilmIRService } from './film-ir.service';
import { FilmIRPlannerService } from './film-ir-planner.service';
import { FilmIROutputValidator } from './film-ir-output-validator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { JobModule } from '../job/job.module';
import { AuthModule } from '../auth/auth.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';

/**
 * Film IR Module — P1/P2-0/P2-1/P2.2 阶段
 *
 * P2.2 变更：
 * - 引入 ConfigModule（used by FilmIRPlannerService 动态 provider 切换）
 * - Validator 保持纯函数式校验，不再额外注入配置
 */
@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    ConfigModule, // 必须：FilmIRPlannerService 通过 ConfigService 读取 FILM_IR_ 配置
    forwardRef(() => JobModule),
    AuthModule,
    ApiSecurityModule,
  ],
  controllers: [FilmIRController],
  providers: [
    FilmIRService,
    FilmIRPlannerService,
    FilmIROutputValidator,
  ],
  exports: [FilmIRService, FilmIRPlannerService],
})
export class FilmIRModule {}
