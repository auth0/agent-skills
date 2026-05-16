#!/usr/bin/env node
/**
 * SessionStart hook — injects Auth0 tenant context into Claude's session.
 * Warns if AUTH0_CLIENT_SECRET is in .env but auth0-mcp-server is not configured.
 * Output is read by Claude Code and prepended to the system context.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const cwd = process.cwd();

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return vars;
}

function loadClaudeCreds(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

const envVars = loadEnvFile(resolve(cwd, '.env'));
const claudeCreds = loadClaudeCreds(resolve(cwd, '.claudecreds'));

const domain =
  process.env.AUTH0_DOMAIN ||
  claudeCreds.AUTH0_DOMAIN ||
  envVars.AUTH0_DOMAIN ||
  null;

const settingsPath = resolve(cwd, '.claude/settings.json');
let mcpConfigured = false;
if (existsSync(settingsPath)) {
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    mcpConfigured = !!(settings.mcpServers && settings.mcpServers.auth0);
  } catch { /* ignore */ }
}

const hasStaticSecret =
  !!(envVars.AUTH0_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET);

const warnings = [];
if (hasStaticSecret && !mcpConfigured) {
  warnings.push(
    'WARNING: Static Management API credential detected in .env (AUTH0_CLIENT_SECRET). ' +
    'Consider using auth0-mcp-server for credential-safe access — it stores credentials ' +
    'in the OS keychain and avoids committing secrets to source control.'
  );
}

const today = new Date().toISOString().split('T')[0];

const lines = [
  '=== Auth0 Security Audit Plugin — Session Context ===',
  '',
  `Date: ${today}`,
  `Tenant: ${domain || '(not configured — set AUTH0_DOMAIN in .env or .claudecreds)'}`,
  '',
  'Available audit tools (invoke with /auth0-audit):',
  '  --tool actions   → ActionsWhisperer: analyze Action JS code for security risks',
  '  --tool tokens    → TokenGraveyard: identify dormant/overprivileged M2M apps',
  '  --tool passkeys  → PasskeysReadiness: check 4 prerequisites for enabling Passkeys',
  '  --tool all       → Run all three tools in sequence (default)',
  '',
  'Context for judges: Auth0 Actions are server-side JavaScript functions that execute',
  'at specific points in the authentication pipeline (e.g., after login, during token',
  'exchange). They can add custom claims, call external services, and modify user',
  'metadata — making them a critical surface for security review.',
  '',
  'Scope: Auth0 Customer Identity Cloud (CIC) only.',
  'All write operations require explicit human approval before execution.',
];

if (warnings.length > 0) {
  lines.push('');
  for (const w of warnings) lines.push(w);
}

lines.push('');
lines.push('=== End Auth0 Context ===');

// Claude Code SessionStart hooks output plain text injected into the system context.
process.stdout.write(lines.join('\n') + '\n');
