<script>
  import CodeBlock from './CodeBlock.svelte';
  import Coming from './Coming.svelte';
  import Widget from './Widget.svelte';
  import Check from './Check.svelte';
  import Lab from './Lab.svelte';
  import { recordCheck } from '../lib/progress.svelte.js';
  import { solvable } from '../widgets/index.js';

  // onresult(checkId, firstTryCorrect) lets the lesson player track checks.
  let { blocks = [], onresult = null, mode = 'lesson' } = $props();

  // A widget that solves its task completes the next custom check in the step.
  let solvedAt = $state({});
  function autoFor(i) {
    for (let j = i - 1; j >= 0; j--) {
      if (blocks[j].type === 'check') return null;
      if (blocks[j].type === 'widget' && solvable(blocks[j].name)) return { done: !!solvedAt[j] };
    }
    return null;
  }

  // The nearest code block above a widget ("starts with the file above").
  function lastCode(i) {
    for (let j = i - 1; j >= 0; j--) if (blocks[j].type === 'code' && !blocks[j].output) return blocks[j].text;
    return '';
  }

  function handle(id) {
    return (r, firstRight, _res, revealed) => {
      recordCheck(id, !!(r?.correct && !revealed));
      onresult?.(id, r, revealed);
    };
  }
</script>

{#each blocks as b, i (i)}
  {@const prevCode = lastCode(i)}
  {#if b.type === 'html'}
    <div class="prose block">{@html b.html}</div>
  {:else if b.type === 'code'}
    <CodeBlock file={b.file} text={b.text} output={b.output} diff={b.diff} />
  {:else if b.type === 'widget'}
    <Widget name={b.name} html={b.html} code={prevCode} task={solvable(b.name) && blocks.slice(i + 1).some((x) => x.type === 'check' && x.check.kind === 'custom')} onsolved={() => (solvedAt[i] = true)} />
  {:else if b.type === 'coming'}
    <Coming set={b.set} items={b.items} />
  {:else if b.type === 'more'}
    <details class="more card flat"><summary><b>Read more</b></summary><div class="prose small">{@html b.html}</div></details>
  {:else if b.type === 'check'}
    <Check check={b.check} {mode} onresult={handle(b.check.id)} linked={autoFor(i)} />
  {:else if b.type === 'lab'}
    <Lab lab={b.lab} />
  {:else if b.type === 'try'}
    <details class="try card flat">
      <summary><span class="chip accent">Try it locally</span> {#if b.lesson}<span class="small muted">Lesson {b.lesson}</span>{/if}</summary>
      <div class="prose small">{@html b.html}</div>
      <p class="small muted">Runs on the free local <code>kind</code> lab from lesson 0.6. Never graded.</p>
    </details>
  {/if}
{/each}

<style>
  .block { margin: 0 0 12px; }
  .more, .try { margin: 12px 0; }
  .more summary, .try summary { display: flex; gap: 8px; align-items: center; }
  .try { border-left: 4px solid var(--accent); }
</style>
