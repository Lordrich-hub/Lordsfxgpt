import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth/next";
import { isAuthConfigured } from "@/lib/authConfig";
import { db } from "@/lib/db";

export const authEnabled = isAuthConfigured();

// next-auth v4 types are not exposed consistently via package exports in all environments.
// Keep this intentionally loose to avoid build failures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authOptions: any = authEnabled
  ? {
      adapter: PrismaAdapter(db),
      providers: [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }),
      ],
      session: {
        strategy: "database",
      },
      callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async session({ session, user }: any) {
          if (session.user) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (session.user as any).id = user.id;
          }
          return session;
        },
      },
    }
  : null;

export async function auth() {
  if (!authOptions) return null;
  return getServerSession(authOptions);
}
