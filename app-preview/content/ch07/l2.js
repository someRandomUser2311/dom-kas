/* L7.2 · Anatomy of azure-pipelines.yml — guided lesson content (loaded by lesson.html?l=ch07/l2) */
const HEAD = `# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: ubuntu-latest
`;
const BUILD_STAGE = `stages:
  - stage: Build
    jobs:
      - job: Test
        steps:
          - script: npm ci
          - script: npm test
            displayName: Unit tests
          - script: npx eslint .
            displayName: Lint`;
const DOCKER = `
          - task: Docker@2
            displayName: Build & push image
            inputs:
              command: buildAndPush
              containerRegistry: acr-connection
              repository: orders-api
              tags: $(Build.BuildId)`;
const DEPLOY = `

  - stage: Deploy
    dependsOn: Build
    jobs:
      - deployment: ToAKS
        environment: prod
        strategy:
          runOnce:
            deploy:
              steps:
                - checkout: self
                - task: KubernetesManifest@1
                  inputs:
                    action: deploy
                    kubernetesServiceConnection: aks-prod
                    namespace: orders
                    manifests: k8s/*.yaml
                    containers: kqacr.azurecr.io/orders-api:$(Build.BuildId)`;

window.LESSON = {
  id: "l2", code: "L7.2", short: "Pipeline anatomy", title: "Anatomy of azure-pipelines.yml",
  file: "azure-pipelines.yml", reference: "lesson-2-reference.html",
  next: { href: "lesson.html?l=ch07/l3", title: "Agents & agent pools" },
  steps: [
    { title: "Meet the pipeline file",
      body: "<p>A whole pipeline is <b>one YAML file</b> committed to your repo, usually <code>azure-pipelines.yml</code> at the root.</p><p>Azure Pipelines reads it <b>from the exact commit being built</b>, so pipeline changes are reviewed in pull requests just like code. Over the next steps you'll build a real one, line by line.</p>",
      code: `# azure-pipelines.yml
# Lives at the root of your repo, next to the Dockerfile.`,
      coming: {
        gha: "Same idea as <code>.github/workflows/ci.yml</code>. The difference: you <em>point</em> an Azure pipeline at a YAML file when you create it, so the name and path are up to you.",
        gitlab: "Very close to <code>.gitlab-ci.yml</code>: one declarative file at the repo root.",
        jenkins: "Think <code>Jenkinsfile</code>, but declarative YAML instead of Groovy. There's no scripting language around it.",
        classic: "This replaces the click-built <b>Build</b> and <b>Release</b> definitions with a file you can diff, review and roll back." },
      more: "<p>You can have several YAML pipelines in one repo (e.g. <code>ci.yml</code>, <code>release.yml</code>). Each is registered once in Azure DevOps, and from then on the YAML in the branch being built is what runs.</p>" },

    { title: "Decide when it runs",
      body: "<p><code>trigger</code> lists the branches whose <b>pushes</b> start a run. Here only <code>main</code> does.</p><p>Leave <code>trigger</code> out and <em>every</em> branch triggers. <code>trigger: none</code> turns CI off completely.</p>",
      code: `# azure-pipelines.yml
trigger:
  - main`,
      coming: {
        gha: "<code>on: push: branches: [main]</code>, the same thing in a different shape.",
        gitlab: "Like <code>rules: - if: $CI_COMMIT_BRANCH == \"main\"</code> on your jobs, but declared once for the whole pipeline.",
        jenkins: "Similar to a webhook-triggered multibranch job limited with <code>when { branch 'main' }</code>.",
        classic: "Triggers tab → <i>Enable continuous integration</i> → branch filter <code>main</code>." },
      more: "<p>The long form supports filters:</p><pre class='code' style='padding:12px'>trigger:\n  batch: true\n  branches:\n    include: [main, release/*]\n  paths:\n    exclude: [docs/*]</pre><p><b>PR validation</b> is separate: the <code>pr:</code> key works for GitHub and Bitbucket. For Azure Repos you configure a <i>build validation branch policy</i> instead.</p>" },

    { title: "Quick check: who triggers a run?",
      body: "<p>Look at the file on the right. A teammate pushes a commit to the branch <code>feature/login</code>.</p>",
      check: { type: "mcq", q: "What does Azure Pipelines do?", explain: "Only branches listed under <code>trigger</code> start CI runs. (PR validation would be a separate trigger.)",
        options: [
          { t: "Starts a run for <code>feature/login</code>", why: "Only branches listed under <code>trigger</code> start a run, and <code>feature/login</code> isn't one of them." },
          { t: "Nothing. Only pushes to <code>main</code> trigger CI", ok: true },
          { t: "Starts a run but skips every step", why: "Runs are either queued or not. There's no \"empty run\" for unlisted branches." },
          { t: "Waits for someone to approve the run", why: "Approvals belong to <em>environments</em> (later in this lesson), not to triggers." } ] } },

    { title: "Pick a machine",
      body: "<p>Every job runs on an <b>agent</b>, a machine with build tools on it. <code>pool</code> chooses where.</p><p><code>vmImage: ubuntu-latest</code> asks for a fresh <b>Microsoft-hosted</b> Ubuntu VM that's thrown away after the job. Nothing leaks between runs.</p>",
      code: HEAD.trimEnd(),
      coming: {
        gha: "<code>runs-on: ubuntu-latest</code>, practically identical. Microsoft-hosted agents and GitHub-hosted runners even share image definitions.",
        gitlab: "Runner selection via <code>tags:</code>, plus a container <code>image:</code>. Here the VM image <em>is</em> the environment.",
        jenkins: "<code>agent { label 'linux' }</code>. Microsoft-hosted agents are like ephemeral cloud agents you never maintain.",
        classic: "Agent job → <i>Agent pool: Azure Pipelines</i>, <i>Agent specification: ubuntu-latest</i>." },
      more: "<p>Use <code>pool: name: my-pool</code> for <b>self-hosted</b> agents, e.g. when you must reach a <em>private</em> AKS cluster. Lesson L7.3 covers this in depth.</p>" },

    { title: "Tell it what to do",
      body: "<p><code>steps</code> is an ordered list of work. <code>script</code> runs a shell command (bash on Linux).</p><p>If a command exits non-zero, <b>the step fails and the job stops</b>. That's exactly how a failing test blocks a release. <code>displayName</code> is the label you'll see in the run log.</p>",
      code: HEAD + `
steps:
  - script: npm ci
  - script: npm test
    displayName: Unit tests`,
      coming: {
        gha: "<code>- run: npm test</code> with <code>name:</code>. Azure calls it <code>script</code> and <code>displayName</code>.",
        gitlab: "Like the <code>script:</code> list inside a job, except each entry here is its own step with its own log section.",
        jenkins: "<code>steps { sh 'npm test' }</code>",
        classic: "Each <code>script</code> is the <i>Command line</i> task you used to drag in." },
      more: "<p>Variants: <code>bash:</code> (bash everywhere, even on Windows), <code>pwsh:</code> (PowerShell Core). Useful step options: <code>condition</code>, <code>continueOnError</code>, <code>timeoutInMinutes</code>, <code>env</code>, <code>workingDirectory</code>.</p>" },

    { title: "Your turn: add a lint step",
      body: "<p>Add a step that runs <code>npx eslint .</code> after the tests. Pick the keyword that runs a shell command <b>in Azure Pipelines</b>.</p>",
      code: HEAD + `
steps:
  - script: npm ci
  - script: npm test
    displayName: Unit tests
  - [[blank]]: npx eslint .
    displayName: Lint`,
      check: { type: "fill", q: "Which keyword completes the highlighted line?", explain: "<code>script</code> runs a command with the agent's default shell.",
        chips: [
          { t: "run", why: "<code>run</code> is GitHub Actions syntax. Azure Pipelines would reject it as an unknown step type." },
          { t: "script", ok: true },
          { t: "sh", why: "<code>sh</code> is the Jenkins step. In Azure Pipelines use <code>script</code> (or <code>bash</code>)." },
          { t: "exec", why: "<code>exec</code> isn't a step type in any of the big CI systems." } ] } },

    { title: "Give it structure: stages → jobs → steps",
      body: "<p>When you write only <code>steps</code>, Azure Pipelines silently wraps them in <b>one job</b> inside <b>one stage</b>. Once you deploy, you'll want that structure explicit:</p><ul><li><b>Stage</b>: a phase like Build or Deploy, with its own conditions and approvals.</li><li><b>Job</b>: runs on <em>one</em> agent, start to finish.</li><li><b>Step</b>: one command or task inside a job.</li></ul>",
      visual: "<div class='hier'><span>pipeline</span><em>›</em><span class='h-stage'>stage: Build</span><em>›</em><span class='h-job'>job: Test</span><em>›</em><span class='h-step'>steps</span></div>",
      code: HEAD + `
` + BUILD_STAGE,
      coming: {
        gha: "Actions has no stages; a workflow is a set of <code>jobs</code> linked with <code>needs:</code>. Think of an Azure stage as a <em>group</em> of jobs that can be gated and approved as one unit.",
        gitlab: "Almost a 1:1 match with <code>stages:</code> plus jobs that declare <code>stage:</code>. Here jobs are nested <em>inside</em> their stage instead.",
        jenkins: "<code>stages { stage('Build') { steps { … } } }</code>. Azure adds the job level in between, which decides the agent.",
        classic: "The old Build pipeline becomes the <b>Build</b> stage; Release pipeline stages become <b>Deploy</b> stages in the same file." },
      more: "<p>Stages run <b>in order</b> by default (each depends on the one above). Jobs inside a stage run <b>in parallel</b> by default. You change both with <code>dependsOn</code>.</p>" },

    { title: "Quick check: sharing files",
      body: "<p>Imagine you split <code>Test</code> into two jobs: <code>Compile</code> produces <code>dist/</code>, and <code>Package</code> needs it.</p>",
      check: { type: "mcq", q: "What's true?", explain: "A job is the unit that lands on an agent. Two jobs may run on two different machines, so files travel as <b>pipeline artifacts</b> (<code>PublishPipelineArtifact</code> → <code>DownloadPipelineArtifact</code>).",
        options: [
          { t: "Jobs in the same stage share the agent's disk automatically", why: "Each job may land on a different agent. Nothing is shared by default." },
          { t: "Publish <code>dist/</code> as a pipeline artifact and download it in the second job", ok: true },
          { t: "Put both jobs in different stages, because stages share disks", why: "Stages don't share disks either. Every job starts on a clean agent." },
          { t: "It's impossible; merge them into one job", why: "Merging works, but it isn't the only option. Artifacts are the standard way to hand files between jobs." } ] } },

    { title: "Use a task instead of a script",
      body: "<p>A <b>task</b> is a packaged, versioned step; <code>@2</code> pins its major version. <code>inputs</code> configure it.</p><p><code>containerRegistry: acr-connection</code> names a <b>service connection</b>, so no password appears in the YAML. <code>$(Build.BuildId)</code> is unique per run, giving every image a traceable tag.</p>",
      code: HEAD + `
` + BUILD_STAGE + DOCKER,
      coming: {
        gha: "Tasks ≈ actions: <code>uses: docker/build-push-action@v6</code> + <code>with:</code> ↔ <code>task: Docker@2</code> + <code>inputs:</code>. The service connection plays the role of <code>docker/login-action</code> + secrets.",
        gitlab: "GitLab has no task marketplace. You'd run <code>docker build/push</code> in <code>script:</code> using <code>$CI_REGISTRY_*</code> variables, or pull in an <code>include:</code> template.",
        jenkins: "Like calling a plugin step such as <code>docker.build(...).push()</code> with credentials from the credentials store.",
        classic: "The very same Docker task you dragged into a Classic pipeline; YAML just writes its settings down." },
      more: "<p>Hundreds of built-in tasks exist (<code>AzureCLI@2</code>, <code>HelmDeploy@0</code>, <code>PublishTestResults@2</code>…) plus Marketplace extensions. Pin the major version; minor and patch updates roll out automatically.</p><p>Service connections and ACR permissions are covered in <b>L7.4</b>.</p>" },

    { title: "Find the credentials",
      body: "<p>Security review time: a teammate asks where the registry login comes from.</p>",
      check: { type: "tapline", q: "Tap the line that tells the Docker task <b>which credentials</b> to use.", match: "containerRegistry:",
        explain: "<code>containerRegistry</code> references the <code>acr-connection</code> service connection. Azure DevOps supplies the login at runtime; the YAML never contains a secret.",
        wrong: l => /repository|tags/.test(l) ? "That's <em>what</em> gets pushed, not <em>how</em> it authenticates." : /command/.test(l) ? "That's the action to perform. Look for something that points at a service connection." : null } },

    { title: "Ship it: a deployment job",
      body: "<p><code>dependsOn: Build</code> makes Deploy wait for Build to <b>succeed</b>.</p><p><code>deployment:</code> is a special job that targets an <b>environment</b> (<code>prod</code>). It records deployment history and honours approvals configured on that environment. <code>containers:</code> rewrites the image in your manifests to the exact tag just built.</p>",
      code: HEAD + `
` + BUILD_STAGE + DOCKER + DEPLOY,
      coming: {
        gha: "<code>needs: build</code> + <code>environment: production</code>: same idea, including required reviewers on the environment.",
        gitlab: "<code>environment: production</code> on a deploy job, with <code>when: manual</code> or protected environments for the gate.",
        jenkins: "A Deploy stage with an <code>input</code> step for approval; Azure moves the gate out of the pipeline file into the environment.",
        classic: "This is the Release pipeline stage, with pre-deployment approvals now living on the <b>environment</b>." },
      more: "<p>Why approvals aren't in YAML: anyone who can push a branch can edit YAML. Checks on the environment (approvals, branch control, business hours, exclusive lock) are owned by its administrators. L7.5 lets you simulate them.</p>" },

    { title: "Spot the essential line",
      body: "<p>Someone \"cleaned up\" this file and the deploy now fails with <i>No manifest files found matching k8s/*.yaml</i>. Deployment jobs <b>don't check out your repo</b> by default.</p>",
      check: { type: "tapline", q: "Tap the line that makes <code>k8s/*.yaml</code> available to the deployment job.", match: "- checkout: self",
        explain: "Without <code>checkout: self</code> the deployment job starts with an empty workspace. (Alternatively, publish <code>k8s/</code> as an artifact in Build and download it here.)",
        wrong: l => /manifests/.test(l) ? "That line <em>uses</em> the files, but something must put them on the agent first." : null } },

    { summary: true, title: "You can read a pipeline now",
      body: "You built a two-stage pipeline: CI trigger → Microsoft-hosted agent → tests → image pushed to ACR with a traceable tag → deployment job to AKS.",
      code: HEAD + `
` + BUILD_STAGE + DOCKER + DEPLOY },
  ],
};
