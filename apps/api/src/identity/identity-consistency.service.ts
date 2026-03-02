import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { ppv64FromImage, cosine } from './ppv64';
import { nodeSharpDecoder } from './image-decoder';
import { ProjectResolver } from '../common/project-resolver';

@Injectable()
export class IdentityConsistencyService {
  private readonly logger = new Logger(IdentityConsistencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
    private readonly projectResolver: ProjectResolver
  ) { }

  /**
   * P15-0: Score routing based on Feature Flag
   */
  async scoreIdentity(
    referenceAssetId: string,
    targetAssetId: string,
    characterId: string,
    shotId?: string
  ): Promise<{ score: number; verdict: 'PASS' | 'FAIL'; details: any }> {
    // 1. Check Feature Flag (ce23RealEnabled)
    // P16-2: Secondary Kill Switch Guard
    if (process.env.CE23_REAL_FORCE_DISABLE === '1') {
      this.logger.warn(
        `[P16-2] Real Scoring BLOCKED by CE23_REAL_FORCE_DISABLE in IdentityConsistencyService`
      );
      return this.scoreIdentityStub(referenceAssetId, targetAssetId, characterId);
    }

    let realEnabled = false;
    if (shotId) {
      const shotData = await this.prisma.shot.findUnique({
        where: { id: shotId },
        include: {
          scene: {
            include: {
              episode: true,
            },
          },
        },
      });
      const projectWithSettings = await this.projectResolver.resolveProjectNeedSettings(
        shotData?.scene?.episode
      );
      const settings = (projectWithSettings?.settingsJson as any) || {};
      realEnabled = !!settings.ce23RealEnabled;
    }

    if (realEnabled) {
      this.logger.log(`Using REAL Identity Scoring for shot ${shotId}`);
      return this.scoreIdentityReal(referenceAssetId, targetAssetId, characterId);
    }

    // Fallback to existing Stub
    return this.scoreIdentityStub(referenceAssetId, targetAssetId, characterId);
  }

  /**
   * P15-0: Real Identity Scoring (PPV-64)
   */
  async scoreIdentityReal(
    referenceAssetId: string,
    targetAssetId: string,
    characterId: string
  ): Promise<{ score: number; verdict: 'PASS' | 'FAIL'; details: any }> {
    try {
      // 1. Get Asset Details
      const [refAsset, tarAsset] = await Promise.all([
        this.prisma.asset.findUnique({ where: { id: referenceAssetId } }),
        this.prisma.asset.findUnique({ where: { id: targetAssetId } }),
      ]);

      if (!refAsset || !tarAsset) {
        throw new Error('Asset not found for REAL identity scoring');
      }

      // 2. Resolve Paths
      const refPath = this.storage.getAbsolutePath(refAsset.storageKey);
      const tarPath = this.storage.getAbsolutePath(tarAsset.storageKey);

      // 3. Extract PPV-64
      const [refPpv, tarPpv] = await Promise.all([
        ppv64FromImage(refPath, nodeSharpDecoder),
        ppv64FromImage(tarPath, nodeSharpDecoder),
      ]);

      // 4. Calculate Cosine & Map to [0, 1]
      const cosVal = cosine(refPpv.vec, tarPpv.vec);
      const score = (cosVal + 1) / 2; // (cos + 1) / 2 mapping
      const verdict = score >= 0.8 ? 'PASS' : 'FAIL';

      return {
        score: parseFloat(score.toFixed(4)),
        verdict,
        details: {
          provider: 'real-embed-v1',
          algo_version: 'ppv64@v1',
          dims: 64,
          score_mapping: '(cos+1)/2',
          embedding_hash: tarPpv.embeddingHash,
          anchor_file_sha256: refPpv.fileSha256,
          target_file_sha256: tarPpv.fileSha256,
          cosine_raw: parseFloat(cosVal.toFixed(4)),
        },
      };
    } catch (err) {
      this.logger.error(`REAL Identity Scoring failed: ${err.message}`, err.stack);
      // Fallback to stub on algorithm error in production to avoid hard block
      return this.scoreIdentityStub(referenceAssetId, targetAssetId, characterId);
    }
  }

  /**
   * P13-0.2: Real-Stub Deterministic Scoring
   */
  async scoreIdentityStub(
    referenceAssetId: string,
    targetAssetId: string,
    characterId: string
  ): Promise<{ score: number; verdict: 'PASS' | 'FAIL'; details: any }> {
    const inputString = `${referenceAssetId}|${targetAssetId}|${characterId}|v1`;
    const hash = createHash('sha256').update(inputString).digest('hex');
    const hexSegment = hash.substring(0, 8);
    const intValue = parseInt(hexSegment, 16);
    const scoreOffset = (intValue % 3000) / 10000;
    const score = 0.7 + scoreOffset;

    let finalScore = score;
    if (process.env.CE23_STUB_SCORE_MIN) {
      const minParam = parseFloat(process.env.CE23_STUB_SCORE_MIN);
      if (finalScore < minParam) {
        finalScore = minParam + finalScore * 0.01;
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
          createdAt: new Date(),
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
