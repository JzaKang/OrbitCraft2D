# OrbitCraft 2D

A 2D pixel-art game for the NASA Space Apps Challenge 2026 "Space Mission Design Game" challenge.
Players build a rocket and spacecraft, launch it, and read a post-mortem report that explains which
part caused the success or failure, using real physics (Tsiolkovsky rocket equation, CG/CP stability
from TIR-33, power / thermal / comms budgets).

Built with [Phaser 4](https://phaser.io/) and [Vite](https://vite.dev/).

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:8080
npm test           # run every test file
npm run build      # production build into dist/
```

## Installing the libraries

### Requirements

- [Node.js](https://nodejs.org/) 20 or newer (check: `node -v`)
- [Python](https://www.python.org/) 3.11 or newer (check: `python --version`)
- [Git](https://git-scm.com/) (needed to install Spec Kit from GitHub)

Run the commands below in the project root (the folder that contains `package.json`).

### 1. Install Phaser (and the other JavaScript libraries)

Phaser, Vite and the fonts are already listed in `package.json`, so you only need:

```bash
npm install
```

This creates the `node_modules/` folder. If you are starting a new project from scratch and want to add Phaser yourself:

```bash
npm install phaser
npm install --save-dev vite
```

Check: run `npm run dev`, then open http://localhost:8080.

### 2. Create a Python virtual environment (venv)

Spec Kit is installed in the project's `.venv` venv, not globally. `.venv` is in `.gitignore`,
so you have to create it again after cloning the project:

```bash
python -m venv .venv
```

Activate the venv (optional, but then you can type `specify` and `pip` directly):

| Shell | Command |
| ----- | ------- |
| PowerShell | `.venv\Scripts\Activate.ps1` |
| cmd | `.venv\Scripts\activate.bat` |
| Git Bash | `source .venv/Scripts/activate` |
| macOS / Linux | `source .venv/bin/activate` |

Leave the venv: `deactivate`. To remove everything you installed: delete the `.venv` folder.

If PowerShell shows the error "running scripts is disabled", run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 3. Install Spec Kit (`specify` CLI)

After activating the venv:

```bash
pip install git+https://github.com/github/spec-kit.git
specify --help
```

Or without activating the venv (Windows):

```bash
.venv\Scripts\python -m pip install git+https://github.com/github/spec-kit.git
```

To update Spec Kit: run the `pip install` command above again with `--upgrade`.

The project already has the `.specify/` and `.claude/skills/speckit-*` folders, so you **do not need** to run `specify init`
after cloning. Only run it again if you want to update the templates/commands after upgrading Spec Kit:

```bash
specify init --here --force --non-interactive --integration claude --ignore-agent-tools
```

(`--ignore-agent-tools` is needed when the `claude` command is not in your PATH, for example when you only use the VS Code extension.)

How to use the `/speckit-*` commands in Claude Code: see [specins.md](specins.md).

### Summary (cloning onto a new machine, Windows PowerShell)

```powershell
npm install
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install git+https://github.com/github/spec-kit.git
npm run dev
```

## Game flow

1. **Mission Briefing** (`MissionSelectScene`): LEO, Moon or Mars, each with a budget, a delta-v
   requirement, science goals and a comms distance.
2. **Workshop** (`BuilderScene`): drag parts from the PARTS BIN onto the rocket (or click to add);
   drag parts on the rocket to reorder them, or drop them on the bin to remove. The right panel shows
   live meters (hover any bar for the explanation and fix), and the yellow CG / orange CP markers move
   on the blueprint with the static margin between them. Undo/redo, a help overlay and toasts included.
   Each mission starts with a starter design that has one flaw (LEO: no fins, Moon: UHF radio,
   Mars: too few solar arrays).
3. **Launch** (`LaunchScene`): plays back the simulated result (stuck on the pad, tumble, falling back,
   stranded, dead bus, loss of signal...) with a telemetry HUD, flight log and 1x / 2.5x speed.
4. **Post-Mortem Report** (`ReportScene`): root cause, parts involved, how to fix, and every check
   (including predicted problems after the failure). "Fix in Workshop" returns with the parts involved
   flashing red. Successful missions earn up to 3 stars (success, thrifty, bonus science), saved in the
   browser.

### Controls

| Where | Keys |
| ----- | ---- |
| Mission select | `1` `2` `3` choose a mission |
| Workshop | `Up`/`Down` move part · `Delete` remove · `Esc` deselect · `Ctrl+Z`/`Ctrl+Y` undo/redo · `H` help · `Enter` launch |
| Launch | `S` speed · `Esc` skip to report |
| Report | `Enter` fix in workshop · `R` relaunch · `Esc` missions |
| Everywhere | `M` sound on/off |

## Project structure

```
src/
  data/
    parts.js        Part catalog (values + NASA source + verified flag)
    missions.js     Mission scenarios, starter and reference designs
    assets.js       Optional hand-made PNGs that override the generated art
  core/             Pure logic (no Phaser), tested with Node
    physics.js      Formulas: rocket equation, TWR, CG, CP, static margin, orbits, power, comms
    design.js       Stack editing, staging, design validation
    analysis.js     Turns a design + mission into numbers (stage delta-v, aero, power...)
    simulate.js     Runs the mission checks and builds the post-mortem
    score.js        Star rating
  art/              Procedural pixel art (pure functions, tested with Node)
    pixel.js        Pixel buffer, colour ramps, shading, noise, dithering
    partArt.js      Sprite for every part
    worldArt.js     Planets, sky, launch site, effects, UI icons
    textures.js     Registers everything as Phaser textures
  ui/
    theme.js        Colours, pixel fonts (Silkscreen, VT323), text helpers
    widgets.js      Buttons, panels, meters, tooltips, toasts, modal, scene transitions
    sfx.js          Retro sound effects synthesised with WebAudio
    progress.js     Saved stars / settings (localStorage)
    rocketView.js   Draws the rocket and maps metres to screen y for CG/CP
  scenes/           Boot, MissionSelect, Builder, Launch, Report
tests/              One .js file per area, run with node --test
public/assets/parts Optional hand-made PNG overrides
```

## Tests

Each file in `tests/` is a standalone test file using Node's built-in test runner (no extra packages).

| Command                  | File                      | What it covers                                    |
| ------------------------ | ------------------------- | ------------------------------------------------- |
| `npm test`               | `tests/run-all.js`        | Runs every `*.test.js` file                       |
| `npm run test:physics`   | `tests/physics.test.js`   | Rocket equation, TWR, CG/CP, orbit, power, comms  |
| `npm run test:design`    | `tests/design.test.js`    | Stack editing, staging, validation rules          |
| `npm run test:analysis`  | `tests/analysis.test.js`  | Stage delta-v, aero margins, power/thermal/comms  |
| `npm run test:simulate`  | `tests/simulate.test.js`  | Every failure mode from one part change, success  |
| `npm run test:data`      | `tests/data.test.js`      | Part catalog and mission data integrity           |
| `npm run test:layout`    | `tests/layout.test.js`    | Rocket drawing layout and CG/CP marker mapping    |
| `npm run test:art`       | `tests/art.test.js`       | Every sprite, planet and icon renders correctly   |
| `npm run test:score`     | `tests/score.test.js`     | Star rating                                       |

You can also run one file directly: `node --test tests/physics.test.js`.

## Art

All graphics are pixel art generated by code in `src/art/` (no image files). To tweak a part's look,
edit its function in `src/art/partArt.js`. To replace one with a hand-drawn PNG instead, save it as
`public/assets/parts/<partId>.png` (about 26 px wide, transparent, nose up) and add the id to
`PROVIDED_PART_ART` in `src/data/assets.js`.

Fonts: [Silkscreen](https://fonts.google.com/specimen/Silkscreen) and
[VT323](https://fonts.google.com/specimen/VT323) (SIL Open Font License), bundled via `@fontsource`,
so the game works offline.

