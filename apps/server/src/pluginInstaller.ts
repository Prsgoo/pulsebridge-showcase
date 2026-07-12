import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PluginEntry } from "./configLoader.js";

const execFileAsync = promisify(execFile);

// On Windows, .cmd files must be executed via cmd.exe — execFile cannot invoke
// them directly (throws EINVAL). Args remain separate so there is no injection risk.
const [SHELL_EXE, SHELL_PREFIX] =
  process.platform === "win32"
    ? (["cmd.exe", ["/c", "npm"]] as const)
    : (["npm", []] as const);

function npmArgs(...args: string[]): [string, string[]] {
  return [SHELL_EXE, [...SHELL_PREFIX, ...args]];
}

const NPM_TIMEOUT_MS = 120_000;

export interface InstallResult {
  stdout: string;
  stderr: string;
}

/**
 * Runs `npm <action> <packageName>` in the server's working directory.
 * Times out after 2 minutes. On failure, surfaces npm's own stderr/stdout.
 */
async function runNpm(
  action: "install" | "uninstall",
  packageName: string,
  cwd: string,
): Promise<InstallResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      ...npmArgs(action, packageName),
      { cwd, timeout: NPM_TIMEOUT_MS },
    );
    return { stdout, stderr };
  } catch (cause) {
    // execFile rejects with an object that carries stdout/stderr from npm.
    const c = cause as Record<string, unknown>;
    const stderr = typeof c?.["stderr"] === "string" ? c["stderr"].trim() : "";
    const stdout = typeof c?.["stdout"] === "string" ? c["stdout"].trim() : "";
    const npmOutput = stderr || stdout || String(cause);
    throw new Error(
      `npm ${action} failed for package "${packageName}".\n${npmOutput}`,
      { cause },
    );
  }
}

export function npmInstall(
  packageName: string,
  cwd: string,
): Promise<InstallResult> {
  return runNpm("install", packageName, cwd);
}

export function npmUninstall(
  packageName: string,
  cwd: string,
): Promise<InstallResult> {
  return runNpm("uninstall", packageName, cwd);
}

const DEP_SECTIONS = ["dependencies", "optionalDependencies"] as const;

interface ServerPackageJson {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Reads the server's package.json, applies `mutate`, and writes it back only
 * when `mutate` reports a change. Keeps formatting (2-space indent, trailing LF).
 */
async function editServerPackageJson(
  serverRoot: string,
  mutate: (pkg: ServerPackageJson) => boolean,
): Promise<void> {
  const serverPkgPath = join(serverRoot, "package.json");
  const raw = await readFile(serverPkgPath, "utf-8");
  const serverPkg = JSON.parse(raw) as ServerPackageJson;

  if (!mutate(serverPkg)) return;

  await writeFile(
    serverPkgPath,
    JSON.stringify(serverPkg, null, 2) + "\n",
    "utf-8",
  );
}

/**
 * Reads the version that npm actually installed into node_modules and writes
 * it back into the server's package.json (dependencies or optionalDependencies).
 * If the package is not yet listed in either section it is added to
 * optionalDependencies (plugins are optional — the server starts fine without).
 *
 * This is necessary because `npm install @pkg@latest` updates node_modules but
 * does not always bump the version constraint already written in package.json,
 * leaving the file out of sync after an install or update.
 *
 * No-ops silently if the installed version cannot be read.
 */
export async function syncPackageJsonVersion(
  serverRoot: string,
  packageName: string,
): Promise<void> {
  let installedVersion: string;
  try {
    const raw = await readFile(
      join(serverRoot, "node_modules", packageName, "package.json"),
      "utf-8",
    );
    installedVersion = (JSON.parse(raw) as { version?: string }).version ?? "";
  } catch {
    return;
  }
  if (!installedVersion) return;

  await editServerPackageJson(serverRoot, (pkg) => {
    let found = false;
    for (const section of DEP_SECTIONS) {
      const deps = pkg[section];
      if (deps && deps[packageName] !== undefined) {
        deps[packageName] = installedVersion;
        found = true;
      }
    }
    if (!found) {
      pkg.optionalDependencies ??= {};
      pkg.optionalDependencies[packageName] = installedVersion;
    }
    return true;
  });
}

/**
 * Removes a package from dependencies and optionalDependencies in the server's
 * package.json. No-ops silently if the package is not listed.
 */
export async function removeFromPackageJson(
  serverRoot: string,
  packageName: string,
): Promise<void> {
  await editServerPackageJson(serverRoot, (pkg) => {
    let changed = false;
    for (const section of DEP_SECTIONS) {
      const deps = pkg[section];
      if (deps && deps[packageName] !== undefined) {
        Reflect.deleteProperty(deps, packageName);
        changed = true;
      }
    }
    return changed;
  });
}

/**
 * Appends a plugin entry to the `plugins` array in the config file.
 * Does nothing if the package is already listed.
 *
 * Returns whether the config was modified.
 */
export async function addPluginToConfig(
  configPath: string,
  entry: PluginEntry,
): Promise<boolean> {
  const raw = await readFile(configPath, "utf-8");
  const config = JSON.parse(raw) as {
    plugins: Array<{ package: string }>;
  };

  const alreadyListed = config.plugins.some((p) => p.package === entry.package);
  if (alreadyListed) return false;

  config.plugins.push(entry);
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return true;
}

/**
 * Removes a plugin entry from the `plugins` array in the config file.
 * Does nothing if the package is not listed.
 *
 * Returns whether the config was modified.
 */
export async function removePluginFromConfig(
  configPath: string,
  packageName: string,
): Promise<boolean> {
  const raw = await readFile(configPath, "utf-8");
  const config = JSON.parse(raw) as {
    plugins: Array<{ package: string }>;
  };

  const before = config.plugins.length;
  config.plugins = config.plugins.filter((p) => p.package !== packageName);

  if (config.plugins.length === before) return false;

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return true;
}
