/**
 * Supabase environment guards.
 *
 * Read config at call time and fail with a clear, actionable error naming the
 * missing variable(s) — mirrors the Python `db.get_client()` behaviour so a
 * misconfigured deploy surfaces an obvious message, not an obscure crash.
 */

function missingList(pairs: [name: string, value: string | undefined][]): string[] {
  return pairs.filter(([, value]) => !value).map(([name]) => name);
}

/** Public (browser-safe) Supabase config: URL + anon key. */
export function requireBrowserEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing = missingList([
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
  ]);
  if (missing.length) {
    throw new Error(
      `Missing Supabase env: ${missing.join(", ")}. ` +
        "Copy web/.env.example to web/.env.local and fill in your project values.",
    );
  }
  return { url: url!, anonKey: anonKey! };
}

/**
 * Service-role config: URL + service-role key. SERVER-ONLY — this key bypasses
 * RLS and must never reach the browser (never prefix it `NEXT_PUBLIC_`).
 */
export function requireServiceEnv(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = missingList([
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ]);
  if (missing.length) {
    throw new Error(
      `Missing Supabase service env: ${missing.join(", ")}. ` +
        "SUPABASE_SERVICE_ROLE_KEY is server-only — never expose it to the browser.",
    );
  }
  return { url: url!, serviceRoleKey: serviceRoleKey! };
}
