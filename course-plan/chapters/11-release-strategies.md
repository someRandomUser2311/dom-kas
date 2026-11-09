# Chapter 11 · Release strategies: rolling, blue/green, canary

**Part:** DevOps · **Lessons:** 5 · **Time:** ~1.5 h · **Persona tabs:** A · Background (11.1–11.3, 11.5) · B · CI/CD tool (11.4)

## By the end, learners can
- Tune a rolling update (`maxSurge`, `maxUnavailable`, readiness, `minReadySeconds`), and predict its behaviour.
- Implement blue/green by switching a Service selector or route, and roll back instantly.
- Run a canary with traffic weights (Gateway API) or with the `KubernetesManifest@1` canary strategy, then promote or reject it.
- Decide when to use feature flags instead of deployment tricks.
- Automate the rollback decision with health signals and approvals.

## Lessons

### 11.1 Rolling updates in depth (~12 steps)
- **Teaches:**
  - `maxSurge` and `maxUnavailable` maths.
  - Readiness gates the rollout.
  - `progressDeadlineSeconds`.
  - Rollback with `rollout undo`.
- **Interactive:** **rollout-sim** with sliders for surge/unavailable/replicas, plus a "new version is broken" toggle.
- **Checks:**
  - custom: configure a zero-downtime rollout with 4 replicas and no extra capacity beyond +1.
  - predict: the pod counts at each step.

### 11.2 Blue/green (~10 steps)
- **Teaches:**
  - Two Deployments (`version: blue|green`).
  - The Service selector switch.
  - Database compatibility (expand/contract migrations).
  - Cost: double capacity.
- **Checks:**
  - tapline: the line that flips traffic.
  - mcq: rollback speed and its cost.

### 11.3 Canary (~13 steps)
- **Teaches:**
  - Weighted HTTPRoute `backendRefs` (90/10 → 50/50 → 100).
  - `KubernetesManifest@1` with `strategy: canary` and `percentage`, plus the promote/reject actions.
  - The Istio add-on alternative.
  - Replica-ratio canaries are coarse.
- **Interactive:** traffic weight slider + error-rate chart. Promote or abort.
- **Checks:**
  - custom: roll back a canary whose error rate spikes.
  - fill: the `percentage`.

### 11.4 Rollout in the pipeline (~12 steps)
- **Teaches:**
  - A deployment job with the `canary` strategy: `preDeploy` / `deploy` / `routeTraffic` / `postRouteTraffic` / `on: failure|success` hooks.
  - Environment checks (approvals, Azure Monitor alerts as a gate).
- **Interactive:** the stage simulator from Chapter 7, extended with the lifecycle hooks.
- **Checks:**
  - order: the lifecycle hooks.
  - tapline: the `on: failure` rollback.

### 11.5 Choosing a strategy (~8 steps)
- **Teaches:**
  - A decision matrix: risk, cost, speed and complexity.
  - Feature flags for business risk.
  - Database changes constrain every strategy.
- **Checks:**
  - mcq scenarios.
  - match: scenario ↔ strategy.

## Practice
- **Quiz (8)**
- **Predict (3):**
  - a rollout with a broken readiness probe
  - a blue/green switch with a mismatched label
  - a canary at 10% with 2 replicas
- **Write lab:** canary deployment job in `azure-pipelines.yml`. Graded by **pipeline-rules**:
  - `strategy: canary`
  - increments
  - a `routeTraffic` health check
  - `on: failure` reject
  - an environment with an approval
- **Critical rules (⛔):** a failure hook rejects the canary; prod needs an approved environment.
- **Walkthrough:** canary 10% → metrics → promote.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 11.1 Watch a rollout live with different `maxSurge` / `maxUnavailable`, and a broken readiness probe.
- 11.2 Blue/green: switch the Service selector and watch responses change.
- 11.3 Canary: weighted `backendRefs` on an HTTPRoute, with a `curl` loop counting v1 vs v2 responses.
- 11.4 is Azure Pipelines only.

## Misconceptions to target
- "Rolling updates are always zero-downtime." (Only with readiness probes and enough capacity.)
- "Canary = 1 pod out of N." (That's coarse; weights give precise control.)

## Accuracy notes
- Verify against current docs:
  - deployment job lifecycle hook names
  - `KubernetesManifest@1` canary inputs (`percentage`, `baselineAndCanaryReplicas`)
  - weighted `backendRefs` support on each AKS gateway option
