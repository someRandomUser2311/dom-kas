# Chapter 4 · AKS: what Azure manages vs what you control

**Part:** Azure Kubernetes Service · **Lessons:** 6 · **Time:** ~1.5 h · **Persona tabs:** A · Background

## By the end, learners can
- Draw the AKS shared-responsibility line: control plane, nodes and workloads.
- Explain node pools (system vs user), VM sizes, availability zones, and the node resource group.
- Plan Kubernetes version and node image upgrades: channels, maintenance windows, and surge.
- Choose a pricing tier (Free / Standard / Premium + LTS), and know when AKS Automatic fits.
- Write the `az aks create` command for a sensible baseline cluster.

## Lessons

### 4.1 Who manages what (~12 steps)
- **Teaches:**
  - **Azure manages:** API server, etcd, scheduler and controllers, with an SLA in the paid tiers.
  - **You own:** nodes (patching via upgrades), workloads, networking choices, identity, cost.
- **Interactive:** a **responsibility sorter**. Drag items into Azure / You / Shared:
  - etcd backups
  - node OS patches
  - API server scaling
  - pod security
  - Kubernetes upgrades
  - …
- **Checks:**
  - custom: sorter, all correct.
  - mcq: who restarts a crashed etcd (Azure).

### 4.2 Node pools (~11 steps)
- **Teaches:**
  - System vs user pools; VM Scale Sets underneath.
  - The `MC_` node resource group (don't touch it).
  - Taint system pools for critical add-ons only.
  - Zones; spot pools.
- **Checks:**
  - mcq: where to run `orders-api`.
  - tapline in an `az aks nodepool add` command.
  - diagnose: someone edited the VMSS in `MC_` directly.

### 4.3 Scaling nodes (~9 steps)
- **Teaches:**
  - Cluster autoscaler on a node pool (min/max).
  - Node auto-provisioning (Karpenter-based), and how it relates to HPA.
- **Interactive:** the **hpa-sim** extended. Pods go Pending → a node is added.
- **Checks:**
  - order: the chain from load → HPA → Pending → cluster autoscaler → new node.
  - mcq.

### 4.4 Upgrades & maintenance (~11 steps)
- **Teaches:**
  - Kubernetes version support window and LTS.
  - Control plane first, then node pools.
  - `max-surge`.
  - Auto-upgrade channels vs node OS upgrade channels.
  - Planned maintenance windows.
- **Checks:**
  - mcq: what upgrades the node OS security patches.
  - order: upgrade steps.
  - predict: an upgrade with PDB `maxUnavailable: 0` and 1 replica (the drain blocks).

### 4.5 Tiers, SKUs & AKS Automatic (~8 steps)
- **Teaches:**
  - Free vs Standard (SLA) vs Premium (LTS).
  - AKS Automatic: opinionated defaults, what you give up.
  - Cost drivers.
- **Checks:**
  - match: requirement ↔ tier.
  - mcq: production with an uptime SLA.

### 4.6 Creating a cluster (~12 steps)
- **Teaches:** build up `az aks create` flag by flag:
  - `--tier`, `--node-count`, `--zones`
  - `--network-plugin azure --network-plugin-mode overlay`
  - `--enable-oidc-issuer --enable-workload-identity`
  - `--enable-aad --enable-azure-rbac --disable-local-accounts`
  - `--auto-upgrade-channel`
- **Checks:**
  - command: add the flag for workload identity.
  - fill.
  - tapline: the flag that turns off static kubeconfig admin access.

## Practice
- **Quiz (8)**
- **Predict (2):**
  - an upgrade blocked by a PDB
  - pods Pending with autoscaler at max
- **Write lab (script):** `create-cluster.sh`, graded by **cli-spec**. It must:
  - create the resource group
  - create the cluster with zones, overlay networking, OIDC + workload identity, Entra ID + Azure RBAC, local accounts disabled, Standard tier, and an auto-upgrade channel
  - add a separate user node pool
- **Critical rules (⛔):** local accounts disabled; Entra ID with Azure RBAC enabled.
- **Walkthrough:** create → get-credentials → nodes → upgrade.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 4.2 Mimic node pools with labels and taints on the kind workers ("system" vs "user").
- 4.4 `cordon` / `drain` a node to rehearse what an AKS node-image upgrade does to pods (with and without a PDB).
- All other lessons are Azure-only and stay as walkthroughs.

## Misconceptions to target
- "Managed means Azure patches my nodes automatically by default." (Depends on the channels you choose.)
- "I can SSH into the control plane."

## Accuracy notes
- Verify against current AKS docs:
  - the version support policy and LTS terms
  - auto-upgrade channel names
  - node OS upgrade channel names and defaults
  - AKS Automatic GA features
  - node auto-provisioning status
  - tier names and pricing
