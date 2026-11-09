# Chapter 10 · Helm & Kustomize in pipelines

**Part:** DevOps · **Lessons:** 6 · **Time:** ~2 h · **Persona tabs:** A · Background (10.1–10.5) · B · CI/CD tool (10.6)

## By the end, learners can
- Structure manifests as a Kustomize base with `dev`/`prod` overlays (patches, images, replicas, namespace).
- Read and write a small Helm chart: `Chart.yaml`, `values.yaml`, templates, helpers.
- Install and upgrade releases safely (`upgrade --install --atomic --wait`), and roll back.
- Store charts as OCI artifacts in ACR.
- Wire either approach into `azure-pipelines.yml`, with one artifact promoted across environments.

## Lessons

### 10.1 Why templating? (~8 steps)
- **Teaches:**
  - Copy-pasted YAML per environment drifts.
  - Two philosophies: overlay (Kustomize) vs template (Helm).
- **Checks:**
  - mcq: when each one fits.
  - match: feature ↔ tool.

### 10.2 Kustomize base & overlays (~13 steps)
- **Teaches:**
  - `kustomization.yaml`: `resources`, `namespace`, `labels`, `images` (set the tag without editing YAML), `replicas`.
  - Strategic-merge and JSON6902 patches.
  - `kubectl apply -k`.
- **Interactive:** **kustomize-lite**. Edit the overlay and see the rendered output diff.
- **Checks:**
  - custom: make prod run 4 replicas with image tag `1.4.2`.
  - tapline: the `images:` entry.

### 10.3 Helm charts (~13 steps)
- **Teaches:**
  - Chart layout.
  - `{{ .Values.x }}`, `default`, `quote`, `if`, `range`.
  - `_helpers.tpl`.
  - `helm template` to preview.
- **Interactive:** **helm-lite** renderer. Change values and see the manifest.
- **Checks:**
  - fill a template expression.
  - predict: the rendered output.
  - tapline: the value that sets replicas.

### 10.4 Releases: install, upgrade, rollback (~10 steps)
- **Teaches:**
  - A release and its revisions.
  - `helm upgrade --install --atomic --wait --timeout`.
  - `helm history` / `rollback`.
  - Values files per environment.
  - Don't put secrets in values.
- **Checks:**
  - command: the safe upgrade command.
  - diagnose: `another operation (install/upgrade/rollback) is in progress`.

### 10.5 Charts in ACR (OCI) (~8 steps)
- **Teaches:**
  - `helm package`, `helm push oci://contosoorders.azurecr.io/helm`.
  - Version the chart separately from the app.
- **Checks:**
  - command.
  - mcq: chart version vs `appVersion`.

### 10.6 In the pipeline (~12 steps)
- **Teaches:**
  - Build once, promote the same image digest.
  - Kustomize: the `KubernetesManifest@1` bake action with kustomize, or `kubectl apply -k`.
  - Helm: the `HelmDeploy` task, or `helm` in `AzureCLI@2`.
  - Environments per overlay or values file.
  - Template the deploy stage (reusing the Chapter 7 templates).
- **Checks:**
  - tapline: where the tag is injected.
  - custom: reorder the stages so the same artifact moves dev → prod.

## Practice
- **Quiz (10)**
- **Predict (3):**
  - overlay patch precedence
  - Helm `default` with an empty string
  - `--atomic` on failure
- **Write lab A:** Kustomize prod overlay. Graded by **kustomize-lite**: the rendered output must match the target spec (replicas, image, namespace, resource limits).
- **Write lab B:** pipeline deploy stage. Graded by **pipeline-rules**:
  - the tag comes from `Build.BuildId`
  - the same artifact is used in all environments
  - a deployment job with an environment
- **Critical rules (⛔):** lab A: the prod image is pinned to a version, not `latest`. Lab B: the same image artifact is promoted to every environment (no rebuild per environment); prod needs an approved environment.
- **Walkthrough:** `helm template` → install → upgrade with a bad image → atomic rollback.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 10.2 `kubectl kustomize overlays/prod` and `kubectl apply -k`.
- 10.3–10.4 `helm template`, `helm upgrade --install --atomic` with a deliberately bad image → automatic rollback; `helm history`.
- 10.5 `helm push` the chart to the local registry as an OCI artifact.

## Misconceptions to target
- "Kustomize and Helm can't be combined." (Kustomize can post-render a Helm chart.)
- "Rebuild the image per environment."

## Accuracy notes
- Verify against current docs:
  - `HelmDeploy` task version and inputs
  - `KubernetesManifest@1` bake support for kustomize/helm
  - Helm major version (Helm 4 changes)
  - Kustomize `labels` vs `commonLabels` deprecation
