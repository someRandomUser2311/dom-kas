<script>
  // One check of any type. Grading happens on the server; this component
  // only collects the answer and shows the feedback.
  //
  // mode: 'lesson' (retry allowed, answer revealed on request),
  //       'quiz'   (one attempt, answer revealed immediately),
  //       'exam'   (no feedback; reports the answer through onanswer)
  import { api } from '../lib/api.js';
  import { highlight } from '../lib/util.js';
  import Widget from './Widget.svelte';
  import { consumesContext, solvable } from '../widgets/index.js';

  let { check, mode = 'lesson', onresult = () => {}, onanswer = () => {}, result: given = null, number = null, linked = null } = $props();

  let choice = $state(null);
  let choices = $state([]);
  let order = $state(check.options.map((o) => o.key));
  let matches = $state(check.left.map(() => ''));
  let line = $state(null);
  let text = $state('');
  let result = $state(null);
  let revealed = $state(false);
  let busy = $state(false);
  let error = $state('');
  let tries = $state(0);

  const kind = check.kind;
  const isChoice = ['mcq', 'predict', 'diagnose', 'fill'].includes(kind) && !check.multiple;
  const isMulti = (['mcq', 'multi', 'predict', 'diagnose', 'fill'].includes(kind) && check.multiple) || kind === 'multi';
  const optHtml = (key) => check.options.find((o) => o.key === key)?.html ?? '';

  // A custom check whose task lives in the widget just above it.
  $effect(() => {
    if (kind === 'custom' && linked?.done && !result && !busy) submit({ done: true });
  });

  $effect(() => {
    if (given) {
      result = given;
      revealed = true;
    }
  });

  function answer() {
    if (isChoice) return { choice };
    if (isMulti) return { choices };
    if (kind === 'order') return { order };
    if (kind === 'match') return { matches: matches.map((m) => (m === '' ? 999 : Number(m))) };
    if (kind === 'tapline') return { line };
    if (kind === 'command') return { text };
    return { done: true };
  }

  const ready = $derived(
    isChoice ? choice !== null
    : isMulti ? choices.length > 0
    : kind === 'match' ? matches.every((m) => m !== '')
    : kind === 'tapline' ? line !== null
    : kind === 'command' ? text.trim().length > 0
    : true
  );

  $effect(() => {
    if (mode === 'exam') onanswer(ready ? answer() : null);
  });

  async function submit(extra = {}) {
    if (busy) return;
    busy = true;
    error = '';
    try {
      const r = await api.grade(check.id, { ...answer(), ...extra });
      tries += 1;
      result = r;
      if (mode === 'quiz' || r.correct) revealed = true;
      onresult(r, tries === 1 && r.correct, answer());
    } catch (e) {
      error = e.message;
    }
    busy = false;
  }

  function retry() {
    result = null;
    if (isChoice) choice = null;
    if (kind === 'tapline') line = null;
  }

  function reveal() {
    revealed = true;
    onresult(result, false, null, true);
  }

  const locked = $derived(!!result && (result.correct || revealed || mode === 'quiz'));
  const showSurvey = $derived(result?.survey && kind !== 'custom');

  function optClass(key) {
    if (!result) {
      if (isChoice) return choice === key ? 'selected' : '';
      if (isMulti) return choices.includes(key) ? 'selected' : '';
      return '';
    }
    if (result.survey) return (isChoice ? choice === key : choices.includes(key)) ? 'selected' : '';
    const fb = result.options.find((o) => o.key === key);
    const chosen = isChoice ? choice === key : choices.includes(key);
    if (revealed && fb?.correct) return 'right';
    if (chosen && fb?.correct) return 'right';
    if (chosen && !fb?.correct) return 'wrong';
    return '';
  }

  function whyFor(key) {
    if (!result || result.survey) return '';
    const chosen = isChoice ? choice === key : choices.includes(key);
    const fb = result.options.find((o) => o.key === key);
    return chosen && !fb?.correct ? fb?.why || '' : '';
  }

  function toggle(key) {
    if (locked) return;
    if (result && !result.correct) result = null;
    choices = choices.includes(key) ? choices.filter((k) => k !== key) : [...choices, key];
  }

  function pick(key) {
    if (locked) return;
    if (result && !result.correct) result = null;
    choice = key;
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= order.length || locked) return;
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    order = o;
    if (result && !result.correct) result = null;
  }

  // Fill: show the chosen chip inside the blank.
  const prompt = $derived.by(() => {
    if (kind !== 'fill') return check.prompt;
    const chosen = choice !== null ? optHtml(choice) : '?';
    return check.prompt.replace(/<span class="blank">[\s\S]*?<\/span>/, `<span class="blank">${chosen}</span>`);
  });

  const correctTapLines = $derived(result?.correctLines || []);
  // Widgets embedded in a custom check's prompt are rendered separately.
  const customParts = $derived.by(() => {
    if (kind !== 'custom') return null;
    // attribute order varies after the server re-serialises the HTML
    const m = check.prompt.match(/<div\b(?=[^>]*\bclass="widget")(?=[^>]*\bdata-widget="([^"]+)")[^>]*>([\s\S]*?)<\/div>/);
    if (!m) return { before: check.prompt, widget: null, after: '' };
    return { before: check.prompt.slice(0, m.index), widget: { name: m[1], html: m[2] }, after: check.prompt.slice(m.index + m[0].length) };
  });
</script>

<div class="check card flat" class:quiz={mode !== 'lesson'}>
  <div class="row between head">
    <span class="kicker">
      {#if number}Question {number} · {/if}{({ mcq: 'Choose one', multi: 'Select all that apply', order: 'Put in order', match: 'Match the pairs', fill: 'Fill the blank', tapline: 'Tap the line', command: 'Type the command', predict: 'Predict the outcome', diagnose: 'Diagnose', custom: 'Try it' })[kind] || 'Check'}
      {#if isMulti && kind !== 'multi'}· select all that apply{/if}
    </span>
    {#if result && !result.survey && mode !== 'exam'}
      <span class="chip" class:ok={result.correct} class:bad={!result.correct}>{result.correct ? '✓ Correct' : '✗ Not quite'}</span>
    {/if}
  </div>

  {#if kind === 'custom' && customParts}
    <div class="prose">{@html customParts.before}</div>
    {#if customParts.widget}
      <Widget name={customParts.widget.name} html={customParts.widget.html} task context={customParts.after}
        onsolved={() => { if (!result) submit({ done: true }); }} />
    {/if}
    {#if customParts.after?.trim() && !consumesContext(customParts.widget?.name)}<div class="prose">{@html customParts.after}</div>{/if}
  {:else}
    <div class="prose prompt">{@html prompt}</div>
  {/if}

  {#if isChoice || isMulti}
    <ul class="options">
      {#each check.options as o (o.key)}
        <li>
          <button class="opt {optClass(o.key)}" disabled={locked} onclick={() => (isMulti ? toggle(o.key) : pick(o.key))}>
            <span class="mark">{isMulti ? (choices.includes(o.key) ? '✓' : '') : (choice === o.key ? '●' : '')}</span>
            <span class="body">{@html o.html}{#if whyFor(o.key)}<span class="why">{@html whyFor(o.key)}</span>{/if}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else if kind === 'order'}
    <ol class="options ordered">
      {#each order as key, i (key)}
        <li class="opt {result ? (revealed || result.correct ? (result.correctOrder[i] === key ? 'right' : 'wrong') : '') : ''}">
          <span class="mark">{i + 1}</span>
          <span class="body">{@html optHtml(key)}</span>
          {#if !locked}
            <span class="moves">
              <button class="btn ghost small" onclick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button class="btn ghost small" onclick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down">↓</button>
            </span>
          {/if}
        </li>
      {/each}
    </ol>
    {#if revealed && result && !result.correct}
      <div class="callout ok small"><b>Correct order:</b><ol>{#each result.correctOrder as k}<li>{@html optHtml(k)}</li>{/each}</ol></div>
    {/if}
  {:else if kind === 'match'}
    <div class="pairs">
      {#each check.left as l, i}
        <div class="pair" class:right={result && revealed && result.correctOrder[i] === Number(matches[i])} class:wrong={result && revealed && result.correctOrder[i] !== Number(matches[i])}>
          <div class="prose left">{@html l}</div>
          <select bind:value={matches[i]} disabled={locked} onchange={() => { if (result && !result.correct) result = null; }}>
            <option value="">Choose…</option>
            {#each check.right as r}
              <option value={String(r.key)}>{r.html.replace(/<[^>]+>/g, '')}</option>
            {/each}
          </select>
          {#if revealed && result && result.correctOrder[i] !== Number(matches[i])}
            <div class="small fix">→ {@html check.right.find((r) => r.key === result.correctOrder[i])?.html}</div>
          {/if}
        </div>
      {/each}
    </div>
  {:else if kind === 'tapline'}
    <div class="codebox">
      {#if check.file}<div class="file">{check.file}</div>{/if}
      <div class="taplines">
        {#each check.lines as ln, i}
          <button
            class="tl"
            class:sel={line === i}
            class:right={result && (line === i || revealed) && correctTapLines.includes(i)}
            class:wrong={result && line === i && !correctTapLines.includes(i)}
            disabled={locked}
            onclick={() => { if (result && !result.correct) result = null; line = i; }}
          ><span class="ln">{i + 1}</span><span class="txt">{@html highlight(ln) || ' '}</span></button>
        {/each}
      </div>
    </div>
  {:else if kind === 'command'}
    <form class="cmd" onsubmit={(e) => { e.preventDefault(); if (ready && !locked) submit(); }}>
      <span class="ps">$</span>
      <input class="mono" bind:value={text} disabled={locked} placeholder="type the command" autocomplete="off" autocapitalize="off" spellcheck="false" />
    </form>
  {/if}

  {#if error}<p class="callout bad small">{error}</p>{/if}

  {#if mode !== 'exam'}
    {#if !result}
      <div class="row actions">
        {#if kind === 'custom'}
          {#if solvable(customParts?.widget?.name) || linked}
            <span class="small muted">Complete the task in the widget above.</span>
          {:else}
            <button class="btn primary" onclick={() => submit({ done: true })} disabled={busy}>I've done it</button>
          {/if}
          {#if check.hasSolution}<button class="btn" onclick={() => submit({ done: false })} disabled={busy}>Show the solution</button>{/if}
        {:else}
          <button class="btn primary" onclick={() => submit()} disabled={!ready || busy}>Check</button>
        {/if}
      </div>
    {:else if !result.correct && !revealed && mode === 'lesson'}
      <div class="feedback bad">
        <div class="title">Not quite.</div>
        {#if result.message}<p class="small">{result.message}</p>{/if}
        <div class="row">
          <button class="btn small" onclick={retry}>Try again</button>
          <button class="btn ghost small" onclick={reveal}>Show the answer</button>
        </div>
      </div>
    {/if}

    {#if result && (result.correct || revealed)}
      <div class="feedback" class:ok={result.correct || result.survey} class:bad={!result.correct && !result.survey}>
        {#if !showSurvey && kind !== 'custom'}
          <div class="title">{result.correct ? 'Correct!' : 'Not quite.'}</div>
          {#if !result.correct && result.message}<p class="small">{result.message}</p>{/if}
        {/if}
        {#if kind === 'command' && result.answer}
          <p class="small"><b>Answer:</b> <code>{result.answer}</code></p>
          {#if result.accept}<p class="small muted">{@html result.accept}</p>{/if}
        {/if}
        {#if result.explain}<div class="prose small">{@html result.explain}</div>{/if}
        {#if result.solution}
          <details open={kind === 'custom' && !result.correct}><summary class="small"><b>Solution</b></summary><div class="prose small">{@html result.solution}</div></details>
        {/if}
      </div>
    {/if}
  {:else if given}
    <div class="feedback" class:ok={given.correct} class:bad={!given.correct}>
      <div class="title">{given.correct ? 'Correct' : 'Incorrect'}</div>
      {#if kind === 'command' && given.answer}<p class="small"><b>Answer:</b> <code>{given.answer}</code></p>{/if}
      {#if given.explain}<div class="prose small">{@html given.explain}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .check { margin: 14px 0; border-left: 4px solid var(--accent); }
  .check.quiz { border-left-width: 1px; }
  .head { margin-bottom: 6px; }
  .actions { margin-top: 10px; }
  .prompt :global(pre) { margin: 8px 0; }
  .prompt :global(.blank) { display: inline-block; min-width: 3em; padding: 0 6px; border-bottom: 2px dashed var(--code-key); color: var(--code-key); }
  .ordered .opt { cursor: default; align-items: center; }
  .moves { display: flex; gap: 2px; }
  .pairs { display: grid; gap: 8px; margin: 10px 0; }
  .pair { display: grid; grid-template-columns: 1fr minmax(160px, 1fr); gap: 10px; align-items: center; padding: 8px 10px; border: 1.5px solid var(--border); border-radius: 10px; }
  .pair.right { border-color: var(--ok); background: var(--ok-soft); }
  .pair.wrong { border-color: var(--bad); background: var(--bad-soft); }
  .pair .fix { grid-column: 1 / -1; color: var(--ok); }
  @media (max-width: 600px) { .pair { grid-template-columns: 1fr; } }
  .taplines { background: var(--code-bg); padding: 6px 0; overflow-x: auto; }
  .tl { display: flex; width: 100%; border: 0; background: transparent; color: var(--code-text); font: 13.5px/1.55 var(--mono); text-align: left; padding: 1px 10px 1px 0; cursor: pointer; white-space: pre; }
  .tl:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); }
  .tl.sel { background: rgba(76, 141, 255, 0.25); }
  .tl.right { background: rgba(63, 185, 111, 0.28); }
  .tl.wrong { background: rgba(240, 107, 107, 0.28); }
  .tl:disabled { cursor: default; }
  .ln { width: 36px; flex: none; text-align: right; padding-right: 10px; color: var(--code-com); user-select: none; }
  .cmd { display: flex; align-items: center; gap: 8px; background: var(--code-bg); border-radius: 10px; padding: 6px 10px; margin: 10px 0; }
  .cmd .ps { color: var(--ok); font-family: var(--mono); font-weight: 700; }
  .cmd input { background: transparent; border: 0; color: var(--code-text); padding: 6px 0; }
</style>
