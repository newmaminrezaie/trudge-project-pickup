import { useEffect, useRef, useState } from "react";

type PlayerLike = {
  load: (src: string) => Promise<unknown>;
  dispose: (o?: { release?: boolean }) => void;
  setExpression: (id: string | null, w?: number) => boolean;
  act: (action: string) => void;
  params: { mouthOpen: number; vowel: number };
};

// Official voice driver from @livliv-dev/player/voice (queued TTS clips with lip sync).
export type SpeechLike = {
  say: (clip: string | Blob | ArrayBuffer) => void;
  stop: () => void;
  unlock: () => void;
  dispose: () => void;
  readonly busy: boolean;
  onIdle?: (() => void) | undefined;
};

// Trudge's animated character (livliv model at /avatar.livliv).
export function CompanionStage({
  thinking = false,
  talking = false,
  compact = false,
  hearing = false,
  mouth,
  listenLevel,
  speechRef,
}: {
  /** Live mouth level 0..1 from the nova engine (gemini uses the official speech driver). */
  mouth?: { current: number } | undefined;
  /** Live mic level 0..1 to show Trudge is hearing. */
  listenLevel?: { current: number } | undefined;
  /** Receives the official speech driver once the model is ready. */
  speechRef?: { current: SpeechLike | null };
  thinking?: boolean;
  talking?: boolean;
  compact?: boolean;
  /** User's voice is being detected — Trudge nods along. */
  hearing?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PlayerLike | null>(null);
  const speechObjRef = useRef<SpeechLike | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let p: PlayerLike | null = null;
    let cancelled = false;
    Promise.all([import("@livliv-dev/player"), import("@livliv-dev/player/voice")]).then(([{ Player }, { createSpeech }]) => {
      if (cancelled || !canvasRef.current) return;
      p = new Player(canvasRef.current, { followPointer: "page" }) as unknown as PlayerLike;
      playerRef.current = p;
      p.load("/avatar.livliv")
        .then(() => {
          if (cancelled) return;
          // Natural motion: loudness + real vowel shapes + subtle head movement while speaking.
          const speech = createSpeech(p as never, { motion: 1, bounce: false }) as unknown as SpeechLike;
          speechObjRef.current = speech;
          if (speechRef) speechRef.current = speech;
          setReady(true);
        })
        .catch((e: Error) => { if (e.name !== "AbortError") console.error(e); });
    });
    return () => {
      cancelled = true;
      speechObjRef.current?.dispose();
      speechObjRef.current = null;
      if (speechRef) speechRef.current = null;
      p?.dispose({ release: true });
      playerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Nova engine only: apply its live mouth level (gemini lip sync is driven by the speech driver).
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !ready || !mouth) return;
    let raf = 0;
    const tick = () => {
      p.params.mouthOpen += (Math.max(0, mouth.current) - p.params.mouthOpen) * 0.35;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); p.params.mouthOpen = 0; };
  }, [ready, mouth]);

  // Empathic listening: one gentle nod when the user's voice is first detected.
  const noddedRef = useRef(false);
  useEffect(() => {
    if (hearing && ready && !noddedRef.current) {
      noddedRef.current = true;
      playerRef.current?.act("nod");
    }
    if (!hearing) noddedRef.current = false;
  }, [hearing, ready]);

  // Soft glow that follows the user's voice while listening.
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listenLevel) return;
    let raf = 0, v = 0;
    const tick = () => {
      v += (listenLevel.current - v) * 0.2;
      if (glowRef.current) { glowRef.current.style.opacity = String(0.3 + v * 0.7); glowRef.current.style.transform = `scale(${1 + v * 0.25})`; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [listenLevel]);

  useEffect(() => {
    if (ready) playerRef.current?.setExpression(talking ? "smile" : null, 0.4);
  }, [talking, ready]);

  return (
    <div
      className={`relative mx-auto ${compact ? "h-36 w-28" : "h-[min(40vh,380px)] w-[min(72vw,320px)]"}`}
      aria-label="Trudge companion"
    >
      <div ref={glowRef} className={`absolute inset-x-4 transition-transform bottom-2 top-1/3 rounded-full bg-sage/30 blur-3xl ${thinking ? "animate-pulse" : ""}`} />
      <canvas
        id="avatar-canvas"
        ref={canvasRef}
        style={{ maskImage: "linear-gradient(to bottom, black 75%, transparent)" }}
        className={`relative h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {!ready && <div className="trudge-orb absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full" />}
    </div>
  );
}
