#!/bin/bash
set -e

# Gate: Cost Budget Enforcement (Phase G3)
# Assert totalCostUnits <= budgetEpisodeCU
# Usage: ./gate-cost-budget.sh <cost_estimate.json> [budget_file.json]

ESTIMATE_JSON=${1:-"docs/_evidence/phase_g3/E0001/cost_estimate.json"}
BUDGET_FILE=${2:-"docs/budgets/season_01_budget.json"}
EVI_DIR=$(dirname "$ESTIMATE_JSON")
REPORT_OUT="$EVI_DIR/cost_budget_report.json"

echo "=== Gate: Cost Budget Enforcement Started ==="
echo "Target Estimate: $ESTIMATE_JSON"
echo "Budget File:     $BUDGET_FILE"

if [ ! -f "$ESTIMATE_JSON" ]; then
    echo "❌ FAIL: Estimate file not found at $ESTIMATE_JSON"
    exit 1
fi
if [ ! -f "$BUDGET_FILE" ]; then
    echo "❌ FAIL: Budget file not found at $BUDGET_FILE"
    exit 1
fi

node -e "
const fs = require('fs');
const estimate = JSON.parse(fs.readFileSync('$ESTIMATE_JSON', 'utf8'));
const budget = JSON.parse(fs.readFileSync('$BUDGET_FILE', 'utf8'));

console.log('--- Cost Audit ---');
console.log('Episode ID:', estimate.episodeId);
console.log('Total Cost:', estimate.totalCostUnits, budget.costUnitCurrency);
console.log('Budget Cap:', budget.budgetEpisodeCostUnits, budget.costUnitCurrency);

const diff = budget.budgetEpisodeCostUnits - estimate.totalCostUnits;
const passed = diff >= 0;

const report = {
    timestamp: new Date().toISOString(),
    episodeId: estimate.episodeId,
    totalCostUnits: estimate.totalCostUnits,
    budgetLimit: budget.budgetEpisodeCostUnits,
    diff: diff,
    currency: budget.costUnitCurrency,
    status: passed ? 'PASS' : 'FAIL'
};

fs.writeFileSync('$REPORT_OUT', JSON.stringify(report, null, 2));

if (!passed) {
    console.error('❌ FAIL: Budget Exceeded by ' + Math.abs(diff).toFixed(2) + ' ' + budget.costUnitCurrency);
    
    // Sort templates by cost to show top spenders
    const breakdown = Object.entries(estimate.breakdownByTemplateId)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.costUnits - a.costUnits);
        
    console.error('--- Top Spenders ---');
    breakdown.slice(0, 3).forEach(t => {
        console.error(\`\${t.id}: \${t.costUnits.toFixed(1)} CU (\${t.count} shots, \${t.frames} frames)\`);
    });
    
    process.exit(1);
} else {
    console.log('✅ SUCCESS: Within Budget (Margin: ' + diff.toFixed(2) + ' ' + budget.costUnitCurrency + ')');
}
"

echo "Report generated: $REPORT_OUT"
echo "=== Gate Completed ==="
