# Course plan: Kubernetes → AKS → DevOps on Azure

This folder is the plan for the **whole course**. We write and agree it here before building more of the app. Every chapter has its own file in [`chapters/`](chapters/). [`formats.md`](formats.md) describes the building blocks every lesson is made from.

## The decision: a guided course, no simulated environment (for now)

The whole course uses the format proven in [`app-preview/`](../app-preview/): short, guided, step-by-step lessons with interactive widgets and checks. It needs no Azure subscription, no floci-az, no cluster and no backend. A static site is enough, and it still runs with `docker compose up -d` (a single nginx container).

**Why this is the right call now**
- **Content is the hard part.** Getting ~95 lessons accurate and well-sequenced matters far more than lab infrastructure. Building a simulator first would delay the part learners actually value.
- **"Evaluated" doesn't require a cluster.** Most of what we want to grade is *reasoning about files*: is this manifest valid, do the labels match, does this NetworkPolicy block that traffic, will this stage run? Small JavaScript **models** (graders and mini-simulators) can check that in the browser, as `lab-yaml.html` already does. See [formats.md → Evaluation](formats.md#evaluation-without-a-cluster).
- **It's cheap to ship and host.** Static files, offline-capable, nothing to secure.
- **It doesn't close any doors.** If lesson content lives as data (as `window.LESSON` does today), we can later port the player to Svelte 5, add a Rust API for accounts and progress, or add floci-az labs as an *optional* "real environment" track.

**What we give up, honestly**
- **Real error messages and real feedback loops.** A learner never sees an actual `ImagePullBackOff` happen. We mitigate this by teaching troubleshooting from **real output** (Chapter 14 is built around reading `kubectl describe` and events), and by adding optional **"Try it locally"** boxes (about 60, in Chapters 1–6 and 8–17) that run the lesson for real on a free local `kind` lab. Each box is tested in CI.
- **Muscle memory for typing commands.** We mitigate this with the **command check**: the learner types the command, and a parser validates the verb, resource and flags.
- **Grading only catches what a rule describes.** A file can pass every rule and still be wrong in a way we didn't anticipate. We keep rules precise, explain every failure, and always offer the reference solution afterwards.
- **Progress lives in the browser** (`localStorage`). Results are a self-reported *completion record*. There are no accounts or verifiable certificates until we add a backend.

## Who it's for

**An IT professional who is comfortable on a command line, but new to Kubernetes and new to Azure for DevOps.** That includes sysadmins and ops engineers moving into DevOps, developers who've never deployed anything themselves, and engineers coming from AWS or GCP.

| Topic | Assumed | Taught where needed | Not covered |
|---|---|---|---|
| Command line | Running commands, files, pipes, env vars | Scripting basics (0.2) | PowerShell, beyond comparison tabs |
| Git | clone, commit, push, branch, PR | Branch policies (0.5, Ch 7) | Rebasing, internals |
| YAML | Nothing | 0.1 | — |
| Containers | "Has heard of Docker" | Ch 1.1 | Docker networking and volumes in depth |
| Networking | What an IP address and a port are | CIDR, subnets, DNS, TLS, NAT (0.3) | Routing protocols |
| Azure | Has seen the portal | Tenant → subscription → resource group; identities; RBAC (0.4) | Azure basics outside DevOps |
| Programming | Nothing | — | Writing app code (the app is given) |

**Chapter 0** is optional. Its placement quiz recommends the refreshers a learner needs, and lets people who already know Kubernetes **test out of Chapters 1–3** by passing those chapters' quizzes.

## Course map

| # | Chapter | Part | Lessons | Status |
|---|---|---|---|---|
| 0 | [Ready check: placement & refreshers](chapters/00-ready-check.md) | Getting started | 6 + placement quiz | Planned · **new** · optional |
| 1 | [Why Kubernetes: containers, the cluster & kubectl](chapters/01-why-kubernetes.md) | Kubernetes foundations | 6 | Planned |
| 2 | [Core objects: Pods, Deployments, Services, config](chapters/02-core-objects.md) | Kubernetes foundations | 7 | Planned |
| 3 | [Scheduling, storage, probes & autoscaling](chapters/03-scheduling-storage-probes.md) | Kubernetes foundations | 6 | Planned |
| 4 | [AKS: what Azure manages vs what you control](chapters/04-aks-shared-responsibility.md) | Azure Kubernetes Service | 6 | Planned |
| 5 | [AKS networking & identity](chapters/05-aks-networking-identity.md) | Azure Kubernetes Service | 7 | Planned |
| 6 | [ACR & deploying to AKS: public vs private clusters](chapters/06-acr-public-private.md) | Azure Kubernetes Service | 6 | Planned |
| 7 | [Azure Pipelines: CI/CD to AKS](chapters/07-azure-pipelines.md) | DevOps | 6 | **Built (preview)** |
| 8 | [Namespaces, Ingress & the Gateway API](chapters/08-namespaces-ingress-gateway.md) | DevOps | 6 | Planned |
| 9 | [Network policies: default-deny & zero trust](chapters/09-network-policies.md) | DevOps | 5 | Planned |
| 10 | [Helm & Kustomize in pipelines](chapters/10-helm-kustomize.md) | DevOps | 6 | Planned |
| 11 | [Release strategies: rolling, blue/green, canary](chapters/11-release-strategies.md) | DevOps | 5 | Planned |
| 12 | [Infrastructure as code with Terraform](chapters/12-terraform.md) | Infrastructure as code | 8 | Planned |
| 13 | [Infrastructure as code with Bicep](chapters/13-bicep.md) | Infrastructure as code | 8 | Planned · **new** |
| 14 | [Observability & troubleshooting](chapters/14-observability-troubleshooting.md) | Operate & secure | 6 | Planned · **new** |
| 15 | [Cluster & pipeline security](chapters/15-security.md) | Operate & secure | 7 | Planned |
| 16 | [Supply chain: scanning, signing & policy-as-code](chapters/16-supply-chain.md) | Operate & secure | 5 | Planned |
| 17 | [Capstone: ship a production-grade app to AKS](chapters/17-capstone.md) | Capstone | 4 + project | Planned |

**Changes from the preview's home-page map**
- **Infrastructure as code is now its own part, with two full chapters.**
  - Chapter 12 is Terraform; it comes first and is the primary language.
  - Chapter 13 is Bicep. It builds the same Contoso platform, with "Coming from Terraform" tabs and translate exercises.
  - The capstone lets learners submit either language.
- **New Chapter 14, Observability & troubleshooting.** Without a live cluster, reading real diagnostic output is the best substitute for hands-on debugging, and it's a skill employers test.
- **ACR moves into Chapter 6.** The registry is introduced *before* pipelines, so Chapter 7 can push to it without re-teaching it.
- **Security and best practices are a separate part (Chapters 14–16).** Each earlier chapter still ends with its own "best practice" step, so security isn't left until the end.
- **The capstone becomes Chapter 17.**

## The running example

One fictional company, **Contoso Orders**, runs through the whole course. Its `orders-api` (and a small `web` frontend) starts as a container in Chapter 1 and ends as a secured, policy-checked, canary-released workload on a private AKS cluster in Chapter 17. Every chapter adds files to the same repository:

```
orders-api/
├─ Dockerfile                      ch1
├─ k8s/base/*.yaml                 ch2–3   (deployment, service, configmap, hpa, pdb)
├─ k8s/overlays/{dev,prod}/        ch10
├─ k8s/policies/*.yaml             ch9, ch15
├─ k8s/gateway/*.yaml              ch8
├─ infra/terraform/*.tf            ch12
├─ infra/bicep/*.bicep             ch13    (same platform, second language)
├─ infra-pipeline.yml              ch12–13
├─ templates/*.yml                 ch7
└─ azure-pipelines.yml             ch7 → ch11, ch16
```

This means learners recognise the files, each lesson only adds the new piece, and the capstone is "assemble and harden what you already know".

## Size estimate

| | Count |
|---|---|
| Chapters | 18 (0–17) |
| Guided lessons | ~110 |
| Steps (≈ 10–12 per lesson; Chapter 0 ≈ 7) | ~1,200 |
| Checks inside lessons | ~520 |
| Placement quiz | 1 × ~15 questions |
| Chapter quizzes | 16 × ~8–12 questions, drawn from pools ≈ 2× (≈ 320 pool questions) |
| Final exam | ~40 questions drawn from the chapter pools |
| Predict-the-outcome sets | 16 |
| Write-the-file labs (graded) | ~30 |
| Reusable widgets / mini-simulators | ~20 (see formats.md) |
| "Try it locally" boxes | ~60, each a tested script, plus the `lab/` setup and a CI job |
| Learner time | ~30–40 hours |

For reference, Chapter 7 alone is 66 steps, a quiz, a predict set and two labs.

## Suggested build order

1. ~~**Generalise the player.**~~ **Done:** lessons live in `app-preview/content/chNN/*.js` and play through `lesson.html?l=chNN/<lesson>`. The player has the `multi`, `order`, `match`, `command` and `write` checks plus the A/B/C persona tab sets. The home map reads `content/course.js`. Still to add with their chapters: `diagnose` (Ch 13–14) and quiz/predict/lab pages driven by content files.
2. **Chapter 0, then Chapters 1–3.** Chapter 0 builds the YAML tree view and CIDR calculator. Chapters 1–3 establish the Kubernetes widgets (cluster diagram, label/selector matcher, scheduler simulator) that later chapters reuse.
3. **Chapters 4–6**, then revisit Chapter 7 so it builds on Chapter 6.
4. **Chapters 8–11** in order.
5. **Chapters 12–13.** Build the Terraform and Bicep graders together, since they share one requirement rule set.
6. **Chapters 14–16**, then the capstone.
7. **Course-wide pages:** review deck, final exam, course complete.
   - **Local lab:** the `lab/` scripts (lesson 0.6) and the CI job that runs every "Try it locally" box. Start this alongside step 2, since boxes are written with each chapter.
8. Optional later tracks: accounts and progress sync (Rust API), a Svelte 5 port, and floci-az "real lab" labs.

## Open questions (to settle before writing content)

1. ~~**Audience baseline.**~~ **Decided:** command line and basic Git assumed; no Kubernetes, YAML or Azure-for-DevOps knowledge assumed. An optional Chapter 0 has a placement quiz, refreshers and a test-out path. See [Who it's for](#who-its-for).
2. ~~**Persona tabs.**~~ **Decided:** three tab sets, chosen per step by topic.
   - **A · Background:** Windows/IIS admin, Linux admin, Developer (Docker Compose), Other clouds (EKS/GKE).
   - **B · CI/CD tool:** GitHub Actions, GitLab CI, Jenkins, Classic pipelines.
   - **C · Infra tooling:** Portal/ARM, az CLI scripts, CloudFormation, Pulumi. Chapter 13 adds a fixed "Coming from Terraform" tab.
   - Learners pick A and B at the end of the Chapter 0 placement quiz.
   - Tabs go on about 30% of steps, and "Careful:" tabs flag misleading analogies.
   - See [formats.md → Persona tabs](formats.md#persona-tabs-coming-from).
3. ~~**IaC language.**~~ **Decided:** both languages in full detail. Terraform first and primary (Chapter 12), then Bicep (Chapter 13). The capstone accepts either.
4. ~~**Assessment.**~~ **Decided:**
   - Chapters have three levels: Completed (unlocks the next chapter), Passed (score ≥ 70%, quiz ≥ 80%, no critical lab rule failing) and Mastered.
   - Weighting: labs 40%, quiz 30%, predict 15%, in-lesson checks 15%.
   - Quizzes are drawn from pools for retakes, and a review deck brings missed questions back.
   - The capstone plus a final exam make up the end of course.
   - See [formats.md → Assessment](formats.md#assessment).
5. ~~**"Try it for real" boxes.**~~ **Decided:** "Try it locally" boxes from the start, on a free `kind` lab.
   - Set up in optional lesson 0.6, with a local registry standing in for ACR.
   - About 60 boxes across Chapters 1–6 and 8–17. Never graded; at most 5 commands; always ending with cleanup.
   - Every box is a script run by CI against a fresh lab.
   - "Try it on Azure" boxes come later.
   - See [formats.md → Try it locally](formats.md#try-it-locally-boxes).

All open questions are settled.

## Application status

The application is built: a Rust API (`backend/`) that parses `course-content/` and grades every check and lab on the server, and a Svelte 5 frontend (`frontend/`). The whole stack starts with `docker compose up`. See the root [README](../README.md). Every interactive widget in the content has a working component (`frontend/src/widgets/`).

## Content status

The full text of every chapter is written as simple HTML in [`../course-content/`](../course-content/index.html): 110 lesson pages, plus a practice page per chapter (quiz pool, predict set, labs, "Try it locally" boxes), the placement quiz, the capstone project and the final exam. The markup contract in [`../course-content/README.md`](../course-content/README.md) maps each element to the player's step and check types, so the pages can be translated into the real application chapter by chapter.

Before release:
- Re-verify each chapter's accuracy notes.
- Replace Chapter 14's representative output with real captures.
- Write the `lab/` scripts and `lab/examples/` files that the "Try it locally" boxes reference.
