'use client';

/**
 * Sound Effects Manager for WeildBuild
 *
 * Provides a simple API to play sound effects throughout the app.
 * Uses the Web Audio API to load and play MP3/WAV files from /public/sounds/.
 * Falls back to synthesized beeps if files aren't loaded yet.
 */

// Cache loaded audio buffers
const audioBufferCache = new Map<string, AudioBuffer>();
let sharedContext: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getAudioContext(): { ctx: AudioContext; gain: GainNode } {
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContext();
    masterGain = sharedContext.createGain();
    masterGain.connect(sharedContext.destination);
    masterGain.gain.value = 0.5;
  }
  if (sharedContext.state === 'suspended') {
    sharedContext.resume();
  }
  return { ctx: sharedContext, gain: masterGain! };
}

async function loadSound(name: string): Promise<AudioBuffer | null> {
  if (audioBufferCache.has(name)) return audioBufferCache.get(name)!;

  const paths: Record<string, string> = {
    jump: '/sounds/effects/jump.mp3',
    walk: '/sounds/effects/walk.mp3',
    death: '/sounds/effects/death.mp3',
    explosion: '/sounds/effects/explosion.mp3',
    scary_laugh: '/sounds/effects/scary_laugh.mp3',
    used_tool: '/sounds/effects/used_tool.wav',
  };

  const path = paths[name];
  if (!path) return null;

  try {
    const { ctx } = getAudioContext();
    const response = await fetch(path);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferCache.set(name, audioBuffer);
    return audioBuffer;
  } catch (e) {
    console.warn(`[Sounds] Failed to load ${name}:`, e);
    return null;
  }
}

/**
 * Play a sound effect by name.
 * @param name - Sound effect name (jump, walk, death, explosion, scary_laugh, used_tool)
 * @param volume - Volume 0-1 (default 0.5)
 */
export async function playSound(name: string, volume: number = 0.5): Promise<void> {
  try {
    const { ctx, gain } = getAudioContext();

    // Try to play the real sound file
    const buffer = await loadSound(name);
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const soundGain = ctx.createGain();
      soundGain.gain.value = volume;
      source.connect(soundGain);
      soundGain.connect(gain);
      source.start(0);
      return;
    }

    // Fallback: synthesized beep
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    oscGain.gain.value = volume * 0.1;
    oscGain.connect(gain);
    osc.connect(oscGain);
    const freqs: Record<string, number> = {
      jump: 440,
      walk: 220,
      death: 110,
      explosion: 80,
      scary_laugh: 330,
      used_tool: 520,
    };
    osc.frequency.value = freqs[name] || 440;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

/**
 * Set the master volume (0-100)
 */
export function setMasterVolume(percent: number): void {
  const { gain } = getAudioContext();
  gain.gain.value = Math.max(0, Math.min(1, percent / 100));
}

/**
 * Preload all sound effects so they play instantly when needed.
 */
export async function preloadSounds(): Promise<void> {
  const names = ['jump', 'walk', 'death', 'explosion', 'scary_laugh', 'used_tool'];
  await Promise.allSettled(names.map(loadSound));
}
