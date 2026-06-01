/**
 * Map raw Supabase auth errors to user-facing messages.
 *
 * The invite-only allowlist is enforced by a database trigger; when it blocks a
 * sign-up the failure surfaces as an opaque error, so we translate it into a
 * clear hint. Ported from `db._friendly_auth_error` in the Python app.
 */

export const NOT_AUTHORIZED =
  "This email is not authorized to sign up. Ask an admin to add you to the allowlist.";

export function friendlyAuthError(message: string | null | undefined): string {
  const msg = (message ?? "").trim();
  const low = msg.toLowerCase();
  if (
    low.includes("not authorized") ||
    low.includes("allowlist") ||
    low.includes("database error saving new user")
  ) {
    return NOT_AUTHORIZED;
  }
  return msg || "Authentication failed.";
}
