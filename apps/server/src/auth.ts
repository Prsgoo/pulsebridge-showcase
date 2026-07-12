import { createHash, timingSafeEqual } from "node:crypto";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { MiddlewareHandler } from "hono";
import type { PulseLogger } from "pulsebridge";

const API_KEY_ENV = "PULSEBRIDGE_API_KEY";

/** Reject keys shorter than this as misconfiguration — they offer little protection. */
const MIN_API_KEY_LENGTH = 16;

/** Failed attempts from one client within the window before it is locked out. */
const MAX_FAILED_ATTEMPTS = 10;
const FAILURE_WINDOW_MS = 15 * 60_000;
const LOCKOUT_DURATION_MS = 15 * 60_000;

/** How often stale attempt records are swept from memory. */
const CLEANUP_INTERVAL_MS = FAILURE_WINDOW_MS;

const UNKNOWN_CLIENT = "unknown";

function err(message: string): { error: { message: string } } {
  return { error: { message } };
}

/**
 * Compares two strings in constant time regardless of length. Both inputs are
 * hashed to a fixed-width digest first, so neither the key's length nor its
 * content leaks through timing.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

interface AttemptRecord {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
}

class FailedAttemptTracker {
  private readonly records = new Map<string, AttemptRecord>();

  constructor() {
    const timer = setInterval(() => this.sweep(), CLEANUP_INTERVAL_MS);
    // Don't keep the process alive just for cleanup.
    timer.unref();
  }

  /** Milliseconds remaining on an active lockout, or 0 if the client is free. */
  lockoutRemainingMs(clientId: string, now: number): number {
    const record = this.records.get(clientId);
    if (!record) return 0;
    return record.lockedUntil > now ? record.lockedUntil - now : 0;
  }

  /** Records a failure and returns the lockout duration if this trips the limit. */
  registerFailure(clientId: string, now: number): number {
    const record = this.records.get(clientId);

    if (!record || now - record.windowStartedAt > FAILURE_WINDOW_MS) {
      this.records.set(clientId, {
        failures: 1,
        windowStartedAt: now,
        lockedUntil: 0,
      });
      return 0;
    }

    record.failures += 1;
    if (record.failures >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      return LOCKOUT_DURATION_MS;
    }
    return 0;
  }

  reset(clientId: string): void {
    this.records.delete(clientId);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [clientId, record] of this.records) {
      const windowExpired = now - record.windowStartedAt > FAILURE_WINDOW_MS;
      const lockExpired = record.lockedUntil <= now;
      if (windowExpired && lockExpired) {
        this.records.delete(clientId);
      }
    }
  }
}

function clientIdOf(c: Parameters<MiddlewareHandler>[0]): string {
  try {
    return getConnInfo(c).remote.address ?? UNKNOWN_CLIENT;
  } catch {
    return UNKNOWN_CLIENT;
  }
}

export interface AuthGuard {
  /** Middleware that protects write endpoints. */
  middleware: MiddlewareHandler;
  /** Whether a usable API key was found in the environment. */
  isConfigured: boolean;
}

/**
 * Builds the API-key guard for write endpoints.
 *
 * Fails closed: when no valid key is configured, guarded requests are rejected
 * with 503 rather than left open. Read endpoints are never guarded.
 */
export function createAuthGuard(logger: PulseLogger): AuthGuard {
  const rawKey = process.env[API_KEY_ENV];
  const isConfigured =
    typeof rawKey === "string" && rawKey.length >= MIN_API_KEY_LENGTH;

  if (rawKey !== undefined && !isConfigured) {
    logger.error(
      `${API_KEY_ENV} is set but shorter than ${MIN_API_KEY_LENGTH} characters — treated as unconfigured. Write endpoints are locked.`,
    );
  }

  const tracker = new FailedAttemptTracker();

  const middleware: MiddlewareHandler = async (c, next) => {
    if (!isConfigured) {
      return c.json(
        err(
          "Server authentication is not configured. Write endpoints are disabled.",
        ),
        503,
      );
    }

    const clientId = clientIdOf(c);
    const now = Date.now();

    const lockoutMs = tracker.lockoutRemainingMs(clientId, now);
    if (lockoutMs > 0) {
      const retryAfter = Math.ceil(lockoutMs / 1000);
      logger.warn("Auth request rejected — client is locked out.", {
        client: clientId,
        retryAfterSeconds: retryAfter,
      });
      c.header("Retry-After", String(retryAfter));
      return c.json(err("Too many failed attempts. Try again later."), 429);
    }

    const provided = c.req.header("X-Api-Key");
    if (provided && constantTimeEquals(provided, rawKey)) {
      tracker.reset(clientId);
      return next();
    }

    const lockedForMs = tracker.registerFailure(clientId, now);
    logger.warn("Auth failure — invalid or missing X-Api-Key.", {
      client: clientId,
      path: c.req.path,
    });

    if (lockedForMs > 0) {
      const retryAfter = Math.ceil(lockedForMs / 1000);
      logger.warn("Client locked out after repeated auth failures.", {
        client: clientId,
        retryAfterSeconds: retryAfter,
      });
      c.header("Retry-After", String(retryAfter));
      return c.json(err("Too many failed attempts. Try again later."), 429);
    }

    return c.json(err("Unauthorized. Provide a valid X-Api-Key header."), 401);
  };

  return { middleware, isConfigured };
}
