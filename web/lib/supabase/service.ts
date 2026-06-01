import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requireServiceEnv } from "./env";

/**
 * Service-role Supabase client. Bypasses RLS — SERVER-ONLY. Use only with a
 * trusted, server-derived `user_id` (e.g. the agent's portfolio read), never a
 * value taken from client/model input. The `server-only` import makes a bundle
 * into client code a build error.
 */
export function createServiceClient() {
  const { url, serviceRoleKey } = requireServiceEnv();
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
