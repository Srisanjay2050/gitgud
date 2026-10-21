# GitGud 🔥

Paste your code. Get destroyed. Learn something.

A code roasting app that uses **Gemini 2.5 Flash** to savage your code with brutal, specific feedback — then shows you the fix.

## Features

- Paste code in any category (DSA, React, Node.js, Python, CSS, General)
- Get a punchy roast: what's wrong, the fix, and a verdict
- **pgvector RAG** — as the roast history grows, the AI references similar past roasts to keep its tone consistent and category-aware
- Shareable roast links (`/roast/[id]`)
- Recent roasts feed on the homepage

## Tech Stack

- **Next.js 15** (App Router)
- **Gemini 2.5 Flash** — roast generation
- **Gemini text-embedding-004** — 768-dim embeddings for semantic similarity
- **Supabase** — Postgres + pgvector for storing roasts and running cosine similarity search
- **Tailwind CSS**

## How the RAG works

When you submit code:
1. The code is embedded using `text-embedding-004`
2. A cosine similarity search (`ivfflat` index) finds up to 3 past roasts in the same category
3. Those examples are injected into the prompt as few-shot context
4. The new roast is generated, saved, and its embedding is stored for future lookups

Cold-starts gracefully — if there are no past roasts yet, the prompt runs without examples.

## Setup

```bash
npm install
```

Create `.env.local`:

```
GEMINI_API_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Run the SQL migration in your Supabase project:

```sql
create extension if not exists vector;

create table roasts (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  category   text not null,
  roast      text not null,
  embedding  vector(768),
  created_at timestamptz default now()
);

create index roasts_embedding_idx
  on roasts using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_roasts(
  query_embedding vector(768),
  match_category  text,
  match_count     int default 3
)
returns table (id uuid, code text, roast text, similarity float)
language sql stable as $$
  select id, code, roast,
         1 - (embedding <=> query_embedding) as similarity
  from roasts
  where category = match_category
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

```bash
npm run dev
```
