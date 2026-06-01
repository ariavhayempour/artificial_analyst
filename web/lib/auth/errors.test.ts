import { describe, expect, it } from "vitest";

import { friendlyAuthError, NOT_AUTHORIZED } from "./errors";

describe("friendlyAuthError", () => {
  it("maps the allowlist trigger rejection to the not-authorized message", () => {
    // The DB trigger raises: 'Email x@y.com is not authorized to sign up'
    expect(friendlyAuthError("Email x@y.com is not authorized to sign up")).toBe(
      NOT_AUTHORIZED,
    );
  });

  it("maps Supabase's generic trigger-failure wrapper to not-authorized", () => {
    // Supabase surfaces a blocked sign-up as this opaque message.
    expect(friendlyAuthError("Database error saving new user")).toBe(
      NOT_AUTHORIZED,
    );
  });

  it("maps any message mentioning the allowlist to not-authorized", () => {
    expect(friendlyAuthError("blocked by allowlist policy")).toBe(NOT_AUTHORIZED);
  });

  it("passes through an unrelated error message unchanged", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe(
      "Invalid login credentials",
    );
  });

  it("falls back to a generic message when given an empty message", () => {
    expect(friendlyAuthError("")).toBe("Authentication failed.");
    expect(friendlyAuthError(null)).toBe("Authentication failed.");
    expect(friendlyAuthError(undefined)).toBe("Authentication failed.");
  });
});
