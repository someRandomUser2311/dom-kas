<script>
  // Three kinds of pipeline simulators: put cards in order (with decoys),
  // a canary deployment job step by step, and checks that block runs.
  import { modeOf, sleep } from './lib.js';
  let { text, onsolved } = $props();
  const mode = modeOf(text, { canary: /prod stage expands|canary errors at 50%/i, checks: /checks on the service connection|replay from feature\/x/i }, 'cards');

  const SETS = [
    { re: /Rebuild image for prod/, cards: ['Build & push image (once)', 'Deploy dev (overlay dev, same tag)', 'Smoke test dev', 'Approval on prod environment', 'Deploy prod (overlay prod, same tag)'], decoys: { 'Rebuild image for prod': 'Prod would run an image that dev never tested.' } },
    { re: /apply -auto-approve/, cards: ['fmt/validate/lint/scan', 'plan -out=tfplan + publish artifact', 'approval (environment infra-prod)', 'apply tfplan'], decoys: { 'apply -auto-approve': 'That applies whatever Terraform plans now, not the plan that was approved.', 'plan again in apply stage': 'Re-planning means the approved plan isn’t what gets applied.' } },
    { re: /deploy on PR/, cards: ['lint + build-params', 'what-if (published to summary)', 'approval on infra-prod', 'what-if again + deploy (stack)'], decoys: { 'deploy on PR': 'A pull request run must never change Azure.', 'skip what-if on main': 'Approvers would be approving blind.' } },
    { re: /sign before scan/, cards: ['go test', 'docker build', 'trivy scan (fail on fixable HIGH/CRITICAL)', 'docker push (capture digest)', 'generate & attach SBOM', 'notation sign digest'], decoys: { 'sign before scan': 'You’d be signing an image nobody has checked.' }, alt: true },
  ];
  const set = SETS.find((s) => s.re.test(text)) || SETS[0];
  const all = [...set.cards, ...Object.keys(set.decoys)];
  let pool = $state(all.map((c, i) => [c, (i * 7 + 3) % all.length]).sort((a, b) => a[1] - b[1]).map((x) => x[0]));
  let seq = $state([]);
  let verdict = $state(null);
  const add = (c) => { seq = [...seq, c]; pool = pool.filter((x) => x !== c); verdict = null; };
  const remove = (c) => { pool = [...pool, c]; seq = seq.filter((x) => x !== c); verdict = null; };
  const move = (i, d) => { const s = [...seq]; [s[i], s[i + d]] = [s[i + d], s[i]]; seq = s; verdict = null; };
  function run() {
    const decoy = seq.find((c) => set.decoys[c]);
    if (decoy) { verdict = ['bad', `“${decoy}”: ${set.decoys[decoy]}`]; return; }
    if (seq.length < set.cards.length) { verdict = ['warn', `${set.cards.length - seq.length} step(s) still missing.`]; return; }
    let ok = seq.every((c, i) => c === set.cards[i]);
    if (!ok && set.alt) {
      const idx = (c) => seq.indexOf(c);
      ok = idx('go test') < idx('docker build') && idx('docker build') < idx('trivy scan (fail on fixable HIGH/CRITICAL)') && idx('trivy scan (fail on fixable HIGH/CRITICAL)') < idx('notation sign digest') && idx('docker push (capture digest)') < idx('notation sign digest') && idx('docker build') < idx('docker push (capture digest)') && idx('docker push (capture digest)') < idx('generate & attach SBOM');
    }
    if (ok) { verdict = ['ok', '✓ The pipeline runs in a safe order' + (Object.keys(set.decoys).length ? ', with the decoys left out.' : '.')]; onsolved(); }
    else { const i = seq.findIndex((c, k) => c !== set.cards[k]); verdict = ['bad', `Step ${i + 1} (“${seq[i]}”) is in the wrong place.`]; }
  }

  // canary
  let failAt50 = $state(false);
  let log = $state([]);
  let active = $state('');
  let running = $state(false);
  async function runCanary() {
    running = true; log = [];
    const push = async (k, s, cls = '') => { active = k; log = [...log, [s, cls]]; await sleep(650); };
    await push('pre', 'preDeploy: pull manifests');
    for (const inc of [10, 50]) {
      await push(`d${inc}`, `deploy: canary ${inc}% (KubernetesManifest@1 strategy: canary, percentage: ${inc})`);
      await push(`r${inc}`, `routeTraffic: ${inc}% of requests now go to the canary`);
      const bad = failAt50 && inc === 50;
      await push(`p${inc}`, bad ? `postRouteTraffic: 5xx ratio 4.1% > 1% → exit 1` : `postRouteTraffic: 5xx ratio 0.2% ≤ 1% ✓`, bad ? 'bad' : 'ok');
      if (bad) { await push('fail', 'on: failure → KubernetesManifest@1 action: reject — canary pods removed, stable keeps 100%', 'bad'); running = false; return; }
    }
    await push('ok', 'on: success → KubernetesManifest@1 action: promote — new version takes 100%', 'ok');
    running = false;
  }

  // checks
  let c = $state({ scBranch: false, scTemplate: false, envApproval: false, envBranch: false });
  let replay = $state(null);
  function outcome(run) {
    const blocked = [];
    if (c.scBranch && run.branch !== 'main') blocked.push('service connection branch control (main only)');
    if (c.scTemplate && !run.template) blocked.push('service connection required template');
    if (run.env && c.envBranch && run.branch !== 'main') blocked.push('environment branch control');
    if (blocked.length) return ['ok', `Blocked by ${blocked.join(' and ')}.`];
    if (run.env && c.envApproval) return ['warn', 'Waiting for approval on the prod environment.'];
    return ['bad', 'Runs: it deploys to prod with nobody stopping it.'];
  }
  const RUNS = [
    { name: 'feature/x, edited YAML: plain job using sc-orders-prod', branch: 'feature/x', template: false, env: false, want: 'ok' },
    { name: 'main, pipeline that doesn’t extend the template', branch: 'main', template: false, env: true, want: 'ok' },
    { name: 'main, extends the required template', branch: 'main', template: true, env: true, want: 'warn' },
  ];
  function doReplay() {
    replay = RUNS.map((r) => ({ ...r, out: outcome(r) }));
    if (replay.every((r) => r.out[0] === r.want) && c.envApproval && c.envBranch && c.scBranch && c.scTemplate) onsolved();
  }
</script>

<div class="wg">
  {#if mode === 'cards'}
    <div class="small muted">Click cards to build the pipeline in order. Leave anything unsafe in the tray.</div>
    <div class="tiles">{#each pool as p}<button class="tile cardb" onclick={() => add(p)}>+ {p}</button>{/each}</div>
    <ol class="seq">
      {#each seq as s, i}
        <li><span class="tile ready">{s}</span>
          <button class="btn ghost small" disabled={i === 0} onclick={() => move(i, -1)}>↑</button><button class="btn ghost small" disabled={i === seq.length - 1} onclick={() => move(i, 1)}>↓</button><button class="btn ghost small" onclick={() => remove(s)}>✕</button></li>
      {:else}<li class="small muted">The pipeline is empty.</li>{/each}
    </ol>
    <div class="wg-bar"><button class="btn small primary" onclick={run} disabled={!seq.length}>▶ Run the pipeline</button></div>
    {#if verdict}<div class="wg-msg {verdict[0]}">{verdict[1]}</div>{/if}
  {:else if mode === 'canary'}
    <div class="wg-bar"><label><input type="checkbox" bind:checked={failAt50} disabled={running} /> canary errors at 50%</label><button class="btn small primary" onclick={runCanary} disabled={running}>▶ Run DeployProd</button></div>
    <div class="flowline small">
      {#each [['pre', 'preDeploy'], ['d10', 'deploy 10%'], ['r10', 'route'], ['p10', 'check'], ['d50', 'deploy 50%'], ['r50', 'route'], ['p50', 'check'], ['ok', 'promote'], ['fail', 'reject']] as [k, l], i}
        {#if i}<span class="arrow">→</span>{/if}<span class="hop" class:on={active === k} class:bad={active === k && (k === 'fail' || (k === 'p50' && failAt50))}>{l}</span>
      {/each}
    </div>
    <div class="wg-log">{#each log as [l, cls]}<div class={cls}>{l}</div>{/each}</div>
  {:else}
    <div class="two-col">
      <div class="wg-panel small"><b>Service connection sc-orders-prod</b>
        <label><input type="checkbox" bind:checked={c.scBranch} /> Branch control: main only</label>
        <label><input type="checkbox" bind:checked={c.scTemplate} /> Required template: templates/secure-deploy.yml</label></div>
      <div class="wg-panel small"><b>Environment prod</b>
        <label><input type="checkbox" bind:checked={c.envApproval} /> Approval: grp-release-managers</label>
        <label><input type="checkbox" bind:checked={c.envBranch} /> Branch control: main only</label></div>
    </div>
    <button class="btn small primary" onclick={doReplay}>▶ Replay the runs</button>
    {#if replay}
      <table class="small"><tbody>{#each replay as r}<tr><td>{r.name}</td><td class={r.out[0] === r.want ? 'yes' : 'no'}>{r.out[1]}</td></tr>{/each}</tbody></table>
    {/if}
  {/if}
</div>

<style>
  .cardb { cursor: pointer; color: var(--text); font-family: var(--font); font-size: 0.82rem; }
  .seq { display: grid; gap: 4px; padding-left: 22px; }
  .seq li { display: flex; align-items: center; gap: 4px; }
  .seq .tile { flex: 1; font-family: var(--font); font-size: 0.85rem; }
  label { display: flex; gap: 6px; align-items: center; margin: 6px 0; }
</style>
