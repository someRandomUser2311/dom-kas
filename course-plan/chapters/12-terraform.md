# Chapter 12 · Infrastructure as code with Terraform

**Part:** Infrastructure as code · **Lessons:** 8 · **Time:** ~3 h · **Persona tabs:** C · Infra tooling · B · CI/CD tool (12.8)

This chapter is the first of the two infrastructure-as-code chapters. Terraform comes first because its state, plan and apply model gives the richest pipeline lessons. [Chapter 13](13-bicep.md) builds **the same Contoso infrastructure in Bicep**, so learners can compare the two languages line for line.

## By the end, learners can
- Explain why infrastructure should be code, and what belongs in IaC vs the app pipeline.
- Write HCL fluently:
  - providers
  - resources
  - variables (with validation)
  - locals and outputs
  - data sources
  - `count` / `for_each`
  - `dynamic` blocks
- Build the Contoso platform with `azurerm`:
  - resource group, VNet and subnets
  - ACR
  - AKS (+ user node pool)
  - Log Analytics
  - AcrPull for the kubelet identity
  - a user-assigned identity with a federated credential
- Structure code with modules (their own and Azure Verified Modules), and pin provider and module versions.
- Manage state safely: azurerm remote backend, locking, sensitive values, `import` / `moved` blocks, drift.
- Run Terraform in Azure Pipelines:
  - PR checks: fmt, validate, lint, policy scan
  - a saved plan → approval → apply
  - WIF/OIDC authentication

## Lessons

### 12.1 Why IaC, and the Terraform workflow (~11 steps)
- **Teaches:**
  - Click-ops drift; declarative desired state (links back to Chapter 1.4).
  - Terraform's loop: `init` → `plan` → `apply` → `destroy`.
  - Providers.
  - The lock file (`.terraform.lock.hcl`) is committed; `.terraform/` is not.
  - A note on licensing: OpenTofu is the open-source fork, and it's compatible for everything in this chapter.
- **Interactive:** a plan-symbol widget. Edit a value and see `+` create, `~` update in place, `-/+` replace, `-` destroy.
- **Checks:**
  - order: the workflow.
  - match: plan symbol ↔ meaning.
  - mcq: which files go in Git.

### 12.2 HCL basics (~13 steps)
- **Teaches:**
  - Blocks, arguments, references (`azurerm_resource_group.main.name`).
  - `terraform {}` with `required_providers` and a version constraint.
  - `provider "azurerm" { features {} }`.
  - Implicit dependencies vs `depends_on`.
- **Code:** `main.tf` grows: terraform block → provider → resource group → VNet → subnets.
- **Checks:**
  - fill: the reference expression.
  - tapline: the version constraint.
  - mcq: when you actually need `depends_on`.

### 12.3 Variables, locals, outputs & data sources (~12 steps)
- **Teaches:**
  - `variable` with type, default, `validation` and `sensitive`.
  - `.tfvars` per environment, and precedence (CLI > `*.auto.tfvars` > `terraform.tfvars` > env vars > defaults).
  - `locals` for naming and tags.
  - `output`.
  - `data` sources (e.g. `azurerm_client_config`, an existing Key Vault).
- **Checks:**
  - custom: add a validation that `environment` is `dev` or `prod`.
  - predict: which value wins.
  - tapline: the data source.

### 12.4 Building AKS (~15 steps)
- **Teaches:** `azurerm_kubernetes_cluster` grows one block at a time:
  1. `default_node_pool`: system pool, zones, `only_critical_addons_enabled`
  2. `identity { type = "UserAssigned" }`
  3. `network_profile`: `network_plugin = "azure"`, `network_plugin_mode = "overlay"`, `network_policy` / `network_data_plane = "cilium"`, `outbound_type`
  4. `oidc_issuer_enabled` + `workload_identity_enabled`
  5. `azure_active_directory_role_based_access_control` with `azure_rbac_enabled`
  6. `local_account_disabled = true`
  7. `private_cluster_enabled` (the dev overlay keeps it public with authorized IP ranges)
  8. `automatic_upgrade_channel` / `node_os_upgrade_channel` + `maintenance_window`
  9. `oms_agent` → Log Analytics
- Then: an `azurerm_kubernetes_cluster_node_pool` user pool; `azurerm_container_registry`.
- **Checks:**
  - fill: `network_plugin_mode`.
  - tapline: the argument that removes static admin credentials.
  - custom: switch dev → prod settings (private cluster, Standard tier) using a variable.

### 12.5 Identity & role assignments (~11 steps)
- **Teaches:**
  - `azurerm_role_assignment` AcrPull to `kubelet_identity[0].object_id`.
  - A workload identity: `azurerm_user_assigned_identity` + `azurerm_federated_identity_credential` (issuer = `oidc_issuer_url`, subject = `system:serviceaccount:orders:orders-api`).
  - Key Vault access via RBAC.
  - Why role assignments take time to propagate.
- **Checks:**
  - tapline: the kubelet identity reference.
  - custom: fix the federated credential subject.
  - diagnose: `AuthorizationFailed` when the pipeline identity lacks User Access Administrator / RBAC Administrator.

### 12.6 Repetition & modules (~13 steps)
- **Teaches:**
  - `for_each` over a map of node pools; `count` pitfalls (index shifts).
  - `dynamic` blocks.
  - Writing a local module (`modules/aks`): inputs, outputs, composition.
  - Azure Verified Modules from the registry: pin `version`.
  - Environments as root folders vs workspaces, and why folders usually win.
- **Checks:**
  - predict: remove the middle item from a `count` list (later resources are recreated) vs `for_each` (only that one is removed).
  - fill: the module `source` / `version`.
  - mcq: workspaces vs folders.

### 12.7 State (~13 steps)
- **Teaches:**
  - What state is: the mapping from code to real IDs, plus cached attributes.
  - Why state is sensitive: it contains secrets in plain text.
  - The `azurerm` backend: storage account, container, key, blob-lease locking, Entra ID auth.
  - Never edit state by hand.
  - `terraform import` blocks for existing resources.
  - `moved` blocks for refactors.
  - `terraform plan -refresh-only` for drift.
  - `lifecycle { prevent_destroy, ignore_changes }`. Ignore `default_node_pool[0].node_count` when the cluster autoscaler manages it.
- **Interactive:** a state diagram. Code ↔ state ↔ Azure; change one side and see what `plan` proposes.
- **Checks:**
  - diagnose: `Error acquiring the state lock`.
  - custom: add a `moved` block so a rename doesn't destroy the cluster.
  - mcq: a portal change to the node count → plan output.

### 12.8 Terraform in Azure Pipelines (~14 steps)
- **Teaches:**
  - **PR pipeline:** `fmt -check`, `validate`, `tflint`, and a policy scan (Checkov or Trivy config); the plan posted as a summary.
  - **Main pipeline:**
    - Plan stage: `plan -out=tfplan`, then publish `tfplan` as an artifact.
    - Deployment job with an environment approval.
    - Apply the **same** `tfplan`.
  - **Auth:** a WIF service connection. Use the `AzureCLI@2` task with `addSpnToEnvironment`, and set `ARM_USE_OIDC` / `ARM_OIDC_TOKEN` / `ARM_CLIENT_ID` / `ARM_TENANT_ID` / `ARM_SUBSCRIPTION_ID` (or the Terraform marketplace task).
  - Separate infra and app pipelines.
  - Stale plans.
  - Concurrency.
- **Interactive:** the stage graph from Chapter 7, with a plan artifact moving between stages.
- **Checks:**
  - custom: arrange stages so apply can't run without an approved plan.
  - tapline: the plan file handoff.
  - mcq: why apply the saved plan rather than re-planning.

## Practice
- **Quiz (12)**
- **Predict (4):**
  - `count` index shift
  - portal drift
  - a rename without `moved`
  - two applies at once
- **Write lab A:** `main.tf` + `variables.tf` + `outputs.tf` for the Contoso cluster. Graded by **iac-rules (Terraform)**:
  - provider pinned
  - remote backend configured
  - overlay networking
  - OIDC + workload identity
  - Azure RBAC on, local accounts off
  - system pool across 3 zones with ≥ 2 nodes
  - AcrPull to the kubelet identity
  - no secrets in defaults
  - environment validation
- **Write lab B:** `azure-pipelines.yml` for infra. Graded by **pipeline-rules**:
  - PR checks
  - plan artifact
  - apply in a deployment job with an environment
  - the same plan applied
  - WIF connection
- **Critical rules (⛔):** lab A: no secrets in variable defaults or `.tfvars`; local accounts disabled. Lab B: apply uses the saved plan; apply runs only after an approval.
- **Walkthrough:** `init` → `plan` → `apply` → portal drift → `plan` shows it → fix.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 12.1–12.3, 12.6–12.7 Practise the workflow, variables, `for_each` vs `count`, state, `moved` and `import` with the `local` and `random` providers. They're free, need no account, and give the same plan and state behaviour.
- 12.4–12.5 `terraform fmt`, `validate`, and `terraform test` with a **mock `azurerm` provider** to plan the real AKS configuration without Azure credentials.
- 12.8 is Azure Pipelines only.

## Misconceptions to target
- "State is just a cache; you can delete it." (You lose track of every resource.)
- "`terraform apply` without a saved plan is the same thing." (Not if something changed in between.)
- "IaC means I never use the CLI."

## Accuracy notes
- Local lab: `terraform test` mock provider support (`mock_provider`) in the pinned Terraform version, and that `azurerm` plans cleanly under it.
- Verify against current docs:
  - the azurerm provider major version and argument names (`automatic_upgrade_channel`, `network_data_plane`, the AAD RBAC block)
  - Terraform OIDC env vars for Azure DevOps
  - the current Microsoft-supported Terraform task
  - AVM AKS module name/version
  - OpenTofu compatibility statement
