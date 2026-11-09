# KubeQuest: app preview (Chapter 7, Azure Pipelines)

The course plan lives in [`../course-plan/`](../course-plan/README.md). This preview is the player and the first built chapter.

A clickable, static prototype that shows how the learning app will look and behave.
It has no build step and no CDN, and works offline.

## Open it

```bash
python3 -m http.server 4173 -d app-preview
```

Then browse to http://localhost:4173. Opening `index.html` directly from disk also works.

## Page map

| Page | What it shows |
|---|---|
| `index.html` | Home dashboard: continue learning, streak, the 18-chapter course map (from `content/course.js`), local-lab card |
| `chapter.html` | Chapter overview: sections, lessons, skills, how you're evaluated |
| `lesson.html?l=ch07/l1` | **Guided** (11 steps): manual vs automated, CI/CD flow, delivery vs deployment switch, Azure DevOps, Classic vs YAML |
| `lesson.html?l=ch07/l2` | **Guided** (13 steps): the YAML file grows line by line, fill-the-blank and tap-the-line checks |
| `lesson.html?l=ch07/l3` | **Guided** (10 steps): agents and pools, hosted vs self-hosted, demands challenge in the agent matcher |
| `lesson.html?l=ch07/l4` | **Guided** (11 steps): identities, token flow (federation vs secret), RBAC, graded service-connection form |
| `lesson.html?l=ch07/l5` | **Guided** (11 steps): dependsOn, fan-in, conditions, stage simulator challenge, environments, strategies |
| `lesson.html?l=ch07/l6` | **Guided** (10 steps): variables, the three expression syntaxes, secrets, templates |
| `lesson.html?l=dev/checks` | Developer fixture: one step per check type (not linked from the course) |
| `lesson-N-reference.html` | Long-form reference view of each lesson (linked from **Read more** and the summary screen) |
| `quiz.html` | Focus-mode checkpoint quiz: multiple choice, select-all, drag-to-order, fill the YAML, spot the bug |
| `predict.html` | Read & reason: predict each stage's result in 3 scenarios, then replay the run |
| `lab-yaml.html` | Write-the-YAML lab with a static grader (11 rules) and a live stage graph of *your* YAML |
| `lab-terminal.html` | Scripted terminal lab: `az` / `docker` / `kubectl` against "floci-az" with live checks |
| `chapter-complete.html` | Weighted score breakdown, skills, review suggestions |

## What is mocked here vs. the real app

| Prototype (browser JS) | Real app |
|---|---|
| `assets/yaml.js`: small YAML parser and rule grader | Rust: `serde_yaml` + Azure Pipelines JSON schema + rule engine |
| `lab-terminal.html`: scripted command responses | A real sandbox container (az, docker, kubectl) against floci-az + k3s |
| Progress and XP in `localStorage` | SQLite via the Rust API |
| Live checks tick from local state | Backend queries the floci-az ARM API and the k3s cluster |

## Shared assets

- `assets/styles.css`: design tokens (light/dark), layout, components
- `assets/app.js`: top bar, curriculum sidebar, progress, theme, toasts, inline checks, tabs
- `assets/yaml.js`: highlighter, code blocks, editor overlay, mini parser
- `assets/pipeline-graph.js`: stage/job graph renderer and `azure-pipelines.yml` → graph model
- `assets/stepper.js`: guided step player. A lesson is a `window.LESSON` object; each step has a body, then either a `code` file (new lines auto-marked `+`) or a widget `panel` with `onShow(el, api)`, optional "Coming from" tabs, and an optional check. The full step schema is in the comment at the top of the file.
  - **Checks:** `mcq`, `multi`, `order`, `match`, `command` (a small CLI spec matcher: flags in any order, long/short aliases), `write` (an editor plus graded rules, ⛔ for critical ones), `tapline`, `fill`, and `custom` (the widget calls `api.solve()` / `api.miss()`).
  - **Coming from:** `coming.set` picks the tab set (`A` background, `B` CI/CD tool, the default, `C` infra tooling, `TF` Terraform). Choices are stored per set as `persona.A`, `persona.B` and `persona.C`.

## Content

- `lesson.html?l=chNN/<lesson>` is the one player page. It loads `content/chNN/<lesson>.js`, then `assets/stepper.js`.
- `content/course.js`: the chapter manifest used by the home page.
- `content/ch07/l1.js` … `l6.js`: Chapter 7's lessons. The old `lesson-N-*.html` URLs redirect here.
- `content/dev/checks.js`: test fixture for every check type.

To start over, use **Reset prototype progress** on the chapter results page.
