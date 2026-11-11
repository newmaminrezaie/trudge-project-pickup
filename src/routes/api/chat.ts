import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";

// Placeholder endpoint. Replace the body of execute() with the real model + RAG call.
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            const id = "t1";
            const reply = `I hear you. You've shared ${messages.length > 1 ? "a few things" : "something"} with me, and that takes courage. Just for today, let's take one step at a time.\n\n*(Trudge's real responses will appear here once the recovery knowledge is connected.)*`;
            writer.write({ type: "text-start", id });
            for (const word of reply.split(/(?<= )/)) {
              writer.write({ type: "text-delta", id, delta: word });
              await new Promise((r) => setTimeout(r, 25));
            }
            writer.write({ type: "text-end", id });
          },
        });
        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
