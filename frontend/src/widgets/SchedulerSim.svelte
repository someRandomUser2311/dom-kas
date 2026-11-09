<script>
  import { parseYaml, selects } from './lib.js';
  let { text, onsolved } = $props();
  const task = /Success when/i.test(text);
  const nodes = [
    { name: 'node-1', labels: { 'topology.kubernetes.io/zone': 'zone-1' }, taints: [] },
    { name: 'node-2', labels: { 'topology.kubernetes.io/zone': 'zone-2' }, taints: [] },
    { name: 'node-3', labels: { 'topology.kubernetes.io/zone': 'zone-3' }, taints: [] },
    { name: 'gpu-1', labels: { 'topology.kubernetes.io/zone': 'zone-1', gpu: 'true' }, taints: [{ key: 'gpu', value: 'true', effect: 'NoSchedule' }] },
  ];
  let spec = $state('# pod spec for train-model\nnodeSelector: {}\ntolerations: []\naffinity: {}\n');
  let result = $state(null);

  function tolerates(tols = [], taint) {
    return tols.some((t) => (t.operator === 'Exists' ? (!t.key || t.key === taint.key) : t.key === taint.key && String(t.value) === taint.value) && (!t.effect || t.effect === taint.effect));
  }
  function affinityOk(aff, labels) {
    const terms = aff?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms;
    if (!terms || !terms.length) return true;
    return terms.some((t) => selects({ matchExpressions: t.matchExpressions || [] }, labels));
  }
  function schedule() {
    const r = parseYaml(spec);
    if (r.errors.length) { result = { error: `line ${r.errors[0].line}: ${r.errors[0].message}` }; return; }
    const s = r.docs[0] || {};
    const rows = nodes.map((n) => {
      for (const [k, v] of Object.entries(s.nodeSelector || {})) if (n.labels[k] !== String(v)) return { n, ok: false, why: `nodeSelector ${k}=${v} doesn't match` };
      if (!affinityOk(s.affinity, n.labels)) return { n, ok: false, why: "didn't match node affinity" };
      const bad = n.taints.find((t) => !tolerates(s.tolerations || [], t));
      if (bad) return { n, ok: false, why: `untolerated taint {${bad.key}: ${bad.value}}` };
      return { n, ok: true, why: 'fits' };
    });
    const fit = rows.filter((x) => x.ok);
    const landed = fit.length ? fit[fit.length === 4 ? 1 : 0].n.name : null;
    const tolGpu = (s.tolerations || []).length && tolerates(s.tolerations, nodes[3].taints[0]);
    const pinned = fit.length === 1 && landed === 'gpu-1';
    let msg = landed ? `Scheduled onto ${landed}.` : `Pending: 0/4 nodes are available: ${rows.map((x) => x.why).filter((x, i, a) => a.indexOf(x) === i).join(', ')}.`;
    let tone = landed ? '' : 'warn';
    if (task) {
      if (pinned && tolGpu) { tone = 'ok'; msg = '✓ It lands on gpu-1, and no other node is eligible.'; }
      else if (tolGpu && landed !== 'gpu-1') msg = `It landed on ${landed}. A toleration lets it in; it doesn't pull it there.`;
      else if (!landed && rows[3].why.startsWith('untolerated')) msg = "Pending: gpu-1 has a taint the pod doesn't tolerate.";
    }
    result = { rows, landed, msg, tone };
    if (tone === 'ok') onsolved();
  }
</script>

<div class="wg">
  <div class="two-col">
    <div>
      <textarea class="mini-editor" rows="12" bind:value={spec} spellcheck="false"></textarea>
      <button class="btn small primary" onclick={schedule}>Schedule</button>
    </div>
    <div class="boxes">
      {#each nodes as n, i}
        {@const r = result?.rows?.[i]}
        <div class="box" class:okb={r?.ok} class:badb={r && !r.ok} class:on={result?.landed === n.name}>
          <h4>{n.name} {#if r}<span class={r.ok ? 'yes' : 'no'}>{r.ok ? '✓' : '✗'}</span>{/if} {#if result?.landed === n.name}<span class="chip ok">train-model</span>{/if}</h4>
          <div class="tiles small">{#each Object.entries(n.labels) as [k, v]}<span class="chip">{k.replace('topology.kubernetes.io/', '')}={v}</span>{/each}{#each n.taints as t}<span class="chip bad">taint {t.key}={t.value}:{t.effect}</span>{/each}</div>
          {#if r && !r.ok}<div class="small no">{r.why}</div>{/if}
        </div>
      {/each}
    </div>
  </div>
  {#if result?.error}<div class="wg-msg bad">{result.error}</div>{:else if result}<div class="wg-msg {result.tone}">{result.msg}</div>{/if}
</div>
