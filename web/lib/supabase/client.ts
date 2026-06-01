import { createBrowserClient } from "@supabase/ssr";

import { requireBrowserEnv } from "./env";

/**
 * Browser Supabase client (Client Components). Carries the user session from
 * cookies, so all data ops run under the user JWT and RLS is the boundary.
 */
export function createClient() {
  const { url, anonKey } = requireBrowserEnv();
  return createBrowserClient(url, anonKey);
}
