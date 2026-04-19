import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const exportDir = path.join(cwd, 'apps/api/storage/exports/film_ir_dataset');
const manifestPath = path.join(exportDir, 'manifest.json');
const tracePath = path.join(exportDir, 'review_policy_trace.jsonl');
const analysisPath = path.join(exportDir, 'review_policy_trace_analysis.json');
const diffPath = path.join(exportDir, 'review_policy_trace_diff.json');
const summaryPath = path.join(exportDir, 'review_policy_trace_summary.md');
const statusPath = path.join(exportDir, 'review_policy_trace_ops_status.json');
const historyPath = path.join(exportDir, 'review_policy_trace_history.jsonl');
const alertsPath = path.join(exportDir, 'review_policy_trace_alerts.json');
const trendPanelPath = path.join(exportDir, 'review_policy_trace_trend_panel.md');
const governanceDashboardPath = path.join(exportDir, 'review_policy_trace_governance_dashboard.json');
const governanceDashboardHtmlPath = path.join(exportDir, 'review_policy_trace_governance_dashboard.html');
const notificationPayloadPath = path.join(exportDir, 'review_policy_trace_notification_payload.json');
const governanceOverviewPath = path.join(exportDir, 'review_policy_trace_governance_overview.md');
const thresholdMatrixPath = path.join(exportDir, 'review_policy_trace_threshold_matrix.json');
const portalAppHtmlPath = path.join(exportDir, 'review_policy_trace_portal_app.html');
const consumerBundlePath = path.join(exportDir, 'review_policy_trace_consumer_bundle.json');
const consumerIndexPath = path.join(exportDir, 'review_policy_trace_consumer_index.json');
const latestPointerPath = path.join(exportDir, 'review_policy_trace_latest_pointer.json');
const distributionChannelsPath = path.join(exportDir, 'review_policy_trace_distribution_channels.json');
const consumerFeedPath = path.join(exportDir, 'review_policy_trace_consumer_feed.json');
const atomFeedPath = path.join(exportDir, 'review_policy_trace_atom_feed.xml');
const statusBadgePath = path.join(exportDir, 'review_policy_trace_status_badge.json');
const hostedSiteDir = path.join(exportDir, 'review_policy_trace_pages');
const hostedPortalIndexPath = path.join(hostedSiteDir, 'index.html');
const hostedDashboardPath = path.join(hostedSiteDir, 'governance-dashboard.html');
const hostedFeedPath = path.join(hostedSiteDir, 'consumer-feed.json');
const hostedAtomFeedPath = path.join(hostedSiteDir, 'atom.xml');
const hostedBadgePath = path.join(hostedSiteDir, 'status-badge.json');

const FAIL_THRESHOLDS = {
  min_trace_row_count: 2000,
  min_unique_event_types: 15,
  min_unique_projects: 20,
  min_timeline_event_count: 800,
  min_job_audit_event_count: 1000,
  min_gate_result_linkage_rate: 0.95,
  min_policy_stage_coverage_rate: 0.95,
  min_publish_action_coverage_rate: 0.95,
};

const WARN_THRESHOLDS = {
  min_actor_user_coverage_rate: 0.005,
  min_timeline_semantic_context_count: 150,
  max_negative_trace_row_delta: -1,
  max_negative_timeline_event_delta: -1,
  min_timeline_render_job_success_rate: 0.85,
  min_media_security_job_success_rate: 0.75,
};

const INFO_THRESHOLDS = {
  min_approval_event_project_coverage_rate: 0.85,
  min_timeline_semantic_context_coverage_rate: 0.5,
  min_job_audit_event_density_per_scene: 3,
};

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function parseArgs(argv) {
  return {
    skipExport: argv.includes('--skip-export'),
  };
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
}

function relativeToExportDir(filePath) {
  return path.relative(exportDir, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countJsonlRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) return 0;
  return content.trimEnd().split('\n').length;
}

function increment(map, key) {
  const normalized = typeof key === 'string' && key.length > 0 ? key : 'null';
  map[normalized] = (map[normalized] ?? 0) + 1;
}

function topEntries(record, limit = 10) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, value]) => ({ key, count: value }));
}

function computeRate(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function clampRate(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function min(values) {
  if (!values.length) return 0;
  return Math.min(...values);
}

function max(values) {
  if (!values.length) return 0;
  return Math.max(...values);
}

function loadHistory(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function diffRecord(current, previous) {
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(previous || {})]);
  const delta = {};
  for (const key of keys) {
    const currentValue = Number(current?.[key] ?? 0);
    const previousValue = Number(previous?.[key] ?? 0);
    const change = currentValue - previousValue;
    if (change !== 0) {
      delta[key] = {
        previous: previousValue,
        current: currentValue,
        delta: change,
      };
    }
  }
  return delta;
}

function buildAlert({ key, severity, current, threshold, message }) {
  return {
    key,
    severity,
    current,
    threshold,
    message,
  };
}

function buildAlerts(metrics, governance) {
  const alerts = [];

  if (metrics.trace_row_count < FAIL_THRESHOLDS.min_trace_row_count) {
    alerts.push(
      buildAlert({
        key: 'trace_row_count',
        severity: 'fail',
        current: metrics.trace_row_count,
        threshold: FAIL_THRESHOLDS.min_trace_row_count,
        message: 'review_policy_trace row count dropped below the required minimum.',
      }),
    );
  }
  if (metrics.unique_event_types < FAIL_THRESHOLDS.min_unique_event_types) {
    alerts.push(
      buildAlert({
        key: 'unique_event_types',
        severity: 'fail',
        current: metrics.unique_event_types,
        threshold: FAIL_THRESHOLDS.min_unique_event_types,
        message: 'review_policy_trace event type diversity is below the required minimum.',
      }),
    );
  }
  if (metrics.unique_projects < FAIL_THRESHOLDS.min_unique_projects) {
    alerts.push(
      buildAlert({
        key: 'unique_projects',
        severity: 'fail',
        current: metrics.unique_projects,
        threshold: FAIL_THRESHOLDS.min_unique_projects,
        message: 'review_policy_trace project coverage is below the required minimum.',
      }),
    );
  }
  if (metrics.timeline_event_count < FAIL_THRESHOLDS.min_timeline_event_count) {
    alerts.push(
      buildAlert({
        key: 'timeline_event_count',
        severity: 'fail',
        current: metrics.timeline_event_count,
        threshold: FAIL_THRESHOLDS.min_timeline_event_count,
        message: 'timeline event coverage dropped below the required minimum.',
      }),
    );
  }
  if (metrics.job_audit_event_count < FAIL_THRESHOLDS.min_job_audit_event_count) {
    alerts.push(
      buildAlert({
        key: 'job_audit_event_count',
        severity: 'fail',
        current: metrics.job_audit_event_count,
        threshold: FAIL_THRESHOLDS.min_job_audit_event_count,
        message: 'job audit event coverage dropped below the required minimum.',
      }),
    );
  }
  if (governance.gate_result_linkage_rate < FAIL_THRESHOLDS.min_gate_result_linkage_rate) {
    alerts.push(
      buildAlert({
        key: 'gate_result_linkage_rate',
        severity: 'fail',
        current: governance.gate_result_linkage_rate,
        threshold: FAIL_THRESHOLDS.min_gate_result_linkage_rate,
        message: 'gate result linkage coverage is below the required minimum.',
      }),
    );
  }
  if (governance.policy_stage_coverage_rate < FAIL_THRESHOLDS.min_policy_stage_coverage_rate) {
    alerts.push(
      buildAlert({
        key: 'policy_stage_coverage_rate',
        severity: 'fail',
        current: governance.policy_stage_coverage_rate,
        threshold: FAIL_THRESHOLDS.min_policy_stage_coverage_rate,
        message: 'policy stage coverage is below the required minimum.',
      }),
    );
  }
  if (governance.publish_action_coverage_rate < FAIL_THRESHOLDS.min_publish_action_coverage_rate) {
    alerts.push(
      buildAlert({
        key: 'publish_action_coverage_rate',
        severity: 'fail',
        current: governance.publish_action_coverage_rate,
        threshold: FAIL_THRESHOLDS.min_publish_action_coverage_rate,
        message: 'publish action coverage is below the required minimum.',
      }),
    );
  }
  if (governance.actor_user_coverage_rate < WARN_THRESHOLDS.min_actor_user_coverage_rate) {
    alerts.push(
      buildAlert({
        key: 'actor_user_coverage_rate',
        severity: 'warn',
        current: governance.actor_user_coverage_rate,
        threshold: WARN_THRESHOLDS.min_actor_user_coverage_rate,
        message: 'actor user coverage remains sparse; check whether more human review traces should be captured.',
      }),
    );
  }
  if (metrics.timeline_semantic_context_count < WARN_THRESHOLDS.min_timeline_semantic_context_count) {
    alerts.push(
      buildAlert({
        key: 'timeline_semantic_context_count',
        severity: 'warn',
        current: metrics.timeline_semantic_context_count,
        threshold: WARN_THRESHOLDS.min_timeline_semantic_context_count,
        message: 'timeline semantic context coverage is below the recommended warning threshold.',
      }),
    );
  }
  if (governance.timeline_render_job_success_rate < WARN_THRESHOLDS.min_timeline_render_job_success_rate) {
    alerts.push(
      buildAlert({
        key: 'timeline_render_job_success_rate',
        severity: 'warn',
        current: governance.timeline_render_job_success_rate,
        threshold: WARN_THRESHOLDS.min_timeline_render_job_success_rate,
        message: 'timeline render success rate is below the warning threshold.',
      }),
    );
  }
  if (governance.media_security_job_success_rate < WARN_THRESHOLDS.min_media_security_job_success_rate) {
    alerts.push(
      buildAlert({
        key: 'media_security_job_success_rate',
        severity: 'warn',
        current: governance.media_security_job_success_rate,
        threshold: WARN_THRESHOLDS.min_media_security_job_success_rate,
        message: 'media security success rate is below the warning threshold.',
      }),
    );
  }
  if (governance.approval_event_project_coverage_rate < INFO_THRESHOLDS.min_approval_event_project_coverage_rate) {
    alerts.push(
      buildAlert({
        key: 'approval_event_project_coverage_rate',
        severity: 'info',
        current: governance.approval_event_project_coverage_rate,
        threshold: INFO_THRESHOLDS.min_approval_event_project_coverage_rate,
        message: 'approval event project coverage is below the informational target.',
      }),
    );
  }
  if (governance.timeline_semantic_context_coverage_rate < INFO_THRESHOLDS.min_timeline_semantic_context_coverage_rate) {
    alerts.push(
      buildAlert({
        key: 'timeline_semantic_context_coverage_rate',
        severity: 'info',
        current: governance.timeline_semantic_context_coverage_rate,
        threshold: INFO_THRESHOLDS.min_timeline_semantic_context_coverage_rate,
        message: 'timeline semantic context scene coverage is below the informational target.',
      }),
    );
  }
  if (governance.job_audit_event_density_per_scene < INFO_THRESHOLDS.min_job_audit_event_density_per_scene) {
    alerts.push(
      buildAlert({
        key: 'job_audit_event_density_per_scene',
        severity: 'info',
        current: governance.job_audit_event_density_per_scene,
        threshold: INFO_THRESHOLDS.min_job_audit_event_density_per_scene,
        message: 'job audit density per scene is below the informational target.',
      }),
    );
  }

  return alerts;
}

function selectHistoryWindow(history, windowSize = 7) {
  return history.slice(-windowSize);
}

function renderTrendTable(rows) {
  return [
    '| checked_at | trace_rows | event_types | projects | timeline_events | job_audit_events | actor_user_rate | status |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map(
      (row) =>
        `| ${row.checkedAt} | ${row.metrics.trace_row_count ?? 0} | ${row.metrics.unique_event_types ?? 0} | ${row.metrics.unique_projects ?? 0} | ${row.metrics.timeline_event_count ?? 0} | ${row.metrics.job_audit_event_count ?? 0} | ${row.governance.actor_user_coverage_rate ?? 0} | ${row.status ?? 'n/a'} |`,
    ),
  ];
}

function renderThresholdTable(title, thresholds) {
  return [
    `## ${title}`,
    '',
    '| metric | threshold |',
    '| --- | ---: |',
    ...Object.entries(thresholds).map(([key, value]) => `| ${key} | ${value} |`),
    '',
  ];
}

function renderHtmlTable(headers, rows) {
  return [
    '<table>',
    '<thead>',
    '<tr>',
    ...headers.map((header) => `<th>${header}</th>`),
    '</tr>',
    '</thead>',
    '<tbody>',
    ...rows.map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${String(cell)}</td>`).join('')}</tr>`,
    ),
    '</tbody>',
    '</table>',
  ].join('\n');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildAtomFeed({ checkedAt, statusValue, alertStatus, metrics, governance, recentHistory }) {
  const feedId = 'tag:super-caterpillar,2026:review-policy-trace';
  const entries = recentHistory.slice(-10).reverse().map((row, index) => {
    const entryId = `${feedId}:${row.checkedAt}:${index}`;
    const title = `[review_policy_trace] ${row.status ?? statusValue} @ ${row.checkedAt}`;
    const summary = [
      `trace_rows=${row.metrics?.trace_row_count ?? 0}`,
      `timeline_events=${row.metrics?.timeline_event_count ?? 0}`,
      `job_audit_events=${row.metrics?.job_audit_event_count ?? 0}`,
      `actor_user_rate=${row.governance?.actor_user_coverage_rate ?? 0}`,
    ].join(', ');
    return [
      '<entry>',
      `<id>${escapeXml(entryId)}</id>`,
      `<title>${escapeXml(title)}</title>`,
      `<updated>${escapeXml(row.checkedAt)}</updated>`,
      `<summary>${escapeXml(summary)}</summary>`,
      '</entry>',
    ].join('');
  });

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `<id>${escapeXml(feedId)}</id>`,
    '<title>Review Policy Trace Feed</title>',
    `<updated>${escapeXml(checkedAt)}</updated>`,
    `<subtitle>${escapeXml(`status=${statusValue}, alert_status=${alertStatus}, trace_rows=${metrics.trace_row_count}, actor_user_rate=${governance.actor_user_coverage_rate}`)}</subtitle>`,
    ...entries,
    '</feed>',
  ].join('\n');
}

function buildStatusBadge({ statusValue, alertStatus }) {
  let color = '4f46e5';
  if (statusValue === 'FAIL') color = 'dc2626';
  else if (alertStatus === 'WARN') color = 'd97706';
  else if (alertStatus === 'INFO') color = '2563eb';
  else if (statusValue === 'PASS') color = '16a34a';

  return {
    schemaVersion: 1,
    label: 'review_policy_trace',
    message: `${statusValue}/${alertStatus}`,
    color,
  };
}

function buildConsumerBundle({
  checkedAt,
  datasetVersion,
  exportedAt,
  statusValue,
  alertStatus,
  pagesBaseUrl,
  metrics,
  governance,
  longTermTrends,
  thresholdMatrix,
  alerts,
}) {
  return {
    checkedAt,
    datasetVersion,
    exportedAt,
    status: statusValue,
    alertStatus,
    outputDir: exportDir,
    latestPointer: relativeToExportDir(latestPointerPath),
    pagesBaseUrl,
    consumers: {
      governance_snapshot: {
        description: 'Primary machine-readable governance snapshot for trace analytics and policy health consumers.',
        artifacts: {
          analysis: relativeToExportDir(analysisPath),
          diff: relativeToExportDir(diffPath),
          alerts: relativeToExportDir(alertsPath),
          status: relativeToExportDir(statusPath),
          history: relativeToExportDir(historyPath),
          trendPanel: relativeToExportDir(trendPanelPath),
          governanceDashboard: relativeToExportDir(governanceDashboardPath),
          governanceDashboardHtml: relativeToExportDir(governanceDashboardHtmlPath),
          governanceOverview: relativeToExportDir(governanceOverviewPath),
          thresholdMatrix: relativeToExportDir(thresholdMatrixPath),
        },
      },
      notification_consumers: {
        description: 'Stable notification payload for generic webhook, Slack, Discord, Teams, and email-style consumers.',
        payloadPath: relativeToExportDir(notificationPayloadPath),
      },
      portal_ui: {
        description: 'Standalone static portal app for human review, artifact browsing, and future hosting.',
        portalAppHtmlPath: relativeToExportDir(portalAppHtmlPath),
        governanceDashboardHtmlPath: relativeToExportDir(governanceDashboardHtmlPath),
      },
      hosted_site: {
        description: 'Deployable GitHub Pages bundle for real online hosting of the trace portal and governance dashboard.',
        siteDirectoryPath: relativeToExportDir(hostedSiteDir),
        portalIndexPath: relativeToExportDir(hostedPortalIndexPath),
        governanceDashboardPath: relativeToExportDir(hostedDashboardPath),
        consumerFeedPath: relativeToExportDir(hostedFeedPath),
        atomFeedPath: relativeToExportDir(hostedAtomFeedPath),
        statusBadgePath: relativeToExportDir(hostedBadgePath),
      },
      syndication: {
        description: 'Stable feed and badge entrypoints for external consumers.',
        atomFeedPath: relativeToExportDir(atomFeedPath),
        statusBadgePath: relativeToExportDir(statusBadgePath),
      },
      latest_trace_export: {
        description: 'Canonical review_policy_trace export and summary entry points for downstream automation.',
        tracePath: relativeToExportDir(tracePath),
        summaryPath: relativeToExportDir(summaryPath),
      },
    },
    metrics,
    governance,
    longTermTrends,
    thresholdMatrix: {
      failCount: thresholdMatrix.summary.fail_count,
      warnCount: thresholdMatrix.summary.warn_count,
      infoCount: thresholdMatrix.summary.info_count,
    },
    activeAlerts: alerts.length,
  };
}

function evaluateThreshold(current, failThreshold, warnThreshold, infoThreshold, options = {}) {
  const { direction = 'min' } = options;
  const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
  const currentValue = toNumber(current);
  const failValue = toNumber(failThreshold);
  const warnValue = toNumber(warnThreshold);
  const infoValue = toNumber(infoThreshold);

  if (currentValue == null) {
    return { status: 'unknown', breachedThreshold: null };
  }

  const compare = (lhs, rhs) => {
    if (rhs == null) return false;
    return direction === 'max' ? lhs > rhs : lhs < rhs;
  };

  if (compare(currentValue, failValue)) {
    return { status: 'fail', breachedThreshold: failValue };
  }
  if (compare(currentValue, warnValue)) {
    return { status: 'warn', breachedThreshold: warnValue };
  }
  if (compare(currentValue, infoValue)) {
    return { status: 'info', breachedThreshold: infoValue };
  }

  return { status: 'pass', breachedThreshold: null };
}

function buildThresholdMatrix(metrics, governance, trendSummary) {
  const definitions = [
    {
      key: 'trace_row_count',
      label: 'Trace rows',
      category: 'coverage',
      current: metrics.trace_row_count,
      fail: FAIL_THRESHOLDS.min_trace_row_count,
      direction: 'min',
    },
    {
      key: 'unique_event_types',
      label: 'Unique event types',
      category: 'coverage',
      current: metrics.unique_event_types,
      fail: FAIL_THRESHOLDS.min_unique_event_types,
      direction: 'min',
    },
    {
      key: 'unique_projects',
      label: 'Unique projects',
      category: 'coverage',
      current: metrics.unique_projects,
      fail: FAIL_THRESHOLDS.min_unique_projects,
      direction: 'min',
    },
    {
      key: 'timeline_event_count',
      label: 'Timeline events',
      category: 'timeline',
      current: metrics.timeline_event_count,
      fail: FAIL_THRESHOLDS.min_timeline_event_count,
      direction: 'min',
    },
    {
      key: 'job_audit_event_count',
      label: 'Job audit events',
      category: 'timeline',
      current: metrics.job_audit_event_count,
      fail: FAIL_THRESHOLDS.min_job_audit_event_count,
      direction: 'min',
    },
    {
      key: 'gate_result_linkage_rate',
      label: 'Gate linkage rate',
      category: 'governance',
      current: governance.gate_result_linkage_rate,
      fail: FAIL_THRESHOLDS.min_gate_result_linkage_rate,
      direction: 'min',
    },
    {
      key: 'policy_stage_coverage_rate',
      label: 'Policy stage coverage',
      category: 'governance',
      current: governance.policy_stage_coverage_rate,
      fail: FAIL_THRESHOLDS.min_policy_stage_coverage_rate,
      direction: 'min',
    },
    {
      key: 'publish_action_coverage_rate',
      label: 'Publish action coverage',
      category: 'governance',
      current: governance.publish_action_coverage_rate,
      fail: FAIL_THRESHOLDS.min_publish_action_coverage_rate,
      direction: 'min',
    },
    {
      key: 'actor_user_coverage_rate',
      label: 'Actor user coverage',
      category: 'governance',
      current: governance.actor_user_coverage_rate,
      warn: WARN_THRESHOLDS.min_actor_user_coverage_rate,
      direction: 'min',
    },
    {
      key: 'timeline_semantic_context_count',
      label: 'Timeline semantic contexts',
      category: 'timeline',
      current: metrics.timeline_semantic_context_count,
      warn: WARN_THRESHOLDS.min_timeline_semantic_context_count,
      direction: 'min',
    },
    {
      key: 'timeline_render_job_success_rate',
      label: 'Timeline render success rate',
      category: 'job_health',
      current: governance.timeline_render_job_success_rate,
      warn: WARN_THRESHOLDS.min_timeline_render_job_success_rate,
      direction: 'min',
    },
    {
      key: 'media_security_job_success_rate',
      label: 'Media security success rate',
      category: 'job_health',
      current: governance.media_security_job_success_rate,
      warn: WARN_THRESHOLDS.min_media_security_job_success_rate,
      direction: 'min',
    },
    {
      key: 'approval_event_project_coverage_rate',
      label: 'Approval project coverage',
      category: 'governance',
      current: governance.approval_event_project_coverage_rate,
      info: INFO_THRESHOLDS.min_approval_event_project_coverage_rate,
      direction: 'min',
    },
    {
      key: 'timeline_semantic_context_coverage_rate',
      label: 'Timeline semantic scene coverage',
      category: 'timeline',
      current: governance.timeline_semantic_context_coverage_rate,
      info: INFO_THRESHOLDS.min_timeline_semantic_context_coverage_rate,
      direction: 'min',
    },
    {
      key: 'job_audit_event_density_per_scene',
      label: 'Job audit density per scene',
      category: 'job_health',
      current: governance.job_audit_event_density_per_scene,
      info: INFO_THRESHOLDS.min_job_audit_event_density_per_scene,
      direction: 'min',
    },
    {
      key: 'trace_row_delta',
      label: 'Trace row delta',
      category: 'trend',
      current: trendSummary.trace_row_delta,
      warn: WARN_THRESHOLDS.max_negative_trace_row_delta,
      direction: 'max',
    },
    {
      key: 'timeline_event_delta',
      label: 'Timeline event delta',
      category: 'trend',
      current: trendSummary.timeline_event_delta,
      warn: WARN_THRESHOLDS.max_negative_timeline_event_delta,
      direction: 'max',
    },
  ];

  const evaluations = definitions.map((definition) => {
    const result = evaluateThreshold(
      definition.current,
      definition.fail,
      definition.warn,
      definition.info,
      { direction: definition.direction },
    );

    return {
      key: definition.key,
      label: definition.label,
      category: definition.category,
      direction: definition.direction,
      current: definition.current,
      fail_threshold: definition.fail ?? null,
      warn_threshold: definition.warn ?? null,
      info_threshold: definition.info ?? null,
      status: result.status,
      breached_threshold: result.breachedThreshold,
    };
  });

  return {
    checkedAt: new Date().toISOString(),
    evaluations,
    summary: {
      fail_count: evaluations.filter((entry) => entry.status === 'fail').length,
      warn_count: evaluations.filter((entry) => entry.status === 'warn').length,
      info_count: evaluations.filter((entry) => entry.status === 'info').length,
      pass_count: evaluations.filter((entry) => entry.status === 'pass').length,
    },
  };
}

function inferSnapshotStatus(snapshot) {
  const metrics = snapshot.metrics ?? {};
  const governance = snapshot.governance ?? {};
  return metrics.count_matches_manifest &&
    Number(metrics.unique_event_types ?? 0) >= 8 &&
    Number(metrics.job_audit_event_count ?? 0) > 0 &&
    Number(metrics.timeline_semantic_context_count ?? 0) > 0 &&
    Number(governance.gate_result_linkage_rate ?? 0) >= 0.9 &&
    Number(governance.policy_stage_coverage_rate ?? 0) >= 0.9 &&
    Number(governance.publish_action_coverage_rate ?? 0) >= 0.9
    ? 'PASS'
    : 'FAIL';
}

function countTrailing(rows, predicate) {
  let count = 0;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (!predicate(rows[index], index, rows)) break;
    count += 1;
  }
  return count;
}

function buildLongTermTrends(historyRows) {
  const recent7 = historyRows.slice(-7);
  const recent14 = historyRows.slice(-14);
  const traceRows7 = recent7.map((row) => Number(row.metrics?.trace_row_count ?? 0));
  const timelineEvents7 = recent7.map((row) => Number(row.metrics?.timeline_event_count ?? 0));
  const actorRates7 = recent7.map((row) => Number(row.governance?.actor_user_coverage_rate ?? 0));
  const statuses = historyRows.map((row) => inferSnapshotStatus(row));

  return {
    history_window_count: historyRows.length,
    windows: {
      last_7: {
        count: recent7.length,
        trace_row_avg: average(traceRows7),
        trace_row_min: min(traceRows7),
        trace_row_max: max(traceRows7),
        timeline_event_avg: average(timelineEvents7),
        timeline_event_min: min(timelineEvents7),
        timeline_event_max: max(timelineEvents7),
        actor_user_coverage_rate_avg: average(actorRates7),
        actor_user_coverage_rate_min: min(actorRates7),
        actor_user_coverage_rate_max: max(actorRates7),
      },
      last_14: {
        count: recent14.length,
        pass_rate: computeRate(
          recent14.filter((row) => inferSnapshotStatus(row) === 'PASS').length,
          recent14.length,
        ),
      },
    },
    streaks: {
      pass_streak: countTrailing(statuses, (status) => status === 'PASS'),
      unchanged_trace_row_streak: countTrailing(historyRows, (row, currentIndex) => {
        if (currentIndex === 0) return true;
        return Number(row.metrics?.trace_row_count ?? 0) === Number(historyRows[currentIndex - 1]?.metrics?.trace_row_count ?? 0);
      }),
      unchanged_timeline_event_streak: countTrailing(historyRows, (row, currentIndex) => {
        if (currentIndex === 0) return true;
        return Number(row.metrics?.timeline_event_count ?? 0) === Number(historyRows[currentIndex - 1]?.metrics?.timeline_event_count ?? 0);
      }),
    },
  };
}

function main() {
  const { skipExport } = parseArgs(process.argv.slice(2));
  if (!skipExport) {
    runCommand('pnpm', ['--filter', 'api', 'exec', 'tsx', 'src/scripts/export-film-ir-training-data.ts']);
  }

  ensureFileExists(manifestPath);
  ensureFileExists(tracePath);

  const manifest = readJson(manifestPath);
  const lines = fs
    .readFileSync(tracePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean);
  const rows = lines.map((line) => JSON.parse(line));

  const eventTypeCounts = {};
  const eventSourceCounts = {};
  const policySourceCounts = {};
  const policyStageCounts = {};
  const publishActionCounts = {};
  const gatePolicyLevelCounts = {};
  const projectCounts = {};
  const sceneCounts = {};
  let rowsWithGateResultId = 0;
  let rowsWithPolicyStage = 0;
  let rowsWithPublishAction = 0;
  let rowsWithActorUserId = 0;

  for (const row of rows) {
    increment(eventTypeCounts, row.event_type);
    increment(eventSourceCounts, row.event_source);
    increment(policySourceCounts, row.policy_source);
    increment(policyStageCounts, row.policy_stage);
    increment(publishActionCounts, row.publish_action);
    increment(gatePolicyLevelCounts, row.gate_policy_level);
    increment(projectCounts, row.project_id);
    increment(sceneCounts, row.scene_id);
    if (typeof row.gate_result_id === 'string' && row.gate_result_id.length > 0) rowsWithGateResultId += 1;
    if (typeof row.policy_stage === 'string' && row.policy_stage.length > 0) rowsWithPolicyStage += 1;
    if (typeof row.publish_action === 'string' && row.publish_action.length > 0) rowsWithPublishAction += 1;
    if (typeof row.actor_user_id === 'string' && row.actor_user_id.length > 0) rowsWithActorUserId += 1;
  }

  const jobAuditEventCount = Object.entries(eventTypeCounts)
    .filter(([key]) => key.includes('-job-'))
    .reduce((sum, [, value]) => sum + value, 0);
  const timelineSemanticContextCount = eventTypeCounts['timeline-semantic-context'] ?? 0;
  const publishDirectorLayerCount = eventTypeCounts['publish-director-layer'] ?? 0;
  const assetReceiptCount = eventTypeCounts['asset-receipt'] ?? 0;
  const approvalActionCount = eventTypeCounts['approval-action'] ?? 0;
  const timelineComposeCreatedCount = eventTypeCounts['timeline-compose-job-created'] ?? 0;
  const timelineComposeSucceededCount = eventTypeCounts['timeline-compose-job-succeeded'] ?? 0;
  const timelineRenderCreatedCount = eventTypeCounts['timeline-render-job-created'] ?? 0;
  const timelineRenderSucceededCount = eventTypeCounts['timeline-render-job-succeeded'] ?? 0;
  const mediaSecurityCreatedCount = eventTypeCounts['media-security-job-created'] ?? 0;
  const mediaSecuritySucceededCount = eventTypeCounts['media-security-job-succeeded'] ?? 0;
  const timelineEventCount = Object.entries(eventTypeCounts)
    .filter(([key]) => key.startsWith('timeline-'))
    .reduce((sum, [, value]) => sum + value, 0);
  const publishEventCount = publishDirectorLayerCount + assetReceiptCount;
  const familyMetrics = {
    timeline_semantic_context_coverage_rate: clampRate(
      computeRate(timelineSemanticContextCount, Object.keys(sceneCounts).length),
    ),
    publish_event_scene_coverage_rate: clampRate(
      computeRate(publishEventCount, Object.keys(sceneCounts).length),
    ),
    approval_event_project_coverage_rate: clampRate(
      computeRate(approvalActionCount, Object.keys(projectCounts).length),
    ),
    timeline_compose_job_success_rate: computeRate(timelineComposeSucceededCount, timelineComposeCreatedCount),
    timeline_render_job_success_rate: computeRate(timelineRenderSucceededCount, timelineRenderCreatedCount),
    media_security_job_success_rate: computeRate(mediaSecuritySucceededCount, mediaSecurityCreatedCount),
    job_audit_event_density_per_scene: computeRate(jobAuditEventCount, Object.keys(sceneCounts).length),
    trace_rows_per_scene: computeRate(rows.length, Object.keys(sceneCounts).length),
    trace_rows_per_project: computeRate(rows.length, Object.keys(projectCounts).length),
  };
  const governance = {
    gate_result_linkage_rate: computeRate(rowsWithGateResultId, rows.length),
    policy_stage_coverage_rate: computeRate(rowsWithPolicyStage, rows.length),
    publish_action_coverage_rate: computeRate(rowsWithPublishAction, rows.length),
    actor_user_coverage_rate: computeRate(rowsWithActorUserId, rows.length),
    has_gate_family: eventTypeCounts['gate-evaluation'] > 0,
    has_publish_family: publishEventCount > 0,
    has_timeline_family: timelineEventCount > 0,
    has_job_audit_family: jobAuditEventCount > 0,
    has_approval_family: approvalActionCount > 0,
    ...familyMetrics,
  };

  const metrics = {
    trace_row_count: rows.length,
    manifest_trace_count: Number(manifest.review_policy_trace_count ?? 0),
    count_matches_manifest: Number(manifest.review_policy_trace_count ?? 0) === rows.length,
    unique_event_types: Object.keys(eventTypeCounts).length,
    unique_event_sources: Object.keys(eventSourceCounts).length,
    unique_policy_sources: Object.keys(policySourceCounts).length,
    unique_projects: Object.keys(projectCounts).length,
    unique_scenes: Object.keys(sceneCounts).length,
    job_audit_event_count: jobAuditEventCount,
    timeline_semantic_context_count: timelineSemanticContextCount,
    publish_director_layer_count: publishDirectorLayerCount,
    asset_receipt_count: assetReceiptCount,
    approval_action_count: approvalActionCount,
    timeline_event_count: timelineEventCount,
  };

  const history = loadHistory(historyPath);
  const previousSnapshot = history.length > 0 ? history[history.length - 1] : null;
  const snapshot = {
    checkedAt: new Date().toISOString(),
    datasetVersion: manifest.dataset_version ?? null,
    exportedAt: manifest.exported_at ?? null,
    metrics,
    governance,
    breakdowns: {
      eventTypeCounts,
      policyStageCounts,
      publishActionCounts,
    },
  };
  const diff = {
    previousCheckedAt: previousSnapshot?.checkedAt ?? null,
    currentCheckedAt: snapshot.checkedAt,
    metricsDelta: diffRecord(metrics, previousSnapshot?.metrics ?? null),
    eventTypeDelta: diffRecord(eventTypeCounts, previousSnapshot?.breakdowns?.eventTypeCounts ?? null),
    policyStageDelta: diffRecord(policyStageCounts, previousSnapshot?.breakdowns?.policyStageCounts ?? null),
    publishActionDelta: diffRecord(publishActionCounts, previousSnapshot?.breakdowns?.publishActionCounts ?? null),
  };

  const alerts = buildAlerts(metrics, governance);
  const hasFailAlert = alerts.some((alert) => alert.severity === 'fail');
  const hasWarnAlert = alerts.some((alert) => alert.severity === 'warn');
  const hasInfoAlert = alerts.some((alert) => alert.severity === 'info');
  const status =
    metrics.count_matches_manifest &&
    metrics.unique_event_types >= 8 &&
    metrics.job_audit_event_count > 0 &&
    metrics.timeline_semantic_context_count > 0 &&
    governance.gate_result_linkage_rate >= 0.9 &&
    governance.policy_stage_coverage_rate >= 0.9 &&
    governance.publish_action_coverage_rate >= 0.9 &&
    !hasFailAlert
      ? 'PASS'
      : 'FAIL';
  const historyForTrends = selectHistoryWindow([...history, snapshot]);
  const previousHistoryEntry = historyForTrends.length >= 2 ? historyForTrends[historyForTrends.length - 2] : null;
  const trendSummary = {
    window_size: historyForTrends.length,
    previous_checked_at: previousHistoryEntry?.checkedAt ?? null,
    current_checked_at: snapshot.checkedAt,
    trace_row_delta: metrics.trace_row_count - Number(previousHistoryEntry?.metrics?.trace_row_count ?? 0),
    timeline_event_delta: metrics.timeline_event_count - Number(previousHistoryEntry?.metrics?.timeline_event_count ?? 0),
    job_audit_event_delta:
      metrics.job_audit_event_count - Number(previousHistoryEntry?.metrics?.job_audit_event_count ?? 0),
    actor_user_coverage_rate_delta:
      Number((governance.actor_user_coverage_rate - Number(previousHistoryEntry?.governance?.actor_user_coverage_rate ?? 0)).toFixed(4)),
  };
  if (trendSummary.trace_row_delta <= WARN_THRESHOLDS.max_negative_trace_row_delta) {
    alerts.push(
      buildAlert({
        key: 'trace_row_delta',
        severity: 'warn',
        current: trendSummary.trace_row_delta,
        threshold: WARN_THRESHOLDS.max_negative_trace_row_delta,
        message: 'trace row count regressed versus the previous snapshot.',
      }),
    );
  }
  if (trendSummary.timeline_event_delta <= WARN_THRESHOLDS.max_negative_timeline_event_delta) {
    alerts.push(
      buildAlert({
        key: 'timeline_event_delta',
        severity: 'warn',
        current: trendSummary.timeline_event_delta,
        threshold: WARN_THRESHOLDS.max_negative_timeline_event_delta,
        message: 'timeline event coverage regressed versus the previous snapshot.',
      }),
    );
  }
  const longTermTrends = buildLongTermTrends([...history, snapshot]);
  const thresholdMatrix = buildThresholdMatrix(metrics, governance, trendSummary);

  const analysis = {
    status,
    alert_status: hasFailAlert ? 'FAIL' : hasWarnAlert ? 'WARN' : hasInfoAlert ? 'INFO' : 'PASS',
    checkedAt: snapshot.checkedAt,
    datasetVersion: snapshot.datasetVersion,
    exportedAt: snapshot.exportedAt,
    outputDir: exportDir,
    metrics,
    governance,
    longTermTrends,
    thresholds: {
      fail: FAIL_THRESHOLDS,
      warn: WARN_THRESHOLDS,
      info: INFO_THRESHOLDS,
    },
    thresholdMatrix,
    alerts,
    diff,
    trendSummary,
    breakdowns: {
      eventTypeCounts,
      eventSourceCounts,
      policySourceCounts,
      policyStageCounts,
      publishActionCounts,
      gatePolicyLevelCounts,
    },
    topSamples: {
      eventTypes: topEntries(eventTypeCounts),
      eventSources: topEntries(eventSourceCounts),
      policySources: topEntries(policySourceCounts),
      policyStages: topEntries(policyStageCounts),
      publishActions: topEntries(publishActionCounts),
    },
  };

  fs.writeFileSync(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`);
  fs.writeFileSync(diffPath, `${JSON.stringify(diff, null, 2)}\n`);
  fs.writeFileSync(statusPath, `${JSON.stringify(analysis, null, 2)}\n`);
  fs.writeFileSync(alertsPath, `${JSON.stringify({ checkedAt: snapshot.checkedAt, status: analysis.alert_status, alerts }, null, 2)}\n`);
  fs.writeFileSync(governanceDashboardPath, `${JSON.stringify({ checkedAt: snapshot.checkedAt, metrics, governance, longTermTrends }, null, 2)}\n`);
  fs.writeFileSync(thresholdMatrixPath, `${JSON.stringify(thresholdMatrix, null, 2)}\n`);
  fs.appendFileSync(historyPath, `${JSON.stringify(snapshot)}\n`);

  const trendPanelLines = [
    '# Review Policy Trace Trend Panel',
    '',
    `- current_checked_at: ${snapshot.checkedAt}`,
    `- window_size: ${trendSummary.window_size}`,
    `- previous_checked_at: ${trendSummary.previous_checked_at ?? 'none'}`,
    `- trace_row_delta: ${trendSummary.trace_row_delta}`,
    `- timeline_event_delta: ${trendSummary.timeline_event_delta}`,
    `- job_audit_event_delta: ${trendSummary.job_audit_event_delta}`,
    `- actor_user_coverage_rate_delta: ${trendSummary.actor_user_coverage_rate_delta}`,
    '',
    '## Recent Snapshots',
    '',
    ...renderTrendTable(
      historyForTrends.map((row) => ({
        checkedAt: row.checkedAt,
        metrics: row.metrics ?? {},
        governance: row.governance ?? {},
        status:
          row.metrics?.count_matches_manifest && Number(row.metrics?.unique_event_types ?? 0) >= 8 ? 'PASS' : 'FAIL',
      })),
    ),
    '',
  ];
  fs.writeFileSync(trendPanelPath, `${trendPanelLines.join('\n')}\n`);
  const governanceOverviewLines = [
    '# Review Policy Trace Governance Overview',
    '',
    `- checked_at: ${snapshot.checkedAt}`,
    `- status: ${analysis.status}`,
    `- alert_status: ${analysis.alert_status}`,
    `- trace_row_count: ${metrics.trace_row_count}`,
    `- unique_event_types: ${metrics.unique_event_types}`,
    `- unique_projects: ${metrics.unique_projects}`,
    `- pass_streak: ${longTermTrends.streaks.pass_streak}`,
    '',
    '## Long-Term Windows',
    '',
    `- last_7.trace_row_avg: ${longTermTrends.windows.last_7.trace_row_avg}`,
    `- last_7.timeline_event_avg: ${longTermTrends.windows.last_7.timeline_event_avg}`,
    `- last_7.actor_user_coverage_rate_avg: ${longTermTrends.windows.last_7.actor_user_coverage_rate_avg}`,
    `- last_14.pass_rate: ${longTermTrends.windows.last_14.pass_rate}`,
    '',
    '## Governance Rates',
    '',
    `- gate_result_linkage_rate: ${governance.gate_result_linkage_rate}`,
    `- policy_stage_coverage_rate: ${governance.policy_stage_coverage_rate}`,
    `- publish_action_coverage_rate: ${governance.publish_action_coverage_rate}`,
    `- actor_user_coverage_rate: ${governance.actor_user_coverage_rate}`,
    `- timeline_render_job_success_rate: ${governance.timeline_render_job_success_rate}`,
    `- media_security_job_success_rate: ${governance.media_security_job_success_rate}`,
    '',
    ...renderThresholdTable('Fail Thresholds', FAIL_THRESHOLDS),
    ...renderThresholdTable('Warn Thresholds', WARN_THRESHOLDS),
    ...renderThresholdTable('Info Thresholds', INFO_THRESHOLDS),
    '## Alerts',
    '',
    ...(alerts.length > 0
      ? alerts.map((alert) => `- [${alert.severity.toUpperCase()}] ${alert.key}: ${alert.message} (current=${alert.current}, threshold=${alert.threshold})`)
      : ['- none']),
    '',
  ];
  fs.writeFileSync(governanceOverviewPath, `${governanceOverviewLines.join('\n')}\n`);
  const dashboardHtml = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>Review Policy Trace Governance Dashboard</title>',
    '<style>',
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #111827; background: #f8fafc; }',
    'h1,h2 { margin: 0 0 12px; }',
    '.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 20px 0 28px; }',
    '.card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }',
    '.metric { font-size: 28px; font-weight: 700; margin-top: 8px; }',
    'table { width: 100%; border-collapse: collapse; background: white; margin: 12px 0 28px; }',
    'th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; font-size: 14px; }',
    'th { background: #f3f4f6; }',
    '.status-pass { color: #047857; font-weight: 700; }',
    '.status-warn { color: #b45309; font-weight: 700; }',
    '.status-info { color: #1d4ed8; font-weight: 700; }',
    '.status-fail { color: #b91c1c; font-weight: 700; }',
    '</style>',
    '</head>',
    '<body>',
    '<h1>Review Policy Trace Governance Dashboard</h1>',
    `<p>checked_at: ${snapshot.checkedAt}</p>`,
    '<div class="grid">',
    `<div class="card"><div>status</div><div class="metric status-${analysis.status.toLowerCase()}">${analysis.status}</div></div>`,
    `<div class="card"><div>alert status</div><div class="metric status-${analysis.alert_status.toLowerCase()}">${analysis.alert_status}</div></div>`,
    `<div class="card"><div>trace rows</div><div class="metric">${metrics.trace_row_count}</div></div>`,
    `<div class="card"><div>unique event types</div><div class="metric">${metrics.unique_event_types}</div></div>`,
    `<div class="card"><div>pass streak</div><div class="metric">${longTermTrends.streaks.pass_streak}</div></div>`,
    `<div class="card"><div>last 7 timeline avg</div><div class="metric">${longTermTrends.windows.last_7.timeline_event_avg}</div></div>`,
    '</div>',
    '<h2>Threshold Matrix</h2>',
    renderHtmlTable(
      ['metric', 'category', 'current', 'fail', 'warn', 'info', 'status'],
      thresholdMatrix.evaluations.map((entry) => [
        entry.label,
        entry.category,
        entry.current,
        entry.fail_threshold ?? '-',
        entry.warn_threshold ?? '-',
        entry.info_threshold ?? '-',
        entry.status.toUpperCase(),
      ]),
    ),
    '<h2>Recent Trend Window</h2>',
    renderHtmlTable(
      ['window', 'count', 'trace avg', 'timeline avg', 'actor avg', 'pass rate'],
      [
        [
          'last_7',
          longTermTrends.windows.last_7.count,
          longTermTrends.windows.last_7.trace_row_avg,
          longTermTrends.windows.last_7.timeline_event_avg,
          longTermTrends.windows.last_7.actor_user_coverage_rate_avg,
          '-',
        ],
        [
          'last_14',
          longTermTrends.windows.last_14.count,
          '-',
          '-',
          '-',
          longTermTrends.windows.last_14.pass_rate,
        ],
      ],
    ),
    '<h2>Active Alerts</h2>',
    renderHtmlTable(
      ['severity', 'metric', 'message', 'current', 'threshold'],
      (alerts.length > 0
        ? alerts
        : [{ severity: 'pass', key: 'none', message: 'No active alerts', current: '-', threshold: '-' }]).map((alert) => [
        String(alert.severity).toUpperCase(),
        alert.key,
        alert.message,
        alert.current,
        alert.threshold,
      ]),
    ),
    '</body>',
    '</html>',
  ].join('\n');
  fs.writeFileSync(governanceDashboardHtmlPath, `${dashboardHtml}\n`);
  fs.writeFileSync(
    notificationPayloadPath,
    `${JSON.stringify(
      {
        checkedAt: snapshot.checkedAt,
        status: analysis.status,
        alert_status: analysis.alert_status,
        alerts,
        channels: {
          generic_webhook: {
            enabled: true,
            should_notify: analysis.alert_status !== 'PASS' || analysis.status === 'FAIL',
          },
          slack_webhook: {
            enabled: true,
            should_notify: analysis.alert_status !== 'PASS' || analysis.status === 'FAIL',
            text: `[review_policy_trace] ${analysis.alert_status}/${analysis.status} @ ${snapshot.checkedAt}`,
          },
          discord_webhook: {
            enabled: true,
            should_notify: analysis.alert_status !== 'PASS' || analysis.status === 'FAIL',
            content: `[review_policy_trace] ${analysis.alert_status}/${analysis.status} @ ${snapshot.checkedAt}`,
          },
          teams_webhook: {
            enabled: true,
            should_notify: analysis.alert_status !== 'PASS' || analysis.status === 'FAIL',
            title: `[review_policy_trace] ${analysis.alert_status}/${analysis.status}`,
            summary: `trace_rows=${metrics.trace_row_count}, alerts=${alerts.length}, pass_streak=${longTermTrends.streaks.pass_streak}`,
          },
          email: {
            enabled: true,
            should_notify: analysis.alert_status !== 'PASS' || analysis.status === 'FAIL',
            subject: `[review_policy_trace] ${analysis.alert_status}/${analysis.status} @ ${snapshot.checkedAt}`,
            markdown_summary_path: governanceOverviewPath,
            governance_overview_path: governanceOverviewPath,
            html_dashboard_path: governanceDashboardHtmlPath,
          },
        },
        trendSummary,
        longTermTrends,
        thresholdMatrix,
        metrics: {
          trace_row_count: metrics.trace_row_count,
          unique_event_types: metrics.unique_event_types,
          unique_projects: metrics.unique_projects,
          timeline_event_count: metrics.timeline_event_count,
          job_audit_event_count: metrics.job_audit_event_count,
        },
      },
      null,
      2,
    )}\n`,
  );
  const pagesBaseUrl = process.env.REVIEW_POLICY_TRACE_PAGES_BASE_URL?.trim() || null;
  const recentHistoryRows = selectHistoryWindow([...history, snapshot], 10);
  const atomFeed = buildAtomFeed({
    checkedAt: snapshot.checkedAt,
    statusValue: analysis.status,
    alertStatus: analysis.alert_status,
    metrics,
    governance,
    recentHistory: recentHistoryRows,
  });
  const statusBadge = buildStatusBadge({
    statusValue: analysis.status,
    alertStatus: analysis.alert_status,
  });
  fs.writeFileSync(atomFeedPath, `${atomFeed}\n`);
  fs.writeFileSync(statusBadgePath, `${JSON.stringify(statusBadge, null, 2)}\n`);
  const consumerBundle = buildConsumerBundle({
    checkedAt: snapshot.checkedAt,
    datasetVersion: analysis.datasetVersion,
    exportedAt: analysis.exportedAt,
    statusValue: analysis.status,
    alertStatus: analysis.alert_status,
    pagesBaseUrl,
    metrics,
    governance,
    longTermTrends,
    thresholdMatrix,
    alerts,
  });
  fs.writeFileSync(consumerBundlePath, `${JSON.stringify(consumerBundle, null, 2)}\n`);

  const distributionChannels = {
    checkedAt: snapshot.checkedAt,
    datasetVersion: analysis.datasetVersion,
    status: analysis.status,
    channels: {
      governance_snapshot: {
        format: 'json',
        stability: 'stable',
        consumer: 'analytics',
        path: relativeToExportDir(consumerBundlePath),
      },
      notification_payload: {
        format: 'json',
        stability: 'stable',
        consumer: 'notification',
        path: relativeToExportDir(notificationPayloadPath),
      },
      latest_pointer: {
        format: 'json',
        stability: 'stable',
        consumer: 'automation',
        path: relativeToExportDir(latestPointerPath),
      },
      consumer_feed: {
        format: 'json',
        stability: 'stable',
        consumer: 'polling',
        path: relativeToExportDir(consumerFeedPath),
      },
      portal_ui: {
        format: 'html',
        stability: 'stable',
        consumer: 'human',
        path: relativeToExportDir(portalAppHtmlPath),
      },
      governance_dashboard: {
        format: 'html',
        stability: 'stable',
        consumer: 'human',
        path: relativeToExportDir(governanceDashboardHtmlPath),
      },
      atom_feed: {
        format: 'xml',
        stability: 'stable',
        consumer: 'syndication',
        path: relativeToExportDir(atomFeedPath),
      },
      status_badge: {
        format: 'json',
        stability: 'stable',
        consumer: 'badge',
        path: relativeToExportDir(statusBadgePath),
      },
      hosted_portal: {
        format: 'html',
        stability: 'stable',
        consumer: 'hosted_human',
        path: relativeToExportDir(hostedPortalIndexPath),
      },
    },
  };
  fs.writeFileSync(distributionChannelsPath, `${JSON.stringify(distributionChannels, null, 2)}\n`);

  const consumerFeed = {
    checkedAt: snapshot.checkedAt,
    datasetVersion: analysis.datasetVersion,
    exportedAt: analysis.exportedAt,
    status: analysis.status,
    alertStatus: analysis.alert_status,
    metrics,
    governance,
    longTermTrends,
    thresholdSummary: {
      failCount: thresholdMatrix.summary.fail_count,
      warnCount: thresholdMatrix.summary.warn_count,
      infoCount: thresholdMatrix.summary.info_count,
    },
    release: {
      pagesBaseUrl,
      analysisPath: relativeToExportDir(analysisPath),
      diffPath: relativeToExportDir(diffPath),
      consumerBundlePath: relativeToExportDir(consumerBundlePath),
      consumerIndexPath: relativeToExportDir(consumerIndexPath),
      consumerFeedPath: relativeToExportDir(consumerFeedPath),
      distributionChannelsPath: relativeToExportDir(distributionChannelsPath),
      latestPointerPath: relativeToExportDir(latestPointerPath),
      governanceDashboardHtmlPath: relativeToExportDir(governanceDashboardHtmlPath),
      portalAppHtmlPath: relativeToExportDir(portalAppHtmlPath),
      notificationPayloadPath: relativeToExportDir(notificationPayloadPath),
      atomFeedPath: relativeToExportDir(atomFeedPath),
      statusBadgePath: relativeToExportDir(statusBadgePath),
      hostedSiteDirPath: relativeToExportDir(hostedSiteDir),
      hostedPortalIndexPath: relativeToExportDir(hostedPortalIndexPath),
      hostedDashboardPath: relativeToExportDir(hostedDashboardPath),
    },
  };
  fs.writeFileSync(consumerFeedPath, `${JSON.stringify(consumerFeed, null, 2)}\n`);

  fs.writeFileSync(
    consumerIndexPath,
    `${JSON.stringify(
      {
        checkedAt: snapshot.checkedAt,
        datasetVersion: analysis.datasetVersion,
        exportedAt: analysis.exportedAt,
        pagesBaseUrl,
        bundlePath: relativeToExportDir(consumerBundlePath),
        consumerFeedPath: relativeToExportDir(consumerFeedPath),
        distributionChannelsPath: relativeToExportDir(distributionChannelsPath),
        latestPointerPath: relativeToExportDir(latestPointerPath),
        analysisPath: relativeToExportDir(analysisPath),
        diffPath: relativeToExportDir(diffPath),
        governanceDashboardHtmlPath: relativeToExportDir(governanceDashboardHtmlPath),
        portalAppHtmlPath: relativeToExportDir(portalAppHtmlPath),
        notificationPayloadPath: relativeToExportDir(notificationPayloadPath),
        atomFeedPath: relativeToExportDir(atomFeedPath),
        statusBadgePath: relativeToExportDir(statusBadgePath),
        hostedSiteDirPath: relativeToExportDir(hostedSiteDir),
        hostedPortalIndexPath: relativeToExportDir(hostedPortalIndexPath),
        hostedDashboardPath: relativeToExportDir(hostedDashboardPath),
      },
      null,
      2,
    )}\n`,
  );

  fs.writeFileSync(
    latestPointerPath,
    `${JSON.stringify(
      {
        checkedAt: snapshot.checkedAt,
        datasetVersion: analysis.datasetVersion,
        exportedAt: analysis.exportedAt,
        outputDir: exportDir,
        pagesBaseUrl,
        latest: {
          trace: relativeToExportDir(tracePath),
          analysis: relativeToExportDir(analysisPath),
          diff: relativeToExportDir(diffPath),
          alerts: relativeToExportDir(alertsPath),
          governanceDashboard: relativeToExportDir(governanceDashboardPath),
          governanceDashboardHtml: relativeToExportDir(governanceDashboardHtmlPath),
          governanceOverview: relativeToExportDir(governanceOverviewPath),
          thresholdMatrix: relativeToExportDir(thresholdMatrixPath),
          consumerBundle: relativeToExportDir(consumerBundlePath),
          consumerIndex: relativeToExportDir(consumerIndexPath),
          consumerFeed: relativeToExportDir(consumerFeedPath),
          distributionChannels: relativeToExportDir(distributionChannelsPath),
          portalAppHtml: relativeToExportDir(portalAppHtmlPath),
          notificationPayload: relativeToExportDir(notificationPayloadPath),
          atomFeed: relativeToExportDir(atomFeedPath),
          statusBadge: relativeToExportDir(statusBadgePath),
          hostedSiteDir: relativeToExportDir(hostedSiteDir),
          hostedPortalIndex: relativeToExportDir(hostedPortalIndexPath),
          hostedDashboard: relativeToExportDir(hostedDashboardPath),
        },
      },
      null,
      2,
    )}\n`,
  );

  const portalAppData = {
    checkedAt: snapshot.checkedAt,
    status: analysis.status,
    alertStatus: analysis.alert_status,
    datasetVersion: analysis.datasetVersion,
    exportedAt: analysis.exportedAt,
    metrics,
    governance,
    longTermTrends,
    recentHistory: recentHistoryRows,
    channels: distributionChannels.channels,
    alerts,
    thresholdMatrix: thresholdMatrix.evaluations,
    hosted: {
      baseUrl: pagesBaseUrl,
      portalIndexPath: relativeToExportDir(hostedPortalIndexPath),
      dashboardPath: relativeToExportDir(hostedDashboardPath),
      atomFeedPath: relativeToExportDir(atomFeedPath),
      statusBadgePath: relativeToExportDir(statusBadgePath),
    },
  };
  const portalAppHtml = [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8"><title>Review Policy Trace Portal App</title>',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<style>',
    ':root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,sans-serif;}',
    'body{margin:0;background:#f5f7fb;color:#0f172a;}',
    '.shell{max-width:1200px;margin:0 auto;padding:32px 20px 64px;}',
    '.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;flex-wrap:wrap;margin-bottom:24px;}',
    '.hero h1{margin:0;font-size:32px;}',
    '.hero p{margin:8px 0 0;color:#475569;max-width:760px;}',
    '.badge-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;}',
    '.badge{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#e2e8f0;font-size:12px;font-weight:600;}',
    '.badge.pass{background:#dcfce7;color:#166534;}.badge.warn{background:#fef3c7;color:#92400e;}.badge.fail{background:#fee2e2;color:#991b1b;}.badge.info{background:#dbeafe;color:#1d4ed8;}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0;}',
    '.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;box-shadow:0 10px 30px rgba(15,23,42,.06);}',
    '.card h2,.card h3{margin:0 0 10px;font-size:14px;color:#475569;text-transform:uppercase;letter-spacing:.04em;}',
    '.metric{font-size:30px;font-weight:800;}',
    '.section{margin-top:28px;}',
    '.section h2{font-size:20px;margin:0 0 12px;}',
    'table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.06);}',
    'th,td{padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px;vertical-align:top;}',
    'th{background:#f8fafc;color:#334155;}',
    'tr:last-child td{border-bottom:none;}',
    'code{background:#f1f5f9;padding:2px 6px;border-radius:6px;}',
    '.empty{padding:18px;background:#fff;border:1px dashed #cbd5e1;border-radius:16px;color:#64748b;}',
    '</style></head><body>',
    '<div class="shell">',
    '<div class="hero">',
    '<div><h1>Review Policy Trace Portal</h1><p>A standalone artifact UI for long-term governance, downstream consumer discovery, and trace health inspection.</p></div>',
    `<div class="badge-row"><span class="badge ${String(analysis.status).toLowerCase()}">${analysis.status}</span><span class="badge ${String(analysis.alert_status).toLowerCase()}">${analysis.alert_status}</span><span class="badge">${analysis.datasetVersion ?? 'unknown-version'}</span></div>`,
    '</div>',
    '<div id="summary-grid" class="grid"></div>',
    '<div class="section"><h2>Distribution Channels</h2><div id="channel-table"></div></div>',
    '<div class="section"><h2>Recent History</h2><div id="history-table"></div></div>',
    '<div class="section"><h2>Threshold Matrix</h2><div id="threshold-table"></div></div>',
    '<div class="section"><h2>Hosted Entry Points</h2><div id="hosted-table"></div></div>',
    '<div class="section"><h2>Active Alerts</h2><div id="alert-panel"></div></div>',
    '</div>',
    `<script>window.__REVIEW_POLICY_TRACE_PORTAL__ = ${JSON.stringify(portalAppData)};</script>`,
    '<script>',
    'const data = window.__REVIEW_POLICY_TRACE_PORTAL__;',
    'const metricCards = [',
    "['Trace Rows', data.metrics.trace_row_count],",
    "['Timeline Events', data.metrics.timeline_event_count],",
    "['Job Audit Events', data.metrics.job_audit_event_count],",
    "['Unique Event Types', data.metrics.unique_event_types],",
    "['Pass Streak', data.longTermTrends.streaks.pass_streak],",
    "['Last 14 Pass Rate', data.longTermTrends.windows.last_14.pass_rate],",
    '];',
    "document.getElementById('summary-grid').innerHTML = metricCards.map(([label, value]) => `<div class=\"card\"><h2>${label}</h2><div class=\"metric\">${value}</div></div>`).join('');",
    'const channelRows = Object.entries(data.channels).map(([key, value]) => `<tr><td><strong>${key}</strong></td><td>${value.consumer}</td><td>${value.format}</td><td>${value.stability}</td><td><code>${value.path}</code></td></tr>`).join("");',
    "document.getElementById('channel-table').innerHTML = `<table><thead><tr><th>channel</th><th>consumer</th><th>format</th><th>stability</th><th>path</th></tr></thead><tbody>${channelRows}</tbody></table>`;",
    'const historyRows = (data.recentHistory || []).map((row) => `<tr><td>${row.checkedAt}</td><td>${row.metrics?.trace_row_count ?? 0}</td><td>${row.metrics?.timeline_event_count ?? 0}</td><td>${row.metrics?.job_audit_event_count ?? 0}</td><td>${row.governance?.actor_user_coverage_rate ?? 0}</td><td>${row.metrics?.count_matches_manifest ? "PASS" : "FAIL"}</td></tr>`).join("");',
    "document.getElementById('history-table').innerHTML = historyRows ? `<table><thead><tr><th>checked_at</th><th>trace_rows</th><th>timeline_events</th><th>job_audit_events</th><th>actor_user_coverage</th><th>status</th></tr></thead><tbody>${historyRows}</tbody></table>` : `<div class=\"empty\">No history rows yet.</div>`;",
    'const thresholdRows = (data.thresholdMatrix || []).map((entry) => `<tr><td>${entry.label}</td><td>${entry.category}</td><td>${entry.current}</td><td>${entry.fail_threshold ?? "-"}</td><td>${entry.warn_threshold ?? "-"}</td><td>${entry.info_threshold ?? "-"}</td><td>${entry.status}</td></tr>`).join("");',
    "document.getElementById('threshold-table').innerHTML = thresholdRows ? `<table><thead><tr><th>metric</th><th>category</th><th>current</th><th>fail</th><th>warn</th><th>info</th><th>status</th></tr></thead><tbody>${thresholdRows}</tbody></table>` : `<div class=\"empty\">No threshold rows.</div>`;",
    'const hostedRows = Object.entries(data.hosted || {}).map(([key, value]) => `<tr><td><strong>${key}</strong></td><td>${value ?? "-"}</td></tr>`).join("");',
    "document.getElementById('hosted-table').innerHTML = hostedRows ? `<table><thead><tr><th>entry</th><th>value</th></tr></thead><tbody>${hostedRows}</tbody></table>` : `<div class=\"empty\">No hosted entry points.</div>`;",
    'const alertItems = (data.alerts || []).map((alert) => `<tr><td>${alert.severity}</td><td>${alert.key}</td><td>${alert.current}</td><td>${alert.threshold}</td><td>${alert.message}</td></tr>`).join("");',
    "document.getElementById('alert-panel').innerHTML = alertItems ? `<table><thead><tr><th>severity</th><th>metric</th><th>current</th><th>threshold</th><th>message</th></tr></thead><tbody>${alertItems}</tbody></table>` : `<div class=\"empty\">No active alerts.</div>`;",
    '</script></body></html>',
  ].join('');
  fs.writeFileSync(portalAppHtmlPath, `${portalAppHtml}\n`);
  fs.mkdirSync(hostedSiteDir, { recursive: true });
  fs.writeFileSync(hostedPortalIndexPath, `${portalAppHtml}\n`);
  fs.writeFileSync(hostedDashboardPath, `${dashboardHtml}\n`);
  fs.writeFileSync(hostedFeedPath, `${JSON.stringify(consumerFeed, null, 2)}\n`);
  fs.writeFileSync(hostedAtomFeedPath, `${atomFeed}\n`);
  fs.writeFileSync(hostedBadgePath, `${JSON.stringify(statusBadge, null, 2)}\n`);

  const summaryLines = [
    '# Review Policy Trace Ops Summary',
    '',
    `- status: ${analysis.status}`,
    `- alert_status: ${analysis.alert_status}`,
    `- checked_at: ${analysis.checkedAt}`,
    `- dataset_version: ${analysis.datasetVersion}`,
    `- exported_at: ${analysis.exportedAt}`,
    `- output_dir: ${analysis.outputDir}`,
    '',
    '## Core Metrics',
    '',
    `- trace_row_count: ${metrics.trace_row_count}`,
    `- manifest_trace_count: ${metrics.manifest_trace_count}`,
    `- count_matches_manifest: ${metrics.count_matches_manifest ? 'yes' : 'no'}`,
    `- unique_event_types: ${metrics.unique_event_types}`,
    `- unique_event_sources: ${metrics.unique_event_sources}`,
    `- unique_policy_sources: ${metrics.unique_policy_sources}`,
    `- unique_projects: ${metrics.unique_projects}`,
    `- unique_scenes: ${metrics.unique_scenes}`,
    `- job_audit_event_count: ${metrics.job_audit_event_count}`,
    `- timeline_semantic_context_count: ${metrics.timeline_semantic_context_count}`,
    `- approval_action_count: ${metrics.approval_action_count}`,
    '',
    '## Governance Metrics',
    '',
    `- gate_result_linkage_rate: ${governance.gate_result_linkage_rate}`,
    `- policy_stage_coverage_rate: ${governance.policy_stage_coverage_rate}`,
    `- publish_action_coverage_rate: ${governance.publish_action_coverage_rate}`,
    `- actor_user_coverage_rate: ${governance.actor_user_coverage_rate}`,
    `- timeline_semantic_context_coverage_rate: ${governance.timeline_semantic_context_coverage_rate}`,
    `- publish_event_scene_coverage_rate: ${governance.publish_event_scene_coverage_rate}`,
    `- approval_event_project_coverage_rate: ${governance.approval_event_project_coverage_rate}`,
    `- timeline_compose_job_success_rate: ${governance.timeline_compose_job_success_rate}`,
    `- timeline_render_job_success_rate: ${governance.timeline_render_job_success_rate}`,
    `- media_security_job_success_rate: ${governance.media_security_job_success_rate}`,
    `- has_gate_family: ${governance.has_gate_family ? 'yes' : 'no'}`,
    `- has_publish_family: ${governance.has_publish_family ? 'yes' : 'no'}`,
    `- has_timeline_family: ${governance.has_timeline_family ? 'yes' : 'no'}`,
    `- has_job_audit_family: ${governance.has_job_audit_family ? 'yes' : 'no'}`,
    `- has_approval_family: ${governance.has_approval_family ? 'yes' : 'no'}`,
    '',
    '## Diff vs Previous Snapshot',
    '',
    `- previous_checked_at: ${diff.previousCheckedAt ?? 'none'}`,
    `- metrics_delta_count: ${Object.keys(diff.metricsDelta).length}`,
    `- event_type_delta_count: ${Object.keys(diff.eventTypeDelta).length}`,
    '',
    '## Alerts',
    '',
    ...(alerts.length > 0
      ? [
          '| severity | key | current | threshold | message |',
          '| --- | --- | ---: | ---: | --- |',
          ...alerts.map(
            (alert) =>
              `| ${alert.severity} | ${alert.key} | ${alert.current} | ${alert.threshold} | ${alert.message} |`,
          ),
        ]
      : ['- none']),
    '',
    '## Trend Panel',
    '',
    `- window_size: ${trendSummary.window_size}`,
    `- trace_row_delta: ${trendSummary.trace_row_delta}`,
    `- timeline_event_delta: ${trendSummary.timeline_event_delta}`,
    `- job_audit_event_delta: ${trendSummary.job_audit_event_delta}`,
    `- actor_user_coverage_rate_delta: ${trendSummary.actor_user_coverage_rate_delta}`,
    `- pass_streak: ${longTermTrends.streaks.pass_streak}`,
    `- unchanged_trace_row_streak: ${longTermTrends.streaks.unchanged_trace_row_streak}`,
    `- unchanged_timeline_event_streak: ${longTermTrends.streaks.unchanged_timeline_event_streak}`,
    '',
    '## Top Event Types',
    '',
    '| event_type | count |',
    '| --- | ---: |',
    ...analysis.topSamples.eventTypes.map((entry) => `| ${entry.key} | ${entry.count} |`),
    '',
    '## Top Policy Stages',
    '',
    '| policy_stage | count |',
    '| --- | ---: |',
    ...analysis.topSamples.policyStages.map((entry) => `| ${entry.key} | ${entry.count} |`),
    '',
    '## Top Publish Actions',
    '',
    '| publish_action | count |',
    '| --- | ---: |',
    ...analysis.topSamples.publishActions.map((entry) => `| ${entry.key} | ${entry.count} |`),
    '',
    '## Consumer Distribution',
    '',
    `- consumer_bundle_path: ${consumerBundlePath}`,
    `- consumer_index_path: ${consumerIndexPath}`,
    `- consumer_feed_path: ${consumerFeedPath}`,
    `- distribution_channels_path: ${distributionChannelsPath}`,
    `- latest_pointer_path: ${latestPointerPath}`,
    `- portal_app_html_path: ${portalAppHtmlPath}`,
    `- atom_feed_path: ${atomFeedPath}`,
    `- status_badge_path: ${statusBadgePath}`,
    `- hosted_site_dir: ${hostedSiteDir}`,
    '',
  ];

  fs.writeFileSync(summaryPath, `${summaryLines.join('\n')}\n`);

  console.log(
    JSON.stringify(
      {
        status: analysis.status,
        alert_status: analysis.alert_status,
        dataset_version: analysis.datasetVersion,
        exported_at: analysis.exportedAt,
        analysis_path: analysisPath,
        diff_path: diffPath,
        alerts_path: alertsPath,
        governance_dashboard_path: governanceDashboardPath,
        governance_dashboard_html_path: governanceDashboardHtmlPath,
        governance_overview_path: governanceOverviewPath,
        notification_payload_path: notificationPayloadPath,
        threshold_matrix_path: thresholdMatrixPath,
        consumer_bundle_path: consumerBundlePath,
        consumer_index_path: consumerIndexPath,
        consumer_feed_path: consumerFeedPath,
        distribution_channels_path: distributionChannelsPath,
        latest_pointer_path: latestPointerPath,
        portal_app_html_path: portalAppHtmlPath,
        atom_feed_path: atomFeedPath,
        status_badge_path: statusBadgePath,
        hosted_site_dir: hostedSiteDir,
        hosted_portal_index_path: hostedPortalIndexPath,
        hosted_dashboard_path: hostedDashboardPath,
        summary_path: summaryPath,
        status_path: statusPath,
        history_path: historyPath,
        trend_panel_path: trendPanelPath,
      },
      null,
      2,
    ),
  );

  if (analysis.status !== 'PASS') {
    process.exitCode = 1;
  }
}

main();
