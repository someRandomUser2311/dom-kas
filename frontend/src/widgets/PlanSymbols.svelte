<script>
  let tag = $state('dev');
  let vm = $state('Standard_D4ds_v5');
  let zones = $state('1,2,3');
  let hasLaw = $state(true);
  let hasAlert = $state(false);
  const ORIG = { tag: 'dev', vm: 'Standard_D4ds_v5', zones: '1,2,3' };
  const plan = $derived.by(() => {
    const out = [];
    if (tag !== ORIG.tag) out.push(['~', 'azurerm_resource_group.main', `tags.env: "${ORIG.tag}" → "${tag}"`, 'update in-place']);
    if (vm !== ORIG.vm || zones !== ORIG.zones) out.push(['-/+', 'azurerm_kubernetes_cluster_node_pool.user', `${vm !== ORIG.vm ? `vm_size: "${ORIG.vm}" → "${vm}"` : ''} ${zones !== ORIG.zones ? `zones: [${ORIG.zones}] → [${zones}]` : ''} # forces replacement`, 'destroy and then create replacement']);
    if (!hasLaw) out.push(['-', 'azurerm_log_analytics_workspace.main', 'removed from configuration', 'destroy']);
    if (hasAlert) out.push(['+', 'azurerm_monitor_metric_alert.cpu', 'new block', 'create']);
    return out;
  });
  const counts = $derived({ add: plan.filter((p) => p[0] === '+' || p[0] === '-/+').length, change: plan.filter((p) => p[0] === '~').length, destroy: plan.filter((p) => p[0] === '-' || p[0] === '-/+').length });
</script>

<div class="wg">
  <div class="two-col">
    <div class="wg-panel small form">
      <label>resource group tag env <input class="mono" bind:value={tag} /></label>
      <label>user pool vm_size <select bind:value={vm}><option>Standard_D4ds_v5</option><option>Standard_D8ds_v5</option></select></label>
      <label>user pool zones <select bind:value={zones}><option>1,2,3</option><option>1,2</option></select></label>
      <label class="cb"><input type="checkbox" bind:checked={hasLaw} /> keep the log_analytics_workspace block</label>
      <label class="cb"><input type="checkbox" bind:checked={hasAlert} /> add a metric alert block</label>
    </div>
    <div>
      <pre class="code">{#if !plan.length}No changes. Your infrastructure matches the configuration.{:else}{#each plan as p}<span class={p[0] === '+' ? 'add' : p[0] === '~' ? 'chg' : 'del'}>  {p[0]} {p[1]}  ({p[3]})</span>{'\n'}      {p[2]}{'\n'}{/each}{'\n'}Plan: {counts.add} to add, {counts.change} to change, {counts.destroy} to destroy.{/if}</pre>
    </div>
  </div>
</div>

<style>
  .form label { display: grid; gap: 3px; margin: 6px 0; }
  .form .cb { display: flex; gap: 6px; }
  .add { color: #6ee7a8; } .chg { color: #ffd27a; } .del { color: #ff9a9a; }
</style>
