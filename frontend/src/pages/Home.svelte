<script>
  import { progress, chapterStats, chapterUnlocked, examUnlocked, lessonDone, streak } from '../lib/progress.svelte.js';
  let { course } = $props();

  const chapters = course.chapters;
  const allLessons = chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, ch: c })));
  const doneCount = $derived(allLessons.filter((l) => lessonDone(l.id)).length);
  const next = $derived(
    allLessons.find((l) => !lessonDone(l.id) && l.ch.num >= 1 && chapterUnlocked(course, l.ch)) || allLessons[0]
  );
  const resume = $derived(progress.last && progress.last.route !== '/' ? progress.last : null);
  const byNum = Object.fromEntries(chapters.map((c) => [c.num, c]));

  const week = $derived.by(() => {
    const out = [];
    const d = new Date();
    d.setDate(d.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      const key = d.toISOString().slice(0, 10);
      out.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), n: progress.activity[key] || 0 });
      d.setDate(d.getDate() + 1);
    }
    return out;
  });
  const maxDay = $derived(Math.max(1, ...week.map((w) => w.n)));

  function status(ch) {
    const s = chapterStats(ch);
    if (s.mastered) return ['Mastered', 'ok'];
    if (s.passed) return ['Passed', 'ok'];
    if (s.completed) return ['Completed', 'accent'];
    if (s.done > 0) return ['In progress', 'warn'];
    return ['Not started', ''];
  }
</script>

<div class="container">
  <div class="grid two hero">
    <div class="card continue">
      <div class="kicker">{resume ? 'Pick up where you left off' : doneCount ? 'Up next' : 'Start here'}</div>
      {#if resume}
        <h2>{resume.title}</h2>
        <a class="btn primary" href={'#' + resume.route}>Continue →</a>
      {:else}
        <h2>{next.num} · {next.title}</h2>
        <p class="muted small">Chapter {next.ch.num} · {next.ch.title}</p>
        <a class="btn primary" href={'#/lesson/' + next.id}>{doneCount ? 'Continue →' : 'Start the course →'}</a>
      {/if}
      {#if !progress.placement}
        <p class="small muted tip">New to some of this? Take the <a href="#/practice/ch00">placement quiz</a> (8 min) to get refreshers and set your “Coming from” tabs.</p>
      {/if}
    </div>
    <div class="card">
      <div class="row between">
        <div><div class="kicker">Your progress</div><h2>{doneCount} / {allLessons.length} lessons</h2></div>
        <div class="streak"><b>🔥 {streak()}</b><span class="small muted">day streak</span></div>
      </div>
      <div class="progress"><span style="width:{(doneCount / allLessons.length) * 100}%"></span></div>
      <div class="week" aria-label="Activity this week">
        {#each week as w}
          <div class="day" title="{w.key}: {w.n}"><span class="bar" style="height:{(w.n / maxDay) * 100}%"></span><span class="small muted">{w.label}</span></div>
        {/each}
      </div>
    </div>
  </div>

  <h1 class="title">{course.title}</h1>
  {#each course.parts as part}
    <h2 class="part">{part.title}</h2>
    <div class="grid three">
      {#each part.chapters.map((n) => byNum[n]).filter(Boolean) as ch}
        {@const s = chapterStats(ch)}
        {@const [label, tone] = status(ch)}
        {@const open = chapterUnlocked(course, ch)}
        <a class="card chapter" class:locked={!open} href={open ? `#/chapter/${ch.key}` : undefined} aria-disabled={!open}>
          <div class="row between">
            <span class="kicker">Chapter {ch.num}{ch.optional ? ' · optional' : ''}</span>
            {#if open}<span class="chip {tone}">{label}</span>{:else}<span class="chip">🔒 Locked</span>{/if}
          </div>
          <h3>{ch.title}</h3>
          <p class="small muted">{ch.lessons.length} lessons{ch.quiz ? ' · quiz' : ''}{ch.labs.length ? ` · ${ch.labs.length} lab${ch.labs.length > 1 ? 's' : ''}` : ''}</p>
          <div class="progress" class:ok={s.completed}><span style="width:{s.total ? (s.done / s.total) * 100 : 0}%"></span></div>
          {#if s.completed}<p class="small muted score">Score {s.score}%</p>{/if}
        </a>
      {/each}
      {#if part.chapters.includes(17)}
        <a class="card chapter" class:locked={!examUnlocked(course)} href={examUnlocked(course) ? '#/exam' : undefined}>
          <div class="row between"><span class="kicker">Course-wide</span>
            {#if progress.exam?.passed}<span class="chip ok">Passed {progress.exam.best}%</span>{:else if !examUnlocked(course)}<span class="chip">🔒 After Chapters 1–16</span>{/if}
          </div>
          <h3>Final exam</h3>
          <p class="small muted">~40 questions · 60 minutes · pass at 80%</p>
        </a>
      {/if}
    </div>
  {/each}
</div>

<style>
  .hero { margin-bottom: 28px; }
  .continue { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; background: linear-gradient(135deg, var(--accent-soft), var(--surface)); }
  .tip { margin-top: 6px; }
  .streak { display: grid; justify-items: end; }
  .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; height: 80px; margin-top: 14px; align-items: end; }
  .day { display: grid; grid-template-rows: 1fr auto; justify-items: center; height: 100%; }
  .bar { width: 60%; align-self: end; background: var(--accent); border-radius: 4px; min-height: 3px; }
  .title { margin-top: 8px; }
  .part { margin: 26px 0 12px; font-size: 1.05rem; color: var(--muted); }
  .chapter { color: var(--text); display: flex; flex-direction: column; gap: 6px; text-decoration: none !important; transition: border-color 0.15s; }
  .chapter:hover { border-color: var(--accent); }
  .chapter.locked { opacity: 0.6; cursor: not-allowed; }
  .chapter h3 { font-size: 1rem; }
  .chapter p { margin: 0; }
  .score { margin-top: 2px; }
</style>
