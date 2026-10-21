export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-exp-03-07:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.embedding.values as number[];
}
