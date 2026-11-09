# Chapter 8 · Namespaces, Ingress & the Gateway API

**Part:** DevOps · **Lessons:** 6 · **Time:** ~2 h · **Persona tabs:** A · Background · B · CI/CD tool (pipeline tie-in)

## By the end, learners can
- Design a namespace strategy (per team, app or environment), and apply a ResourceQuota and LimitRange.
- Explain Ingress vs an ingress controller, and write host- and path-based Ingress rules with TLS.
- Write Gateway API resources (GatewayClass, Gateway, HTTPRoute), and explain the role split between them.
- Choose an AKS option: the application routing add-on, Application Gateway for Containers, or a self-managed controller.
- Automate TLS certificates (cert-manager or Key Vault certificates).

## Lessons

### 8.1 Namespaces as boundaries (~11 steps)
- **Teaches:**
  - What namespaces isolate (names, RBAC, quotas, policies) and what they don't (nodes, network by default).
  - Naming strategy.
  - Namespaced vs cluster-scoped objects.
- **Checks:**
  - mcq: dev and prod in one cluster, separated only by namespace. What's still shared?
  - match: object ↔ scope.

### 8.2 Quotas & limit ranges (~9 steps)
- **Teaches:**
  - ResourceQuota (compute and object counts).
  - LimitRange defaults: once a compute quota exists, pods without requests are rejected.
- **Checks:**
  - diagnose: `exceeded quota` / `must specify requests` events.
  - fill.

### 8.3 Ingress (~12 steps)
- **Teaches:**
  - One entry point instead of many LoadBalancers.
  - `ingressClassName`, host rules, path types (Prefix vs Exact), TLS secret.
  - Annotations are controller-specific.
- **Interactive:** a request router widget. Type a URL and see which rule and Service it hits.
- **Checks:**
  - custom: route `/api` to `orders-api` and `/` to `web`.
  - tapline: the rule that shadows another.

### 8.4 The Gateway API (~13 steps)
- **Teaches:**
  - Roles: infrastructure provider (GatewayClass), cluster operator (Gateway), app developer (HTTPRoute).
  - `parentRefs`, `hostnames`, `matches`, `backendRefs` with weights.
  - `allowedRoutes`.
  - ReferenceGrant for cross-namespace backends.
- **Interactive:** the same router widget, driven by HTTPRoutes. A weights slider previews Chapter 11 canaries.
- **Checks:**
  - fill: `parentRefs`.
  - mcq: why a route in namespace `orders` isn't attached (`allowedRoutes`).
  - match: Ingress concept ↔ Gateway API concept.

### 8.5 Ingress options on AKS (~10 steps)
- **Teaches:**
  - Application routing add-on (managed NGINX) and its Gateway API direction.
  - Application Gateway for Containers.
  - Istio-based service mesh add-on ingress.
  - Self-managed controllers.
  - The community ingress-nginx retirement, and what it means for existing clusters.
- **Checks:**
  - mcq scenarios.
  - multi: requirements met by each option.

### 8.6 TLS (~10 steps)
- **Teaches:**
  - TLS termination points.
  - cert-manager + ACME; Key Vault certificates with the app routing add-on.
  - HTTPS redirect.
  - Never commit TLS keys.
- **Checks:**
  - tapline: the TLS block.
  - diagnose: the browser shows "Kubernetes Ingress Controller Fake Certificate".

## Pipeline tie-in
- The deploy stage applies `k8s/gateway/` to the right namespace per environment.

## Practice
- **Quiz (10)**
- **Predict (3):**
  - overlapping paths
  - missing `ingressClassName`
  - an HTTPRoute not allowed by the Gateway
- **Write lab:** Gateway + HTTPRoute for `orders-api` and `web`, with TLS. Graded by **manifest-lint** + **cross-ref**:
  - backend Services and ports exist
  - `parentRefs` matches the Gateway
  - hostnames
  - HTTPS listener with a `certificateRefs`
- **Critical rules (⛔):** the public listener serves HTTPS with a certificate reference; no TLS private key in the files.
- **Walkthrough:** quota rejection → fix → expose via Gateway → curl.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 8.1–8.2 Create namespaces, add a ResourceQuota, and watch a pod without requests get rejected.
- 8.3 An Ingress with an Ingress-capable controller from `lab/addons/` (pick a maintained one at build time).
- 8.4 Gateway + HTTPRoutes with a Gateway API controller; `curl` through a port-forward with different paths and hosts.
- 8.6 cert-manager with a self-signed issuer; inspect the certificate the Gateway serves.

## Misconceptions to target
- "Namespaces isolate network traffic." (Not without NetworkPolicy; see Chapter 9.)
- "Creating an Ingress object exposes my app." (You need a controller.)

## Accuracy notes
- Local lab: pick maintained Ingress and Gateway API controllers for kind at build time (don't use the retired community ingress-nginx).
- **High-churn area.** Verify current status of:
  - the community ingress-nginx retirement timeline
  - application routing add-on support for NGINX and Gateway API
  - Application Gateway for Containers features
  - the Istio add-on's Gateway API support
  - Gateway API versions (v1 kinds)
