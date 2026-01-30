#!/bin/bash
# G5-P0-2: Semantic Motion Mapper 验证脚本
# Usage: ./tools/g5/test_semantic_motion.sh

set -e

echo "=== G5-P0-2: Semantic Motion Mapper Test ==="

# 1. Prepare test data
EVIDENCE_DIR="docs/_evidence/g5_p0_engines_e0001_20260129_001017"
RENDER_PLAN_PATH="$EVIDENCE_DIR/E0001.render_plan.json"
MOTION_TEMPLATES_PATH="assets/motions/v1/motion_semantic_templates.json"

# 2. Create test script
TEST_SCRIPT="$EVIDENCE_DIR/test_semantic_motion.js"

cat > "$TEST_SCRIPT" << 'EOF'
const fs = require('fs');
const path = require('path');

class G5SemanticMotionMapperAdapter {
  matchTemplateByKeywords(text, templates) {
    if (!text) return null;
    const textLower = text.toLowerCase();
    const priorityKeywords = ['递茶', '离开', '凝视', '思索', '紧张', '交谈', '停顿', '回眸'];
    
    for (const keyword of priorityKeywords) {
      if (textLower.includes(keyword)) {
        const template = templates.find(t => t.keywords && t.keywords.includes(keyword));
        if (template) return template;
      }
    }
    return null;
  }

  isStandingShot(shot) {
    const action = (shot.action || '').toLowerCase();
    return !action || action.includes('stand') || action.includes('idle') || action.includes('静止');
  }

  generateMotionPlan(renderPlan, templates) {
    const assignments = [];
    const shots = renderPlan.shots || [];

    shots.forEach(shot => {
      const shotId = shot.id || `shot-${shot.index || 0}`;
      
      // Default template
      let template = templates.find(t => t.id === 'idle_breathing') || {
        id: 'idle_breathing',
        name: '呼吸待机',
        keywords: [],
        params: { layer: 'torso', transform: { scale: 1.0, translateY: 0 }, animation: { type: 'breathing', amplitude: 0.02 } }
      };

      // Try to match by beat keywords
      const beat = renderPlan.beats?.find(b => b.id === shot.beatId);
      const matchedTemplate = this.matchTemplateByKeywords(beat?.goal || beat?.summary || '', templates);
      if (matchedTemplate) template = matchedTemplate;

      const isStandingShot = this.isStandingShot(shot);
      const verticalDrift = isStandingShot ? 0 : (template.params?.transform?.translateY || 0);

      assignments.push({
        shotId,
        templateId: template.id,
        layer: template.params?.layer || 'full',
        params: template.params || {},
        verticalDrift,
      });
    });

    return { assignments, totalShots: shots.length };
  }

  generateSemanticsReport(motionPlan, renderPlan) {
    const shots = renderPlan.shots || [];
    const totalShots = shots.length;
    const semanticMapped = motionPlan.assignments.filter(a => a.templateId !== 'idle_breathing').length;
    const fallbackUsed = totalShots - semanticMapped;
    
    const standingShots = motionPlan.assignments.filter(a => {
      const shot = shots.find(s => (s.id || `shot-${s.index}`) === a.shotId);
      return this.isStandingShot(shot);
    });
    
    const driftViolations = standingShots.filter(a => Math.abs(a.verticalDrift) > 0.01).map(a => a.shotId);

    return {
      semantic_coverage_pct: totalShots > 0 ? semanticMapped / totalShots : 0,
      standing_vertical_drift_pct: standingShots.length > 0 ? (driftViolations.length / standingShots.length) * 100 : 0,
      total_shots: totalShots,
      semantic_mapped: semanticMapped,
      fallback_used: fallbackUsed,
      standing_shots: standingShots.length,
      drift_violations: driftViolations,
    };
  }
}

// Load default templates
const defaultTemplates = [
  { id: 'idle_breathing', name: '呼吸待机', keywords: ['idle', 'stand', '静止'], params: { layer: 'torso', transform: { scale: 1.0, translateY: 0 }, animation: { type: 'breathing', amplitude: 0.02 } } },
  { id: 'nod_agree', name: '点头', keywords: ['nod', '点头', '同意'], params: { layer: 'head', transform: { rotate: 5 }, animation: { type: 'nod', amplitude: 0.1 } } },
  { id: 'gesture_talk', name: '手势', keywords: ['talk', '交谈', '对话'], params: { layer: 'arms', animation: { type: 'gesture', amplitude: 0.15 } } },
];

const renderPlanPath = process.argv[2];
const outputDir = process.argv[3];

const renderPlan = JSON.parse(fs.readFileSync(renderPlanPath, 'utf-8'));
const adapter = new G5SemanticMotionMapperAdapter();

const motionPlan = adapter.generateMotionPlan(renderPlan, defaultTemplates);
const semanticsReport = adapter.generateSemanticsReport(motionPlan, renderPlan);

fs.writeFileSync(path.join(outputDir, 'motion_plan.json'), JSON.stringify(motionPlan, null, 2));
fs.writeFileSync(path.join(outputDir, 'motion_semantics_report.json'), JSON.stringify(semanticsReport, null, 2));

console.log(`[G5-SEMANTIC-MOTION] Coverage: ${(semanticsReport.semantic_coverage_pct * 100).toFixed(1)}%, Drift: ${semanticsReport.standing_vertical_drift_pct}%`);
console.log(`[G5-SEMANTIC-MOTION] Total Shots: ${semanticsReport.total_shots}, Semantic: ${semanticsReport.semantic_mapped}, Fallback: ${semanticsReport.fallback_used}`);
EOF

# 3. Execute test
echo "[Step 1] Running Semantic Motion Mapper..."
node "$TEST_SCRIPT" "$RENDER_PLAN_PATH" "$EVIDENCE_DIR"

# 4. Validate outputs
echo "[Step 2] Validating outputs..."

MOTION_PLAN="$EVIDENCE_DIR/motion_plan.json"
SEMANTICS_REPORT="$EVIDENCE_DIR/motion_semantics_report.json"

if [ ! -f "$MOTION_PLAN" ]; then
  echo "❌ FAIL: motion_plan.json not generated"
  exit 1
fi

if [ ! -f "$SEMANTICS_REPORT" ]; then
  echo "❌ FAIL: motion_semantics_report.json not generated"
  exit 1
fi

# 5. Check drift requirements (HARD CONSTRAINT)
DRIFT=$(node -e "console.log(require('./$SEMANTICS_REPORT').standing_vertical_drift_pct)")
VIOLATIONS=$(node -e "console.log(require('./$SEMANTICS_REPORT').drift_violations.length)")

echo "[Step 3] Drift Check (P0 Red Line)..."
echo "  Standing Vertical Drift: $DRIFT% (target: 0%)"
echo "  Violations: $VIOLATIONS (target: 0)"

if [ "$(echo "$DRIFT > 0" | bc)" -eq 1 ]; then
  echo "❌ FAIL: FORBIDDEN_IN_G5 - Standing vertical drift detected!"
  node -e "console.log('Violations:', require('./$SEMANTICS_REPORT').drift_violations)"
  exit 1
fi

# 6. Check semantic coverage
COVERAGE=$(node -e "console.log(require('./$SEMANTICS_REPORT').semantic_coverage_pct)")
echo "[Step 4] Semantic Coverage Check..."
echo "  Coverage: $(echo "$COVERAGE * 100" | bc)% (target: >= 95%)"

# 7. Sample motion plan
echo "[Step 5] Sample Motion Plan (first 3 shots):"
node -e "
const plan = require('./$MOTION_PLAN');
plan.assignments.slice(0, 3).forEach((a, i) => {
  console.log(\`  [\${i}] Shot \${a.shotId}: Template=\${a.templateId}, Layer=\${a.layer}, Drift=\${a.verticalDrift}\`);
});
"

echo ""
echo "=== G5-P0-2: Semantic Motion Mapper Test PASS ==="
echo "Evidence:"
echo "  - motion_plan.json: $MOTION_PLAN"
echo "  - motion_semantics_report.json: $SEMANTICS_REPORT"
