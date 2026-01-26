const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../../');
const SSOT_PATH = path.join(ROOT_DIR, 'docs/ENGINE_SEAL_MATRIX_SSOT.md');
const TEMPLATE_DIR = path.join(__dirname, 'templates');
const OUTPUT_DIR = path.join(ROOT_DIR, 'tools/gate/gates');

/**
 * 极简模板引擎，支持 {{key}} 和简单的 {% if %}
 */
function render(template, data) {
  let res = template;

  // 处理 {% if ... %} ... {% endif %}
  // 仅支持简单的相等判断或布尔值判断
  res = res.replace(/{% if (.*?) %}([\s\S]*?){% endif %}/g, (match, condition, content) => {
    let shouldRender = false;
    const parts = condition.trim().split(/\s*==\s*/);
    if (parts.length === 2) {
      const key = parts[0];
      const val = parts[1].replace(/['"]/g, '');
      shouldRender = String(data[key]) === val;
    } else {
      shouldRender = !!data[condition.trim()];
    }
    return shouldRender ? content : '';
  });

  // 处理 {{key}}
  res = res.replace(/{{(.*?)}}/g, (match, key) => {
    const k = key.trim();
    return data[k] !== undefined ? data[k] : match;
  });

  return res;
}

function parseSSOT() {
  const content = fs.readFileSync(SSOT_PATH, 'utf-8');
  const lines = content.split('\n');
  const sections = { sealed: [], backlog: [] }; // backlog kept for compat but will be empty from SSOT
  let scanningSealed = false;

  for (const line of lines) {
    if (line.includes('## 2.1 已封板真实生产引擎')) {
      scanningSealed = true;
      continue;
    }
    if (line.includes('## 2.2')) {
      scanningSealed = false;
      continue;
    }

    if (scanningSealed && line.startsWith('|') && line.includes('|') && !line.includes('----')) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c !== '');
      if (cells[0] === '领域' || cells[0] === '领域名') continue;

      // Schema: | 领域 | 引擎 Key | Gate 脚本 | 状态 | 说明 |
      // Index:     0        1          2       3      4
      if (cells.length >= 5) {
        const status = cells[3];
        const engineKey = cells[1].replace(/`/g, '');

        // FAIL-FAST: 2.1 区必须全 sealed
        if (!status.includes('SEALED')) {
          throw new Error(`[Security] CRITICAL: Found NON-SEALED item in '2.1 Sealed' section: ${engineKey} (Status: ${status}). Move it to 2.2 Roadmap!`);
        }

        sections.sealed.push({
          area: cells[0],
          engineKey: engineKey,
          gateScript: cells[2].replace(/`/g, ''),
          status: status,
          // Mapped for template compatibility
          phase: 'p0-rX', // Auto-filled mock, or parse from script name if needed? 
          // Previous parser extracted phase from cells[3] but schema changed?
          // Let's re-read the SSOT content carefully.
          // The SSOT has: | Area | Key | Gate | Status | Desc |
          // Old code assumed: | Area | Key | JobType | Phase | SealLevel | Gate | Status |
          // Wait, the file I read in step 2233 shows:
          // | 领域   | 引擎 Key                 | Gate 脚本                               | 状态      | 说明                 |
          // This matches my new schema logic. However, existing template needs 'phase', 'sealLevel'.
          // We need to extract phase from Gate Script name (e.g. gate-p0-r1_...)
        });
      }
    }
  }

  // Post-process to extract metadata from Gate Script Name if possible, to keep template working
  sections.sealed = sections.sealed.map(item => {
    // gate-p0-r1_ce02_ce06_real.sh -> phase=P0-R1
    const match = item.gateScript.match(/gate-(p\d+-r\d+)_/i);
    const phase = match ? match[1].toUpperCase() : 'UNKNOWN';
    return {
      ...item,
      phase,
      sealLevel: 'L2', // Forced by 2.1 definition
      jobType: 'Real'  // Default
    };
  });

  return sections;
}

const payloadTemplates = {
  ce01_prompt_gen: '{"rawText": "测试文本"}',
  audio_gen: '{"text": "你好，世界", "voice": "zh-CN-Standard-A"}',
  ce09_security_check: '{"content": "敏感词测试"}',
  shot_render: '{"jobId": "${JOB_ID}", "model": "sd15"}',
  ce06_novel_parsing: '{"structured_text": "测试数据"}',
  ce03_visual_density: '{"structured_text": "测量视觉密度"}',
  ce04_visual_enrichment: '{"structured_text": "扩写提示词"}',
  video_merge: '{"jobId": "${JOB_ID}", "framePaths": ["/tmp/f1.png"]}',
};

const idempotencyAsserts = {
  video_merge: `URI1=$(echo "\${RESP}" | jq -r '.data.output.asset.uri')
URI2=$(echo "\${RESP2}" | jq -r '.data.output.asset.uri')
if [ "\${URI1}" != "\${URI2}" ]; then echo "❌ FAIL: Idempotency broken"; write_exit_code 14; exit 14; fi`,
  default: `RUN1=$(echo "\${RESP}" | jq -r '.data.output | tostring')
RUN2=$(echo "\${RESP2}" | jq -r '.data.output | tostring')
if [ "\${RUN1}" != "\${RUN2}" ]; then echo "❌ FAIL: Idempotency broken"; write_exit_code 14; exit 14; fi`,
};

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const outDir = process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : OUTPUT_DIR;

  console.log(`--- Seal Factory Starting (dryRun=${dryRun}) ---`);
  const { sealed, backlog } = parseSSOT();
  const template = fs.readFileSync(path.join(TEMPLATE_DIR, 'gate_v2h.sh.tpl'), 'utf-8');

  const allEngines = [...sealed, ...backlog];

  allEngines.forEach((eng) => {
    if (eng.status.includes('SEALED') && !dryRun) {
      console.log(`Skipping already sealed engine: ${eng.engineKey}`);
      return;
    }

    const phase_slug = eng.phase.toLowerCase().replace(/-/g, '_');
    const data = {
      phase: eng.phase,
      engineKey: eng.engineKey,
      sealLevel: eng.sealLevel,
      phase_slug: phase_slug,
      ts: '$(date +"%Y%m%d_%H%M%S")',
      payloadTemplate: payloadTemplates[eng.engineKey] || '{"test": true}',
      idempotencyAssert: idempotencyAsserts[eng.engineKey] || idempotencyAsserts['default'],
    };

    const rendered = render(template, data);
    const fileName = `gate-${eng.phase.toLowerCase()}_ce02_${eng.engineKey.replace(/_/g, '_')}_real.sh`;

    if (dryRun) {
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, fileName), rendered);
      console.log(`[DryRun] Generated: ${fileName}`);
    } else {
      const targetPath = path.join(outDir, fileName);
      // Only write if doesn't exist or is backlog
      if (!fs.existsSync(targetPath) || !eng.status.includes('SEALED')) {
        fs.writeFileSync(targetPath, rendered, { mode: 0o755 });
        console.log(`Generated: ${fileName}`);
      }
    }
  });

  console.log('--- Seal Factory Finished ---');
}

main();
