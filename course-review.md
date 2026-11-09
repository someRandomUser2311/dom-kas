# Course review: a beginner's view

**Course:** Kubernetes → AKS → DevOps on Azure (18 chapters, 110 lessons)
**Reviewed:** `course-content/` (all chapter overviews; lessons 0.1, 0.6, 1.1, 1.3, 1.5, 2.4, 5.4, 5.5, 7.3 and 17.1 read in full; every lesson measured for steps, checks, widgets and tabs), the placement quiz, `course-plan/README.md`, and the parts of the backend and frontend that decide what a learner sees.
**Date:** 2026-11-09

---

## Verdict

The writing is very good. Lessons are short, concrete and accurate, they use one running example (Contoso Orders) consistently, and they explain *why* as well as *what*. Someone who already works in IT would learn a lot from it.

For a **true beginner**, though, the course as structured is too wide, too Azure-architecture-heavy too early, and too reliant on reading and multiple choice. A beginner would probably get through Chapters 1–3 well, start to struggle in Chapter 5, and drop out somewhere between Chapters 6 and 12. The main problems are in the course's structure and sequencing, not in individual lessons:

1. It promises hands-on practice it can't deliver yet. The local lab scripts don't exist.
2. Some prerequisites come after the chapters that use them (ServiceAccounts, Kubernetes RBAC, troubleshooting).
3. Chapters 4–6 teach production network and identity design before the learner has deployed anything.
4. Practice is mostly multiple choice, so learners recognise answers rather than produce them.
5. Interactivity drops off sharply after Chapter 3.
6. Chapter 7 still shows authoring notes to learners.

---

## What works (keep it)

- **One running example.** `orders-api` grows from a Dockerfile (Ch 1) to a signed canary release on a private cluster (Ch 17). Beginners always know *why* a new file exists.
- **Lesson micro-structure.** About 10 steps of about 1–2 minutes each, a check every 3–4 steps, and a "…, sorted" summary at the end. Lesson 1.1 (containers) and 1.3 (cluster) are model beginner lessons.
- **Explaining the trap, not just the rule.** Examples: `version: 1.20` turning into `1.2` (0.1), the cache-breaking `COPY . .` (1.1), "running pods survive a scheduler outage" (1.3), and "granting the role to the wrong identity" (5.4). Wrong options carry a `why`, which is excellent for beginners.
- **Diagnose checks built from real-looking output.** For example, the empty EndpointSlice in 2.4. They teach the thinking a beginner most lacks.
- **Honest scope statements.** For example, 0.6 says plainly what kind *can't* do.

---

## Critical issues

### 1. "Beginner" doesn't match who the course actually assumes

`course-plan/README.md` targets "an IT professional comfortable on a command line… new to Kubernetes and new to Azure for DevOps". That's a reasonable audience, but it isn't a beginner. The course also assumes:

- Git with pull requests;
- an understanding of IP addresses and ports;
- familiarity with the Azure portal;
- the ability to read Bash with `$(…)` and `set -euo pipefail` (0.2 and the placement quiz).

The size adds to this:

- **About 24 hours of lesson time alone** (adding up every lesson's `~N min`).
- **About 38 hours with practice**, by the chapter estimates.
- It covers Kubernetes, AKS, Azure networking, Entra ID, Azure Pipelines, Helm, Kustomize, Terraform, Bicep, observability, security and supply chain. Any one of these is a course on its own.

**Recommendation:** Either describe the course as "intermediate: for IT professionals moving into platform/DevOps work", or split it into tracks:

- **Core** (beginner): Ch 0–4, a slimmed-down 6, 7, 8, 10, 11, 14 and a reduced capstone.
- **Advanced** (platform engineer): Ch 5 in full, private clusters, Ch 9, 12 *or* 13, 15 and 16.

Show the track on the course home page so beginners know which parts are optional.

### 2. The hands-on promise isn't backed by anything yet

- The plan's main answer to "no real cluster" is **~60 "Try it locally" boxes**, all depending on `lab/lab-up.sh`, `lab/install-tools.sh`, `lab/versions.env` and `lab/addons/`. **The `lab/` folder doesn't exist.** A beginner who follows 0.6 to the letter fails at its first command, and every later Try-it box fails the same way. The course plan lists this as "Before release", but nothing in the learner's view says it is missing.
- Even when it exists, it is optional and ungraded. A beginner who skips 0.6 never runs `kubectl` against a real cluster until… never. AKS itself is never touched for real: every `az` command in Ch 4–6 is read, not run.
- Practice is mostly recognition, not recall. Of 685 checks:

  | Check type | Count | Share |
  |---|---|---|
  | Multiple choice (`mcq`) | 406 | 59% |
  | Typed commands (`command`) | 15 | about 2% |

  The plan says command checks build "muscle memory", but 15 checks across 18 chapters can't. Chapter 1 has 3 of them, and most chapters have none.

**Recommendation:**

1. Ship `lab/` before any learner sees 0.6. Until then, hide the Try-it boxes or label them "coming soon".
2. Make the local lab the *expected* path for Ch 1–3, 8–11 and 14 (keep it optional, but recommend it).
3. Convert about a third of the `mcq` checks in Ch 1–3, 8 and 14 into `command`, `fill` or `write` checks.
4. Add an optional "Try it on Azure" track with a cost estimate and a teardown script for Ch 4–6. Beginners who never create a real AKS cluster will feel lost on the job.

### 3. Some prerequisites come after the chapters that use them

These are the places where a beginner meets a concept before it has been taught:

| Concept | First used | Actually taught | Problem |
|---|---|---|---|
| **ServiceAccount** | Ch 5.6 (workload identity), lab in Ch 5 practice | Never given its own explanation (appears only in Ch 5, 12, 15) | Workload identity is *built on* ServiceAccounts. It belongs in Ch 2. |
| **Kubernetes RBAC** (Role, RoleBinding) | Ch 5.5 contrasts Azure RBAC with "Role and RoleBinding objects" | Ch 15.1 | The learner is asked to choose between two systems when they know only one. |
| **Troubleshooting** (`describe`, events, `--previous`, `kubectl debug`) | `OOMKilled` in 1.5, `CrashLoopBackOff` from Ch 1, `ImagePullBackOff` in 5.4, `kubectl debug` promised in 1.5 | Ch 14 | Beginners hit failures from day one but get the method in the second-to-last chapter. |
| **Helm** | Installed in 0.6; ingress controllers in Ch 8 | Ch 10 | Small, but the learner meets the tool before its lesson. |
| **Key Vault secrets in pods** | Ch 5 walkthrough ("from identity to a Key Vault secret") | Ch 15.4 (Secrets Store CSI driver) | Taught twice, from two angles, ten chapters apart. |

There are also **many forward references** ("Chapter N covers this"). Lessons in Chapter 1 point ahead 21 times, and Chapter 2 does so 22 times. Each one is fine by itself. Together they tell a beginner "you don't understand this yet" on almost every page.

**Recommendation:**

- Add a ServiceAccount step to Ch 2, either in 2.1 or as a short 2.8.
- Move a short "Kubernetes RBAC in 10 minutes" lesson to Ch 2 or 3, and leave Ch 15 for least-privilege *design*.
- Move 14.1 (triage method) and 14.2–14.3 (pods that never start / start and die) to the end of Ch 3 as "Debugging your first app". Keep the Azure monitoring (14.5) and pipeline failures (14.6) in Ch 14.
- In Ch 1–2, cut forward references to only those the learner needs to act on.

### 4. Chapters 4–6 are an Azure architecture course placed in the middle of the beginner path

After three chapters of generic Kubernetes, the learner goes straight into:

- the CNI choice between Overlay, VNet-routed pod IPs and Cilium, and kubenet retirement (5.1);
- IP address planning (5.1);
- outbound types: load balancer, NAT gateway or user-defined routing through a firewall (5.3);
- three kinds of cluster identity (5.4);
- Entra ID with kubelogin and four Azure RBAC roles plus a Cluster User Role (5.5);
- federated workload identity (5.6);
- private clusters with private DNS zones, jump hosts, `command invoke`, Managed DevOps Pools and API server VNet integration (6.5).

Chapter 5 alone is about 2.5 hours. This is the content a platform architect needs. A beginner can't judge these choices yet, because they haven't yet felt the problems they solve. The lessons themselves are clear: 5.4 is one of the best-written in the course. The problem is *when* they come.

**Recommendation:** Split Part 2.

- **Beginner-facing** (before pipelines): 4.1, 4.2, 4.6, 6.1, 6.2, 6.4, and 5.4 in a simplified form ("which identity pulls the image").
- **Later "Production AKS" chapter** (after Ch 11): 5.1–5.3 networking depth, 5.5–5.6, 6.3 and 6.5. By then the learner has a working pipeline and the private-cluster trade-off ("how does my pipeline reach it?") means something to them.

### 5. Two full IaC chapters building the same platform

Ch 12 (Terraform, 8 lessons, about 3 hours) and Ch 13 (Bicep, 8 lessons, about 3 hours) build the same infrastructure. For a beginner this is about 6 hours spent learning two syntaxes for one idea, and only one of them will be used at work. The Ch 13 overview even says "you can follow this chapter on its own if you skipped Chapter 12". So the course already accepts that Ch 12 and 13 are alternatives, but the map and the completion rule ("Chapters 1–16 Passed") treat them as both required.

**Recommendation:** Make Ch 12 and Ch 13 a **choose one** pair in the map and in the completion rules. Keep the "Coming from Terraform" tabs for people who take both. The capstone already accepts either language.

### 6. Chapter 7 is visibly different, and authoring notes reach learners

Chapter 7 was converted from the preview and doesn't match the rest of the course:

- **Authoring notes are shown to learners.** The text below appears on learner pages:
  - The lesson kicker reads "built in app-preview (content/ch07/l3.js)".
  - The meta line reads "Converted from the built preview lesson. Interactive panels are kept as their rendered HTML…".
  - The chapter page has a "Changes still to make (from the plan)" section.
  - One check reads "Completed through the widget above (see the preview's onShow handler for the success condition)".
  - The practice page says "Questions 1–8 are the built quiz (app-preview/quiz.html)".

  `backend/src/content.rs` parses `header .kicker` and `header .meta`, and `frontend/src/pages/Lesson.svelte` renders both. The chapter's `<h2>` sections become practice content. So learners do see all of this.
- **Lesson density and planned overlap are uneven.**
  - Lesson 7.2 has 13 steps, 7 "Coming from" tab sets and 7 "Read more" drawers. That is far more than any other lesson, most of which have 1 and 0.
  - The planned de-duplication (shorten the ACR part of 7.4, link 7.3 to 6.5, move strategy depth to Ch 11) hasn't been done. Learners meet ACR and deploy strategies twice.

**Recommendation:**

- Remove the authoring notes from the content files, or mark them with a class the parser drops.
- Finish the three planned changes to 7.3–7.5.
- Bring 7.2 into line with the course format by splitting it into two lessons.

### 7. Interactivity disappears after Chapter 3

Lessons in Ch 0–3 and Ch 7 mostly have 1–3 widgets. Many later lessons have **no widget and only two checks across 10–13 steps**:

- 4.6, 6.5, 8.1, 8.5, 8.6, 9.4, 10.4, 11.2
- 12.2 and 12.6 (13 steps, 0 widgets each)
- 13.2, 15.4, 15.5, 16.2, 16.4

Lessons 5.7, 16.1 and 9.1 have a single check each.

For a beginner the hardest material (IaC, security, supply chain) arrives as the longest stretch of reading, at the point where motivation is lowest.

**Recommendation:**

- Set a minimum of 1 widget or hands-on check and 3 checks per lesson, and enforce it in a content lint.
- Prioritise Ch 12 (a plan/apply simulator already exists in `IacEditor.svelte`, so reuse it in 12.2 and 12.6) and Ch 15–16, where `RbacEval` and `PolicyRules` already exist.

---

## Important issues

### 8. The placement quiz can't support a test-out decision

The Kubernetes section has **3 questions**, and 3/3 offers to skip Ch 1–3, which is about 5.5 hours of foundations. A lucky guesser or someone with Docker experience would skip ServiceAccounts, probes and requests/limits, then fail in Ch 5. The rule also says that passing a chapter quiz marks it Completed, but Passed still needs the lab. That is a confusing two-level outcome to explain on day one.

**Recommendation:**

- Only offer test-out after the learner passes the *chapter* quizzes, which the plan already requires.
- Word the placement result as "you could try the Chapter 1–3 quizzes", not "you can skip".
- Raise the Kubernetes section to 6–8 questions.

### 9. "Coming from" persona tabs: no persona for an actual beginner

Set A offers Windows/IIS admin, Linux admin, Developer (Compose) and Other clouds. Almost every lesson has one. Someone new to IT (a student or career-changer) has no tab, and four analogies to tools they don't know are noise rather than help. The "Careful:" warnings about misleading analogies are good, but they only help people who already know the source tool.

**Recommendation:**

- Add a "New to all of this" persona whose tab gives a plain-language analogy (for example "a Service is like a reception desk that forwards calls").
- Collapse the tabs by default for that persona.

### 10. Chapters end on assessment, but the labs come after the lessons

Each chapter puts its write labs, predict sets and walkthroughs on a single practice page *after* all lessons. A beginner who reads 2.1–2.7 first writes a Deployment + Service + ConfigMap only at the end, after seven lessons of reading. Retention would be much better if each lab sat right after the lesson it practises.

**Recommendation:** Keep the practice page as a review hub, but attach each lab's first version to its lesson. For example, put a "write the Service" mini-lab at the end of 2.4.

### 11. The capstone jump is steep

The capstone asks the learner to assemble the *complete* repository:

- Dockerfile;
- base and overlays;
- policies;
- gateway;
- IaC;
- two pipelines;
- admission policies.

It is graded together, at ≥ 80% with no critical rule failing. Lessons 17.1–17.3 prepare well (the "spot the gaps" lesson is a strong idea), but a beginner has never handled more than one or two files in a lab at a time. There is no staged path between "one-file lab" and "fifteen-file project".

**Recommendation:**

- Ship a **starter repository** (downloadable) containing everything the learner wrote in earlier labs. The capstone then becomes *harden and integrate*, not *re-create*.
- Grade it in milestones (app → environments → security → release), each passable on its own.

### 12. Representative output in the troubleshooting chapter

The Ch 14 overview tells the learner that "the output in these pages is representative" and should be replaced with real captures before release. A troubleshooting chapter is exactly where a beginner needs to trust that the error text matches what they'll see at work. This is a release blocker, not a polish item. (The note itself is also authoring text shown to learners, as in issue 6.)

---

## Smaller observations from the lessons read

- **0.1 YAML.** Excellent. The step 3 "spot the broken indentation" check relies on counting spaces, which is hard on a phone. Consider highlighting the indentation guides in the code view.
- **1.1 Containers.** Introduces multi-stage builds, distroless, `CGO_ENABLED=0` and digests in the first real lesson. All are correct and useful, but a beginner gets a lot in 12 minutes. Consider moving digests (step 8) to Ch 16, where pinning by digest is taught properly, and leaving a one-line mention here.
- **1.3 Cluster.** 12 steps, including cloud-controller-manager, dockershim history and namespaces. The dockershim paragraph is history a beginner doesn't need; move it into a "Read more" drawer.
- **1.5 kubectl.** The `describe` example shows `OOMKilled` / exit code 137 before memory limits are taught (Ch 3). It's a good hook, but say explicitly "you'll learn to fix this in 3.1". The `exec` step correctly notes that distroless has no shell, then defers `kubectl debug` to Ch 14, leaving the beginner with no way to look inside their own app for 13 chapters (see issue 3).
- **2.4 Services.** Strong. Session affinity, `externalTrafficPolicy` and per-connection vs per-request balancing (step 11) are advanced material and could go into a "Read more" drawer.
- **5.5 Entra + Azure RBAC.** Four AKS RBAC roles, a Cluster User Role, kubelogin modes and namespace-scoped assignments in one lesson. Correct, but a beginner needs one diagram showing the two layers: Azure resource access vs in-cluster access.
- **Step counts vs the plan.** The plan says about 10–12 steps per lesson. Many lessons have 12–15 (12.4 and 13.3 have 15). At 1–2 minutes per step that's fine for experienced readers, but beginners will take about twice the estimated `~N min`. Consider estimating time for a beginner and showing it as a range.

---

## Suggested priority order

| # | Change | Effort | Beginner impact |
|---|---|---|---|
| 1 | Remove authoring notes from Ch 7 and Ch 14 learner pages | Low | High (trust) |
| 2 | Ship `lab/`, or hide Try-it boxes until it exists | Medium | High |
| 3 | Add ServiceAccount and basic Kubernetes RBAC to Ch 2–3 | Low | High |
| 4 | Move the triage method (14.1–14.3) to the end of Ch 3 | Medium | High |
| 5 | Make Ch 12 / Ch 13 "choose one" | Low | High (−3 h) |
| 6 | Split Ch 5–6 into a beginner core and a later "Production AKS" chapter | Medium | High |
| 7 | Add widgets and checks to the reading-heavy lessons in Ch 8–16 | High | Medium–High |
| 8 | Convert a share of MCQs to command/fill/write checks | Medium | Medium–High |
| 9 | Place mini-labs inside lessons; add a capstone starter repo and milestones | Medium | Medium |
| 10 | Tighten placement test-out; add a "New to all of this" persona | Low | Medium |
| 11 | Replace representative output in Ch 14 with real captures | Medium | Medium |
| 12 | Label the course level and add Core/Advanced tracks on the home page | Low | Medium |
