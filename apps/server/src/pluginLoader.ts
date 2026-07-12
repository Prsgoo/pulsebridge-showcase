import type { IntegrationPlugin } from "pulsebridge";
import type { ProcessorPlugin } from "pulsebridge";

type AnyPlugin = IntegrationPlugin | ProcessorPlugin;

function isPluginInstance(value: unknown): value is AnyPlugin {
  if (typeof value !== "object" || value === null) return false;
  const m = (value as Record<string, unknown>)["manifest"];
  if (typeof m !== "object" || m === null) return false;
  const manifest = m as Record<string, unknown>;
  return (
    typeof manifest["kind"] === "string" && typeof manifest["id"] === "string"
  );
}

/**
 * Dynamically imports a plugin package and returns all plugin instances it
 * exports. Optionally restricts to a single named export via `entry`.
 *
 * Throws if the package cannot be imported or exports no valid plugins.
 */
export async function loadPluginsFromPackage(
  packageName: string,
  entry?: string,
): Promise<AnyPlugin[]> {
  let mod: Record<string, unknown>;
  try {
    mod = (await import(packageName)) as Record<string, unknown>;
  } catch (cause) {
    throw new Error(
      `Failed to import plugin package "${packageName}". ` +
        `Make sure it is installed (npm install ${packageName}).`,
      { cause },
    );
  }

  const candidates = entry
    ? resolveNamedEntry(mod, packageName, entry)
    : Object.entries(mod);

  const plugins: AnyPlugin[] = [];

  for (const [, value] of candidates) {
    if (typeof value !== "function") continue;
    try {
      const instance = new (value as new () => unknown)();
      if (isPluginInstance(instance)) {
        plugins.push(instance);
      }
    } catch {
      // Not a no-arg constructable class — skip.
    }
  }

  if (plugins.length === 0) {
    const hint = entry
      ? `Export "${entry}" was found but is not a valid plugin.`
      : "No exported class implements IntegrationPlugin or ProcessorPlugin.";
    throw new Error(`No plugin found in package "${packageName}". ${hint}`);
  }

  return plugins;
}

function resolveNamedEntry(
  mod: Record<string, unknown>,
  packageName: string,
  entry: string,
): Array<[string, unknown]> {
  if (!(entry in mod)) {
    throw new Error(
      `Plugin package "${packageName}" does not export "${entry}".`,
    );
  }
  return [[entry, mod[entry]]];
}
