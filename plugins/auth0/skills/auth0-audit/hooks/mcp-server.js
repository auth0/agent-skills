#!/usr/bin/env node
/**
 * MCP server wrapper — ensures the auth0-mcp-server keychain token is
 * initialised (device authorization flow) before spawning the server.
 *
 * On first run (or when the stored token has expired) this script executes
 * `npx @auth0/auth0-mcp-server init`, which opens the Auth0 device-auth
 * page in the browser and persists the resulting token in the OS keychain.
 * Subsequent runs skip `init` and go straight to `run`.
 */

import { execSync, spawn } from 'child_process';

function keychainTokenExists() {
  try {
    const token = execSync('security find-generic-password -s auth0-mcp -w 2>/dev/null', {
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000,
    }).toString().trim();
    return Boolean(token);
  } catch {
    return false;
  }
}

// ── Init (device auth) if no keychain token is present ───────────────────────

if (!keychainTokenExists()) {
  process.stderr.write('auth0-mcp: no keychain token found — running init (device auth flow)…\n');
  try {
    execSync('npx @auth0/auth0-mcp-server init', { stdio: 'inherit' });
  } catch (err) {
    process.stderr.write(`auth0-mcp: init failed: ${err.message}\n`);
    process.exit(1);
  }
}

// ── Spawn MCP server ──────────────────────────────────────────────────────────

const child = spawn('npx', ['@auth0/auth0-mcp-server', 'run'], {
  env: process.env,
  stdio: 'inherit',
});

child.on('error', err => {
  process.stderr.write(`auth0-mcp: failed to start auth0-mcp-server: ${err.message}\n`);
  process.exit(1);
});

child.on('exit', code => process.exit(code ?? 0));

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => child.kill(sig));
}
