/* L7.5 · Stages, conditions &amp; approvals — guided lesson content (loaded by lesson.html?l=ch07/l5) */
// ---- simulator widget -----------------------------------------------------
function simHtml() {
  return `<div class="card">
    <div style="display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:10px">
      <label class="toggle"><input type="checkbox" id="s-build"><span class="track"></span>Tests fail</label>
      <label class="toggle"><input type="checkbox" id="s-scan"><span class="track"></span>Scan fails</label>
      <div class="tabs" id="s-branch"><button class="tab active" data-v="main">main</button><button class="tab" data-v="feature/cart">feature/cart</button></div>
      <div class="tabs" id="s-appr"><button class="tab active" data-v="pending">⏸ Pending</button><button class="tab" data-v="approved">✓ Approved</button><button class="tab" data-v="rejected">✕ Rejected</button></div>
    </div>
    <div id="graph"></div>
    <div class="seq-msg" id="sim-msg" style="min-height:0;margin-top:8px"></div></div>`;
}
function wireSim(el, onChange) {
  const S = { build: false, scan: false, branch: "main", appr: "pending" };
  const tabs = (id, k) => el.querySelectorAll(`#${id} .tab`).forEach(t => t.onclick = () => { el.querySelectorAll(`#${id} .tab`).forEach(x => x.classList.toggle("active", x === t)); S[k] = t.dataset.v; run(); });
  tabs("s-branch", "branch"); tabs("s-appr", "appr");
  el.querySelector("#s-build").onchange = e => { S.build = e.target.checked; run(); };
  el.querySelector("#s-scan").onchange = e => { S.scan = e.target.checked; run(); };
  function run() {
    const st = {}, n = {};
    st.Build = S.build ? "failed" : "succeeded"; n.Build = S.build ? "npm test failed" : "image pushed";
    st.Scan = S.scan ? "failed" : "succeeded"; n.Scan = S.scan ? "critical CVEs" : "clean";
    if (st.Build !== "succeeded" || st.Scan !== "succeeded") { st.Dev = "skipped"; n.Dev = "dependency failed"; } else { st.Dev = "succeeded"; n.Dev = "deployed to dev"; }
    if (st.Dev !== "succeeded") { st.Prod = "skipped"; n.Prod = "DeployDev didn't succeed"; }
    else if (S.branch !== "main") { st.Prod = "skipped"; n.Prod = "condition false: not main"; }
    else if (S.appr === "pending") { st.Prod = "waiting"; n.Prod = "waiting for approval"; }
    else if (S.appr === "approved") { st.Prod = "succeeded"; n.Prod = "deployed to prod"; }
    else { st.Prod = "failed"; n.Prod = "approval rejected"; }
    const anyFail = ["Build", "Scan", "Dev", "Prod"].some(k => st[k] === "failed");
    st.Notify = anyFail ? "succeeded" : "skipped"; n.Notify = anyFail ? "failed() = true" : "failed() = false";
    KQG.render(el.querySelector("#graph"), { stages: [
      { name: "Build", displayName: "Build", dependsOn: [], state: st.Build, note: n.Build },
      { name: "Scan", displayName: "Scan", dependsOn: [], state: st.Scan, note: n.Scan },
      { name: "Dev", displayName: "Deploy · dev", dependsOn: ["Build", "Scan"], state: st.Dev, note: n.Dev },
      { name: "Prod", displayName: "Deploy · prod", dependsOn: ["Dev"], state: st.Prod, note: n.Prod, condition: "main only" },
      { name: "Notify", displayName: "Notify", dependsOn: ["Prod"], state: st.Notify, note: n.Notify },
    ] });
    el.querySelector("#sim-msg").innerHTML = anyFail && (S.build || S.scan) ? "A failure upstream skips every stage using the default <code>succeeded()</code>. Only <code>Notify</code> (<code>failed()</code>) runs."
      : S.branch !== "main" ? "All green, but prod's branch condition is false, so it's <b>skipped</b>, not failed."
      : S.appr === "pending" ? "The run <b>pauses</b> before the prod job; no agent is held while waiting."
      : S.appr === "approved" ? "Approved: prod deploys and the environment records the run." : "Rejected approval = failed check, so <code>Notify</code> fires.";
    onChange && onChange(st, S);
  }
  run();
}
const STR_YAML = {
  once: `strategy:
  runOnce:
    deploy:
      steps:
        - task: KubernetesManifest@1
          inputs:
            action: deploy
            manifests: k8s/*.yaml`,
  canary: `strategy:
  canary:
    increments: [25]
    deploy:
      steps:
        - task: KubernetesManifest@1
          inputs: { action: deploy, strategy: canary, percentage: $(strategy.increment), manifests: k8s/*.yaml }
    on:
      failure:
        steps:
          - task: KubernetesManifest@1
            inputs: { action: reject, strategy: canary, manifests: k8s/*.yaml }
      success:
        steps:
          - task: KubernetesManifest@1
            inputs: { action: promote, strategy: canary, manifests: k8s/*.yaml }`,
};

window.LESSON = {
  id: "l5", code: "L7.5", short: "Stages & approvals", title: "Stages, conditions, environments & approvals",
  file: "azure-pipelines.yml", reference: "lesson-5-reference.html",
  next: { href: "lesson.html?l=ch07/l6", title: "Variables, secrets & templates" },
  steps: [
    { title: "Stages run in order by default",
      body: "<p>Without any extra keys, each stage <b>implicitly depends on the one above it</b> and only runs if that one succeeded.</p><p>Good for a simple Build → Deploy. Real pipelines need more shape.</p>",
      code: `stages:
  - stage: Build
    jobs: [ ... ]

  - stage: Deploy        # implicitly: dependsOn: Build
    jobs: [ ... ]`,
      coming: { gha: "Like jobs chained with <code>needs:</code>, except here the chain is implicit.", gitlab: "Identical to stage ordering in <code>stages:</code>.", jenkins: "Sequential <code>stage</code> blocks.", classic: "Release stages triggered \"after previous stage\"." } },

    { title: "Run things in parallel",
      body: "<p>A security scan doesn't need the build to finish. <code>dependsOn: []</code> removes the implicit dependency so <code>Scan</code> starts immediately, <b>alongside</b> Build.</p>",
      code: `stages:
  - stage: Build
    jobs: [ ... ]

  - stage: Scan
    dependsOn: []         # no dependencies, so it starts right away
    jobs: [ ... ]`,
      coming: { gha: "A job without <code>needs:</code>.", gitlab: "Put both jobs in the same stage, or use <code>needs: []</code>.", jenkins: "A <code>parallel { }</code> block.", classic: "Parallel release stages." } },

    { title: "Fan in: wait for both",
      body: "<p>Give <code>dependsOn</code> a list and the stage waits for <b>all</b> of them. Deploy-dev now needs Build <em>and</em> Scan to succeed.</p>",
      code: `stages:
  - stage: Build
    jobs: [ ... ]

  - stage: Scan
    dependsOn: []         # no dependencies, so it starts right away
    jobs: [ ... ]

  - stage: DeployDev
    dependsOn: [Build, Scan]
    jobs: [ ... ]`,
      more: "<p>The run view draws this as a graph: Build and Scan side by side, both feeding DeployDev. You'll see it in the simulator in two steps.</p>" },

    { title: "Conditions decide whether a stage runs",
      body: "<p><code>condition</code> is evaluated after dependencies finish. The default is <code>succeeded()</code>.</p><p>Prod should deploy only from <code>main</code>. ⚠️ A custom condition <b>replaces</b> the default, so include <code>succeeded()</code> yourself.</p>",
      code: `stages:
  - stage: Build
    jobs: [ ... ]

  - stage: Scan
    dependsOn: []         # no dependencies, so it starts right away
    jobs: [ ... ]

  - stage: DeployDev
    dependsOn: [Build, Scan]
    jobs: [ ... ]

  - stage: DeployProd
    dependsOn: DeployDev
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs: [ ... ]`,
      coming: { gha: "<code>if: github.ref == 'refs/heads/main'</code>. In Actions, <code>success()</code> is implicitly ANDed; in Azure it's <b>replaced</b>.", gitlab: "<code>rules: - if: $CI_COMMIT_BRANCH == \"main\"</code>.", jenkins: "<code>when { branch 'main' }</code>.", classic: "Stage trigger filters / custom conditions." },
      more: "<p>Other useful functions: <code>failed()</code>, <code>succeededOrFailed()</code> (not when cancelled), <code>always()</code>, <code>ne(variables['Build.Reason'], 'PullRequest')</code> to never deploy from PRs.</p>" },

    { title: "Quick check: the dangerous condition",
      body: "<p>Someone writes <code>condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')</code> on DeployProd. On <code>main</code>, the tests <b>fail</b>.</p>",
      check: { type: "mcq", q: "What happens to DeployProd?", explain: "The custom condition replaced <code>succeeded()</code>, so it only checks the branch. A broken build ships to prod! Always write <code>and(succeeded(), …)</code>.",
        options: [
          { t: "Skipped, because a dependency failed", why: "That's what <code>succeeded()</code> would do, but this condition doesn't include it." },
          { t: "It runs and deploys the broken build", ok: true },
          { t: "The pipeline fails to compile", why: "The expression is valid; it's just wrong." } ] } },

    { title: "Play with the full pipeline",
      body: "<p>Here are Build ∥ Scan → Deploy dev → Deploy prod (main only, approval required) → Notify (<code>failed()</code>).</p><p>Flip the switches and watch which stages run, skip, wait or fail.</p>",
      panel: simHtml, onShow: el => wireSim(el) },

    { title: "Your turn: skipped, not failed",
      body: "<p>The difference between <b>skipped</b> and <b>failed</b> matters: skipped stages don't trigger <code>failed()</code> alerts.</p>",
      panel: simHtml,
      check: { type: "custom", q: "Make <b>Deploy · prod</b> skipped while <b>nothing fails</b> and <b>dev still deploys</b>.", explain: "A feature branch with green tests: dev gets the build, prod's branch condition is false so it's skipped, and Notify stays quiet." },
      onShow(el, api) {
        let first = true;
        wireSim(el, (st) => {
          if (first) { first = false; return; }
          const fails = Object.values(st).filter(x => x === "failed").length;
          if (st.Prod === "skipped" && !fails && st.Dev === "succeeded") api.solve();
          else if (st.Prod === "skipped" && st.Dev !== "succeeded") api.miss("Prod is skipped, but so is dev, because something failed. Keep everything green.");
        });
      } },

    { title: "Environments hold the gates",
      body: "<p><code>environment: prod</code> on a deployment job targets an <b>environment</b> object in Azure DevOps. It records history (which commit is live?) and runs <b>checks</b> before any job targeting it starts.</p>",
      panel: `<div class="grid grid-2" style="gap:10px">
        <div class="card card-tight"><b>✅ Approvals</b><p class="subtle" style="margin:4px 0 0">Named people or groups must approve</p></div>
        <div class="card card-tight"><b>🌿 Branch control</b><p class="subtle" style="margin:4px 0 0">Only <code>main</code> may deploy</p></div>
        <div class="card card-tight"><b>🕘 Business hours</b><p class="subtle" style="margin:4px 0 0">No Friday-night deploys</p></div>
        <div class="card card-tight"><b>🔒 Exclusive lock</b><p class="subtle" style="margin:4px 0 0">One deployment at a time</p></div>
        <div class="card card-tight"><b>🌐 REST / Function</b><p class="subtle" style="margin:4px 0 0">Ask an external system first</p></div>
        <div class="card card-tight"><b>📋 Required template</b><p class="subtle" style="margin:4px 0 0">Only approved templates deploy</p></div></div>`,
      coming: { gha: "Environment protection rules (required reviewers, wait timer, branch rules).", gitlab: "Protected environments + deployment approvals.", jenkins: "<code>input</code> steps, but defined <em>inside</em> the Jenkinsfile.", classic: "Pre-deployment approvals and gates on a release stage." } },

    { title: "Quick check: why not in YAML?",
      body: "<p>Approvals and checks are configured on the environment in the Azure DevOps UI, not in <code>azure-pipelines.yml</code>.</p>",
      check: { type: "mcq", q: "Why?", explain: "Anyone who can push a branch can edit YAML. Checks owned by the environment's admins can't be removed by the people they're meant to control.",
        options: [
          { t: "YAML doesn't support approvals yet", why: "It's a deliberate design choice, not a missing feature." },
          { t: "So that people who can edit the pipeline can't remove the gate", ok: true },
          { t: "It's faster to evaluate checks in the UI", why: "Performance has nothing to do with it." } ] } },

    { title: "Deployment strategies",
      body: "<p><code>runOnce</code> is the common choice on AKS, because the Kubernetes Deployment already does a <b>rolling update</b>.</p><p><code>canary</code> sends a slice of traffic to the new version first, then you <b>promote</b> or <b>reject</b>. (<code>rolling</code> in Azure Pipelines is for VM environments.)</p>",
      panel: () => `<div class="tabs" id="str"><button class="tab active" data-s="once">runOnce</button><button class="tab" data-s="canary">canary</button></div><div id="str-code"></div>`,
      onShow(el) {
        const show = k => { el.querySelectorAll("#str .tab").forEach(t => t.classList.toggle("active", t.dataset.s === k)); KQY.block(el.querySelector("#str-code"), STR_YAML[k], { title: k + " strategy" }); };
        el.querySelectorAll("#str .tab").forEach(t => t.onclick = () => show(t.dataset.s));
        show("once");
      } },

    { summary: true, title: "You can shape a delivery pipeline",
      body: "Parallel stages, fan-in, conditions that keep <code>succeeded()</code>, gates owned by environments, and the right deployment strategy for AKS.",
      panel: `<div class="card"><ul class="list-check" style="font-size:15px"><li><code>dependsOn: []</code> → parallel</li><li><code>dependsOn: [A, B]</code> → fan-in</li><li>Custom conditions replace <code>succeeded()</code></li><li>Approvals &amp; checks live on environments</li><li>AKS: <code>runOnce</code> + Deployment rolling update, or <code>canary</code></li></ul></div>` },
  ],
};
