<script>
  const CPU = 3.8, MEM = 12;
  let cpu = $state(500);
  let mem = $state(512);
  let showUsage = $state(false);
  let nodes = $state([[], [], []]);
  let pending = $state([]);
  let n = 0;
  const used = (pods, k) => pods.reduce((a, p) => a + p[k], 0);
  function add() {
    const p = { id: `pod-${++n}`, cpu: cpu / 1000, mem: mem / 1024, use: 0.25 + Math.random() * 0.35 };
    const i = nodes.findIndex((pods) => used(pods, 'cpu') + p.cpu <= CPU + 1e-9 && used(pods, 'mem') + p.mem <= MEM + 1e-9);
    if (i < 0) { pending = [...pending, p]; return; }
    nodes[i] = [...nodes[i], p];
  }
  function reset() { nodes = [[], [], []]; pending = []; }
  const why = $derived.by(() => {
    if (!pending.length) return '';
    const p = pending[pending.length - 1];
    const c = nodes.filter((pods) => used(pods, 'cpu') + p.cpu > CPU).length;
    const m = nodes.filter((pods) => used(pods, 'mem') + p.mem > MEM).length;
    return `0/3 nodes are available: ${[c && `${c} Insufficient cpu`, m && `${m} Insufficient memory`].filter(Boolean).join(', ')}.`;
  });
</script>

<div class="wg">
  <div class="wg-bar">
    <label>CPU request <select bind:value={cpu}><option value={100}>100m</option><option value={250}>250m</option><option value={500}>500m</option><option value={1000}>1</option><option value={2000}>2</option></select></label>
    <label>Memory request <select bind:value={mem}><option value={256}>256Mi</option><option value={512}>512Mi</option><option value={1024}>1Gi</option><option value={4096}>4Gi</option></select></label>
    <button class="btn small primary" onclick={add}>+ Add pod</button>
    <label><input type="checkbox" bind:checked={showUsage} /> show actual usage</label>
    <button class="btn small ghost" onclick={reset}>Reset</button>
  </div>
  <div class="bars">
    {#each nodes as pods, i}
      {@const c = used(pods, 'cpu')}
      {@const u = pods.reduce((a, p) => a + p.cpu * p.use, 0)}
      <div class="barrow"><span>node-{i + 1} CPU</span><div class="bartrack"><span style="width:{(c / CPU) * 100}%"></span>{#if showUsage}<span style="width:{(u / CPU) * 100}%;background:var(--ok);opacity:.7"></span>{/if}</div><b>{c.toFixed(2)}/{CPU}</b></div>
      <div class="barrow"><span>node-{i + 1} mem</span><div class="bartrack"><span style="width:{(used(pods, 'mem') / MEM) * 100}%;background:var(--warn)"></span></div><b>{used(pods, 'mem').toFixed(1)}/{MEM}Gi</b></div>
    {/each}
  </div>
  {#if pending.length}<div class="wg-msg warn"><b>{pending.length} pod{pending.length > 1 ? 's' : ''} Pending.</b> <span class="mono small">Warning FailedScheduling {why}</span></div>{/if}
  {#if showUsage}<div class="small muted">Green = what the pods actually use. The scheduler only looks at requests (blue), so nodes can be "full" while mostly idle.</div>{/if}
</div>
