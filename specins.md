# Spec Kit Instructions

This project uses [GitHub Spec Kit](https://github.com/github/spec-kit) for spec-driven development with Claude Code. You write down what you want, and Claude turns it into a spec, a plan, a task list and finally code.

## What's in the project

| Path | What it is |
| ---- | ---------- |
| `.claude/skills/speckit-*` | The Spec Kit slash commands Claude Code uses |
| `.specify/memory/constitution.md` | The project's ground rules (tech stack, coding standards) |
| `.specify/templates/` | Templates for specs, plans, tasks and checklists |
| `.specify/scripts/powershell/` | Helper scripts the commands run |
| `specs/` | Created when you run `/speckit-specify`; one folder per feature |

## Before you start

Open a new Claude Code chat session in this folder, so the Spec Kit commands are picked up.

## Workflow

Type these commands in the Claude Code chat, in order:

1. **`/speckit-constitution`**: set the project's ground rules. Example:
   ```
   /speckit-constitution Phaser 4 + Vite, plain JavaScript, runs in the browser. Keep scenes small and readable.
   ```
2. **`/speckit-specify`**: describe the game or feature you want: what it does and why, not how to build it. Example:
   ```
   /speckit-specify A space game where the player pilots a ship and collects data from planets while avoiding asteroids.
   ```
3. **`/speckit-plan`**: make a technical plan from the spec.
4. **`/speckit-tasks`**: break the plan into a list of tasks.
5. **`/speckit-implement`**: build the feature by working through the tasks.

### Optional checks

| Command | When to run it | What it does |
| ------- | -------------- | ------------ |
| `/speckit-clarify` | After specify, before plan | Asks questions to clear up unclear parts of the spec |
| `/speckit-checklist` | After plan | Makes a checklist to check the requirements are complete and clear |
| `/speckit-analyze` | After tasks, before implement | Checks the spec, plan and tasks are consistent with each other |
| `/speckit-converge` | Any time after implementing | Compares the code with the spec and adds tasks for what's left |

## Notes

- **Git:** Spec Kit normally makes a git branch for each feature. This folder is not a git repository yet. It still works without one, but run `git init` if you want features tracked by branch.
- **`.claude/` folder:** if you push this project to a public repo, think about adding parts of `.claude/` to `.gitignore`, since agent folders can hold private data. The `skills` folder is safe to commit.
- **Running the game:** see [README.md](README.md).

## Re-installing or updating Spec Kit

Spec Kit's CLI (`specify`) is installed in the project's virtual environment `.venv`, not globally. `.venv` is in `.gitignore`, so after cloning, create it first:

```bash
python -m venv .venv
.venv\Scripts\python -m pip install git+https://github.com/github/spec-kit.git
```

To update Spec Kit, run the `pip install` line again with `--upgrade`. Then re-run init from the project folder:

```bash
.venv\Scripts\specify init --here --force --non-interactive --integration claude --ignore-agent-tools
```

You can also activate the environment first (`.venv\Scripts\activate` in PowerShell or cmd) and then just type `specify ...`. Deleting the `.venv` folder removes everything installed in it.

`--ignore-agent-tools` is needed when the `claude` command isn't on your PATH, for example when you only use the VS Code extension.
