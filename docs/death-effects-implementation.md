# Death Effects Implementation Guide

This document describes how to reproduce the current enemy death sound effect
and the player death visual + sound effects exactly as implemented in the game.
All references point to the source of truth in the codebase.

## Scope

- Enemy death sound effect ("enemyDown") playback.
- Player death visual sequence and sound effect ("playerDeath").
- Integration points and timing to match the existing behavior.

## Quick Start (Exact Match)

Enemy death SFX:
1) In the enemy death handler, call `soundManager.playSfx("enemyDown")`.
2) Do not change the `enemyDown` recipe or cooldown in `SoundManager`.

Player death visual + SFX:
1) Ensure `endRun(false)` calls `playDeathAnimation` on player death.
2) In `playDeathAnimation`:
   - `sprite.setVisible(false)`
   - `soundManager.playSfx("playerDeath")`
   - `cameras.main.shake(400, 0.015)`
   - `spawnBurstVisual(x, y, 50, 0xf14e4e, 1)`
   - spawn 12 debris rectangles (6x6, color `0x9ff0ff`, depth 10) with outward
     tween (`500-700ms`, `Quad.easeOut`)
   - delayed rings: `+100ms` (70, `COLOR_ACCENT`, 0.8) and `+200ms`
     (90, `0xffffff`, 0.6)
   - screen flash at `+150ms` for `200ms`
   - `onComplete()` at `+600ms`

Audio context:
- Call `soundManager.resume()` after the first user interaction to unlock audio.

## Using in Another Phaser + TS Project (Integration Only)

This section assumes you already have a Phaser scene and a global or scene-level
audio manager. The goal is to reproduce the same effects without copying this
entire project.

### 1) Add the SFX recipes to your SoundManager

If you already use Web Audio, add these two cases exactly to your SFX switch:

```ts
type SfxKey = "enemyDown" | "playerDeath";

playSfx(key: SfxKey) {
  const ctx = this.ensureContext();
  if (!ctx || !this.sfxGain) return;

  switch (key) {
    case "enemyDown":
      this.playNoise(ctx, 0.18, 0.26, 1400);
      this.playTone(ctx, {
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
    case "playerDeath":
      this.playNoise(ctx, 0.4, 0.4, 2000);
      this.playTone(ctx, {
        frequency: 300 + Math.random() * 50,
        type: "sawtooth",
        duration: 0.35,
        attack: 0.01,
        decay: 0.2,
        release: 0.2,
        volume: 0.4,
        glide: -200,
      });
      this.playTone(
        ctx,
        {
          frequency: 120,
          type: "sine",
          duration: 0.5,
          attack: 0.02,
          decay: 0.3,
          release: 0.25,
          volume: 0.35,
          glide: -80,
        },
        0.1
      );
      break;
  }
}
```

If you do not already have Web Audio helpers, implement these minimal versions:

```ts
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
```

### 2) Add the player death visual helper to your scene

Drop this function into your Phaser scene and call it on death:

```ts
private spawnBurstVisual(
  x: number,
  y: number,
  radius: number,
  color: number,
  strokeOpacity = 0.7
) {
  const circle = this.add
    .circle(x, y, radius, color, 0.08)
    .setStrokeStyle(2, color, strokeOpacity)
    .setDepth(0.5);
  this.tweens.add({
    targets: circle,
    alpha: { from: 0.8, to: 0 },
    scale: { from: 0.9, to: 1.15 },
    duration: 200,
    onComplete: () => circle.destroy(),
  });
}
```

And the death animation sequence:

```ts
private playDeathAnimation(
  sprite: Phaser.Physics.Arcade.Image,
  onComplete: () => void
) {
  const x = sprite.x;
  const y = sprite.y;
  sprite.setVisible(false);
  soundManager.playSfx("playerDeath");
  this.cameras.main.shake(400, 0.015);
  this.spawnBurstVisual(x, y, 50, 0xf14e4e, 1);

  const debrisCount = 12;
  for (let i = 0; i < debrisCount; i++) {
    const angle = (i / debrisCount) * Math.PI * 2;
    const speed = 120 + Math.random() * 100;
    const debris = this.add.rectangle(x, y, 6, 6, 0x9ff0ff).setDepth(10);
    this.tweens.add({
      targets: debris,
      x: x + Math.cos(angle) * speed,
      y: y + Math.sin(angle) * speed,
      alpha: 0,
      scale: 0.3,
      duration: 500 + Math.random() * 200,
      ease: "Quad.easeOut",
      onComplete: () => debris.destroy(),
    });
  }

  this.time.delayedCall(100, () => {
    this.spawnBurstVisual(x, y, 70, COLOR_ACCENT, 0.8);
  });
  this.time.delayedCall(200, () => {
    this.spawnBurstVisual(x, y, 90, 0xffffff, 0.6);
  });
  this.time.delayedCall(150, () => {
    this.cameras.main.flash(200, 255, 255, 255, false);
  });
  this.time.delayedCall(600, onComplete);
}
```

### 3) Call the effects at the right time

Enemy death:
- In your enemy death handler, call `soundManager.playSfx("enemyDown")` once.

Player death:
- When the run ends from player death, call `playDeathAnimation` and pass the
  end-of-run callback to `onComplete`.

### 4) Audio unlock

- Call `soundManager.resume()` after the first user interaction to unlock Web
  Audio on browsers that require it.

## Enemy Death Sound Effect

Source of truth:
- `src/audio/SoundManager.ts` (SFX definitions)
- `src/game/scenes/MainScene.ts` (playback on enemy death)

### SFX Definition (must match exactly)

Sound key:
- `enemyDown` (SfxKey)

Sound recipe (in `SoundManager.playSfx`):
- Layer 1: noise burst
  - `playNoise(ctx, duration=0.18, volume=0.26, cutoffHz=1400)`
- Layer 2: descending square tone
  - `frequency`: `220 + Math.random() * 40`
  - `type`: `square`
  - `duration`: `0.22`
  - `attack`: `0.004`
  - `decay`: `0.14`
  - `release`: `0.14`
  - `volume`: `0.3`
  - `glide`: `-120`

Cooldown:
- `enemyDown` has a minimum gap of `0.04` seconds in `isCoolingDown`.

### Playback Trigger (must match exactly)

Where it is played:
- `MainScene.handleEnemyDeath` calls `soundManager.playSfx("enemyDown")`.

Timing and ordering:
- It fires after the enemy is destroyed, XP drop is spawned, and healing checks
  (`applyBloodFuelHeal`, `tryChainArc`, `tryKineticHeal`) are run.
- It is not conditioned on enemy type, except that it is part of the normal
  death flow in `handleEnemyDeath`.

### Implementation Checklist

1) Ensure `SoundManager` is initialized (`soundManager.resume()` is called
   early in gameplay, currently handled in `src/App.tsx` and scene setup).
2) In the enemy death handler, call `soundManager.playSfx("enemyDown")` once
   per enemy death.
3) Do not alter the `enemyDown` sound recipe or cooldown values if you need an
   exact match.

## Player Death Visual + Sound Effects

Source of truth:
- `src/game/scenes/MainScene.ts` (`endRun`, `playDeathAnimation`)
- `src/audio/SoundManager.ts` (SFX definition for `playerDeath`)

### Visual Sequence (must match exactly)

Entry point:
- `MainScene.endRun(false)` calls `playDeathAnimation` when the player dies.

Visual sequence details:
1) Hide the player sprite:
   - `sprite.setVisible(false)`
2) Screen shake:
   - `this.cameras.main.shake(400, 0.015)`
3) Initial explosion ring:
   - `spawnBurstVisual(x, y, 50, 0xf14e4e, 1)`
4) Debris particles (12 rectangles):
   - `rectangle(x, y, 6, 6, 0x9ff0ff).setDepth(10)`
   - Tween per particle:
     - `x/y` fly outward by angle
     - `alpha: 0`, `scale: 0.3`
     - `duration: 500 + Math.random() * 200`
     - `ease: "Quad.easeOut"`
     - `onComplete: destroy`
5) Secondary explosion rings:
   - At `+100ms`: `spawnBurstVisual(x, y, 70, COLOR_ACCENT, 0.8)`
   - At `+200ms`: `spawnBurstVisual(x, y, 90, 0xffffff, 0.6)`
6) Screen flash:
   - At `+150ms`: `this.cameras.main.flash(200, 255, 255, 255, false)`
7) Completion:
   - At `+600ms`: `onComplete()` (calls `finalizeEndRun`)

Helper used for rings:
- `spawnBurstVisual` in `MainScene` creates a filled + stroked circle,
  fades and scales over 200ms, and destroys itself.

Cleanup:
- `cleanupVisualEffects` destroys leftover death debris rectangles when the
  scene is torn down.

### Sound Effect (must match exactly)

Sound key:
- `playerDeath` (SfxKey)

Sound recipe (in `SoundManager.playSfx`):
- Layer 1: noise burst
  - `playNoise(ctx, duration=0.4, volume=0.4, cutoffHz=2000)`
- Layer 2: descending sawtooth tone
  - `frequency`: `300 + Math.random() * 50`
  - `type`: `sawtooth`
  - `duration`: `0.35`
  - `attack`: `0.01`
  - `decay`: `0.2`
  - `release`: `0.2`
  - `volume`: `0.4`
  - `glide`: `-200`
- Layer 3: low sine tail (delayed)
  - `frequency`: `120`
  - `type`: `sine`
  - `duration`: `0.5`
  - `attack`: `0.02`
  - `decay`: `0.3`
  - `release`: `0.25`
  - `volume`: `0.35`
  - `glide`: `-80`
  - `delay`: `0.1`

Cooldown:
- `playerDeath` has a minimum gap of `0.5` seconds in `isCoolingDown`.

Playback trigger:
- `playDeathAnimation` calls `soundManager.playSfx("playerDeath")` before the
  visual sequence starts.

### Implementation Checklist

1) Ensure `endRun(false)` is called on player death.
2) In `endRun`, call `playDeathAnimation` when `victory === false`.
3) In `playDeathAnimation`, execute the visual sequence exactly as listed,
   including timings and colors.
4) Call `soundManager.playSfx("playerDeath")` at the start of the animation.
5) Call `onComplete()` after `600ms` so the run ends after the animation.

## Integration Notes

- The SFX system depends on the Web Audio context created lazily in
  `SoundManager.ensureContext`. The first user interaction should call
  `soundManager.resume()` to unlock audio.
- All sound volumes are subject to `masterVolume`, `sfxVolume`, `muteAll`,
  and per-key cooldowns.
- `spawnBurstVisual` and debris are plain Phaser shapes (no textures).

## Validation Steps

1) Trigger an enemy kill and confirm the `enemyDown` sound matches the
   existing layered noise + square tone.
2) Trigger player death and confirm:
   - Player sprite disappears
   - Shake, burst rings, debris, and flash timing match the existing sequence
   - The `playerDeath` explosion SFX plays once
3) Verify no lingering debris rectangles remain after scene cleanup.
