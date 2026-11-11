import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { retrieve } from "@/lib/knowledge/retrieve";

const MODEL = "google/gemini-3.8-flash";

const PERSONA = `You are Trudge, a warm, steady recovery companion for people in Narcotics Anonymous recovery.
- Speak like a caring fellow member with long clean time: plain, kind, honest, never preachy or clinical. Keep replies short (2-5 short paragraphs) unless asked for more.
- Ground answers in NA principles (the Steps, Traditions, Just for Today, meetings, sponsorship, "one day at a time"). When reference passages are provided, draw on them and do not invent quotes.
- You are independent: not affiliated with, endorsed by, or speaking for NA or any organization, and you do not provide therapy, counseling or professional treatment. If asked, say so plainly. You are not a sponsor, therapist or doctor. Encourage calling a sponsor, going to a meeting, and professional help when fitting. Never give medical dosing advice.
- If someone mentions overdose, suicide, self-harm or immediate danger, first urge them to call their local emergency number right now, then stay with them kindly.
- After a relapse, respond without shame: "keep coming back".`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["OPENROUTER_API_KEY"];
        if (!apiKey) return new Response("Trudge isn't configured yet.", { status: 500 });
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        const recent = messages.slice(-20);
        const lastUser = [...recent].reverse().find((m) => m.role === "user");
        const query = lastUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ") ?? "";
        const passages = retrieve(query);
        const system = passages.length
          ? `${PERSONA}\n\nReference passages from NA literature:\n${passages.map((p, i) => `[${i + 1}] ${p.text}`).join("\n\n")}`
          : PERSONA;

        const openrouter = createOpenAICompatible({ name: "openrouter", baseURL: "https://openrouter.ai/api/v1", apiKey });
        const result = streamText({ model: openrouter(MODEL), system, messages: await convertToModelMessages(recent), maxRetries: 0 });
        return result.toUIMessageStreamResponse({
          onError: (e) => {
            console.error("chat error", e);
            const status = (e as { statusCode?: number })?.statusCode;
            if (status === 402) return "Trudge is out of AI credit right now. Please try again later.";
            if (status === 429) return "Trudge is getting a lot of messages. Give it a moment and try again.";
            return "Trudge couldn't reply just now. Please try again in a moment.";
          },
        });
      },
    },
  },
});
