import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * P13-2: Mock WAV 生成器
 *
 * 实现 deterministic WAV 文件生成,确保同 seedKey 生成同内容。
 * 用于 GATE_MODE 下的音频资产化测试。
 */

export interface GenerateWavOptions {
  /** 幂等 key: traceId|sceneId|subtype */
  seedKey: string;
  /** 音频时长（秒） */
  durationSec: number;
  /** 正弦波频率数组 (Hz) */
  freqs: number[];
  /** 输出文件路径 */
  outPath: string;
}

export interface GenerateWavResult {
  /** 生成的文件路径 */
  path: string;
  /** SHA256 checksum */
  checksum: string;
  /** 音频时长（秒） */
  durationSec: number;
}

/**
 * 生成 deterministic WAV 文件
 *
 * @param options 生成选项
 * @returns 生成结果（路径、checksum、时长）
 */
export async function generateWav(options: GenerateWavOptions): Promise<GenerateWavResult> {
  const { seedKey, durationSec, freqs, outPath } = options;

  // 确保输出目录存在
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // WAV 参数
  const sampleRate = 44100; // 44.1kHz
  const numChannels = 2; // 立体声
  const bitsPerSample = 16; // 16-bit PCM
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * blockAlign;

  // 使用 seedKey 的 hash 作为随机种子（确保 deterministic）
  const seedHash = crypto.createHash('sha256').update(seedKey, 'utf8').digest();
  let seedValue = seedHash.readUInt32BE(0);

  // 简单的 LCG (Linear Congruential Generator) 伪随机数生成器
  const lcgNext = () => {
    seedValue = (seedValue * 1103515245 + 12345) & 0x7fffffff;
    return seedValue / 0x7fffffff; // 归一化到 [0, 1]
  };

  // 生成 PCM 数据
  const pcmData = Buffer.alloc(dataSize);
  for (let i = 0; i < numSamples; i++) {
    let sampleValue = 0;

    // 混合多个频率的正弦波
    for (const freq of freqs) {
      const t = i / sampleRate;
      const phase = lcgNext() * 2 * Math.PI; // 每个频率随机相位（deterministic）
      sampleValue += Math.sin(2 * Math.PI * freq * t + phase);
    }

    // 归一化到 16-bit 范围 [-32768, 32767]
    const amplitude = 0.3; // 降低音量避免削波
    const normalizedValue = (sampleValue / freqs.length) * amplitude;
    const int16Value = Math.max(-32768, Math.min(32767, Math.floor(normalizedValue * 32767)));

    // 写入双声道（左右声道相同）
    const offset = i * blockAlign;
    pcmData.writeInt16LE(int16Value, offset); // 左声道
    pcmData.writeInt16LE(int16Value, offset + 2); // 右声道
  }

  // 构建 WAV 文件头
  const wavHeader = Buffer.alloc(44);
  let offset = 0;

  // RIFF chunk descriptor
  wavHeader.write('RIFF', offset);
  offset += 4;
  wavHeader.writeUInt32LE(36 + dataSize, offset);
  offset += 4; // ChunkSize
  wavHeader.write('WAVE', offset);
  offset += 4;

  // fmt sub-chunk
  wavHeader.write('fmt ', offset);
  offset += 4;
  wavHeader.writeUInt32LE(16, offset);
  offset += 4; // Subchunk1Size (PCM = 16)
  wavHeader.writeUInt16LE(1, offset);
  offset += 2; // AudioFormat (PCM = 1)
  wavHeader.writeUInt16LE(numChannels, offset);
  offset += 2;
  wavHeader.writeUInt32LE(sampleRate, offset);
  offset += 4;
  wavHeader.writeUInt32LE(sampleRate * blockAlign, offset);
  offset += 4; // ByteRate
  wavHeader.writeUInt16LE(blockAlign, offset);
  offset += 2;
  wavHeader.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data sub-chunk
  wavHeader.write('data', offset);
  offset += 4;
  wavHeader.writeUInt32LE(dataSize, offset);

  // 合并 header + PCM data
  const wavFile = Buffer.concat([wavHeader, pcmData]);

  // 写入文件
  fs.writeFileSync(outPath, wavFile);

  // 计算 checksum
  const checksum = crypto.createHash('sha256').update(wavFile).digest('hex');

  return {
    path: outPath,
    checksum,
    durationSec,
  };
}
