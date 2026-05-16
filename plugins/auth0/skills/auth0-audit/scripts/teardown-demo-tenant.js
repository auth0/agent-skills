#!/usr/bin/env node
/**
 * teardown-demo-tenant.js — Block 5
 * Removes all synthetic demo data created by setup-demo-tenant.js.
 * Deletes Actions and M2M apps whose names start with 'demo-'.
 *
 * Usage: node scripts/teardown-demo-tenant.js [--dry-run]
 * Env: AUTH0_DOMAIN, AUTH0_TOKEN
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

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

async function apiFetch(method, path, retries = 3) {
  const url = `https://${DOMAIN}${path}`;
  if (DRY_RUN) {
    console.log(`[DRY RUN] ${method} ${url}`);
    return [];
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      continue;
    }
    if (res.status === 404 || res.status === 204) return [];
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  }
  return [];
}

async function deleteActions() {
  console.log('\n→ Deleting demo Actions...');
  const data = await apiFetch('GET', '/api/v2/actions/actions?per_page=100');
  const actions = Array.isArray(data) ? data : (data.actions ?? []);
  const demoActions = actions.filter(a => a.name?.startsWith('demo-'));

  for (const action of demoActions) {
    try {
      await apiFetch('DELETE', `/api/v2/actions/actions/${action.id}`);
      console.log(`  ✓ Deleted action: ${action.name}`);
    } catch (e) {
      console.warn(`  ✗ ${action.name}: ${e.message}`);
    }
  }

  if (demoActions.length === 0) console.log('  (no demo Actions found)');
}

async function deleteM2MApps() {
  console.log('\n→ Deleting demo M2M applications...');
  const data = await apiFetch('GET', '/api/v2/clients?app_type=non_interactive&per_page=100&fields=client_id,name');
  const clients = Array.isArray(data) ? data : (data.clients ?? []);
  const demoClients = clients.filter(c => c.name?.startsWith('demo-'));

  for (const client of demoClients) {
    try {
      // Delete client grants first
      const grants = await apiFetch('GET', `/api/v2/client-grants?client_id=${client.client_id}`);
      for (const grant of (Array.isArray(grants) ? grants : [])) {
        await apiFetch('DELETE', `/api/v2/client-grants/${grant.id}`);
      }
      await apiFetch('DELETE', `/api/v2/clients/${client.client_id}`);
      console.log(`  ✓ Deleted app: ${client.name}`);
    } catch (e) {
      console.warn(`  ✗ ${client.name}: ${e.message}`);
    }
  }

  if (demoClients.length === 0) console.log('  (no demo M2M apps found)');
}

console.log(`Auth0 Demo Tenant Teardown${DRY_RUN ? ' [DRY RUN]' : ''}`);
console.log(`Tenant: ${DOMAIN}`);
console.log('NOTE: This does NOT restore tenant settings (Login mode, WebAuthn factors).');
console.log('      Restore manually if needed: Auth0 Dashboard → Settings.');

await deleteActions();
await deleteM2MApps();

console.log('\n✅ Teardown complete. Demo data removed.');
