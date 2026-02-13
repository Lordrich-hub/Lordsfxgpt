import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import { authOptions } from "@/auth";

export default async function authHandler(req: NextApiRequest, res: NextApiResponse) {
  if (!authOptions) {
    res.status(501).json({
      error:
        "Authentication is not configured on this deployment. Set NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.",
    });
    return;
  }

  // NextAuth v4 API Route handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (NextAuth as any)(req, res, authOptions);
}
