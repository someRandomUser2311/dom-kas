# Chapter 15 · Cluster & pipeline security

**Part:** Operate & secure · **Lessons:** 7 · **Time:** ~2.5 h · **Persona tabs:** A · Background · B · CI/CD tool (15.2, 15.6)

## By the end, learners can
- Write least-privilege Kubernetes RBAC (Role, ClusterRole, bindings), and combine it with Entra ID groups.
- Scope the pipeline's identity to only what it deploys.
- Enforce Pod Security Standards ("restricted") and write a hardened `securityContext`.
- Deliver secrets from Key Vault with the Secrets Store CSI driver + workload identity.
- Harden the cluster:
  - private API server or authorized IPs
  - local accounts off
  - KMS encryption
  - Defender for Containers
  - upgrades
- Secure Azure DevOps:
  - protected resources and checks
  - branch control
  - `extends` templates
  - limiting service-connection scope

## Lessons

### 15.1 Kubernetes RBAC (~13 steps)
- **Teaches:**
  - Verbs, resources, apiGroups.
  - Role vs ClusterRole.
  - RoleBinding vs ClusterRoleBinding (a ClusterRole bound by a RoleBinding is namespace-scoped).
  - ServiceAccounts as subjects.
  - `kubectl auth can-i`.
- **Interactive:** **rbac-eval**. Pick a subject and an action and see allow/deny, with the rule that granted it.
- **Checks:**
  - custom: give the `deployer` SA rights to manage Deployments only in `orders`.
  - tapline: the wildcard that over-grants.
  - command: `auth can-i … --as`.

### 15.2 Who can do what: humans and pipelines (~10 steps)
- **Teaches:**
  - Entra groups → Azure RBAC roles or Kubernetes RBAC bindings.
  - Break-glass access.
  - The pipeline identity scoped to its namespaces, not cluster-admin.
  - Kubernetes service connections vs ARM.
- **Checks:**
  - mcq: the safest pipeline identity setup.
  - multi: over-privileged setups.

### 15.3 Pod security (~12 steps)
- **Teaches:**
  - Pod Security Standards (privileged/baseline/restricted) via namespace labels (enforce/audit/warn).
  - The `securityContext` fields:
    - `runAsNonRoot`
    - `allowPrivilegeEscalation: false`
    - `readOnlyRootFilesystem`
    - `capabilities.drop: [ALL]`
    - `seccompProfile: RuntimeDefault`
- **Interactive:** a **policy-rules** live checker as the learner edits the pod spec.
- **Checks:**
  - custom: make the pod pass "restricted".
  - fill: the namespace label.

### 15.4 Secrets from Key Vault (~12 steps)
- **Teaches:**
  - Why Kubernetes Secrets aren't enough on their own.
  - The Secrets Store CSI driver (AKS add-on) + `SecretProviderClass` + workload identity.
  - Mounted files vs synced Kubernetes Secrets.
  - Rotation.
  - App Configuration / direct SDK access as alternatives.
- **Checks:**
  - fill: `SecretProviderClass` fields.
  - diagnose: a mount failing with a 403 (missing Key Vault role).
  - tapline.

### 15.5 Hardening the cluster (~10 steps)
- **Teaches:**
  - A checklist with *why* for each item:
    - API server access
    - local accounts off
    - KMS etcd encryption
    - node OS auto-patching
    - Defender for Containers
    - Azure Policy add-on
    - image cleaner
    - avoiding host networking and privileged pods
- **Checks:**
  - multi: pick the gaps in a cluster config.
  - match: threat ↔ control.

### 15.6 Securing Azure DevOps (~12 steps)
- **Teaches:**
  - Protected resources: service connections, environments, agent pools, variable groups.
  - Checks: approvals, branch control, required template, business hours.
  - Limit job authorization scope; protect access to repositories.
  - Fork PR builds.
  - Pipeline permissions per resource.
- **Interactive:** the stage simulator with checks. A feature-branch run tries to use the prod service connection.
- **Checks:**
  - custom: configure checks so only `main` via the approved template can deploy to prod.
  - mcq.

### 15.7 Threat-model recap (~8 steps)
- **Teaches:** walk the path from a malicious PR to the prod cluster, and the control that stops each hop.
- **Checks:**
  - order: attack hops.
  - match: hop ↔ control.

## Practice
- **Quiz (10)**
- **Predict (3):**
  - a ClusterRole bound by a RoleBinding
  - PSA in `warn` mode
  - a feature branch hitting a protected service connection
- **Write lab A:** RBAC for the deploy SA. Graded by **rbac-eval** against required allow/deny cases.
- **Write lab B:** a hardened Deployment + `SecretProviderClass`. Graded by **policy-rules** (restricted) + **cross-ref** (SA has the workload identity annotation, volume references the provider class).
- **Critical rules (⛔):** lab A: no wildcard verbs/resources and no ClusterRoleBinding for the deploy service account. Lab B: no privileged container and the pod runs as non-root; no secret values in manifests.
- **Walkthrough:** can-i audit → tighten → verify.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 15.1 Roles and bindings for a service account; check them with `kubectl auth can-i … --as=system:serviceaccount:orders:deployer`.
- 15.3 Label a namespace `pod-security.kubernetes.io/enforce=restricted` and try to create a privileged pod.
- 15.4 (Key Vault CSI), 15.5 (cluster hardening) and 15.6 (Azure DevOps) are Azure-only.

## Misconceptions to target
- "cluster-admin for the pipeline is fine because the pipeline is trusted."
- "PSA warn = protected."
- "Key Vault means no Kubernetes Secret ever exists." (Sync creates one.)

## Accuracy notes
- Verify against current docs:
  - PSA label names (stable)
  - Azure Policy for AKS built-in initiative names
  - Secrets Store CSI add-on name and flags
  - KMS v2 on AKS
  - Azure DevOps check names and "protect access to repositories" settings
