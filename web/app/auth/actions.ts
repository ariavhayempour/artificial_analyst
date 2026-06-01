"use server";

import { redirect } from "next/navigation";

import { friendlyAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

/** Sign in with email/password. Redirects to the dashboard on success. */
export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendlyAuthError(error.message) };

  redirect("/"); // throws NEXT_REDIRECT — must stay outside any try/catch
}

/**
 * Register a new user. Non-allowlisted emails are rejected by the DB trigger and
 * surfaced via {@link friendlyAuthError}. On success the user signs in next.
 */
export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: friendlyAuthError(error.message) };

  return { message: "Account created — switch to Sign in to log in." };
}

/** Sign out and return to the login page. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
