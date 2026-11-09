/* L7.1 · CI/CD and Azure Pipelines — guided lesson content (loaded by lesson.html?l=ch07/l1) */
// ---- reusable flow widget -------------------------------------------------
const FLOW = [
  { ico: "👩‍💻", t: "git push", d: "<b>A developer pushes</b> to <code>main</code>. Azure Pipelines watches the repo; the YAML's <code>trigger</code> decides whether a run starts." },
  { ico: "⚡", t: "Trigger", d: "<b>A run is queued.</b> Azure DevOps reads <code>azure-pipelines.yml</code> from <em>that exact commit</em>." },
  { ico: "🖥️", t: "Agent", d: "<b>An agent picks up the job</b>: a VM or container with build tools, Microsoft-hosted or your own." },
  { ico: "🧪", t: "Test", d: "<b>CI happens here.</b> Restore, compile, run unit tests. A failing test stops everything after it." },
  { ico: "📦", t: "Push to ACR", d: "<b>The image is built and pushed</b> to Azure Container Registry with a unique tag such as <code>$(Build.BuildId)</code>." },
  { ico: "🛑", t: "Approval", d: "<b>Optional human gate</b> on the <code>prod</code> environment. It's the line between Continuous Delivery and Continuous Deployment." },
  { ico: "☸️", t: "Deploy", d: "<b>Manifests are applied to AKS</b> with the new tag. AKS pulls the image from ACR and rolls out new pods." },
];
function flowHtml(upto, on) {
  return `<div class="card"><div class="flow">${FLOW.slice(0, upto).map((s, i) => `${i ? '<span class="flow-arrow">→</span>' : ""}<div class="flow-step ${i === on ? "on" : i < on ? "done" : ""}" data-i="${i}" style="cursor:pointer"><span class="fs-ico">${s.ico}</span>${s.t}</div>`).join("")}</div></div>`;
}

window.LESSON = {
  id: "l1", code: "L7.1", short: "CI/CD basics", title: "CI/CD and where Azure Pipelines fits",
  file: "laptop.sh", reference: "lesson-1-reference.html",
  next: { href: "lesson.html?l=ch07/l2", title: "Anatomy of azure-pipelines.yml" },
  steps: [
    { title: "Shipping by hand doesn't scale",
      body: "<p>In earlier chapters you deployed to AKS like this, straight from your laptop.</p><p>It works for one person on a quiet afternoon. With ten engineers and twenty changes a day, someone skips the tests, someone pushes <code>latest</code> over a good image, and someone deploys uncommitted code.</p>",
      file: "laptop.sh",
      code: `# what "deploying" looked like so far
docker build -t kqacr.azurecr.io/orders-api:latest .
docker push kqacr.azurecr.io/orders-api:latest
kubectl apply -f k8s/
# tests? "I ran them yesterday" 🤞`,
      more: "<p>The real cost isn't typing commands. It's <b>no audit trail</b> (who deployed what, from which commit?) and <b>no consistency</b> (every laptop has different tool versions).</p>" },

    { title: "CI: every push is built and tested",
      body: "<p><b>Continuous Integration</b> means every push is built and tested automatically, on a clean machine, within minutes.</p><p>Broken code is caught while the change is still fresh in the author's head, not at release time.</p>",
      panel: () => flowHtml(4, 3),
      coming: {
        gha: "This is what a workflow with <code>on: push</code> and a test job gives you.",
        gitlab: "Your <code>test</code> stage on every push: same idea.",
        jenkins: "A multibranch job building every commit. Here the build servers are managed for you.",
        classic: "The Classic <b>Build</b> pipeline with CI enabled covered exactly this part." } },

    { title: "CD: every green build is deployable",
      body: "<p><b>Continuous Delivery</b> extends CI: every build that passes produces a <b>deployable artifact</b>, for us a container image in ACR with a unique tag.</p><p>Releasing becomes a decision, not a project.</p>",
      panel: () => flowHtml(5, 4) },

    { title: "Delivery vs deployment: one switch",
      body: "<p>The only difference between Continuous <b>Delivery</b> and Continuous <b>Deployment</b> is whether a human approves the last step.</p><p>Flip the switch and watch the name change.</p>",
      panel: () => `<div class="card">
          <label class="toggle"><input type="checkbox" id="gate" checked><span class="track"></span>Require approval before prod</label>
          <div style="margin-top:16px" id="gate-flow"></div>
          <div class="seq-msg" id="gate-msg" style="margin-top:12px;min-height:0"></div></div>`,
      onShow(el) {
        const paint = () => {
          const g = el.querySelector("#gate").checked;
          const steps = g ? FLOW : FLOW.filter(s => s.t !== "Approval");
          el.querySelector("#gate-flow").innerHTML = `<div class="flow">${steps.map((s, i) => `${i ? '<span class="flow-arrow">→</span>' : ""}<div class="flow-step ${s.t === "Approval" ? "on" : "done"}"><span class="fs-ico">${s.ico}</span>${s.t}</div>`).join("")}</div>`;
          el.querySelector("#gate-msg").innerHTML = g
            ? "<b>Continuous Delivery.</b> Every green build <em>could</em> go to prod; a person decides when."
            : "<b>Continuous Deployment.</b> Every green build goes to prod automatically. This needs excellent tests and monitoring.";
        };
        el.querySelector("#gate").onchange = paint; paint();
      } },

    { title: "Quick check",
      body: "<p>Your team's pipeline tests every commit and pushes a tagged image to ACR. A lead must click <b>Approve</b> before it reaches production AKS.</p>",
      check: { type: "mcq", q: "What is this?", explain: "Every green build is deployable, but a human decides when it ships. Remove the approval and it becomes Continuous <em>Deployment</em>.",
        options: [
          { t: "Continuous Integration only", why: "It goes further than CI: it produces a deployable image <em>and</em> deploys it." },
          { t: "Continuous Deployment", why: "Continuous Deployment has no human gate. Here a lead approves." },
          { t: "Continuous Delivery", ok: true },
          { t: "A Classic release pipeline", why: "That's <em>how</em> it might be built, not what the practice is called." } ] } },

    { title: "Follow one commit to production",
      body: "<p>Here's the whole journey. <b>Click each box</b> (or use the buttons) to see what happens at that point.</p><p>Every box is something you already did by hand. The pipeline just does it the same way, every time.</p>",
      panel: () => flowHtml(7, 0) + `<div class="seq-msg" id="fmsg" style="min-height:96px"></div>
        <div style="display:flex;gap:10px"><button class="btn btn-sm" id="fprev">← Back</button><button class="btn btn-sm btn-primary" id="fnext">Next →</button><span class="subtle" id="fcount" style="margin-left:auto;align-self:center"></span></div>`,
      onShow(el) {
        let cur = 0;
        const show = () => {
          el.querySelectorAll(".flow-step").forEach((f, i) => { f.classList.toggle("on", i === cur); f.classList.toggle("done", i < cur); });
          el.querySelector("#fmsg").innerHTML = `<div class="sm-arrow">STEP ${cur + 1} · ${FLOW[cur].t.toUpperCase()}</div>${FLOW[cur].d}`;
          el.querySelector("#fcount").textContent = `${cur + 1} / ${FLOW.length}`;
        };
        el.querySelector("#fnext").onclick = () => { cur = (cur + 1) % FLOW.length; show(); };
        el.querySelector("#fprev").onclick = () => { cur = Math.max(0, cur - 1); show(); };
        el.querySelectorAll(".flow-step").forEach(f => f.onclick = () => { cur = +f.dataset.i; show(); });
        show();
      } },

    { title: "Azure DevOps, the product",
      body: "<p>Azure Pipelines is one service inside <b>Azure DevOps</b>, a separate product from the Azure portal. An <em>organization</em> holds <em>projects</em>, and each project can switch these services on or off.</p>",
      panel: `<div class="table-wrap"><table class="table">
        <tr><th>Service</th><th>What it does</th></tr>
        <tr><td><b>Repos</b></td><td>Git hosting (GitHub works just as well)</td></tr>
        <tr><td><b>Pipelines</b> <span class="badge badge-accent">this chapter</span></td><td>Build, test and deploy: CI/CD</td></tr>
        <tr><td><b>Artifacts</b></td><td>Package feeds: npm, NuGet, Maven, pip</td></tr>
        <tr><td><b>Boards</b></td><td>Work items, sprints, Kanban</td></tr>
        <tr><td><b>Test Plans</b></td><td>Manual & exploratory testing</td></tr></table></div>`,
      coming: {
        gha: "GitHub bundles the same ideas: Repos ≈ GitHub repos, Pipelines ≈ Actions, Artifacts ≈ Packages, Boards ≈ Projects/Issues.",
        gitlab: "GitLab is one app with all of these built in. Azure DevOps splits them into services you toggle per project.",
        jenkins: "Jenkins only covers the Pipelines part. Repos, packages and boards live in other tools.",
        classic: "Same product you already use. Only the way pipelines are defined is changing." } },

    { title: "Quick check: do I need an Azure subscription?",
      body: "<p>A common confusion, and it matters for this course.</p>",
      check: { type: "mcq", q: "Which statement is true?", explain: "An Azure DevOps organization only needs a Microsoft account and has a free tier. An Azure subscription matters for <b>what you deploy to</b> (AKS, ACR…) and for buying extra parallel jobs. In this course those targets are emulated locally by floci-az.",
        options: [
          { t: "You need an Azure subscription to create an Azure DevOps organization", why: "An organization needs a Microsoft account, not a subscription." },
          { t: "Pipelines can't run at all without a subscription", why: "Pipelines run on agents; the free tier covers small teams with no subscription." },
          { t: "The subscription is for the Azure resources you deploy to, and for buying extra capacity", ok: true } ] } },

    { title: "Classic vs YAML pipelines",
      body: "<p>Azure Pipelines has two ways to define a pipeline. You'll meet both at work, but every <b>new</b> pipeline should be YAML: it lives in the repo, is reviewed in pull requests, and does build <em>and</em> deploy in one file.</p>",
      panel: `<div class="compare">
        <div class="card"><div class="card-title">🖱️ Classic</div><ul class="muted" style="margin:0;padding-left:18px;font-size:14px"><li>Built by clicking in the UI</li><li>Separate Build & Release pipelines</li><li>Hard to review or reuse</li></ul></div>
        <div class="card sel"><div class="card-title">📄 YAML <span class="badge badge-success">Use this</span></div><ul class="muted" style="margin:0;padding-left:18px;font-size:14px"><li><code>azure-pipelines.yml</code> in your repo</li><li>Reviewed in PRs, versioned with code</li><li>Reusable via templates</li></ul></div></div>`,
      coming: { classic: "Your Classic definitions keep working, but new features land in YAML first. Next lesson shows how your Build + Release map onto stages." } },

    { title: "The smallest useful pipeline",
      body: "<p>Here's a complete, working pipeline in eight lines. The next lesson takes it apart line by line. For now, just find one thing in it.</p>",
      file: "azure-pipelines.yml",
      code: `# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - script: echo "Hello from $(Agent.OS)"`,
      check: { type: "tapline", q: "Tap the line that picks <b>which machine</b> runs the pipeline.", match: "vmImage:",
        explain: "<code>vmImage: ubuntu-latest</code> asks for a fresh Microsoft-hosted Ubuntu VM. You'll go deep on agents in L7.3.",
        wrong: l => /pool:/.test(l) ? "Close! <code>pool:</code> opens the section. Tap the line that names the actual machine image." : null } },

    { summary: true, title: "CI/CD, demystified",
      body: "You know why we automate, the difference between CI, Continuous Delivery and Continuous Deployment, where Azure Pipelines sits in Azure DevOps, and why YAML beats Classic.",
      panel: `<div class="card"><ul class="list-check" style="font-size:15px"><li>CI = every push built &amp; tested on a clean machine</li><li>Continuous Delivery = every green build deployable; a human ships it</li><li>Continuous Deployment = no human gate</li><li>Azure DevOps org needs no Azure subscription</li><li>New pipelines: YAML, in the repo</li></ul></div>` },
  ],
};
