import { Prisma } from 'database';

/**
 * Shot Job with full scene/shot/episode/season/project hierarchy
 */
export const SHOT_JOB_WITH_HIERARCHY = Prisma.validator<Prisma.ShotJobInclude>()({
    task: true,
    shot: {
        include: {
            scene: {
                include: {
                    episode: {
                        include: {
                            season: {
                                include: {
                                    project: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    },
});

/**
 * Shot with full hierarchy for ownership checks
 */
export const SHOT_WITH_HIERARCHY = Prisma.validator<Prisma.ShotInclude>()({
    scene: {
        include: {
            episode: {
                include: {
                    project: true,
                    season: {
                        include: {
                            project: true,
                        },
                    },
                },
            },
        },
    },
});
