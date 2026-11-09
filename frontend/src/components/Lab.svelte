<script>
  import { api } from '../lib/api.js';
  import { labState, recordLab, progress, save } from '../lib/progress.svelte.js';
  import Editor from './Editor.svelte';

  let { lab } = $props();

  const multi = lab.files.length > 0;
  const fileList = multi ? lab.files : [{ name: 'main', start: lab.start || '' }];
  const st = labState(lab.id);
  for (const f of fileList) if (st.files[f.name] === undefined) st.files[f.name] = f.start || '';

  let active = $state(fileList[0].name);
  let result = $state(null);
  let busy = $state(false);
  let error = $state('');
  let solution = $state(null);
  let showBrief = $state(!multi);

  function persist() { save(); }

  async function grade() {
    busy = true;
    error = '';
    try {
      result = await api.gradeLab(lab.id, $state.snapshot(st.files));
      recordLab(lab.id, result);
    } catch (e) {
      error = e.message;
    }
    busy = false;
  }

  async function viewSolution() {
    if (!st.solutionViewed && !confirm('Viewing the reference solution caps this lab at 60%, so it can no longer pass. Show it?')) return;
    st.solutionViewed = true;
    save();
    solution = await api.labSolution(lab.id).catch((e) => ({ solution: e.message }));
  }

  function reset() {
    if (!confirm('Reset this file to the starter text?')) return;
    st.files[active] = fileList.find((f) => f.name === active)?.start || '';
    result = null;
    save();
  }

  const fileRules = $derived(result ? result.rules : []);
  const groupOf = (name) => {
    if (!multi) return null;
    const g = result?.groups?.map((x) => x.group) || [];
    return g.find((x) => name === x || name.startsWith(x + '/') || (x === 'infra' && name.startsWith('infra/')) || (x === 'pipelines' && (name.startsWith('templates/') || name === 'azure-pipelines.yml')));
  };
</script>

<section class="lab card">
  <div class="row between">
    <div>
      <div class="kicker">Write lab · graded on the server</div>
      <h3>{lab.title.replace(/^Write lab( [A-C])?:\s*/, '')}</h3>
    </div>
    <div class="row">
      {#if st.best}<span class="chip" class:ok={st.passed} class:warn={!st.passed}>Best {st.best}%</span>{/if}
      {#if st.solutionViewed}<span class="chip warn">solution viewed · capped at 60%</span>{/if}
    </div>
  </div>

  <details bind:open={showBrief}>
    <summary class="small"><b>Brief and rules</b></summary>
    <div class="prose small brief">{@html lab.brief}</div>
    <ul class="rules small">
      {#each lab.rules as r}
        <li>{#if r.critical}<span title="Critical rule">⛔</span> {/if}{@html r.html}</li>
      {/each}
    </ul>
  </details>

  <div class="work" class:multi>
    {#if multi}
      <nav class="files">
        {#each fileList as f}
          {@const g = groupOf(f.name)}
          {@const gs = result?.groups?.find((x) => x.group === g)}
          <button class="file" class:active={active === f.name} onclick={() => (active = f.name)}>
            <span class="mono">{f.name}</span>
            {#if gs}<span class="dot" class:ok={gs.score === 100} class:warn={gs.score < 100 && gs.score >= 50} class:bad={gs.score < 50}></span>{/if}
          </button>
        {/each}
      </nav>
    {/if}
    <div class="edit">
      {#if multi}<div class="small muted mono fname">{active}</div>{/if}
      {#key active}
        <Editor bind:value={st.files[active]} rows={multi ? 24 : 20} label={active} />
      {/key}
      <div class="row actions">
        <button class="btn primary" onclick={grade} disabled={busy}>{busy ? 'Checking…' : multi ? 'Check all' : 'Check'}</button>
        <button class="btn" onclick={persist}>Save draft</button>
        <button class="btn ghost" onclick={reset}>Reset file</button>
        <span class="spacer"></span>
        <button class="btn ghost" onclick={viewSolution}>View solution</button>
      </div>
    </div>
  </div>

  {#if error}<p class="callout bad small">{error}</p>{/if}

  {#if result}
    <div class="results">
      <div class="row between">
        <h3>{multi ? 'Readiness report' : 'Results'}</h3>
        <div class="row">
          <span class="chip" class:ok={result.passed} class:bad={!result.passed}>{result.passed ? 'Passed' : 'Not passed yet'}</span>
          <b>{result.score}%</b>
        </div>
      </div>
      <div class="progress" class:ok={result.passed}><span style="width:{result.score}%"></span></div>
      {#if result.criticalFailed}<p class="callout bad small">A critical rule (⛔) is failing, so the lab can't pass whatever the score.</p>{/if}
      {#if result.groups?.length}
        <div class="groups small">
          {#each result.groups as g}<span class="chip" class:ok={g.score === 100}>{g.group} {g.score}% · weight {g.weight}%</span>{/each}
        </div>
      {/if}
      <ul class="rlist">
        {#each fileRules as r}
          <li class:pass={r.pass} class:fail={!r.pass}>
            <span class="icon">{r.pass ? '✓' : r.critical ? '⛔' : '✗'}</span>
            <div>
              <div class="prose small">{@html r.html}</div>
              {#if !r.pass && r.message}<div class="small msg">{r.message}</div>{/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if solution}
    <details class="solution" open>
      <summary><b>Reference solution</b></summary>
      {#if solution.solutionHtml}<div class="prose small">{@html solution.solutionHtml}</div>
      {:else}<pre class="code">{solution.solution}</pre>{/if}
    </details>
  {/if}
</section>

<style>
  .lab { margin: 16px 0; }
  .brief { margin-top: 8px; }
  .rules { margin-top: 8px; }
  .work { margin-top: 12px; }
  .work.multi { display: grid; grid-template-columns: 250px 1fr; gap: 12px; }
  @media (max-width: 800px) { .work.multi { grid-template-columns: minmax(0, 1fr); } .files { max-height: 170px; border: 1px solid var(--border); border-radius: 8px; padding: 4px; } }
  .files { display: flex; flex-direction: column; gap: 2px; max-height: 560px; overflow: auto; }
  .file { display: flex; justify-content: space-between; align-items: center; gap: 6px; text-align: left; background: none; border: 1px solid transparent; border-radius: 7px; padding: 5px 8px; color: var(--text); cursor: pointer; font-size: 0.82rem; }
  .file:hover { background: var(--surface-2); }
  .file.active { border-color: var(--accent); background: var(--accent-soft); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex: none; }
  .dot.ok { background: var(--ok); } .dot.warn { background: var(--warn); } .dot.bad { background: var(--bad); }
  .fname { margin-bottom: 4px; }
  .actions { margin-top: 10px; }
  .spacer { flex: 1; }
  .results { margin-top: 16px; }
  .groups { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .rlist { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 6px; }
  .rlist li { display: flex; gap: 10px; padding: 8px 10px; border-radius: 8px; background: var(--surface-2); }
  .rlist li.pass .icon { color: var(--ok); }
  .rlist li.fail { background: var(--bad-soft); }
  .rlist li.fail .icon { color: var(--bad); }
  .icon { font-weight: 700; width: 18px; flex: none; }
  .msg { color: var(--bad); font-family: var(--mono); font-size: 0.8rem; margin-top: 2px; word-break: break-word; }
  .solution { margin-top: 14px; }
  .solution pre { margin-top: 8px; }
</style>
