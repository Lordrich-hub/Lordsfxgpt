import { NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/authConfig";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ enabled: isAuthConfigured() });
}
