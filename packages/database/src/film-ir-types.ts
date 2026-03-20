/**
 * Film IR 类型定义（手工维护版本）
 *
 * 本文件手工维护 Film IR Layer（P1 新增）在 Prisma schema 中的对应类型，
 * 供 Prisma generate 尚未在本地执行（如 macOS SIP 锁定环境）时使用。
 *
 * 当 `prisma generate` 正常执行后，这些类型由 generated/prisma/index.d.ts 自动覆盖。
 * 两者不冲突（接口声明合并）。
 *
 * @see packages/database/prisma/schema.prisma — FilmIR / ContinuityState 等模型
 * @see apps/api/src/film-ir/film-ir.service.ts — 消费方
 */

/** Film IR 状态枚举（对齐 FilmIRStatus enum in schema.prisma）*/
export type FilmIRStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';

/** Film IR 完整记录类型（对齐 film_ir 表所有字段）*/
export interface FilmIRRecord {
  id: string;
  sceneId: string | null;
  projectId: string;
  plannerVersion: string;
  status: FilmIRStatus;

  // 内容源
  sourceText: string | null;
  sourceContextSummary: string | null;

  // 戏剧功能层
  dramaticFunction: string | null;
  dramaticGoal: string | null;
  emotionalTarget: string | null;
  tensionCurve: string | null;
  povCharacter: string | null;
  audienceInformationMode: string | null;
  relationshipBefore: string | null;
  relationshipAfter: string | null;

  // 视觉策略层
  visualStrategy: string | null;
  blockingStrategy: string | null;
  shotPattern: string | null;
  avgShotLengthSec: number | null;
  cameraDistanceStrategy: string | null;
  cameraAngleStrategy: string | null;
  cameraMotionStyle: string | null;
  compositionStyle: string | null;
  spatialStrategy: string | null;

  // 光色与声音
  lightingStyle: string | null;
  colorStrategy: string | null;
  soundStrategy: string | null;
  silenceStrategy: string | null;
  editingRhythmStrategy: string | null;

  // 连续性约束
  continuityConstraints: Record<string, unknown> | null;
  characterStateConstraints: Record<string, unknown> | null;
  costumeStateConstraints: Record<string, unknown> | null;
  propStateConstraints: Record<string, unknown> | null;
  locationStateConstraints: Record<string, unknown> | null;

  // 决策溯源
  whyThisChoice: string | null;
  alternativeRejectedReason: string | null;

  // 质量与证据
  qualityScore: number | null;
  confidence: number | null;
  evidenceRef: string | null;


  createdAt: Date;
  updatedAt: Date;
}

/** FilmIR 创建输入（对齐 Prisma CreateInput）*/
export interface FilmIRCreateInput {
  id?: string;
  sceneId?: string | null;
  projectId: string;
  plannerVersion?: string;
  status?: FilmIRStatus;
  sourceText?: string | null;
  sourceContextSummary?: string | null;
  dramaticFunction?: string | null;
  dramaticGoal?: string | null;
  emotionalTarget?: string | null;
  tensionCurve?: string | null;
  povCharacter?: string | null;
  audienceInformationMode?: string | null;
  relationshipBefore?: string | null;
  relationshipAfter?: string | null;
  visualStrategy?: string | null;
  blockingStrategy?: string | null;
  shotPattern?: string | null;
  avgShotLengthSec?: number | null;
  cameraDistanceStrategy?: string | null;
  cameraAngleStrategy?: string | null;
  cameraMotionStyle?: string | null;
  compositionStyle?: string | null;
  spatialStrategy?: string | null;
  lightingStyle?: string | null;
  colorStrategy?: string | null;
  soundStrategy?: string | null;
  silenceStrategy?: string | null;
  editingRhythmStrategy?: string | null;
  continuityConstraints?: Record<string, unknown> | null;
  characterStateConstraints?: Record<string, unknown> | null;
  costumeStateConstraints?: Record<string, unknown> | null;
  propStateConstraints?: Record<string, unknown> | null;
  locationStateConstraints?: Record<string, unknown> | null;
  whyThisChoice?: string | null;
  alternativeRejectedReason?: string | null;
  qualityScore?: number | null;
  confidence?: number | null;
  evidenceRef?: string | null;
}

/** Prisma 模型代理接口（对齐 Prisma delegate 方法签名）*/
export interface FilmIRDelegate {
  findUnique(args: { where: { id: string } | { sceneId_plannerVersion?: { sceneId: string; plannerVersion: string } } }): Promise<FilmIRRecord | null>;
  findFirst(args: { where?: Partial<FilmIRRecord>; orderBy?: Record<string, 'asc' | 'desc'> }): Promise<FilmIRRecord | null>;
  findMany(args?: { where?: Partial<FilmIRRecord>; orderBy?: Record<string, 'asc' | 'desc'>; take?: number; skip?: number }): Promise<FilmIRRecord[]>;
  create(args: { data: FilmIRCreateInput }): Promise<FilmIRRecord>;
  update(args: { where: { id: string }; data: Partial<FilmIRCreateInput> }): Promise<FilmIRRecord>;
  upsert(args: { where: { id: string }; create: FilmIRCreateInput; update: Partial<FilmIRCreateInput> }): Promise<FilmIRRecord>;
  delete(args: { where: { id: string } }): Promise<FilmIRRecord>;
  count(args?: { where?: Partial<FilmIRRecord> }): Promise<number>;
}

/**
 * Prisma Client 扩展声明（module augmentation）
 *
 * 扩展 'database' 包导出的 PrismaClient，新增 P1 Film IR Layer 的模型属性。
 * 当 prisma generate 正常执行后，此声明由 generated index.d.ts 自动合并。
 */
declare module 'database' {
  interface PrismaClient {
    /** Film IR 导演中间语言（P1 新增）*/
    readonly filmIR: FilmIRDelegate;
  }
}
