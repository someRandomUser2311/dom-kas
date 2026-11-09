<script>
  let { text } = $props();
  const withNodes = /node strip|cluster autoscaler/i.test(text);
  let rps = $state(200);
  let noRequests = $state(false);
  const MIN = 2, MAX = 10, TARGET = 70, PER_POD = 100; // 100 rps ≈ 70% CPU of a 250m request
  let replicas = $state(2);
  let nodes = $state(2);
  let nodeTimer = $state(0);
  let downDelay = $state(0);
  const cpu = $derived(Math.round(((rps / replicas) / PER_POD) * 70));
  const desired = $derived(noRequests ? replicas : Math.min(MAX, Math.max(MIN, Math.ceil(replicas * (cpu / TARGET)))));
  const PODS_PER_NODE = 3;
  const schedulable = $derived(nodes * PODS_PER_NODE);
  $effect(() => {
    const t = setInterval(() => {
      if (noRequests) return;
      if (desired > replicas) replicas += 1;
      else if (desired < replicas) { if (downDelay <= 0) { replicas -= 1; downDelay = 3; } else downDelay -= 1; }
      if (withNodes) {
        if (replicas > schedulable) { if (nodeTimer === 0) nodeTimer = 4; else if (--nodeTimer === 0) nodes += 1; }
        else if (nodes > 2 && replicas <= (nodes - 1) * PODS_PER_NODE) nodes -= 1;
      }
    }, 900);
    return () => clearInterval(t);
  });
</script>

<div class="wg">
  <div class="wg-bar">
    <label>Load <input type="range" min="20" max="1200" step="20" bind:value={rps} /> <b>{rps} rps</b></label>
    <label><input type="checkbox" bind:checked={noRequests} /> remove CPU requests</label>
  </div>
  <div class="wg-msg mono small">
    {#if noRequests}TARGETS &lt;unknown&gt;/70% — without a CPU request there's no percentage to compute, so the HPA does nothing.
    {:else}desired = ceil({replicas} × {cpu}% / {TARGET}%) = {Math.ceil(replicas * (cpu / TARGET))} → clamped to [{MIN}, {MAX}] = <b>{desired}</b>{/if}
  </div>
  <div class="tiles">
    {#each Array(replicas) as _, i}<span class="tile" class:ready={!withNodes || i < schedulable} class:pending={withNodes && i >= schedulable}><b>pod {i + 1}</b>{withNodes && i >= schedulable ? 'Pending' : `${Math.min(cpu, 999)}% CPU`}</span>{/each}
  </div>
  {#if withNodes}
    <div class="tiles">{#each Array(nodes) as _, i}<span class="tile ready"><b>node {i + 1}</b>{PODS_PER_NODE} pods max</span>{/each}{#if nodeTimer}<span class="tile starting"><b>node {nodes + 1}</b>provisioning… {nodeTimer * 45}s</span>{/if}</div>
    <div class="small muted">Pending pods trigger the cluster autoscaler; a new node takes a few minutes. Scale-down waits {downDelay ? `(${downDelay * 30}s left)` : 'for the stabilisation window'}.</div>
  {/if}
</div>
