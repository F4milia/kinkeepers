import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { log, logError } from "@/lib/log";
import { getDefaultZoomCredentials, getZoomAccessToken } from "@/lib/zoom/client";

export type DependencyStatus = "healthy" | "unhealthy" | "not_configured";

export interface HealthCheckResult {
  status: "healthy" | "degraded";
  checks: {
    database: { status: DependencyStatus; error?: string };
    auth: { status: DependencyStatus; error?: string };
    zoom: { status: DependencyStatus; error?: string };
  };
}

const CHECK_TIMEOUT_MS = 3000;

// A dependency that's hanging (not just erroring) shouldn't hang this
// endpoint too - P7b's uptime monitoring polls this on a schedule and
// needs a bounded response either way.
// Accepts PromiseLike, not just Promise - Supabase's query builders are
// thenable but don't implement the full Promise interface (no .catch/
// .finally), so a strict Promise<T> parameter rejects them at compile time.
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function checkDatabase(): Promise<HealthCheckResult["checks"]["database"]> {
  try {
    const admin = createAdminClient();
    const { error } = await withTimeout(
      admin.from("profiles").select("id").limit(1),
      CHECK_TIMEOUT_MS,
    );
    if (error) return { status: "unhealthy", error: error.message };
    return { status: "healthy" };
  } catch (err) {
    return { status: "unhealthy", error: (err as Error).message };
  }
}

async function checkAuth(): Promise<HealthCheckResult["checks"]["auth"]> {
  try {
    const admin = createAdminClient();
    const { error } = await withTimeout(
      admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      CHECK_TIMEOUT_MS,
    );
    if (error) return { status: "unhealthy", error: error.message };
    return { status: "healthy" };
  } catch (err) {
    return { status: "unhealthy", error: (err as Error).message };
  }
}

// Cheapest real reachability check: exchange for an access token. Doesn't
// create a meeting or touch any real cohort/session data - just proves
// the credentials are valid and Zoom's OAuth endpoint is reachable.
// Still "not_configured", not "unhealthy", when credentials are absent -
// this project has no Zoom credentials configured anywhere yet (confirmed
// while building P3), so that's the expected state today, not a failure.
async function checkZoom(): Promise<HealthCheckResult["checks"]["zoom"]> {
  let credentials;
  try {
    credentials = getDefaultZoomCredentials();
  } catch {
    return { status: "not_configured" };
  }

  try {
    await withTimeout(getZoomAccessToken(credentials), CHECK_TIMEOUT_MS);
    return { status: "healthy" };
  } catch (err) {
    return { status: "unhealthy", error: (err as Error).message };
  }
}

export async function checkHealth(): Promise<HealthCheckResult> {
  const [database, auth, zoom] = await Promise.all([checkDatabase(), checkAuth(), checkZoom()]);

  const anyUnhealthy = [database, auth, zoom].some((check) => check.status === "unhealthy");
  const result: HealthCheckResult = {
    status: anyUnhealthy ? "degraded" : "healthy",
    checks: { database, auth, zoom },
  };

  if (anyUnhealthy) {
    logError("health_check", {
      status: result.status,
      database: database.status,
      auth: auth.status,
      zoom: zoom.status,
    });
  } else {
    log("health_check", {
      status: result.status,
      database: database.status,
      auth: auth.status,
      zoom: zoom.status,
    });
  }

  return result;
}
