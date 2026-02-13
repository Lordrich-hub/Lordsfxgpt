import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { visionPrompt } from "@/lib/visionPrompt";
import { buildAnalysis } from "@/lib/structureEngine";
import { generateDemoAnalysis } from "@/lib/demoAnalyzer";
import { ChartState, TopDownFrame } from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

const ChartStateSchema: z.ZodType<ChartState> = z.object({
  pair: z.string().optional(),
  timeframe: z.string().optional(),
  current_price: z.number().finite().optional(),
  price_region: z.string().optional(),
  trend_hint: z.enum(["bullish", "bearish", "range", "transition", "unknown"]),
  swings: z
    .array(
      z.object({
        type: z.enum(["SwingHigh", "SwingLow"]),
        label: z.string(),
        zone: z.string(),
        price: z.number().finite().optional(),
      })
    ),
  breaks: z
    .array(
      z.object({
        type: z.enum(["bos", "shift", "none"]),
        confirmed: z.boolean(),
        description: z.string().optional(),
      })
    ),
  range: z
    .object({
      hasRange: z.boolean(),
      topZone: z.string().optional(),
      bottomZone: z.string().optional(),
      falseBreaks: z.boolean().optional(),
    }),
  chop_detected: z.boolean().optional(),
  retest_present: z.boolean().optional(),
  notes: z.string().optional(),
  top_down: z
    .array(
      z.object({
        timeframe: z.string(),
        bias: z.union([
          z.enum(["bullish", "bearish", "range", "transition", "unknown"]),
          z.enum(["Bullish", "Bearish", "Range", "Transition"]),
        ]),
        key_level: z.string().optional(),
        narrative: z.string().optional(),
      })
    )
    .optional(),
});

function demoFallback(reason: string) {
  const demo = generateDemoAnalysis();
  return {
    ...demo,
    meta: {
      ...demo.meta,
      source: "Demo Mode (fallback)",
      notes: `${demo.meta.notes}${reason ? ` | ${reason}` : ""}`,
    },
  };
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    
    if (!apiKey) {
      return NextResponse.json(demoFallback("OPENAI_API_KEY missing"));
    }
    
    // Get OpenAI client inside the function
    const openai = getOpenAIClient();

    const contentType = req.headers.get("content-type") || "";

    // Handle direct chart state submission (from manual input)
    if (contentType.includes("application/json")) {
      const raw = await req.json();
      const chartState = ChartStateSchema.parse(raw);
      const analysis = buildAnalysis(chartState);
      return NextResponse.json(analysis);
    }

    // Handle one or multiple image uploads (top-down)
    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        return NextResponse.json({ error: "Invalid file type. Please upload image files." }, { status: 400 });
      }
      const buf = await f.arrayBuffer();
      if (buf.byteLength > MAX_SIZE) {
        return NextResponse.json({ error: `Image ${f.name} is too large. Max 8MB.` }, { status: 400 });
      }
    }

    if (apiKey.includes("your_openai_key_here") || apiKey.length < 20) {
      return NextResponse.json(demoFallback("OPENAI_API_KEY invalid"));
    }

    const chartStates: ChartState[] = [];

    for (const f of files) {
      try {
        const base64 = Buffer.from(await f.arrayBuffer()).toString("base64");
        const imageUrl = `data:${f.type};base64,${base64}`;
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: visionPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract chart_state from this TradingView screenshot. Return JSON only." },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 2000,
        });

        const text = response.choices[0]?.message?.content;
        if (!text) {
          throw new Error("Empty response from AI Vision service");
        }
        
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (parseErr) {
          throw new Error("Failed to parse AI response as JSON");
        }

        const validated = ChartStateSchema.parse(parsed);
        chartStates.push(validated);
      } catch (fileError: any) {
        console.error(`Error processing file ${f.name}:`, {
          message: fileError?.message,
          status: fileError?.status,
          type: fileError?.type,
          code: fileError?.code,
        });

        const msg = String(fileError?.message || "").toLowerCase();
        const code = String(fileError?.code || "");

        const isNetworkish =
          code === "ECONNRESET" ||
          code === "ENOTFOUND" ||
          code === "ECONNREFUSED" ||
          msg.includes("fetch failed") ||
          msg.includes("connection") ||
          msg.includes("network") ||
          msg.includes("econn") ||
          msg.includes("enotfound");

        const isTimeout = msg.includes("timeout") || msg.includes("timed out");
        const isRateLimit = fileError?.status === 429 || msg.includes("429");

        if (isNetworkish || isTimeout || isRateLimit) {
          console.warn("[ANALYZE] Falling back to demo analysis due to OpenAI connectivity issue");
          return NextResponse.json(demoFallback("OpenAI unreachable; fallback used"));
        }

        throw fileError;
      }
    }

    // Compose top-down: last file treated as execution timeframe
    const primary = chartStates[chartStates.length - 1];
    const topDown: TopDownFrame[] = chartStates.map((cs, idx) => ({
      timeframe: cs.timeframe || `TF-${idx + 1}`,
      bias: cs.trend_hint,
      key_level: cs.price_region,
      narrative: cs.notes,
    }));

    const analysis = buildAnalysis({ ...primary, top_down: topDown }, chartStates);

    return NextResponse.json(analysis);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            "Invalid chart_state payload. Ensure required fields are present and numeric prices are numbers (not strings).",
          issues: error.issues,
        },
        { status: 422 }
      );
    }

    console.error("/api/analyze error:", {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.constructor?.name,
      fullError: JSON.stringify(error, null, 2),
    });
    
    // Handle AI service errors
    if (error?.status === 401 || error?.message?.includes("401")) {
      return NextResponse.json(
        { error: "AI service authentication failed. Invalid API key." },
        { status: 500 }
      );
    }
    
    if (error?.status === 429 || error?.message?.includes("429")) {
      return NextResponse.json(
        { error: "Service temporarily busy. Please wait 60 seconds and try again." },
        { status: 500 }
      );
    }

    if (
      error?.code === "ECONNRESET" ||
      error?.code === "ENOTFOUND" ||
      error?.code === "ECONNREFUSED" ||
      error?.message?.toLowerCase().includes("fetch failed") ||
      error?.message?.toLowerCase().includes("connection")
    ) {
      return NextResponse.json(
        { error: `Connection error: ${error?.message || "Network unreachable"}. Check that OpenAI API is accessible.` },
        { status: 500 }
      );
    }

    if (error?.message?.includes("Empty response")) {
      return NextResponse.json(
        { error: "Chart image unclear. Please upload a clearer screenshot and try again." },
        { status: 500 }
      );
    }

    if (error?.message?.includes("JSON")) {
      return NextResponse.json(
        { error: "Analysis failed. Please try uploading a different chart image." },
        { status: 500 }
      );
    }

    if (error?.message?.includes("Timeout") || error?.message?.includes("timeout")) {
      return NextResponse.json(
        { error: "Request timed out. AI service is processing slowly. Please try again." },
        { status: 500 }
      );
    }
    
    const errorMessage = error?.message || "Analysis failed. Please check console for details.";
    return NextResponse.json({ error: `Error: ${errorMessage}` }, { status: 500 });
  }
}
