"use client";

import { useActionState, useState } from "react";

import { signInAction, signUpAction, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY: AuthState = {};

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signIn, signingIn] = useActionState(signInAction, EMPTY);
  const [signUpState, signUp, signingUp] = useActionState(signUpAction, EMPTY);

  const isSignin = mode === "signin";
  const action = isSignin ? signIn : signUp;
  const state = isSignin ? signInState : signUpState;
  const pending = isSignin ? signingIn : signingUp;

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-800/60 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-md py-1.5 font-medium transition ${
            isSignin ? "bg-slate-700 text-white" : "text-slate-400"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-md py-1.5 font-medium transition ${
            isSignin ? "text-slate-400" : "bg-slate-700 text-white"
          }`}
        >
          Sign up
        </button>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignin ? "current-password" : "new-password"}
            required
          />
        </div>

        {!isSignin && (
          <p className="text-xs text-slate-500">
            Sign-up is invite-only — your email must be on the allowlist.
          </p>
        )}
        {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state.message && <p className="text-sm text-emerald-400">{state.message}</p>}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "…" : isSignin ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
