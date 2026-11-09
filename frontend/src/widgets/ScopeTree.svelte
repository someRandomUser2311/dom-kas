<script>
  import { modeOf } from './lib.js';
  let { text, onsolved } = $props();
  const mode = modeOf(text, { task: /Success when/i, assign: /Assignment mode/i }, 'browse');

  const SUB = { 'sub-orders-nonprod': '1111aaaa-0000-4000-8000-000000000001', 'sub-orders-prod': '2222bbbb-0000-4000-8000-000000000002' };
  const tree = {
    id: 'tenant', label: 'Tenant (Contoso Entra ID)', kind: 'tenant', children: [
      { id: 'mg', label: 'Management group: Contoso', kind: 'mg', children: [
        { id: 'sub-orders-nonprod', label: 'Subscription: sub-orders-nonprod', kind: 'sub', children: [
          { id: 'rg-orders-dev', label: 'rg-orders-dev', kind: 'rg', children: [
            { id: 'aks-orders-dev', label: 'aks-orders-dev (AKS)', kind: 'res', type: 'Microsoft.ContainerService/managedClusters' },
            { id: 'vnet-orders-dev', label: 'vnet-orders-dev (VNet)', kind: 'res', type: 'Microsoft.Network/virtualNetworks' },
          ] },
          { id: 'rg-shared', label: 'rg-shared', kind: 'rg', children: [
            { id: 'contosoacr', label: 'contosoacr (ACR)', kind: 'res', type: 'Microsoft.ContainerRegistry/registries' },
          ] },
        ] },
        { id: 'sub-orders-prod', label: 'Subscription: sub-orders-prod', kind: 'sub', children: [
          { id: 'rg-orders-prod', label: 'rg-orders-prod', kind: 'rg', children: [
            { id: 'aks-orders-prod', label: 'aks-orders-prod (AKS)', kind: 'res', type: 'Microsoft.ContainerService/managedClusters' },
            { id: 'kv-orders-prod', label: 'kv-orders-prod (Key Vault)', kind: 'res', type: 'Microsoft.KeyVault/vaults' },
          ] },
        ] },
      ] },
    ] };
  const flat = [];
  (function walk(n, path, depth) { const p = [...path, n]; flat.push({ ...n, path: p, depth }); (n.children || []).forEach((c) => walk(c, p, depth + 1)); })(tree, [], 0);
  const byId = Object.fromEntries(flat.map((n) => [n.id, n]));

  function resourceId(n) {
    const sub = n.path.find((x) => x.kind === 'sub');
    const rg = n.path.find((x) => x.kind === 'rg');
    if (n.kind === 'tenant') return '/ (tenant root)';
    if (n.kind === 'mg') return '/providers/Microsoft.Management/managementGroups/contoso';
    let s = `/subscriptions/${SUB[sub.id]}`;
    if (rg) s += `/resourceGroups/${rg.id}`;
    if (n.kind === 'res') s += `/providers/${n.type}/${n.id}`;
    return s;
  }

  let open = $state(Object.fromEntries(flat.map((n) => [n.id, n.depth < 3])));
  let selected = $state('rg-orders-dev');
  let identity = $state('sp-orders-pipeline-dev');
  let role = $state('Contributor');
  let assigned = $state(null);
  const visible = $derived(flat.filter((n) => n.path.slice(0, -1).every((p) => open[p.id])));
  const reaches = (n) => assigned && n.path.some((p) => p.id === assigned.scope);

  const feedback = $derived.by(() => {
    if (!assigned) return null;
    const s = byId[assigned.scope];
    if (assigned.identity !== 'sp-orders-pipeline-dev') return ['bad', 'That identity isn’t the pipeline. Pick sp-orders-pipeline-dev.'];
    if (s.kind === 'sub' || s.kind === 'mg' || s.kind === 'tenant') return ['bad', `This also reaches ${flat.filter((n) => n.kind === 'rg' && n.path.some((p) => p.id === s.id) && n.id !== 'rg-orders-dev').map((n) => n.id).join(' and ')}.`];
    if (s.kind === 'res') return ['bad', 'Too narrow: the pipeline creates new resources in the group, so scope it to the resource group.'];
    if (s.id !== 'rg-orders-dev') return ['bad', `${s.id} isn’t the dev resource group.`];
    if (assigned.role === 'Owner') return ['bad', 'Owner can also grant access to others. The pipeline doesn’t need that.'];
    if (assigned.role === 'Reader') return ['bad', 'Reader can’t create anything.'];
    return ['ok', '✓ Contributor at exactly rg-orders-dev: everything the pipeline needs, nothing more.'];
  });
  $effect(() => { if (mode === 'task' && feedback?.[0] === 'ok') onsolved(); });
</script>

<div class="wg">
  {#if mode !== 'browse'}
    <div class="wg-bar">
      <label>Identity <select bind:value={identity}><option>sp-orders-pipeline-dev</option><option>sp-orders-pipeline-prod</option><option>grp-sre</option></select></label>
      <label>Role <select bind:value={role}><option>Reader</option><option>Contributor</option><option>Owner</option></select></label>
      <span class="small muted">Scope: <b class="mono">{selected}</b></span>
      <button class="btn small primary" onclick={() => (assigned = { identity, role, scope: selected })}>Assign</button>
    </div>
  {/if}
  <div class="wg-panel tree">
    {#each visible as n (n.id)}
      <div class="node" style="padding-left:{n.depth * 18}px">
        {#if n.children}<button class="tg" onclick={() => (open[n.id] = !open[n.id])}>{open[n.id] ? '▾' : '▸'}</button>{:else}<span class="tg"></span>{/if}
        <button class="lbl {n.kind}" class:sel={selected === n.id} class:lit={reaches(n)} onclick={() => (selected = n.id)}>{n.label}</button>
        {#if reaches(n)}<span class="chip ok">{assigned.role}{assigned.scope === n.id ? '' : ' (inherited)'}</span>{/if}
      </div>
    {/each}
  </div>
  <div class="wg-msg small"><b>Resource ID</b> <span class="mono rid">{resourceId(byId[selected])}</span></div>
  {#if feedback && mode === 'task'}<div class="wg-msg {feedback[0]}">{feedback[1]}</div>{/if}
  {#if assigned && mode === 'assign'}<div class="wg-msg">{assigned.identity} has <b>{assigned.role}</b> on {assigned.scope} and everything under it ({flat.filter(reaches).length} nodes lit).</div>{/if}
</div>

<style>
  .tree { font-size: 0.85rem; }
  .node { display: flex; align-items: center; gap: 4px; margin: 2px 0; }
  .tg { width: 18px; border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0; }
  .lbl { border: 1px solid transparent; background: none; color: var(--text); border-radius: 6px; padding: 2px 6px; cursor: pointer; font: inherit; text-align: left; }
  .lbl:hover { background: var(--surface-2); }
  .lbl.sel { border-color: var(--accent); }
  .lbl.lit { background: var(--ok-soft); }
  .lbl.sub, .lbl.mg, .lbl.tenant { font-weight: 600; }
  .rid { word-break: break-all; }
</style>
