import sharp from 'sharp';

/**
 * PPV-64 (Pixel-Perceptual-Vector) 算法实现
 *
 * 定义：
 * 1. Decode: sharp 读取
 * 2. Preprocess: Grayscale + Resize 8x8 (Lanczos3)
 * 3. Vector: Uint8Array -> Float -> (x-mean)/std -> L2 Normalize
 */

/**
 * 从图像路径提取 64 维特征向量
 * @param filePath 图像物理路径
 */
export async function ppv64FromImage(filePath: string): Promise<number[]> {
  const { data, info } = await sharp(filePath)
    .greyscale()
    .resize(8, 8, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill', // 强制填充 8x8
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (data.length !== 64) {
    throw new Error(`PPV64_INTERNAL_ERROR: Expected 64 bytes, got ${data.length}`);
  }

  const rawVector = Array.from(data) as number[];

  // 1. Z-Score Normalization: (x - mean) / std
  let sum = 0;
  for (const v of rawVector) sum += v;
  const mean = sum / 64;

  let sumSqDiff = 0;
  for (const v of rawVector) sumSqDiff += Math.pow(v - mean, 2);
  const variance = sumSqDiff / 64;
  const std = Math.sqrt(variance) + 1e-6; // 防止除零

  const zNormalized = rawVector.map((x) => (x - mean) / std);

  // 2. L2 Normalization: vector / ||vector||
  let sumSq = 0;
  for (const v of zNormalized) sumSq += v * v;
  const magnitude = Math.sqrt(sumSq) + 1e-6;
  const l2Normalized = zNormalized.map((x) => x / magnitude);

  return l2Normalized;
}

/**
 * 计算两个 PPV-64 向量的相似度 (Cosine Similarity)
 * 映射逻辑: (cosine + 1) / 2 -> [0, 1]
 */
export function ppv64Similarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== 64 || vecB.length !== 64) {
    throw new Error('PPV64_DIMENSION_MISMATCH: Vectors must be 64-dimensional');
  }

  // 由于 vecA 和 vecB 已执行 L2 归一化，点积即为 Cosine 相似度
  const cosine = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);

  // 映射到 [0, 1] 空间，并执行 clamp 防止浮点误差
  const mapped = (cosine + 1) / 2;
  return Math.max(0, Math.min(1, mapped));
}
