/**
 * A minimal stand-in for AudioContext, enough to drive the audio engine under Node:
 * it creates inert nodes, counts what is created, and lets a test move the clock and the
 * context state by hand. No sound is produced.
 */

class FakeParam {
  value = 0;
  setValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  setTargetAtTime(): this {
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  context: FakeAudioContext;
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  delayTime = new FakeParam();
  type = '';
  curve: Float32Array | null = null;
  oversample = 'none';
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  connected = 0;
  startAt = -1;
  stopAt = Infinity;

  constructor(context: FakeAudioContext) {
    this.context = context;
  }
  connect(dest: unknown): unknown {
    this.connected++;
    return dest;
  }
  disconnect(): void {
    this.connected = 0;
    this.context.disconnects++;
  }
  start(when?: number): void {
    this.startAt = when === undefined ? this.context.currentTime : when;
    this.context.started++;
  }
  stop(when?: number): void {
    this.stopAt = when === undefined ? this.context.currentTime : when;
    this.context.sources.push(this);
  }
}

export class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination: FakeNode;
  onstatechange: (() => void) | null = null;
  /** When false, resume() stays pending — like a browser waiting for a user gesture. */
  allowResume = true;
  /** When set, node creation throws (a broken audio stack). */
  broken = false;
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;
  started = 0;
  disconnects = 0;
  sources: FakeNode[] = [];

  constructor() {
    this.destination = new FakeNode(this);
  }

  private node(): FakeNode {
    if (this.broken) throw new Error('audio stack is broken');
    return new FakeNode(this);
  }
  createGain(): FakeNode {
    return this.node();
  }
  createOscillator(): FakeNode {
    return this.node();
  }
  createBufferSource(): FakeNode {
    return this.node();
  }
  createBiquadFilter(): FakeNode {
    return this.node();
  }
  createDelay(): FakeNode {
    return this.node();
  }
  createDynamicsCompressor(): FakeNode {
    return this.node();
  }
  createWaveShaper(): FakeNode {
    return this.node();
  }
  createBuffer(_channels: number, length: number, sampleRate: number): unknown {
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }

  setState(state: string): void {
    if (this.state === state) return;
    this.state = state;
    if (this.onstatechange) this.onstatechange();
  }
  resume(): Promise<void> {
    this.resumeCalls++;
    if (!this.allowResume) return new Promise<void>(() => undefined);
    return Promise.resolve().then(() => this.setState('running'));
  }
  suspend(): Promise<void> {
    this.suspendCalls++;
    return Promise.resolve().then(() => this.setState('suspended'));
  }
  close(): Promise<void> {
    this.closeCalls++;
    return Promise.resolve().then(() => this.setState('closed'));
  }

  /** Move the audio clock forward and end the sources whose stop time has passed. */
  advance(seconds: number): void {
    this.currentTime += seconds;
    const still: FakeNode[] = [];
    for (const s of this.sources) {
      if (s.stopAt <= this.currentTime) {
        if (s.onended) s.onended();
      } else {
        still.push(s);
      }
    }
    this.sources = still;
  }
}

/** Let pending promise callbacks run. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
