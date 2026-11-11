import { useEffect, useRef, useState } from "react";

type PlayerLike = {
  load: (src: string) => Promise<unknown>;
  dispose: (o?: { release?: boolean }) => void;
  setExpression: (id: string | null, w?: number) => boolean;
  params: { mouthOpen: number; vowel: number };
};

// Trudge's animated character (livliv model at /avatar.livliv).
export function CompanionStage({
  thinking = false,
  talking = false,
  compact = false,
}: {
  thinking?: boolean;
  talking?: boolean;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PlayerLike | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let p: PlayerLike | null = null;
    let cancelled = false;
    import("@livliv-dev/player").then(({ Player }) => {
      if (cancelled || !canvasRef.current) return;
      p = new Player(canvasRef.current, { followPointer: "page" }) as unknown as PlayerLike;
      playerRef.current = p;
      p.load("/avatar.livliv")
        .then(() => !cancelled && setReady(true))
        .catch((e: Error) => { if (e.name !== "AbortError") console.error(e); });
    });
    return () => {
      cancelled = true;
      p?.dispose({ release: true });
      playerRef.current = null;
    };
  }, []);

  // Mouth movement while a reply is streaming in.
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (!talking) { p.params.mouthOpen = 0; return; }
    let raf = 0, t = 0, target = 0;
    const tick = () => {
      t++;
      if (t % 6 === 0) { target = Math.random() < 0.2 ? 0 : 0.3 + Math.random() * 0.6; p.params.vowel = Math.random() * 2 - 1; }
      p.params.mouthOpen += (target - p.params.mouthOpen) * 0.35;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); p.params.mouthOpen = 0; };
  }, [talking, ready]);

  useEffect(() => {
    if (ready) playerRef.current?.setExpression(talking ? "smile" : null, 0.4);
  }, [talking, ready]);

  return (
    <div
      className={`relative mx-auto ${compact ? "h-36 w-28" : "h-[min(46vh,400px)] w-[min(72vw,320px)]"}`}
      aria-label="Trudge companion"
    >
      <div className={`absolute inset-x-4 bottom-2 top-1/3 rounded-full bg-sage/30 blur-3xl ${thinking ? "animate-pulse" : ""}`} />
      <canvas
        id="avatar-canvas"
        ref={canvasRef}
        className={`relative h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {!ready && <div className="trudge-orb absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full" />}
    </div>
  );
}
