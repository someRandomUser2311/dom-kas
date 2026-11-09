<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { progress, save, applyTheme, resetAll, sync } from '../lib/progress.svelte.js';
  import { PERSONA_SETS } from '../lib/util.js';

  let { course } = $props();
  let attempts = $state([]);
  onMount(async () => { attempts = await api.attempts().catch(() => []); });

  function changed() { applyTheme(); save(); }
  async function reset() {
    if (confirm('Reset all progress? This clears lessons, quizzes, labs and the exam for this learner.')) await resetAll();
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify($state.snapshot(progress), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kq-progress.json';
    a.click();
  }
</script>

<div class="container narrow">
  <h1>Settings</h1>
  <div class="card stack">
    <label>Display name <input bind:value={progress.name} onchange={changed} placeholder="optional" /></label>
    {#each ['A', 'B', 'C'] as set}
      <label>“Coming from” tabs · {PERSONA_SETS[set].label}
        <select bind:value={progress.persona[set]} onchange={changed}>
          {#each [...PERSONA_SETS[set].options, 'None'] as o}<option value={o}>{o === 'None' ? 'None (hide these tabs)' : o}</option>{/each}
        </select>
      </label>
    {/each}
    <label>Theme
      <select bind:value={progress.settings.theme} onchange={changed}>
        <option value="system">Follow the system</option><option value="light">Light</option><option value="dark">Dark</option>
      </select>
    </label>
    <label class="row"><input type="checkbox" bind:checked={progress.settings.unlockAll} onchange={changed} /> Unlock every chapter (skip the “Completed unlocks the next chapter” rule)</label>
  </div>

  <h2 class="sec">Your data</h2>
  <div class="card stack small">
    <p>Progress is stored on the course server (SQLite) under an anonymous learner id kept in this browser: <code>{api.learner || 'none'}</code>. Status: {sync.status}.</p>
    <p class="muted">Results are a self-reported completion record, not a verified certificate.</p>
    <div class="row">
      <button class="btn" onclick={exportJson}>Export progress (JSON)</button>
      <button class="btn danger" onclick={reset}>Reset all progress</button>
    </div>
  </div>

  {#if attempts.length}
    <h2 class="sec">Recent graded attempts</h2>
    <table class="small">
      <thead><tr><th>When (UTC)</th><th>What</th><th>Score</th><th></th></tr></thead>
      <tbody>
        {#each attempts.slice(0, 30) as a}
          <tr><td>{a.at}</td><td>{a.kind} · {a.ref}</td><td>{a.score}%</td><td>{a.passed ? '✓' : ''}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  label { display: grid; gap: 4px; font-weight: 600; font-size: 0.92rem; }
  label.row { display: flex; font-weight: 400; }
  label.row input { width: auto; }
  .sec { margin-top: 26px; }
</style>
