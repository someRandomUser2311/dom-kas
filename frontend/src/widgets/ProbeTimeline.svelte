<script>
  let liveness = $state('/health/db');
  let readiness = $state('/healthz');
  let t = $state(0);
  let running = $state(false);
  let rows = $state([]);
  const SLOW = [4, 16]; // DB slow from t=4 to t=16 (2 minutes at 10s per tick)
  function run() {
    t = 0; running = true;
    rows = [0, 1, 2].map(() => ({ restarts: 0, cells: [], downFor: 0 }));
    const timer = setInterval(() => {
      const slow = t >= SLOW[0] && t < SLOW[1];
      rows = rows.map((r) => {
        let state = 'ok';
        if (r.downFor > 0) { r.downFor -= 1; state = 'restart'; }
        else {
          const liveFails = slow && liveness === '/health/db';
          const readyFails = slow && readiness === '/health/db';
          if (liveFails && t % 3 === 2) { r.restarts += 1; r.downFor = 2; state = 'restart'; }
          else if (readyFails || liveFails) state = 'notready';
        }
        r.cells = [...r.cells, state];
        return r;
      });
      t += 1;
      if (t >= 24) { clearInterval(timer); running = false; }
    }, 250);
  }
  const verdict = $derived(rows.length && !running ? (rows.some((r) => r.restarts) ? ['bad', `Liveness on /health/db restarted pods ${rows.reduce((a, r) => a + r.restarts, 0)} times while the database was slow — and restarting didn't fix the database. That's the death spiral.`] : readiness === '/health/db' ? ['ok', 'Pods left rotation while the DB was slow, then came back. No restarts.'] : ['ok', 'Nothing restarted. (Requests during the slowdown were just slow.)']) : null);
</script>

<div class="wg">
  <div class="wg-bar">
    <label>liveness → <select bind:value={liveness} disabled={running}><option>/healthz</option><option>/health/db</option></select></label>
    <label>readiness → <select bind:value={readiness} disabled={running}><option>/healthz</option><option>/health/db</option></select></label>
    <button class="btn small primary" onclick={run} disabled={running}>🐢 DB slow for 2 minutes</button>
  </div>
  <div class="tl">
    <div class="lane"><span class="lbl">DB latency</span>{#each Array(24) as _, i}<span class="c {i >= SLOW[0] && i < SLOW[1] ? 'slow' : 'ok'}" class:past={i < t}></span>{/each}</div>
    {#each rows as r, i}
      <div class="lane"><span class="lbl">pod {i + 1} · {r.restarts} restarts</span>{#each Array(24) as _, j}<span class="c {r.cells[j] || 'none'}"></span>{/each}</div>
    {/each}
  </div>
  <div class="small muted">Green = Ready · amber = Running but not Ready (no traffic) · red = restarting · each cell is 10 s.</div>
  {#if verdict}<div class="wg-msg {verdict[0]}">{verdict[1]}</div>{/if}
</div>

<style>
  .tl { display: grid; gap: 4px; }
  .lane { display: flex; align-items: center; gap: 2px; }
  .lbl { width: 140px; flex: none; font-size: 0.78rem; }
  .c { flex: 1; height: 16px; border-radius: 3px; background: var(--surface); border: 1px solid var(--border); }
  .c.ok { background: var(--ok-soft); } .c.slow { background: var(--warn); }
  .c.notready { background: var(--warn); } .c.restart { background: var(--bad); } .c.none { background: var(--surface); }
  .lane:first-child .c.ok { opacity: 0.5; } .lane:first-child .c.past { opacity: 1; }
</style>
