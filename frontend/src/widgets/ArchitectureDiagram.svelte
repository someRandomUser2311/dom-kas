<script>
  import { api } from '../lib/api.js';
  // component → lesson number that taught it
  const GROUPS = [
    ['Hub VNet', [['Azure Firewall', '5.3'], ['DNS Private Resolver', '6.5'], ['Bastion', '6.5'], ['Private DNS zones', '6.5']]],
    ['Prod spoke VNet', [['Private AKS (system + user pools, 3 zones)', '4.2'], ['Azure CNI Overlay + Cilium', '5.1'], ['Application Gateway for Containers', '8.4'], ['Private endpoint: ACR Premium', '6.4'], ['Private endpoint: Key Vault', '15.4'], ['PostgreSQL (private)', '9.1']]],
    ['Agents VNet', [['Managed DevOps Pool', '7.3']]],
    ['Monitoring', [['Log Analytics + Container insights', '14.1'], ['Azure Monitor workspace (Prometheus)', '14.2'], ['Managed Grafana', '14.2'], ['Alert rules', '14.6']]],
    ['Azure DevOps', [['Repos + branch policies', '7.1'], ['Pipelines', '7.2'], ['Environments with checks', '7.5'], ['WIF service connections', '7.4']]],
  ];
  let lessons = $state({});
  api.course().then((c) => { const m = {}; for (const ch of c.chapters) for (const l of ch.lessons) m[l.num] = l.id; lessons = m; }).catch(() => {});
  let sel = $state(null);
</script>

<div class="wg">
  <div class="arch">
    {#each GROUPS as [g, items]}
      <div class="box"><h4>{g}</h4>
        <div class="tiles">{#each items as [name, num]}<button class="tile" class:hit={sel === name} onclick={() => (sel = name)}><b>{name}</b>lesson {num}</button>{/each}</div>
      </div>
    {/each}
  </div>
  {#if sel}
    {@const num = GROUPS.flatMap((g) => g[1]).find((x) => x[0] === sel)[1]}
    <div class="wg-msg"><b>{sel}</b> was covered in lesson {num}. {#if lessons[num]}<a href={'#/lesson/' + lessons[num]}>Open lesson {num} →</a>{/if}</div>
  {/if}
</div>

<style>
  .arch { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; }
  button.tile { cursor: pointer; color: var(--text); text-align: left; font-family: var(--font); }
</style>
