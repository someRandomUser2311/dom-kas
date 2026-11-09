<script>
  import { evalApi } from './lib.js';
  let { onsolved } = $props();
  const CASES = [
    ['patch deployments -n orders', true],
    ['patch deployments -n payments', false],
    ['delete deployments -n orders', false],
    ['get secrets -n orders', false],
    ['create clusterroles', false],
  ];
  let yaml = $state(`# ServiceAccount ci/deployer currently has far too much
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: deployer
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: deployer
subjects:
  - kind: ServiceAccount
    name: deployer
    namespace: ci
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: deployer
`);
  let res = $state(null);
  let timer;
  $effect(() => {
    const y = yaml;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      res = await evalApi({ kind: 'rbac', yaml: y, subject: { kind: 'ServiceAccount', name: 'deployer', namespace: 'ci' }, cases: CASES.map((c) => c[0]) }).catch((e) => ({ error: e.message }));
    }, 350);
  });
  const ok = $derived(res?.results?.every((r, i) => r.allow === CASES[i][1]));
  $effect(() => { if (ok) onsolved(); });
</script>

<div class="wg">
  <div class="two-col">
    <textarea class="mini-editor" rows="22" bind:value={yaml} spellcheck="false"></textarea>
    <div>
      <div class="small muted">kubectl auth can-i … --as=system:serviceaccount:ci:deployer</div>
      {#if res?.error}<div class="err-line">{res.error}</div>{/if}
      <table class="small"><thead><tr><th>Action</th><th>Want</th><th>Got</th><th>Granted by</th></tr></thead><tbody>
        {#each CASES as [c, want], i}
          {@const r = res?.results?.[i]}
          <tr><td class="mono">{c}</td><td>{want ? 'allow' : 'deny'}</td><td class={r ? (r.allow === want ? 'yes' : 'no') : ''}>{r ? (r.allow ? 'yes' : 'no') : '…'}</td><td class="small muted">{r?.why || ''}</td></tr>
        {/each}
      </tbody></table>
      {#if res?.wildcard}<div class="wg-msg warn">A rule uses <code>*</code>. Wildcards grant everything, including resources added in future versions.</div>{/if}
      {#if ok}<div class="wg-msg ok">✓ Every case matches: a namespaced Role with exactly what deploys need.</div>{/if}
    </div>
  </div>
</div>
