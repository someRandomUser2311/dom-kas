<script>
  import { parseYaml, selects, selectsCli } from './lib.js';
  let { text, onsolved } = $props();
  const task = /Success when/i.test(text);
  const pods = [
    { name: 'orders-api-7d9c-a', labels: { app: 'orders-api', tier: 'api', env: 'prod' } },
    { name: 'orders-api-7d9c-b', labels: { app: 'orders-api', tier: 'api', env: 'prod' } },
    { name: 'orders-api-5b6f-c', labels: { app: 'orders-api', tier: 'api', env: 'dev' } },
    { name: 'web-6c4d-a', labels: { app: 'web', tier: 'frontend', env: 'prod' } },
    { name: 'web-6c4d-b', labels: { app: 'web', tier: 'frontend', env: 'prod' } },
    { name: 'web-8f2a-c', labels: { app: 'web', tier: 'frontend', env: 'dev' } },
    { name: 'orders-worker-1x2y', labels: { app: 'orders-worker', tier: 'worker', env: 'prod' } },
    { name: 'order-api-legacy', labels: { app: 'order-api', tier: 'api', env: 'prod' } },
  ];
  let syntax = $state('cli');
  let cli = $state('app=orders-api');
  let yaml = $state('matchLabels:\n  app: orders-api\n');
  const parsed = $derived(syntax === 'yaml' ? parseYaml(yaml) : null);
  const hits = $derived(pods.map((p) => {
    if (syntax === 'cli') return selectsCli(cli, p.labels);
    const sel = parsed?.docs[0];
    if (!sel || parsed.errors.length || typeof sel !== 'object') return false;
    return selects(sel, p.labels);
  }));
  const count = $derived(hits.filter(Boolean).length);
  const hint = $derived.by(() => {
    if (!task) return null;
    const want = [0, 1];
    const got = hits.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
    if (got.length === 2 && got[0] === 0 && got[1] === 1) return ['ok', '✓ Exactly the two prod orders-api pods.'];
    if (want.every((i) => hits[i]) && hits[2]) return ['warn', 'Narrow it to prod.'];
    if (hits[3] || hits[4]) return ['warn', 'Every listed label must match: add app.'];
    return ['', 'Select only the orders-api pods running in prod.'];
  });
  $effect(() => { if (hint?.[0] === 'ok') onsolved(); });
</script>

<div class="wg">
  <div class="wg-bar">
    <span class="seg"><button class:on={syntax === 'cli'} onclick={() => (syntax = 'cli')}>-l syntax</button><button class:on={syntax === 'yaml'} onclick={() => (syntax = 'yaml')}>YAML selector</button></span>
    <span class="chip accent">selected: {count}</span>
  </div>
  {#if syntax === 'cli'}
    <label class="small mono">kubectl get pods -l <input class="mono" bind:value={cli} /></label>
  {:else}
    <textarea class="mini-editor" rows="6" bind:value={yaml} spellcheck="false"></textarea>
    {#each parsed?.errors || [] as e}<div class="err-line">line {e.line}: {e.message}</div>{/each}
  {/if}
  <div class="grid4">
    {#each pods as p, i}
      <div class="tile" class:hit={hits[i]} class:dim={!hits[i]}><b>{p.name}</b>{#each Object.entries(p.labels) as [k, v]}<span class="lb">{k}={v}</span>{/each}</div>
    {/each}
  </div>
  {#if hint}<div class="wg-msg {hint[0]}">{hint[1]}</div>{/if}
</div>

<style>
  .grid4 { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
  .lb { display: block; color: var(--muted); }
  label { display: flex; gap: 6px; align-items: center; }
</style>
