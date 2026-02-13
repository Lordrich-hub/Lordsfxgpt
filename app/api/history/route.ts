import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/authConfig";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const AnalysisSummarySchema = z.object({
  meta: z.object({
    pair: z.string(),
    timeframe: z.string(),
    source: z.string().optional(),
    notes: z.string().optional(),
  }),
  bias: z.object({
    state: z.string(),
    reason: z.string().optional(),
  }),
  structure: z.object({
    trend_definition: z.string(),
  }),
});

const LIMIT = 20;

async function requireUserId(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session as any)?.user?.id as string | undefined;
  return userId ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.analysisHistoryItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: { analysis: true },
  });

  return NextResponse.json(rows.map((r) => r.analysis));
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AnalysisSummarySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid analysis payload",
        issues: parsed.error.issues,
      },
      { status: 422 }
    );
  }

  const pair = parsed.data.meta.pair;
  const timeframe = parsed.data.meta.timeframe;
  const biasState = parsed.data.bias.state;
  const trendDefinition = parsed.data.structure.trend_definition;

  await db.analysisHistoryItem.create({
    data: {
      userId,
      pair,
      timeframe,
      biasState,
      trendDefinition,
      analysis: raw,
    },
  });

  // Enforce per-user limit (delete older than LIMIT)
  const ids = await db.analysisHistoryItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: LIMIT,
    select: { id: true },
  });

  if (ids.length) {
    await db.analysisHistoryItem.deleteMany({
      where: { id: { in: ids.map((x) => x.id) } },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.analysisHistoryItem.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
