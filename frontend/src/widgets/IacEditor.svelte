<script>
  // HCL / Bicep editor tasks graded by "planning" the file for dev and prod
  // with the tiny expression evaluator in expr.js.
  import { evaluate, hclLookup, bicepLookup } from './expr.js';
  import { modeOf } from './lib.js';
  let { text, onsolved } = $props();
  const mode = modeOf(text, {
    validation: /validation block/i,
    tier: /sku_tier and private_cluster_enabled/i,
    subject: /subject renders/i,
    moved: /has moved to/i,
    bicepPrivate: /enablePrivateCluster/i,
    bicepGpu: /GPU VM size/i,
  }, 'validation');

  const STARTERS = {
    validation: `variable "environment" {\n  type        = string\n  description = "Environment name: dev or prod."\n  # add a validation block here\n}\n`,
    tier: `locals {\n  is_prod = var.environment == "prod"\n}\n\nresource "azurerm_kubernetes_cluster" "main" {\n  name                    = "aks-orders-\${var.environment}"\n  sku_tier                = "Free"\n  private_cluster_enabled = false\n  # … the rest of the cluster from steps 1–9 …\n}\n`,
    subject: `locals {\n  is_prod = var.environment == "prod"\n}\n\nresource "azurerm_federated_identity_credential" "orders_api" {\n  name      = "orders-api"\n  parent_id = azurerm_user_assigned_identity.orders_api.id\n  audience  = ["api://AzureADTokenExchange"]\n  issuer    = azurerm_kubernetes_cluster.main.oidc_issuer_url\n  subject   = "system:serviceaccount:orders:orders-api"\n}\n`,
    moved: `# The resource was renamed from "main" to "orders".\nresource "azurerm_kubernetes_cluster" "orders" {\n  name     = "aks-orders-dev"\n  sku_tier = "Standard"\n  # …\n}\n`,
    bicepPrivate: `@allowed([\n  'dev'\n  'prod'\n])\nparam environment string\n\nvar isProd = environment == 'prod'\n\nresource aks 'Microsoft.ContainerService/managedClusters@2024-09-01' = {\n  name: 'aks-orders-\${environment}'\n  location: resourceGroup().location\n  properties: {\n    apiServerAccessProfile: {\n      enablePrivateCluster: false\n      authorizedIPRanges: ['203.0.113.0/24']\n    }\n  }\n}\n`,
    bicepGpu: `@allowed([\n  'dev'\n  'prod'\n])\nparam environment string\n\nvar isProd = environment == 'prod'\n\nresource aks 'Microsoft.ContainerService/managedClusters@2024-09-01' existing = {\n  name: 'aks-orders-\${environment}'\n}\n\n// add a GPU node pool here, deployed only in prod\n`,
  };
  let src = $state(STARTERS[mode]);
  const isHcl = !mode.startsWith('bicep');

  function attr(name) {
    const re = isHcl ? new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm') : new RegExp(`^\\s*${name}\\s*:\\s*(.+?)\\s*$`, 'm');
    const m = src.replace(/(#|\/\/).*$/gm, '').match(re);
    return m ? m[1] : null;
  }
  function val(expr, env) {
    const look = isHcl ? hclLookup(src, { environment: env }) : bicepLookup(src, { environment: env });
    return evaluate(expr, look);
  }

  const result = $derived.by(() => {
    try {
      if (mode === 'validation') {
        const block = src.match(/validation\s*\{([\s\S]*?)\n\s*\}/);
        if (!block) return { rows: [], fail: 'No validation block yet.' };
        const cond = block[1].match(/condition\s*=\s*(.+)/)?.[1];
        const msg = block[1].match(/error_message\s*=\s*(.+)/)?.[1];
        if (!cond) return { rows: [], fail: 'The validation block needs a condition.' };
        const rows = ['test', 'Prod', 'dev', 'prod'].map((v) => {
          const ok = !!evaluate(cond, hclLookup('', { environment: v }));
          const want = v === 'dev' || v === 'prod';
          return { env: `-var environment=${v}`, got: ok ? 'accepted' : `rejected${msg ? ': ' + msg.replace(/^"|"$/g, '') : ''}`, pass: ok === want };
        });
        return { rows, fail: !msg ? 'Add an error_message.' : rows.every((r) => r.pass) ? null : 'The condition must accept exactly dev and prod.' };
      }
      if (mode === 'tier') {
        const rows = ['dev', 'prod'].flatMap((env) => {
          const tier = val(attr('sku_tier') ?? '"Free"', env);
          const priv = val(attr('private_cluster_enabled') ?? 'false', env);
          const want = env === 'prod' ? ['Standard', true] : ['Free', false];
          return [{ env, got: `sku_tier = "${tier}"`, pass: tier === want[0] }, { env, got: `private_cluster_enabled = ${priv}`, pass: priv === want[1] }];
        });
        return { rows, fail: rows.every((r) => r.pass) ? null : 'Prod should plan Standard + private; dev Free + public, both from var.environment.' };
      }
      if (mode === 'subject') {
        const rows = ['dev', 'prod'].map((env) => {
          const s = val(attr('subject'), env);
          const want = `system:serviceaccount:${env === 'prod' ? 'orders-prod' : 'orders'}:orders-api`;
          return { env, got: `subject = "${s}"`, pass: s === want };
        });
        return { rows, fail: rows.every((r) => r.pass) ? null : 'In prod the subject must name namespace orders-prod; in dev, orders.' };
      }
      if (mode === 'moved') {
        const mv = src.match(/moved\s*\{[\s\S]*?from\s*=\s*([\w.]+)[\s\S]*?to\s*=\s*([\w.]+)[\s\S]*?\}/);
        const ok = mv && mv[1] === 'azurerm_kubernetes_cluster.main' && mv[2] === 'azurerm_kubernetes_cluster.orders';
        const rows = [{ env: 'plan', got: ok ? '# azurerm_kubernetes_cluster.main has moved to azurerm_kubernetes_cluster.orders\nPlan: 0 to add, 0 to change, 0 to destroy.' : '# azurerm_kubernetes_cluster.main will be destroyed\n# azurerm_kubernetes_cluster.orders will be created\nPlan: 1 to add, 0 to change, 1 to destroy.', pass: !!ok }];
        return { rows, fail: ok ? null : 'Tell Terraform the old and new addresses are the same resource.', pre: true, okMsg: '✓ The plan shows a move, with nothing to destroy.' };
      }
      if (mode === 'bicepPrivate') {
        const rows = ['dev', 'prod'].flatMap((env) => {
          const p = val(attr('enablePrivateCluster') ?? 'false', env);
          const r = attr('authorizedIPRanges') ? val(attr('authorizedIPRanges'), env) : [];
          const want = env === 'prod';
          return [{ env, got: `enablePrivateCluster: ${p}`, pass: p === want }, { env, got: `authorizedIPRanges: ${JSON.stringify(r)}`, pass: want ? !r || r.length === 0 : r && r.length > 0 }];
        });
        return { rows, fail: rows.every((r) => r.pass) ? null : 'Prod: private and no ranges. Dev: public with the ranges.' };
      }
      if (mode === 'bicepGpu') {
        const m = src.match(/resource\s+\w+\s+'Microsoft\.ContainerService\/managedClusters\/agentPools@[^']+'\s*=\s*if\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
        if (!m) return { rows: [], fail: "Add a resource of type 'Microsoft.ContainerService/managedClusters/agentPools@…' = if (…) { … }." };
        const body = m[2];
        const gpu = /vmSize:\s*'Standard_N\w+'/.test(body);
        const taint = /nodeTaints:\s*\[\s*'gpu=true:NoSchedule'\s*\]/.test(body);
        const parent = /parent:\s*aks/.test(body);
        const rows = ['dev', 'prod'].map((env) => { const on = !!val(m[1], env); return { env, got: on ? 'GPU pool deployed' : 'no GPU pool', pass: on === (env === 'prod') }; });
        rows.push({ env: 'pool', got: `GPU VM size ${gpu ? '✓' : '✗'} · taint gpu=true:NoSchedule ${taint ? '✓' : '✗'} · parent: aks ${parent ? '✓' : '✗'}`, pass: gpu && taint && parent });
        return { rows, fail: rows.every((r) => r.pass) ? null : 'Prod only, a GPU size (Standard_N…), the gpu=true:NoSchedule taint and parent: aks.' };
      }
    } catch (e) {
      return { rows: [], fail: `Error: ${e.message}` };
    }
    return { rows: [], fail: '' };
  });
  const ok = $derived(result.rows.length > 0 && !result.fail);
  $effect(() => { if (ok) onsolved(); });
</script>

<div class="wg">
  <textarea class="mini-editor" rows={Math.max(12, src.split('\n').length + 1)} bind:value={src} spellcheck="false"></textarea>
  <div class="wg-panel">
    <div class="kicker">{isHcl ? 'terraform plan' : 'bicep build'} · simulated</div>
    {#if result.rows.length}
      <table class="small"><tbody>{#each result.rows as r}<tr><td class="mono">{r.env}</td><td class="mono" style="white-space:pre-wrap">{r.got}</td><td class={r.pass ? 'yes' : 'no'}>{r.pass ? '✓' : '✗'}</td></tr>{/each}</tbody></table>
    {/if}
    <div class="wg-msg" class:ok class:bad={result.fail && /^Error/.test(result.fail)}>{ok ? (result.okMsg || '✓ Both environments plan exactly as required.') : result.fail}</div>
  </div>
</div>
