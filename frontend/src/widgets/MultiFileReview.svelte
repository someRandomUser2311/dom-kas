<script>
  // The colleague's first draft: tap lines to find the 10 planted problems.
  const FILES = {
    Dockerfile: ['FROM golang:latest AS build', 'WORKDIR /src', 'COPY . .', 'RUN CGO_ENABLED=0 go build -o /out/orders-api ./cmd/orders-api', 'FROM gcr.io/distroless/static-debian12:nonroot@sha256:…', 'COPY --from=build /out/orders-api /orders-api', 'USER nonroot:nonroot', 'ENTRYPOINT ["/orders-api"]'],
    'k8s/base/deployment.yaml': ['labels:', '  app: orders-api', 'containers:', '  - name: api', '    image: contosoacr.azurecr.io/orders-api:1.6.0', '    readinessProbe:', '      httpGet: { path: /readyz, port: http }', '    livenessProbe:', '      httpGet: { path: /health/db, port: http }'],
    'k8s/base/service.yaml': ['selector:', '  app: orders-api', '  tier: api', 'ports:', '  - port: 80', '    targetPort: http'],
    'k8s/policies/temp-debug.yaml': ['kind: NetworkPolicy', 'metadata: { name: temp-debug, namespace: orders }', 'spec:', '  podSelector: {}', '  policyTypes: [Ingress]', '  ingress:', '  - {}'],
    'k8s/overlays/prod/kustomization.yaml': ['configMapGenerator:', '  - name: orders-api-config', '    literals:', '      - LOG_LEVEL=warn', '      - PAYMENTS_API_KEY=pk_live_51Hx…'],
    'infra/terraform/aks.tf': ['sku_tier                  = "Free"', 'private_cluster_enabled   = true', 'local_account_disabled    = false', 'default_node_pool {', '  node_count = 1', '  zones      = ["1", "2", "3"]', '}'],
    'azure-pipelines.yml': ['- stage: DeployProd', '  dependsOn: Build', '  jobs:', '    - job: deploy', '      pool: { vmImage: ubuntu-latest }', '      steps:', '        - task: KubernetesManifest@1'],
  };
  const PLANTED = {
    'Dockerfile:0': 'An unpinned :latest build image means non-reproducible builds.',
    'k8s/base/deployment.yaml:8': 'Liveness depends on the database: the death spiral.',
    'k8s/base/service.yaml:2': 'The Service selects tier: api, which the pods don’t have — no endpoints.',
    'k8s/policies/temp-debug.yaml:6': 'An allow-all ingress rule left over from debugging defeats default-deny.',
    'k8s/overlays/prod/kustomization.yaml:4': 'A live API key in Git. Use Key Vault and rotate it now.',
    'infra/terraform/aks.tf:0': 'The Free tier for prod has no uptime SLA.',
    'infra/terraform/aks.tf:2': 'Local accounts must be disabled: Entra ID + Azure RBAC only.',
    'infra/terraform/aks.tf:4': 'One system node can’t span three zones.',
    'azure-pipelines.yml:3': 'A plain job: no deployment job, no environment, no approval.',
    'azure-pipelines.yml:4': 'A Microsoft-hosted agent can’t reach the private cluster.',
  };
  let file = $state('Dockerfile');
  let found = $state({});
  let note = $state(null);
  function tap(i) {
    const k = `${file}:${i}`;
    if (PLANTED[k]) { found[k] = true; note = ['ok', `✓ ${PLANTED[k]}`]; }
    else note = ['', 'Looks fine.'];
  }
  const count = $derived(Object.keys(found).length);
</script>

<div class="wg">
  <div class="wg-bar"><span class="chip accent">found {count} / 10</span></div>
  <div class="review">
    <nav>{#each Object.keys(FILES) as f}<button class="file" class:on={file === f} onclick={() => { file = f; note = null; }}>{f} {Object.keys(found).filter((k) => k.startsWith(f + ':')).length ? '✓' : ''}</button>{/each}</nav>
    <div class="lines">{#each FILES[file] as l, i}<button class="ln" class:hit={found[`${file}:${i}`]} onclick={() => tap(i)}><span class="n">{i + 1}</span>{l}</button>{/each}</div>
  </div>
  {#if note}<div class="wg-msg {note[0]}">{note[1]}</div>{/if}
</div>

<style>
  .review { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 8px; }
  @container (max-width: 600px) { .review { grid-template-columns: minmax(0, 1fr); } }
  nav { display: grid; gap: 2px; align-content: start; }
  .file { text-align: left; border: 1px solid transparent; background: none; color: var(--text); font: 12px var(--mono); padding: 4px 6px; border-radius: 6px; cursor: pointer; }
  .file.on { border-color: var(--accent); background: var(--accent-soft); }
  .lines { background: var(--code-bg); border-radius: 8px; padding: 6px 0; overflow-x: auto; }
  .ln { display: flex; width: 100%; border: 0; background: none; color: var(--code-text); font: 12.5px/1.6 var(--mono); text-align: left; white-space: pre; cursor: pointer; padding: 0 8px 0 0; }
  .ln:hover { background: rgba(255, 255, 255, 0.06); }
  .ln.hit { background: rgba(63, 185, 111, 0.28); }
  .n { width: 30px; text-align: right; padding-right: 8px; color: var(--code-com); flex: none; }
</style>
