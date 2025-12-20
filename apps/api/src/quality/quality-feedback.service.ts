/**
 * QualityFeedbackService
 * 质量反馈服务，提供质量评分的聚合分析功能
 * 
 * 职责：
 * - 对 QualityScoreRecord 列表进行聚合分析
 * - 只读聚合，不写入数据库
 */

import { Injectable } from '@nestjs/common';
import { QualityScoreRecord } from '@scu/shared-types';

export interface QualityFeedbackResult {
  avgScore: number | null;
  avgConfidence: number | null;
  total: number;
}

@Injectable()
export class QualityFeedbackService {
  /**
   * 评估质量评分记录列表
   * @param records QualityScoreRecord 列表
   * @returns QualityFeedbackResult
   */
  evaluateQualityScores(records: QualityScoreRecord[]): QualityFeedbackResult {
    if (!records || records.length === 0) {
      return { avgScore: null, avgConfidence: null, total: 0 };
    }

    let scoreSum = 0;
    let scoreCount = 0;
    let confSum = 0;
    let confCount = 0;

    for (const r of records) {
      if (r.quality?.score != null) {
        scoreSum += r.quality.score;
        scoreCount++;
      }
      if (r.quality?.confidence != null) {
        confSum += r.quality.confidence;
        confCount++;
      }
    }

    return {
      avgScore: scoreCount ? scoreSum / scoreCount : null,
      avgConfidence: confCount ? confSum / confCount : null,
      total: records.length,
    };
  }
}

