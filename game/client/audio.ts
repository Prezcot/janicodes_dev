export type Sound = "shot" | "empty" | "reload" | "hit" | "headshot" | "death" | "step";

/** Sounds made in the browser, with no files to download. */
export function createAudio() {
  let ctx: AudioContext | null = null, master: GainNode | null = null, noise: AudioBuffer | null = null, volume = 0.6;

  const ready = () => {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  /** Play a sound. `pan` runs from -1 (left) to 1 (right) and `gain` from 0 to 1. */
  const play = (sound: Sound, pan = 0, gain = 1) => {
    if (volume <= 0 || gain <= 0.01) return;
    const c = ready(), t = c.currentTime;
    const out = c.createStereoPanner();
    out.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(master!);
    const tone = (type: OscillatorType, from: number, to: number, length: number, level: number, at = 0) => {
      const osc = c.createOscillator(), env = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t + at);
      osc.frequency.exponentialRampToValueAtTime(to, t + at + length);
      env.gain.setValueAtTime(level * gain, t + at);
      env.gain.exponentialRampToValueAtTime(0.001, t + at + length);
      osc.connect(env).connect(out);
      osc.start(t + at); osc.stop(t + at + length);
    };
    const hiss = (filter: BiquadFilterType, frequency: number, length: number, level: number, at = 0) => {
      const src = c.createBufferSource(), biquad = c.createBiquadFilter(), env = c.createGain();
      src.buffer = noise;
      biquad.type = filter; biquad.frequency.value = frequency;
      env.gain.setValueAtTime(level * gain, t + at);
      env.gain.exponentialRampToValueAtTime(0.001, t + at + length);
      src.connect(biquad).connect(env).connect(out);
      src.start(t + at); src.stop(t + at + length);
    };
    if (sound === "shot") { hiss("lowpass", 1700, 0.16, 0.9); tone("sine", 150, 45, 0.12, 0.8); }
    else if (sound === "empty") tone("square", 1300, 900, 0.03, 0.15);
    else if (sound === "reload") { hiss("highpass", 2500, 0.04, 0.35); hiss("highpass", 1800, 0.06, 0.4, 0.28); }
    else if (sound === "hit") tone("sine", 880, 700, 0.07, 0.3);
    else if (sound === "headshot") { tone("sine", 1320, 1100, 0.09, 0.35); tone("sine", 1760, 1500, 0.09, 0.2, 0.05); }
    else if (sound === "death") tone("sawtooth", 300, 55, 0.5, 0.3);
    else hiss("lowpass", 320, 0.07, 0.5);
  };

  return {
    play,
    setVolume(next: number) { volume = next; if (master) master.gain.value = next; },
    /** Call from a click, so the browser allows sound. */
    unlock: () => { ready(); },
    close() { void ctx?.close(); },
  };
}
