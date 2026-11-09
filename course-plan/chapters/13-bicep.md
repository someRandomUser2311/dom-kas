# Chapter 13 · Infrastructure as code with Bicep

**Part:** Infrastructure as code · **Lessons:** 8 · **Time:** ~3 h · **Persona tabs:** Coming from Terraform (fixed, open by default) + C · Infra tooling · B · CI/CD tool (13.8)

This chapter builds **the same Contoso platform as [Chapter 12](12-terraform.md)**, in Bicep. Every concept step has a "Coming from Terraform" tab, so learners map what they know rather than starting over. It's still complete on its own: a learner who skips Chapter 12 can follow it.

## By the end, learners can
- Explain how Bicep relates to ARM: Bicep is compiled to ARM JSON, Azure itself is the state, and resources have API versions.
- Write Bicep fluently:
  - `param` with decorators (`@allowed`, `@minLength`, `@secure`, `@description`)
  - `var`, `output`
  - resource symbolic names; `existing` resources; `parent`
  - loops, conditions
  - user-defined types
  - `.bicepparam` files
- Build the Contoso platform: VNet, ACR, AKS (+ user pool), Log Analytics, role assignments, a workload identity with a federated credential.
- Use deployment scopes (`targetScope`), modules, Azure Verified Modules (`br/public:avm/...`) and a private module registry in ACR.
- Preview with `what-if`; understand incremental vs complete mode; manage lifecycle with **deployment stacks**.
- Run Bicep in Azure Pipelines (lint/build → what-if → approval → deploy, with WIF), and choose between Bicep and Terraform.

## Lessons

### 13.1 Bicep & ARM: the model (~11 steps)
- **Teaches:**
  - Bicep → ARM JSON → Azure Resource Manager.
  - There is no state file: ARM is the source of truth.
  - Resource types and `@api-version`.
  - Deploying: `az deployment group create -f main.bicep -p main.bicepparam`.
  - Deployment history in the resource group.
- **Coming from Terraform:** no `init` and no state backend. `what-if` ≈ `plan`; a deployment ≈ `apply`.
- **Interactive:** a compile widget. Toggle between the Bicep file and the ARM JSON it compiles to.
- **Checks:**
  - mcq: where Bicep keeps state.
  - match: Terraform concept ↔ Bicep concept.

### 13.2 Bicep syntax (~13 steps)
- **Teaches:**
  - `param`, `var`, `resource`, `output`.
  - Symbolic references (`vnet.id`, `vnet.properties.subnets[0].id`) with implicit dependencies.
  - `existing` resources; child resources via `parent`.
  - String interpolation; `resourceGroup().location`; `uniqueString()`.
  - Decorators.
- **Code:** `main.bicep` grows: params → VNet with subnets → ACR.
- **Checks:**
  - fill: `@allowed(['dev', 'prod'])`.
  - tapline: the `existing` keyword.
  - mcq: why `uniqueString(resourceGroup().id)` for an ACR name.

### 13.3 Building AKS in Bicep (~15 steps)
- **Teaches:** `Microsoft.ContainerService/managedClusters` grows one property at a time:
  1. `sku.tier`
  2. `identity: { type: 'UserAssigned' }`
  3. `agentPoolProfiles`: system mode, zones, `CriticalAddonsOnly` taint
  4. `networkProfile`: `networkPlugin: 'azure'`, `networkPluginMode: 'overlay'`, `networkDataplane: 'cilium'`, `outboundType`
  5. `oidcIssuerProfile.enabled` + `securityProfile.workloadIdentity.enabled`
  6. `aadProfile`: `managed`, `enableAzureRBAC`
  7. `disableLocalAccounts`
  8. `apiServerAccessProfile.enablePrivateCluster`
  9. `autoUpgradeProfile`
  10. `addonProfiles.omsagent`
- Then: a user pool as an `agentPools` child resource.
- **Coming from Terraform:** a side-by-side panel maps each property to the Chapter 12 argument.
- **Checks:**
  - fill: `networkPluginMode`.
  - tapline: `disableLocalAccounts`.
  - custom: make the private-cluster setting depend on the `environment` param.

### 13.4 Identity & role assignments (~11 steps)
- **Teaches:**
  - `Microsoft.Authorization/roleAssignments` as an extension resource with `scope: acr`.
  - The name **must** be deterministic: `guid(acr.id, principalId, roleId)`.
  - `principalId: aks.properties.identityProfile.kubeletidentity.objectId`.
  - `principalType: 'ServicePrincipal'` to avoid replication errors.
  - `Microsoft.ManagedIdentity/userAssignedIdentities` + `federatedIdentityCredentials`.
- **Checks:**
  - mcq: what happens on redeploy if the name uses `newGuid()`.
  - tapline: the kubelet identity path.
  - diagnose: `RoleAssignmentExists` / `PrincipalNotFound` errors.

### 13.5 Loops, conditions & types (~11 steps)
- **Teaches:**
  - `[for pool in nodePools: {...}]` and loops with an index.
  - `if (environment == 'prod')` conditional resources.
  - The ternary operator.
  - User-defined types (`type nodePool = {...}`) for validated object params.
  - `.bicepparam` files per environment.
- **Coming from Terraform:** `for_each` ↔ `for`, `count = cond ? 1 : 0` ↔ `if`.
- **Checks:**
  - custom: add a GPU pool only in prod.
  - fill: the loop expression.
  - predict: the resources created for `dev` vs `prod`.

### 13.6 Modules & registries (~11 steps)
- **Teaches:**
  - Local modules (`module aks './modules/aks.bicep'`): params, outputs.
  - `scope:` for cross-resource-group deployments.
  - `targetScope = 'subscription'` to create the resource group itself.
  - Azure Verified Modules from `br/public:avm/res/container-service/managed-cluster:<version>`.
  - Publishing your own modules to ACR (`bicep publish`), and `bicepconfig.json` aliases.
- **Checks:**
  - tapline: the module version.
  - mcq: why pin AVM versions.
  - fill: the `targetScope`.

### 13.7 Deploy modes, what-if & deployment stacks (~12 steps)
- **Teaches:**
  - **Incremental (default):** resources removed from the file are *not* deleted. This is the biggest difference from Terraform.
  - **Complete mode:** removes them, with risks.
  - `what-if` output symbols and noise.
  - **Deployment stacks:** manage a set of resources as a unit; `actionOnUnmanage` (detach vs delete); `denySettings` to block portal changes (drift prevention).
- **Interactive:** a deploy-mode widget. Remove a resource from the file, deploy in incremental, complete or stack mode, and see what happens in Azure.
- **Checks:**
  - predict: delete the user node pool from the file and redeploy incrementally (it stays).
  - mcq: how to stop portal drift (deny settings).
  - match: what-if symbol ↔ meaning.

### 13.8 Bicep in Azure Pipelines & choosing a tool (~13 steps)
- **Teaches:**
  - **PR:** `az bicep build` / the linter (`bicepconfig.json` rules), `what-if` output posted to the run summary.
  - **Main:** a what-if stage → environment approval → deploy stage using `AzureCLI@2` (`az deployment group create` or `az stack group create`) with a WIF service connection.
  - The `AzureResourceManagerTemplateDeployment@3` task alternative.
  - Note: what-if isn't a saved plan, so re-run it right before deploying.
  - **Choosing:** a decision matrix, Terraform vs Bicep:
    - multi-cloud and non-Azure providers
    - day-0 Azure feature support
    - state management
    - team skills
    - tooling
- **Checks:**
  - custom: arrange stages so deploy needs an approved what-if.
  - mcq scenarios: which tool fits.
  - multi.

## Practice
- **Quiz (12):** includes 4 "translate" questions between Terraform and Bicep.
- **Predict (4):**
  - incremental mode after removing a resource
  - `newGuid()` role assignment on redeploy
  - a stack with `deleteAll`
  - what-if on a nested module
- **Write lab A:** `main.bicep` + `main.prod.bicepparam` for the Contoso cluster. Graded by **iac-rules (Bicep)** with the same rule set as Chapter 12 lab A:
  - overlay networking
  - OIDC + workload identity
  - Azure RBAC on, local accounts off
  - zones
  - AcrPull with a deterministic `guid()` name
  - `@secure()` on secret params
  - no secrets in params files
  - environment `@allowed`
- **Write lab B:** translate a given Terraform `node_pool` + role assignment into Bicep. Graded by matching rules.
- **Write lab C:** the infra pipeline, graded by **pipeline-rules**: lint, what-if stage, deploy in a deployment job with an approval, WIF.
- **Critical rules (⛔):** lab A: secret params use `@secure()` and no secrets are in `.bicepparam`; local accounts disabled. Lab C: deploy runs only after an approval. Lab B has none (translation practice).
- **Walkthrough:** what-if → deploy as a stack → portal change blocked by deny settings.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 13.1 `az bicep build main.bicep`: see the ARM JSON it compiles to.
- 13.2–13.6 The Bicep linter (`az bicep lint`) and `az bicep build-params` on the learner's files.
- `what-if`, deployments and stacks need Azure; they stay as walkthroughs.

## Misconceptions to target
- "Removing a resource from Bicep deletes it." (Not in incremental mode.)
- "Bicep has no state, so there's no drift." (Drift happens; Bicep just doesn't track it.)
- "Bicep is just Terraform for Azure." (Different lifecycle model.)

## Accuracy notes
- Verify against current docs:
  - the latest `managedClusters` API version and property paths (`networkDataplane`, `autoUpgradeProfile`, `nodeOSUpgradeChannel`)
  - AVM module path/version for AKS
  - deployment stacks commands and parameter names
  - `bicepparam` and user-defined types status
  - `AzureResourceManagerTemplateDeployment` task version
