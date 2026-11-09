<script>
  import { parseYaml } from './lib.js';
  import { stringify, parse } from 'yaml';
  let { text, onsolved } = $props();
  const task = /Success when/i.test(text);
  const BASE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
  labels:
    app: orders-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orders-api
  template:
    metadata:
      labels:
        app: orders-api
    spec:
      containers:
        - name: api
          image: contosoacr.azurecr.io/orders-api:1.4.0
          resources:
            requests: { cpu: 250m, memory: 256Mi }
            limits: { memory: 512Mi }
---
apiVersion: v1
kind: Service
metadata:
  name: orders-api
spec:
  selector:
    app: orders-api
  ports:
    - port: 80
      targetPort: 8080
`;
  let overlay = $state(`# k8s/overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
`);

  const clone = (x) => JSON.parse(JSON.stringify(x));
  function smerge(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (b.every((x) => x && x.name !== undefined) && a.every((x) => x && x.name !== undefined)) {
        const out = a.map(clone);
        for (const item of b) {
          const i = out.findIndex((x) => x.name === item.name);
          if (i >= 0) out[i] = smerge(out[i], item); else out.push(clone(item));
        }
        return out;
      }
      return clone(b);
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const out = clone(a);
      for (const [k, v] of Object.entries(b)) out[k] = k in out ? smerge(out[k], v) : clone(v);
      return out;
    }
    return clone(b);
  }
  function jsonPatch(doc, ops) {
    for (const op of ops) {
      const parts = String(op.path).split('/').slice(1).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
      let cur = doc;
      for (const p of parts.slice(0, -1)) { if (cur[p] === undefined) throw new Error(`path ${op.path} not found`); cur = cur[p]; }
      const last = parts[parts.length - 1];
      if (op.op === 'remove') { if (Array.isArray(cur)) cur.splice(+last, 1); else delete cur[last]; }
      else if (op.op === 'add' && Array.isArray(cur)) { if (last === '-') cur.push(op.value); else cur.splice(+last, 0, op.value); }
      else cur[last] = op.value;
    }
  }
  const render = $derived.by(() => {
    const base = parseYaml(BASE).docs;
    const k = parseYaml(overlay);
    if (k.errors.length) return { error: `kustomization.yaml line ${k.errors[0].line}: ${k.errors[0].message}` };
    const kz = k.docs[0] || {};
    if (!(kz.resources || []).some((r) => String(r).replace(/\/$/, '') === '../../base')) return { error: 'resources must include ../../base' };
    let docs = base.map(clone);
    try {
      for (const d of docs) {
        if (kz.namespace) d.metadata.namespace = kz.namespace;
        if (kz.namePrefix) d.metadata.name = kz.namePrefix + d.metadata.name;
        if (kz.nameSuffix) d.metadata.name = d.metadata.name + kz.nameSuffix;
        if (kz.commonLabels) d.metadata.labels = { ...(d.metadata.labels || {}), ...kz.commonLabels };
      }
      for (const img of kz.images || []) {
        for (const d of docs) for (const c of d.spec?.template?.spec?.containers || []) {
          const repo = c.image.split('@')[0].replace(/:[^:/]+$/, '');
          if (repo === img.name || repo.endsWith('/' + img.name)) c.image = (img.newName || repo) + (img.digest ? '@' + img.digest : ':' + (img.newTag ?? c.image.split(':').pop()));
        }
      }
      for (const r of kz.replicas || []) for (const d of docs) if (d.metadata.name.endsWith(r.name) && d.spec) d.spec.replicas = r.count;
      for (const p of kz.patches || []) {
        const t = p.target || {};
        const patch = typeof p.patch === 'string' ? parse(p.patch) : p.patch;
        const targets = docs.filter((d) => (!t.kind || d.kind === t.kind) && (!t.name || d.metadata.name.endsWith(t.name)));
        if (!patch) throw new Error('empty patch');
        if (Array.isArray(patch)) targets.forEach((d) => jsonPatch(d, patch));
        else {
          const ts = targets.length ? targets : docs.filter((d) => d.kind === patch.kind && d.metadata.name.endsWith(patch.metadata?.name));
          docs = docs.map((d) => (ts.includes(d) ? smerge(d, { ...patch, metadata: { ...(patch.metadata || {}), name: d.metadata.name } }) : d));
        }
      }
    } catch (e) {
      return { error: e.message };
    }
    return { docs };
  });
  const baseLines = new Set(BASE.split('\n').map((l) => l.trim()));
  const out = $derived(render.docs ? render.docs.map((d) => stringify(d)).join('---\n') : '');
  const ok = $derived.by(() => {
    if (!task || !render.docs) return false;
    const dep = render.docs.find((d) => d.kind === 'Deployment');
    return dep?.spec?.replicas === 4 && /:1\.4\.2$/.test(dep.spec.template.spec.containers[0].image) && render.docs.every((d) => d.metadata.namespace === 'orders');
  });
  $effect(() => { if (ok) onsolved(); });
</script>

<div class="wg">
  <div class="three">
    <div><div class="small muted">k8s/base (read-only)</div><pre class="code base">{BASE}</pre></div>
    <div><div class="small muted">overlay (editable)</div><textarea class="mini-editor" rows="20" bind:value={overlay} spellcheck="false"></textarea></div>
    <div><div class="small muted">kustomize build (changed lines highlighted)</div>
      {#if render.error}<div class="wg-msg bad">{render.error}</div>
      {:else}<pre class="code">{#each out.split('\n') as l}<span class:chg={l.trim() && !baseLines.has(l.trim())}>{l}</span>{'\n'}{/each}</pre>{/if}
    </div>
  </div>
  {#if task}<div class="wg-msg" class:ok>{ok ? '✓ replicas 4, image :1.4.2, namespace orders — and the base is untouched.' : 'Target: replicas 4, image tag 1.4.2, namespace orders.'}</div>{/if}
</div>

<style>
  .three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  @container (max-width: 900px) { .three { grid-template-columns: minmax(0, 1fr); } }
  pre.code { font-size: 11.5px; max-height: 420px; }
  .base { opacity: 0.85; }
  .chg { background: rgba(63, 185, 111, 0.25); }
</style>
