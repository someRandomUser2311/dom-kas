<script>
  import { modeOf } from './lib.js';
  let { text, onsolved } = $props();
  const mode = modeOf(text, { weights: /weights slider/i, gateway: /Gateway and two HTTPRoutes/i, task: /Success when/i }, 'ingress');

  let rules = $state([
    { path: '/', type: 'Prefix', svc: 'web' },
    { path: '/api', type: 'ImplementationSpecific', svc: 'orders-api' },
  ]);
  let url = $state('https://shop.contoso.example/api/orders/42');

  function matches(r, p) {
    if (r.type === 'Exact') return p === r.path;
    if (r.type === 'Prefix') {
      if (r.path === '/') return true;
      const base = r.path.replace(/\/$/, '');
      return p === base || p.startsWith(base + '/');
    }
    return p.startsWith(r.path); // ImplementationSpecific: plain string prefix (ingress-nginx style)
  }
  function route(p, list) {
    const hits = list.map((r, i) => ({ r, i })).filter(({ r }) => matches(r, p));
    if (!hits.length) return null;
    hits.sort((a, b) => (b.r.type === 'Exact') - (a.r.type === 'Exact') || b.r.path.length - a.r.path.length);
    return hits[0];
  }
  const path = $derived.by(() => { try { return new URL(url).pathname; } catch { return url.startsWith('/') ? url : '/'; } });
  const hit = $derived(route(path, rules));

  const TESTS = [['/', 'web'], ['/products/7', 'web'], ['/api', 'orders-api'], ['/api/orders/42', 'orders-api'], ['/apiary', 'web']];
  const results = $derived(TESTS.map(([p, want]) => ({ p, want, got: route(p, rules)?.r.svc || '404' })));
  const allOk = $derived(results.every((r) => r.got === r.want));
  $effect(() => { if (mode === 'task' && allOk) onsolved(); });

  // gateway mode
  let webLabel = $state(true);
  const gwRoutes = $derived([
    { ns: 'orders', name: 'orders-api', path: '/api', svc: 'orders-api', accepted: true },
    { ns: 'web', name: 'web', path: '/', svc: 'web', accepted: webLabel },
  ]);
  const gwHit = $derived.by(() => {
    const live = gwRoutes.filter((r) => r.accepted).map((r) => ({ ...r, type: 'Prefix' }));
    return route(path, live);
  });

  // weights
  let weight = $state(10);
  let split = $state(null);
  function send() { let c = 0; for (let k = 0; k < 100; k++) if (Math.random() * 100 < weight) c++; split = c; }
</script>

<div class="wg">
  {#if mode === 'weights'}
    <div class="wg-bar"><label>canary weight <input type="range" min="0" max="100" bind:value={weight} /> stable {100 - weight} / canary {weight}</label><button class="btn small primary" onclick={send}>Send 100 requests</button></div>
    <pre class="code">backendRefs:
  - name: orders-api-stable
    port: 80
    weight: {100 - weight}
  - name: orders-api-canary
    port: 80
    weight: {weight}</pre>
    {#if split !== null}<div class="bartrack big"><span style="left:0;width:{100 - split}%;background:var(--accent)"></span><span style="left:{100 - split}%;width:{split}%;background:var(--warn)"></span></div><div class="small">stable {100 - split} · canary {split}</div>{/if}
  {:else}
    <label class="small">URL <input class="mono" bind:value={url} /></label>
    {#if mode === 'gateway'}
      <label class="small"><input type="checkbox" bind:checked={webLabel} /> namespace web has the label shop-routes: allowed</label>
      <table class="small"><thead><tr><th>HTTPRoute</th><th>Match</th><th>Backend</th><th>Status</th></tr></thead><tbody>
        {#each gwRoutes as r}<tr class:sel={gwHit?.r.name === r.name}><td class="mono">{r.ns}/{r.name}</td><td class="mono">PathPrefix {r.path}</td><td class="mono">{r.svc}:80</td><td>{#if r.accepted}<span class="chip ok">Accepted</span>{:else}<span class="chip bad">NotAllowedByListeners</span>{/if}</td></tr>{/each}
      </tbody></table>
      <div class="wg-msg">{gwHit ? `→ ${gwHit.r.ns}/${gwHit.r.name} → Service ${gwHit.r.svc}:80 → pod` : '404: no route attached for this path'}</div>
    {:else}
      <table class="small"><thead><tr><th>path</th><th>pathType</th><th>backend</th><th></th></tr></thead><tbody>
        {#each rules as r, k}
          <tr class:sel={hit?.i === k}>
            <td><input class="mono" bind:value={rules[k].path} /></td>
            <td><select bind:value={rules[k].type}><option>Prefix</option><option>Exact</option><option>ImplementationSpecific</option></select></td>
            <td><select bind:value={rules[k].svc}><option>web</option><option>orders-api</option></select></td>
            <td><button class="btn ghost small" onclick={() => (rules = rules.filter((_, j) => j !== k))}>✕</button></td>
          </tr>
        {/each}
      </tbody></table>
      <button class="btn small" onclick={() => (rules = [...rules, { path: '/new', type: 'Prefix', svc: 'web' }])}>+ rule</button>
      <div class="wg-msg">{hit ? `${path} → rule “${hit.r.path}” (${hit.r.type}) → Service ${hit.r.svc} → pod` : `${path} → default backend: 404`}</div>
      {#if mode === 'task'}
        <table class="small"><tbody>{#each results as r}<tr><td class="mono">{r.p}</td><td>want {r.want}</td><td class={r.got === r.want ? 'yes' : 'no'}>{r.got}</td></tr>{/each}</tbody></table>
        {#if allOk}<div class="wg-msg ok">✓ Every test URL routes correctly — /apiary no longer leaks to orders-api.</div>{/if}
      {/if}
    {/if}
  {/if}
</div>

<style>
  tr.sel td { background: var(--accent-soft); }
  td input, td select { padding: 3px 6px; font-size: 0.82rem; }
  .big { height: 22px; }
  label { display: grid; gap: 4px; }
</style>
