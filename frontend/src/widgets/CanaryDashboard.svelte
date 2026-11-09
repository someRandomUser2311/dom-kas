<script>
  let { text, onsolved } = $props();
  const task = /Success when/i.test(text);
  let scenario = $state(task ? 'bad' : 'healthy');
  let weight = $state(10);
  let series = $state([]);
  let t = $state(0);
  let promoted = $state(false);
  let msg = $state(null);
  let done = false;
  const WINDOW = 25;
  $effect(() => {
    const timer = setInterval(() => {
      if (t > 60) return;
      t += 1;
      const bad = scenario === 'bad';
      const errS = 0.2 + Math.random() * 0.2;
      const errC = weight === 0 ? null : bad ? 7 + Math.random() * 3 : 0.2 + Math.random() * 0.3;
      const latS = 120 + Math.random() * 20;
      const latC = weight === 0 ? null : bad ? 380 + Math.random() * 80 : 125 + Math.random() * 25;
      series = [...series.slice(-59), { errS, errC, latS, latC }];
    }, 400);
    return () => clearInterval(timer);
  });
  function reset() { series = []; t = 0; weight = 10; promoted = false; msg = null; done = false; }
  function promote() {
    weight = Math.min(100, weight < 50 ? 50 : 100);
    if (scenario === 'bad') { promoted = true; msg = ['bad', `You just sent ${weight}% of users to a version with 40× the error rate.`]; }
    else msg = ['ok', weight === 100 ? 'Promoted: the canary is now the stable version.' : 'Healthy so far: promoted to 50%.'];
  }
  function abort() {
    weight = 0;
    if (scenario === 'bad' && !promoted && t <= WINDOW) { msg = ['ok', '✓ Aborted inside the observation window: only 10% of users ever saw the bad version.']; if (task && !done) { done = true; onsolved(); } }
    else if (scenario === 'bad') msg = ['warn', t > WINDOW ? 'Aborted, but after the observation window: users suffered longer than needed.' : 'Aborted — after promoting first.'];
    else msg = ['warn', 'Aborted a healthy canary. Safe, but the release is delayed.'];
  }
  function path(key, max) {
    return series.map((p, i) => (p[key] === null ? null : `${(i / 59) * 300},${80 - Math.min(1, p[key] / max) * 76}`)).filter(Boolean).join(' ');
  }
</script>

<div class="wg">
  <div class="wg-bar">
    {#if !task}<label>Scenario <select bind:value={scenario} onchange={reset}><option value="healthy">healthy canary</option><option value="bad">canary throws 5xx</option></select></label>{/if}
    <span class="small">stable <b>{100 - weight}%</b> · canary <b>{weight}%</b></span>
    <button class="btn small primary" onclick={promote} disabled={weight === 100}>Promote →</button>
    <button class="btn small danger" onclick={abort} disabled={weight === 0}>Abort</button>
    <button class="btn small ghost" onclick={reset}>Restart</button>
    <span class="small muted">t = {t * 10}s {t <= WINDOW ? '· observing' : ''}</span>
  </div>
  <div class="charts">
    <div class="wg-panel"><div class="small">Error rate (%)</div><svg viewBox="0 0 300 80"><polyline points={path('errS', 10)} class="s" /><polyline points={path('errC', 10)} class="c" /></svg></div>
    <div class="wg-panel"><div class="small">p95 latency (ms)</div><svg viewBox="0 0 300 80"><polyline points={path('latS', 500)} class="s" /><polyline points={path('latC', 500)} class="c" /></svg></div>
  </div>
  <div class="small muted"><span class="lg s"></span> stable · <span class="lg c"></span> canary</div>
  {#if msg}<div class="wg-msg {msg[0]}">{msg[1]}</div>{/if}
</div>

<style>
  .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
  svg { width: 100%; height: 90px; }
  polyline { fill: none; stroke-width: 2; }
  .s { stroke: var(--accent); } .c { stroke: var(--warn); }
  .lg { display: inline-block; width: 14px; height: 3px; vertical-align: middle; }
  .lg.s { background: var(--accent); } .lg.c { background: var(--warn); }
</style>
