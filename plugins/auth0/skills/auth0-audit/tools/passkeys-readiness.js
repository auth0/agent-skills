#!/usr/bin/env node
/**
 * PasskeysReadiness — Block 3
 * Performs a 4-checkpoint assessment of Auth0 tenant readiness for Passkeys (WebAuthn).
 *
 * Checks:
 *   1. Universal Login mode (GET /api/v2/prompts)
 *   2. WebAuthn factors enabled (GET /api/v2/guardian/factors)
 *   3. Verified custom domain (GET /api/v2/custom_domains)
 *   4. At least one SPA or native app (GET /api/v2/clients?app_type=spa,native)
 *
 * Usage:
 *   node tools/passkeys-readiness.js [--cache]
 *
 * Env: AUTH0_DOMAIN, AUTH0_TOKEN (or AUTH0_MANAGEMENT_TOKEN)
 * Output: passkeys-readiness.md
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const useCache = args.includes('--cache');

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

async function apiFetch(path, retries = 3) {
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

async function loadCachedData() {
  const cachePath = resolve(process.cwd(), 'scripts/demo-cache.json');
  if (!existsSync(cachePath)) throw new Error('demo-cache.json not found; run npm run setup-demo first');
  const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
  return {
    prompts: cache.prompts,
    guardianFactors: cache.guardian_factors,
    customDomains: cache.custom_domains,
    clients: cache.spa_native_clients,
  };
}

async function runChecks() {
  let data;
  if (useCache) {
    data = await loadCachedData();
  } else {
    const [prompts, guardianFactors, customDomains, clients] = await Promise.all([
      apiFetch('/api/v2/prompts').catch(() => null),
      apiFetch('/api/v2/guardian/factors').catch(() => null),
      apiFetch('/api/v2/custom_domains').catch(() => []),
      apiFetch('/api/v2/clients?app_type=spa,native&fields=client_id,name,app_type&per_page=100').catch(() => []),
    ]);
    data = { prompts, guardianFactors, customDomains, clients };
  }

  const checks = [];
  const blockingIssues = [];
  const remediationSteps = [];

  // Check 1: Universal Login
  const ulMode = data.prompts?.universal_login_experience;
  const ulPass = ulMode === 'new';
  checks.push({
    id: 'universal_login',
    label: 'Universal Login (New Experience)',
    passed: ulPass,
    detail: `Current value: \`universal_login_experience: "${ulMode || 'unknown'}"\``,
  });
  if (!ulPass) {
    blockingIssues.push('Universal Login is set to Classic mode — WebAuthn requires New Experience');
    remediationSteps.push(
      '**Enable Universal Login (New Experience)**\n' +
      '```\nPATCH https://{domain}/api/v2/tenants/settings\n' +
      'Authorization: Bearer {mgmt_token}\n' +
      'Content-Type: application/json\n\n' +
      '{"flags": {"universal_login": true}}\n```\n' +
      'Or: Auth0 Dashboard → Branding → Universal Login → Enable'
    );
  }

  // Check 2: WebAuthn factors
  const factors = Array.isArray(data.guardianFactors) ? data.guardianFactors : [];
  const platformFactor = factors.find(f => f.name === 'webauthn-platform');
  const roamingFactor = factors.find(f => f.name === 'webauthn-roaming');
  const webAuthnPass = !!(platformFactor?.enabled || roamingFactor?.enabled);
  checks.push({
    id: 'webauthn_factors',
    label: 'WebAuthn Factors (Guardian)',
    passed: webAuthnPass,
    detail: `webauthn-platform: ${platformFactor?.enabled ? 'enabled' : 'disabled'}, webauthn-roaming: ${roamingFactor?.enabled ? 'enabled' : 'disabled'}`,
  });
  if (!webAuthnPass) {
    blockingIssues.push('WebAuthn factors are disabled in Guardian');
    if (!platformFactor?.enabled) {
      remediationSteps.push(
        '**Enable WebAuthn Platform Authenticator**\n' +
        '```\nPUT https://{domain}/api/v2/guardian/factors/webauthn-platform\n' +
        'Authorization: Bearer {mgmt_token}\n' +
        'Content-Type: application/json\n\n' +
        '{"enabled": true}\n```'
      );
    }
    if (!roamingFactor?.enabled) {
      remediationSteps.push(
        '**Enable WebAuthn Roaming Authenticator (Security Keys)**\n' +
        '```\nPUT https://{domain}/api/v2/guardian/factors/webauthn-roaming\n' +
        'Authorization: Bearer {mgmt_token}\n' +
        'Content-Type: application/json\n\n' +
        '{"enabled": true}\n```'
      );
    }
  }

  // Check 3: Custom domain
  const domains = Array.isArray(data.customDomains) ? data.customDomains : [];
  const verifiedDomains = domains.filter(d => d.verified);
  const domainPass = verifiedDomains.length > 0;
  checks.push({
    id: 'custom_domain',
    label: 'Verified Custom Domain',
    passed: domainPass,
    detail: domainPass
      ? `Verified domains: ${verifiedDomains.map(d => d.domain).join(', ')}`
      : 'No verified custom domains found',
  });
  if (!domainPass) {
    blockingIssues.push('No verified custom domain — WebAuthn RPID binding requires a custom domain');
    remediationSteps.push(
      '**Configure a Custom Domain**\n' +
      'A custom domain (e.g., `login.yourcompany.com`) is required for WebAuthn RPID binding.\n' +
      'Auth0 Dashboard → Branding → Custom Domains → Add Domain\n\n' +
      'API: `POST /api/v2/custom_domains` with `{"domain": "login.yourcompany.com", "type": "auth0_managed_certs"}`'
    );
  }

  // Check 4: SPA/native apps
  const clientList = Array.isArray(data.clients) ? data.clients : (data.clients?.clients ?? []);
  const appPass = clientList.length > 0;
  checks.push({
    id: 'eligible_apps',
    label: 'SPA or Native Applications Registered',
    passed: appPass,
    detail: appPass
      ? `${clientList.length} eligible app(s): ${clientList.slice(0, 3).map(c => c.name).join(', ')}${clientList.length > 3 ? ` +${clientList.length - 3} more` : ''}`
      : 'No SPA or native apps found',
  });
  if (!appPass) {
    blockingIssues.push('No SPA or native applications registered — Passkeys apply to these app types only');
    remediationSteps.push(
      '**Register a SPA or Native Application**\n' +
      'Auth0 Dashboard → Applications → Create Application → Single Page App or Native\n\n' +
      'API: `POST /api/v2/clients` with `{"name": "My App", "app_type": "spa", "callbacks": ["https://yourapp.com/callback"]}`'
    );
  }

  const score = checks.filter(c => c.passed).length;
  const status = score === 4 ? 'ready' : score >= 2 ? 'partially_ready' : 'not_ready';

  return { score, status, checks, blockingIssues, remediationSteps };
}

function renderMarkdown(result) {
  const { score, status, checks, blockingIssues, remediationSteps } = result;
  const statusLabel = { ready: 'READY', partially_ready: 'PARTIALLY READY', not_ready: 'NOT READY' }[status];
  const timestamp = new Date().toISOString();

  const lines = [
    '# Passkeys Readiness Assessment',
    '',
    `**Tenant:** ${DOMAIN}`,
    `**Generated:** ${timestamp}`,
    `**Score:** ${score}/4 prerequisites met — **${statusLabel}**`,
    '',
    '## Checkpoint Results',
    '',
  ];

  for (const check of checks) {
    const icon = check.passed ? '✅' : '❌';
    lines.push(`### ${icon} ${check.label}`);
    lines.push('');
    lines.push(`${check.detail}`);
    lines.push('');
  }

  if (blockingIssues.length > 0) {
    lines.push('## Blocking Issues', '');
    blockingIssues.forEach((issue, i) => lines.push(`${i + 1}. ${issue}`));
    lines.push('');
  }

  if (remediationSteps.length > 0) {
    lines.push('## Remediation Sequence', '');
    remediationSteps.forEach((step, i) => {
      lines.push(`### Step ${i + 1}`);
      lines.push('');
      lines.push(step);
      lines.push('');
    });
  }

  if (score === 4) {
    lines.push('## Next Steps', '');
    lines.push('All prerequisites are met. To enable Passkeys:');
    lines.push('1. Navigate to Auth0 Dashboard → Security → Multi-factor Auth → Passkeys');
    lines.push('2. Enable Passkeys for your target applications');
    lines.push('3. Configure the policy (Always, Adaptive, or Optional)');
    lines.push('');
  }

  return lines.join('\n');
}

const result = await runChecks();
const markdown = renderMarkdown(result);

writeFileSync(resolve(process.cwd(), 'passkeys-readiness.md'), markdown);

const primaryBlocker = result.blockingIssues[0] ?? 'None — tenant is ready for Passkeys';
const statusLabel = { ready: 'ready', partially_ready: 'partially ready', not_ready: 'not ready' }[result.status];
console.log(`Passkeys readiness: ${result.score}/4 prerequisites met. Status: ${statusLabel}.`);
console.log(`Primary blocker: ${primaryBlocker}`);
console.log('Written: passkeys-readiness.md');
