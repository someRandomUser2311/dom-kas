<script>
  const TEMPLATE = ['vnet-orders-dev', 'aks-orders-dev', 'kv-orders-dev', 'log-orders-dev'];
  let inTemplate = $state(Object.fromEntries(TEMPLATE.map((r) => [r, true])));
  let mode = $state('incremental');
  let unmanage = $state('detach');
  let rg = $state([...TEMPLATE.map((n) => ({ n, managed: true, st: 'ok' })), { n: 'stdebugtemp (created by hand)', managed: false, st: 'ok' }]);
  let msg = $state('');
  function deploy() {
    const keep = TEMPLATE.filter((r) => inTemplate[r]);
    let next = rg.filter((r) => r.st !== 'deleted').map((r) => ({ ...r }));
    for (const n of keep) { const e = next.find((r) => r.n === n); if (e) { e.st = 'ok'; e.managed = true; } else next.push({ n, managed: true, st: 'ok' }); }
    const removed = next.filter((r) => !keep.includes(r.n));
    if (mode === 'incremental') { removed.forEach((r) => { if (TEMPLATE.includes(r.n)) r.st = 'left'; }); msg = 'Incremental: resources missing from the template are left alone — they still run (and cost money).'; }
    else if (mode === 'complete') { removed.forEach((r) => (r.st = 'deleted')); msg = 'Complete: everything in the resource group that isn’t in the template is deleted — including the hand-made storage account.'; }
    else {
      removed.forEach((r) => { if (r.managed) r.st = unmanage === 'delete' ? 'deleted' : 'detached'; });
      msg = unmanage === 'delete' ? 'Stack with actionOnUnmanage deleteResources: only resources the stack managed are deleted. The hand-made one is untouched.' : 'Stack with detach: removed resources stay but are no longer managed by the stack.';
    }
    rg = next;
  }
  const label = { ok: 'deployed', left: 'still there (not in template)', deleted: 'deleted', detached: 'detached / unmanaged' };
</script>

<div class="wg">
  <div class="two-col">
    <div class="wg-panel small"><div class="kicker">Template</div>{#each TEMPLATE as r}<label class="cb"><input type="checkbox" bind:checked={inTemplate[r]} /> {r}</label>{/each}</div>
    <div class="wg-panel small"><div class="kicker">rg-orders-dev</div>
      {#each rg as r}<div class="res {r.st}">{r.n} <span class="chip" class:ok={r.st === 'ok'} class:warn={r.st === 'left' || r.st === 'detached'} class:bad={r.st === 'deleted'}>{label[r.st]}</span></div>{/each}</div>
  </div>
  <div class="wg-bar">
    <span class="seg">{#each [['incremental', 'Incremental'], ['complete', 'Complete'], ['stack', 'Deployment stack']] as [k, l]}<button class:on={mode === k} onclick={() => (mode = k)}>{l}</button>{/each}</span>
    {#if mode === 'stack'}<label>actionOnUnmanage <select bind:value={unmanage}><option value="detach">detachAll</option><option value="delete">deleteResources</option></select></label>{/if}
    <button class="btn small primary" onclick={deploy}>Deploy</button>
  </div>
  {#if msg}<div class="wg-msg">{msg}</div>{/if}
</div>

<style>
  .cb { display: flex; gap: 6px; margin: 4px 0; }
  .res { padding: 3px 0; display: flex; justify-content: space-between; gap: 6px; }
  .res.deleted { text-decoration: line-through; opacity: 0.6; }
  .res.detached { opacity: 0.7; }
</style>
