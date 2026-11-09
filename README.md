# Kubernetes → AKS → DevOps on Azure

A guided course application: 18 chapters, 110 step-by-step lessons, 685 checks, 23 server-graded write labs, a placement quiz, a capstone project and a timed final exam.

## Run it

```bash
docker compose up
```

Open http://localhost:8080. Set `PORT=9000 docker compose up` to use another port. Learner progress is kept in the `kq-data` volume (SQLite).

## How it fits together

```
course-content/   the course text as simple HTML (the source of truth)
backend/          Rust (axum): parses course-content at startup, serves it as JSON,
                  grades every check and lab, stores progress in SQLite
  labs/           machine-readable grader rules per lab, plus complete reference solutions
frontend/         Svelte 5 + Vite single-page app, served by nginx (which proxies /api)
docker-compose.yml
```

- **Content.** `backend/src/content.rs` turns the markup contract in `course-content/README.md` into lessons, steps, blocks and checks. Edit the HTML, rebuild, and the app follows.
- **Answers stay on the server.** The JSON the browser receives has no correct options, explanations or solutions. `POST /api/checks/grade` returns them after an attempt. Option order is shuffled deterministically per check.
- **Labs.** `backend/labs/*.yaml` holds the rules: regex and YAML-path tests, plus built-in evaluators (Service → pod selectors, targetPorts, ConfigMap references, Pod Security "restricted", a NetworkPolicy connectivity evaluator, an RBAC evaluator, Gateway route checks). Rule *N* grades rule *N* of the lab's list in the course page. ⛔ critical rules block a pass at any score.
- **Interactive widgets.** Every `data-widget` in the content maps to a Svelte component in `frontend/src/widgets/` (see `index.js`). There are about 40: cluster and scheduler simulators, a scripted kubectl terminal, rollout/HPA/probe/canary simulators, a request router, Kustomize and Helm renderers, a Bicep→ARM compiler, IaC editors that "plan" HCL/Bicep for dev and prod, pipeline-stage simulators and more. A widget picks its mode from its description, and widgets with a task ("Success when …") complete their check when solved. NetworkPolicy, RBAC and Pod Security widgets are evaluated on the server (`POST /api/eval`) with the same engines the labs use.
- **Progress.** The browser gets an anonymous learner id (`POST /api/learners`) and syncs one progress document (`/api/progress`). Graded attempts are logged in `/api/attempts`. Results are a self-reported completion record, not a certificate.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/health` | counts of lessons, checks and labs |
| GET | `/api/course` | parts, chapters, lessons, quiz and lab info |
| GET | `/api/lessons/{ch}/{lesson}` | one lesson's steps and blocks |
| GET | `/api/pages/{ch}/practice`, `/api/pages/{ch}/project`, `/api/pages/exam` | practice, project and exam pages |
| POST | `/api/checks/grade` | `{id, answer}` → result with feedback |
| POST | `/api/labs/grade` | `{id, files: {name: text}}` → score and per-rule results |
| POST | `/api/labs/solution` | `{id}` → the reference solution |
| GET | `/api/exam/draw` | ~40 questions following the final-exam blueprint |
| POST | `/api/eval` | widget evaluation: `{kind: netpol\|rbac\|pss, yaml, …}` |
| POST/GET/PUT/DELETE | `/api/learners`, `/api/progress`, `/api/attempts` | learner progress (header `X-Learner`) |

## Develop

```bash
cd backend && cargo run          # API on :8080, reads ../course-content and ./labs
```

```bash
cd frontend && npm install && npm run dev   # UI on :5173, proxies /api to :8080
```

```bash
cd backend && cargo test         # unit tests (command parser, routes, YAML paths)
```

When you change a lab's rules, check that its reference solution still scores 100% and its starter text doesn't pass.
