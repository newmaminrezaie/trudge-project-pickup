# Connect Trudge to Gemini (via OpenRouter) with your recovery document

## What you'll get
- Trudge gives real replies from Google Gemini, using your OpenRouter key, word by word as now.
- Each reply first looks up the most relevant passages in your recovery document and answers from them, in a warm, sponsor-like but non-clinical voice.
- If the AI is unavailable or out of credit, the chat shows a short, kind error message instead of a fake reply.
- The chat screen and 3D character stay exactly as they are.

## Steps
1. Write Trudge's personality and safety guidance (companion, not a doctor or sponsor; points to crisis help when someone is in danger).
2. Replace the stand-in reply with a real Gemini call through OpenRouter, sending the recent conversation plus the matching document passages.
3. Set up the document search: once you send the PDF or text file, I turn it into searchable passages kept inside the app. No database is needed for one file.
4. Test a real message end to end and check the reply uses the document.

## Needed from you
- The document (PDF or text file). Until it arrives, Trudge answers from Gemini alone.

## Technical details
- `src/routes/api/chat.ts`: AI SDK `streamText` with an OpenAI-compatible provider pointed at `https://openrouter.ai/api/v1`, key `process.env.OPENROUTER_API_KEY` read inside the handler, model id a Gemini Flash id confirmed against the OpenRouter model list; stream returned as a UI message stream (the client is unchanged). Errors (402/403/429/5xx) are passed through as a stream error with a safe message, with no automatic retries.
- RAG: the document is parsed to text, split into about 800-token overlapping chunks, and saved as `src/lib/knowledge/chunks.json`. Retrieval uses in-memory BM25 keyword ranking over the last user turn (top 5 chunks). This runs the same on Cloudflare and Vercel with no vector DB or embeddings bill; it can be upgraded to embeddings later.
- Vercel: the code stays runtime-neutral (no Node-only APIs). When you deploy, the server build target changes to the Vercel preset and `OPENROUTER_API_KEY` is set in Vercel's environment settings. This is noted in AGENTS.md.
