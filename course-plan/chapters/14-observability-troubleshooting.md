# Chapter 14 · Observability & troubleshooting

**Part:** Operate & secure · **Lessons:** 6 · **Time:** ~2 h · **Persona tabs:** A · Background · B · CI/CD tool (14.6)
**New chapter.** Without a live cluster, reading real diagnostic output is the closest thing to hands-on debugging. This chapter is built almost entirely from **diagnose** steps.

## By the end, learners can
- Follow a systematic triage path: `get` → `describe` → events → logs → `exec` / debug.
- Recognise and fix the common failure states:
  - Pending
  - ImagePullBackOff
  - CrashLoopBackOff
  - OOMKilled
  - readiness failing
  - a Service with no endpoints
- Use AKS observability: Container Insights, Azure Monitor managed Prometheus, Managed Grafana, control-plane diagnostic logs.
- Write useful alerts, and read a failed pipeline deploy log.

## Lessons

### 14.1 A triage method (~10 steps)
- **Teaches:**
  - Work top-down: Deployment → ReplicaSet → Pod → container.
  - Events are short-lived.
  - `kubectl logs --previous`.
  - `kubectl debug` with ephemeral containers.
- **Checks:**
  - order: the triage steps.
  - command: logs of the previous crashed container.

### 14.2 Pods that never start (~12 steps)
- **Teaches:** read the real output for each case:
  - Pending: resources, taints, PVC binding.
  - ImagePullBackOff: wrong tag, no AcrPull, private endpoint/DNS.
  - CreateContainerConfigError: a missing ConfigMap or Secret key.
- **Checks:** 4 × diagnose. Each shows trimmed real `describe` output; the learner picks the cause, then the fix.

### 14.3 Pods that start and die (~11 steps)
- **Teaches:**
  - CrashLoopBackOff: app error, bad command, missing env.
  - OOMKilled (exit code 137).
  - The liveness death spiral (back to Chapter 3).
  - Exit codes.
- **Checks:**
  - 3 × diagnose.
  - match: exit code ↔ meaning.

### 14.4 Running but unreachable (~11 steps)
- **Teaches:**
  - Readiness failing → no endpoints.
  - Selector mismatch.
  - `targetPort` wrong.
  - NetworkPolicy blocking traffic.
  - Gateway route not attached (route `status` conditions).
- **Interactive:** a "follow the packet" widget: client → Gateway → Service → endpoints → pod, with the broken hop highlighted.
- **Checks:**
  - 3 × diagnose.
  - custom: find the broken hop.

### 14.5 Monitoring AKS (~11 steps)
- **Teaches:**
  - Container Insights (logs and inventory).
  - Managed Prometheus + Managed Grafana (metrics).
  - Control-plane logs via diagnostic settings (`kube-audit-admin`, etc.).
  - The four golden signals.
  - Alert rules (recommended alerts); avoiding alert fatigue.
- **Checks:**
  - match: question ↔ data source.
  - mcq: which log category answers "who deleted this deployment?".
  - fill: a simple KQL `where`.

### 14.6 When the pipeline deploy fails (~9 steps)
- **Teaches:**
  - Reading `KubernetesManifest` / `kubectl` output in pipeline logs:
    - a rollout status timeout
    - `forbidden` (RBAC)
    - an image not found
  - System diagnostics (`system.debug`).
- **Checks:** 3 × diagnose on pipeline log excerpts.

## Practice
- **Quiz (10)**
- **Predict:** "incident drills". 4 multi-step scenarios where each answer reveals the next piece of output, like an escape room.
- **Write lab:** fix a broken bundle (Deployment + Service + ConfigMap + NetworkPolicy) with 5 planted bugs. Graded by **manifest-lint** + **cross-ref** + **netpol-eval**.
- **Critical rules (⛔):** the fix doesn't replace the NetworkPolicy with allow-all; the Service ends with ready endpoints.
- **Walkthrough:** a full incident, from alert to fix to post-mortem notes.

## Content production note
- All `describe`/events/log output must be **captured from a real cluster** (a local kind cluster is fine for generic Kubernetes; AKS-specific messages from docs or a one-time sandbox), then trimmed. Keep the captures in `content/ch14/fixtures/`.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- Every lesson. `lab/break/ch14-<case>.sh` plants a real fault and the learner debugs it with the lesson's method. Faults:
  - wrong image tag
  - OOM
  - missing ConfigMap key
  - crash on start
  - selector mismatch
  - readiness failing
  - a blocking NetworkPolicy
  - an unattached HTTPRoute
- `lab/fix/` shows the answer.
- 14.5 is Azure Monitor and stays a walkthrough; the box instead shows `kubectl top` and `kubectl events`.

## Accuracy notes
- Verify against current docs:
  - Container Insights vs Azure Monitor naming changes
  - managed Prometheus enablement flags
  - control-plane log category names
  - `kubectl debug` behaviour by version
