import { QualityScoreRecord } from '@scu/shared-types';
export interface QualityFeedbackResult {
    avgScore: number | null;
    avgConfidence: number | null;
    total: number;
}
export declare class QualityFeedbackService {
    evaluateQualityScores(records: QualityScoreRecord[]): QualityFeedbackResult;
}
