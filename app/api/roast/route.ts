import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

async function callGroq(prompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw Object.assign(new Error(err), { status: res.status });
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.8-flash"];

  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512 },
        }),
      }
    );

    if (res.ok) {
      const json = await res.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    const status = res.status;
    if (status !== 503 && status !== 404) break;
    console.warn(`Gemini ${model} failed with ${status}, trying next...`);
  }

  throw new Error("All Gemini models failed");
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

  let roast: string;
  try {
    // Groq is fast (< 2s) and free — use it first
    roast = await callGroq(prompt);
    console.log("Roasted with Groq");
  } catch (e) {
    const groqErr = e instanceof Error ? e.message : String(e);
    console.warn("Groq failed:", groqErr);
    try {
      roast = await callGemini(prompt);
      console.log("Roasted with Gemini");
    } catch (e2) {
      const geminiErr = e2 instanceof Error ? e2.message : String(e2);
      return NextResponse.json({ roast: `Groq: ${groqErr} | Gemini: ${geminiErr}` }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("roasts")
    .insert({ code, category, roast })
    .select()
    .single();

  if (error) console.error("Supabase error:", error);
  return NextResponse.json({ roast, id: data?.id });
}
