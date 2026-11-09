<script>
  import { modeOf } from './lib.js';
  let { text, onsolved } = $props();
  const task = /Success when/i.test(text);
  let seq = 0;
  const name = () => `orders-api-7d9c-${(Math.random().toString(36) + '00000').slice(2, 7)}`;
  let replicas = $state(3);
  let image = $state('1.4.2');
  let pods = $state([0, 1, 2].map((i) => ({ id: name(), node: (i % 3) + 1, image: '1.4.2', st: 'ready' })));
  let nodes = $state({ 1: true, 2: true, 3: true });
  let log = $state([]);
  let pulse = $state(false);
  let deleted = $state(false);
  let solved = false;

  function say(s) { log = [s, ...log].slice(0, 8); }
  function loop() {
    pulse = !pulse;
    pods = pods.filter((p) => nodes[p.node] && p.st !== 'gone');
    const live = pods.filter((p) => p.st !== 'term');
    const wrongImg = live.filter((p) => p.image !== image);
    if (wrongImg.length) {
      const p = wrongImg[0];
      p.st = 'term';
      const n = [1, 2, 3].filter((x) => nodes[x])[0];
      pods.push({ id: name(), node: n, image, st: 'starting' });
      say(`observed image ${p.image}, want ${image} → replace ${p.id}`);
    } else if (live.length < replicas) {
      const up = [1, 2, 3].filter((x) => nodes[x]);
      if (!up.length) { say('observed 0 nodes → pods stay Pending'); return; }
      const n = up[live.length % up.length];
      pods.push({ id: name(), node: n, image, st: 'starting' });
      say(`observed ${live.length}, want ${replicas} → create 1 pod`);
    } else if (live.length > replicas) {
      live[live.length - 1].st = 'term';
      say(`observed ${live.length}, want ${replicas} → delete 1 pod`);
    } else {
      if (!log[0]?.includes("nothing to do")) say(`observed ${live.length}, want ${replicas} → nothing to do`);
    }
    for (const p of pods) {
      if (p.st === 'starting') p.st = 'ready0';
      else if (p.st === 'ready0') p.st = 'ready';
      else if (p.st === 'term') p.st = 'gone';
    }
    pods = [...pods];
    const ready = pods.filter((p) => p.st === 'ready').length;
    if (task && deleted && ready === 3 && replicas === 3 && !solved) { solved = true; onsolved(); }
  }
  $effect(() => { const t = setInterval(loop, 1100); return () => clearInterval(t); });

  function del(p) { p.st = 'term'; pods = [...pods]; deleted = true; say(`you deleted ${p.id}`); }
  function killNode(n) { nodes[n] = !nodes[n]; say(nodes[n] ? `node-${n} is back` : `node-${n} died: its pods are gone`); }
  const st = (p) => (p.st === 'ready' ? 'ready' : p.st === 'term' || p.st === 'gone' ? 'term' : 'starting');
</script>

<div class="wg">
  <div class="two-col">
    <div class="wg-panel">
      <div class="kicker">Desired (spec)</div>
      <label class="small">replicas: <b>{replicas}</b> <input type="range" min="0" max="6" bind:value={replicas} /></label>
      <label class="small">image: <select bind:value={image}><option>1.4.2</option><option>1.5.0</option></select></label>
      <div class="ring" class:pulse>observe → compare → act</div>
    </div>
    <div class="wg-panel">
      <div class="kicker">Actual (click a pod to delete it)</div>
      {#each [1, 2, 3] as n}
        <div class="nrow"><button class="btn small ghost" onclick={() => killNode(n)}>{nodes[n] ? '💥' : '♻️'} node-{n}</button>
          <div class="tiles">{#each pods.filter((p) => p.node === n) as p (p.id)}<button class="tile {st(p)}" onclick={() => del(p)} title="delete"><b>{p.id.slice(-11)}</b>{p.image} · {st(p) === 'ready' ? 'Running' : st(p) === 'term' ? 'Terminating' : 'Creating'}</button>{/each}</div></div>
      {/each}
    </div>
  </div>
  <div class="wg-log">{#each log as l}<div>{l}</div>{/each}</div>
</div>

<style>
  .ring { margin-top: 12px; text-align: center; padding: 14px 6px; border: 3px solid var(--accent); border-radius: 999px; font-size: 0.78rem; color: var(--accent); transition: transform 0.4s; }
  .ring.pulse { transform: scale(1.04); }
  .nrow { display: flex; gap: 6px; align-items: flex-start; margin: 4px 0; }
  .nrow .btn { flex: none; width: 92px; }
  button.tile { cursor: pointer; color: var(--text); text-align: left; }
  label { display: block; margin: 6px 0; }
</style>
