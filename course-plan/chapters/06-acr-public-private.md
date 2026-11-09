# Chapter 6 · ACR & deploying to AKS: public vs private clusters

**Part:** Azure Kubernetes Service · **Lessons:** 6 · **Time:** ~2 h · **Persona tabs:** A · Background · B · CI/CD tool (6.5 pipeline agents)

## By the end, learners can
- Create and secure an Azure Container Registry, push images, and let AKS pull them without secrets.
- Deploy to a public cluster safely: authorized IP ranges and Entra ID.
- Explain what makes a cluster private, and how DNS resolves its API server.
- Reach a private cluster: jump host, `az aks command invoke`, a self-hosted agent or Managed DevOps Pool, or API server VNet integration.
- Choose public, public + authorized IPs, or private for a given scenario.

## Lessons

### 6.1 ACR basics (~11 steps)
- **Teaches:**
  - Registry, repository, tag, digest; SKUs (Basic / Standard / Premium).
  - `az acr create`, `az acr login`, `docker push`.
  - `az acr build` (build in Azure).
  - Admin user off.
- **Checks:**
  - command: push to `contosoorders.azurecr.io/orders-api:1.4.2`.
  - mcq: why disable the admin user.
  - fill: the login server name.

### 6.2 Letting AKS pull (~9 steps)
- **Teaches:**
  - `--attach-acr` assigns AcrPull to the kubelet identity.
  - Why `imagePullSecrets` aren't needed.
  - Cross-tenant and cross-subscription notes.
- **Checks:**
  - diagnose: `ImagePullBackOff` + `401 Unauthorized` in events.
  - mcq: the fix.
- **Links back to:** Chapter 5.4.

### 6.3 ACR hardening (~9 steps)
- **Teaches:**
  - Private endpoints (Premium); disabling public access.
  - Repository-scoped tokens (short).
  - Retention/purge.
  - Geo-replication.
  - Content trust → Chapter 16.
- **Checks:**
  - match: requirement ↔ feature.
  - mcq: a private-endpoint ACR + a Microsoft-hosted build agent (the push fails; same lesson as private AKS).

### 6.4 Public clusters done right (~10 steps)
- **Teaches:**
  - The public API server endpoint is protected by Entra ID + RBAC.
  - Authorized IP ranges.
  - Why Microsoft-hosted agents are hard to allow-list.
- **Checks:**
  - command: `az aks update --api-server-authorized-ip-ranges`.
  - predict: deploying from a laptop outside the range.

### 6.5 Private clusters (~13 steps)
- **Teaches:**
  - The API server gets a private endpoint in your VNet.
  - The private DNS zone (`privatelink.<region>.azmk8s.io`).
  - Hub-spoke and custom DNS pitfalls.
  - Ways in: a jump box/Bastion; `az aks command invoke`; agents inside the VNet; API server VNet integration as an alternative.
- **Interactive:** a network diagram. Place the client (laptop, hosted agent, VNet agent, peered-VNet VM) and see whether DNS resolves and the connection succeeds.
- **Checks:**
  - custom: get the pipeline agent to a working position.
  - diagnose: `dial tcp: lookup …privatelink… no such host` (DNS zone not linked to the peered VNet).

### 6.6 Choosing & deploying (~10 steps)
- **Teaches:**
  - A decision tree: public / public + authorized IPs / private / API server VNet integration.
  - Deploying `orders-api` both ways: what changes in the deploy step.
- **Checks:**
  - mcq scenarios (bank, startup, internal tool).
  - multi: what's required for a pipeline to deploy to a private cluster.

## Practice
- **Quiz (10)**
- **Predict (3):**
  - pull without AcrPull
  - hosted agent → private cluster
  - DNS zone not linked
- **Write lab (script):** `deploy-private.sh` using `az aks command invoke` to apply manifests. Graded by **cli-spec**:
  - correct resource group and cluster name
  - `--command`
  - `--file`
- **Critical rules (⛔):** the cluster stays private (the script doesn't open a public endpoint or authorized IP range); no credentials hard-coded in the script.
- **Walkthrough:** ACR build → attach → deploy to the public cluster → switch to private and see the failure → fix with an in-VNet agent.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 6.1 Push to the local registry and run the image from it in the cluster.
- 6.2 Reproduce `ImagePullBackOff` with a wrong tag and an unknown registry, and read the events.
- Private clusters, authorized IPs and ACR auth are Azure-only.

## Misconceptions to target
- "Private cluster means the nodes have no internet." (That's an egress decision.)
- "Authorized IP ranges apply to private clusters."
- "Image pull secrets are the AKS way."

## Accuracy notes
- Verify against current docs:
  - ACR SKU feature matrix (private endpoints, retention)
  - ACR ABAC / repository permissions changes
  - API server VNet integration status
  - `command invoke` limits
  - the private DNS zone naming pattern
