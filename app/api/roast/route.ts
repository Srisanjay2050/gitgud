import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { embedText } from "@/lib/embed";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { code, category } = await req.json();

  // Embed incoming code for RAG lookup — optional, skip gracefully if it fails
  let fewShotBlock = "";
  try {
    const queryEmbedding = await embedText(code);
    const { data: examples } = await supabase.rpc("match_roasts", {
      query_embedding: queryEmbedding,
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
    console.warn("Embedding skipped:", (e as Error).message);
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

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
      embedText(`${code}\n\n${roast}`)
        .then((embedding) =>
          supabase.from("roasts").update({ embedding }).eq("id", data.id)
        )
        .catch(() => {});
    }

    return NextResponse.json({ roast, id: data?.id });
  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ roast: msg }, { status: 500 });
  }
}
