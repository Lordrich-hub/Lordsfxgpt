import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { isAuthConfigured } from "@/lib/authConfig";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "StructureGPT",
  description: "Market structure-only analysis assistant",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const authEnabled = isAuthConfigured();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider enabled={authEnabled}>{children}</AuthProvider>
      </body>
    </html>
  );
}
