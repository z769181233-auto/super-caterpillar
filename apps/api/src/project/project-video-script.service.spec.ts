import {
  buildVideoScriptFields,
  isScriptableNovelShotText,
} from './project-video-script.service';

describe('ProjectVideoScriptService helpers', () => {
  it('builds readable video script fields from novel source text', () => {
    const result = buildVideoScriptFields({
      projectName: '测试项目',
      sceneTitle: '雨夜街口',
      sceneSummary: '主角发现线索',
      shotTitle: '主角回头',
      sourceText: '雨水打在霓虹灯牌上，主角听见身后传来脚步声。“谁在那里？”',
      index: 2,
    });

    expect(result.visualDescription).toContain('雨夜街口');
    expect(result.visualDescription).toContain('雨水打在霓虹灯牌上');
    expect(result.actionDescription).toContain('主角听见身后传来脚步声');
    expect(result.dialogueContent).toBe('谁在那里？');
    expect(result.cameraMovement).toBeTruthy();
    expect(result.cameraAngle).toBeTruthy();
    expect(result.lightingPreset).toBeTruthy();
    expect(result.durationSeconds).toBeGreaterThanOrEqual(4);
    expect(result.productionScript.sceneBeat).toContain('推进行动');
    expect(result.productionScript.characterBlocking).toContain('主要角色');
    expect(result.productionScript.artDirection).toContain('雨夜街口');
    expect(result.productionScript.soundDesign).toContain('环境层');
    expect(result.productionScript.editNote).toContain('剪辑节奏');
    expect(result.productionScript.continuity).toContain('连续性检查');
    expect(result.productionScript.productionRemark).toContain('动画分镜脚本');
  });

  it('falls back to scene context when shot source text is missing', () => {
    const result = buildVideoScriptFields({
      projectName: '测试项目',
      sceneTitle: '空场',
      sceneSummary: '角色进入大厅寻找线索',
      index: 1,
    });

    expect(result.visualDescription).toContain('角色进入大厅寻找线索');
    expect(result.actionDescription).toContain('角色进入大厅寻找线索');
    expect(result.dialogueContent).toBeNull();
    expect(result.productionScript.sceneBeat).toContain('建立情境');
  });

  it('builds production blocking from scene characters', () => {
    const result = buildVideoScriptFields({
      projectName: '测试项目',
      sceneTitle: '宫门前',
      sceneSummary: '女主准备离开',
      sourceText: '女主攥紧包袱，回头看向追来的侍卫。',
      characters: ['女主', '侍卫'],
      index: 1,
    });

    expect(result.productionScript.characterBlocking).toContain('女主');
    expect(result.productionScript.characterBlocking).toContain('侍卫');
    expect(result.productionScript.performanceNote).toContain('女主');
  });

  it('rejects novel metadata as scriptable shot source', () => {
    expect(isScriptableNovelShotText('本书名称:表姑娘又又又又跑了')).toBe(false);
    expect(isScriptableNovelShotText('本书作者:狗柱')).toBe(false);
    expect(isScriptableNovelShotText('第 1 章')).toBe(false);
    expect(isScriptableNovelShotText('萧昀祈站在窗下，抬头看向屋檐外的雨。')).toBe(true);
  });
});
