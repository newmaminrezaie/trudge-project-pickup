import { createFileRoute } from "@tanstack/react-router";

// Placeholder for the Nova Sonic relay. Nova Sonic needs AWS bidirectional streaming,
// so point VITE_NOVA_WS_URL at an external relay (WSS) until one is hosted here.
// Until then this returns 501 and the client falls back to the Gemini engine.
export const Route = createFileRoute("/api/voice-stream")({
  server: {
    handlers: {
      GET: async () =>
        new Response("Nova Sonic relay not configured", { status: 501 }),
    },
  },
});
