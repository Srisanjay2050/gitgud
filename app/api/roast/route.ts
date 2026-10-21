import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { embedText } from "@/lib/embed";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { code, category } = await req.json();

  // Embed incoming code for RAG lookup
  const queryEmbedding = await embedText(code);

  // Fetch similar past roasts in the same category
  const { data: examples } = await supabase.rpc("match_roasts", {
    query_embedding: queryEmbedding,
    match_category: category,
    match_count: 3,
  });

  const fewShotBlock =
    examples && examples.length > 0
      ? `\nHere are some previous roasts you made in this category — match this tone and style:\n` +
        examples
          .map(
            (ex: { code: string; roast: string }, i: number) =>
              `--- Example ${i + 1} ---\nCode:\n\`\`\`\n${ex.code.slice(0, 300)}\n\`\`\`\nRoast: ${ex.roast}\n`
          )
          .join("\n")
      : "";

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

  try {
    const result = await model.generateContent(prompt);
    const roast = result.response.text();

    // Save roast then backfill its embedding async (don't block the response)
    const { data, error } = await supabase
      .from("roasts")
      .insert({ code, category, roast })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
    } else if (data?.id) {
      // Embed the roast text for future RAG lookups, fire-and-forget
      embedText(`${code}\n\n${roast}`)
        .then((embedding) =>
          supabase
            .from("roasts")
            .update({ embedding })
            .eq("id", data.id)
        )
        .catch((e) => console.error("Embedding backfill failed:", e));
    }

    return NextResponse.json({ roast, id: data?.id });
  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ roast: msg }, { status: 500 });
  }
}
