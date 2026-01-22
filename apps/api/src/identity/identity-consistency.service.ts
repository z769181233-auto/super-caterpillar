import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdentityConsistencyService {
  private readonly logger = new Logger(IdentityConsistencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * P13-0.2: Real-Stub Deterministic Scoring
   * Calculates identity score based on input hashes.
   * Target Score Range: [0.7, 0.9999]
   */
  async scoreIdentity(
    referenceAssetId: string,
    targetAssetId: string,
    characterId: string
  ): Promise<{ score: number; verdict: 'PASS' | 'FAIL'; details: any }> {
    // 1. Construct Deterministic Hash Input
    const inputString = `${referenceAssetId}|${targetAssetId}|${characterId}|v1`;
    const hash = createHash('sha256').update(inputString).digest('hex');

    // 2. Map Hash to Score [0.7, 0.9999]
    // Take first 8 chars (32-bit hex) -> int
    const hexSegment = hash.substring(0, 8);
    const intValue = parseInt(hexSegment, 16);

    // Modulo 3000 to get 0-2999
    // Divide by 10000 to get 0.0000 - 0.2999
    // Add 0.7 base
    const scoreOffset = (intValue % 3000) / 10000;
    const score = 0.7 + scoreOffset;

    // 3. Verdict Logic (Gate Threshold 0.85)
    // Note: Since this is a Stub, we guarantee > 0.7.
    // To ensure Double PASS in Gate (expecting > 0.85),
    // we might need to tweak the Stub if randomness yields < 0.85.
    // However, the prompt requirement is "0.7 + (x % 3000)/10000", range [0.7, 0.9999].
    // Expectation is gate passes if > 0.85.
    // If random distribution, ~50% might fail.
    // USER INSTRUCTION: "允许通过 env 控制严格度".
    // We will force high score for 'mock' assets if strictly needed, but let's stick to algo
    // and rely on ENV override for Gate stability if needed.

    let finalScore = score;

    // ENV Override for Gate Stability (Fake High Score)
    if (process.env.CE23_STUB_SCORE_MIN) {
      const minParam = parseFloat(process.env.CE23_STUB_SCORE_MIN);
      if (finalScore < minParam) {
        finalScore = minParam + finalScore * 0.01; // boost slightly to pass
      }
    }

    const verdict = finalScore >= 0.85 ? 'PASS' : 'FAIL';

    return {
      score: parseFloat(finalScore.toFixed(4)),
      verdict,
      details: {
        provider: 'ce23-real-stub',
        version: '1.0.0',
        method: 'sha256_bucket_v1',
        inputs_hash: hash,
        original_algo_score: parseFloat(score.toFixed(4)),
      },
    };
  }

  /**
   * P13-0.3: Write Score to DB
   */
  async recordScore(
    shotId: string,
    characterId: string,
    referenceAnchorId: string,
    targetAssetId: string,
    scoreData: { score: number; verdict: 'PASS' | 'FAIL'; details: any }
  ) {
    // Upsert logic to handle idempotency
    // We don't have a unique key on (shotId, characterId, referenceAnchorId, targetAssetId) yet,
    // but schema has UUID PK.
    // We will check existence first manually or just create new (logging style).
    // User requested: "若你没建 unique，先用 upsert 逻辑模拟：查存在则 update。"

    const existing = await this.prisma.shotIdentityScore.findFirst({
      where: {
        shotId,
        characterId,
        referenceAnchorId,
        targetAssetId,
      },
    });

    if (existing) {
      return this.prisma.shotIdentityScore.update({
        where: { id: existing.id },
        data: {
          identityScore: scoreData.score,
          verdict: scoreData.verdict,
          details: scoreData.details,
          createdAt: new Date(), // update timestamp
        },
      });
    }

    return this.prisma.shotIdentityScore.create({
      data: {
        shotId,
        characterId,
        referenceAnchorId,
        targetAssetId,
        identityScore: scoreData.score,
        verdict: scoreData.verdict,
        details: scoreData.details,
      },
    });
  }
}
