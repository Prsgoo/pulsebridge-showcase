import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const [SHELL_EXE, SHELL_PREFIX] =
  process.platform === "win32"
    ? (["cmd.exe", ["/c", "npm"]] as const)
    : (["npm", []] as const);

export interface PluginUpdateInfo {
  package: string;
  current: string;
  latest: string;
  hasUpdate: boolean;
}

export async function getInstalledVersion(
  packageName: string,
  serverRoot: string,
): Promise<string | null> {
  try {
    const pkgPath = join(
      serverRoot,
      "node_modules",
      packageName,
      "package.json",
    );
    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

// Per-package registry lookup timeout — keeps the endpoint responsive
// even if Verdaccio is slow or unreachable.
const REGISTRY_LOOKUP_TIMEOUT_MS = 5_000;

async function getLatestVersion(packageName: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      SHELL_EXE,
      [...SHELL_PREFIX, "view", packageName, "version"],
      { timeout: REGISTRY_LOOKUP_TIMEOUT_MS },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function checkPackage(
  packageName: string,
  serverRoot: string,
): Promise<PluginUpdateInfo | null> {
  const [current, latest] = await Promise.all([
    getInstalledVersion(packageName, serverRoot),
    getLatestVersion(packageName),
  ]);

  if (current === null || latest === null) return null;

  return {
    package: packageName,
    current,
    latest,
    hasUpdate: current !== latest,
  };
}

/**
 * Checks all installed plugins against the registry in parallel.
 * Each package resolves independently — a slow or unreachable registry
 * only affects that package, not the entire response.
 * Times out per-package after 5 seconds.
 */
export async function checkForUpdates(
  configPath: string,
  serverRoot: string,
): Promise<PluginUpdateInfo[]> {
  const raw = await readFile(configPath, "utf-8");
  const config = JSON.parse(raw) as { plugins: Array<{ package: string }> };

  const results = await Promise.all(
    config.plugins.map((entry) => checkPackage(entry.package, serverRoot)),
  );

  return results.filter((r): r is PluginUpdateInfo => r !== null);
}
