<script>
  // The interactive Chapter 7 panels ported from the original preview.
  import { highlight } from '../lib/util.js';
  let { name, onsolved } = $props();

  const FLOW = [
    ['👩‍💻', 'git push', 'A developer pushes to main. Azure Pipelines watches the repo; the YAML’s trigger decides whether a run starts.'],
    ['⚡', 'Trigger', 'A run is queued. Azure DevOps reads azure-pipelines.yml from that exact commit.'],
    ['🖥️', 'Agent', 'An agent picks up the job: a VM or container with build tools, Microsoft-hosted or your own.'],
    ['🧪', 'Test', 'CI happens here. Restore, compile, run unit tests. A failing test stops everything after it.'],
    ['📦', 'Push to ACR', 'The image is built and pushed to Azure Container Registry with a unique tag such as $(Build.BuildId).'],
    ['🛑', 'Approval', 'Optional human gate on the prod environment: the line between Continuous Delivery and Continuous Deployment.'],
    ['☸️', 'Deploy', 'Manifests are applied to AKS with the new tag. AKS pulls the image from ACR and rolls out new pods.'],
  ];
  const flowCfg = { 'l1-step2': [4, 3], 'l1-step3': [5, 4] }[name];
  let cur = $state(0);
  let gate = $state(true);

  // agents
  const AGENTS = [
    { name: 'build-02', caps: { 'Agent.OS': 'Linux', docker: true, vnet: 'corp' } },
    { name: 'build-01', caps: { 'Agent.OS': 'Linux', docker: true, vnet: 'aks-private' } },
    { name: 'win-01', caps: { 'Agent.OS': 'Windows_NT', docker: false, vnet: 'aks-private' } },
  ];
  const DEMANDS = ['Agent.OS -equals Linux', 'docker', 'vnet -equals aks-private'];
  let demands = $state({ [DEMANDS[0]]: true, [DEMANDS[1]]: true, [DEMANDS[2]]: false });
  let dispatched = $state(null);
  const meets = (a, d) => (d === 'docker' ? !!a.caps.docker : ((m) => (m ? a.caps[m[1]] === m[2] : true))(d.match(/^([\w.]+) -equals (.+)$/)));
  function dispatch() {
    const ds = DEMANDS.filter((d) => demands[d]);
    const ok = AGENTS.map((a) => ds.every((d) => meets(a, d)));
    const pick = AGENTS.find((_, i) => ok[i]);
    let msg = pick ? `✅ Assigned to ${pick.name} (vnet=${pick.caps.vnet}).` : '❌ No agent satisfies all demands. The run fails with "No agent found in pool…"';
    let tone = pick ? '' : 'bad';
    if (name === 'l3-step8') {
      if (pick && pick.caps.vnet === 'aks-private' && pick.caps.docker) { tone = 'ok'; onsolved(); }
      else if (pick) { tone = 'warn'; msg += ` ${pick.name} is in ${pick.caps.vnet}${pick.caps.docker ? '' : ' and has no Docker'}. Add a demand so only agents in the right VNet qualify.`; }
      else msg += ' Too strict: keep the Linux + docker demands and add the network one.';
    }
    dispatched = { ok, msg, tone };
  }

  // service connection form
  let f = $state({ identity: '', cred: '', sub: '', rg: '', name: '', all: true });
  let formMsg = $state(null);
  function save() {
    const rules = [
      [!!f.identity, 'Choose an identity type. App registration (automatic) is easiest.'],
      [f.cred === 'wif', 'Use workload identity federation, not a secret.'],
      [f.sub === 'KubeQuest-Dev', 'Dev pipelines should only reach the KubeQuest-Dev subscription.'],
      [f.rg === 'rg-orders-dev', 'Scope it to rg-orders-dev. Empty means the whole subscription.'],
      [f.name.trim() === 'azure-orders-dev', 'Name it exactly azure-orders-dev; pipelines reference it by name.'],
      [!f.all, 'Untick “Grant access to all pipelines” and authorize pipelines individually.'],
    ];
    const bad = rules.filter((r) => !r[0]);
    formMsg = bad.length ? ['bad', `${rules.length - bad.length}/${rules.length} correct. ${bad[0][1]}`] : ['ok', '✓ Saved: a least-privilege, secretless connection.'];
    if (!bad.length) onsolved();
  }

  // stage simulator
  let S = $state({ build: false, scan: false, branch: 'main', appr: 'pending' });
  let touched = $state(false);
  const st = $derived.by(() => {
    const s = {}, n = {};
    s.Build = S.build ? 'failed' : 'succeeded'; n.Build = S.build ? 'go test failed' : 'image pushed';
    s.Scan = S.scan ? 'failed' : 'succeeded'; n.Scan = S.scan ? 'critical CVEs' : 'clean';
    if (s.Build !== 'succeeded' || s.Scan !== 'succeeded') { s.Dev = 'skipped'; n.Dev = 'dependency failed'; } else { s.Dev = 'succeeded'; n.Dev = 'deployed to dev'; }
    if (s.Dev !== 'succeeded') { s.Prod = 'skipped'; n.Prod = "DeployDev didn't succeed"; }
    else if (S.branch !== 'main') { s.Prod = 'skipped'; n.Prod = 'condition false: not main'; }
    else if (S.appr === 'pending') { s.Prod = 'waiting'; n.Prod = 'waiting for approval'; }
    else if (S.appr === 'approved') { s.Prod = 'succeeded'; n.Prod = 'deployed to prod'; }
    else { s.Prod = 'failed'; n.Prod = 'approval rejected'; }
    const anyFail = ['Build', 'Scan', 'Dev', 'Prod'].some((k) => s[k] === 'failed');
    s.Notify = anyFail ? 'succeeded' : 'skipped'; n.Notify = anyFail ? 'failed() = true' : 'failed() = false';
    return { s, n, anyFail };
  });
  const simMsg = $derived(st.anyFail && (S.build || S.scan) ? 'A failure upstream skips every stage using the default succeeded(). Only Notify (failed()) runs.'
    : S.branch !== 'main' ? 'All green, but prod’s branch condition is false, so it’s skipped, not failed.'
    : S.appr === 'pending' ? 'The run pauses before the prod job; no agent is held while waiting.'
    : S.appr === 'approved' ? 'Approved: prod deploys and the environment records the run.' : 'Rejected approval = failed check, so Notify fires.');
  $effect(() => {
    if (name !== 'l5-step7' || !touched) return;
    const fails = Object.values(st.s).filter((x) => x === 'failed').length;
    if (st.s.Prod === 'skipped' && !fails && st.s.Dev === 'succeeded') onsolved();
  });
  const set = (k, v) => { S[k] = v; touched = true; };

  // strategies
  let strat = $state('once');
  const STR = {
    once: 'strategy:\n  runOnce:\n    deploy:\n      steps:\n        - task: KubernetesManifest@1\n          inputs:\n            action: deploy\n            manifests: k8s/*.yaml',
    canary: 'strategy:\n  canary:\n    increments: [25]\n    deploy:\n      steps:\n        - task: KubernetesManifest@1\n          inputs: { action: deploy, strategy: canary, percentage: $(strategy.increment), manifests: k8s/*.yaml }\n    on:\n      failure:\n        steps:\n          - task: KubernetesManifest@1\n            inputs: { action: reject, strategy: canary, manifests: k8s/*.yaml }\n      success:\n        steps:\n          - task: KubernetesManifest@1\n            inputs: { action: promote, strategy: canary, manifests: k8s/*.yaml }',
  };

  // variable syntaxes
  const D = '$';
  const EXPR = { compile: D + '{{ variables.env }}', runtime: D + '[ variables.env ]', macro: D + '(env)' };
  const PH = [['🧩', 'Compile', 'compile'], ['📥', 'Queue', 'queue'], ['▶️', 'Job starts', 'runtime'], ['🔧', 'Step 1 sets env=prod', 'step1'], ['🔧', 'Step 2 runs', 'macro']];
  const SYN = {
    compile: ['dev', 'Replaced at compile time, before anything runs, with the value known then: dev. That’s also why ' + D + '{{ if }} can add or remove whole steps.'],
    runtime: ['dev', 'Runtime expressions live in variable definitions and conditions. Evaluated when the job starts, so they see dev. Their superpower is reading outputs of earlier jobs.'],
    macro: ['prod', 'Macros expand right before each task runs, so step 2 sees what step 1 just set: prod. The everyday default.'],
  };
  let syn = $state('compile');
  const code = $derived(`variables:\n  env: dev                       # value when the run is queued\n\nsteps:\n  - script: echo "##vso[task.setvariable variable=env]prod"\n  - script: echo "I see: ${EXPR[syn]}"`);
</script>

<div class="wg">
  {#if flowCfg}
    <div class="flowline">{#each FLOW.slice(0, flowCfg[0]) as s, i}{#if i}<span class="arrow">→</span>{/if}<span class="hop" class:on={i === flowCfg[1]} class:done={i < flowCfg[1]}>{s[0]} {s[1]}</span>{/each}</div>
  {:else if name === 'l1-step4'}
    <label class="small"><input type="checkbox" bind:checked={gate} /> Require approval before prod</label>
    <div class="flowline">{#each FLOW.filter((s) => gate || s[1] !== 'Approval') as s, i}{#if i}<span class="arrow">→</span>{/if}<span class="hop" class:on={s[1] === 'Approval'} class:done={s[1] !== 'Approval'}>{s[0]} {s[1]}</span>{/each}</div>
    <div class="wg-msg">{gate ? 'Continuous Delivery. Every green build could go to prod; a person decides when.' : 'Continuous Deployment. Every green build goes to prod automatically. This needs excellent tests and monitoring.'}</div>
  {:else if name === 'l1-step6'}
    <div class="flowline">{#each FLOW as s, i}{#if i}<span class="arrow">→</span>{/if}<button class="hop" class:on={i === cur} class:done={i < cur} onclick={() => (cur = i)}>{s[0]} {s[1]}</button>{/each}</div>
    <div class="wg-msg"><b>Step {cur + 1} · {FLOW[cur][1]}</b><br />{FLOW[cur][2]}</div>
    <div class="wg-bar"><button class="btn small" onclick={() => (cur = Math.max(0, cur - 1))}>← Back</button><button class="btn small primary" onclick={() => (cur = (cur + 1) % FLOW.length)}>Next →</button><span class="small muted">{cur + 1} / {FLOW.length}</span></div>
  {:else if name === 'l3-step7' || name === 'l3-step8'}
    <div class="kicker">Pool: linux-builders · job demands</div>
    <div class="wg-bar">{#each DEMANDS as d}<label><input type="checkbox" bind:checked={demands[d]} /> <code>{d}</code></label>{/each}</div>
    <div class="tiles">{#each AGENTS as a, i}<span class="tile" class:ready={dispatched?.ok[i]} class:dim={dispatched && !dispatched.ok[i]}><b>🖥️ {a.name}</b>Agent.OS={a.caps['Agent.OS']}{a.caps.docker ? ' · docker' : ''} · vnet={a.caps.vnet}</span>{/each}</div>
    <div class="wg-bar"><button class="btn small primary" onclick={dispatch}>▶ Dispatch job</button></div>
    {#if dispatched}<div class="wg-msg {dispatched.tone}">{dispatched.msg}</div>{/if}
  {:else if name === 'l4-step9'}
    <div class="wg-panel form">
      <b>🔷 New Azure service connection</b>
      <label>Identity type <select bind:value={f.identity}><option value="">Select…</option><option value="auto">App registration (automatic)</option><option value="manual">App registration or managed identity (manual)</option><option value="mi">Managed identity</option></select></label>
      <div class="small">Credential
        <label class="rc"><input type="radio" bind:group={f.cred} value="wif" /> Workload identity federation <span class="muted">— short-lived OIDC tokens, no secret</span></label>
        <label class="rc"><input type="radio" bind:group={f.cred} value="secret" /> Secret <span class="muted">— stored client secret, must be rotated</span></label></div>
      <label>Subscription <select bind:value={f.sub}><option value="">Select…</option><option>KubeQuest-Dev</option><option>KubeQuest-Prod</option></select></label>
      <label>Resource group <select bind:value={f.rg}><option value="">(none: entire subscription)</option><option>rg-orders-dev</option><option>rg-orders-prod</option></select></label>
      <label>Service connection name <input class="mono" bind:value={f.name} placeholder="e.g. azure-orders-dev" /></label>
      <label class="rc"><input type="checkbox" bind:checked={f.all} /> Grant access permission to all pipelines</label>
      <button class="btn primary small" onclick={save}>Save</button>
    </div>
    {#if formMsg}<div class="wg-msg {formMsg[0]}">{formMsg[1]}</div>{/if}
  {:else if name === 'l5-step6' || name === 'l5-step7'}
    <div class="wg-bar">
      <label><input type="checkbox" checked={S.build} onchange={(e) => set('build', e.target.checked)} /> Tests fail</label>
      <label><input type="checkbox" checked={S.scan} onchange={(e) => set('scan', e.target.checked)} /> Scan fails</label>
      <span class="seg">{#each ['main', 'feature/cart'] as b}<button class:on={S.branch === b} onclick={() => set('branch', b)}>{b}</button>{/each}</span>
      <span class="seg">{#each [['pending', '⏸ Pending'], ['approved', '✓ Approved'], ['rejected', '✕ Rejected']] as [k, l]}<button class:on={S.appr === k} onclick={() => set('appr', k)}>{l}</button>{/each}</span>
    </div>
    <div class="graph">
      <div class="col">{#each ['Build', 'Scan'] as k}<div class="stage {st.s[k]}"><b>{k}</b><span>{st.s[k]} · {st.n[k]}</span></div>{/each}</div>
      <span class="arrow">→</span>
      <div class="col"><div class="stage {st.s.Dev}"><b>Deploy · dev</b><span>{st.s.Dev} · {st.n.Dev}</span></div></div>
      <span class="arrow">→</span>
      <div class="col"><div class="stage {st.s.Prod}"><b>Deploy · prod</b><span>{st.s.Prod} · {st.n.Prod}</span></div></div>
      <span class="arrow">→</span>
      <div class="col"><div class="stage {st.s.Notify}"><b>Notify</b><span>{st.s.Notify} · {st.n.Notify}</span></div></div>
    </div>
    <div class="wg-msg">{simMsg}</div>
  {:else if name === 'l5-step10'}
    <span class="seg"><button class:on={strat === 'once'} onclick={() => (strat = 'once')}>runOnce</button><button class:on={strat === 'canary'} onclick={() => (strat = 'canary')}>canary</button></span>
    <pre class="code">{@html highlight(STR[strat])}</pre>
  {:else if name === 'l6-step3'}
    <pre class="code">{@html highlight(code)}</pre>
    <span class="seg">{#each Object.entries(EXPR) as [k, e]}<button class:on={syn === k} onclick={() => (syn = k)}><code>{e}</code></button>{/each}</span>
    <div class="flowline">{#each PH as p, i}{@const at = PH.findIndex((x) => x[2] === syn)}{#if i}<span class="arrow">→</span>{/if}<span class="hop" class:on={i === at} class:done={i < at}>{p[0]} {p[1]}</span>{/each}</div>
    <div class="wg-msg"><b class="mono">OUTPUT → "I see: {SYN[syn][0]}"</b><br />{SYN[syn][1]}</div>
  {/if}
</div>

<style>
  .form label { display: grid; gap: 3px; margin: 8px 0; font-size: 0.85rem; }
  .rc { display: flex !important; gap: 6px; align-items: center; }
  .rc input { width: auto; }
  .graph { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .col { display: grid; gap: 6px; }
  .stage { border: 1.5px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 0.78rem; display: grid; background: var(--surface); min-width: 120px; }
  .stage.succeeded { border-color: var(--ok); background: var(--ok-soft); }
  .stage.failed { border-color: var(--bad); background: var(--bad-soft); }
  .stage.skipped { opacity: 0.55; border-style: dashed; }
  .stage.waiting { border-color: var(--warn); background: var(--warn-soft); }
  .arrow { color: var(--muted); }
</style>
