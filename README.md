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

## Hướng dẫn cài đặt thư viện

### Yêu cầu

- [Node.js](https://nodejs.org/) 20 trở lên (kiểm tra: `node -v`)
- [Python](https://www.python.org/) 3.11 trở lên (kiểm tra: `python --version`)
- [Git](https://git-scm.com/) (cần để cài Spec Kit từ GitHub)

Các lệnh dưới đây chạy trong thư mục gốc của project (thư mục chứa `package.json`).

### 1. Cài Phaser (và các thư viện JavaScript khác)

Phaser, Vite và font đã được khai báo trong `package.json`, nên chỉ cần:

```bash
npm install
```

Lệnh này tạo thư mục `node_modules/`. Nếu tạo project mới từ đầu và muốn tự thêm Phaser:

```bash
npm install phaser
npm install --save-dev vite
```

Kiểm tra: `npm run dev` rồi mở http://localhost:8080.

### 2. Tạo môi trường ảo Python (venv)

Spec Kit được cài trong venv `.venv` của project, không cài global. `.venv` nằm trong `.gitignore`,
nên sau khi clone project phải tạo lại:

```bash
python -m venv .venv
```

Kích hoạt venv (không bắt buộc, nhưng sau đó có thể gõ thẳng `specify`, `pip`):

| Shell | Lệnh |
| ----- | ---- |
| PowerShell | `.venv\Scripts\Activate.ps1` |
| cmd | `.venv\Scripts\activate.bat` |
| Git Bash | `source .venv/Scripts/activate` |
| macOS / Linux | `source .venv/bin/activate` |

Thoát venv: `deactivate`. Muốn xoá sạch mọi thứ đã cài: xoá thư mục `.venv`.

Nếu PowerShell báo lỗi "running scripts is disabled", chạy một lần:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 3. Cài Spec Kit (`specify` CLI)

Sau khi đã kích hoạt venv:

```bash
pip install git+https://github.com/github/spec-kit.git
specify --help
```

Hoặc không cần kích hoạt venv (Windows):

```bash
.venv\Scripts\python -m pip install git+https://github.com/github/spec-kit.git
```

Cập nhật Spec Kit: chạy lại lệnh `pip install` ở trên kèm `--upgrade`.

Project đã có sẵn thư mục `.specify/` và `.claude/skills/speckit-*`, nên **không cần** chạy `specify init`
khi mới clone. Chỉ chạy lại khi muốn cập nhật template/lệnh sau khi nâng cấp Spec Kit:

```bash
specify init --here --force --non-interactive --integration claude --ignore-agent-tools
```

(`--ignore-agent-tools` cần khi lệnh `claude` không có trong PATH, ví dụ chỉ dùng extension VS Code.)

Cách dùng các lệnh `/speckit-*` trong Claude Code: xem [specins.md](specins.md).

### Tóm tắt (clone về máy mới, Windows PowerShell)

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

## Before submission

- Every part in `src/data/parts.js` has `verified: false`. Check each value against the cited NASA
  source (SOA 2024, VCLS, S3VI Thermal) and set `verified: true`. The tests in
  `tests/simulate.test.js` will tell you if a changed value breaks a mission.
- Cross-check the delta-v budgets in `src/data/missions.js` with GMAT sample missions.
- Declare AI use in the project description: the code, including the code that draws all the pixel
  art and synthesises the sounds, was written with an AI assistant.
