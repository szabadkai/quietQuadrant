export type SfxKey =
    | "uiHover"
    | "uiSelect"
    | "shoot"
    | "enemyDown"
    | "xpPickup";

export class SFXManager {
    private ctx?: AudioContext;
    private sfxGain?: GainNode;
    private sfxCooldowns = new Map<SfxKey, number>();

    constructor() {}

    initialize(ctx: AudioContext, sfxGain: GainNode) {
        this.ctx = ctx;
        this.sfxGain = sfxGain;
    }

    resume() {
        if (!this.ctx) return;
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    playSfx(key: SfxKey) {
        this.resume();
        if (!this.ctx || !this.sfxGain) return;
        if (this.isCoolingDown(key, this.ctx.currentTime)) return;

        switch (key) {
            case "uiHover":
                this.playTone(this.ctx, {
                    frequency: 540 + Math.random() * 80,
                    type: "triangle",
                    duration: 0.14,
                    attack: 0.005,
                    decay: 0.08,
                    release: 0.08,
                    volume: 0.22,
                });
                break;
            case "uiSelect":
                this.playTone(this.ctx, {
                    frequency: 360 + Math.random() * 50,
                    type: "square",
                    duration: 0.18,
                    attack: 0.006,
                    decay: 0.1,
                    release: 0.12,
                    volume: 0.28,
                    glide: -140,
                });
                break;
            case "shoot":
                this.playTone(this.ctx, {
                    frequency: 840 + Math.random() * 200,
                    type: "sawtooth",
                    duration: 0.1,
                    attack: 0.003,
                    decay: 0.06,
                    release: 0.08,
                    volume: 0.18,
                    glide: -220,
                });
                break;
            case "enemyDown":
                this.playNoise(this.ctx, 0.18, 0.26, 1400);
                this.playTone(this.ctx, {
                    frequency: 220 + Math.random() * 40,
                    type: "square",
                    duration: 0.22,
                    attack: 0.004,
                    decay: 0.14,
                    release: 0.14,
                    volume: 0.3,
                    glide: -120,
                });
                break;
            case "xpPickup":
                this.playTone(this.ctx, {
                    frequency: 980 + Math.random() * 80,
                    type: "sine",
                    duration: 0.1,
                    attack: 0.004,
                    decay: 0.06,
                    release: 0.08,
                    volume: 0.25,
                });
                this.playTone(
                    this.ctx,
                    {
                        frequency: 1260 + Math.random() * 40,
                        type: "triangle",
                        duration: 0.12,
                        attack: 0.004,
                        decay: 0.08,
                        release: 0.1,
                        volume: 0.2,
                    },
                    0.05
                );
                break;
            default:
                break;
        }
    }

    private isCoolingDown(key: SfxKey, now: number): boolean {
        const minGaps: Record<SfxKey, number> = {
            uiHover: 0.08,
            uiSelect: 0.05,
            shoot: 0.025,
            enemyDown: 0.04,
            xpPickup: 0.05,
        };
        const last = this.sfxCooldowns.get(key) ?? 0;
        if (now - last < minGaps[key]) return true;
        this.sfxCooldowns.set(key, now);
        return false;
    }

    private playTone(
        ctx: AudioContext,
        opts: {
            frequency: number;
            type: OscillatorType;
            duration: number;
            attack: number;
            decay: number;
            release: number;
            volume: number;
            glide?: number;
        },
        delaySeconds = 0
    ) {
        if (!this.sfxGain) return;
        const start = ctx.currentTime + delaySeconds;
        const end = start + opts.duration + opts.release;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = opts.type;
        osc.frequency.setValueAtTime(opts.frequency, start);
        if (opts.glide && opts.glide !== 0) {
            osc.frequency.linearRampToValueAtTime(
                Math.max(40, opts.frequency + opts.glide),
                start + opts.duration
            );
        }
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(opts.volume, start + opts.attack);
        gain.gain.linearRampToValueAtTime(
            opts.volume * 0.4,
            start + opts.attack + opts.decay
        );
        gain.gain.linearRampToValueAtTime(0.0001, end);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(start);
        osc.stop(end + 0.02);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }

    private playNoise(
        ctx: AudioContext,
        duration: number,
        volume: number,
        cutoffHz: number
    ) {
        if (!this.sfxGain) return;
        const bufferSize = Math.max(128, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.4;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = cutoffHz;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        source.connect(filter).connect(gain).connect(this.sfxGain);
        source.start();
        source.stop(ctx.currentTime + duration + 0.02);
        source.onended = () => {
            source.disconnect();
            filter.disconnect();
            gain.disconnect();
        };
    }
}
