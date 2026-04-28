# PLNK-7 Three.js Field Terminal

**A fully Three.js-rendered Plinko game disguised as a dark-room military field terminal.**

PLNK-7 is no longer a web dashboard layered over a canvas. Every visible element is a Three.js scene object: the terminal chassis, recessed panels, CRT-like playfield, DROP button, knobs, reels, screw heads, header rails, footer indicators, segmented meters, labels, logs, and score displays.

## Experience

The game presents a rugged alternate-1980s control device sitting on a dark field desk. A matte olive-black chassis catches warm key light, cool fill, soft shadows, and a dim phosphor screen glow. The terminal tilts subtly toward the pointer with smooth lag, making it feel like a physical object rather than a flat interface.

Inside the center screen is a live canvas texture that renders the Plinko field every frame: scanlines, pegs, chip trail, score strip, and vignette. The canvas is mapped onto a PBR screen material with a faint emissive channel, while all surrounding controls remain real 3D geometry.

## Features

- Full-window Three.js scene with no HTML overlay UI
- PBR terminal chassis with procedural normal and roughness maps
- Raised face plate, fake chamfer strips, inset panels, rims, and screw heads
- Canvas-textured CRT Plinko screen with phosphor green rendering
- 8 x 7 staggered peg layout and one-chip-at-a-time physics
- Seven physical bucket meshes with phosphor labels and landing flash
- Raycast DROP button interaction plus Space key support
- Animated VU meter, tape reel, footer progress blocks, and amber status lamp
- Canvas-textured score, elapsed time, landing log, reel status, and drop stats
- Mouse-driven terminal tilt with smooth interpolation
- Dark room lighting with shadows and ground plane

## Tech Stack

- Vite
- TypeScript
- Three.js r128
- CanvasTexture-driven text and screen rendering
- Share Tech Mono for canvas-rendered terminal typography

## Local Setup

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

## Project Structure

```text
src/
  main.ts      Complete Three.js scene, game state, raycasting, physics, and texture updates
  styles.css   Full-window canvas reset and font loading
index.html     Single WebGL canvas mount
```

## Physics

The Plinko simulation runs in the main animation loop. A chip receives gravity each frame, collides with circle pegs, resolves overlap along the collision normal, reflects velocity with damping, and receives small horizontal nudges on peg hits. Side walls clamp the chip inside the 320 x 560 screen coordinate space. When the chip reaches the bottom, its `x` position maps to one of seven buckets, awarding points and updating all terminal readouts.

## What It Demonstrates

This version focuses on building a game UI as a physical 3D object: procedural materials, light-reactive controls, canvas-generated labels, raycast interaction, scene composition, and a compact custom physics loop. It is a design-engineering study in replacing flat interface layers with tactile, inspectable, lit geometry.

## Future Improvements

- Add optional OrbitControls debug mode
- Add Web Audio relay clicks and CRT hum
- Add a small animated antenna or accessory module
- Add postprocessing film grain and subtle lens vignette
- Add Playwright screenshots for portfolio capture
