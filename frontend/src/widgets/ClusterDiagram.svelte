<script>
  import { modeOf } from './lib.js';
  let { text } = $props();
  const mode = modeOf(text, { apply: /Follow a kubectl apply/i, split: /dashed line|Azure-managed/i }, 'parts');
  const CP = [
    ['kube-apiserver', 'The front door. Every component and every kubectl call talks to it; it authenticates, validates and stores objects.'],
    ['etcd', 'The key-value store that holds every object. Only the API server talks to it.'],
    ['kube-scheduler', 'Watches for Pods with no node and picks a node for each.'],
    ['kube-controller-manager', 'Runs the control loops: Deployments, ReplicaSets, Nodes, Jobs… each makes actual match desired.'],
    ['cloud-controller-manager', 'Talks to Azure: load balancers for Services, routes, node lifecycle.'],
  ];
  const NODE = [
    ['kubelet', 'The node agent. Watches the API server for Pods assigned to its node and runs them.'],
    ['kube-proxy', 'Programs the node’s networking so Service IPs reach pods (Cilium does this with eBPF on AKS overlay).'],
    ['containerd', 'The container runtime: pulls images and starts containers.'],
  ];
  const HOPS = [
    ['kubectl', 'kubectl → API server: authenticated (Entra ID), authorised (RBAC), validated.'],
    ['kube-apiserver', 'API server → etcd: the Deployment is stored. kubectl returns "created".'],
    ['kube-controller-manager', 'The Deployment controller sees it and creates a ReplicaSet.'],
    ['kube-controller-manager', 'The ReplicaSet controller creates 3 Pods with no node assigned.'],
    ['kube-scheduler', 'The scheduler assigns each Pod to a node.'],
    ['kubelet', 'The kubelet on each chosen node sees its Pod.'],
    ['containerd', 'containerd pulls contosoacr.azurecr.io/orders-api:1.4.2 and starts the container.'],
    ['kubelet', 'The kubelet reports the Pod as Running (and Ready once probes pass).'],
  ];
  let sel = $state(null);
  let hop = $state(-1);
  const active = $derived(mode === 'apply' ? (hop >= 0 ? HOPS[hop][0] : null) : sel);
  const desc = $derived([...CP, ...NODE].find((x) => x[0] === sel)?.[1]);
</script>

<div class="wg">
  <div class="cp box" class:managed={mode === 'split'}>
    <h4>{mode === 'split' ? '☁️ Control plane — Azure-managed, hidden from you' : 'Control plane'}</h4>
    <div class="tiles">{#each CP as c}<button class="tile" class:hit={active === c[0]} onclick={() => (sel = c[0])}><b>{c[0]}</b></button>{/each}
      {#if mode === 'apply'}<span class="tile" class:hit={active === 'kubectl'}><b>kubectl</b>your laptop / pipeline</span>{/if}</div>
  </div>
  <div class="small muted center">{mode === 'split' ? '- - - - - - - - - - your subscription below - - - - - - - - - -' : '↑ every arrow goes through the API server ↓'}</div>
  <div class="nodes">
    {#each [1, 2, 3] as n}
      <div class="box">
        <h4>{mode === 'split' ? `Node VM ${n} (VM Scale Set)` : `node-${n}`}</h4>
        <div class="tiles">{#each NODE as c}<button class="tile" class:hit={active === c[0]} onclick={() => (sel = c[0])}><b>{c[0]}</b></button>{/each}</div>
        <div class="tiles pods">{#if mode !== 'apply' || hop >= 6}<span class="tile ready">orders-api pod</span>{/if}{#if mode === 'split'}<span class="tile">add-ons</span>{/if}</div>
      </div>
    {/each}
  </div>
  {#if mode === 'apply'}
    <div class="wg-msg">{hop < 0 ? 'Run kubectl apply -f deployment.yaml and follow it hop by hop.' : `${hop + 1}/${HOPS.length} · ${HOPS[hop][1]}`}</div>
    <div class="wg-bar"><button class="btn small" disabled={hop < 0} onclick={() => (hop -= 1)}>← Back</button><button class="btn small primary" onclick={() => (hop = hop + 1 >= HOPS.length ? -1 : hop + 1)}>{hop < 0 ? '▶ kubectl apply' : hop === HOPS.length - 1 ? 'Restart' : 'Next hop →'}</button></div>
  {:else if desc}<div class="wg-msg"><b>{sel}</b>: {desc}</div>{:else}<div class="small muted">Click a component to see its job.</div>{/if}
</div>

<style>
  .cp { background: var(--accent-soft); }
  .cp.managed { border-style: dashed; }
  .nodes { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
  .center { text-align: center; }
  button.tile { cursor: pointer; color: var(--text); text-align: left; }
  .pods { margin-top: 6px; }
</style>
