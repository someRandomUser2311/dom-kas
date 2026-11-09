<script>
  import { modeOf } from './lib.js';
  let { text, onsolved } = $props();
  const mode = modeOf(text, { plan: /Planning mode/i, ip: /IP-planning|plugin \(Overlay/i }, 'calc');

  const ipToInt = (ip) => {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null;
    return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
  };
  const intToIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
  function calc(c) {
    const m = (c || '').trim().match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);
    if (!m) return null;
    const ip = ipToInt(m[1]);
    const bits = Number(m[2]);
    if (ip === null || bits > 32) return null;
    const size = 2 ** (32 - bits);
    const net = Math.floor(ip / size) * size;
    return { net, last: net + size - 1, size, bits, aligned: net === ip };
  }
  const overlaps = (a, b) => a && b && !(a.last < b.net || b.last < a.net);

  // calculator
  let cidr = $state('10.20.0.0/22');
  let other = $state('10.20.2.0/24');
  const a = $derived(calc(cidr));
  const b = $derived(calc(other));
  const span = $derived(a && b ? { lo: Math.min(a.net, b.net), hi: Math.max(a.last, b.last) } : null);
  const pct = (x) => (span ? ((x - span.lo) / (span.hi - span.lo + 1)) * 100 : 0);

  // planning
  let vnet = $state('10.20.0.0/16');
  let rows = $state([
    { name: 'nodes', need: 500, cidr: '', usable: true },
    { name: 'ingress', need: 200, cidr: '', usable: true },
    { name: 'private-links', need: 20, cidr: '', usable: true },
    { name: 'Service CIDR', need: 1000, cidr: '', usable: false, outside: true },
  ]);
  const V = $derived(calc(vnet));
  const checks = $derived(rows.map((r, i) => {
    const c = calc(r.cidr);
    if (!c) return { ok: false, msg: 'enter a CIDR' };
    const size = r.usable ? c.size - 5 : c.size;
    if (size < r.need) return { ok: false, msg: `too small: ${size} < ${r.need}` };
    if (r.outside && overlaps(c, V)) return { ok: false, msg: 'overlaps the VNet' };
    if (!r.outside && V && !(c.net >= V.net && c.last <= V.last)) return { ok: false, msg: 'outside the VNet' };
    const clash = rows.findIndex((o, j) => j !== i && overlaps(c, calc(o.cidr)));
    if (clash >= 0) return { ok: false, msg: `overlaps ${rows[clash].name}` };
    return { ok: true, msg: `${size.toLocaleString()} ${r.usable ? 'usable' : 'addresses'}` };
  }));
  const planOk = $derived(mode === 'plan' && checks.every((c) => c.ok));
  $effect(() => { if (planOk) onsolved(); });

  // IP planning for CNI
  let plugin = $state('overlay');
  let nodes = $state(10);
  let surge = $state(1);
  let maxPods = $state(30);
  let subnet = $state('10.20.0.0/24');
  const S = $derived(calc(subnet));
  const need = $derived(plugin === 'overlay' ? nodes + surge : (nodes + surge) * (1 + maxPods));
  const avail = $derived(S ? S.size - 5 : 0);
</script>

<div class="wg">
  {#if mode === 'calc'}
    <div class="wg-bar">
      <label>CIDR <input class="mono" bind:value={cidr} /></label>
      <label>Compare with <input class="mono" bind:value={other} /></label>
    </div>
    {#if a}
      <table class="small"><tbody>
        <tr><th>Network</th><td class="mono">{intToIp(a.net)}/{a.bits}{#if !a.aligned} <span class="chip warn">not aligned: that address isn't the network start</span>{/if}</td></tr>
        <tr><th>First – last</th><td class="mono">{intToIp(a.net)} – {intToIp(a.last)}</td></tr>
        <tr><th>Addresses</th><td>{a.size.toLocaleString()} total · {Math.max(0, a.size - 5).toLocaleString()} usable in an Azure subnet (5 reserved)</td></tr>
      </tbody></table>
      {#if b && span}
        <div class="small">{other}: {#if overlaps(a, b)}<span class="chip bad">overlaps</span>{:else}<span class="chip ok">no overlap</span>{/if}</div>
        <div class="bartrack big">
          <span style="left:{pct(a.net)}%;width:{pct(a.last + 1) - pct(a.net)}%;opacity:.55"></span>
          <span style="left:{pct(b.net)}%;width:{pct(b.last + 1) - pct(b.net)}%;background:var(--warn);opacity:.55"></span>
          {#if overlaps(a, b)}<span style="left:{pct(Math.max(a.net, b.net))}%;width:{pct(Math.min(a.last, b.last) + 1) - pct(Math.max(a.net, b.net))}%;background:var(--bad)"></span>{/if}
        </div>
        <div class="small muted mono">{intToIp(span.lo)} … {intToIp(span.hi)} · blue = {cidr}, amber = {other}, red = shared</div>
      {/if}
    {:else}<p class="small muted">Enter a CIDR such as 10.20.0.0/22.</p>{/if}
  {:else if mode === 'plan'}
    <div class="wg-bar"><label>VNet <input class="mono" bind:value={vnet} /></label>{#if V}<span class="small muted">{V.size.toLocaleString()} addresses</span>{/if}</div>
    <table class="small"><thead><tr><th>Range</th><th>Needs</th><th>CIDR</th><th>Result</th></tr></thead><tbody>
      {#each rows as r, i}
        <tr><td>{r.name}</td><td>≥ {r.need.toLocaleString()}{r.outside ? ', outside the VNet' : ''}</td>
          <td><input class="mono" bind:value={rows[i].cidr} placeholder="e.g. 10.20.0.0/22" /></td>
          <td class={checks[i].ok ? 'yes' : 'no'}>{checks[i].ok ? '✓' : '✗'} <span class="small">{checks[i].msg}</span></td></tr>
      {/each}
    </tbody></table>
    <div class="wg-msg" class:ok={planOk}>{planOk ? '✓ Every range fits, inside the VNet (Service CIDR outside), with no overlaps.' : 'Fill every row so each range is big enough and nothing overlaps.'}</div>
  {:else}
    <div class="wg-bar">
      <span class="seg"><button class:on={plugin === 'overlay'} onclick={() => (plugin = 'overlay')}>Azure CNI Overlay</button><button class:on={plugin === 'vnet'} onclick={() => (plugin = 'vnet')}>VNet-routed (pod IPs from the subnet)</button></span>
    </div>
    <div class="wg-bar">
      <label>Nodes <input type="number" min="1" max="1000" bind:value={nodes} /></label>
      <label>Max surge <input type="number" min="0" max="50" bind:value={surge} /></label>
      <label>Max pods/node <input type="number" min="10" max="250" bind:value={maxPods} /></label>
      <label>Node subnet <input class="mono" bind:value={subnet} /></label>
    </div>
    <div class="bars"><div class="barrow"><span>Needed</span><div class="bartrack"><span style="width:{Math.min(100, (need / Math.max(avail, 1)) * 100)}%;background:{need > avail ? 'var(--bad)' : 'var(--ok)'}"></span></div><b>{need.toLocaleString()}</b></div>
      <div class="barrow"><span>Available</span><div class="bartrack"><span style="width:100%;opacity:.4"></span></div><b>{avail.toLocaleString()}</b></div></div>
    <div class="small muted">{plugin === 'overlay' ? 'Overlay: only nodes (+ surge) take subnet IPs; pods use the private pod CIDR.' : 'VNet-routed: every node takes 1 + max pods addresses from the subnet.'}</div>
    {#if need > avail}<div class="wg-msg bad">Exhausted. An upgrade or scale-out fails with <code>SubnetIsFull</code>: the subnet doesn't have enough free addresses.</div>
    {:else}<div class="wg-msg ok">Fits, with {(avail - need).toLocaleString()} addresses to spare.</div>{/if}
  {/if}
</div>

<style>
  .big { height: 22px; }
  td input { padding: 4px 6px; font-size: 0.82rem; }
</style>
