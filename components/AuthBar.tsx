"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthBar({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <AuthBarInner />;
}

function AuthBarInner() {
  const { data: session, status } = useSession();

  const isAuthed = Boolean(session?.user);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel/40 px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Account</div>
        <div className="truncate text-sm text-slate-200">
          {status === "loading" ? "Checking session…" : isAuthed ? session?.user?.email ?? "Signed in" : "Not signed in"}
        </div>
      </div>
      {isAuthed ? (
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      ) : (
        <button
          type="button"
          className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20"
          onClick={() => void signIn("google")}
        >
          Sign in
        </button>
      )}
    </div>
  );
}
