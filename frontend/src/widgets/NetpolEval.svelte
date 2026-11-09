<script>
  import { evalApi, modeOf } from './lib.js';
  let { text, onsolved } = $props();
  const mode = modeOf(text, { deny: /every cell to and from orders-api/i, allow: /web\/web → orders\/orders-api:8080/i }, 'view');
  const fixture = {
    pods: [
      { name: 'web', ns: 'web', labels: { app: 'web' }, ports: [8080] },
      { name: 'debug', ns: 'web', labels: {}, ports: [] },
      { name: 'orders-api', ns: 'orders', labels: { app: 'orders-api' }, ports: [8080, 9090] },
      { name: 'orders-worker', ns: 'orders', labels: { app: 'orders-worker' }, ports: [] },
      { name: 'postgres', ns: 'db', labels: { app: 'postgres' }, ports: [5432] },
      { name: 'kube-dns', ns: 'kube-system', labels: { 'k8s-app': 'kube-dns' }, ports: [53] },
    ],
  };
  const DENY = 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny\n  namespace: orders\nspec:\n  podSelector: {}\n  policyTypes: [Ingress, Egress]\n';
  const ALLOW_START = DENY + '---\n# allow web → orders-api on 8080 (and keep DNS working)\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-web-to-api\n  namespace: orders\nspec:\n  podSelector:\n    matchLabels:\n      app: orders-api\n  policyTypes: [Ingress]\n  ingress: []\n';
  let yaml = $state(mode === 'allow' ? ALLOW_START : mode === 'deny' ? '# write a default-deny policy for namespace orders\n' : '# add NetworkPolicies here and watch the matrix\n');
  let port = $state(8080);
  let res = $state(null);
  let timer;
  $effect(() => {
    const y = yaml;
    clearTimeout(timer);
    timer = setTimeout(async () => { res = await evalApi({ kind: 'netpol', yaml: y, fixture }).catch((e) => ({ error: e.message })); }, 350);
  });
  const SRC = fixture.pods.filter((p) => p.name !== 'kube-dns');
  const DST = ['web', 'orders-api', 'postgres'];
  const flow = (f, t, p) => res?.flows?.find((x) => x.from === f && x.to === t && x.port === p);
  const dstPort = (d) => (d === 'orders-api' ? port : fixture.pods.find((p) => p.name === d).ports[0]);
  const cell = (f, t) => (f === t ? null : flow(f, t, dstPort(t)));
  const dnsCell = (f) => flow(f, 'kube-dns', 53);

  const solved = $derived.by(() => {
    if (!res?.flows || mode === 'view') return false;
    const ok = (f, t, p) => !!flow(f, t, p)?.allowed;
    if (mode === 'deny') {
      const touch = ['orders-api', 'orders-worker'];
      const intoApi = ['web', 'debug', 'orders-worker', 'postgres'].every((s) => !ok(s, 'orders-api', 8080));
      const outOf = touch.every((s) => !ok(s, 'web', 8080) && !ok(s, 'postgres', 5432) && !ok(s, 'kube-dns', 53));
      const untouched = ok('web', 'postgres', 5432) && ok('postgres', 'web', 8080);
      return intoApi && outOf && untouched;
    }
    return ok('web', 'orders-api', 8080) && !ok('debug', 'orders-api', 8080) && !ok('orders-worker', 'orders-api', 8080) && !ok('postgres', 'orders-api', 8080) && !ok('web', 'orders-api', 9090);
  });
  $effect(() => { if (solved) onsolved(); });
</script>

<div class="wg">
  <div class="two-col">
    <div>
      <textarea class="mini-editor" rows="16" bind:value={yaml} spellcheck="false"></textarea>
      {#if res?.error}<div class="err-line">{res.error}</div>{/if}
    </div>
    <div>
      <div class="wg-bar"><label>orders-api port <span class="seg"><button class:on={port === 8080} onclick={() => (port = 8080)}>8080</button><button class:on={port === 9090} onclick={() => (port = 9090)}>9090</button></span></label></div>
      <table class="matrix small">
        <thead><tr><th>from ↓ to →</th>{#each DST as d}<th>{d}:{dstPort(d)}</th>{/each}<th>DNS</th></tr></thead>
        <tbody>
          {#each SRC as s}
            <tr><th class="mono">{s.ns}/{s.name}</th>
              {#each DST as d}{@const c = cell(s.name, d)}<td class={c ? (c.allowed ? 'yes' : 'no') : 'muted'} title={c && !c.allowed ? (c.egress ? 'blocked by ingress' : c.ingress ? 'blocked by egress' : 'blocked both ways') : ''}>{c ? (c.allowed ? '✓' : '✗') : '—'}</td>{/each}
              <td class={dnsCell(s.name) ? (dnsCell(s.name).allowed ? 'yes' : 'no') : ''}>{dnsCell(s.name) ? (dnsCell(s.name).allowed ? '✓' : '✗') : '…'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="small muted">{res?.policies ?? 0} policies · hover a ✗ to see which side blocks it.</div>
    </div>
  </div>
  {#if mode !== 'view'}<div class="wg-msg" class:ok={solved}>{solved ? '✓ The matrix matches the goal.' : 'Edit the policies until the matrix matches the goal.'}</div>{/if}
</div>

<style>
  .matrix td { text-align: center; }
  .matrix th { font-size: 0.75rem; }
</style>
