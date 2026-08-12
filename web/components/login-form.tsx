"use client";

import { useActionState, useState } from "react";

import { signInAction, signUpAction, type AuthState } from "@/app/auth/actions";

const EMPTY: AuthState = {};

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [signInState, signIn, signingIn] = useActionState(signInAction, EMPTY);
  const [signUpState, signUp, signingUp] = useActionState(signUpAction, EMPTY);

  const isSignin = mode === "signin";
  const action = isSignin ? signIn : signUp;
  const state = isSignin ? signInState : signUpState;
  const pending = isSignin ? signingIn : signingUp;

  return (
    <div className="panel p-6">
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-sm border border-line-bright">
        <button
          type="button"
          onClick={() => setMode("signin")}
          data-active={isSignin}
          className={`py-2 text-xs uppercase tracking-[0.16em] transition-colors ${
            isSignin
              ? "bg-amber/10 text-amber"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          data-active={!isSignin}
          className={`border-l border-line py-2 text-xs uppercase tracking-[0.16em] transition-colors ${
            isSignin
              ? "text-ink-faint hover:text-ink"
              : "bg-amber/10 text-amber"
          }`}
        >
          Sign up
        </button>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="label">Email</span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@desk.co"
            className="input-term"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Password</span>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignin ? "current-password" : "new-password"}
            placeholder="••••••••"
            className="input-term"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="self-start text-ink-faint hover:text-ink transition-colors text-xs"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "hide password" : "show password"}
          </button>
        </label>

        {!isSignin && (
          <p className="text-[0.7rem] leading-relaxed text-ink-faint">
            <span className="text-amber">⚠</span> Sign-up is invite-only — your
            email must be on the allowlist.
          </p>
        )}
        {state.error && <p className="text-sm text-neg">⚠ {state.error}</p>}
        {state.message && <p className="text-sm text-pos">✓ {state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="btn-term btn-exec mt-1 h-[2.4rem] w-full justify-center text-sm"
        >
          {pending ? "authenticating…" : isSignin ? "▸ Access terminal" : "▸ Create account"}
        </button>
      </form>
    </div>
  );
}
