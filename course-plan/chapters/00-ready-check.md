# Chapter 0 · Ready check: placement & refreshers

**Part:** Getting started · **Lessons:** 6 + placement quiz · **Time:** ~1–1.5 h (optional) · **Persona tabs:** A · Background (0.1–0.4, 0.6) · B · CI/CD tool (0.5). Both are chosen at the end of the placement quiz

Chapter 0 is **optional**. It starts with a placement quiz. Depending on the score, the quiz either suggests refresher lessons or lets the learner test out of Chapters 1–3. Later chapters can then assume these basics without stopping to explain them.

## Target learner (the course baseline)
- **Assumed:**
  - comfortable on a command line (running commands, files, pipes, env vars)
  - basic Git (clone, commit, push, branch, pull request)
  - knows what an IP address and a port are
  - has seen the Azure portal
- **Not assumed:**
  - Kubernetes
  - Docker beyond "heard of it"
  - YAML
  - CIDR maths
  - how Azure subscriptions, Entra ID and RBAC fit together
  - any programming (the app code is always given)

## Placement quiz (~15 questions, ~8 min)
- **Sections, each scored separately:**
  - YAML (3)
  - shell (2)
  - networking (3)
  - Azure (3)
  - Git (1)
  - Kubernetes basics (3)
- **Results page:**
  - **Per section:** "✓ You're set" or "Take refresher 0.x" (each refresher links to its lesson).
  - **Kubernetes score ≥ 3/3:** offers the **test-out path**. The learner takes the checkpoint quizzes for Chapters 1–3 directly; passing one (≥ 80%) marks that chapter **Completed** and records the quiz score. To reach **Passed**, the learner still does that chapter's lab and predict set; lessons stay open for review, and skipped lesson checks count as first-try correct (see [formats.md → Assessment](../formats.md#assessment)).
- The quiz can be retaken; the latest result is stored.
- **Two last questions (not scored)** set the "Coming from" tabs:
  - **"What's your background?"** Windows/IIS admin · Linux admin · Developer (Docker Compose) · Other clouds (EKS/GKE) · None. This sets **A · Background**.
  - **"Which CI tool have you used most?"** GitHub Actions · GitLab CI · Jenkins · Classic Azure Pipelines · None. This sets **B · CI/CD tool**.
  - Learners who skip the placement quiz get Developer and GitHub Actions as defaults. Either can be changed on any step by clicking another tab (see [formats.md → Persona tabs](../formats.md#persona-tabs-coming-from)).

## Lessons

### 0.1 YAML in 10 minutes (~8 steps)
- **Teaches:**
  - Maps, lists, nesting by indentation (spaces, never tabs).
  - Lists of maps (the `- name:` pattern used everywhere).
  - Multi-line strings (`|` vs `>`); quoting (`"yes"`, `"1.20"`, `"on"`).
  - Comments.
  - Multiple documents with `---`.
- **Interactive:** a live YAML → tree view. Type YAML and see the structure, with errors flagged inline. Reuses `yaml.js` parse.
- **Checks:**
  - tapline: the mis-indented line.
  - mcq: what `version: 1.20` parses as (a number, `1.2`).
  - fill: the dash that makes a list item.
  - custom: fix a broken file until it parses.

### 0.2 Shell & scripting basics (~8 steps)
- **Teaches:**
  - Variables and quoting.
  - `$(command)` substitution.
  - Exit codes and `set -euo pipefail`.
  - `if` / `for`.
  - Reading JSON output with `--query` / `jq`.
  - Line continuation `\`.
  - (A short tab compares PowerShell equivalents.)
- **Checks:**
  - predict: a script without `set -e` keeps going after a failure.
  - fill: capture `az … --query id -o tsv` into a variable.
  - command.

### 0.3 Networking you'll need (~8 steps)
- **Teaches:**
  - CIDR notation and address counts (`/24` = 256, Azure reserves 5 per subnet).
  - Subnets inside a VNet; overlapping ranges.
  - DNS resolution (A and CNAME records, private zones in short).
  - HTTP vs HTTPS, TLS certificates.
  - Ports.
  - NAT / SNAT in one picture.
- **Interactive:** a **CIDR calculator** widget. Type a range and see the first/last address, usable count, and whether two ranges overlap. Reused in Chapter 5.1 IP planning.
- **Checks:**
  - mcq: how many usable IPs in an Azure `/27` (27).
  - custom: carve a `/16` into non-overlapping subnets for nodes, pods and services.
  - match: protocol ↔ port.

### 0.4 Azure fundamentals for DevOps (~8 steps)
- **Teaches:**
  - Tenant (Entra ID) → management groups → subscriptions → resource groups → resources.
  - Regions and availability zones.
  - Identities: users, groups, service principals, managed identities (system- vs user-assigned).
  - **RBAC = who + role + scope**, inherited downwards.
  - Owner / Contributor / Reader vs data-plane roles (e.g. AcrPull).
  - `az login`, `az account set`.
- **Interactive:** a scope tree. Assign a role at one level and see everything below it light up.
- **Checks:**
  - custom: give the pipeline identity Contributor on only one resource group.
  - mcq: Contributor can't grant roles. Why does that matter for pipelines?
  - match: identity type ↔ use case.

### 0.5 Git & pull requests for pipelines (~6 steps)
- **Teaches:**
  - Branches and PRs in Azure Repos and GitHub.
  - `main` as the protected branch.
  - Branch policies (required reviewers, build validation).
  - Why pipelines are triggered by branches and PRs.
  - Commit hygiene: never commit secrets, `.gitignore` (`.terraform/`, `*.tfstate`).
- **Checks:**
  - order: the feature branch → PR → validation → merge → CI flow.
  - multi: files that must never be committed.

### 0.6 Set up a local lab (optional, ~7 steps)
- **Teaches:**
  - Why a local cluster helps: real output and real errors, for free.
  - What `kind` is: Kubernetes nodes as containers.
  - What the course lab contains:
    - 3 zone-labelled workers + 1 tainted "gpu" worker
    - a local registry standing in for ACR
    - metrics-server
  - What it can't do: anything Azure-specific (AKS, ACR auth, Entra ID, Azure DevOps).
- **Steps:**
  1. Install Docker Desktop or Podman, `kind`, `kubectl` and `helm`, with per-OS tabs (macOS, Windows/WSL2, Linux) and pinned versions from `lab/versions.env`.
  2. Run `lab/lab-up.sh`.
  3. Run `kubectl get nodes -L topology.kubernetes.io/zone` to verify.
  4. Learn `lab-down.sh` and how to reset.
- **Checks:**
  - command: show the nodes with their zone label.
  - mcq: what the local registry stands in for (ACR).
  - "I'm set up" tick, which unlocks the "Try it locally" boxes' "I tried it" ticks.
- **Hardware note:** about 4 CPU / 8 GB RAM free. On smaller machines, use the single-node variant (`lab-up.sh --small`); Chapter 3's zone and taint boxes then say they need the full lab.

## Practice
- **Placement quiz** (above). There's no separate checkpoint quiz; each refresher ends with its own checks.

## Accuracy notes
- Current `kind` release and node image versions; Docker Desktop licensing note for large companies (Podman as the free alternative).
- Azure subnet reserved address count (5).
- Current names: Entra ID (not Azure AD), and the "Role Based Access Control Administrator" role.
