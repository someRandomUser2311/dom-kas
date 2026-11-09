# Chapter 9 · Network policies: default-deny & zero trust

**Part:** DevOps · **Lessons:** 5 · **Time:** ~1.5 h · **Persona tabs:** A · Background

## By the end, learners can
- Explain the default (everything can talk to everything), and what makes a pod "isolated" for ingress or egress.
- Write default-deny policies, plus precise allow rules using podSelector, namespaceSelector and ports.
- Avoid the classic traps:
  - AND vs OR selectors
  - forgetting DNS egress
  - policies being additive
- Choose a policy engine on AKS, and know when L7/FQDN policies (Cilium) are needed.

## Lessons

### 9.1 The flat network & isolation (~10 steps)
- **Teaches:**
  - By default all pods can reach all pods.
  - A pod selected by any policy with `Ingress` in `policyTypes` denies all ingress not explicitly allowed (same for Egress).
  - Policies only ever add allows.
- **Interactive:** the **netpol-eval** connectivity matrix (namespaces `web`, `orders`, `db`). Every arrow starts green.
- **Checks:**
  - mcq: add one policy that allows `web → orders`. Can `db → orders` still connect? (No: `orders` is now isolated for ingress.)

### 9.2 Default-deny (~10 steps)
- **Teaches:**
  - The empty `podSelector: {}` with `policyTypes: [Ingress, Egress]`.
  - Applied per namespace.
  - Then open what's needed.
- **Checks:**
  - fill: `podSelector: {}`.
  - custom: apply default-deny in `orders` and watch the matrix go red.
  - predict: what breaks first. (DNS!)

### 9.3 Allow rules & selector semantics (~13 steps)
- **Teaches:**
  - Ingress `from` with podSelector and namespaceSelector.
  - **One list item with both selectors = AND. Two items = OR.**
  - The `kubernetes.io/metadata.name` namespace label.
  - Ports.
  - ipBlock for external ranges.
- **Interactive:** the matrix updates live as the learner edits YAML.
- **Checks:**
  - tapline: the dash that turns AND into OR.
  - custom: allow only `web` pods in namespace `web` → `orders-api:8080`.
  - multi: which flows are open.

### 9.4 Egress & DNS (~10 steps)
- **Teaches:**
  - Default-deny egress also blocks DNS. Allow UDP/TCP 53 to `kube-dns` in `kube-system`.
  - Egress to Azure services (ipBlock limits).
  - Why FQDN rules need Cilium / Advanced Container Networking Services.
- **Checks:**
  - diagnose: `orders-api` logs show `lookup sqlserver… i/o timeout`.
  - fill the DNS rule.

### 9.5 Engines on AKS & zero-trust practice (~9 steps)
- **Teaches:**
  - Engines: Azure CNI powered by Cilium (recommended), Calico, and the status of Azure NPM.
  - The engine is chosen at cluster creation.
  - L7 and FQDN policies with Cilium.
  - A practice pattern: default-deny per namespace in the base kustomization, allow-lists alongside each app.
- **Checks:**
  - mcq: a policy has no effect at all. Why? (No policy engine is enabled.)
  - match: requirement ↔ capability.

## Practice
- **Quiz (8)**
- **Predict (4):** connectivity puzzles in the matrix:
  - AND vs OR
  - a missing namespace label
  - DNS
  - an additive policy
- **Write lab:** secure the Contoso namespaces. Graded by **netpol-eval** against a required matrix:
  - `web → orders-api:8080` allowed
  - `orders-api → db:5432` allowed
  - DNS works
  - everything else denied
  - The learner sees exactly which flows differ from the target.
- **Critical rules (⛔):** default-deny exists in every namespace; nothing outside `orders-api` can reach `db`.
- **Walkthrough:** default-deny breaks the app → open flows one by one.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- Every lesson: enforce policies in the lab. Then use `kubectl exec … -- curl` / `nslookup` to test:
  - that default-deny blocks traffic
  - that DNS breaks until it's allowed
  - the AND vs OR selector difference
  - that policies are additive
- Results should match the in-browser **netpol-eval** matrix.

## Misconceptions to target
- "NetworkPolicies are firewalls with deny rules." (They only allow, apart from the implicit deny.)
- "Namespace isolation is automatic."
- "A policy on the client is enough." (You must allow both ends when both sides are isolated.)

## Accuracy notes
- Local lab: whether kind's default CNI (kindnet) enforces NetworkPolicy in the pinned kind version, or whether `lab/addons/` must install Calico/Cilium.
- Verify current status of:
  - Azure Network Policy Manager (retirement/deprecation)
  - Cilium FQDN/L7 policy availability via Advanced Container Networking Services and its pricing
  - Admin Network Policy / cluster-wide policy support
