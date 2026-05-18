const SCENE_CANDIDATE_BLOCKER_PATTERNS = [
  /No usable scene candidates found/i,
  /usable scene candidates below threshold/i,
  /coverageReport\.sceneCandidates/i,
  /scene candidate evidence/i,
];

export function formatStudioGenerationError(errorMessage: string, targetLabel: string): string {
  const normalized = errorMessage.trim();
  if (!normalized) {
    return `${targetLabel}生成失败，但接口没有返回错误详情。`;
  }

  const isSceneCandidateBlocker = SCENE_CANDIDATE_BLOCKER_PATTERNS.some((pattern) =>
    pattern.test(normalized)
  );
  if (!isSceneCandidateBlocker) return normalized;

  return [
    `${targetLabel}已被小说分析质量门禁阻断，不是页面卡住。`,
    '原因：当前小说分析结果缺少可追踪的中/高置信度 scene candidates，不能继续把章节摘要或旧数据伪装成正式 Studio 产物。',
    '下一步：回到小说分析质量链路，补足章节拆分、人物抽取、场景抽取、对白块、动作块和 scene candidates 后再重试。',
    '原始接口原因：',
    normalized,
  ].join('\n');
}
