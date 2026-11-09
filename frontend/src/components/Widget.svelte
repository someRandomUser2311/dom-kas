<script>
  // Dispatches a content widget to its interactive component (src/widgets).
  // Widgets without a component show their description as a guided panel.
  import { registry, staticWidget } from '../widgets/index.js';
  import { stripTags } from '../lib/util.js';

  let { name, html = '', task = false, onsolved = null, code = '', context = '' } = $props();

  const entry = registry[name];
  const isStatic = staticWidget(name);
  const text = stripTags(html);
  const title = name.replace(/^l\d+-step\d+$/, 'interactive').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  let solved = $state(false);

  function solve() {
    if (solved) return;
    solved = true;
    onsolved?.();
  }
</script>

{#if isStatic}
  <div class="widget static prose">{@html html}</div>
{:else}
  <div class="widget card flat" class:solved>
    <div class="row between whead">
      <span class="kicker">🧩 {title}</span>
      {#if solved}<span class="chip ok">✓ Done</span>{:else if task && entry}<span class="chip accent">Task</span>{:else if !entry}<span class="chip">guided</span>{/if}
    </div>
    {#if entry}
      {@const C = entry}
      <C {name} {text} {html} {code} {context} {task} onsolved={solve} />
      {#if task && text && !/^l\d+-step/.test(name)}<details class="desc small"><summary class="muted">What counts as done</summary><div class="prose">{@html html}</div></details>{/if}
    {:else}
      <div class="prose small">{@html html}</div>
      {#if task}<p class="small muted">Work it through on paper or in the local lab, then mark it done or compare with the solution.</p>{/if}
    {/if}
  </div>
{/if}

<style>
  .widget { margin: 12px 0; background: var(--surface-2); }
  .widget.solved { border-color: var(--ok); }
  .whead { margin-bottom: 8px; }
  .desc { margin-top: 10px; }
  .static { margin: 12px 0; }
  .static :global(table) { display: table; }
</style>
