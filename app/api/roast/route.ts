import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const BASE_URL = "https://generativelanguage.googleapis.com/v1/models";

async function callGemini(model: string, prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw Object.assign(new Error(err), { status: res.status });
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function POST(req: NextRequest) {
  const { code, category } = await req.json();

  let fewShotBlock = "";
  try {
    const { data: examples } = await supabase.rpc("match_roasts_trgm", {
      query_code: code,
      match_category: category,
      match_count: 3,
    });
    if (examples && examples.length > 0) {
      fewShotBlock =
        `\nHere are some previous roasts you made in this category — match this tone and style:\n` +
        examples
          .map(
            (ex: { code: string; roast: string }, i: number) =>
              `--- Example ${i + 1} ---\nCode:\n\`\`\`\n${ex.code.slice(0, 300)}\n\`\`\`\nRoast: ${ex.roast}\n`
          )
          .join("\n");
    }
  } catch (e) {
    console.warn("RAG lookup skipped:", (e as Error).message);
  }

  const prompt = `You are a savage senior developer who has seen too much bad code. You roast brutally but fast — no essays, no headers, no bullet points.

Keep it short and punchy. Structure it like this:
1. A 2-3 line roast that's actually funny and specific to the code's problems
2. The fix — show the better code with one line explaining why it's better
3. Verdict — one line rating like "Junior Disaster / Mid Tier / Actually Decent"
${fewShotBlock}
Category: ${category}
Code:
\`\`\`
${code}
\`\`\`

Be mean, be funny, be brief. No markdown headers. No bullet points. Just the roast, the fix, the verdict.`;

  // Try stable v1 models first, fall back to gemini-3.8-flash
  const models = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-3.8-flash",
  ];

  let lastError: unknown;
  for (const modelName of models) {
    // For gemini-3.8-flash (last resort), retry up to 3x on 503
    const maxAttempts = modelName === "gemini-3.8-flash" ? 3 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
      try {
        const roast = await callGemini(modelName, prompt);

        const { data, error } = await supabase
          .from("roasts")
          .insert({ code, category, roast })
          .select()
          .single();

        if (error) console.error("Supabase error:", error);
        console.log(`Roasted with ${modelName}`);
        return NextResponse.json({ roast, id: data?.id });
      } catch (e: unknown) {
        lastError = e;
        const status = (e as { status?: number }).status;
        const msg = e instanceof Error ? e.message : "";
        if (status === 503 || msg.includes("503")) {
          console.warn(`${modelName} attempt ${attempt + 1} 503, retrying...`);
          continue;
        }
        // 404 or other error — move to next model
        console.warn(`${modelName} failed (${status ?? "unknown"}), trying next...`);
        break;
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : "unknown error";
  return NextResponse.json({ roast: msg }, { status: 500 });
}
