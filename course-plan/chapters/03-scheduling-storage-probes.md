# Chapter 3 · Scheduling, storage, probes & autoscaling

**Part:** Kubernetes foundations · **Lessons:** 6 · **Time:** ~2 h · **Persona tabs:** A · Background

## By the end, learners can
- Set requests and limits, and predict the QoS class and OOM behaviour.
- Steer pods with nodeSelector, affinity, taints/tolerations and topology spread.
- Pick the right probe, and avoid the liveness-probe death spiral.
- Use PVCs and StorageClasses; know when a StatefulSet is needed.
- Configure an HPA, and explain what a PodDisruptionBudget protects.
- Know when to use a Job, CronJob or DaemonSet.

## Lessons

### 3.1 Requests, limits & QoS (~11 steps)
- **Teaches:**
  - The scheduler uses requests; the kubelet enforces limits.
  - CPU throttling vs memory OOMKill.
  - Guaranteed / Burstable / BestEffort.
- **Interactive:** a node-capacity bar. Add pods and watch "Insufficient cpu".
- **Checks:**
  - mcq: QoS class of a given spec.
  - diagnose: `OOMKilled` in `describe` output.

### 3.2 Steering pods: selectors, affinity, taints (~12 steps)
- **Teaches:**
  - nodeSelector, node affinity (required/preferred).
  - Pod anti-affinity.
  - Taints/tolerations: a toleration *allows*, it doesn't *attract*.
  - topologySpreadConstraints across zones.
- **Interactive:** the **scheduler-sim**. Nodes with labels and taints; drag a pod spec and see where it lands or why it stays Pending.
- **Checks:**
  - custom: get the GPU pod onto the tainted GPU node *and only there* (needs a toleration and node affinity).
  - diagnose: a `0/3 nodes are available` event.

### 3.3 Probes (~10 steps)
- **Teaches:**
  - startup, readiness and liveness probes, and what each one controls.
  - Never point liveness at a dependency.
- **Interactive:** a probe timeline widget. The app becomes slow: which probe fails, and what happens?
- **Checks:**
  - mcq: readiness failure → removed from endpoints, not restarted.
  - tapline: the dangerous liveness check.
  - fill: `initialDelaySeconds` vs a startupProbe.

### 3.4 Storage (~11 steps)
- **Teaches:**
  - Volumes vs PV/PVC; StorageClass and dynamic provisioning.
  - Access modes; reclaim policy.
  - StatefulSet + volumeClaimTemplates (short).
- **Preview of AKS:** Azure Disk (RWO, zonal) vs Azure Files (RWX).
- **Checks:**
  - match: access mode ↔ storage.
  - mcq: a 3-replica Deployment sharing one RWO disk (it fails on other nodes).
  - predict: delete a PVC with `Delete` policy.

### 3.5 Autoscaling & disruption (~11 steps)
- **Teaches:**
  - HPA formula and metrics-server.
  - Requests are required for CPU %.
  - Cluster autoscaler (concept; AKS details in Chapter 4).
  - PodDisruptionBudget during node drains.
- **Interactive:** the **hpa-sim** with a load slider → desired replicas.
- **Checks:**
  - fill: HPA `averageUtilization`.
  - mcq: HPA does nothing (no requests set).
  - predict: a node drain with PDB `minAvailable: 2` and 2 replicas.

### 3.6 Jobs, CronJobs & DaemonSets (~8 steps)
- **Teaches:**
  - Run-to-completion work, `backoffLimit`, `concurrencyPolicy`.
  - DaemonSet for per-node agents.
- **Checks:**
  - match workload ↔ controller (Deployment, StatefulSet, DaemonSet, Job, CronJob).
  - tapline: the schedule line.

## Practice
- **Quiz (10)**
- **Predict (3):**
  - Pending pod
  - liveness spiral
  - drain with PDB
- **Write lab:** harden the `orders-api` Deployment. Rules:
  - requests and limits set
  - readiness and liveness probes, liveness not hitting `/db`
  - topology spread across zones
  - HPA min 2 / max 10
  - PDB present
- **Critical rules (⛔):** the liveness probe doesn't depend on the database; a memory limit is set.
- **Walkthrough:** scale up under load, then drain a node.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 3.1 A tiny memory limit → `OOMKilled` in `describe`.
- 3.2 A GPU pod stays Pending without a toleration, then lands on the tainted node; topology spread across the 3 fake zones (needs the full lab).
- 3.3 A liveness probe that fails → watch the restart count climb.
- 3.4 A PVC using kind's `standard` (local-path) StorageClass. The box notes how Azure Disk differs (zonal, RWO).
- 3.5 HPA with a load-generator pod; `kubectl drain` a node with a PDB.
- 3.6 A CronJob running every minute.

## Misconceptions to target
- "Limits reserve capacity."
- "A toleration puts my pod on that node."
- "Liveness = health check of everything."

## Accuracy notes
- In-place pod resize: check its current status (beta/GA by version) before mentioning it.
- HPA `autoscaling/v2` only.
