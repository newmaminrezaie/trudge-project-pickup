import { createFileRoute } from "@tanstack/react-router";

// Whisper (large-v3-turbo) via Groq's OpenAI-compatible API.
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GROQ_API_KEY"];
        if (!apiKey) return new Response("Voice isn't configured yet.", { status: 500 });
        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof Blob) || audio.size === 0) return new Response("No audio", { status: 400 });
        if (audio.size > 15 * 1024 * 1024) return new Response("Recording too long", { status: 413 });
        const out = new FormData();
        out.append("file", audio, "speech.webm");
        out.append("model", "whisper-large-v3-turbo");
        out.append("language", "en");
        out.append("response_format", "json");
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: out,
        });
        if (!res.ok) {
          console.error("whisper error", res.status, await res.text());
          return new Response("Couldn't hear that clearly.", { status: 502 });
        }
        const { text } = (await res.json()) as { text?: string };
        return Response.json({ text: (text ?? "").trim() });
      },
    },
  },
});
