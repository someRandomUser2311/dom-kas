# Chapter 5 · AKS networking & identity

**Part:** Azure Kubernetes Service · **Lessons:** 7 · **Time:** ~2.5 h · **Persona tabs:** A · Background

## By the end, learners can
- Choose between Azure CNI Overlay, Azure CNI (VNet-routed pod IPs) and Azure CNI powered by Cilium, and explain why kubenet is going away.
- Plan IP address space for nodes, pods and services.
- Explain how a `LoadBalancer` Service becomes an Azure Load Balancer, and make it internal.
- Pick an outbound type (load balancer, NAT gateway, user-defined routing via a firewall).
- Distinguish the cluster identity, the kubelet identity and workload identities.
- Set up Entra ID authentication with Azure RBAC for Kubernetes authorization.
- Configure workload identity end to end.

## Lessons

### 5.1 How pods get IPs: CNI options (~12 steps)
- **Teaches:**
  - **Overlay:** pod CIDR separate from the VNet (recommended default).
  - **VNet-routed pod IPs:** pods are directly reachable, but use many VNet IPs.
  - **Cilium dataplane:** eBPF; network policy engine.
  - **kubenet:** retiring.
- **Interactive:** an IP-planning widget, built on the Chapter 0.3 CIDR calculator. Choose a plugin and node/pod counts, and see VNet IP consumption and exhaustion.
- **Checks:**
  - mcq: a `/24` subnet with 50 nodes × 30 pods in VNet mode (it runs out).
  - match: plugin ↔ trait.

### 5.2 Services meet Azure (~10 steps)
- **Teaches:**
  - A `LoadBalancer` Service creates an Azure LB rule and a public IP.
  - The internal LB annotation.
  - Static IPs.
  - `externalTrafficPolicy` (short).
- **Checks:**
  - fill: the `service.beta.kubernetes.io/azure-load-balancer-internal` annotation.
  - mcq: the cost of 10 public LoadBalancer Services vs one ingress/gateway (leads into Chapter 8).

### 5.3 Egress (~9 steps)
- **Teaches:**
  - Outbound types: `loadBalancer`, `managedNATGateway` / `userAssignedNATGateway`, `userDefinedRouting` through Azure Firewall.
  - SNAT port exhaustion.
  - Required outbound FQDNs.
- **Checks:**
  - mcq: security requires all egress through a firewall.
  - diagnose: intermittent outbound timeouts at scale (SNAT).

### 5.4 The identities in a cluster (~11 steps)
- **Teaches:**
  - **Cluster (control plane) identity:** manages Azure resources (LBs, disks).
  - **Kubelet identity:** pulls images from ACR.
  - **Workload identities:** your apps.
  - Managed identity vs service principal.
- **Interactive:** an identity map. Click an action (create LB, pull image, read Key Vault) and see which identity does it.
- **Checks:**
  - match: action ↔ identity.
  - mcq: who needs AcrPull (the kubelet identity).

### 5.5 Humans in: Entra ID + Azure RBAC (~11 steps)
- **Teaches:**
  - Entra ID integration; `kubelogin`.
  - Azure RBAC for Kubernetes authorization: built-in roles, namespace scope.
  - Disabling local accounts.
  - Kubernetes RBAC as the alternative (deep dive in Chapter 15).
- **Checks:**
  - mcq: which role lets a developer deploy to just one namespace.
  - command: `az role assignment create` scoped to a namespace.
  - tapline.

### 5.6 Workload identity (~13 steps)
- **Teaches:** the full chain:
  1. OIDC issuer
  2. user-assigned managed identity
  3. federated credential (issuer + `system:serviceaccount:ns:sa`)
  4. ServiceAccount annotation `azure.workload.identity/client-id`
  5. pod label `azure.workload.identity/use: "true"`
  6. the SDK uses `DefaultAzureCredential`
- **Interactive:** a token-flow widget, reusing the Chapter 7 service-connection widget with the same mental model.
- **Checks:**
  - custom: fix a broken chain (wrong namespace in the subject).
  - fill: the annotation.
  - tapline: the missing pod label.
- **Persona note:** "Coming from EKS: this is IRSA / EKS Pod Identity. From GKE: Workload Identity Federation."

### 5.7 Best practices recap (~8 steps)
- **Teaches:** the baseline checklist:
  - overlay networking
  - a sensible egress type
  - managed identities only
  - Entra ID + Azure RBAC
  - local accounts disabled
  - workload identity, with no secrets in pods
- **Checks:**
  - multi: select every baseline violation in a config.

## Practice
- **Quiz (10)**
- **Predict (3):**
  - IP exhaustion
  - an image pull without AcrPull
  - workload identity with the wrong service account
- **Write lab:** workload identity manifests. Graded:
  - the ServiceAccount has the client-id annotation
  - the Deployment uses that ServiceAccount and has the `use: "true"` label
  - the namespace and service account name match the federated credential subject given in the task
- **Critical rules (⛔):** no client secret or credentials anywhere in the manifests; the federated credential subject matches the namespace and service account.
- **Walkthrough:** `az identity create` → `federated-credential create` → deploy → the pod reads a Key Vault secret.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 5.2 A `type: LoadBalancer` Service stays `<pending>` in kind: this shows exactly what the Azure cloud provider adds on AKS.
- 5.6 `kubectl create token orders-api -n orders`, then decode the JWT: the `iss` and `sub` claims are what Entra ID checks against the federated credential.
- Everything else (CNI modes, egress, Entra ID) is Azure-only.

## Misconceptions to target
- "Pods need a client secret to call Azure."
- "The kubelet identity is the app's identity."
- "Overlay pods can't reach VNet resources." (They can; the traffic is SNATed to the node IP.)

## Accuracy notes
- Verify against current docs:
  - the kubenet retirement date
  - CNI defaults for new clusters
  - Azure Network Policy Manager status
  - the exact `--outbound-type` values
  - workload identity label/annotation names
  - Azure RBAC built-in role names
