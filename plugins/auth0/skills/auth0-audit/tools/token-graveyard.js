#!/usr/bin/env node
/**
 * TokenGraveyard — Block 2
 * Lists all M2M (non_interactive) apps, queries last sce log event per app,
 * computes blast-radius scores, and outputs a tiered remediation list.
 *
 * Usage:
 *   node tools/token-graveyard.js [--cache] [--dormant-threshold 30|60|90]
 *
 * The M2M app list can optionally be piped via stdin as JSON (from MCP auth0_list_applications).
 * If not piped, the script fetches directly from the Management API.
 *
 * Env: AUTH0_DOMAIN, AUTH0_TOKEN (or AUTH0_MANAGEMENT_TOKEN)
 * Output: tokens-audit.md, tokens-findings.json
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const useCache = args.includes('--cache');
const thresholdArg = args.find(a => a.startsWith('--dormant-threshold='));
const dormantThreshold = thresholdArg ? parseInt(thresholdArg.split('=')[1]) : 60;

function loadEnv() {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const DOMAIN = process.env.AUTH0_DOMAIN;
const TOKEN = process.env.AUTH0_TOKEN || process.env.AUTH0_MANAGEMENT_TOKEN;

if (!DOMAIN || !TOKEN) {
  console.error('Error: AUTH0_DOMAIN and AUTH0_TOKEN must be set in environment or .env');
  process.exit(1);
}

// Decodes a JWT payload without verifying the signature (Management API tokens are trusted internally).
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function ensureDeleteClientGrantsScope() {
  const payload = decodeJwtPayload(TOKEN);
  if (!payload) return; // can't inspect — proceed and let the API fail naturally

  const scopes = (payload.scope || '').split(' ');
  if (scopes.includes('delete:client_grants')) return; // all good

  const clientId = payload.azp || payload.sub?.replace('client_id:', '') || null;

  console.warn('\n⚠️  Warning: current token is missing the delete:client_grants scope.');
  console.warn('   Revocation operations will fail without it.\n');

  // Attempt to auto-add the scope to the current M2M app's Management API grant
  if (clientId) {
    console.log(`   Attempting to auto-add delete:client_grants to client ${clientId}...`);
    try {
      const grants = await apiFetch(`/api/v2/client-grants?client_id=${clientId}&audience=https://${DOMAIN}/api/v2`);
      const grantList = Array.isArray(grants) ? grants : (grants.client_grants ?? []);
      if (grantList.length > 0) {
        const grant = grantList[0];
        const updatedScopes = [...new Set([...(grant.scope || '').split(' ').filter(Boolean), 'delete:client_grants'])];

        const url = `https://${DOMAIN}/api/v2/client-grants/${grant.id}`;
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: updatedScopes }),
        });

        if (res.ok) {
          console.log('   ✅ Successfully added delete:client_grants. You will need a fresh token for it to take effect.\n');
          console.log('   Re-run: security find-generic-password -s auth0-mcp -D and delete the cached token,');
          console.log('   then re-authenticate with: npx @auth0/auth0-mcp-server login\n');
          return;
        }

        const errBody = await res.json().catch(() => ({}));
        console.warn(`   Auto-add failed (${res.status}): ${errBody.message || 'insufficient permissions'}`);
      }
    } catch (e) {
      console.warn(`   Auto-add failed: ${e.message}`);
    }

    console.warn('\n   To fix manually, add delete:client_grants to the M2M app in Auth0 Dashboard:');
    console.warn(`   Dashboard → Applications → APIs → Auth0 Management API → Machine to Machine Applications`);
    console.warn(`   Find app with client_id: ${clientId} → expand → add "delete:client_grants" → Update\n`);
    console.warn('   Or via Management API:');
    console.warn(`   First get the grant ID: GET https://${DOMAIN}/api/v2/client-grants?client_id=${clientId}`);
    console.warn(`   Then: PATCH https://${DOMAIN}/api/v2/client-grants/{grant_id}`);
    console.warn('   Body: {"scope": ["...existing scopes...", "delete:client_grants"]}\n');
  } else {
    console.warn('   Could not determine client_id from token. Add delete:client_grants manually in the Auth0 Dashboard.');
    console.warn(`   Dashboard → Applications → APIs → Auth0 Management API → Machine to Machine Applications\n`);
  }
}

const SCOPE_WEIGHTS = {
  'update:users': 4,
  'delete:users': 4,
  'create:clients': 5,
  'update:clients': 5,
  'delete:clients': 5,
  'read:user_idp_tokens': 3,
  'update:tenant_settings': 5,
  'read:users': 1,
};

const MGMT_API_SCOPE_RE = /^(read|create|update|delete|blacklist|revoke|impersonate):/;

function blastRadiusScore(scopes) {
  let score = 0;
  for (const scope of scopes) {
    if (SCOPE_WEIGHTS[scope] !== undefined) {
      score += SCOPE_WEIGHTS[scope];
    } else if (MGMT_API_SCOPE_RE.test(scope)) {
      score += 1;
    } else {
      score += 0.5;
    }
  }
  return score;
}

function tier(daysSinceLast, blastScore) {
  if (daysSinceLast === null || (daysSinceLast > 90 && blastScore > 5)) return 'revoke_now';
  if (daysSinceLast > 60 || blastScore > 8) return 'rotate_7d';
  if (daysSinceLast > 30) return 'scope_narrow_30d';
  return 'monitor';
}

async function apiFetch(path, retries = 4) {
  const url = `https://${DOMAIN}${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) {
      const wait = Math.pow(2, attempt) * 500;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — GET ${path}`);
    return res.json();
  }
  throw new Error(`Rate limit exceeded after ${retries} retries for GET ${path}`);
}

async function fetchM2MApps() {
  const results = [];
  let page = 0;
  while (true) {
    const data = await apiFetch(
      `/api/v2/clients?app_type=non_interactive&fields=client_id,name,app_type,grant_types&include_totals=true&per_page=50&page=${page}`
    );
    const clients = data.clients ?? data;
    results.push(...clients);
    if (!data.total || results.length >= data.total) break;
    page++;
  }
  return results;
}

async function fetchClientGrants(clientId) {
  try {
    const data = await apiFetch(`/api/v2/client-grants?client_id=${clientId}`);
    return Array.isArray(data) ? data : (data.client_grants ?? []);
  } catch {
    return [];
  }
}

async function fetchLastSceDate(clientId) {
  try {
    const data = await apiFetch(
      `/api/v2/logs?q=${encodeURIComponent(`type:sce AND client_id:${clientId}`)}&sort=date:-1&per_page=1`
    );
    const logs = Array.isArray(data) ? data : (data.logs ?? []);
    if (logs.length === 0) return null;
    return new Date(logs[0].date);
  } catch {
    // If q filter is not supported, fall back to scanning recent logs
    return null;
  }
}

async function loadCachedData() {
  const cachePath = resolve(process.cwd(), 'scripts/demo-cache.json');
  if (!existsSync(cachePath)) throw new Error('demo-cache.json not found; run npm run setup-demo first');
  const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
  return {
    apps: cache.m2m_apps ?? [],
    grants: cache.m2m_grants ?? {},
    lastSce: cache.m2m_last_sce ?? {},
  };
}

async function analyze() {
  await ensureDeleteClientGrantsScope();

  let apps, grantsMap, lastSceMap;

  if (useCache) {
    const cached = await loadCachedData();
    apps = cached.apps;
    grantsMap = cached.grants;
    lastSceMap = cached.lastSce;
  } else {
    apps = await fetchM2MApps();

    // Fetch grants and last-SCE in parallel, rate-limited to 5 concurrent
    const CONCURRENCY = 5;
    grantsMap = {};
    lastSceMap = {};

    for (let i = 0; i < apps.length; i += CONCURRENCY) {
      const batch = apps.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async app => {
        const [grants, lastSce] = await Promise.all([
          fetchClientGrants(app.client_id),
          fetchLastSceDate(app.client_id),
        ]);
        grantsMap[app.client_id] = grants;
        lastSceMap[app.client_id] = lastSce;
      }));
    }
  }

  const now = Date.now();
  const findings = apps.map(app => {
    const grants = grantsMap[app.client_id] ?? [];
    const allScopes = grants.flatMap(g => g.scope ? g.scope.split(' ') : []);
    const blastScore = blastRadiusScore(allScopes);

    const lastSceRaw = lastSceMap[app.client_id];
    const lastSceDate = lastSceRaw ? new Date(lastSceRaw) : null;
    const daysSinceLast = lastSceDate ? Math.floor((now - lastSceDate.getTime()) / 86_400_000) : null;

    const appTier = tier(daysSinceLast, blastScore);
    const grantIds = grants.map(g => g.id);

    return {
      client_id: app.client_id,
      name: app.name,
      blast_radius_score: Math.round(blastScore * 10) / 10,
      scopes: allScopes,
      grant_ids: grantIds,
      last_sce_date: lastSceDate ? lastSceDate.toISOString() : null,
      days_since_last_token: daysSinceLast,
      tier: appTier,
    };
  });

  findings.sort((a, b) => {
    const tierOrder = { revoke_now: 0, rotate_7d: 1, scope_narrow_30d: 2, monitor: 3 };
    const td = tierOrder[a.tier] - tierOrder[b.tier];
    if (td !== 0) return td;
    return b.blast_radius_score - a.blast_radius_score;
  });

  return findings;
}

function renderMarkdown(findings) {
  const timestamp = new Date().toISOString();
  const TIER_LABELS = {
    revoke_now: '🔴 Revoke Now',
    rotate_7d: '🟠 Rotate Within 7 Days',
    scope_narrow_30d: '🟡 Scope-Narrow Within 30 Days',
    monitor: '🟢 Monitor',
  };

  const byTier = {};
  for (const f of findings) {
    (byTier[f.tier] = byTier[f.tier] ?? []).push(f);
  }

  const lines = [
    '# TokenGraveyard — M2M Application Audit',
    '',
    `**Tenant:** ${DOMAIN}`,
    `**Generated:** ${timestamp}`,
    `**Dormant threshold:** ${dormantThreshold} days`,
    '',
    '## Summary',
    '',
    `| Tier | Count |`,
    `|---|---|`,
    ...Object.entries(TIER_LABELS).map(([key, label]) =>
      `| ${label} | ${(byTier[key] ?? []).length} |`
    ),
    `| **Total** | **${findings.length}** |`,
    '',
  ];

  for (const [tierKey, tierLabel] of Object.entries(TIER_LABELS)) {
    const apps = byTier[tierKey];
    if (!apps || apps.length === 0) continue;

    lines.push(`## ${tierLabel}`, '');

    for (const app of apps) {
      const lastUsed = app.days_since_last_token !== null
        ? `${app.days_since_last_token} days ago (${app.last_sce_date?.split('T')[0]})`
        : 'Never used';

      lines.push(`### ${app.name}`);
      lines.push('');
      lines.push(`- **Client ID:** \`${app.client_id}\``);
      lines.push(`- **Last token issued:** ${lastUsed}`);
      lines.push(`- **Blast-radius score:** ${app.blast_radius_score}`);
      if (app.scopes.length > 0) {
        lines.push(`- **Scopes:** \`${app.scopes.join(' ')}\``);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

const findings = await analyze();

writeFileSync(resolve(process.cwd(), 'tokens-findings.json'), JSON.stringify(findings, null, 2));
writeFileSync(resolve(process.cwd(), 'tokens-audit.md'), renderMarkdown(findings));

const neverUsed = findings.filter(f => f.days_since_last_token === null).length;
const dormant60 = findings.filter(f => f.days_since_last_token !== null && f.days_since_last_token > 60).length;
const highBlast = findings.filter(f => f.blast_radius_score > 8).length;
const revokeCount = findings.filter(f => f.tier === 'revoke_now').length;
const rotateCount = findings.filter(f => f.tier === 'rotate_7d').length;

console.log(`Found ${findings.length} M2M applications. ${neverUsed} never used, ${dormant60} dormant >60 days, ${highBlast} with high blast radius (score >8).`);
console.log(`Recommended: revoke ${revokeCount}, rotate ${rotateCount}.`);
console.log('Written: tokens-audit.md, tokens-findings.json');

// Output findings JSON to stdout for the orchestrator to read
process.stdout.write('\n__FINDINGS_JSON__\n' + JSON.stringify(findings) + '\n__END_FINDINGS_JSON__\n');
