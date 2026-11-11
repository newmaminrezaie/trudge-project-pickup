import { createFileRoute } from "@tanstack/react-router";

// Spoken replies. Placeholder for a streaming TTS provider (e.g. AWS Nova).
// Returns 501 until configured; the browser then falls back to its built-in voice.
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provider = process.env["TTS_PROVIDER"];
        const { text } = (await request.json()) as { text?: string };
        if (!text?.trim()) return new Response("No text", { status: 400 });
        if (!provider) return new Response("TTS not configured", { status: 501 });
        // TODO(owner): call AWS Nova here and return audio (audio/mpeg or audio/wav).
        return new Response("TTS provider not implemented", { status: 501 });
      },
    },
  },
});
