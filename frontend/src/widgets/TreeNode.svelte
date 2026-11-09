<script>
  import TreeNode from './TreeNode.svelte';
  let { k = null, v, depth = 0 } = $props();
  const type = (x) => (x === null ? 'null' : Array.isArray(x) ? 'list' : typeof x === 'object' ? 'map' : typeof x);
  const t = $derived(type(v));
</script>

<div class="tn" style="--d:{depth}">
  {#if t === 'map'}
    {#if k !== null}<span class="k">{k}</span> <span class="ty">map</span>{/if}
    <div class="kids map">{#each Object.entries(v) as [ck, cv]}<TreeNode k={ck} v={cv} depth={depth + 1} />{/each}</div>
  {:else if t === 'list'}
    {#if k !== null}<span class="k">{k}</span> <span class="ty">list · {v.length}</span>{/if}
    <div class="kids list">{#each v as item, i}<TreeNode k={`[${i}]`} v={item} depth={depth + 1} />{/each}</div>
  {:else}
    <span class="k">{k}</span>: <span class="val {t}">{t === 'string' ? `"${v}"` : String(v)}</span> <span class="ty">{t}</span>
  {/if}
</div>

<style>
  .tn { font: 12.5px/1.6 var(--mono); }
  .kids { margin-left: 14px; padding-left: 10px; border-left: 2px solid var(--border); }
  .kids.list { border-left-color: var(--warn); }
  .kids.map { border-left-color: var(--accent); }
  .k { font-weight: 700; }
  .ty { color: var(--muted); font-size: 10.5px; border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; }
  .val.string { color: var(--ok); } .val.number { color: var(--accent); } .val.boolean { color: var(--warn); } .val.null { color: var(--muted); }
</style>
