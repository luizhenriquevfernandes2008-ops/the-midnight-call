# The Midnight Call

*Chamado da Meia-Noite* — a side-scrolling investigative survival horror game
about a bankrupt detective who answers the phone at 2:14 in the morning.

Built from scratch in HTML5 Canvas. No engine, no build step, no dependencies.

> **Status: v0.1 — vertical slice.** Menu, opening cutscene, one alley, one
> bar. Playable end to end. See [`docs/SESSION_LOG.md`](docs/SESSION_LOG.md)
> for exactly what works and what is still broken.

---

## Also in here: [`dois-anos/`](dois-anos/)

**Dois Anos** — a second, completely different game sharing the same
foundations: Canvas only, no engine, no build step, packable into a single
double-clickable HTML.

Where *The Midnight Call* is a dark hallway, *Dois Anos* is a side-scrolling
platformer in full colour: four worlds, sixteen collectible memories, and a
character creator so the heroine can be made to look like a specific real
person. Built as an anniversary present.

The interesting reuse: the same skeletal-rig idea (hand-drawn pixel parts
rotating around joints, key poses interpolated) but with the colour map
generated at runtime from an appearance object, so hair, skin and clothing
are eighteen numbers instead of forty redrawn frames.

---

## Running it

**Double-click `JOGO_OFFLINE.html`.** No server, no Python, no internet, no
install. Any browser, any machine.

That file is the whole game bundled into a single HTML — the source is
written as ES modules, which browsers refuse to load over `file://`, so a
tiny build step (`ferramentas/gerar_offline.py`) packs every module into one
file with a minimal module registry. Each module keeps its own scope, so
same-named exports in different files do not collide.

**For development**, run `ABRIR_JOGO.bat` (Windows) or `./abrir_jogo.sh`
instead. That serves `index.html` over a local server so you can edit a file
in `js/` and just press F5. Regenerate the bundle afterwards with:

```
python ferramentas/gerar_offline.py
```

Do not open `index.html` directly — it will hang on the loading screen.
If something goes wrong, run `DIAGNOSTICO.bat`.

## Controls

| Key | Action |
|-----|--------|
| `A` / `D` or arrows | Walk |
| `Shift` (hold) | Run |
| `E` | Interact / advance dialogue |
| `J` or `Space` | Punch (press twice for the second hit) |
| **Right mouse** (hold) | Draw the gun and aim |
| **Mouse up / down** | Raise and lower the barrel while aiming (horizontal is ignored) |
| **Left mouse** | Fire |
| `R` | Reload |
| `Esc` | Pause / back |
| `Esc` or `Enter` (hold) | Skip the opening cutscene |
| `F1` | Debug overlay |

Aiming roots you to the spot — you cannot walk and shoot. That is
deliberate: this is a horror game, not an action game.

The main menu has a **Test Room** for stepping through every animation.

## What is interesting in here, technically

- **No sprite sheets.** The detective is a skeletal rig — nine hand-drawn
  pixel-art parts rotating around joints, driven by interpolated key poses.
  Rotated with nearest-neighbour sampling so the pixels stay hard-edged
  while the motion runs at a true 60 fps.
- **No font files.** Text is rendered with a system font into a buffer, then
  its alpha channel is hard-cut to produce bitmap-font edges — with accents
  intact, which matters for a bilingual PT/EN game.
- **No audio files** (except the narration). Rain, wind, footsteps, punches,
  door creaks, the lighter, and the menu piano are all synthesised at
  runtime in WebAudio.
- **Everything renders at 480×270** and is upscaled with nearest neighbour.
  The scene is multiplied by a light buffer, with a quarter-resolution
  bloom pass, film grain, scanlines and vignette on top.
- **Level art is procedural but deterministic** — brick, asphalt, rust and
  grime are thousands of seeded 1px rectangles, drawn once at load into
  layer canvases.
- **The opening cutscene is driven by the narration audio**, not a timer.
  The car brakes when the sentence ends, whatever the recording's length.
  The subtitle cues were derived by measuring the audio's volume envelope
  and aligning the script's sentences to the detected speech blocks.

## Layout

```
index.html          shell + crash screen
js/core/            renderer, text, input, audio, saves
js/art/             palette, pixel tools, the character rig
js/world/           camera, materials, levels, weather
js/systems/         player, dialogue, cutscene
js/ui/              menu, pause, shared panels
docs/GAME_DESIGN.md the plan: full 5-hour chapter breakdown, systems roadmap
docs/SESSION_LOG.md what was built each session, and every open bug
```

## A note on `assets/reference/`

Those are third-party reference images (concept art and screenshots the
author collected while defining the look). They are here for development
convenience. **Remove them before making this repository public.**
