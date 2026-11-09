<script>
  import Check from './Check.svelte';
  import { recordPredict } from '../lib/progress.svelte.js';
  let { checks = [], ch, best = null } = $props();
  let results = $state({});
  let run = $state(0);
  const answered = $derived(Object.keys(results).length);
  const score = $derived(checks.length ? Math.round((Object.values(results).filter(Boolean).length / checks.length) * 100) : 0);
  function onresult(id) {
    return (r) => {
      results[id] = !!r.correct;
      if (Object.keys(results).length === checks.length) recordPredict(ch, score);
    };
  }
  function again() { results = {}; run += 1; }
</script>

<div class="predict">
  <p class="small muted">Read each scenario and predict what happens. One attempt each; the explanation follows.{#if best !== null} Best so far: <b>{best}%</b>.{/if}</p>
  {#key run}
    {#each checks as c, n (c.id)}
      <Check check={c} mode="quiz" number={n + 1} onresult={onresult(c.id)} />
    {/each}
  {/key}
  {#if answered === checks.length && checks.length}
    <div class="callout" class:ok={score >= 70} class:warn={score < 70}>
      <b>{score}%</b> on this predict set. <button class="btn small" onclick={again}>Try again</button>
    </div>
  {/if}
</div>
