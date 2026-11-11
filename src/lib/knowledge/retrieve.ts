import chunks from "./chunks.json";

type Chunk = { id: string; text: string };
const docs = chunks as Chunk[];
const tok = (s: string) => s.toLowerCase().match(/[a-z0-9']{2,}/g) ?? [];

// Precompute BM25 stats once per server instance.
const docTokens = docs.map((d) => tok(d.text));
const avgLen = docTokens.reduce((a, t) => a + t.length, 0) / (docTokens.length || 1);
const df = new Map<string, number>();
for (const t of docTokens) for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);

export function retrieve(query: string, k = 5): Chunk[] {
  if (!docs.length) return [];
  const q = [...new Set(tok(query))];
  const N = docs.length;
  return docTokens
    .map((t, i) => {
      const tf = new Map<string, number>();
      for (const w of t) tf.set(w, (tf.get(w) ?? 0) + 1);
      let s = 0;
      for (const w of q) {
        const f = tf.get(w);
        if (!f) continue;
        const n = df.get(w) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (t.length / avgLen))));
      }
      return { i, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => docs[x.i] as Chunk);
}
