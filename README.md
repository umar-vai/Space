# NEBULA STRIKE

A polished browser-based space shooter built with HTML5 Canvas, CSS, vanilla JavaScript and the Web Audio API.

## Game features

- Professional sci-fi menu, HUD, pause screen and game-over UI
- Smooth WASD / arrow-key movement
- Mouse and touch steering support
- Dual pulse-cannon shooting
- Four regular enemy classes: Scout, Striker, Shooter and Tank
- Command-class boss encounter every 5th sector
- Multiple boss projectile patterns
- Escalating enemy waves and difficulty
- Shield + hull damage system with shield regeneration
- Combo multiplier scoring
- Rapid-fire, shield and repair power-ups
- Local high-score and best-sector saving
- Particle explosions, weapon glow, engine flame and screen shake
- Responsive desktop/mobile interface
- Procedural laser, explosion, damage, pickup, alert and UI sound effects
- Procedural synth background music — no external audio files required
- Mute/unmute controls
- Pause/resume/restart flow

## Controls

| Action | Desktop | Mobile / Touch |
| --- | --- | --- |
| Move | `WASD` or Arrow Keys | Drag on the game area |
| Fire | `Space` or hold mouse/pointer | Hold the FIRE button |
| Pause | `P` or `Esc` | Pause button |
| Audio | `M` | Sound button |
| Restart after defeat | `R` | REDEPLOY button |
| Start mission | `Enter` | LAUNCH MISSION button |

## Run

This project has no build step and no package dependencies. Open `index.html` in a modern browser, or serve the repository as a static website.

For GitHub Pages, publish the repository root from the `main` branch.

## Technical notes

- Rendering: HTML5 Canvas 2D
- Audio: Web Audio API
- Persistence: `localStorage`
- UI: responsive CSS / glass sci-fi interface
- Dependencies: none for game logic

> Browsers require a user interaction before audio can start, so music and SFX initialize when the player launches the mission or interacts with the audio controls.
