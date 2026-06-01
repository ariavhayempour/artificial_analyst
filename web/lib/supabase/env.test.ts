import { afterEach, describe, expect, it } from "vitest";

import { requireBrowserEnv, requireServiceEnv } from "./env";

// Each test sets only the env it needs; restore the three keys afterward so
// tests stay isolated regardless of order.
const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const saved: Record<string, string | undefined> = Object.fromEntries(
  KEYS.map((k) => [k, process.env[k]]),
);

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("requireBrowserEnv", () => {
  it("returns url and anonKey when both are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-123";

    expect(requireBrowserEnv()).toEqual({
      url: "https://proj.supabase.co",
      anonKey: "anon-123",
    });
  });

  it("throws naming both vars when neither is set", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => requireBrowserEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => requireBrowserEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("throws naming only the missing var", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => requireBrowserEnv()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(() => requireBrowserEnv()).not.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL is/,
    );
  });
});

describe("requireServiceEnv", () => {
  it("returns url and serviceRoleKey when both are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-456";

    expect(requireServiceEnv()).toEqual({
      url: "https://proj.supabase.co",
      serviceRoleKey: "service-456",
    });
  });

  it("throws naming the service-role key when it is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => requireServiceEnv()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
});
