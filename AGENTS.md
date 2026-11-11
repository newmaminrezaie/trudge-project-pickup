<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Chat streams from the server route `src/routes/api/chat.ts` (AI SDK UI message stream); it is a placeholder for the owner's own model/RAG backend, so keep the UI talking only to that endpoint.
- The companion visual lives in `src/components/trudge/CompanionStage.tsx` so the 3D model can replace it without touching the chat.
- Chat uses OpenRouter (OPENROUTER_API_KEY, read inside the handler) via @ai-sdk/openai-compatible in src/routes/api/chat.ts; why: owner's chosen provider.
- RAG is in-memory BM25 over src/lib/knowledge/chunks.json (no DB/embeddings); why: single document, runtime-neutral for Cloudflare and Vercel.
- Keep the owner's structured recovery corpus source-controlled in `src/data/living-clean.json`; why: external hosting and repository sync need the original passages without PDF extraction.
- Keep server code free of Node-only APIs; why: planned Vercel deploy (switch nitro preset to vercel then).
