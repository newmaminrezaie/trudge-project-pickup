import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, RotateCcw, Square, Phone } from "lucide-react";
import { MicButton } from "@/components/trudge/MicButton";
import { CompanionStage } from "@/components/trudge/CompanionStage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trudge — Your recovery companion" },
      { name: "description", content: "A calm, always-there companion for your recovery journey, grounded in NA literature." },
      { property: "og:title", content: "Trudge — Your recovery companion" },
      { property: "og:description", content: "A calm, always-there companion for your recovery journey." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const KEY = "trudge-conversation";
const prompts = ["I'm having a craving right now", "Help me with Step One", "I need a Just for Today thought", "I relapsed and feel ashamed"];

function Index() {
  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setMessages(JSON.parse(saved) as UIMessage[]);
    } catch {}
    setLoaded(true);
    inputRef.current?.focus();
  }, [setMessages]);

  useEffect(() => {
    if (loaded && status !== "streaming") localStorage.setItem(KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (status === "ready") inputRef.current?.focus();
  }, [messages, status, loaded]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  const reset = () => {
    if (!confirm("Start fresh? This clears the conversation on this device.")) return;
    setMessages([]);
    localStorage.removeItem(KEY);
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-5 py-4">
        <span className="font-display text-2xl tracking-tight">trudge</span>
        <div className="flex items-center gap-1">
          <a href="#help" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
            <Phone className="h-3.5 w-3.5" /> Need help now
          </a>
          {!empty && (
            <button onClick={reset} aria-label="Start fresh" className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 pb-6">
          {empty ? (
            <div className="flex flex-col items-center pt-0 text-center sm:pt-4">
              <CompanionStage thinking={false} />
              <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">Just for today,<br />you're not alone.</h1>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">I'm Trudge. Talk to me about cravings, the steps, a hard day — or anything on your mind.</p>
              <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                {prompts.map((p) => (
                  <button key={p} onClick={() => send(p)} className="rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:border-primary hover:bg-secondary">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 -mx-5 flex justify-center bg-gradient-to-b from-background via-background to-transparent pb-4">
                <CompanionStage compact thinking={status === "submitted"} talking={status === "streaming"} />
              </div>
              <div className="space-y-6">
                {messages.map((m) => {
                  const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                  return m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{text}</div>
                    </div>
                  ) : (
                    <div key={m.id} className="prose-trudge text-[15px] leading-relaxed">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  );
                })}
                {status === "submitted" && (
                  <div className="flex gap-1.5 py-2" aria-label="Trudge is thinking">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-sage" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                )}
                {error && <p role="alert" className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{error.message || "Trudge couldn't reply just now. Please try again."}</p>}
                <div ref={endRef} />
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="px-4 pb-4 pt-2">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto flex max-w-2xl items-end gap-2 rounded-3xl border border-border bg-card p-2 shadow-[var(--shadow-soft)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="What's on your mind?"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {!busy && <MicButton onText={(t) => send(t)} />}
          {busy ? (
            <button type="button" onClick={stop} aria-label="Stop" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40">
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </form>
        <p id="help" className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-muted-foreground">
          Trudge is an independent companion, not affiliated with NA or any organization, and not therapy or professional treatment. In crisis, call your local emergency number.
        </p>
      </footer>
    </div>
  );
}
