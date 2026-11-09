<script>
  let renamed = $state(false);
  let portal = $state(false);
  let stateRm = $state(false);
  let azureDel = $state(false);
  const plan = $derived.by(() => {
    if (stateRm && !azureDel) return ['+ azurerm_kubernetes_cluster.main will be created', 'Terraform no longer knows the cluster exists, so it plans a new one — and creation fails: a resource with this ID already exists. Import it instead.'];
    if (azureDel && !stateRm) return ['+ azurerm_kubernetes_cluster.main will be created', 'Refresh finds it gone from Azure, so Terraform recreates it.'];
    if (azureDel && stateRm) return ['+ azurerm_kubernetes_cluster.main will be created', 'Neither state nor Azure has it: a clean create.'];
    if (renamed) return ['- azurerm_kubernetes_cluster.main will be destroyed\n+ azurerm_kubernetes_cluster.orders will be created', 'Code and state no longer line up by address. Add a moved block to say they’re the same resource.'];
    if (portal) return ['~ azurerm_kubernetes_cluster.main will be updated in-place\n    sku_tier: "Free" → "Standard"', 'Drift: someone changed it in the portal; Terraform puts the code’s value back.'];
    return ['No changes.', 'Code, state and Azure agree.'];
  });
</script>

<div class="wg">
  <div class="wg-bar">
    <label><input type="checkbox" bind:checked={renamed} /> rename to .orders in code</label>
    <label><input type="checkbox" bind:checked={portal} /> change sku_tier in the portal</label>
    <label><input type="checkbox" bind:checked={stateRm} /> terraform state rm</label>
    <label><input type="checkbox" bind:checked={azureDel} /> delete it in Azure</label>
  </div>
  <div class="cols3">
    <div class="box" class:badb={renamed}><h4>Code</h4><span class="mono small">azurerm_kubernetes_cluster.{renamed ? 'orders' : 'main'}</span><br /><span class="mono small">sku_tier = "Standard"</span></div>
    <div class="box" class:badb={stateRm}><h4>State</h4>{#if stateRm}<span class="small no">(no entry)</span>{:else}<span class="mono small">azurerm_kubernetes_cluster.main → /subscriptions/…/aks-orders-dev</span>{/if}</div>
    <div class="box" class:badb={azureDel || portal}><h4>Azure</h4>{#if azureDel}<span class="small no">(deleted)</span>{:else}<span class="mono small">aks-orders-dev · sku {portal ? 'Free' : 'Standard'}</span>{/if}</div>
  </div>
  <pre class="code">$ terraform plan{'\n'}{plan[0]}</pre>
  <div class="wg-msg">{plan[1]}</div>
</div>

<style>.cols3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } @container (max-width: 520px) { .cols3 { grid-template-columns: 1fr; } }</style>
