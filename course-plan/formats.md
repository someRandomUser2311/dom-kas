# Formats: what every lesson is built from

The course reuses a small set of building blocks. Chapter files refer to them by the names in **bold**.

## Lesson anatomy

- **8–14 steps** per lesson, about 6–10 minutes.
- Each lesson has **one idea**. If the summary needs more than five bullets, split the lesson.
- **Step order pattern:** introduce → show (code or widget) → let the learner *do* something → check → best practice / gotcha → summary.
- **At least 3 checks per lesson.** No more than 3 read-only steps in a row.
- **Code grows step by step.** Each step shows the same file with new lines highlighted (the stepper's LCS diff does this already).
- **Read more drawer** for depth that would slow the main path: edge cases, history, links to Microsoft Learn and Kubernetes docs.
- **Coming from tabs** on concept steps: short comparisons from tools the learner already knows. The tab set (Background, CI/CD tool or Infra tooling) follows the step's topic, and the choice is remembered. See [Persona tabs](#persona-tabs-coming-from).
- **Summary step**: 3–5 key points, then a "Next" link.

## Step types (existing in the preview)

| Name | What the learner sees | Used for |
|---|---|---|
| **read + code** | Explanation with a highlighted file on the right | Introducing syntax |
| **read + panel** | Explanation with a diagram or widget on the right | Concepts, flows |
| **mcq** | Pick one answer; wrong answers explain *why* they're wrong | Concepts, decisions |
| **tapline** | Tap the line in the file that does X | Reading real files |
| **fill** | A blank in the code, filled from word chips | Syntax recall |
| **custom** | A widget unlocks Continue when the learner gets it right | Hands-on challenges |

## New step types to build

| Name | What the learner does | Grading |
|---|---|---|
| **multi** | Select every answer that applies | Exact set match; each wrong pick explained |
| **order** | Drag items into order (e.g. rollout events, pipeline stages) | Exact order, or partial-order rules |
| **match** | Connect pairs (e.g. Service type ↔ use case) | Every pair correct |
| **command** | Type a CLI command (`kubectl`, `az`, `helm`) | Parsed against a small CLI spec. Checks the verb, resource and required flags; ignores flag order and accepts short/long flag aliases |
| **write** | Edit a small file in the in-browser editor | YAML rule grader (below); each failing rule shows a hint |
| **diagnose** | Read real tool output (`describe`, events, logs, pipeline log) and pick the cause and the fix | mcq-style, using realistic output |

## Practice pages (one set per chapter)

| Page | Format | Exists in preview |
|---|---|---|
| **Checkpoint quiz** | 8–12 mixed questions drawn from a pool about 2× that size, in focus mode, with explanations and XP | `quiz.html` (fixed set today) |
| **Predict** | A file plus a scenario. Learners predict the outcome, then reveal it with an animation | `predict.html` |
| **Write lab** | Three panes: task checklist, editor, grader results. Hint, reset and solution buttons | `lab-yaml.html` |
| **Walkthrough** | A scripted terminal that shows the real command sequence and output step by step. It's guided, not free-form | `lab-terminal.html` |
| **Chapter results** | Level (Completed / Passed / Mastered), score by exercise type, critical failures, plus weak areas linked back to lessons | `chapter-complete.html` (score only today) |

**Course-wide pages:** Review deck (home page), Final exam (focus mode, timed), Course complete.

## Evaluation without a cluster

The key idea: we don't run infrastructure. We run **small models of the rules** that infrastructure follows. Each grader is a pure JavaScript function that takes the learner's file(s) and returns pass/fail per rule, each with an explanation.

| Grader / model | Checks | First used in |
|---|---|---|
| **yaml-rules** (exists) | YAML parses; required keys; values; structure | Ch 7 |
| **manifest-lint** | Kubernetes schema subset per kind and apiVersion; required fields; images pinned (not `:latest`); resources set; probes present; securityContext | Ch 2 |
| **cross-ref** | Service selector ↔ Pod labels; container port ↔ Service targetPort; Ingress/HTTPRoute backend ↔ Service name and port; ConfigMap and Secret references exist | Ch 2 |
| **selector-matcher** (widget) | Visual: which Pods a selector picks | Ch 2 |
| **yaml-tree** (widget) | Live YAML → structure view with inline parse errors | Ch 0 |
| **cidr-calc** (widget) | Address counts (Azure reserves 5 per subnet), overlap detection, subnet carving | Ch 0, 5 |
| **placement** | Per-section scoring of the Chapter 0 quiz → recommended refreshers and test-out offer | Ch 0 |
| **scheduler-sim** | Places Pods on nodes using requests, taints/tolerations, nodeSelector and affinity, and explains a Pending Pod | Ch 3 |
| **rollout-sim** | Steps a Deployment rollout using maxSurge, maxUnavailable and readiness | Ch 2, 11 |
| **hpa-sim** | Desired replicas from metrics using the HPA formula | Ch 3 |
| **cli-spec** | Parses `az`, `kubectl` and `helm` commands against a whitelist of verbs and flags | Ch 1 |
| **pipeline-rules** (exists) | `azure-pipelines.yml` structure and best-practice rules; stage graph | Ch 7 |
| **stage-sim** (exists) | Conditions, dependsOn and approvals → stage outcomes | Ch 7 |
| **netpol-eval** | Evaluates NetworkPolicies against a pod/namespace graph and returns a connectivity matrix (ingress and egress, AND/OR selector semantics, DNS) | Ch 9 |
| **rbac-eval** | Answers "can-i" for a subject from Roles and Bindings | Ch 15 |
| **kustomize-lite** | Renders base + overlay (patches, images, namePrefix, labels) to compare against an expected output | Ch 10 |
| **helm-lite** | Renders a tiny Helm template subset (`.Values`, `if`, `range`, `default`, `quote`) | Ch 10 |
| **policy-rules** | Pod Security "restricted" checks, plus a few Gatekeeper/Kyverno-style rules | Ch 15, 16 |
| **iac-rules** | One requirement rule set (OIDC issuer + workload identity on, Azure RBAC on, local accounts off, overlay networking, zones, AcrPull to kubelet identity, no secrets in defaults) with two front ends: an HCL parser for Terraform (plus backend, provider pinning, `moved`/`import` checks) and a Bicep parser (plus deterministic `guid()` names, `@secure()` params, `targetScope`) | Ch 12, 13 |

**Grading rules**
- **Every failure names the rule and how to fix it.** Never just "wrong".
- **Rules check intent, not exact text.** Key order, quoting style and comments never matter.
- **The solution is always available after one attempt.** Viewing it caps that lab's score (see Assessment).
- **Each lab marks 1–3 rules as critical** (⛔ in the results pane). See Assessment.

## Assessment

### Principles
- **Nobody fails a lesson.** Lesson checks gate Continue until they're solved, but there's no failure state.
- **Passing a chapter needs evidence.** Labs carry the most weight, because writing the files is the skill the course promises.
- **Unlocking is soft.** Finishing the lessons unlocks the next chapter, and scores can be improved later.
- **Results are honest about what they are.** While progress lives in the browser, a result is a self-reported *completion record*, not a credential.

### Lessons
- Continue stays locked until the step's check is solved (as today).
- Each check records **first-try correct / not**. This feeds the chapter score and the review deck.
- **XP:**
  - a first-try check is worth 10 XP, a later try 5 XP
  - quiz questions are worth 10 XP each
  - lab XP equals the lab score (0–100)

### Chapter levels

| Level | Requirements | Effect |
|---|---|---|
| **Completed** | Every lesson finished (or tested out via Chapter 0) | Unlocks the next chapter |
| **Passed** | Chapter score ≥ 70% **and** checkpoint quiz ≥ 80% **and** no critical rule failing in any lab | Counts toward course completion |
| **Mastered** | Chapter score ≥ 90% **and** every lab solved without viewing its solution | Badge |

### Chapter score

| Part | Weight | Scoring |
|---|---|---|
| Labs | 40% | Average of labs; each is % of rules passed, best attempt. **Viewing the solution caps that lab at 60%** |
| Checkpoint quiz | 30% | % correct, best attempt |
| Predict set | 15% | % correct on the **first reveal** only |
| In-lesson checks | 15% | First-try accuracy across the chapter's lessons |

- If a chapter has no predict set or no lab (Chapter 0 has neither), the remaining weights scale up to 100%.
- **Chapter 0 is not scored.** The placement quiz only routes learners.
- **Tested-out chapters** (via Chapter 0): the in-lesson checks part counts as 100%. The quiz, predict set and labs are scored as usual.
- **Chapter 17 (capstone):**
  - The project counts as its lab (100% of the chapter score).
  - Its four guided lessons only gate access to the project.
  - It passes at **80%** with no critical failures.

### Retakes
- **Quizzes:**
  - Unlimited retakes.
  - Each attempt draws from a **question pool about 2× the quiz length**. Pool questions are tagged by lesson, so every lesson stays covered.
  - Best attempt counts.
- **Labs:** retry freely; best attempt counts. The solution cap applies to every attempt after the solution is viewed. Pressing "Reset" doesn't lift it.
- **Predict sets:** only the first reveal counts; after that they're practice.

### Critical rules
- **What makes a rule critical:** it describes something that would be a security incident or an outage in production.
- **Its effect:** failing it blocks *Passed* whatever the percentage.
- **How it's marked:** the lab results pane marks critical rules with ⛔ and explains why it's critical.
- **Where they're listed:** each chapter file lists its labs' critical rules under Practice.
- **Examples:**
  - a plaintext secret in any file
  - a privileged container
  - a cluster-admin pipeline identity
  - a public endpoint where a private one was required
  - Terraform applied without a saved plan
  - production deploy without an approval

### End of course
- **Capstone:** the practical exam (Chapter 17).
- **Final exam:**
  - About 40 questions drawn from every chapter's pool, weighted toward Chapters 5–16.
  - A 60-minute timer; question order and options shuffled.
  - Pass at 80%; unlimited retakes with a fresh draw.
  - Unlocks when every chapter 1–16 is Completed.
- **Course complete** = Chapters 1–16 Passed + capstone passed + final exam passed. The completion page shows the per-chapter level and a skills summary, and says plainly that it's a completion record.

### Review deck
- **What goes in:** every check, quiz or predict question answered wrong.
- **When it comes back:** it's due again after **1, 3 and 7 days**. A correct answer moves it to the next interval; a wrong one resets it to 1 day. After the 7-day step, it leaves the deck.
- **Where learners see it:** the home page shows "N cards due" with a short focus-mode session using the existing mcq/fill/tapline renderers.
- **Scoring:** reviews earn XP but **don't change chapter scores**.

### Later, with a backend
- Accounts and synced progress.
- Server-side lab grading (the same rules, run in Rust).
- A proctor-light final exam: server-held question pool, one attempt per 24 h.
- Verifiable certificates with a shareable link.

## Persona tabs ("Coming from")

Short comparisons from tools the learner already knows. **The tab set is chosen per step, by topic**, not per chapter. A pipeline step inside the Terraform chapter therefore shows CI tool comparisons.

### The three sets

| Set | Tabs | Used on steps about |
|---|---|---|
| **A · Background** | Windows/IIS admin · Linux admin · Developer (Docker Compose) · Other clouds (EKS/GKE) | Kubernetes objects, AKS, networking, identity, security, observability |
| **B · CI/CD tool** | GitHub Actions · GitLab CI · Jenkins · Classic pipelines | Anything in `azure-pipelines.yml`: triggers, agents, stages, service connections, variables, templates, deployment jobs |
| **C · Infra tooling** | Portal/ARM · az CLI scripts · CloudFormation · Pulumi | Infrastructure as code (Chapter 12). In Chapter 13, a fixed **"Coming from Terraform"** tab comes first and is open by default, followed by set C |

Set A tab notes:
- *Other clouds* covers EKS and GKE in one tab. Name both when they differ (e.g. IRSA / EKS Pod Identity vs GKE Workload Identity Federation).
- Developer (Docker Compose) is the default for learners who skip the question.

### Choosing and remembering
- **Choosing:** Chapter 0's placement results end with two questions: "What's your background?" (set A) and "Which CI tool have you used most?" (set B). Set C has no question; it defaults to *Portal/ARM* until the learner clicks another tab.
- **Remembering:** each set remembers its own choice (`persona.A`, `persona.B`, `persona.C`). Clicking a different tab on any step updates that set.
- **Hiding:** a **"None"** option hides the tabs (per set). They can be shown again from the step's ⋯ menu.
- **Showing the other tabs:** the chosen tab opens by default, and the others stay one click away.

### Writing rules
- **Only on concept steps where a real analogy exists.** Aim for about 30% of steps. Never use tabs on check steps (they'd leak answers) or summaries.
- **1–2 sentences per tab.** Pattern: "*X* is like *Y* you know" + the one difference that matters.
- **No analogy for one background?** Write a one-line honest note (e.g. "No direct equivalent in IIS: this is new.") rather than forcing one.
- **Flag false friends.** When the obvious analogy would mislead, the tab starts with **"Careful:"**. Examples:
  - IIS bindings ≠ Kubernetes Services.
  - GitHub `on: pull_request` ≠ the `pr:` trigger on Azure Repos (branch policies do that job).
  - CloudFormation stacks ≠ Bicep deployments (incremental mode doesn't delete).
- **Each chapter header lists the sets it uses**, mainly first.

### Authoring estimate
About 300 steps carry tabs × 4 tabs ≈ 1,200 snippets, about 15% of the writing effort. Chapter 7's existing tabs already follow set B.

## "Try it locally" boxes

An optional, collapsible box at the end of a lesson. The learner runs the lesson's idea on a **free local `kind` cluster**, seeing real output and real errors. This is the main way the course makes up for having no simulated environment.

### Scope
- **Local only, for now.** Boxes use `kind` + the course's local lab (set up in lesson 0.6). They need no Azure account and work offline after setup.
- **"Try it on Azure" boxes come later.** They'll need a cost estimate and a mandatory cleanup command, and they're optional for learners with their own subscription.
- **Each chapter file has a "Try it locally" section** listing which lessons get a box and what it does. Chapter 7 has none, since Azure DevOps has no local equivalent.

### The local lab (lesson 0.6)
- **Tools:** Docker Desktop or Podman, `kind`, `kubectl`, `helm` (plus `terraform`, `az bicep`, `trivy`, `cosign`, `kyverno` CLI, installed when a chapter first needs them). Versions are pinned in one `lab/versions.env`.
- **`lab/kind-config.yaml`:**
  - 1 control-plane node, plus 3 workers labelled `topology.kubernetes.io/zone=zone-1/2/3`
  - 1 extra worker labelled and tainted `gpu=true:NoSchedule`
  - So Chapter 3's topology spread and taints behave as they would on a zonal AKS cluster.
- **`lab/lab-up.sh` / `lab-down.sh`:**
  - Create and delete the cluster.
  - Run a local registry (`localhost:5001`) that stands in for ACR.
  - Install metrics-server.
- **Add-ons installed per chapter by `lab/addons/<name>.sh`:**
  - a Gateway API controller (Chapter 8)
  - network-policy enforcement (Chapter 9)
  - Kyverno (Chapters 15–16)

### Rules for every box
- **Never graded, never required.** An "I tried it" tick gives 5 XP and doesn't touch chapter scores.
- **At most 5 commands**, each followed by trimmed expected output. Reuse the files the learner just wrote in the lesson.
- **Always end with cleanup** (delete the namespace, or `lab-down.sh` for cluster-level changes).
- **A "Tested with" line** shows the pinned versions.
- **Say when local differs from AKS** (e.g. "On AKS this would create an Azure Load Balancer; in kind the Service stays `<pending>` unless you install a load-balancer add-on").
- **Stored as a script.** Each box is a runnable `content/chNN/try/<lesson>.sh` with expected-output markers. The page displays it; CI executes it.

### Keeping boxes working
- A GitHub Actions job brings up the lab with `lab-up.sh` and runs every box script in order, checking the expected-output markers. It runs on every change to `content/` or `lab/`, and weekly, to catch upstream breakage.
- A failing box is hidden behind a "temporarily unavailable" note rather than shipped broken.

## Writing conventions

- **Content must be current.** Use current task versions and APIs: `KubernetesManifest@1`, `apps/v1`, `networking.k8s.io/v1`, `gateway.networking.k8s.io/v1`, workload identity (not pod identity).
- **Flag retiring features as retiring** rather than teaching them as current: kubenet, community ingress-nginx, AAD pod identity, service principals with secrets.
- **Accuracy notes.** Each chapter file lists the facts to re-verify against Microsoft and Kubernetes docs before publishing, because Azure changes fast.
- **Show real output.** CLI output shown to learners should be realistic: copied from a real run and trimmed, not invented.
- **Tone.** Second person, short sentences, no hype. Explain *why* before *how*.
