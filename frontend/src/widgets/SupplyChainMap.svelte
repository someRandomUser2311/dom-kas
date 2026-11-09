<script>
  const HOPS = [
    ['Source repo', 'A contributor’s token leaks and an attacker pushes a commit that adds a backdoor.', 'Branch policies (PR + review), signed commits, short-lived tokens, and pipelines that only deploy from main.'],
    ['Dependencies', 'A typosquatted Go module (github.com/goggle/uuid) is pulled into go.mod.', 'Review new dependencies, pin go.sum, scan with Trivy/Dependabot, use a proxy or allow-list.'],
    ['Base image', 'The golang:1.23 tag is re-pointed to a compromised image upstream.', 'Pin base images by digest and rebuild deliberately; scan the base image.'],
    ['Build agent / tasks', 'A marketplace task you use is updated with code that exfiltrates the agent’s environment.', 'Pin task versions, run on Managed DevOps Pools you control, use WIF so there are no secrets to steal.'],
    ['Registry', 'Someone re-pushes orders-api:1.4.2 with different contents.', 'Deploy by digest, enable tag locking/immutability, sign images with Notation.'],
    ['Deploy', 'A manifest is edited to point at attacker.io/orders-api:1.4.2.', 'Admission policy: allowed registries only, and verify signatures (Ratify/Kyverno) in deny mode.'],
    ['Cluster', 'A pod runs privileged and escapes to the node.', 'Pod Security restricted, network policies, least-privilege RBAC and workload identity.'],
  ];
  let i = $state(null);
</script>

<div class="wg">
  <div class="flowline">{#each HOPS as h, k}{#if k}<span class="arrow">→</span>{/if}<button class="hop" class:on={i === k} onclick={() => (i = k)}>{h[0]}</button>{/each}</div>
  {#if i !== null}
    <div class="two-col">
      <div class="wg-msg bad"><b>Attack</b><br />{HOPS[i][1]}</div>
      <div class="wg-msg ok"><b>Control</b><br />{HOPS[i][2]}</div>
    </div>
  {:else}<div class="small muted">Click a hop to see how it’s attacked, and what stops it.</div>{/if}
</div>
