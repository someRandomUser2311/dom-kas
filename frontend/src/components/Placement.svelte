<script>
  // Chapter 0 placement quiz: scored per section, recommends refreshers,
  // offers the Chapters 1–3 test-out path, and sets the persona tabs.
  import Check from './Check.svelte';
  import Blocks from './Blocks.svelte';
  import { progress, save } from '../lib/progress.svelte.js';
  import { stripTags } from '../lib/util.js';

  let { page } = $props();

  const all = page.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'check').map((b) => b.check);
  const scored = all.filter((c) => c.section);
  const persona = all.filter((c) => c.sets);
  const info = page.sections.find((s) => /result/i.test(s.title));
  const SECTIONS = [
    ['yaml', 'YAML', '0.1-yaml'],
    ['shell', 'Shell', '0.2-shell'],
    ['network', 'Networking', '0.3-networking'],
    ['azure', 'Azure', '0.4-azure'],
    ['git', 'Git', '0.5-git'],
    ['k8s', 'Kubernetes basics', null],
  ];

  let results = $state({});
  let run = $state(0);
  const answered = $derived(scored.filter((c) => c.id in results).length);
  const done = $derived(answered === scored.length);

  function onresult(c) {
    return (r, _first, ans) => {
      if (c.sets) {
        const set = c.sets.split('.')[1];
        const opt = c.options.find((o) => o.key === ans?.choice);
        if (set && opt) {
          progress.persona[set] = stripTags(opt.html);
          save();
        }
        return;
      }
      results[c.id] = !!r.correct;
      if (scored.every((x) => x.id in results)) finish();
    };
  }

  function finish() {
    const sections = {};
    for (const [key] of SECTIONS) {
      const qs = scored.filter((c) => c.section === key);
      if (qs.length) sections[key] = qs.every((c) => results[c.id]) ? 'pass' : 'refresh';
    }
    progress.placement = { sections, at: Date.now() };
    save();
  }
</script>

<div class="kicker">{page.kicker}</div>
<h1>{page.title}</h1>
<Blocks blocks={page.intro} />
{#if progress.placement}
  <div class="card result">
    <h3>Your latest result</h3>
    <ul class="small">
      {#each SECTIONS as [key, name, lesson]}
        {@const s = progress.placement.sections[key]}
        {#if s}
          <li>
            <b>{name}:</b>
            {#if s === 'pass'}✓ You're set{#if key === 'k8s'} — you can <b>test out</b> of Chapters 1–3 by passing their quizzes (≥ 80%).{/if}
            {:else if lesson}Take refresher <a href={'#/lesson/ch00/' + lesson}>{lesson.split('-')[0]}</a>
            {:else}Start with Chapter 1.{/if}
          </li>
        {/if}
      {/each}
      <li><b>Local lab:</b> <a href="#/lesson/ch00/0.6-local-lab">0.6</a> is optional, whatever your score.</li>
    </ul>
    <p class="small muted">“Coming from” tabs: {progress.persona.A} · {progress.persona.B}. Change them any time in <a href="#/settings">settings</a>.</p>
    <button class="btn small" onclick={() => { results = {}; run += 1; }}>Retake</button>
  </div>
{/if}
{#if info}<details class="small"><summary>How results work</summary><Blocks blocks={info.blocks} /></details>{/if}

{#key run}
  {#each SECTIONS as [key, name]}
    {@const qs = scored.filter((c) => c.section === key)}
    {#if qs.length}
      <h2 class="sec">{name}</h2>
      {#each qs as c (c.id)}<Check check={c} mode="quiz" onresult={onresult(c)} />{/each}
    {/if}
  {/each}
  <h2 class="sec">About you (not scored)</h2>
  {#each persona as c (c.id)}<Check check={c} mode="quiz" onresult={onresult(c)} />{/each}
{/key}
<p class="small muted">{answered} of {scored.length} scored questions answered.{#if done} Your result is saved above.{/if}</p>

<style>
  .result { margin: 16px 0; border-left: 4px solid var(--ok); }
  .sec { margin-top: 26px; }
</style>
