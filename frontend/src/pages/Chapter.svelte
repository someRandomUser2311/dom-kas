<script>
  import { progress, chapterStats, chapterUnlocked, lessonDone, testOutOffered } from '../lib/progress.svelte.js';
  let { course, key } = $props();

  const ch = $derived(course.chapters.find((c) => c.key === key));
  const s = $derived(ch ? chapterStats(ch) : null);
  const open = $derived(ch ? chapterUnlocked(course, ch) : false);
  const nextLesson = $derived(ch?.lessons.find((l) => !lessonDone(l.id)));
  const nextCh = $derived(ch ? course.chapters.find((c) => c.num === ch.num + 1) : null);
</script>

{#if !ch}
  <div class="container"><p>Chapter not found. <a href="#/">Back to the course</a></p></div>
{:else}
  <div class="container">
    <nav class="small muted crumbs"><a href="#/">Course</a> / Chapter {ch.num}</nav>
    <div class="layout">
      <div>
        <div class="kicker">{ch.kicker}</div>
        <h1>Chapter {ch.num} · {ch.title}</h1>
        {#if !open}<p class="callout warn">🔒 This chapter unlocks when the previous one is Completed. You can change this in <a href="#/settings">settings</a>.</p>{/if}
        <div class="prose">{@html ch.intro}</div>
        {#if ch.outcomes}<div class="card flat outcomes"><h3>By the end, you can</h3><div class="prose">{@html ch.outcomes}</div></div>{/if}

        <h2 class="section">Lessons</h2>
        <ol class="lessons">
          {#each ch.lessons as l}
            {@const done = lessonDone(l.id)}
            {@const lp = progress.lessons[l.id]}
            <li>
              <a class="lesson card flat" href={'#/lesson/' + l.id}>
                <span class="state" class:done>{done ? '✓' : lp ? '◐' : ''}</span>
                <span class="t"><b>{l.num}</b> · {l.title}</span>
                <span class="small muted">~{l.minutes} min{l.checks ? ` · ${l.checks} checks` : ''}</span>
              </a>
            </li>
          {/each}
        </ol>

        {#if ch.pages.length}
          <h2 class="section">Practice</h2>
          <div class="grid two">
            {#if ch.pages.includes(ch.key + '/practice')}
              <a class="card flat practice" href={'#/practice/' + ch.key}>
                <b>{ch.num === 0 ? 'Placement quiz' : 'Practice'}</b>
                <span class="small muted">
                  {#if ch.quiz}Quiz ({ch.quiz.draw} of {ch.quiz.pool}){/if}{#if ch.predictCount} · predict ({ch.predictCount}){/if}{#if ch.labs.length} · {ch.labs.length} lab{ch.labs.length > 1 ? 's' : ''}{/if}
                  {#if ch.num === 0}About 15 questions · sets your “Coming from” tabs{/if}
                </span>
              </a>
            {/if}
            {#if ch.pages.includes(ch.key + '/project')}
              <a class="card flat practice" href={'#/project/' + ch.key}><b>Capstone project</b><span class="small muted">Multi-file lab · readiness review</span></a>
            {/if}
          </div>
          {#if ch.practice}<details class="more"><summary class="small muted">What's in the practice page</summary><div class="prose small">{@html ch.practice}</div></details>{/if}
        {/if}
      </div>

      <aside class="rail">
        <div class="card">
          <div class="kicker">Your chapter</div>
          <h3>{s.done} / {s.total} lessons</h3>
          <div class="progress" class:ok={s.completed}><span style="width:{s.total ? (s.done / s.total) * 100 : 0}%"></span></div>
          <ul class="levels small">
            <li class:on={s.completed}>{s.completed ? '✓' : '○'} Completed <span class="muted">all lessons{ch.num >= 1 && ch.num <= 3 && testOutOffered() ? ' (or test out with the quiz)' : ''}</span></li>
            <li class:on={s.passed}>{s.passed ? '✓' : '○'} Passed <span class="muted">score ≥ 70%, quiz ≥ 80%, no ⛔ failing</span></li>
            <li class:on={s.mastered}>{s.mastered ? '✓' : '○'} Mastered <span class="muted">score ≥ 90%, labs without the solution</span></li>
          </ul>
          <p class="small">Chapter score: <b>{s.score}%</b>{#if s.quizBest !== null} · quiz best {s.quizBest}%{/if} · checks {s.checksPct}%</p>
          {#if nextLesson}
            <a class="btn primary full" href={'#/lesson/' + nextLesson.id}>{s.done ? 'Continue' : 'Start'}: {nextLesson.num}</a>
          {:else if ch.pages.length}
            <a class="btn primary full" href={'#/' + (ch.pages[0].endsWith('/project') ? 'project/' : 'practice/') + ch.key}>Go to practice</a>
          {/if}
          {#if s.completed && nextCh}
            <a class="btn full" href={'#/chapter/' + nextCh.key}>Next: Chapter {nextCh.num} →</a>
          {/if}
        </div>
        {#if ch.note}<p class="small muted">{@html ch.note}</p>{/if}
      </aside>
    </div>
  </div>
{/if}

<style>
  .crumbs { margin-bottom: 10px; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 28px; align-items: start; }
  @media (max-width: 900px) { .layout { grid-template-columns: minmax(0, 1fr); } }
  .rail { position: sticky; top: 72px; display: grid; gap: 12px; }
  .outcomes { margin: 16px 0; }
  .section { margin-top: 26px; }
  .lessons { list-style: none; padding: 0; display: grid; gap: 8px; }
  .lesson { display: flex; align-items: center; gap: 12px; color: var(--text); padding: 12px 14px; text-decoration: none !important; }
  .lesson:hover { border-color: var(--accent); }
  .lesson .t { flex: 1; }
  .state { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--border); display: grid; place-items: center; font-size: 13px; color: var(--accent); flex: none; }
  .state.done { background: var(--ok); border-color: var(--ok); color: #fff; }
  .practice { display: flex; flex-direction: column; gap: 4px; color: var(--text); text-decoration: none !important; }
  .practice:hover { border-color: var(--accent); }
  .levels { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 6px; color: var(--muted); }
  .levels li.on { color: var(--ok); font-weight: 600; }
  .full { width: 100%; margin-top: 8px; }
  .more { margin-top: 12px; }
</style>
