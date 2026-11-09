<script>
  // Token flows: workload identity (pod → Entra → Key Vault) and pipeline
  // service connections (WIF vs secret).
  import { modeOf } from './lib.js';
  let { text, name = '', onsolved } = $props();
  const mode = modeOf(text, { task: /Success when/i }, 'wi');
  const isPipeline = name.startsWith('l4-');
  const pipeMode = name === 'l4-step5' ? 'secret' : 'wif';

  const WI = [
    ['pod', 'The pod starts', 'The webhook mounted a projected ServiceAccount token, signed by the cluster’s OIDC issuer: iss = the cluster issuer URL, sub = system:serviceaccount:orders:orders-api.'],
    ['entra', 'Token exchange', 'The Azure SDK sends that token to Entra ID and asks for a token for id-orders-api (client ID from AZURE_CLIENT_ID).'],
    ['fic', 'Federated credential check', 'Entra ID checks: does the issuer and subject exactly match a federated credential on id-orders-api? Is the audience api://AzureADTokenExchange?'],
    ['entra', 'Entra token returned', 'An access token for id-orders-api, valid ~1 hour. No secret anywhere.'],
    ['kv', 'Read the secret', 'Key Vault checks Azure RBAC: id-orders-api has Key Vault Secrets User → the secret is returned.'],
  ];
  const PIPE = {
    wif: [
      ['agent', 'Step needs Azure', 'A step like AzureCLI@2 references the service connection by name. No credentials in YAML.'],
      ['ado', 'Azure DevOps issues an OIDC token', 'Short-lived; its issuer is your Azure DevOps org and its subject names this exact service connection.'],
      ['entra', 'Token exchange', 'Entra ID checks the federated credential: issuer and subject must match exactly. No password involved.'],
      ['agent', 'Access token returned', 'Valid for about an hour. Nothing long-lived to steal or rotate.'],
      ['azure', 'Call ACR / AKS', 'Azure RBAC decides what’s allowed, e.g. AcrPush on the registry.'],
    ],
    secret: [
      ['agent', 'Step needs Azure', 'Same start: the step references the connection by name.'],
      ['ado', 'Secret handed to the job', 'Azure DevOps decrypts the stored client secret and gives it to the task. Anything in the job could read it.'],
      ['entra', 'client_credentials grant', 'client_id + client_secret go to Entra ID. Whoever holds that secret can do this from anywhere.'],
      ['agent', 'Access token returned', 'It works, but the secret lives for months and must be rotated — a classic leak in logs and laptops.'],
      ['azure', 'Call ACR / AKS', 'RBAC applies the same way. Only the proof of identity differs, and that’s what attackers target.'],
    ],
  };
  const BREAKS = {
    none: null,
    label: ['The pod has no azure.workload.identity/use: "true" label', 'No token is mounted: DefaultAzureCredential fails with "WorkloadIdentityCredential authentication unavailable".'],
    subject: ['The federated credential subject names another namespace', 'AADSTS700213: No matching federated identity record found for presented assertion subject.'],
    issuer: ['The federated credential has an old issuer URL', 'AADSTS700211: No matching federated identity record found for presented assertion issuer.'],
    role: ['id-orders-api has no Key Vault role', '403 Forbidden: Caller is not authorized to perform action on resource (ForbiddenByRbac).'],
  };
  const failAt = { label: 0, subject: 2, issuer: 2, role: 4 };
  let i = $state(0);
  let brk = $state('none');
  const steps = $derived(isPipeline ? PIPE[pipeMode] : WI);
  const broken = $derived(!isPipeline && brk !== 'none' && i >= failAt[brk]);

  // task: pod runs in orders-dev; fix the subject
  let fics = $state(['system:serviceaccount:orders:orders-api']);
  let annotation = $state('6c1f2a9e-0000-4b1d-9c55-1a2b3c4d5e6f');
  let tried = $state(null);
  const want = 'system:serviceaccount:orders-dev:orders-api';
  function tryIt() {
    if (annotation !== '6c1f2a9e-0000-4b1d-9c55-1a2b3c4d5e6f') tried = ['warn', 'The client ID is fine. Read the subject in the error.'];
    else if (fics.map((f) => f.trim()).includes(want)) { tried = ['ok', '✓ Token exchange succeeds: the subject matches the pod’s namespace and ServiceAccount.']; onsolved(); }
    else tried = ['bad', `AADSTS700213: No matching federated identity record found for presented assertion subject '${want}'.`];
  }
</script>

<div class="wg">
  {#if mode === 'task'}
    <div class="wg-panel small">
      <div><b>Pod</b>: namespace <code>orders-dev</code>, ServiceAccount <code>orders-api</code></div>
      <label>ServiceAccount annotation client-id <input class="mono" bind:value={annotation} /></label>
      {#each fics as f, k}<label>Federated credential {k + 1} subject <input class="mono" bind:value={fics[k]} /></label>{/each}
      <div class="wg-bar"><button class="btn small" onclick={() => (fics = [...fics, ''])}>+ Add a federated credential</button><button class="btn small primary" onclick={tryIt}>Restart the pod</button></div>
    </div>
    {#if tried}<div class="wg-msg {tried[0]}">{tried[1]}</div>{/if}
  {:else}
    <div class="flowline">
      {#each steps as s, k}
        {#if k}<span class="arrow">→</span>{/if}
        <button class="hop" class:on={k === i} class:done={k < i} class:bad={broken && k === failAt[brk]} onclick={() => (i = k)}>{k + 1}. {s[1]}</button>
      {/each}
    </div>
    <div class="wg-msg" class:bad={broken}>{#if broken}<b>Broken: {BREAKS[brk][0]}.</b><br /><span class="mono small">{BREAKS[brk][1]}</span>{:else}{steps[i][2]}{/if}</div>
    <div class="wg-bar">
      <button class="btn small" onclick={() => (i = Math.max(0, i - 1))}>← Back</button>
      <button class="btn small primary" onclick={() => (i = (i + 1) % steps.length)}>{i === steps.length - 1 ? 'Restart ↺' : 'Next →'}</button>
      {#if !isPipeline}<label>Break a link <select bind:value={brk}>{#each Object.entries(BREAKS) as [k, v]}<option value={k}>{v ? v[0] : 'nothing broken'}</option>{/each}</select></label>{/if}
    </div>
  {/if}
</div>

<style>label { display: grid; gap: 2px; margin: 6px 0; }</style>
