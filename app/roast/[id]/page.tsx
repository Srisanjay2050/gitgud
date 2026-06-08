import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export default async function RoastPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const { data } = await supabase
        .from("roasts")
        .select("*")
        .eq("id", id)
        .single();

    if (!data) return notFound();

    return (
        <main className="min-h-screen bg-[#0a0a0a] text-white p-8" style={{ maxWidth: "720px", margin: "0 auto" }}>
            <a href="/" className="text-zinc-500 text-sm hover:text-orange-500 transition-colors mb-8 block">← back to GitGud</a>
            <h1 className="text-3xl font-medium mb-1">Git<span className="text-orange-500">Gud</span> 🔥</h1>
            <p className="text-zinc-500 text-sm mb-8">Someone got roasted.</p>

            <div className="bg-[#111] border border-zinc-700 rounded-xl p-4 font-mono text-sm text-zinc-300 mb-6 whitespace-pre-wrap overflow-x-auto">
                {data.code}
            </div>

            <div className="bg-[#111] border border-zinc-700 rounded-xl p-5">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-orange-500 text-xs uppercase tracking-widest">Senior Dev Verdict</span>
                    <span className="text-zinc-600 text-xs border border-zinc-800 px-2 py-0.5 rounded-full">{data.category}</span>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{data.roast}</p>
            </div>
        </main>
    );
}