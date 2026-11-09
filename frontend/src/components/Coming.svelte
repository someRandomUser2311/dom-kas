<script>
  // "Coming from" persona tabs. The learner's persona (settings) picks the
  // default tab; any tab can be opened.
  import { progress, save } from '../lib/progress.svelte.js';
  import { PERSONA_SETS } from '../lib/util.js';
  let { set = 'A', items = [] } = $props();

  const label = PERSONA_SETS[set]?.label || 'Background';
  // "Developer (Compose)" in content = "Developer (Docker Compose)" in settings
  const norm = (s = '') => s.replace(/\s*\(.*\)\s*/, '').trim().toLowerCase();
  const preferred = $derived(norm(progress.persona[set]));
  let picked = $state(null);
  const active = $derived(picked ?? Math.max(0, items.findIndex((i) => norm(i.persona) === preferred)));
  const hidden = $derived(progress.persona[set] === 'None');

  function choose(i) {
    picked = i;
    const opt = PERSONA_SETS[set]?.options.find((o) => norm(o) === norm(items[i].persona));
    if (opt) {
      progress.persona[set] = opt;
      save();
    }
  }
</script>

{#if !hidden && items.length}
  <aside class="coming card flat">
    <div class="kicker">Coming from · {label}</div>
    <div class="tabs" role="tablist">
      {#each items as it, i}
        <button role="tab" class="tab" class:active={i === active} aria-selected={i === active} onclick={() => choose(i)}>{it.persona}</button>
      {/each}
    </div>
    <div class="prose small" class:careful={/^\s*(<b>)?Careful/i.test(items[active]?.html || '')}>{@html items[active]?.html}</div>
  </aside>
{/if}

<style>
  .coming { margin: 12px 0; background: var(--surface-2); }
  .tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 6px 0 10px; }
  .tab { border: 1px solid var(--border); background: var(--surface); color: var(--muted); border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 0.8rem; cursor: pointer; }
  .tab.active { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
  .careful { border-left: 3px solid var(--warn); padding-left: 10px; }
</style>
