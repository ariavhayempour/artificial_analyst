import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireBrowserEnv } from "./env";

/**
 * Server Supabase client (Server Components, Server Actions, Route Handlers).
 * Reads/writes the session cookie so requests run under the user JWT and RLS
 * scopes every row to the signed-in user.
 *
 * `cookies()` is async in Next 16 — this factory is async too.
 */
export async function createClient() {
  const { url, anonKey } = requireBrowserEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
