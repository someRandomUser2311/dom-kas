<script>
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api.js';
  import { progress, recordExam, examUnlocked, setLast } from '../lib/progress.svelte.js';
  import Blocks from '../components/Blocks.svelte';
  import Check from '../components/Check.svelte';

  let { course } = $props();
  let page = $state(null);
  let phase = $state('intro');
  let questions = $state([]);
  let answers = $state({});
  let results = $state({});
  let error = $state('');
  let deadline = $state(0);
  let now = $state(Date.now());
  let timer;
  const MINUTES = 60;

  onMount(async () => {
    try { page = await api.examPage(); setLast('/exam', 'Final exam'); } catch (e) { error = e.message; }
    timer = setInterval(() => {
      now = Date.now();
      if (phase === 'running' && now >= deadline) submit();
    }, 1000);
  });
  onDestroy(() => clearInterval(timer));

  async function start() {
    error = '';
    try {
      questions = await api.examDraw();
      answers = {};
      results = {};
      deadline = Date.now() + MINUTES * 60 * 1000;
      phase = 'running';
      window.scrollTo({ top: 0 });
    } catch (e) { error = e.message; }
  }

  async function submit() {
    if (phase !== 'running') return;
    phase = 'grading';
    const out = await Promise.all(
      questions.map((q) => api.grade(q.id, answers[q.id] || {}).catch(() => ({ correct: false, explain: '' })))
    );
    questions.forEach((q, i) => (results[q.id] = out[i]));
    phase = 'done';
    recordExam(score, score >= 80);
    window.scrollTo({ top: 0 });
  }

  const score = $derived(questions.length ? Math.round((Object.values(results).filter((r) => r.correct).length / questions.length) * 100) : 0);
  const left = $derived(Math.max(0, deadline - now));
  const mm = $derived(String(Math.floor(left / 60000)).padStart(2, '0'));
  const ss = $derived(String(Math.floor((left % 60000) / 1000)).padStart(2, '0'));
  const answeredCount = $derived(Object.values(answers).filter(Boolean).length);
  const blueprint = $derived(page ? page.sections.filter((s) => s.id !== 'integration') : []);
</script>

<div class="container narrow">
  <nav class="small muted crumbs"><a href="#/">Course</a> / Final exam</nav>
  {#if error}<p class="callout bad">{error}</p>{/if}
  {#if !page}
    <p class="muted">Loading…</p>
  {:else if phase === 'intro'}
    <div class="kicker">{page.kicker}</div>
    <h1>{page.title}</h1>
    <Blocks blocks={page.intro} />
    {#each blueprint as s}<h2>{s.title}</h2><Blocks blocks={s.blocks} />{/each}
    {#if progress.exam}<p>Best so far: <b>{progress.exam.best}%</b>{progress.exam.passed ? ' · passed' : ''}</p>{/if}
    {#if examUnlocked(course)}
      <button class="btn primary" onclick={start}>Start the exam ({MINUTES} min)</button>
    {:else}
      <p class="callout warn">🔒 The exam unlocks when Chapters 1–16 are all Completed.</p>
    {/if}
  {:else}
    <div class="bar card row between">
      {#if phase === 'running'}
        <b class="mono">⏱ {mm}:{ss}</b>
        <span class="small muted">{answeredCount} / {questions.length} answered</span>
        <button class="btn primary small" onclick={() => confirm('Submit the exam now?') && submit()}>Submit</button>
      {:else if phase === 'grading'}
        <span>Grading…</span>
      {:else}
        <b>{score}%</b>
        <span class="chip" class:ok={score >= 80} class:bad={score < 80}>{score >= 80 ? 'Passed' : 'Below 80%'}</span>
        <button class="btn small" onclick={start}>Retake (new draw)</button>
      {/if}
    </div>
    {#each questions as q, n (q.id)}
      <Check check={q} mode="exam" number={n + 1} onanswer={(a) => (answers[q.id] = a)} result={results[q.id] || null} />
    {/each}
    {#if phase === 'running'}
      <button class="btn primary" onclick={submit}>Submit the exam</button>
    {/if}
  {/if}
</div>

<style>
  .crumbs { margin-bottom: 10px; }
  .bar { position: sticky; top: 64px; z-index: 5; margin-bottom: 12px; padding: 10px 14px; }
</style>
