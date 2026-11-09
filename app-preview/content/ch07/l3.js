/* L7.3 · Agents and agent pools — guided lesson content (loaded by lesson.html?l=ch07/l3) */
// ---- agent matcher widget -------------------------------------------------
const AGENTS = [
  { name: "build-02", caps: { "Agent.OS": "Linux", docker: true, vnet: "corp" }, busy: false },
  { name: "build-01", caps: { "Agent.OS": "Linux", docker: true, vnet: "aks-private" }, busy: false },
  { name: "win-01", caps: { "Agent.OS": "Windows_NT", docker: false, vnet: "aks-private" }, busy: false },
];
const DEMANDS = ["Agent.OS -equals Linux", "docker", "vnet -equals aks-private"];
function matcherHtml(preset) {
  return `<div class="card">
    <div class="kicker" style="margin-bottom:8px">Pool: linux-builders · job demands</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px">${DEMANDS.map(d => `<label class="toggle"><input type="checkbox" data-d="${d}" ${preset.includes(d) ? "checked" : ""}><span class="track"></span><code>${d}</code></label>`).join("")}</div>
    <div class="agents" id="agents"></div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" id="dispatch">▶ Dispatch job</button><span class="subtle" id="dres">Toggle demands, then dispatch.</span></div></div>`;
}
function wireMatcher(el, onResult) {
  const meets = (a, d) => d === "docker" ? !!a.caps.docker : (m => m ? a.caps[m[1]] === m[2] : true)(d.match(/^([\w.]+) -equals (.+)$/));
  const draw = (state = {}) => el.querySelector("#agents").innerHTML = AGENTS.map(a => `<div class="agent ${state[a.name] || ""}">
      <div class="ag-name">🖥️ ${a.name} <span class="badge badge-success" style="height:18px">idle</span></div>
      <div class="caps"><span>Agent.OS=${a.caps["Agent.OS"]}</span>${a.caps.docker ? "<span>docker</span>" : ""}<span>vnet=${a.caps.vnet}</span></div></div>`).join("");
  el.querySelector("#dispatch").onclick = () => {
    const ds = [...el.querySelectorAll("[data-d]:checked")].map(i => i.dataset.d);
    const state = {}; let pick = null;
    AGENTS.forEach(a => { const ok = ds.every(d => meets(a, d)); state[a.name] = ok ? "match" : "nomatch"; if (ok && !pick) pick = a; });
    draw(state);
    el.querySelector("#dres").innerHTML = pick ? `✅ Assigned to <code>${pick.name}</code> (vnet=${pick.caps.vnet}).` : "❌ <b>No agent satisfies all demands.</b> The run fails with \"No agent found in pool…\"";
    onResult && onResult(pick, ds);
  };
  draw();
}

window.LESSON = {
  id: "l3", code: "L7.3", short: "Agents & pools", title: "Agents and agent pools",
  file: "azure-pipelines.yml", reference: "lesson-3-reference.html",
  next: { href: "lesson.html?l=ch07/l4", title: "Service connections & ACR" },
  steps: [
    { title: "Who actually runs your YAML?",
      body: "<p>Your YAML is only instructions. An <b>agent</b> executes them: a small program on a VM or container that <b>polls</b> Azure DevOps for work, runs the job's steps, and streams logs back.</p><p>Because the agent polls <em>outwards</em>, it doesn't need any inbound ports. That's important for agents inside private networks.</p>",
      panel: `<div class="card"><div class="flow" style="justify-content:center">
        <div class="flow-step on"><span class="fs-ico">🔷</span>Azure DevOps<span class="subtle" style="font-weight:500">job queue</span></div>
        <span class="flow-arrow">⇄</span>
        <div class="flow-step on"><span class="fs-ico">🖥️</span>Agent<span class="subtle" style="font-weight:500">polls over HTTPS 443</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-step done"><span class="fs-ico">🛠️</span>Your steps<span class="subtle" style="font-weight:500">git, npm, docker…</span></div></div>
        <p class="subtle" style="margin:12px 0 0;text-align:center">One agent runs <b>one job at a time</b>.</p></div>`,
      coming: { gha: "An agent is a <b>runner</b>; same polling model.", gitlab: "An agent is a <b>GitLab Runner</b>.", jenkins: "Like a Jenkins <b>agent/node</b>, but it connects out to Azure DevOps instead of the controller connecting in.", classic: "Same agents as before; YAML just selects them with <code>pool</code>." } },

    { title: "Agent pools",
      body: "<p>Agents are grouped into <b>pools</b>. A job asks for a pool, and Azure DevOps hands it to any <b>free agent</b> in that pool.</p><p>The built-in <b>Azure Pipelines</b> pool is Microsoft-hosted; you select an image with <code>vmImage</code>.</p>",
      code: `pool:
  vmImage: ubuntu-latest   # Microsoft-hosted, fresh VM per job`,
      coming: { gha: "<code>runs-on: ubuntu-latest</code> ↔ <code>pool: vmImage: ubuntu-latest</code>.", gitlab: "Like shared SaaS runners selected by tag.", jenkins: "<code>agent { label 'ubuntu' }</code>, but the cloud agents are ephemeral and maintained for you.", classic: "<i>Agent pool: Azure Pipelines</i> + <i>Agent specification</i>." } },

    { title: "Microsoft-hosted: the easy default",
      body: "<p>Zero maintenance: a fresh, patched VM for every job with Docker, kubectl, Azure CLI, Helm and Node preinstalled. Nothing leaks between runs.</p><p>The catch: it runs on the <b>public internet</b>.</p>",
      panel: `<div class="compare">
        <div class="card"><b style="color:var(--success-strong)">✓ Pros</b><ul class="muted" style="font-size:14px;padding-left:18px;margin:8px 0 0"><li>No servers to patch</li><li>Clean every run</li><li>Many tools preinstalled</li></ul></div>
        <div class="card"><b style="color:var(--danger)">✕ Cons</b><ul class="muted" style="font-size:14px;padding-left:18px;margin:8px 0 0"><li>Can't reach a <b>private</b> AKS API or private ACR</li><li>No warm caches</li><li>Time limits, limited free parallelism</li></ul></div></div>` },

    { title: "Self-hosted: your machine, your network",
      body: "<p>Install the agent on your own VM (or container) and register it into a pool. It can sit <b>inside your VNet</b>, next to a private AKS cluster.</p><p>You select it by pool <code>name</code> and can add <b>demands</b>, requirements the agent must meet.</p>",
      code: `pool:
  name: linux-builders     # your self-hosted pool
  demands:
    - docker
    - Agent.OS -equals Linux`,
      noDiff: true,
      coming: { gha: "Self-hosted runners with <code>runs-on: [self-hosted, linux]</code>. Labels ≈ demands.", gitlab: "Your own GitLab Runner registered with tags.", jenkins: "Your own Jenkins nodes; labels ≈ demands.", classic: "Pick your private pool in the Agent job settings." },
      more: "<p>Self-hosted means <b>you</b> patch the OS, update the agent and clean workspaces. A compromised agent sits inside your network, so treat build agents as sensitive hosts and never share one pool between untrusted projects.</p>" },

    { title: "Quick check: private cluster",
      body: "<p>Your AKS cluster is <b>private</b>: its API server has no public IP. The deploy job uses <code>vmImage: ubuntu-latest</code> and times out calling the API server.</p>",
      check: { type: "mcq", q: "What's the best fix?", explain: "A private API server is only reachable from inside the network. Run the deploy job on an agent in a VNet that can reach it.",
        options: [
          { t: "Raise the job's <code>timeoutInMinutes</code>", why: "It's not slow; it's unreachable. Waiting longer won't help." },
          { t: "Run the job on a self-hosted agent / Managed DevOps Pool inside a VNet that can reach the cluster", ok: true },
          { t: "Use <code>vmImage: windows-latest</code>", why: "Every Microsoft-hosted image is on the public internet." },
          { t: "Add the hosted agent's IP to authorized IP ranges", why: "Authorized IP ranges apply to <em>public</em> API servers. A private cluster has no public endpoint at all." } ] } },

    { title: "The middle ground: Managed DevOps Pools",
      body: "<p>Want private-network access <em>and</em> a fresh machine per job, without patching servers? Azure can run the pool for you.</p>",
      panel: `<div class="card"><div class="card-title">🧩 Managed DevOps Pools <span class="badge badge-success">recommended</span></div><p class="muted" style="font-size:14px;margin:0">Azure creates and recycles agent VMs in <b>your</b> subscription and VNet. You choose image, size and scaling.</p></div>
        <div class="card"><div class="card-title">🧱 VM Scale Set agents</div><p class="muted" style="font-size:14px;margin:0">The older approach: you own a scale set and Azure DevOps scales it.</p></div>` },

    { title: "How a job finds an agent",
      body: "<p>Each agent advertises <b>capabilities</b> (OS, tools, custom tags like <code>vnet</code>). A job lists <b>demands</b>. Only agents that meet <em>every</em> demand are eligible.</p><p>Play with the demands and dispatch the job a few times.</p>",
      panel: () => matcherHtml(DEMANDS.slice(0, 2)),
      onShow: el => wireMatcher(el) },

    { title: "Your turn: land on the right network",
      body: "<p>This job deploys to the <b>private</b> AKS cluster, which is only reachable from the <code>aks-private</code> VNet. Right now it lands on <code>build-02</code>, which sits in <code>corp</code>.</p>",
      panel: () => matcherHtml(DEMANDS.slice(0, 2)),
      check: { type: "custom", q: "Adjust the demands so the job lands on a Linux agent with Docker inside <code>aks-private</code>, then dispatch.", explain: "Demands are how you pin jobs to agents with the right network, tools or hardware." },
      onShow(el, api) {
        wireMatcher(el, (pick, ds) => {
          if (pick && pick.caps.vnet === "aks-private" && pick.caps.docker) api.solve();
          else if (pick) api.miss(`<code>${pick.name}</code> is in <code>${pick.caps.vnet}</code>${pick.caps.docker ? "" : " and has no Docker"}. Add a demand so only agents in the right VNet qualify.`);
          else api.miss("Too strict: no agent qualifies. Keep the Linux + docker demands and add the network one.");
        });
      } },

    { title: "Parallel jobs",
      body: "<p><b>Parallel jobs</b> are a licensing limit: how many jobs can run <em>at the same time</em> across your organization, counted separately for Microsoft-hosted and self-hosted.</p>",
      check: { type: "mcq", q: "Two people push at once. You have 5 idle self-hosted agents but 1 self-hosted parallel job. What happens?", explain: "Parallel jobs cap concurrency regardless of how many agents exist. The second run waits in the queue.",
        options: [
          { t: "One run starts; the other queues until the first job finishes", ok: true },
          { t: "Both run, because there are enough idle agents", why: "Agents aren't the limit here; the parallel-job licence is." },
          { t: "The second run fails immediately", why: "Runs queue; they don't fail for lack of capacity." } ] } },

    { summary: true, title: "You know where pipelines run",
      body: "Agents poll for jobs, pools group them, Microsoft-hosted is the easy default, and self-hosted or Managed DevOps Pools reach private networks. Demands pick the right agent, and parallel jobs cap concurrency.",
      panel: `<div class="card"><ul class="list-check" style="font-size:15px"><li><code>vmImage</code> → Microsoft-hosted, fresh VM per job</li><li><code>pool: name</code> → your own agents</li><li>Private AKS → agent inside the VNet</li><li>Demands must <em>all</em> match an agent's capabilities</li><li>Parallel jobs ≠ number of agents</li></ul></div>` },
  ],
};
