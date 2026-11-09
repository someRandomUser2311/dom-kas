<script>
  import { onMount } from 'svelte';
  import { route } from './lib/router.svelte.js';
  import { api } from './lib/api.js';
  import { progress, sync, loadProgress, streak, save, applyTheme } from './lib/progress.svelte.js';
  import Home from './pages/Home.svelte';
  import Chapter from './pages/Chapter.svelte';
  import Lesson from './pages/Lesson.svelte';
  import Practice from './pages/Practice.svelte';
  import Project from './pages/Project.svelte';
  import Exam from './pages/Exam.svelte';
  import Settings from './pages/Settings.svelte';
  import About from './pages/About.svelte';

  let course = $state(null);
  let error = $state('');
  let ready = $state(false);

  onMount(async () => {
    try {
      [course] = await Promise.all([api.course(), loadProgress()]);
    } catch (e) {
      error = e.message;
    }
    ready = true;
  });

  $effect(() => {
    // scroll to top on navigation (lessons manage their own step scroll)
    route.path;
    window.scrollTo({ top: 0 });
  });

  function toggleTheme() {
    const cur = progress.settings.theme;
    const dark = cur === 'dark' || (cur === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    progress.settings.theme = dark ? 'light' : 'dark';
    applyTheme();
    save();
  }
</script>

<header class="topbar">
  <a class="brand" href="#/"><img src="/favicon.svg" alt="" /> <span class="hide-sm">Kubernetes → AKS → DevOps</span><span class="sm-only">K8s → AKS</span></a>
  <span class="spacer"></span>
  {#if ready}
    <span class="chip warn" title="Days in a row with activity">🔥 {streak()}</span>
    <span class="chip hide-sm" class:bad={sync.status === 'offline'} title={sync.error || 'Progress is saved on the server'}>
      {sync.status === 'offline' ? 'Offline: saved in this browser' : 'Progress saved'}
    </span>
  {/if}
  <button class="btn ghost small" onclick={toggleTheme} aria-label="Toggle dark mode">◐</button>
  <a class="btn ghost small" href="#/settings" aria-label="Settings">⚙︎</a>
</header>

{#if !ready}
  <div class="container"><p class="muted">Loading the course…</p></div>
{:else if error}
  <div class="container narrow">
    <div class="callout bad">
      <h2>The course API isn't reachable</h2>
      <p>{error}</p>
      <p class="small">Start everything with <code>docker compose up</code>, then reload.</p>
    </div>
  </div>
{:else if route.name === 'home'}
  <Home {course} />
{:else if route.name === 'chapter'}
  <Chapter {course} key={route.params[0]} />
{:else if route.name === 'lesson'}
  {#key route.params[0] + '/' + route.params[1]}
    <Lesson {course} ch={route.params[0]} id={route.params[1]} anchor={route.params[2]} />
  {/key}
{:else if route.name === 'practice'}
  {#key route.params[0]}
    <Practice {course} ch={route.params[0]} section={route.params[1]} />
  {/key}
{:else if route.name === 'project'}
  <Project {course} ch={route.params[0] || 'ch17'} />
{:else if route.name === 'exam'}
  <Exam {course} />
{:else if route.name === 'settings'}
  <Settings {course} />
{:else}
  <About />
{/if}

<style>
  .sm-only { display: none; }
  @media (max-width: 700px) {
    .sm-only { display: inline; }
  }
</style>
