-   Parallax starfield: add 2–3 scrolling tile sprites behind the playfield with different speeds/brightness. Cheap, high payoff. Use this.add.tileSprite
    in MainScene background layer and update in update().
-   Ambient dust/particles: lightweight particle emitter for subtle drifting motes; keep low particle count and alpha so it doesn’t obscure bullets. Spawn
    in a separate layer below gameplay.
-   Impact juice: small screen shake on hits/dashes, quick radial flash on player damage, and brief enemy death sparks. Phaser cameras.main.shake(…) with
    low magnitude, plus a tiny sprite animation or particle burst on kill.
-   Thrust/afterburn: simple trail behind the player (a narrow particle emitter aligned to velocity) and a faint glow/light cone. Keep spawn rate tied to
    speed to avoid overdraw.
-   Boss intros: short vignette pulse + color tint when a boss enters; quick tween on background saturation/brightness to sell the phase change.
-   Colored projectiles: add subtle glows (outer stroke) and occasional tracer particles on rare/elite shots. Pre-generate textures to avoid runtime draw
    cost.
-   Wave cadence: on intermission, gently dim the background and add a low-opacity grid/pulse; restore brightness when the next wave starts.
