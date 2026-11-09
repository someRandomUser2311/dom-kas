# Chapter 16 · Supply chain: scanning, signing & policy-as-code

**Part:** Operate & secure · **Lessons:** 5 · **Time:** ~1.5 h · **Persona tabs:** A · Background (16.1, 16.2, 16.5) · B · CI/CD tool (16.3, 16.4)

## By the end, learners can
- Explain the supply-chain attack surface: base images, dependencies, the build system and the registry.
- Pin images by digest, choose minimal base images, and keep them patched.
- Add image vulnerability scanning and SBOM generation to the pipeline, with a sensible fail policy.
- Sign images (Notation with Key Vault keys, or cosign), and verify signatures at admission.
- Enforce rules with policy-as-code: Azure Policy for AKS (Gatekeeper), or Kyverno.

## Lessons

### 16.1 The attack surface (~9 steps)
- **Teaches:**
  - Where untrusted code enters: base images, packages, build agents, the registry, deployment.
  - SLSA levels (short).
- **Interactive:** a pipeline diagram. Click each hop to see a real-world-style attack.
- **Checks:**
  - match: attack ↔ hop.

### 16.2 Images you can trust (~10 steps)
- **Teaches:**
  - Minimal/distroless base images; multi-stage builds.
  - Pin by digest.
  - Rebuild on base updates.
  - ACR tasks base-image triggers (short).
  - Purge old images.
- **Checks:**
  - tapline: the unpinned `FROM`.
  - mcq: tag vs digest at deploy time.

### 16.3 Scanning & SBOM in the pipeline (~12 steps)
- **Teaches:**
  - A Trivy (or equivalent) scan step.
  - Fail on HIGH/CRITICAL with a fix available.
  - Microsoft Defender for Containers registry scanning.
  - Generating an SBOM and attaching it to ACR as an OCI referrer.
- **Checks:**
  - fill: the severity flag.
  - custom: order the build stage (build → scan → sign → push, or build → push → scan → sign).
  - diagnose: a scan log.

### 16.4 Signing & verification (~12 steps)
- **Teaches:**
  - Why signing matters: integrity and provenance.
  - Notation + Key Vault certificate, `notation sign` in the pipeline.
  - Verification at admission (Ratify + Azure Policy / image integrity).
  - The cosign alternative.
- **Checks:**
  - order: the sign/verify flow.
  - mcq: what an unsigned image gets at admission in `deny` mode.

### 16.5 Policy-as-code (~12 steps)
- **Teaches:**
  - Azure Policy add-on (Gatekeeper/OPA): built-in initiatives, audit vs deny.
  - Kyverno as the alternative (YAML policies, mutate + validate).
  - Example rules:
    - only `contosoorders.azurecr.io` images
    - no `:latest`
    - resource limits required
    - no privileged containers
  - Shift left: run the same rules in CI.
- **Interactive:** **policy-rules**. Apply a policy set to a bundle of manifests and see admit/deny with reasons.
- **Checks:**
  - custom: write a Kyverno validate rule for allowed registries, graded by evaluating it against sample pods.
  - mcq: audit vs deny rollout plan.

## Practice
- **Quiz (8)**
- **Predict (3):**
  - an unsigned image in deny mode
  - a scan with no fix available
  - a policy in audit mode
- **Write lab:** add a supply-chain stage to `azure-pipelines.yml`. Graded by **pipeline-rules**:
  - scan step before push/deploy
  - fail threshold set
  - SBOM generated
  - signing step using a WIF service connection
  - deploy references the image by digest
- **Critical rules (⛔):** the scan runs before deploy and fails on fixable HIGH/CRITICAL findings; no signing key material in the repo.
- **Walkthrough:** build → scan fails → bump the base image → pass → sign → admission verifies.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 16.2 Compare image sizes of a single-stage vs multi-stage / distroless build.
- 16.3 `trivy image` scan with a severity threshold, and SBOM generation.
- 16.4 `cosign` sign and verify an image in the local registry with a local key pair.
- 16.5 Install Kyverno in the lab; an allowed-registries policy rejects a `docker.io` image and admits `localhost:5001`.

## Misconceptions to target
- "Scanning once at build is enough." (New CVEs appear after build.)
- "Signing proves the image is safe." (It proves who built it and that it wasn't changed.)

## Accuracy notes
- **High churn.** Verify:
  - the AKS image integrity feature status (preview/GA/retired)
  - the Ratify version and its Azure Policy integration
  - Notation Key Vault plugin usage
  - Defender for Containers scanning features
  - built-in Azure Policy names for AKS
