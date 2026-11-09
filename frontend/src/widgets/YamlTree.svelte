<script>
  import { parseYaml, modeOf } from './lib.js';
  import TreeNode from './TreeNode.svelte';
  let { text, code, onsolved } = $props();

  const mode = modeOf(text, { broken: /broken file/i, containers: /containers as a list/i }, 'live');
  const BROKEN = "apiVersion: v1\nkind: Pod\nmetadata:\n\tname: web\nspec:\n  containers:\n    - name:web\n      image: nginx:1.27\n      name: sidecar\n      image: busybox:1.36\n";
  const POD = 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: orders-api\n  labels:\n    app: orders-api\nspec:\n  containers:\n    - name: api\n      image: contosoacr.azurecr.io/orders-api:1.4.2\n    - name: log-agent\n      image: fluent/fluent-bit:3.1\n';
  let src = $state(mode === 'broken' ? BROKEN : code && /:\s/.test(code) ? code : POD);
  const res = $derived(parseYaml(src));
  const lines = $derived(src.split('\n'));
  const doc = $derived(res.docs[0]);
  const ok = $derived.by(() => {
    if (mode !== 'broken' || res.errors.length || !doc) return false;
    const c = doc?.spec?.containers;
    return Array.isArray(c) && c.length === 2 && c.every((x) => x && typeof x === 'object' && !Array.isArray(x) && x.name && x.image);
  });
  $effect(() => { if (ok) onsolved(); });
</script>

<div class="two-col">
  <div>
    <div class="small muted">YAML (editable)</div>
    <textarea class="mini-editor" rows={Math.max(10, lines.length + 1)} bind:value={src} spellcheck="false"></textarea>
    {#each res.errors as e}<div class="err-line">line {e.line}: {e.message}</div>{/each}
  </div>
  <div class="wg-panel">
    <div class="small muted">Parsed structure</div>
    {#if res.errors.length}<p class="small no">Fix the errors to see the tree.</p>
    {:else if doc !== undefined}<TreeNode v={doc} />
    {:else}<p class="small muted">Empty document.</p>{/if}
  </div>
</div>
{#if mode === 'broken'}
  <div class="wg-msg" class:ok>{ok ? '✓ It parses, and spec.containers is a list of two maps.' : 'Fix the tab, the missing space after a colon and the missing list dash.'}</div>
{/if}
