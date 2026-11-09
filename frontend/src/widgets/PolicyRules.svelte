<script>
  import { evalApi, parseYaml, modeOf } from './lib.js';
  let { text, onsolved } = $props();
  const mode = modeOf(text, { pss: /restricted rule/i, registry: /six sample pods/i }, 'baseline');

  // ---- Pod Security restricted (server-side) ----
  let pod = $state(`apiVersion: v1
kind: Pod
metadata:
  name: orders-api
  namespace: orders
spec:
  containers:
    - name: api
      image: contosoacr.azurecr.io/orders-api:1.4.2
      securityContext:
        runAsUser: 0
        capabilities:
          add: ["NET_ADMIN"]
`);
  let pss = $state(null);
  let timer;
  $effect(() => {
    if (mode !== 'pss') return;
    const y = pod;
    clearTimeout(timer);
    timer = setTimeout(async () => { pss = await evalApi({ kind: 'pss', yaml: y }).catch((e) => ({ error: e.message })); }, 350);
  });
  const pssOk = $derived(mode === 'pss' && pss?.rules?.length > 1 && pss.rules.every((r) => r.pass));

  // ---- registry policy (Kyverno-style) ----
  let policy = $state(`apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: allowed-registries
spec:
  validationFailureAction: Enforce
  rules:
    - name: contoso-registry-only
      match:
        any:
          - resources:
              kinds: [Pod]
      validate:
        message: "Images must come from contosoacr.azurecr.io"
        pattern:
          spec:
            containers:
              - image: "contosoacr.azurecr.io*"
`);
  const PODS = [
    { name: 'orders-api from contosoacr', ns: 'orders', spec: { containers: [{ image: 'contosoacr.azurecr.io/orders-api:1.4.2' }] }, want: 'admit' },
    { name: 'nginx from docker.io', ns: 'web', spec: { containers: [{ image: 'docker.io/library/nginx:1.27' }] }, want: 'deny' },
    { name: 'init container from quay.io', ns: 'orders', spec: { initContainers: [{ image: 'quay.io/acme/migrate:2.1' }], containers: [{ image: 'contosoacr.azurecr.io/orders-api:1.4.2' }] }, want: 'deny' },
    { name: 'contosoacr.azurecr.io.evil.com/x', ns: 'orders', spec: { containers: [{ image: 'contosoacr.azurecr.io.evil.com/x:1' }] }, want: 'deny' },
    { name: 'a pod in kube-system', ns: 'kube-system', spec: { containers: [{ image: 'mcr.microsoft.com/oss/kubernetes/coredns:v1.11' }] }, want: 'excluded' },
    { name: 'ephemeral debug container from contosoacr', ns: 'orders', spec: { containers: [{ image: 'contosoacr.azurecr.io/orders-api:1.4.2' }], ephemeralContainers: [{ image: 'contosoacr.azurecr.io/debug:1.0' }] }, want: 'admit' },
  ];
  const glob = (pat, s) => new RegExp('^' + pat.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(s);
  const regResults = $derived.by(() => {
    if (mode !== 'registry') return null;
    const p = parseYaml(policy);
    if (p.errors.length) return { error: `line ${p.errors[0].line}: ${p.errors[0].message}` };
    const rules = p.docs[0]?.spec?.rules || [];
    return {
      rows: PODS.map((pd) => {
        for (const r of rules) {
          const ex = (r.exclude?.any || r.exclude?.all || []).flatMap((x) => x.resources?.namespaces || []);
          if (ex.includes(pd.ns)) return { ...pd, got: 'excluded', msg: `excluded by ${r.name}` };
          const spec = r.validate?.pattern?.spec || {};
          for (const [key, list] of Object.entries(spec)) {
            const field = key.replace(/^=\((\w+)\)$/, '$1');
            const pats = (list || []).map((c) => c.image).filter(Boolean);
            for (const c of pd.spec[field] || []) if (!pats.some((pt) => glob(pt, c.image))) return { ...pd, got: 'deny', msg: `${r.validate.message || 'denied'} (${field}: ${c.image})` };
          }
        }
        return { ...pd, got: 'admit', msg: 'admitted' };
      }),
    };
  });
  const regOk = $derived(mode === 'registry' && regResults?.rows?.every((r) => r.got === r.want));

  // ---- baseline bundle ----
  const BUNDLE = [
    `apiVersion: apps/v1\nkind: Deployment\nmetadata: { name: orders-api, namespace: orders }\nspec:\n  template:\n    spec:\n      containers:\n        - name: api\n          image: contosoacr.azurecr.io/orders-api@sha256:4f7a…\n          resources: { limits: { memory: 512Mi } }`,
    `apiVersion: apps/v1\nkind: Deployment\nmetadata: { name: web, namespace: web }\nspec:\n  template:\n    spec:\n      containers:\n        - name: web\n          image: contosoacr.azurecr.io/web:latest\n          resources: { limits: { memory: 256Mi } }`,
    `apiVersion: apps/v1\nkind: Deployment\nmetadata: { name: worker, namespace: orders }\nspec:\n  template:\n    spec:\n      containers:\n        - name: worker\n          image: contosoacr.azurecr.io/orders-worker:2.0.1`,
    `apiVersion: v1\nkind: Pod\nmetadata: { name: debug, namespace: orders }\nspec:\n  containers:\n    - name: shell\n      image: docker.io/library/busybox:1.36\n      resources: { limits: { memory: 64Mi } }`,
    `apiVersion: apps/v1\nkind: DaemonSet\nmetadata: { name: node-tool, namespace: orders }\nspec:\n  template:\n    spec:\n      containers:\n        - name: tool\n          image: contosoacr.azurecr.io/node-tool:1.0.0\n          securityContext: { privileged: true }\n          resources: { limits: { memory: 128Mi } }`,
    `apiVersion: apps/v1\nkind: Deployment\nmetadata: { name: payments, namespace: orders }\nspec:\n  template:\n    spec:\n      containers:\n        - name: api\n          image: contosoacr.azurecr.io/payments:3.2.0\n          resources: { limits: { memory: 256Mi } }`,
  ];
  let bundle = $state([...BUNDLE]);
  function baseline(y) {
    const p = parseYaml(y);
    if (p.errors.length) return ['error', [`line ${p.errors[0].line}: ${p.errors[0].message}`]];
    const d = p.docs[0];
    const cs = (d.kind === 'Pod' ? d.spec?.containers : d.spec?.template?.spec?.containers) || [];
    const msgs = [];
    for (const c of cs) {
      if (!String(c.image).startsWith('contosoacr.azurecr.io/')) msgs.push(`allowed-registries: ${c.image} isn't from contosoacr.azurecr.io/`);
      if (/:latest$/.test(c.image) || !/[:@]/.test(c.image.split('/').pop())) msgs.push(`no-latest: ${c.name} uses latest or no tag`);
      if (!c.resources?.limits?.memory) msgs.push(`require-limits: ${c.name} has no memory limit`);
      if (c.securityContext?.privileged) msgs.push(`no-privileged: ${c.name} is privileged`);
      if (d.metadata?.namespace === 'orders' && !String(c.image).includes('@sha256:')) msgs.push(`verify-signatures (prod): ${c.name} isn’t deployed by a signed digest`);
    }
    return [msgs.length ? 'deny' : 'admit', msgs];
  }

  $effect(() => { if (pssOk || regOk) onsolved(); });
</script>

<div class="wg">
  {#if mode === 'pss'}
    <div class="two-col">
      <textarea class="mini-editor" rows="20" bind:value={pod} spellcheck="false"></textarea>
      <div class="wg-panel small">
        <div class="kicker">Pod Security · restricted</div>
        {#if pss?.error}<div class="err-line">{pss.error}</div>{/if}
        {#each pss?.rules || [] as r}<div class="rule"><span class={r.pass ? 'yes' : 'no'}>{r.pass ? '✓' : '✗'}</span> {r.rule}{#if !r.pass && r.detail}<span class="muted"> — {r.detail}</span>{/if}</div>{/each}
        {#if pssOk}<div class="wg-msg ok">✓ Admitted under restricted.</div>{/if}
      </div>
    </div>
  {:else if mode === 'registry'}
    <div class="two-col">
      <textarea class="mini-editor" rows="24" bind:value={policy} spellcheck="false"></textarea>
      <div>
        {#if regResults?.error}<div class="err-line">{regResults.error}</div>{/if}
        <table class="small"><thead><tr><th>Pod</th><th>Want</th><th>Got</th></tr></thead><tbody>
          {#each regResults?.rows || [] as r}<tr title={r.msg}><td>{r.name}</td><td>{r.want}</td><td class={r.got === r.want ? 'yes' : 'no'}>{r.got}</td></tr>{/each}
        </tbody></table>
        {#if regOk}<div class="wg-msg ok">✓ Every expectation matches.</div>{:else}<div class="small muted">Hints: init and ephemeral containers are separate lists; a trailing * matches more than you think; system namespaces need excluding.</div>{/if}
      </div>
    </div>
  {:else}
    <div class="small muted">Contoso baseline: allowed registries, no latest, memory limits, no privileged, signed digests in prod. Edit a manifest to re-evaluate.</div>
    <div class="grid2">
      {#each bundle as m, i}
        {@const [v, msgs] = baseline(m)}
        <div class="box" class:okb={v === 'admit'} class:badb={v !== 'admit'}>
          <div class="row between"><b class="small">manifest {i + 1}</b><span class="chip" class:ok={v === 'admit'} class:bad={v !== 'admit'}>{v}</span></div>
          <textarea class="mini-editor small-ed" rows="8" bind:value={bundle[i]} spellcheck="false"></textarea>
          {#each msgs as x}<div class="err-line">{x}</div>{/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .rule { margin: 4px 0; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
  .small-ed { min-height: 120px; font-size: 11px; }
</style>
