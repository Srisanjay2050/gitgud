"use client";
import { useState, useEffect } from "react";

const categories = ["DSA", "React", "Node.js", "Python", "General", "CSS"];

type RoastRecord = {
  id: string;
  code: string;
  category: string;
  roast: string;
  created_at: string;
};

export default function Home() {
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("DSA");
  const [roast, setRoast] = useState("");
  const [roastId, setRoastId] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<RoastRecord[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("roasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setHistory(data);
  };

  const handleRoast = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setRoast("");
    setRoastId("");
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, category }),
      });
      const data = await res.json();
      setRoast(data.roast);
      setRoastId(data.id);
      fetchHistory();
    } catch (e) {
      setRoast("Something broke. Ironic.");
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(roast);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/roast/${roastId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-8" style={{ maxWidth: "720px", margin: "0 auto" }}>
      <h1 className="text-3xl font-medium mb-1">
        Git<span className="text-orange-500">Gud</span> 🔥
      </h1>
      <p className="text-zinc-500 text-sm mb-8">Paste your code. Get destroyed. Learn something.</p>

      <div className="flex gap-2 flex-wrap mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs border transition-all ${category === cat
              ? "bg-orange-500 border-orange-500 text-white font-medium"
              : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <textarea
        className="w-full h-48 bg-[#111] border border-zinc-700 rounded-xl p-4 font-mono text-sm text-zinc-200 resize-none focus:outline-none focus:border-orange-500 transition-colors"
        placeholder="// paste your crime here..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <button
        onClick={handleRoast}
        disabled={loading || !code.trim()}
        className="mt-3 w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl font-medium text-base transition-all"
      >
        {loading ? "Roasting..." : "Roast My Code 🔥"}
      </button>

      {roast && (
        <div className="mt-6 bg-[#111] border border-zinc-700 rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-orange-500 text-xs uppercase tracking-widest">Senior Dev Verdict</span>
            <div className="flex gap-2">
              {roastId && (
                <button
                  onClick={handleShareCopy}
                  className="text-xs text-zinc-500 border border-zinc-700 px-3 py-1 rounded-md hover:border-zinc-500 transition-all"
                >
                  {copied ? "copied!" : "share link"}
                </button>
              )}
              <button
                onClick={handleCopy}
                className="text-xs text-zinc-500 border border-zinc-700 px-3 py-1 rounded-md hover:border-zinc-500 transition-all"
              >
                copy
              </button>
            </div>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{roast}</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-zinc-500 text-xs uppercase tracking-widest mb-4">Recent Roasts</h2>
          <div className="flex flex-col gap-3">
            {history.map((r) => (
              <a
                key={r.id}
                href={`/roast/${r.id}`}
                className="bg-[#111] border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-all"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-orange-500 text-xs">{r.category}</span>
                  <span className="text-zinc-600 text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-zinc-400 text-xs font-mono truncate">{r.code.slice(0, 80)}...</p>
              </a>
            ))}
          </div>
        </div>
      )
      }
    </main >
  );
}