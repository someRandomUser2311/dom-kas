<script>
  // Rolling update simulator: maxSurge / maxUnavailable, readiness, crashes.
  let { text, onsolved } = $props();
  const advanced = /minReadySeconds|replicas \(1|replicas=4/i.test(text);
  const task = /Success when/i.test(text);
  let replicas = $state(advanced ? 4 : 3);
  let surge = $state(1);
  let unavail = $state(advanced ? 1 : 0);
  let failReady = $state(false);
  let crash = $state(false);
  let pods = $state([]);
  let t = $state(0);
  let running = $state(false);
  let minAvail = $state(Infinity);
  let maxTotal = $state(0);
  let log = $state([]);
  let timer;

  function reset() {
    clearInterval(timer);
    running = false;
    t = 0;
    pods = Array.from({ length: replicas }, (_, i) => ({ id: `old-${i}`, v: 'old', st: 'ready', age: 99 }));
    minAvail = replicas;
    maxTotal = replicas;
    log = [];
  }
  $effect(() => { replicas; reset(); });

  function stepOnce() {
    t += 1;
    for (const p of pods) {
      p.age += 1;
      if (p.st === 'creating' && p.age >= 2) p.st = failReady && p.v === 'new' ? 'notready' : 'ready';
      if (p.st === 'ready' && crash && p.v === 'new' && p.age >= 6) { p.st = 'crash'; }
      if (p.st === 'term' && p.age >= 1) p.st = 'gone';
    }
    pods = pods.filter((p) => p.st !== 'gone');
    const avail = () => pods.filter((p) => p.st === 'ready').length;
    const total = () => pods.filter((p) => p.st !== 'term').length;
    const live = () => pods.filter((p) => p.st !== 'term');
    const minAvailable = replicas - unavail;
    // 1. remove old pods while availability stays at or above the minimum
    for (;;) {
      const old = pods.filter((p) => p.v === 'old' && p.st === 'ready');
      if (!old.length || avail() - 1 < minAvailable) break;
      const p = old[old.length - 1]; p.st = 'term'; p.age = 0;
      log = [`t=${t}: old pod ${p.id} → Terminating`, ...log];
    }
    // 2. add new pods while the total stays within replicas + maxSurge
    for (;;) {
      const newLive = pods.filter((p) => p.v === 'new' && p.st !== 'term' && p.st !== 'crash').length;
      if (newLive >= replicas || live().length >= replicas + surge) break;
      const p = { id: `new-${t}-${newLive}`, v: 'new', st: 'creating', age: 0 };
      pods.push(p); log = [`t=${t}: new pod ${p.id} → ContainerCreating`, ...log];
    }
    pods = [...pods];
    minAvail = Math.min(minAvail, avail());
    maxTotal = Math.max(maxTotal, pods.filter((p) => p.st !== 'gone' && p.st !== 'term').length);
    const done = pods.every((p) => p.v === 'new' && p.st === 'ready') && pods.length === replicas;
    if (done || t > 40) {
      clearInterval(timer); running = false;
      log = [done ? `t=${t}: rollout complete` : `t=${t}: rollout stalled (ProgressDeadlineExceeded) — old pods keep serving`, ...log];
      if (done && task && replicas === 4 && surge === 1 && unavail === 0 && minAvail >= 4 && maxTotal <= 5) onsolved();
    }
  }
  function start() { reset(); running = true; timer = setInterval(stepOnce, 700); }
  const label = (p) => ({ ready: 'Ready', creating: 'ContainerCreating', notready: 'Running 0/1', crash: 'CrashLoopBackOff', term: 'Terminating' })[p.st];
  const cls = (p) => ({ ready: 'ready', creating: 'starting', notready: 'pending', crash: 'term', term: 'term' })[p.st];
</script>

<div class="wg">
  <div class="wg-bar">
    {#if advanced}<label>replicas <input type="range" min="1" max="10" bind:value={replicas} disabled={running} /> {replicas}</label>{/if}
    <label>maxSurge <input type="range" min="0" max="5" bind:value={surge} disabled={running} /> {surge}</label>
    <label>maxUnavailable <input type="range" min="0" max="5" bind:value={unavail} disabled={running} /> {unavail}</label>
    {#if advanced}
      <label><input type="checkbox" bind:checked={failReady} disabled={running} /> new version fails readiness</label>
      <label><input type="checkbox" bind:checked={crash} disabled={running} /> crashes after a while</label>
    {/if}
  </div>
  {#if surge === 0 && unavail === 0}<div class="wg-msg bad">maxSurge and maxUnavailable can’t both be 0: the rollout could never make progress.</div>{/if}
  <div class="two-col">
    <div class="wg-panel"><div class="kicker">Old ReplicaSet · 1.4.2</div><div class="tiles">{#each pods.filter((p) => p.v === 'old') as p (p.id)}<span class="tile {cls(p)}"><b>{p.id}</b>{label(p)}</span>{/each}</div></div>
    <div class="wg-panel"><div class="kicker">New ReplicaSet · 1.5.0</div><div class="tiles">{#each pods.filter((p) => p.v === 'new') as p (p.id)}<span class="tile {cls(p)}"><b>{p.id}</b>{label(p)}</span>{/each}</div></div>
  </div>
  <div class="wg-bar small">
    <span>available now <b>{pods.filter((p) => p.st === 'ready').length}</b> (min allowed {replicas - unavail})</span>
    <span>· lowest so far <b class={minAvail < replicas - unavail ? 'no' : 'yes'}>{minAvail === Infinity ? '-' : minAvail}</b></span>
    <span>· most pods at once <b>{maxTotal}</b> (max {replicas + surge})</span>
    <button class="btn small primary" onclick={start} disabled={running || (surge === 0 && unavail === 0)}>▶ Change image to 1.5.0</button>
    <button class="btn small ghost" onclick={reset}>Reset</button>
  </div>
  <div class="wg-log">{#each log.slice(0, 6) as l}<div>{l}</div>{/each}</div>
</div>
