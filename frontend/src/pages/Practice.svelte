<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { progress, recordQuiz, setLast, testOutOffered } from '../lib/progress.svelte.js';
  import Blocks from '../components/Blocks.svelte';
  import Quiz from '../components/Quiz.svelte';
  import Predict from '../components/Predict.svelte';
  import Placement from '../components/Placement.svelte';

  let { course, ch, section = null } = $props();
  let page = $state(null);
  let error = $state('');
  let active = $state(null);
  const chapter = course.chapters.find((c) => c.key === ch);

  onMount(async () => {
    try {
      page = await api.page(ch, 'practice');
      const ids = page.sections.map((s) => s.id);
      active = section && ids.includes(section) ? section : ids[0];
      setLast(`/practice/${ch}`, `Chapter ${chapter?.num} practice`);
    } catch (e) {
      error = e.message;
    }
  });

  const checksOf = (s) => s.blocks.filter((b) => b.type === 'check').map((b) => b.check);
  const sec = $derived(page?.sections.find((s) => s.id === active));
  const label = (s) => s.title.replace(/\s*\(.*\)\s*$/, '').replace(/^Write lab( [A-C])?:\s*/, 'Lab$1: ');

  function select(id) {
    active = id;
    history.replaceState(null, '', `#/practice/${ch}/${id}`);
  }
</script>

<div class="container narrow">
  <nav class="small muted crumbs"><a href="#/">Course</a> / <a href={'#/chapter/' + ch}>Chapter {chapter?.num}</a> / Practice</nav>
  {#if error}
    <p class="callout bad">{error}</p>
  {:else if !page}
    <p class="muted">Loading…</p>
  {:else if ch === 'ch00'}
    <Placement {page} />
  {:else}
    <div class="kicker">{page.kicker}</div>
    <h1>{page.title}</h1>
    {#if page.intro.length}<Blocks blocks={page.intro} />{/if}
    <nav class="tabs" aria-label="Practice sections">
      {#each page.sections as s}
        <button class="tab" class:active={s.id === active} onclick={() => select(s.id)}>{label(s)}</button>
      {/each}
    </nav>
    {#if sec}
      {#key sec.id}
        <h2>{sec.title}</h2>
        {#if sec.id === 'quiz'}
          {@const pool = checksOf(sec)}
          {#if ch >= 'ch01' && ch <= 'ch03' && testOutOffered()}
            <p class="callout info small">Your placement result offers the test-out path: passing this quiz (≥ 80%) marks Chapter {chapter.num} Completed.</p>
          {/if}
          <Quiz {pool} draw={chapter?.quiz?.draw || 10} best={progress.quizzes[ch]?.best ?? null}
            onfinish={(score, passed) => recordQuiz(ch, score, passed)} />
        {:else if sec.id === 'predict'}
          <Predict checks={checksOf(sec)} {ch} best={progress.predict[ch]?.best ?? null} />
        {:else}
          <Blocks blocks={sec.blocks} />
        {/if}
      {/key}
    {/if}
  {/if}
</div>

<style>
  .crumbs { margin-bottom: 10px; }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 18px 0; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
  .tab { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 999px; padding: 5px 12px; font: inherit; font-size: 0.85rem; cursor: pointer; }
  .tab.active { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
</style>
