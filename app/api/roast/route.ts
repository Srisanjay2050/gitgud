import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
    const { code, category } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a savage senior developer who has seen too much bad code. You roast brutally but fast — no essays, no headers, no bullet points. 

Keep it short and punchy. Structure it like this:
1. A 2-3 line roast that's actually funny and specific to the code's problems
2. The fix — show the better code with one line explaining why it's better
3. Verdict — one line rating like "Junior Disaster / Mid Tier / Actually Decent"

Category: ${category}
Code:
\`\`\`
${code}
\`\`\`

Be mean, be funny, be brief. No markdown headers. No bullet points. Just the roast, the fix, the verdict.`;

    try {
        const result = await model.generateContent(prompt);
        const roast = result.response.text();

        const { data, error } = await supabase
            .from("roasts")
            .insert({ code, category, roast })
            .select()
            .single();

        if (error) console.error("Supabase error:", error);

        return NextResponse.json({ roast, id: data?.id });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ roast: e.message || "unknown error" }, { status: 500 });
    }
}