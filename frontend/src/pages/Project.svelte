<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { progress, save, setLast, labState } from '../lib/progress.svelte.js';
  import Blocks from '../components/Blocks.svelte';
  import Lab from '../components/Lab.svelte';

  let { course, ch } = $props();
  let page = $state(null);
  let error = $state('');
  const chapter = course.chapters.find((c) => c.key === ch);

  onMount(async () => {
    try {
      page = await api.page(ch, 'project');
      setLast(`/project/${ch}`, 'Capstone project');
    } catch (e) {
      error = e.message;
    }
  });

  const lab = $derived(page ? [...page.intro, ...page.sections.flatMap((s) => s.blocks)].find((b) => b.type === 'lab')?.lab : null);
  const intro = $derived(page ? page.intro.filter((b) => b.type !== 'lab') : []);
  const st = $derived(lab ? labState(lab.id) : null);
</script>

<div class="container">
  <nav class="small muted crumbs"><a href="#/">Course</a> / <a href={'#/chapter/' + ch}>Chapter {chapter?.num}</a> / Project</nav>
  {#if error}<p class="callout bad">{error}</p>
  {:else if !page}<p class="muted">Loading…</p>
  {:else}
    <div class="kicker">{page.kicker}</div>
    <h1>{page.title}</h1>
    <Blocks blocks={intro} />
    {#if lab}<Lab {lab} />{/if}
    {#if st?.passed}
      <div class="callout ok"><b>Readiness review passed.</b> Chapter 17 is complete. This is a completion record stored with your progress, not a verified certificate.</div>
    {/if}
    {#each page.sections as s}
      <h2 class="sec">{s.title}</h2>
      {#if /reflection/i.test(s.title)}
        <Blocks blocks={s.blocks.filter((b) => b.type !== 'lab')} />
        <textarea rows="5" bind:value={progress.reflection} onchange={save} placeholder="Your answer (saved, not graded)"></textarea>
      {:else}
        <Blocks blocks={s.blocks.filter((b) => b.type !== 'lab')} />
      {/if}
    {/each}
  {/if}
</div>

<style>
  .crumbs { margin-bottom: 10px; }
  .sec { margin-top: 26px; }
</style>
