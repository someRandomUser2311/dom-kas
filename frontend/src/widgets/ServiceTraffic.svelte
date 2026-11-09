<script>
  let pods = $state([1, 2, 3].map((i) => ({ id: `orders-api-7d9c-${i}`, app: 'orders-api', ip: `10.244.${i}.12`, hits: 0 })));
  let selector = $state('orders-api');
  let last = $state(null);
  let fail = $state(false);
  let rr = 0;
  const endpoints = $derived(pods.filter((p) => p.app === selector));
  function send() {
    if (!endpoints.length) { fail = true; last = null; return; }
    fail = false;
    const p = endpoints[rr++ % endpoints.length];
    p.hits += 1; last = p.id; pods = [...pods];
  }
  $effect(() => { const t = setInterval(send, 900); return () => clearInterval(t); });
  function kill() { if (pods.length) pods = pods.slice(1); setTimeout(() => (pods = [...pods, { id: `orders-api-7d9c-${Math.random().toString(36).slice(2, 5)}`, app: 'orders-api', ip: `10.244.4.${20 + pods.length}`, hits: 0 }]), 2500); }
  function scale() { while (pods.length < 5) pods = [...pods, { id: `orders-api-7d9c-${pods.length + 1}`, app: 'orders-api', ip: `10.244.${pods.length + 1}.12`, hits: 0 }]; }
</script>

<div class="wg">
  <div class="wg-bar">
    <button class="btn small" onclick={kill}>💥 kill a pod</button>
    <button class="btn small" onclick={scale}>scale to 5</button>
    <button class="btn small" onclick={() => (selector = selector === 'orders-api' ? 'orders-apii' : 'orders-api')}>{selector === 'orders-api' ? '🔧 break the selector' : '✅ fix the selector'}</button>
  </div>
  <div class="flowline">
    <span class="hop">client pod</span><span class="arrow">→</span>
    <span class="hop" class:bad={fail} class:on={!fail}>Service orders-api · 10.0.142.17:80<br /><span class="mono small">selector app={selector}</span></span><span class="arrow">→ :8080</span>
    <div class="tiles">{#each pods as p (p.id)}<span class="tile" class:hit={last === p.id} class:dim={p.app !== selector || selector !== 'orders-api'}><b>{p.id}</b>{p.ip} · {p.hits} req</span>{/each}</div>
  </div>
  <div class="wg-msg" class:bad={fail}>Endpoints: {endpoints.length ? endpoints.map((p) => p.ip + ':8080').join(', ') : '<none>'}{fail ? ' — requests fail: connection refused / timeout.' : ''}</div>
</div>
