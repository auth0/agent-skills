import { execFileSync } from "node:child_process";

const DEFAULT_TIMEOUT = 30000;

export function auth0Exec(args, { timeout = DEFAULT_TIMEOUT } = {}) {
  try {
    const stdout = execFileSync("auth0", args, {
      timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, stdout: stdout.trim() };
  } catch (e) {
    const stderr = (e.stderr || "").toString().trim();
    const timedOut = e.killed || e.signal === "SIGTERM";
    return { ok: false, stderr, timedOut, exitCode: e.status };
  }
}

export function auth0ApiCall(method, endpoint, data = null, { timeout = DEFAULT_TIMEOUT } = {}) {
  const args = ["api", method, endpoint, "--no-input"];
  if (data) {
    args.push("--data", JSON.stringify(data));
  }
  const result = auth0Exec(args, { timeout });
  if (!result.ok) {
    return { ok: false, error: result.stderr, timedOut: result.timedOut };
  }
  try {
    return { ok: true, data: result.stdout ? JSON.parse(result.stdout) : null };
  } catch {
    return { ok: true, data: result.stdout };
  }
}

export function isSessionValid(timeout = 10000) {
  const result = auth0Exec(["api", "get", "users", "--no-input"], { timeout });
  return result.ok;
}

export function getCliVersion() {
  const result = auth0Exec(["--version"], { timeout: 5000 });
  if (!result.ok) return null;
  const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : result.stdout;
}

export function getActiveTenant(timeout = 15000) {
  const result = auth0Exec(["tenants", "list", "--csv", "--no-input"], { timeout });
  if (!result.ok) return { ok: false, error: result.stderr, timedOut: result.timedOut };

  const lines = result.stdout.split("\n").slice(1).filter((l) => l.trim());
  const activeLine = lines.find((l) => l.includes("→"));
  if (!activeLine) return { ok: false, error: "No active tenant found" };

  const domain = activeLine.split(",")[1]?.trim();
  const allTenants = lines.map((l) => l.split(",")[1]?.trim()).filter(Boolean);
  return { ok: true, domain, allTenants };
}
