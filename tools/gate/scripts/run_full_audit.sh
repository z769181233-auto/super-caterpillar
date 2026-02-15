#!/bin/bash
PROJECT_ROOT="$(pwd)"
TIMESTAMP=$(date +%s)
AUDIT_REPORT="docs/FULL_EXCEPTION_AUDIT_$TIMESTAMP.md"

echo "# Full System Exception Audit Report" > "$AUDIT_REPORT"
echo "Generated: $(date)" >> "$AUDIT_REPORT"
echo "------------------------------------" >> "$AUDIT_REPORT"

# Run all gates
bash ./tools/gate/run_launch_gates.sh 2>&1 | tee audit_gate_run.log

# Extract failures from report
echo "## Gate Failures" >> "$AUDIT_REPORT"
if [ -f docs/GATEKEEPER_VERIFICATION_REPORT.md ]; then
    grep -E "❌|FAILED|Timeout" docs/GATEKEEPER_VERIFICATION_REPORT.md >> "$AUDIT_REPORT" || echo "No failures in report" >> "$AUDIT_REPORT"
else
    echo "GATEKEEPER_VERIFICATION_REPORT.md not found" >> "$AUDIT_REPORT"
fi

echo "" >> "$AUDIT_REPORT"
echo "## Exception & Error Log Analysis" >> "$AUDIT_REPORT"

echo "### API Errors" >> "$AUDIT_REPORT"
grep -Ei "error|exception|fail" api_audit.log | tail -n 20 >> "$AUDIT_REPORT" || echo "No API errors" >> "$AUDIT_REPORT"

echo "### Worker Errors" >> "$AUDIT_REPORT"
grep -Ei "error|exception|fail" worker_audit.log | tail -n 20 >> "$AUDIT_REPORT" || echo "No Worker errors" >> "$AUDIT_REPORT"

echo "### Database Schema Anomalies" >> "$AUDIT_REPORT"
# Check for any unexpected columns or missing V3.0 columns again
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/scu"
psql "$DATABASE_URL" -c "\d novel_scenes" >> "$AUDIT_REPORT"

echo "Report generated at $AUDIT_REPORT"
