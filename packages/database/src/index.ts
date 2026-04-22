// ✅ Internal Export: Use locally generated prisma client
export * from './generated/prisma';

// ★ P1 Film IR Layer：手工维护的类型声明（prisma generate 前的本地类型安全保障）
// 当 prisma generate 正常执行后，generated/prisma/index.d.ts 中的类型自动覆盖
export type { FilmIRStatus, FilmIRRecord, FilmIRCreateInput, FilmIRDelegate } from './film-ir-types';

