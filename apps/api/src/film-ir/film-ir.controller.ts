import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilmIRService } from './film-ir.service';
import { FilmIRPlannerService } from './film-ir-planner.service';
import { CreateFilmIRDto, UpdateFilmIRDto } from './dto/create-film-ir.dto';
import type { PlanFilmIRRequest } from './dto/plan-film-ir.dto';

/**
 * Film IR Controller — P1/P2-0/P2-1 阶段
 *
 * 路由前缀：/film-ir
 *
 * 端点一览（按职责分组）：
 *
 * [CRUD + 状态机]
 *   GET  /film-ir/health          — 健康检查
 *   POST /film-ir/plan            — 手动创建 stub 记录 (P1)
 *   GET  /film-ir/:id             — 详情
 *   GET  /film-ir/scene/:sceneId  — Scene 最新 Film IR
 *   PATCH /film-ir/:id            — 更新（DRAFT/APPROVED，LOCKED 拒）
 *   POST /film-ir/:id/approve     — DRAFT → APPROVED
 *   POST /film-ir/:id/lock        — APPROVED → LOCKED（不可逆）
 *   POST /film-ir/:id/replan      — 版本递增重建
 *
 * [LLM Planner — P2-1]
 *   POST /film-ir/planner/plan    — LLM 规划（dry-run + save draft）
 *   GET  /film-ir/planner/health  — Planner 健康检查
 */
@Controller('film-ir')
export class FilmIRController {
  constructor(
    private readonly filmIRService: FilmIRService,
    private readonly plannerService: FilmIRPlannerService,
  ) {}

  // ==================================================================
  // 健康检查
  // ==================================================================

  /** GET /film-ir/health */
  @Get('health')
  health() {
    return this.filmIRService.health();
  }

  /** GET /film-ir/planner/health */
  @Get('planner/health')
  plannerHealth() {
    return this.plannerService.health();
  }

  // ==================================================================
  // CRUD + 状态机端点
  // ==================================================================

  /**
   * 手动创建 Film IR stub 记录（P1 遗留，P2-1 之后推荐使用 /planner/plan）
   * POST /film-ir/plan
   */
  @Post('plan')
  @HttpCode(HttpStatus.CREATED)
  plan(@Body() dto: CreateFilmIRDto) {
    return this.filmIRService.create(dto);
  }

  /** GET /film-ir/scene/:sceneId — 必须在 /:id 之前注册，避免路由冲突 */
  @Get('scene/:sceneId')
  findByScene(@Param('sceneId') sceneId: string) {
    return this.filmIRService.findByScene(sceneId);
  }

  /** GET /film-ir/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.filmIRService.findOne(id);
  }

  /** PATCH /film-ir/:id */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFilmIRDto) {
    return this.filmIRService.update(id, dto);
  }

  /** POST /film-ir/:id/approve — DRAFT → APPROVED */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string) {
    return this.filmIRService.approve(id);
  }

  /** POST /film-ir/:id/lock — APPROVED → LOCKED（不可逆）*/
  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  lock(@Param('id') id: string) {
    return this.filmIRService.lock(id);
  }

  /** POST /film-ir/:id/replan — 版本递增，保留历史 */
  @Post(':id/replan')
  @HttpCode(HttpStatus.CREATED)
  replan(@Param('id') id: string) {
    return this.filmIRService.replan(id);
  }

  // ==================================================================
  // LLM Planner 端点（P2-1）
  // ==================================================================

  /**
   * LLM 规划 Film IR（支持 dry-run + save draft）
   * POST /film-ir/planner/plan
   *
   * Body: PlanFilmIRRequest
   *   - scene_id: string（必填）
   *   - dry_run: boolean（默认 false）
   *   - save_as_draft: boolean（默认 true）
   *   - ... 其他可选导演约束字段
   */
  @Post('planner/plan')
  @HttpCode(HttpStatus.CREATED)
  plannerPlan(@Body() request: PlanFilmIRRequest) {
    return this.plannerService.plan(request);
  }
}
