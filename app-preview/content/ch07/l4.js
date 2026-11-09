/* L7.4 · Service connections &amp; ACR — guided lesson content (loaded by lesson.html?l=ch07/l4) */
// ---- token-flow widget ----------------------------------------------------
const FLOWS = {
  wif: [
    { a: ["agent"], h: "Step needs Azure", d: "A step like <code>AzureCLI@2</code> references the service connection <code>azure-orders-dev</code> by name. No credentials in YAML." },
    { a: ["agent", "ado"], h: "Azure DevOps issues an OIDC token", d: "A short-lived token whose <b>issuer</b> is your Azure DevOps org and whose <b>subject</b> names this exact service connection." },
    { a: ["agent", "entra"], h: "Token exchange", d: "Entra ID checks the <b>federated credential</b>: do issuer and subject match exactly? No password involved." },
    { a: ["entra", "agent"], h: "Access token returned", d: "Valid for about an hour. Nothing long-lived to steal or rotate." },
    { a: ["agent", "azure"], h: "Call ACR / AKS", d: "Azure <b>RBAC</b> decides what's allowed, e.g. <code>AcrPush</code> on the registry." } ],
  secret: [
    { a: ["agent"], h: "Step needs Azure", d: "Same start: the step references the connection by name." },
    { a: ["ado", "agent"], h: "Secret handed to the job", d: "Azure DevOps decrypts the stored <b>client secret</b> and gives it to the task. Anything running in the job could read it." },
    { a: ["agent", "entra"], h: "client_credentials grant", d: "<code>client_id + client_secret</code> go to Entra ID. Whoever holds that secret can do this from <em>anywhere</em>." },
    { a: ["entra", "agent"], h: "Access token returned", d: "It works, but the secret lives for months or years and must be rotated. It's a classic leak in logs and laptops." },
    { a: ["agent", "azure"], h: "Call ACR / AKS", d: "RBAC applies the same way. Only the proof of identity differs, and that's the part attackers target." } ],
};
function seqHtml() {
  return `<div class="card"><div class="seq">
    <div class="seq-actors">
      <div class="seq-actor" data-a="agent"><span class="sa-ico">🖥️</span>Agent / task</div>
      <div class="seq-actor" data-a="ado"><span class="sa-ico">🔷</span>Azure DevOps</div>
      <div class="seq-actor" data-a="entra"><span class="sa-ico">🪪</span>Entra ID</div>
      <div class="seq-actor" data-a="azure"><span class="sa-ico">☁️</span>ACR / AKS</div></div>
    <div class="seq-msg" id="smsg"></div>
    <div style="display:flex;gap:10px;align-items:center"><button class="btn btn-sm" id="sprev">← Back</button><button class="btn btn-sm btn-primary" id="snext">Next →</button><span class="subtle" id="scount" style="margin-left:auto"></span></div></div></div>`;
}
function wireSeq(el, mode, onEnd) {
  let i = 0;
  const F = FLOWS[mode];
  const paint = () => {
    const f = F[i];
    el.querySelectorAll(".seq-actor").forEach(a => a.classList.toggle("on", f.a.includes(a.dataset.a)));
    el.querySelector("#smsg").innerHTML = `<div class="sm-arrow">${i + 1} · ${f.h.toUpperCase()}${f.a.length > 1 ? " · " + f.a.join(" → ") : ""}</div>${f.d}`;
    el.querySelector("#scount").textContent = `${i + 1} / ${F.length}`;
    el.querySelector("#snext").textContent = i === F.length - 1 ? "Restart ↺" : "Next →";
    if (i === F.length - 1 && onEnd) onEnd();
  };
  el.querySelector("#snext").onclick = () => { i = i === F.length - 1 ? 0 : i + 1; paint(); };
  el.querySelector("#sprev").onclick = () => { i = Math.max(0, i - 1); paint(); };
  paint();
}

window.LESSON = {
  id: "l4", code: "L7.4", short: "Service connections", title: "Service connections, service principals & ACR",
  file: "azure-pipelines.yml", reference: "lesson-4-reference.html",
  next: { href: "lesson.html?l=ch07/l5", title: "Stages, conditions & approvals" },
  steps: [
    { title: "How does a pipeline prove who it is?",
      body: "<p>Your pipeline needs to <em>push</em> to ACR and <em>deploy</em> to AKS. Both are protected Azure resources.</p><p>The tempting shortcut is on the right. Every person who can read the repo can now use that password, and it lives in Git history <b>forever</b>.</p>",
      code: `# ❌ please never do this
variables:
  AZ_CLIENT_ID: 6f1c…
  AZ_CLIENT_SECRET: 'Q8~kz.Yt2-…'

steps:
  - script: az login --service-principal -u $(AZ_CLIENT_ID) -p $(AZ_CLIENT_SECRET) --tenant …`,
      more: "<p>The fix is a chain of three ideas: an <b>identity</b> in Entra ID, a <b>service connection</b> in Azure DevOps that uses it, and <b>RBAC roles</b> on the resources. That's this lesson.</p>" },

    { title: "The identity: who is the pipeline?",
      body: "<p>Four terms you'll hear constantly. The key one: <b>RBAC roles are assigned to a service principal</b> (or a managed identity, which is just an SP whose credentials Azure manages).</p>",
      panel: `<div class="table-wrap"><table class="table">
        <tr><th>Term</th><th>What it is</th></tr>
        <tr><td><b>App registration</b></td><td>Global definition of an app in Entra ID: client ID, credentials, federated credentials</td></tr>
        <tr><td><b>Service principal</b></td><td>The app's identity <em>in your tenant</em>; what RBAC roles attach to</td></tr>
        <tr><td><b>Managed identity</b></td><td>An SP whose credentials Azure rotates for you</td></tr>
        <tr><td><b>Service connection</b></td><td>Azure DevOps object that knows <em>how</em> to authenticate as one of the above</td></tr></table></div>` },

    { title: "Reference it by name",
      body: "<p>With a service connection, the YAML only contains its <b>name</b>. Azure DevOps handles authentication at runtime, and admins control which pipelines may use it.</p>",
      code: `steps:
  - task: AzureCLI@2
    inputs:
      azureSubscription: azure-orders-dev   # service connection name
      scriptType: bash
      scriptLocation: inlineScript
      inlineScript: az aks list -o table`,
      noDiff: true,
      coming: {
        gha: "Like <code>azure/login@v2</code> with OIDC (<code>id-token: write</code>), except the trust config lives in an Azure DevOps object instead of repo secrets.",
        gitlab: "Like <code>id_tokens:</code> + <code>az login --federated-token</code>, packaged up so you don't script it.",
        jenkins: "Like a Credentials-plugin entry bound with <code>withCredentials</code>, but secretless when you use federation.",
        classic: "The same service connections you selected in Classic task dropdowns." } },

    { title: "How the token flows (secretless)",
      body: "<p><b>Workload identity federation</b> is the recommended default. Step through what happens when a task needs Azure.</p><p>Notice that no secret appears anywhere.</p>",
      panel: seqHtml, onShow: el => wireSeq(el, "wif") },

    { title: "Compare: the old client-secret way",
      body: "<p>Same five steps, but now a long-lived secret exists. Step through and spot where the risk enters.</p>",
      panel: seqHtml, onShow: el => wireSeq(el, "secret") },

    { title: "Quick check",
      body: "<p>You're creating a new Azure Resource Manager service connection for a team.</p>",
      check: { type: "mcq", q: "Which credential should it use?", explain: "Federation uses short-lived OIDC tokens, so there's no secret to store, leak or rotate.",
        options: [
          { t: "Client secret with 24-month expiry", why: "It works, but it's a long-lived secret that will eventually leak or expire at 2 a.m." },
          { t: "Workload identity federation", ok: true },
          { t: "A personal access token (PAT)", why: "PATs authenticate <em>people</em> to Azure DevOps, not pipelines to Azure." },
          { t: "The subscription owner's username and password", why: "Never use a human's credentials for automation." } ] } },

    { title: "Least-privilege RBAC",
      body: "<p>An identity with no roles can sign in but do nothing. Give each identity <b>exactly</b> what it needs, scoped as narrowly as possible.</p><p>Notice there are <b>two</b> identities: the pipeline pushes, the cluster pulls.</p>",
      panel: `<div class="table-wrap"><table class="table">
        <tr><th>Who</th><th>Role</th><th>Scope</th></tr>
        <tr><td>Pipeline SP</td><td><code>AcrPush</code></td><td>the ACR</td></tr>
        <tr><td>Pipeline SP</td><td><code>AKS Cluster User Role</code></td><td>the cluster</td></tr>
        <tr><td>Pipeline SP</td><td><code>AKS RBAC Writer</code></td><td>namespace <code>orders</code></td></tr>
        <tr><td>AKS kubelet identity</td><td><code>AcrPull</code></td><td>the ACR</td></tr></table></div>
        <div class="callout danger" style="margin:0"><span class="c-ico">🚫</span><div>Anti-pattern: one SP with <b>Owner</b> on the subscription, shared by every pipeline, with a 2-year secret.</div></div>` },

    { title: "Quick check: ImagePullBackOff",
      body: "<p>The pipeline pushed the image successfully, but pods are stuck in <code>ImagePullBackOff</code> with <i>401 Unauthorized</i> from <code>kqacr.azurecr.io</code>.</p>",
      check: { type: "mcq", q: "What's most likely missing?", explain: "Pulling is done by the <b>nodes</b>, which authenticate as the kubelet identity. It needs <code>AcrPull</code>, e.g. via <code>az aks update --attach-acr</code>.",
        options: [
          { t: "<code>AcrPush</code> for the pipeline SP", why: "The push already worked, so the pipeline side is fine." },
          { t: "A Docker Registry service connection", why: "Service connections are for the pipeline. Pods don't use them." },
          { t: "Workload identity federation on the connection", why: "That affects how the pipeline signs in, not how nodes pull." },
          { t: "<code>AcrPull</code> for the AKS kubelet identity", ok: true } ] } },

    { title: "Your turn: create the connection",
      body: "<p>Create an Azure Resource Manager connection named <code>azure-orders-dev</code> that uses <b>workload identity federation</b>, is scoped to resource group <code>rg-orders-dev</code> in subscription <code>KubeQuest-Dev</code>, and is <b>not</b> available to every pipeline.</p>",
      panel: `<div class="ado-form"><div class="ado-head">🔷 New Azure service connection</div><div class="ado-body">
        <div class="field"><label>Identity type</label><select class="input" id="f-identity"><option value="">Select…</option><option value="auto">App registration (automatic)</option><option value="manual">App registration or managed identity (manual)</option><option value="mi">Managed identity</option></select></div>
        <div class="field"><label>Credential</label><div class="radio-cards">
          <label class="radio-card"><input type="radio" name="cred" value="wif"><span><span class="rc-title">Workload identity federation</span><br><span class="rc-sub">Short-lived OIDC tokens, no secret</span></span></label>
          <label class="radio-card"><input type="radio" name="cred" value="secret"><span><span class="rc-title">Secret</span><br><span class="rc-sub">Stored client secret, must be rotated</span></span></label></div></div>
        <div class="field"><label>Subscription</label><select class="input" id="f-sub"><option value="">Select…</option><option>KubeQuest-Dev</option><option>KubeQuest-Prod</option></select></div>
        <div class="field"><label>Resource group</label><select class="input" id="f-rg"><option value="">(none: entire subscription)</option><option>rg-orders-dev</option><option>rg-orders-prod</option></select></div>
        <div class="field"><label>Service connection name</label><input class="input mono" id="f-name" placeholder="e.g. azure-orders-dev"></div>
        <label class="checkline"><input type="checkbox" id="f-all" checked> Grant access permission to all pipelines</label>
        <button class="btn btn-primary" id="f-save">Save</button></div></div>`,
      check: { type: "custom", q: "Fill in the form on the right and press <b>Save</b>.", explain: "A least-privilege, secretless connection: narrow scope, no shared access." },
      onShow(el, api) {
        el.querySelector("#f-save").onclick = () => {
          const v = id => el.querySelector("#" + id).value.trim();
          const cred = (el.querySelector('input[name="cred"]:checked') || {}).value;
          const rules = [
            [!!v("f-identity"), "Choose an identity type. <i>App registration (automatic)</i> is easiest."],
            [cred === "wif", "Use <b>workload identity federation</b>, not a secret."],
            [v("f-sub") === "KubeQuest-Dev", "Dev pipelines should only reach the <b>KubeQuest-Dev</b> subscription."],
            [v("f-rg") === "rg-orders-dev", "Scope it to <b>rg-orders-dev</b>. Empty means the whole subscription."],
            [v("f-name") === "azure-orders-dev", "Name it exactly <code>azure-orders-dev</code>; pipelines reference it by name."],
            [!el.querySelector("#f-all").checked, "Untick <b>Grant access to all pipelines</b> and authorize pipelines individually."],
          ];
          const bad = rules.filter(r => !r[0]);
          bad.length ? api.miss(`${rules.length - bad.length}/${rules.length} correct. ${bad[0][1]}`) : api.solve();
        };
      } },

    { title: "ACR in one screen",
      body: "<p>Azure Container Registry is a private Docker registry. Its <b>login server</b> is <code>&lt;name&gt;.azurecr.io</code>.</p><p>These are the commands a pipeline runs under the hood. You'll type them yourself against the local floci-az emulator in the terminal lab.</p>",
      file: "bash",
      code: `# create a registry and let the cluster pull from it
az acr create -g rg-orders-dev -n kqacr --sku Standard
az aks update -g rg-orders-dev -n aks-orders-dev --attach-acr kqacr

# what Docker@2 buildAndPush does for you
az acr login -n kqacr
docker build -t kqacr.azurecr.io/orders-api:1427 .
docker push kqacr.azurecr.io/orders-api:1427`,
      check: { type: "tapline", q: "Tap the command that gives AKS permission to <b>pull</b> from the registry.", match: "--attach-acr",
        explain: "<code>--attach-acr</code> assigns <code>AcrPull</code> on the registry to the cluster's kubelet identity.",
        wrong: l => /acr login/.test(l) ? "That logs <em>your Docker client</em> in. The cluster needs its own permission." : null } },

    { summary: true, title: "Secretless, least-privilege delivery",
      body: "Pipelines authenticate through service connections, ideally with workload identity federation. RBAC gives the pipeline AcrPush and the cluster AcrPull, each scoped as narrowly as possible.",
      panel: `<div class="card"><ul class="list-check" style="font-size:15px"><li>Never put credentials in YAML</li><li>Service connection = named, permissioned way to authenticate</li><li>Prefer workload identity federation</li><li>Pipeline pushes (AcrPush); kubelet pulls (AcrPull)</li><li>Scope to a resource group; don't grant to all pipelines</li></ul></div>` },
  ],
};
