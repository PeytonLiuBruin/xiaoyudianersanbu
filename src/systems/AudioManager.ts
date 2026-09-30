/** The game has narration and small tactile cues, with no background music. */
type Sound = { file: string; volume: number; cooldown?: number };

const SOUNDS: Record<string, Sound> = {
  click: { file: 'click.wav', volume: 0.14, cooldown: 70 },
  paper: { file: 'paper.wav', volume: 0.20, cooldown: 160 },
  throw: { file: 'throw.wav', volume: 0.21, cooldown: 160 },
  hit: { file: 'hit.wav', volume: 0.25, cooldown: 110 },
  door: { file: 'door.wav', volume: 0.16, cooldown: 500 },
  footstep: { file: 'footstep.wav', volume: 0.12, cooldown: 170 },
  footstepIndoor: { file: 'footstep-indoor.wav', volume: 0.13, cooldown: 170 },
  tick: { file: 'tick.wav', volume: 0.13, cooldown: 80 },
  marble: { file: 'marble.wav', volume: 0.17, cooldown: 100 },
  success: { file: 'success.wav', volume: 0.19, cooldown: 350 },
  latch: { file: 'latch.wav', volume: 0.16, cooldown: 170 },
};

const ALIASES: Record<string, string> = {
  page: 'paper', pickup: 'paper', swish: 'throw', pop: 'hit',
  step: 'footstep', footsteps: 'footstep', confirm: 'success', unlock: 'latch',
};

export class AudioManager {
  private context: AudioContext | null = null;
  private voiceGain: GainNode | null = null;
  private _muted: boolean;
  private unlocked = false;
  private suspended = false;
  private disposed = false;
  private voiceToken = 0;
  private effectToken = 0;
  private currentVoice: AudioBufferSourceNode | null = null;
  private voiceFinished: (() => void) | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private effects = new Set<AudioBufferSourceNode>();
  private lastPlayed = new Map<string, number>();

  constructor(
    private readonly voiceMap: Record<string, string>,
    private readonly baseUrl: string,
    initiallyMuted = false,
  ) {
    this._muted = initiallyMuted;
  }

  get isMuted(): boolean { return this._muted; }
  get voiceActive(): boolean { return this.voiceFinished !== null; }

  /** Call directly from a click/tap/keydown handler, before awaiting anything. */
  async unlock(): Promise<void> {
    if (this.disposed || typeof window === 'undefined') return;
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        this.context = new Constructor();
        this.voiceGain = this.context.createGain();
        this.voiceGain.gain.value = this._muted ? 0 : 0.95;
        this.voiceGain.connect(this.context.destination);
      }
      // A tiny silent buffer also unlocks audio on browsers requiring a source
      // to start inside the initial user gesture.
      const silent = this.context.createBufferSource();
      silent.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
      silent.connect(this.context.destination);
      silent.onended = () => silent.disconnect();
      silent.start();
      const resumed = this.context.resume();
      await this.waitForResume(resumed);
      this.unlocked = this.context.state === 'running';
      if (this.unlocked) {
        this.suspended = false;
        // Small cues are warmed together; voices are loaded only when needed.
        for (const sound of Object.values(SOUNDS)) {
          void this.loadBuffer(this.assetUrl(`audio/sfx/${sound.file}`));
        }
      }
    } catch {
      // Denied browser audio never blocks captions or progression.
      this.unlocked = false;
    }
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.voiceGain && this.context) {
      this.voiceGain.gain.setValueAtTime(muted ? 0 : 0.95, this.context.currentTime);
    }
    if (muted) {
      this.stopVoice();
      this.stopEffects();
    }
  }

  /** Resolves when the line ends, is replaced/skipped, or cannot be played. */
  playVoice(id: string): Promise<void> {
    this.stopVoice();
    const path = this.voiceMap[id];
    if (!path || this._muted || !this.unlocked || this.suspended || this.disposed || !this.context) {
      return Promise.resolve();
    }

    const token = this.voiceToken;
    return new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (this.voiceFinished === finish) this.voiceFinished = null;
        if (token === this.voiceToken) this.currentVoice = null;
        resolve();
      };
      this.voiceFinished = finish;
      void this.loadBuffer(this.assetUrl(path)).then((buffer) => {
        if (finished || token !== this.voiceToken) return;
        if (!buffer || !this.context || !this.voiceGain || this._muted || this.disposed) {
          finish();
          return;
        }
        try {
          const source = this.context.createBufferSource();
          source.buffer = buffer;
          source.connect(this.voiceGain);
          source.onended = () => { source.disconnect(); finish(); };
          this.currentVoice = source;
          source.start();
        } catch { finish(); }
      }).catch(finish);
    });
  }

  stopVoice(): void {
    this.voiceToken++;
    const source = this.currentVoice;
    this.currentVoice = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* It may already have ended. */ }
      source.disconnect();
    }
    const finish = this.voiceFinished;
    this.voiceFinished = null;
    finish?.();
  }

  playSfx(name: string): void {
    const key = ALIASES[name] ?? name;
    const sound = SOUNDS[key];
    if (!sound || this._muted || !this.unlocked || this.suspended || this.disposed || !this.context) return;
    const requestedAt = performance.now();
    const token = this.effectToken;
    if (requestedAt - (this.lastPlayed.get(key) ?? -Infinity) < (sound.cooldown ?? 70)) return;
    this.lastPlayed.set(key, requestedAt);

    void this.loadBuffer(this.assetUrl(`audio/sfx/${sound.file}`)).then((buffer) => {
      if (!buffer || !this.context || this._muted || this.suspended || this.disposed || token !== this.effectToken) return;
      // Discard stale cues rather than playing a tap long after the action.
      if (performance.now() - requestedAt > 800 || this.effects.size >= 6) return;
      try {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        source.buffer = buffer;
        // Narration remains clear when a puzzle cue overlaps it.
        gain.gain.value = sound.volume * (this.voiceActive ? 0.45 : 1);
        source.connect(gain);
        gain.connect(this.context.destination);
        this.effects.add(source);
        source.onended = () => {
          this.effects.delete(source);
          source.disconnect();
          gain.disconnect();
        };
        source.start();
      } catch { /* Missing/denied audio does not affect the action. */ }
    }).catch(() => {});
  }

  /** Pause from the application's visibility or pause-menu handler. */
  suspend(): void {
    this.suspended = true;
    this.stopEffects();
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }

  async resume(): Promise<void> {
    if (!this.context || !this.unlocked || this.disposed) return;
    try {
      await this.waitForResume(this.context.resume());
      this.suspended = this.context.state !== 'running';
      if (this.suspended) this.stopVoice();
    } catch {
      this.stopVoice();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopVoice();
    this.stopEffects();
    this.buffers.clear();
    void this.context?.close().catch(() => {});
    this.context = null;
    this.voiceGain = null;
  }

  private stopEffects(): void {
    this.effectToken++;
    for (const source of this.effects) {
      try { source.stop(); } catch { /* It may already have ended. */ }
    }
    this.effects.clear();
  }

  private waitForResume(resumed: Promise<void>): Promise<void> {
    // Some browsers leave resume() pending when a gesture was denied.
    return new Promise((resolve) => {
      const timeout = window.setTimeout(resolve, 1200);
      const finish = () => { window.clearTimeout(timeout); resolve(); };
      void resumed.then(finish, finish);
    });
  }

  private assetUrl(path: string): string {
    if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  private loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const context = this.context;
    if (!context) return Promise.resolve(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const request = (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        return await context.decodeAudioData(data);
      } catch { return null; }
      finally { window.clearTimeout(timeout); }
    })();
    this.buffers.set(url, request);
    void request.then((buffer) => {
      if (!buffer) this.buffers.delete(url);
      // Narration is small, but don't retain the entire story as decoded PCM.
      const voices = [...this.buffers.keys()].filter((key) => !key.includes('/audio/sfx/'));
      if (voices.length > 6) this.buffers.delete(voices[0]);
    });
    return request;
  }
}

export default AudioManager;
