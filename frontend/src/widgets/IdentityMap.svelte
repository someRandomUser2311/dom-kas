<script>
  const ACTIONS = [
    ['Create a public IP', 'cluster', 'Network Contributor on the node resource group / VNet', 'The control plane (cloud-controller-manager) creates load-balancer IPs.'],
    ['Attach a disk', 'cluster', 'Contributor on the node resource group', 'The CSI driver acts as the cluster identity to create and attach managed disks.'],
    ['Pull an image from ACR', 'kubelet', 'AcrPull on contosoacr', 'The kubelet on each node pulls images — so the kubelet identity needs AcrPull.'],
    ['orders-api reads a Key Vault secret', 'workload', 'Key Vault Secrets User on kv-orders-prod', 'The pod exchanges its ServiceAccount token for id-orders-api (workload identity).'],
    ['A developer runs kubectl', 'user', 'Azure Kubernetes Service RBAC Reader/Writer (Entra ID)', 'Humans authenticate with their own Entra ID account; Azure RBAC decides what they can do.'],
  ];
  let a = $state(null);
  const who = $derived(a === null ? null : ACTIONS[a][1]);
</script>

<div class="wg">
  <div class="wg-bar">{#each ACTIONS as x, i}<button class="btn small" class:primary={a === i} onclick={() => (a = i)}>{x[0]}</button>{/each}</div>
  <div class="boxes">
    <div class="box" class:on={who === 'cluster'}><h4>Control plane · 🪪 cluster identity</h4><span class="small muted">managed identity of the cluster</span></div>
    <div class="nodes">
      {#each [1, 2] as n}
        <div class="box" class:on={who === 'kubelet'}><h4>Node {n} · 🪪 kubelet identity</h4>
          <div class="tiles"><span class="tile" class:hit={who === 'workload' && n === 1}><b>orders-api</b>{n === 1 ? '🪪 id-orders-api' : 'web'}</span></div></div>
      {/each}
    </div>
    <div class="box" class:on={who === 'user'}><h4>👩‍💻 Developer laptop · Entra ID user</h4></div>
  </div>
  {#if a !== null}<div class="wg-msg"><b>Needs:</b> {ACTIONS[a][2]}<br />{ACTIONS[a][3]}</div>{/if}
</div>

<style>.nodes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }</style>
