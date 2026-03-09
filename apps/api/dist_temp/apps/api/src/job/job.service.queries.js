"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOT_WITH_HIERARCHY = exports.SHOT_JOB_WITH_HIERARCHY = void 0;
const database_1 = require("database");
exports.SHOT_JOB_WITH_HIERARCHY = database_1.Prisma.validator()({
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
exports.SHOT_WITH_HIERARCHY = database_1.Prisma.validator()({
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
//# sourceMappingURL=job.service.queries.js.map