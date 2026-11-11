import { createFileRoute } from "@tanstack/react-router";

// Voice transcription via Google AI Studio (Gemini understands audio directly,
// so the same GEMINI_API_KEY powers both chat and speech-to-text).
const MODEL = "gemini-3.8-flash";
const PROMPT =
  "Transcribe this audio verbatim in English. Output ONLY the transcribed words — no quotes, no labels, no commentary. If there is no clear speech, output nothing.";

function base64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GEMINI_API_KEY"];
        if (!apiKey) return new Response("Voice isn't configured yet.", { status: 500 });
        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof Blob) || audio.size === 0) return new Response("No audio", { status: 400 });
        if (audio.size > 15 * 1024 * 1024) return new Response("Recording too long", { status: 413 });

        const payload = JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: audio.type || "audio/webm", data: base64(await audio.arrayBuffer()) } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 512 },
        });
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
        let res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        if (res.status === 429 || res.status === 503) {
          await new Promise((r) => setTimeout(r, 3000));
          res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        }
        if (!res.ok) {
          console.error("transcribe error", res.status, await res.text());
          return new Response("Couldn't hear that clearly.", { status: 502 });
        }
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
        return Response.json({ text });
      },
    },
  },
});
