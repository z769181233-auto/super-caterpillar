#!/bin/bash
set -e
git config core.logAllRefUpdates false
git add apps/api/src/cost/cost-ledger.service.ts apps/workers/src/processors/timeline-render.processor.ts
git commit -m "fix(gate11): make timeline audio fallback and ledger non-blocking"
git push origin HEAD:chore/trigger-workflows
git rev-parse HEAD
git ls-remote origin refs/heads/chore/trigger-workflows
gh run list --limit 5
