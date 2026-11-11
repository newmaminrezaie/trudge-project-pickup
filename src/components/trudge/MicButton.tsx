import { useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";

type State = "idle" | "recording" | "transcribing";

export function MicButton({ onText }: { onText: (text: string) => void }) {
  const [state, setState] = useState<State>("idle");
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        try {
          const fd = new FormData();
          fd.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!res.ok) throw new Error(await res.text());
          const { text } = (await res.json()) as { text: string };
          if (text) onText(text);
        } catch {
          setErr("Couldn't catch that. Try again?");
        } finally {
          setState("idle");
        }
      };
      recRef.current = rec;
      rec.start();
      setState("recording");
    } catch {
      setErr("Microphone access is needed to talk.");
    }
  }

  function toggle() {
    if (state === "recording") recRef.current?.stop();
    else if (state === "idle") start();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={state === "transcribing"}
        aria-label={state === "recording" ? "Stop recording" : "Talk to Trudge"}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
          state === "recording" ? "animate-pulse bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        }`}
      >
        {state === "transcribing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
      </button>
      {err && (
        <span className="absolute bottom-12 right-0 whitespace-nowrap rounded-md bg-card px-2 py-1 text-[11px] text-muted-foreground shadow-[var(--shadow-soft)]">
          {err}
        </span>
      )}
    </div>
  );
}
