<script>
  let { text, onsolved } = $props();
  const task = /Success when/i.test(text);
  const PLACES = {
    hosted: ['Microsoft-hosted agent (internet)', 'internet'],
    laptopOff: ['Laptop, VPN off', 'internet'],
    laptopOn: ['Laptop on VPN (into the hub)', 'hub'],
    mdp: ['Managed DevOps Pool in the AKS VNet', 'spoke'],
    peered: ['Self-hosted agent in the peered "agents" VNet', 'agents'],
  };
  let place = $state('hosted');
  let linked = $state({ spoke: true, agents: false, hub: true });
  let forwarder = $state(false);
  const net = $derived(PLACES[place][1]);
  const dns = $derived(net === 'internet' ? false : net === 'agents' ? linked.agents || forwarder : net === 'hub' ? linked.hub || forwarder : linked.spoke);
  const tcp = $derived(net !== 'internet');
  const msg = $derived(
    net === 'internet' ? (place === 'hosted' ? 'No route to a private IP. A Microsoft-hosted agent can’t reach a private API server.' : 'No route: off the VPN, your laptop is just on the internet.')
    : !dns ? 'dial tcp: lookup aks-orders-prod-xxxx.privatelink.westeurope.azmk8s.io: no such host — link the private DNS zone to this VNet, or forward to the hub resolver.'
    : '✓ The name resolves to the private endpoint (10.20.5.4) and TCP 443 connects.'
  );
  const ok = $derived(dns && tcp && (place === 'mdp' || place === 'peered'));
  $effect(() => { if (task && ok) onsolved(); });
</script>

<div class="wg">
  <div class="wg-bar"><label>Client <select bind:value={place}>{#each Object.entries(PLACES) as [k, v]}<option value={k}>{v[0]}</option>{/each}</select></label></div>
  <div class="wg-bar">
    <label><input type="checkbox" bind:checked={linked.agents} /> private DNS zone linked to the agents VNet</label>
    <label><input type="checkbox" bind:checked={forwarder} /> custom DNS forwarder → hub DNS resolver</label>
  </div>
  <div class="map">
    <div class="box" class:on={net === 'internet'}><h4>🌍 Internet</h4><span class="small muted">Microsoft-hosted agents, laptops off VPN</span></div>
    <div class="box" class:on={net === 'hub'}><h4>Hub VNet</h4><span class="small">DNS resolver · Azure Firewall · VPN gateway</span></div>
    <div class="box" class:on={net === 'spoke'}><h4>Spoke VNet (AKS)</h4><span class="small">private endpoint 10.20.5.4 → API server · zone linked ✓</span></div>
    <div class="box" class:on={net === 'agents'}><h4>Agents VNet (peered)</h4><span class="small">self-hosted agents · zone link {linked.agents ? '✓' : '✗'}</span></div>
  </div>
  <div class="wg-bar lights"><span class="chip" class:ok={dns} class:bad={!dns}>DNS resolves {dns ? '✓' : '✗'}</span><span class="chip" class:ok={tcp && dns} class:bad={!(tcp && dns)}>TCP 443 connects {tcp && dns ? '✓' : '✗'}</span></div>
  <div class="wg-msg" class:ok={dns && tcp} class:bad={!(dns && tcp)}>{msg}{#if task && dns && tcp && !ok} (That works for you, but the pipeline needs an agent here.){/if}</div>
</div>

<style>.map { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }</style>
