import type { FilmIR, FilmIRStatus, Prisma } from './generated/prisma';

// Keep a stable compatibility surface for callers while delegating the source
// of truth to the generated Prisma client types.
export type { FilmIRStatus };
export type FilmIRRecord = FilmIR;
export type FilmIRCreateInput = Prisma.FilmIRCreateInput;
export type FilmIRDelegate = Prisma.FilmIRDelegate;
