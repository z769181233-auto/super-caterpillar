#!/bin/bash
# Nightly Batch Production & Quality Audit
# Process all stories in season_01 and generate report

STORY_DIR="docs/story_bank/season_01"
OUTPUT_DIR="docs/story_bank/season_01/produced"
EVI_DIR="docs/_evidence/nightly_$(date +%Y%m%d)"
mkdir -p "$OUTPUT_DIR" "$EVI_DIR"

echo "=== Nightly Batch Production Started ==="
REPORT_FILE="$EVI_DIR/nightly_report.csv"
echo "Episode,P0_Status,P1_Score,Deductions" > "$REPORT_FILE"

TOTAL_P1=0
COUNT=0
FAIL_P0=0

for story in "$STORY_DIR"/*.story.json; do
    ename=$(basename "$story" .story.json)
    echo "Processing $ename..."
    
    SKELETON="$OUTPUT_DIR/${ename}_skeleton.shot.json"
    FINAL_SPEC="$OUTPUT_DIR/${ename}_full.shot.json"
    
    # 1. Compile
    node tools/script_compiler/story_to_shot_skeleton.js "$story" "$SKELETON" > /dev/null
    
    # 2. Fill (Mock Agent)
    node tools/script_compiler/writer_mock.js fill "$SKELETON" "$FINAL_SPEC" > /dev/null
    
    # 3. P0 Lint
    export EVI="$EVI_DIR/$ename"
    mkdir -p "$EVI"
    if node tools/script_gates/p0_lint.js "$FINAL_SPEC" > /dev/null 2>&1; then
        P0_STAT="PASS"
    else
        P0_STAT="FAIL"
        ((FAIL_P0++))
    fi
    
    # 4. P1 Scorecard
    if [ "$P0_STAT" == "PASS" ]; then
        node tools/script_gates/p1_scorecard.js "$FINAL_SPEC" > /dev/null 2>&1
        SCORE=$(grep "\"totalScore\"" "$EVI/scorecard.json" | awk -F: '{print $2}' | tr -d ' ,')
        DEDS=$(grep "\"msg\"" "$EVI/scorecard.json" | wc -l)
        TOTAL_P1=$(echo "$TOTAL_P1 + $SCORE" | bc)
    else
        SCORE="N/A"
        DEDS="N/A"
    fi
    
    echo "$ename,$P0_STAT,$SCORE,$DEDS" >> "$REPORT_FILE"
    ((COUNT++))
done

AVG_P1=$(echo "scale=2; $TOTAL_P1 / ($COUNT - $FAIL_P0)" | bc)

echo "=== Summary ==="
echo "Total processed: $COUNT"
echo "P0 Fails: $FAIL_P0"
echo "Avg P1 Score (among P0 Passed): $AVG_P1"
echo "Report saved to $REPORT_FILE"

# Final Status
if [ $FAIL_P0 -eq 0 ] && (( $(echo "$AVG_P1 >= 9" | bc -l) )); then
    echo "✅ NIGHTLY QUALITY PASS"
    exit 0
else
    echo "❌ NIGHTLY QUALITY ALERT"
    exit 1
fi
