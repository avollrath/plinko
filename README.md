# Plinko Arcade

**A glossy physics-based Plinko cabinet built with Vite, TypeScript, Three.js, and cannon-es.**

Plinko Arcade is a vertical casino-inspired arcade game with a procedural blue playfield, neon side rails, metallic pegs, glowing prize slots, and a responsive HUD. The project is designed as a compact frontend/design-engineering portfolio piece: polished visuals, modular game architecture, and a real physics simulation running in the browser.

## Features

- Portrait Plinko board with a glossy blue panel and organic procedural texture
- Three.js rendering with lights, emissive materials, beveled geometry, and animated neon rails
- cannon-es physics world with gravity, static peg bodies, slot dividers, walls, and a dynamic ball
- Randomized ball spawn near the top of the board
- Arcade HUD with balance, last win, active slot, bet selector, drop button, and reset control
- Configurable slot multipliers and bet amounts
- Slot labels and colors inspired by classic arcade prize lanes
- Sound hook placeholders for button clicks, peg hits, and slot results
- Stable fixed-timestep physics with body-to-mesh synchronization every frame
- Mobile and desktop responsive canvas layout
- Timeout and anti-stuck logic to keep each drop resolving cleanly

## Tech Stack

- **Vite** for fast local development and production builds
- **TypeScript** for typed game state, layout configuration, and physics/rendering contracts
- **Three.js** for procedural 3D rendering
- **cannon-es** for rigid-body physics
- **Vanilla DOM/CSS** for the HUD, avoiding framework overhead

## Game Mechanics

Players choose a bet amount, then press **Drop Ball**. The game subtracts the bet from the balance, spawns a ball near the top center, and lets physics determine its path through the staggered peg grid. When the ball settles into one of five bottom slots, the slot multiplier is applied to the bet and the resulting win is added back to the balance.

The current multipliers live in [`src/config.ts`](./src/config.ts), making it easy to rebalance the game:

```ts
slotMultipliers: [0.5, 1.2, 2, 1.2, 0.5]
```

## Physics Notes

The physics layer uses a `CANNON.World` with downward gravity and a fixed timestep for consistent motion. Pegs are static sphere bodies, walls and slot dividers are static boxes, and the ball is a dynamic sphere with damping and tuned restitution. The renderer owns the Three.js meshes while the game controller syncs the active cannon body to its mesh on every animation frame.

The board is constrained to feel like a 2D arcade cabinet while still using 3D geometry. A back and front guide plane keep the ball in the playfield depth, and a failsafe resolves the ball if it slows too much or exceeds the expected drop duration.

## Screenshots

Add project screenshots here after capturing local gameplay:

- `docs/screenshots/plinko-desktop.png`
- `docs/screenshots/plinko-mobile.png`
- `docs/screenshots/plinko-drop-in-motion.png`

## Local Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
src/
  audio/
    soundHooks.ts        Sound event placeholders
  game/
    boardLayout.ts       Shared peg and slot layout helpers
    GameController.ts    Drop, scoring, balance, and ball lifecycle logic
  physics/
    PlinkoPhysics.ts     cannon-es world, materials, bodies, and timestep
  three/
    PlinkoScene.ts       Three.js scene, board meshes, lighting, and animation
  ui/
    Hud.ts               Vanilla DOM HUD and controls
  config.ts              Board, multiplier, and economy configuration
  main.ts                App bootstrap and animation loop
  styles.css             Canvas, HUD, and arcade styling
```

## Future Improvements

- Add Web Audio synth tones or sample-based sounds for richer feedback
- Add postprocessing bloom for stronger neon highlights
- Support multiple simultaneous balls and a drop queue
- Add a results history strip for recent drops
- Add screenshot assets to the README and project gallery
- Add lightweight end-to-end visual smoke tests for desktop and mobile viewports

## Portfolio Reflection

This project demonstrates how to combine real-time rendering, physics simulation, and interface design into a focused browser game. The board is procedural rather than asset-heavy, so the visual style comes from geometry, materials, lighting, CSS, and animation. The code separates rendering, physics, game state, and UI concerns, which keeps the experience easy to tune while still delivering a cohesive arcade feel.

Plinko Arcade is intentionally small in scope, but it touches the same disciplines used in larger interactive product work: responsive layout, state management, simulation tuning, visual polish, and maintainable TypeScript architecture.
