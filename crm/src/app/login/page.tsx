"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, { error: "" });

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="text-xs font-medium tracking-[0.3em] text-text-muted uppercase">
            Plus4Performance
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-text">
            CRM <span className="text-accent">Access</span>
          </h1>
        </div>

        <form
          action={action}
          className="glow-border rounded-xl border border-border bg-surface p-6"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium text-text-muted"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium text-text-muted"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text outline-none transition focus:border-border-strong focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {state.error && (
            <p className="mt-4 text-sm text-danger">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-lg bg-accent-base px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
