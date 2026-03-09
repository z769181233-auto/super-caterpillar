import { PrismaService } from '../prisma/prisma.service';
export interface TrainingConfig {
    minConsistencyScore?: number;
    maxTrainSteps?: number;
    resolution?: number;
    forceRetrain?: boolean;
}
export interface TrainingStatus {
    status: string;
    progress?: number;
    error?: string;
    completedAt?: Date;
}
export declare class LoraTrainingService {
    private prisma;
    private readonly logger;
    private replicate;
    private enabled;
    constructor(prisma: PrismaService);
    submitTraining(characterId: string, trainingImages: Array<{
        imageUrl: string;
        score: number;
    }>, config?: TrainingConfig): Promise<string | null>;
    getTrainingStatus(characterId: string): Promise<TrainingStatus | null>;
    private calculateProgress;
    isEnabled(): boolean;
}
