import { useCallback, useEffect, useRef, useState } from "react";

export type VoicePhase = "off" | "greeting" | "listening" | "hearing" | "transcribing" | "thinking" | "speaking";

// Tuning for silence detection (VAD).
const SPEECH_RMS = 0.035; // above = voice
const SILENCE_MS = 1300; // pause that ends a thought
const MIN_SPEECH_MS = 350; // ignore coughs/clicks
const BARGE_RMS = 0.08; // louder threshold to interrupt Trudge

export const GREETING = "Hey, I'm really glad you're here. How are you feeling in this moment?";

function rms(an: AnalyserNode, buf: Float32Array<ArrayBuffer>) {
  an.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) { const x = buf[i] ?? 0; s += x * x; }
  return Math.sqrt(s / buf.length);
}

/**
 * Hands-free counselor loop: greet → listen → auto-send on pause → speak reply → listen again.
 * Speech out tries /api/tts (streaming TTS provider, e.g. AWS Nova) and falls back to the browser voice.
 */
export function useVoiceSession({ onUserText }: { onUserText: (text: string) => void }) {
  const [phase, setPhase] = useState<VoicePhase>("off");
  const [error, setError] = useState<string | null>(null);
  const phaseRef = useRef<VoicePhase>("off");
  const level = useRef(0); // mic level 0..1 while listening
  const mouth = useRef(0); // Trudge mouth 0..1 while speaking (-1 = simulate)
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micAn = useRef<AnalyserNode | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef(0);
  const onTextRef = useRef(onUserText);
  onTextRef.current = onUserText;

  const set = (p: VoicePhase) => { phaseRef.current = p; setPhase(p); };

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    mouth.current = 0;
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      if ((rec as MediaRecorder & { discard?: boolean }).discard || phaseRef.current === "off") return;
      set("transcribing");
      try {
        const fd = new FormData();
        fd.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        const { text } = (await res.json()) as { text: string };
        if ((phaseRef.current as VoicePhase) === "off") return;
        if (text?.trim()) { set("thinking"); onTextRef.current(text.trim()); }
        else listen();
      } catch {
        setError("Couldn't catch that — try again.");
        listen();
      }
    };
    recRef.current = rec;
    rec.start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listening loop: waits for voice, records, ends on a pause.
  const listen = useCallback(() => {
    if (phaseRef.current === "off") return;
    set("listening");
    startRecording();
    const an = micAn.current!;
    const buf = new Float32Array(new ArrayBuffer(an.fftSize * 4));
    let speechStart = 0, lastVoice = 0;
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      if (phaseRef.current !== "listening" && phaseRef.current !== "hearing") return;
      const v = rms(an, buf);
      level.current = Math.min(1, v * 12);
      const now = performance.now();
      if (v > SPEECH_RMS) {
        if (!speechStart) speechStart = now;
        lastVoice = now;
        if (phaseRef.current === "listening" && now - speechStart > 120) set("hearing");
      }
      if (speechStart && now - lastVoice > SILENCE_MS) {
        level.current = 0;
        const rec = recRef.current;
        if (lastVoice - speechStart < MIN_SPEECH_MS) {
          // too short; restart quietly
          if (rec) { (rec as MediaRecorder & { discard?: boolean }).discard = true; rec.stop(); }
          listen();
          return;
        }
        rec?.stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [startRecording]);

  // Barge-in watcher while Trudge talks.
  const watchBargeIn = useCallback(() => {
    const an = micAn.current;
    if (!an) return;
    const buf = new Float32Array(new ArrayBuffer(an.fftSize * 4));
    let loudFor = 0;
    const tick = () => {
      if (phaseRef.current !== "speaking") return;
      loudFor = rms(an, buf) > BARGE_RMS ? loudFor + 1 : 0;
      if (loudFor > 8) { stopSpeaking(); listen(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [listen, stopSpeaking]);

  const speakBrowser = (text: string) =>
    new Promise<void>((resolve) => {
      if (typeof speechSynthesis === "undefined") return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 1;
      const v = speechSynthesis.getVoices().find((x) => /en/i.test(x.lang) && /natural|samantha|google uk english female|aria|jenny/i.test(x.name));
      if (v) u.voice = v;
      mouth.current = -1;
      u.onboundary = () => { mouth.current = -1; };
      u.onend = u.onerror = () => { mouth.current = 0; resolve(); };
      speechSynthesis.speak(u);
    });

  const speakServer = async (text: string) => {
    const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audioRef.current = audio;
    const ctx = ctxRef.current!;
    const src = ctx.createMediaElementSource(audio);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an); an.connect(ctx.destination);
    const buf = new Float32Array(new ArrayBuffer(an.fftSize * 4));
    let raf = 0;
    const tick = () => { mouth.current = Math.min(1, rms(an, buf) * 6); raf = requestAnimationFrame(tick); };
    await audio.play();
    tick();
    await new Promise<void>((r) => { audio.onended = audio.onpause = () => r(); });
    cancelAnimationFrame(raf);
    mouth.current = 0;
    URL.revokeObjectURL(url);
    return true;
  };

  const speak = useCallback(async (text: string) => {
    if (phaseRef.current === "off" || !text.trim()) return listen();
    const clean = text.replace(/[*_#>`]/g, "").trim();
    set("speaking");
    watchBargeIn();
    let ok = false;
    try { ok = await speakServer(clean); } catch { ok = false; }
    if (!ok && phaseRef.current === "speaking") await speakBrowser(clean);
    if (phaseRef.current === "speaking") listen();
  }, [listen, watchBargeIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      streamRef.current = stream; ctxRef.current = ctx; micAn.current = an;
      set("greeting");
      phaseRef.current = "speaking";
      await speak(GREETING);
    } catch {
      setError("Microphone access is needed to talk.");
      set("off");
    }
  }, [speak]);

  const end = useCallback(() => {
    set("off");
    cancelAnimationFrame(rafRef.current);
    stopSpeaking();
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") { (rec as MediaRecorder & { discard?: boolean }).discard = true; rec.stop(); }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    streamRef.current = null; ctxRef.current = null; micAn.current = null;
    level.current = 0;
  }, [stopSpeaking]);

  useEffect(() => end, [end]);

  return { phase, error, start, end, speak, listen, level, mouth, active: phase !== "off" };
}
