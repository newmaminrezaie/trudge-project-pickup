// Nova Sonic streaming client: mic -> 16kHz PCM16 over WebSocket, 24kHz PCM16 back -> Web Audio.
// Protocol: binary frames = PCM16 mono audio; text frames = JSON ({type:"start"|"interrupt"|"end"} out, {type:"transcript"|"error"} in).
export type NovaHandlers = {
  mouth: { current: number };
  level: { current: number };
  onSpeaking: (on: boolean) => void;
  onBargeIn: () => void;
  onDrop: (reason: string) => void;
};

const BARGE_RMS = 0.08;

export function novaUrl() {
  const env = (import.meta.env.VITE_NOVA_WS_URL as string | undefined)?.trim();
  if (env) return env;
  const p = location.protocol === "https:" ? "wss:" : "ws:";
  return `${p}//${location.host}/api/voice-stream`;
}

function downsampleTo16k(input: Float32Array, rate: number) {
  const ratio = rate / 16000;
  const out = new Int16Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function startNova(stream: MediaStream, h: NovaHandlers) {
  const ws = new WebSocket(novaUrl());
  ws.binaryType = "arraybuffer";
  await new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout")), 5000);
    ws.onopen = () => { clearTimeout(t); res(); };
    ws.onerror = () => { clearTimeout(t); rej(new Error("connect")); };
  });

  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const out = ctx.createGain();
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  out.connect(an); an.connect(ctx.destination);
  const buf = new Float32Array(new ArrayBuffer(an.fftSize * 4));
  let playHead = 0;
  let sources: AudioBufferSourceNode[] = [];
  let loudFor = 0;
  let closed = false;

  const speaking = () => sources.length > 0;
  const flush = () => {
    sources.forEach((s) => { try { s.stop(); } catch { /* noop */ } });
    sources = []; playHead = 0; h.mouth.current = 0; h.onSpeaking(false);
  };

  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    let s = 0; for (let i = 0; i < data.length; i++) s += (data[i] ?? 0) ** 2;
    const v = Math.sqrt(s / data.length);
    h.level.current = Math.min(1, v * 12);
    if (speaking()) {
      loudFor = v > BARGE_RMS ? loudFor + 1 : 0;
      if (loudFor > 2) { flush(); h.onBargeIn(); if (ws.readyState === 1) ws.send(JSON.stringify({ type: "interrupt" })); }
    }
    if (ws.readyState === 1) ws.send(downsampleTo16k(data, ctx.sampleRate).buffer);
  };
  src.connect(proc); proc.connect(ctx.destination); // processor output is silent

  ws.onmessage = (ev) => {
    if (typeof ev.data === "string") {
      try { const m = JSON.parse(ev.data); if (m.type === "error") h.onDrop(m.message || "error"); } catch { /* ignore */ }
      return;
    }
    const pcm = new Int16Array(ev.data as ArrayBuffer);
    if (!pcm.length) return;
    const ab = ctx.createBuffer(1, pcm.length, 24000);
    const ch = ab.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = (pcm[i] ?? 0) / 0x8000;
    const node = ctx.createBufferSource();
    node.buffer = ab; node.connect(out);
    const at = Math.max(ctx.currentTime + 0.03, playHead);
    node.start(at); playHead = at + ab.duration;
    sources.push(node);
    if (sources.length === 1) h.onSpeaking(true);
    node.onended = () => { sources = sources.filter((x) => x !== node); if (!sources.length) { h.mouth.current = 0; h.onSpeaking(false); } };
  };
  ws.onclose = () => { if (!closed) h.onDrop("closed"); };

  let raf = 0;
  const tick = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x; if (speaking()) h.mouth.current = Math.min(1, Math.sqrt(s / buf.length) * 6); raf = requestAnimationFrame(tick); };
  tick();
  ws.send(JSON.stringify({ type: "start", inputRate: 16000, outputRate: 24000 }));

  return () => {
    closed = true; cancelAnimationFrame(raf); flush();
    try { ws.send(JSON.stringify({ type: "end" })); } catch { /* noop */ }
    ws.close(); proc.disconnect(); src.disconnect(); ctx.close().catch(() => {});
  };
}
