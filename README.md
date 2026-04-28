# PLNK-7 Field Terminal

**A cassette-futurism Plinko game presented as a worn alternate-1980s military control device.**

PLNK-7 reworks a familiar Plinko mechanic into a rugged physical terminal: matte plastic panels, recessed LCD glass, segmented readouts, tape reels, mechanical controls, and a custom canvas physics simulation. The project is designed as a frontend/design-engineering portfolio piece where interaction design, procedural visuals, and approachable simulation code work together as one object.

## Hero Description

Instead of a glossy casino board, PLNK-7 feels like equipment pulled from a field operations case. The UI is split into a three-column dashboard with technical labels, visible panel seams, molded indicators, a live landing log, distribution chart, VU meter, and a large dome DROP control. A Three.js scene renders the physical terminal slab behind the HTML interface, while the Plinko game itself runs in a deterministic 2D canvas simulation.

## Screenshot Placeholders

Add captured screenshots here after recording the running app:

- `docs/screenshots/plnk-7-desktop.png`
- `docs/screenshots/plnk-7-mobile.png`
- `docs/screenshots/plnk-7-chip-drop.png`

## Features

- Full cassette-futurism / worn military plastic dashboard
- Three.js terminal body with rounded slab geometry, scuffed procedural normal map, soft shadows, and slow idle motion
- HTML/CSS overlay for precise dashboard layout and responsive controls
- Custom 400 x 480 canvas Plinko field
- Eight rows by nine columns of staggered pegs
- Visible seven-bucket scoring row: L3, L2, L1, CTR, R1, R2, R3
- Single-chip gameplay with DROP button and Space key support
- Recessed score counter, elapsed timer, landing log, L/C/R stats, and distribution chart
- Animated VU meter and tape reel while a chip is falling
- No external image assets; all visuals are procedural CSS, canvas, and Three.js

## Tech Stack

- **Vite** for development and production builds
- **TypeScript** for typed game state and modular simulation code
- **Three.js** for the physical terminal body scene
- **Canvas 2D** for Plinko physics and playfield rendering
- **HTML/CSS** for the dashboard interface
- **Share Tech Mono** for the terminal-like typography

## Physics Explanation

The Plinko simulation is implemented in [`src/plinkoPhysics.ts`](./src/plinkoPhysics.ts). The internal playfield uses a fixed 400 x 480 coordinate system regardless of responsive CSS scaling.

Each frame applies gravity, mild velocity damping, wall clamping, and a maximum speed cap. Pegs are static circles arranged in a staggered grid. The chip is a dynamic circle that resolves peg overlap along the collision normal, reflects velocity using bounce damping, and receives a small horizontal nudge on impact so drops feel physical without becoming identical.

When the chip reaches the bottom of the canvas, its `x` position maps into one of seven equal bucket regions. The bucket awards points, flashes briefly, updates the landing log, increments the distribution chart, and returns the terminal to standby.

## Visual Design Direction

The visual system is intentionally matte and physical:

- Main plastic: `#D4C4A0`
- Recessed plastic: `#B8A882`
- Page background: `#C8B89A`
- LCD play field: `#8A9A7A`
- Dark ink: `#3a2a1a`
- Panel seams: `#A89870`
- Segment on: `#C8B882`
- Segment off: `#3a3220`
- Button crown: `#E0D4B0`

The interface avoids neon, glow, glossy gradients, and playful arcade typography. Panels use inset borders, inner shadows, screw details, segmented meters, recessed displays, raised dome controls, and dusty procedural texture to create the feeling of a rugged field terminal.

## Interaction Details

- Click **DROP** to release a chip.
- Press **Space** to trigger the same drop action.
- DROP is disabled while a chip is falling.
- The footer status changes from `STANDBY` to `ACTIVE`.
- The VU meter animates while active.
- One tape reel rotates while the system is active.
- The landing log stores the last eight landings.
- Distribution bars show relative bucket frequency.

## Project Structure

```text
src/
  main.ts            App bootstrap, dashboard state rendering, and interaction wiring
  plinkoPhysics.ts   Canvas playfield, chip simulation, collisions, and bucket detection
  threeScene.ts      Three.js terminal slab, lighting, shadows, and procedural plastic texture
  uiState.ts         Bucket configuration and typed terminal state
  styles.css         Cassette-futurism dashboard styling and responsive layout
```

## Local Setup

Install dependencies:

```bash
npm install
```

Run the development server:

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

## What This Project Demonstrates

PLNK-7 demonstrates product-minded frontend craft in a compact interactive format: translating a strong visual direction into a responsive interface, separating rendering layers by responsibility, writing a small custom physics engine, and giving the UI enough operational detail to feel like a believable object.

It is also a study in restraint. The final result relies on material, proportion, typography, motion, and state feedback rather than bright glow effects or stock assets.

## Future Improvements

- Add optional Web Audio tones for relay clicks, reel motion, and bucket landings
- Add a calibration mode for tuning gravity, damping, and bounce
- Add persistent high-score storage
- Add screenshot assets and a short demo clip for portfolio presentation
- Add Playwright smoke tests for desktop and mobile layout checks
