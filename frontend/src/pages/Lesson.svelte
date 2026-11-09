<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { go } from '../lib/router.svelte.js';
  import { progress, markStep, completeLesson, setLast, lessonDone } from '../lib/progress.svelte.js';
  import Blocks from '../components/Blocks.svelte';

  let { course, ch, id, anchor = null } = $props();

  let lesson = $state(null);
  let error = $state('');
  let index = $state(0);
  let answered = $state({});
  let showNav = $state(false);

  const chapter = course.chapters.find((c) => c.key === ch);
  const pos = chapter ? chapter.lessons.findIndex((l) => l.id === `${ch}/${id}`) : -1;
  const nextLesson = chapter && pos >= 0 ? chapter.lessons[pos + 1] : null;
  const prevLesson = chapter && pos > 0 ? chapter.lessons[pos - 1] : null;

  onMount(async () => {
    try {
      lesson = await api.lesson(ch, id);
      const fromAnchor = anchor ? lesson.steps.findIndex((s) => s.id === anchor) : -1;
      const saved = progress.lessons[lesson.id]?.step ?? 0;
      index = fromAnchor >= 0 ? fromAnchor : Math.min(saved, lesson.steps.length - 1);
      // checks answered earlier count as answered
      for (const s of lesson.steps) for (const b of s.blocks) if (b.type === 'check' && progress.checks[b.check.id]) answered[b.check.id] = true;
      track();
    } catch (e) {
      error = e.message;
    }
  });

  const step = $derived(lesson?.steps[index]);
  const stepChecks = $derived(step ? step.blocks.filter((b) => b.type === 'check').map((b) => b.check.id) : []);
  const canNext = $derived(stepChecks.every((c) => answered[c]));
  const isLast = $derived(lesson && index === lesson.steps.length - 1);

  function track() {
    if (!lesson) return;
    markStep(lesson.id, index, lesson.steps.length);
    setLast(`/lesson/${lesson.id}/${lesson.steps[index].id}`, `${lesson.num} · ${lesson.title}`);
  }

  function goto(i) {
    if (!lesson || i < 0 || i >= lesson.steps.length) return;
    index = i;
    showNav = false;
    track();
    history.replaceState(null, '', `#/lesson/${lesson.id}/${lesson.steps[i].id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function finish() {
    completeLesson(lesson.id);
    if (nextLesson) go('/lesson/' + nextLesson.id);
    else go('/chapter/' + ch);
  }

  function onresult(cid) {
    answered[cid] = true;
  }

  function key(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight' && canNext && !isLast) goto(index + 1);
    if (e.key === 'ArrowLeft') goto(index - 1);
  }

  const maxSeen = $derived(lesson ? Math.max(progress.lessons[lesson.id]?.max ?? 0, index) : 0);
</script>

<svelte:window onkeydown={key} />

{#if error}
  <div class="container"><p class="callout bad">{error}</p><a href={'#/chapter/' + ch}>Back to the chapter</a></div>
{:else if !lesson}
  <div class="container"><p class="muted">Loading lesson…</p></div>
{:else}
  <div class="player">
    <aside class="side" class:open={showNav}>
      <a class="small" href={'#/chapter/' + ch}>← Chapter {chapter?.num}: {chapter?.title}</a>
      <h3 class="ltitle">{lesson.num} · {lesson.title}</h3>
      <ol class="steps">
        {#each lesson.steps as s, i}
          <li>
            <button class="st" class:active={i === index} class:seen={i <= maxSeen} onclick={() => goto(i)} disabled={i > maxSeen + 1 && !lessonDone(lesson.id)}>
              <span class="n">{i < maxSeen || lessonDone(lesson.id) ? '✓' : i + 1}</span>{s.title}
            </button>
          </li>
        {/each}
      </ol>
      <div class="others small">
        <div class="kicker">Lessons in this chapter</div>
        {#each chapter?.lessons || [] as l}
          <a href={'#/lesson/' + l.id} class:cur={l.id === lesson.id}>{lessonDone(l.id) ? '✓' : '·'} {l.num} {l.title}</a>
        {/each}
      </div>
    </aside>

    <main class="main">
      <div class="top row between">
        <button class="btn small ghost navbtn" onclick={() => (showNav = !showNav)}>☰ Steps</button>
        <span class="small muted">{lesson.kicker}</span>
        <span class="small muted">Step {index + 1} / {lesson.steps.length}</span>
      </div>
      <div class="progress"><span style="width:{((index + 1) / lesson.steps.length) * 100}%"></span></div>

      {#if index === 0}
        <header class="lhead">
          <h1>{lesson.title}</h1>
          {#if lesson.meta}<p class="muted">{lesson.meta}</p>{/if}
        </header>
      {/if}

      {#key step.id}
        <article class="step" class:summary={step.summary}>
          <h2>{step.title}</h2>
          <Blocks blocks={step.blocks} {onresult} />
        </article>
      {/key}

      <div class="nav row between">
        {#if index > 0}
          <button class="btn" onclick={() => goto(index - 1)}>← Back</button>
        {:else if prevLesson}
          <a class="btn" href={'#/lesson/' + prevLesson.id}>← {prevLesson.num}</a>
        {:else}<span></span>{/if}
        {#if !canNext}<span class="small muted">Answer the check to continue</span>{/if}
        {#if isLast}
          <button class="btn primary" onclick={finish} disabled={!canNext}>{nextLesson ? `Finish · next: ${nextLesson.num} →` : 'Finish the lesson ✓'}</button>
        {:else}
          <button class="btn primary" onclick={() => goto(index + 1)} disabled={!canNext}>Continue →</button>
        {/if}
      </div>
    </main>
  </div>
{/if}

<style>
  .player { display: grid; grid-template-columns: 290px 1fr; max-width: 1240px; margin: 0 auto; min-height: calc(100vh - 56px); }
  .side { border-right: 1px solid var(--border); padding: 20px 16px; position: sticky; top: 56px; height: calc(100vh - 56px); overflow: auto; background: var(--surface); }
  .ltitle { margin: 10px 0; font-size: 1rem; }
  .steps { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 2px; }
  .st { display: flex; gap: 8px; width: 100%; text-align: left; background: none; border: 0; border-radius: 8px; padding: 6px 8px; color: var(--muted); font: inherit; font-size: 0.88rem; cursor: pointer; }
  .st:hover:not(:disabled) { background: var(--surface-2); }
  .st.seen { color: var(--text); }
  .st.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  .st:disabled { opacity: 0.45; cursor: default; }
  .n { width: 20px; flex: none; text-align: center; }
  .others { display: grid; gap: 3px; border-top: 1px solid var(--border); padding-top: 12px; }
  .others a { color: var(--muted); }
  .others a.cur { color: var(--accent); font-weight: 600; }
  .main { padding: 20px 32px 80px; max-width: 880px; width: 100%; min-width: 0; }
  .top { margin-bottom: 8px; }
  .navbtn { display: none; }
  .lhead { margin: 22px 0 6px; }
  .step { margin-top: 22px; }
  .step.summary { background: var(--accent-soft); border-radius: var(--radius); padding: 18px 20px; }
  .nav { margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--border); }
  @media (max-width: 900px) {
    .player { grid-template-columns: 1fr; }
    .side { display: none; position: fixed; inset: 56px 0 0 0; z-index: 15; height: auto; }
    .side.open { display: block; }
    .navbtn { display: inline-flex; }
    .main { padding: 16px 16px 80px; }
  }
</style>
