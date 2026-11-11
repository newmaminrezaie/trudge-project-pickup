import { createFileRoute } from "@tanstack/react-router";

// Spoken replies via Gemini TTS (same GEMINI_API_KEY). Gemini returns 24 kHz 16-bit mono PCM;
// we wrap it in a WAV header so the browser can play it and drive lip sync.
const MODEL = "gemini-2.5-flash-preview-tts";
const VOICE = "Charon"; // warm, steady male voice
const STYLE =
  "Read this aloud in a warm, steady male voice — like a caring counselor sitting across the room. Speak slowly and naturally, with gentle pauses, soft emphasis, and a calm, reassuring tone: ";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function wav(pcm: Uint8Array, rate = 24000): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const v = new DataView(out.buffer);
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["GEMINI_API_KEY"];
        if (!apiKey) return new Response("Voice isn't configured yet.", { status: 500 });
        const { text } = (await request.json()) as { text?: string };
        if (!text?.trim()) return new Response("No text", { status: 400 });

        const payload = JSON.stringify({
          contents: [{ parts: [{ text: STYLE + text.slice(0, 2000) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
          },
        });
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
        let res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 2000));
          res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
        }
        if (!res.ok) {
          console.error("tts error", res.status, await res.text());
          return new Response("Voice unavailable", { status: 502 });
        }
        const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
        const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
        if (!part?.data) return new Response("No audio", { status: 502 });
        const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24000);
        return new Response(wav(b64ToBytes(part.data), rate).buffer as ArrayBuffer, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
      },
    },
  },
});
