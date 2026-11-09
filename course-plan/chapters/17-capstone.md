# Chapter 17 · Capstone: ship a production-grade app to AKS

**Part:** Capstone · **Lessons:** 4 guided + 1 project · **Time:** ~4–6 h · **Persona tabs:** A, B and C on the architecture-review steps only

## Goal
Learners assemble everything into one repository for Contoso Orders and pass a **production readiness review**. Everything is graded in the browser by the same graders used throughout the course, now run together.

## Guided lessons

### 17.1 The brief (~8 steps)
- **Teaches:** the requirements document:
  - private cluster
  - two environments
  - canary releases to prod
  - zero secrets in Git
  - default-deny networking
  - signed images only
  - SLO alerting
- **Checks:**
  - multi: which requirements map to which chapter.
  - match: requirement ↔ file in the repo.

### 17.2 Architecture review (~10 steps)
- **Teaches:** walk the target architecture:
  - hub-spoke VNet
  - private AKS + Managed DevOps Pool
  - ACR with a private endpoint
  - Key Vault
  - Gateway
  - monitoring
- **Interactive:** a clickable architecture diagram. Each component links back to the lesson that taught it.
- **Checks:** mcq "why" questions on 5 design choices.

### 17.3 Spot the gaps (~10 steps)
- **Teaches:** a "colleague's" first-draft repository with ~10 planted problems across the files.
- **Checks:**
  - tapline across multiple files.
  - multi.

### 17.4 How you'll be graded (~6 steps)
- **Teaches:** the rubric, the graders that run, and how partial credit works.

## The project (multi-file write lab)

A file-tree editor with tabs for every file. **Check all** runs every grader.

**Infrastructure language:** at the start, learners choose **Terraform** (`infra/terraform/`) or **Bicep** (`infra/bicep/`). Both are graded against the same requirement rules, so the score is identical either way. Submitting both earns a "Bilingual IaC" badge.

| File | Grader(s) | Key rules |
|---|---|---|
| `Dockerfile` | yaml-rules (text mode) | multi-stage, pinned digest, non-root |
| `k8s/base/*` | manifest-lint, cross-ref, policy-rules | probes, resources, restricted PSS, labels/selectors, HPA, PDB |
| `k8s/overlays/{dev,prod}` | kustomize-lite | prod replicas/limits, image set via `images:` |
| `k8s/policies/*` | netpol-eval | the required connectivity matrix |
| `k8s/gateway/*` | cross-ref | routes → services, TLS |
| `k8s/secrets/secretproviderclass.yaml` | cross-ref | workload identity SA, Key Vault name |
| `infra/terraform/*.tf` **or** `infra/bicep/*.bicep` + `*.bicepparam` | iac-rules (Terraform or Bicep) | private cluster, OIDC/WI, Azure RBAC, local accounts off, zones, AcrPull, federated credential; Terraform: remote backend + pinned provider; Bicep: deterministic `guid()` names + `@secure()` params |
| `infra-pipeline.yml` | pipeline-rules | PR checks; plan/what-if → approval → apply/deploy; Terraform applies the saved plan; WIF |
| `templates/*.yml` + `azure-pipelines.yml` | pipeline-rules, stage-sim | build → scan → sign → push; dev → prod with approval; canary; WIF connections; private-network pool; no inline secrets |

**Scoring:** each file is weighted, and the project is 100% of the chapter score. Learners pass at **80%** with **no critical rule failing**, using the critical rules from each chapter's labs (e.g. a secret in Git, a privileged pod, a cluster-admin pipeline, Terraform applied without a saved plan). Viewing the reference solution caps the project at 60%, the same as any lab. The results page shows a **readiness report** with each failed rule linked to its lesson.

## Final exam
- About 40 questions drawn from every chapter's question pool, weighted toward Chapters 5–16.
- Timed at 60 minutes, with question order and options shuffled.
- Pass at 80%. Unlimited retakes, each with a fresh draw.
- Unlocks when Chapters 1–16 are all Completed. It can be taken before or after the capstone.

## Completion
- **Course complete** = Chapters 1–16 **Passed** + capstone passed + final exam passed.
- The course-complete page shows each chapter's level (Completed / Passed / Mastered), the capstone readiness report and a skills summary.
- It states plainly that this is a **completion record**: results are stored in the browser and self-reported.
- (Later, with a backend) server-graded labs, a proctor-light exam and a verifiable certificate with a shareable link.

## Try it locally
- Optional: apply the capstone's `k8s/overlays/dev`, policies and gateway to the local lab, then run the provided smoke test (`lab/smoke.sh`).
- It checks:
  - rollout complete
  - the route answers
  - default-deny holds
  - the restricted Pod Security level is enforced
- This is never graded. Infra and pipeline files are graded in the browser only.

## Accuracy notes
- Re-validate the capstone's reference solution against every chapter's accuracy notes before release. It's the place where stale facts would surface together.
