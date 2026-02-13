"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export function AuthProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return <SessionProvider>{children}</SessionProvider>;
}
