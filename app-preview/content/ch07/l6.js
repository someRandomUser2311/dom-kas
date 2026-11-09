/* L7.6 · Variables, secrets &amp; templates — guided lesson content (loaded by lesson.html?l=ch07/l6) */
// Template-expression syntax is written with "$" + "{{" so this page's JS never sees a template literal placeholder.
const D = "$";
const EXPR = { compile: D + "{{ variables.env }}", runtime: D + "[ variables.env ]", macro: D + "(env)" };
const PH = [
  { k: "compile", ico: "🧩", t: "Compile", s: "templates expanded" },
  { k: "queue", ico: "📥", t: "Queue", s: "variables set" },
  { k: "runtime", ico: "▶️", t: "Job starts", s: D + "[ ] evaluated" },
  { k: "step1", ico: "🔧", t: "Step 1", s: "sets env=prod" },
  { k: "macro", ico: "🔧", t: "Step 2", s: D + "( ) expanded" },
];
const SYN = {
  compile: { at: "compile", out: "dev", d: "Replaced <b>at compile time</b>, before anything runs, with the value known then: <code>dev</code>. That's also why <code>" + D + "{{ if }}</code> can add or remove whole steps." },
  runtime: { at: "runtime", out: "dev", d: "Runtime expressions live in <b>variable definitions and conditions</b>. Evaluated when the job starts, so they see <code>dev</code>. Their superpower is reading outputs of <em>earlier jobs</em>." },
  macro: { at: "macro", out: "prod", d: "Macros expand <b>right before each task runs</b>, so step 2 sees what step 1 just set: <code>prod</code>. The everyday default." },
};
const EXP_CODE = `variables:
  env: dev                       # value when the run is queued

steps:
  - script: echo "##vso[task.setvariable variable=env]prod"
  - script: echo "I see: <<X>>"`;

window.LESSON = {
  id: "l6", code: "L7.6", short: "Variables & templates", title: "Variables, secrets & templates",
  file: "azure-pipelines.yml", reference: "lesson-6-reference.html",
  next: { href: "quiz.html", title: "Checkpoint quiz" },
  steps: [
    { title: "Variables: name it once",
      body: "<p>Define values once under <code>variables</code> and use them anywhere with <code>$(name)</code>. Change the image name in one place, not five.</p>",
      code: `variables:
  imageRepo: orders-api
  namespace: orders

steps:
  - script: echo "Deploying $(imageRepo) to $(namespace)"`,
      coming: { gha: "<code>env:</code> at workflow level, read with <code>" + D + "{{ env.NAME }}</code> or <code>" + D + "NAME</code> in shell.", gitlab: "<code>variables:</code> read as <code>" + D + "NAME</code>, almost identical.", jenkins: "<code>environment { NAME = 'x' }</code>.", classic: "The Variables tab, now in code." } },

    { title: "Predefined variables",
      body: "<p>Azure Pipelines gives you dozens of variables for free. Three you'll use constantly:</p><ul><li><code>Build.BuildId</code>: unique per run, the perfect image tag</li><li><code>Build.SourceBranch</code>: e.g. <code>refs/heads/main</code></li><li><code>Build.Reason</code>: <code>IndividualCI</code>, <code>PullRequest</code>, <code>Manual</code>…</li></ul>",
      code: `variables:
  imageRepo: orders-api
  namespace: orders
  tag: $(Build.BuildId)

steps:
  - script: echo "Deploying $(imageRepo):$(tag) to $(namespace)"
  - script: echo "Branch $(Build.SourceBranch), reason $(Build.Reason)"`,
      coming: { gha: "<code>github.run_id</code>, <code>github.ref</code>, <code>github.event_name</code>.", gitlab: "<code>CI_PIPELINE_ID</code>, <code>CI_COMMIT_REF_NAME</code>, <code>CI_PIPELINE_SOURCE</code>.", jenkins: "<code>BUILD_NUMBER</code>, <code>BRANCH_NAME</code>.", classic: "Same predefined variables." } },

    { title: "Three syntaxes, three moments",
      body: "<p>The #1 source of \"but the variable <em>is</em> set!\" bugs. A step changes <code>env</code> to <code>prod</code> at runtime. What does the next step print?</p><p>Switch between the syntaxes and watch <b>when</b> each is evaluated.</p>",
      panel: () => `<div id="xcode"></div>
        <div class="tabs" id="syn">${Object.keys(EXPR).map((k, i) => `<button class="tab ${i ? "" : "active"}" data-s="${k}"><code>${EXPR[k]}</code></button>`).join("")}</div>
        <div class="card"><div class="flow" id="tl" style="justify-content:space-between"></div><div class="seq-msg" id="tmsg" style="margin-top:10px;min-height:0"></div></div>`,
      onShow(el) {
        const show = k => {
          const s = SYN[k], at = PH.findIndex(p => p.k === s.at);
          el.querySelectorAll("#syn .tab").forEach(t => t.classList.toggle("active", t.dataset.s === k));
          KQY.block(el.querySelector("#xcode"), EXP_CODE.replace("<<X>>", EXPR[k]), { title: "the experiment" });
          el.querySelector("#tl").innerHTML = PH.map((p, i) => `${i ? '<span class="flow-arrow">→</span>' : ""}<div class="flow-step ${i === at ? "on" : i < at ? "done" : ""}" style="flex:1;min-width:70px"><span class="fs-ico">${p.ico}</span>${p.t}</div>`).join("");
          el.querySelector("#tmsg").innerHTML = `<div class="sm-arrow">OUTPUT → "I see: ${s.out}"</div>${s.d}`;
        };
        el.querySelectorAll("#syn .tab").forEach(t => t.onclick = () => show(t.dataset.s));
        show("compile");
      } },

    { title: "Your turn: print the updated value",
      body: "<p>Step 1 sets <code>env</code> to <code>prod</code> at runtime. Make step 2 print <b>prod</b>.</p>",
      file: "experiment.yml",
      code: `variables:
  env: dev

steps:
  - script: echo "##vso[task.setvariable variable=env]prod"
  - script: echo "I see: [[blank]]"`,
      check: { type: "fill", q: "Which syntax completes the line?", explain: "<code>$(env)</code> is expanded just before the step runs, after step 1 changed it.",
        chips: [
          { t: EXPR.compile, why: "Compile-time: it was replaced with <code>dev</code> before the run even started." },
          { t: EXPR.macro, ok: true },
          { t: EXPR.runtime, why: "Runtime expressions don't work inline in scripts. They belong in variable definitions and conditions." } ] } },

    { title: "Quick check: compile time strikes again",
      body: "<p>A step sets <code>tag</code> to <code>v2</code>. A later step is wrapped in <code>" + D + "{{ if eq(variables.tag, 'v2') }}:</code>.</p>",
      check: { type: "mcq", q: "Does the later step run?", explain: "<code>" + D + "{{ }}</code> is resolved when the YAML is compiled, long before any script runs. Use a runtime <code>condition: eq(variables.tag, 'v2')</code> instead.",
        options: [
          { t: "No. The <code>" + D + "{{ if }}</code> was evaluated at compile time, before <code>tag</code> changed", ok: true },
          { t: "Yes, because <code>tag</code> is <code>v2</code> by then", why: "By then the <code>if</code> has already been evaluated and the step removed." },
          { t: "Only if <code>tag</code> is an output variable", why: "Output variables help across jobs, but compile-time expressions still can't see them." } ] } },

    { title: "Secrets never live in YAML",
      body: "<p>Put secrets in a <b>variable group</b>, ideally <b>linked to Azure Key Vault</b>, so rotation happens in Key Vault and nothing sensitive is in Git.</p><p>Secret variables are masked as <code>***</code> in logs and are <b>not</b> passed to scripts automatically. Map them explicitly with <code>env:</code>.</p>",
      code: `variables:
  - group: orders-prod-secrets   # linked to Key Vault kv-orders-prod

steps:
  - script: ./migrate.sh
    env:
      DB_PASSWORD: $(db-password)  # explicit mapping`,
      noDiff: true,
      coming: { gha: "Like repo/environment <b>secrets</b> read with <code>" + D + "{{ secrets.X }}</code>; Key Vault linking ≈ fetching from a vault action.", gitlab: "Masked/protected CI variables, or the Vault integration.", jenkins: "Credentials store + <code>withCredentials</code>.", classic: "The same Library variable groups." },
      more: "<p><b>Masking isn't security.</b> A script can still leak a secret by encoding it. Restrict who can edit pipelines, and protect variable groups with pipeline permissions and approvals.</p>" },

    { title: "Spot the leak",
      body: "<p>Security review. One line in this file is a real problem.</p>",
      code: `variables:
  - group: orders-prod-secrets
  - name: imageRepo
    value: orders-api
  - name: dbPassword
    value: 'S3cr3t-Pa55!'

steps:
  - script: ./migrate.sh
    env:
      DB_PASSWORD: $(db-password)`,
      noDiff: true,
      check: { type: "tapline", q: "Tap the line that leaks a secret.", match: "S3cr3t",
        explain: "A plaintext value in YAML is in Git history forever, even after you delete it. Move it to the Key Vault-backed group and rotate it.",
        wrong: l => /group/.test(l) ? "Referencing a variable group is the <em>right</em> way." : /DB_PASSWORD/.test(l) ? "That maps a secret variable safely." : null } },

    { title: "Templates: write it once",
      body: "<p>A <b>template</b> is a YAML file with <code>parameters</code> that other pipelines include. Platform teams use them to publish a hardened golden path.</p>",
      file: "templates/build.yml",
      code: `# templates/build.yml
parameters:
  - name: imageName
    type: string
  - name: runTests
    type: boolean
    default: true

stages:
  - stage: Build
    jobs:
      - job: build
        steps:
          - ` + D + `{{ if eq(parameters.runTests, true) }}:
            - script: npm test
          - task: Docker@2
            inputs:
              command: buildAndPush
              containerRegistry: acr-connection
              repository: ` + D + `{{ parameters.imageName }}`,
      coming: { gha: "Reusable workflows (<code>workflow_call</code>) and composite actions.", gitlab: "<code>include:</code> + <code>extends:</code> / CI components.", jenkins: "Shared libraries.", classic: "Task groups, now with real parameters." } },

    { title: "Use the template",
      body: "<p>Now each service's pipeline is tiny: include the template and pass parameters. At compile time, Azure Pipelines <b>expands</b> it into one full pipeline.</p><p>For security, <code>extends</code> goes further: your pipeline must fit <em>inside</em> an approved template, and environments can require it.</p>",
      file: "azure-pipelines.yml",
      code: `trigger: [main]

stages:
  - template: templates/build.yml
    parameters:
      imageName: orders-api
      runTests: true`,
      check: { type: "tapline", q: "Tap the line whose value ends up as the Docker task's <code>repository</code>.", match: "imageName: orders-api",
        explain: "<code>imageName</code> is substituted into <code>" + D + "{{ parameters.imageName }}</code> at compile time, so the expanded task reads <code>repository: orders-api</code>." } },

    { summary: true, title: "Variables, secrets & templates, sorted",
      body: "You know when <code>" + D + "{{ }}</code>, <code>" + D + "[ ]</code> and <code>" + D + "( )</code> are evaluated, how to keep secrets in Key Vault-backed groups, and how templates turn a golden path into a five-line pipeline.",
      panel: `<div class="card"><ul class="list-check" style="font-size:15px"><li><code>$(var)</code>: default, just before each task</li><li><code>${D}[ ]</code>: runtime, in variables &amp; conditions</li><li><code>${D}{{ }}</code>: compile time, shapes the pipeline</li><li>Secrets: Key Vault-linked group + explicit <code>env:</code></li><li>Templates + <code>extends</code> = reusable, enforceable pipelines</li></ul></div>` },
  ],
};
