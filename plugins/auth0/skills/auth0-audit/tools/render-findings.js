#!/usr/bin/env node
/**
 * render-findings.js — converts Claude-generated JSON findings to Markdown output files.
 *
 * Modes:
 *   node tools/render-findings.js actions '<JSON_ARRAY>'
 *     → writes actions-audit.md and actions-findings.json
 *
 *   node tools/render-findings.js tokens-receipt '<RECEIPTS_JSON>'
 *     → writes tokens-remediation-receipt.md
 *
 * JSON_ARRAY for actions: array of ActionsWhisperer finding objects
 * RECEIPTS_JSON: array of {timestamp, operation, target_client_id, target_client_name, scopes_revoked, executed_by}
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const [, , mode, jsonArg] = process.argv;

if (!mode || !jsonArg) {
  console.error('Usage: node tools/render-findings.js <actions|tokens-receipt> <JSON>');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(jsonArg);
} catch (e) {
  console.error('Error: could not parse JSON argument:', e.message);
  process.exit(1);
}

function renderActionsAudit(findings) {
  const timestamp = new Date().toISOString();
  const RISK_ICONS = { critical: '🚨', high: '🔴', medium: '🟠', low: '🟡', none: '🟢' };

  const byTrigger = {};
  for (const f of findings) {
    const t = f.trigger || 'unknown';
    (byTrigger[t] = byTrigger[t] ?? []).push(f);
  }

  const TRIGGER_ORDER = [
    'post-login',
    'credentials-exchange',
    'pre-user-registration',
    'post-user-registration',
    'unknown',
  ];

  const countsBySeverity = { critical: 0, high: 0, medium: 0, low: 0, none: 0 };
  for (const f of findings) countsBySeverity[f.risk_level] = (countsBySeverity[f.risk_level] ?? 0) + 1;

  const topRisk = [...findings].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    return order[a.risk_level] - order[b.risk_level];
  })[0];

  const lines = [
    '# ActionsWhisperer — Auth0 Actions Security Audit',
    '',
    `**Tenant:** ${process.env.AUTH0_DOMAIN || 'unknown'}`,
    `**Generated:** ${timestamp}`,
    `**Actions analyzed:** ${findings.length}`,
    '',
    '## Pipeline Summary',
    '',
    `| Severity | Count |`,
    `|---|---|`,
    ...Object.entries(countsBySeverity).map(([level, count]) =>
      count > 0 ? `| ${RISK_ICONS[level]} ${level.charAt(0).toUpperCase() + level.slice(1)} | ${count} |` : null
    ).filter(Boolean),
    '',
  ];

  if (topRisk && topRisk.risk_level !== 'none') {
    const topFinding = topRisk.findings?.[0];
    lines.push(`**Top risk:** ${topRisk.action_name} (${topRisk.trigger}) — ${topFinding?.description ?? topRisk.plain_english_summary}`);
    lines.push('');
  }

  for (const trigger of TRIGGER_ORDER) {
    const actions = byTrigger[trigger];
    if (!actions || actions.length === 0) continue;

    const triggerLabel = trigger.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    lines.push(`## ${triggerLabel} Pipeline`, '');

    for (const action of actions) {
      const icon = RISK_ICONS[action.risk_level] || '⚪';
      lines.push(`### ${icon} ${action.action_name}`);
      lines.push('');
      lines.push(`**Risk level:** ${action.risk_level.toUpperCase()}`);
      lines.push('');
      lines.push(action.plain_english_summary || '');
      lines.push('');

      if (action.findings && action.findings.length > 0) {
        lines.push('**Findings:**', '');
        for (const finding of action.findings) {
          lines.push(`#### ${finding.pattern}`);
          lines.push('');
          lines.push(`- **Location:** ${finding.location}`);
          lines.push(`- **Description:** ${finding.description}`);
          lines.push(`- **Remediation:** ${finding.remediation}`);
          lines.push('');
        }
      } else {
        lines.push('No security findings. This Action follows safe practices.');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function renderTokensReceipt(receipts) {
  const timestamp = new Date().toISOString();
  const lines = [
    '# TokenGraveyard — Remediation Receipt',
    '',
    `**Generated:** ${timestamp}`,
    `**Operations executed:** ${receipts.length}`,
    '',
    '## Audit Trail',
    '',
  ];

  for (const r of receipts) {
    lines.push(`### ${r.target_client_name ?? r.target_client_id}`);
    lines.push('');
    lines.push(`| Field | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Timestamp | \`${r.timestamp}\` |`);
    lines.push(`| Operation | \`${r.operation}\` |`);
    lines.push(`| Client ID | \`${r.target_client_id}\` |`);
    lines.push(`| Client Name | ${r.target_client_name ?? '—'} |`);
    lines.push(`| Grant ID | \`${r.grant_id ?? '—'}\` |`);
    lines.push(`| Scopes Revoked | \`${(r.scopes_revoked ?? []).join(' ') || '—'}\` |`);
    lines.push(`| Executed By | \`${r.executed_by ?? 'claude-session'}\` |`);
    lines.push(`| Status | ${r.status ?? 'success'} |`);
    lines.push('');
  }

  return lines.join('\n');
}

if (mode === 'actions') {
  const markdown = renderActionsAudit(data);
  writeFileSync(resolve(process.cwd(), 'actions-audit.md'), markdown);
  writeFileSync(resolve(process.cwd(), 'actions-findings.json'), JSON.stringify(data, null, 2));

  const counts = data.reduce((acc, f) => {
    acc[f.risk_level] = (acc[f.risk_level] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Analyzed ${data.length} actions. Found ${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ${counts.medium ?? 0} medium findings.`);
  console.log('Written: actions-audit.md, actions-findings.json');
} else if (mode === 'tokens-receipt') {
  const markdown = renderTokensReceipt(data);
  writeFileSync(resolve(process.cwd(), 'tokens-remediation-receipt.md'), markdown);
  console.log(`Written: tokens-remediation-receipt.md (${data.length} operations)`);
} else {
  console.error(`Unknown mode: ${mode}. Use 'actions' or 'tokens-receipt'.`);
  process.exit(1);
}
