# Chapter 7 · Azure Pipelines: CI/CD to AKS

**Part:** DevOps · **Lessons:** 6 · **Time:** ~2.5 h · **Persona tabs:** B · CI/CD tool (A on the private-network step in L7.3)
**Status:** Built in [`app-preview/`](../../app-preview/). This file records what exists and what to change when the earlier chapters land.

## By the end, learners can
- Read and write a multi-stage `azure-pipelines.yml`: trigger, pr, pool, stages, jobs, steps, tasks.
- Choose Microsoft-hosted agents, self-hosted agents or Managed DevOps Pools, and route jobs with demands.
- Create a workload-identity-federation service connection, and explain the token flow.
- Build and push to ACR, then deploy to AKS with deployment jobs and environments.
- Gate production with conditions, dependsOn, approvals and checks.
- Use variables, the three expression syntaxes, Key Vault-backed variable groups, and templates/`extends`.

## Lessons (built)

| Lesson | Steps | Highlights |
|---|---|---|
| L7.1 CI/CD & where Azure Pipelines fits | 11 | Flow widget (commit → AKS); delivery vs deployment toggle; tapline `vmImage` |
| L7.2 Anatomy of `azure-pipelines.yml` | 13 | The file grows line by line; fill `script`; taplines on `containerRegistry` and `checkout: self` |
| L7.3 Agents & agent pools | 10 | Agent matcher: add the `vnet` demand to reach the private cluster |
| L7.4 Service connections, SPs, WIF & ACR | 11 | Token-flow widget (WIF vs secret); graded service-connection form; tapline `--attach-acr` |
| L7.5 Stages, conditions, environments, approvals | 11 | Stage simulator: make prod *skipped* while nothing fails; runOnce/rolling/canary tabs |
| L7.6 Variables, secrets & templates | 10 | `${{ }}` / `$[ ]` / `$( )` timeline; spot the leaked secret; templates |

## Practice (built)
- **Checkpoint quiz:** 8 mixed questions.
- **Predict:** 3 scenarios.
- **Write lab:** `azure-pipelines.yml`, 11 rules, with a stage graph built from the learner's YAML.
- **Critical rules (⛔):** no plaintext secrets in the YAML; Azure access only through a service connection; prod deploys only through a deployment job with an approved environment.
- **Walkthrough:** 12-step terminal: login, ACR, build/push, get-credentials, apply.
- **Chapter results page.**

## Changes once Chapters 4–6 exist
- **L7.4:** shorten the ACR part to a recap, since ACR basics move to Chapter 6.1–6.2. Keep the service-connection focus.
- **L7.3:** link the private-cluster check back to Chapter 6.5 instead of re-explaining it.
- **Walkthrough:** use WIF wording throughout. Keep the client-secret version only as the "legacy" comparison.
- **Move rollout strategy depth to Chapter 11.** L7.5 keeps only the strategy *tabs*.
- **Add a 2nd write lab:** a template + `extends` exercise graded by **pipeline-rules**.

## Try it locally
None. Azure DevOps has no local equivalent; the chapter's walkthrough covers the real flow. (Pipeline YAML is still checked in the browser by **pipeline-rules**.)

## Accuracy notes
- Verify against current docs:
  - `KubernetesManifest@1` input names
  - Managed DevOps Pools GA features
  - WIF as the default for new ARM service connections
  - the `pr:` trigger behaviour per repo type (Azure Repos uses branch policies)
