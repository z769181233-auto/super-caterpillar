import { Prisma, JobStatus, JobType, TaskStatus, TaskType } from 'database';

export type JobStatusType = JobStatus;
export type JobTypeType = JobType;
export type TaskStatusType = TaskStatus;
export type TaskTypeType = TaskType;

export type ShotJobWithShotHierarchy = Prisma.ShotJobGetPayload<{
    include: {
        task: true;
        shot: {
            include: {
                scene: {
                    include: {
                        episode: {
                            include: {
                                season: {
                                    include: {
                                        project: true;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
}>;
