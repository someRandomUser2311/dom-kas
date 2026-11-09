<script>
  // Focus-mode quiz: draws `draw` questions from the pool, one at a time,
  // one attempt each, with a feedback bar and a Continue button.
  import Check from './Check.svelte';
  import { shuffle } from '../lib/util.js';
  import { recordCheck } from '../lib/progress.svelte.js';

  let { pool = [], draw = 10, passAt = 80, title = 'Checkpoint quiz', onfinish = () => {}, best = null } = $props();

  let phase = $state('intro');
  let questions = $state([]);
  let i = $state(0);
  let current = $state(null);
  let results = $state([]);

  function start() {
    questions = shuffle(pool).slice(0, Math.min(draw, pool.length));
    i = 0;
    results = [];
    current = null;
    phase = 'running';
  }

  function onresult(r) {
    current = r;
    results[i] = !!r.correct;
    recordCheck(questions[i].id, !!r.correct);
  }

  function next() {
    current = null;
    if (i + 1 < questions.length) i += 1;
    else {
      phase = 'done';
      onfinish(score, score >= passAt);
    }
  }

  const score = $derived(questions.length ? Math.round((results.filter(Boolean).length / questions.length) * 100) : 0);
</script>

<div class="quiz card">
  {#if phase === 'intro'}
    <div class="kicker">{title}</div>
    <h3>{Math.min(draw, pool.length)} questions drawn from a pool of {pool.length}</h3>
    <p class="muted small">One attempt per question. Pass at {passAt}%. Retakes draw a fresh set.</p>
    {#if best !== null}<p class="small">Your best: <b>{best}%</b></p>{/if}
    <button class="btn primary" onclick={start} disabled={!pool.length}>Start</button>
  {:else if phase === 'running'}
    <div class="row between">
      <span class="kicker">Question {i + 1} of {questions.length}</span>
      <span class="small muted">{results.filter(Boolean).length} correct</span>
    </div>
    <div class="progress"><span style="width:{(i / questions.length) * 100}%"></span></div>
    {#key questions[i].id}
      <Check check={questions[i]} mode="quiz" {onresult} />
    {/key}
    {#if current}
      <div class="row end"><button class="btn primary" onclick={next}>{i + 1 < questions.length ? 'Continue →' : 'See results'}</button></div>
    {/if}
  {:else}
    <div class="kicker">{title} · results</div>
    <h2>{score}% <span class="chip" class:ok={score >= passAt} class:bad={score < passAt}>{score >= passAt ? 'Passed' : `Below ${passAt}%`}</span></h2>
    <p class="muted small">{results.filter(Boolean).length} of {questions.length} correct. Missed questions are added to your review list.</p>
    <button class="btn primary" onclick={start}>Retake with new questions</button>
  {/if}
</div>

<style>
  .quiz { margin: 12px 0; }
  .progress { margin: 8px 0 4px; }
</style>
