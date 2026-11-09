# Chapter 2 · Core objects: Pods, Deployments, Services, config

**Part:** Kubernetes foundations · **Lessons:** 7 · **Time:** ~2 h · **Persona tabs:** A · Background

## By the end, learners can
- Write a Pod, Deployment and Service manifest from memory.
- Use labels and selectors correctly, and debug a selector mismatch.
- Choose the right Service type.
- Explain how cluster DNS names are formed.
- Inject configuration with ConfigMaps and Secrets (env and volume), and explain why Secrets aren't encrypted by default.

## Lessons

### 2.1 Pods (~10 steps)
- **Teaches:**
  - The smallest deployable unit.
  - Shared network and volumes; sidecars and init containers.
  - Pods are disposable.
- **Code:** the YAML grows: `apiVersion` → `kind` → `metadata` → `spec.containers`.
- **Checks:**
  - fill: `apiVersion: v1`.
  - mcq: two containers in one pod talk over? (`localhost`).
  - tapline: the init container.

### 2.2 Labels & selectors (~10 steps)
- **Teaches:** labels are the glue between objects; equality-based and set-based selectors.
- **Interactive:** the **selector-matcher** widget. Edit a selector and watch which pods light up.
- **Checks:**
  - custom: make the selector pick only `app=orders, tier=api`.
  - mcq: what a typo in a label silently breaks.

### 2.3 ReplicaSets & Deployments (~12 steps)
- **Teaches:**
  - Deployment → ReplicaSet → Pods.
  - `replicas`, `selector` must match the template labels.
  - Rollout history, `rollout undo`.
- **Interactive:** the **rollout-sim** (basic). Change the image and watch the new ReplicaSet scale up while the old one scales down.
- **Checks:**
  - tapline: the field that must match `selector.matchLabels`.
  - command: `kubectl rollout undo deployment/orders-api`.
  - order: rollout events.

### 2.4 Services (~12 steps)
- **Teaches:**
  - ClusterIP, NodePort, LoadBalancer, headless.
  - `port` vs `targetPort`.
  - Endpoints / EndpointSlices.
- **Interactive:** a traffic widget that sends a request through a Service to the matching pods; a broken selector gives no endpoints.
- **Checks:**
  - match: type ↔ use case.
  - fill: `targetPort`.
  - diagnose: `kubectl get endpoints` is empty. Why?

### 2.5 DNS & service discovery (~8 steps)
- **Teaches:** `<svc>.<ns>.svc.cluster.local`; the short name works only within the same namespace.
- **Checks:**
  - mcq: the URL `web` (in namespace `web`) uses to reach `orders-api` in namespace `orders`.
  - fill a connection string.

### 2.6 ConfigMaps (~10 steps)
- **Teaches:**
  - `env`, `envFrom`, volume mounts.
  - Changes reach mounted files, but not env vars until a restart.
- **Checks:**
  - fill: `configMapKeyRef`.
  - predict: change a ConfigMap and ask whether the env var changes.
  - tapline.

### 2.7 Secrets (~10 steps)
- **Teaches:**
  - Secrets are base64-encoded, not encrypted.
  - RBAC on Secrets; encryption at rest.
  - Preview of Key Vault in Chapter 15.
- **Checks:**
  - mcq: "base64 is encryption?"
  - tapline: spot a secret value committed in a manifest.
  - fill: `secretKeyRef`.

## Practice
- **Quiz (10):** objects, selectors, Service types, DNS, config.
- **Predict (3):**
  - a selector typo
  - `targetPort` mismatch
  - a ConfigMap edit
- **Write lab:** `orders-api` Deployment + Service + ConfigMap. Graded by **manifest-lint** + **cross-ref**:
  - selector ↔ labels
  - `targetPort` ↔ `containerPort`
  - ConfigMap reference exists
  - image not `:latest`
  - 2+ replicas
- **Critical rules (⛔):** Service selector matches the Pod labels (otherwise no traffic reaches the app); no credentials in the ConfigMap.
- **Walkthrough:** apply, scale, roll out, roll back.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 2.1 A pod with an init container; watch `Init:0/1` → `Running`.
- 2.2 `kubectl get pods -l app=orders,tier=api` and set-based selectors.
- 2.3 Roll out a new image tag, then `kubectl rollout undo`.
- 2.4 Break the Service selector, and see an empty `kubectl get endpointslices`; then `port-forward` once fixed.
- 2.5 `kubectl run tmp --rm -it --image=busybox -- nslookup orders-api.orders`.
- 2.6 Edit a ConfigMap; compare the mounted file (updates) with the env var (doesn't).
- 2.7 `kubectl get secret … -o yaml`, then `base64 -d`: see why Secrets aren't encrypted.

## Misconceptions to target
- "Service type LoadBalancer is needed for pods to talk to each other."
- "Secrets are secure because they're Secrets."
- "Changing the selector of a Deployment is fine." (It's immutable in `apps/v1`.)

## Accuracy notes
- `kubectl get endpoints` is deprecated in favour of EndpointSlices since Kubernetes 1.33. Show `kubectl get endpointslices`, and mention both.
