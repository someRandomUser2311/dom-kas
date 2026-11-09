<script>
  // A scripted kubectl against a small sample cluster (namespace orders).
  import { tick } from 'svelte';
  const NODES = ['aks-user-1234-vmss000000', 'aks-user-1234-vmss000001', 'aks-user-1234-vmss000002'];
  let pods = $state([
    { name: 'orders-api-7d9c5f6b8-2xk9p', app: 'orders-api', ip: '10.244.1.12', node: 0, restarts: 0 },
    { name: 'orders-api-7d9c5f6b8-q8w4m', app: 'orders-api', ip: '10.244.2.7', node: 1, restarts: 0 },
    { name: 'orders-api-7d9c5f6b8-z5t2n', app: 'orders-api', ip: '10.244.3.9', node: 2, restarts: 2 },
    { name: 'web-6c8f9d7b5-h4j2k', app: 'web', ip: '10.244.1.13', node: 0, restarts: 0 },
    { name: 'web-6c8f9d7b5-m7p3s', app: 'web', ip: '10.244.2.8', node: 1, restarts: 0 },
  ]);
  const SUGGEST = [
    'kubectl get pods -n orders -o wide',
    'kubectl get deploy,svc -n orders',
    'kubectl get pods -n orders -l app=orders-api',
    'kubectl describe pod orders-api-7d9c5f6b8-z5t2n -n orders',
    'kubectl apply -f k8s/ -n orders',
    'kubectl delete pod orders-api-7d9c5f6b8-2xk9p -n orders',
    'kubectl logs orders-api-7d9c5f6b8-z5t2n -n orders --tail=5',
    'kubectl logs orders-api-7d9c5f6b8-z5t2n -n orders --previous',
    'kubectl exec -it web-6c8f9d7b5-h4j2k -n orders -- sh',
    'kubectl explain deployment.spec.strategy',
    'kubectl get pod orders-api-7d9c5f6b8-q8w4m -n orders -o jsonpath=\'{.status.podIP}\'',
    'kubectl config current-context',
  ];
  let input = $state('');
  let lines = $state([{ t: 'Sample cluster aks-orders-dev · namespace orders · type a kubectl command or pick one below.', c: 'muted' }]);
  let screen;
  let hist = [];
  let hi = 0;

  const pad = (s, n) => String(s).padEnd(n);
  const rand = () => Math.random().toString(36).slice(2, 7);

  function run(cmd) {
    const toks = cmd.trim().split(/\s+/);
    if (!toks[0]) return [];
    if (toks[0] === 'clear') { lines = []; return null; }
    if (toks[0] !== 'kubectl' && toks[0] !== 'k') return [`zsh: command not found: ${toks[0]}`];
    const flags = {};
    const pos = [];
    for (let i = 1; i < toks.length; i++) {
      const t = toks[i];
      if (t === '--') { flags['--'] = toks.slice(i + 1).join(' '); break; }
      if (t.startsWith('-')) {
        const [k, v] = t.split('=');
        const bool = ['-A', '--all-namespaces', '-it', '-i', '-t', '--previous', '-p', '-w', '--watch'].includes(k);
        flags[k] = v !== undefined ? v : bool ? true : toks[++i];
      } else pos.push(t);
    }
    const ns = flags['-n'] || flags['--namespace'] || (flags['-A'] || flags['--all-namespaces'] ? '*' : 'default');
    const out = flags['-o'] || flags['--output'];
    const [verb, res = '', name] = pos;
    const inOrders = ns === 'orders' || ns === '*';
    const r = res.split('/')[0].replace(/^(po|pod)$/, 'pods').replace(/^(deploy|deployment)$/, 'deployments').replace(/^(svc|service)$/, 'services').replace(/^(no|node)$/, 'nodes').replace(/^ns$/, 'namespaces');
    const sel = flags['-l'] || flags['--selector'];
    const plist = pods.filter((p) => !sel || sel === `app=${p.app}`);
    switch (verb) {
      case 'get': {
        if (r === 'nodes') return ['NAME                       STATUS   ROLES    AGE   VERSION', ...NODES.map((n) => `${pad(n, 27)}Ready    <none>   9d    v1.31.3`)];
        if (r === 'namespaces') return ['NAME              STATUS   AGE', 'default           Active   9d', 'kube-system       Active   9d', 'orders            Active   9d', 'web               Active   9d'];
        const parts = r.split(',');
        let o = [];
        for (const p of parts) {
          if (!inOrders && ['pods', 'deployments', 'services'].includes(p)) { o.push(`No resources found in ${ns} namespace.`, '(hint: add -n orders)'); continue; }
          if (p === 'pods') {
            if (name) {
              const pod = pods.find((x) => x.name === name);
              if (!pod) { o.push(`Error from server (NotFound): pods "${name}" not found`); continue; }
              if (out && out.startsWith('jsonpath')) { o.push(out.includes('podIP') ? pod.ip : out.includes('nodeName') ? NODES[pod.node] : ''); continue; }
              if (out === 'yaml') { o.push('apiVersion: v1', 'kind: Pod', 'metadata:', `  name: ${pod.name}`, '  namespace: orders', `  labels: {app: ${pod.app}}`, 'spec:', `  nodeName: ${NODES[pod.node]}`, '  containers: [...]', 'status:', '  phase: Running', `  podIP: ${pod.ip}`); continue; }
            }
            const wide = out === 'wide';
            o.push(`${ns === '*' ? 'NAMESPACE   ' : ''}NAME                          READY   STATUS    RESTARTS   AGE${wide ? '   IP            NODE' : ''}`);
            for (const x of plist.filter((x) => !name || x.name === name)) o.push(`${ns === '*' ? 'orders      ' : ''}${pad(x.name, 30)}1/1     Running   ${pad(x.restarts, 11)}${x.age || '3h'}${wide ? `    ${pad(x.ip, 14)}${NODES[x.node]}` : ''}`);
          } else if (p === 'deployments') {
            if (name && out === 'yaml') { o.push('apiVersion: apps/v1', 'kind: Deployment', 'metadata:', '  name: orders-api', '  namespace: orders', 'spec:', '  replicas: 3', '  strategy:', '    type: RollingUpdate', '    rollingUpdate: {maxSurge: 25%, maxUnavailable: 25%}', '  template: ...', 'status:', '  availableReplicas: 3', '  readyReplicas: 3'); continue; }
            o.push('NAME                READY   UP-TO-DATE   AVAILABLE   AGE', 'deployment.apps/orders-api   3/3     3            3           9d', 'deployment.apps/web          2/2     2            2           9d');
          } else if (p === 'services') {
            o.push('NAME                 TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE', 'service/orders-api   ClusterIP   10.0.142.17    <none>        80/TCP    9d', 'service/web          ClusterIP   10.0.88.203    <none>        80/TCP    9d');
          } else o.push(`error: the server doesn't have a resource type "${p}"`);
        }
        return o;
      }
      case 'describe': {
        const pod = pods.find((x) => x.name === (name || res.split('/')[1]));
        if (!pod) return [`Error from server (NotFound): pods "${name}" not found`];
        return [`Name:         ${pod.name}`, 'Namespace:    orders', `Node:         ${NODES[pod.node]}/10.20.0.${4 + pod.node}`, 'Status:       Running', `IP:           ${pod.ip}`, 'Containers:', '  api:', `    Image:          contosoacr.azurecr.io/${pod.app}:1.4.2`, '    State:          Running',
          ...(pod.restarts ? ['    Last State:     Terminated', '      Reason:       OOMKilled', '      Exit Code:    137'] : []), `    Restart Count:  ${pod.restarts}`, 'Events:', '  Type     Reason   Age   From     Message', '  ----     ------   ----  ----     -------',
          ...(pod.restarts ? ['  Warning  BackOff  11m   kubelet  Back-off restarting failed container api'] : ['  Normal   Started  3h    kubelet  Started container api'])];
      }
      case 'apply':
        if (!flags['-f']) return ['error: must specify one of -f and -k'];
        return ['deployment.apps/orders-api configured', 'service/orders-api unchanged', 'configmap/orders-api-config created'];
      case 'delete': {
        const n = name || res.split('/')[1];
        const pod = pods.find((x) => x.name === n);
        if (r === 'pods' && pod) {
          const repl = { ...pod, name: pod.name.replace(/-[a-z0-9]{5}$/, '-' + rand()), restarts: 0, age: '2s', ip: `10.244.${pod.node + 1}.${30 + Math.floor(Math.random() * 60)}` };
          pods = [...pods.filter((x) => x !== pod), repl];
          return [`pod "${n}" deleted`, `(the ReplicaSet already created ${repl.name}: run get pods again)`];
        }
        if (r === 'deployments') return [`deployment.apps "${n}" deleted   ← the whole app is gone. There's no undo.`];
        return [`Error from server (NotFound): ${r} "${n}" not found`];
      }
      case 'logs': {
        const target = res.startsWith('deploy') ? pods.find((x) => x.app === 'orders-api') : pods.find((x) => x.name === res);
        if (!target) return [`error: pods "${res}" not found`];
        if (flags['--previous'] || flags['-p']) return target.restarts ? ['{"level":"info","msg":"loading catalogue into memory","items":1840000}', 'fatal error: runtime: out of memory'] : ['Error from server (BadRequest): previous terminated container "api" in pod not found'];
        const all = ['{"level":"info","msg":"listening","port":8080}', '{"level":"info","msg":"GET /api/orders/42","status":200,"ms":12}', '{"level":"info","msg":"GET /readyz","status":200,"ms":1}', '{"level":"warn","msg":"slow query","ms":840}', '{"level":"info","msg":"POST /api/orders","status":201,"ms":31}', '{"level":"info","msg":"GET /api/orders/7","status":200,"ms":9}'];
        const n = Number(flags['--tail'] || all.length);
        return all.slice(-n);
      }
      case 'exec': {
        const target = pods.find((x) => x.name === res);
        if (!target) return [`Error from server (NotFound): pods "${res}" not found`];
        if (target.app === 'orders-api') return ['error: exec: "sh": executable file not found in $PATH (distroless image: use kubectl debug)'];
        const c = flags['--'] || '';
        if (c.startsWith('cat')) return ['server {', '  listen 8080;', '  location /api/ { proxy_pass http://orders-api.orders.svc.cluster.local; }', '}'];
        return ['/ $ (an interactive shell in the web container — type exit to leave)'];
      }
      case 'explain':
        return ['GROUP:      apps', 'KIND:       Deployment', 'FIELD: strategy <DeploymentStrategy>', 'DESCRIPTION:', '    The deployment strategy to use to replace existing pods with new ones.', 'FIELDS:', '  rollingUpdate\t<RollingUpdateDeployment>', '  type\t<string>'];
      case 'config':
        if (res === 'current-context') return ['aks-orders-dev'];
        if (res === 'get-contexts') return ['CURRENT   NAME              CLUSTER           NAMESPACE', '*         aks-orders-dev    aks-orders-dev    orders', '          aks-orders-prod   aks-orders-prod   orders'];
        return ['(config subcommands: current-context, get-contexts)'];
      case 'scale': return [`deployment.apps/${(res.split('/')[1] || name)} scaled`];
      default:
        return [`error: unknown command "${verb || ''}" for "kubectl" (try get, describe, apply, delete, logs, exec, explain, config)`];
    }
  }

  async function submit(cmd = input) {
    const out = run(cmd);
    if (out !== null) lines = [...lines, { t: `$ ${cmd}`, c: 'cmd' }, ...out.map((t) => ({ t, c: /^error|Error|fatal/.test(t) ? 'bad' : '' }))];
    if (cmd.trim()) hist.push(cmd);
    hi = hist.length;
    input = '';
    await tick();
    if (screen) screen.scrollTop = screen.scrollHeight;
  }
  function key(e) {
    if (e.key === 'Enter') submit();
    else if (e.key === 'ArrowUp' && hi > 0) { hi -= 1; input = hist[hi]; e.preventDefault(); }
    else if (e.key === 'ArrowDown' && hi < hist.length) { hi += 1; input = hist[hi] || ''; }
  }
</script>

<div class="wg">
  <div class="term" bind:this={screen}>
    {#each lines as l}<div class={l.c}>{l.t}</div>{/each}
    <div class="prompt"><span>$</span><input bind:value={input} onkeydown={key} spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="terminal input" /></div>
  </div>
  <div class="sugg">{#each SUGGEST as s}<button class="chip" onclick={() => { input = s; }}>{s.replace('kubectl ', '')}</button>{/each}</div>
</div>

<style>
  .term { background: var(--code-bg); color: var(--code-text); font: 12.5px/1.5 var(--mono); border-radius: 10px; padding: 10px 12px; height: 300px; overflow: auto; white-space: pre; }
  .cmd { color: #7dd3fc; margin-top: 4px; } .bad { color: #ff9a9a; } .muted { color: var(--code-com); white-space: normal; }
  .prompt { display: flex; gap: 8px; margin-top: 4px; } .prompt span { color: #6ee7a8; }
  .prompt input { flex: 1; background: transparent; border: 0; color: var(--code-text); padding: 0; font: inherit; }
  .sugg { display: flex; flex-wrap: wrap; gap: 4px; }
  .sugg .chip { cursor: pointer; font-family: var(--mono); font-weight: 500; }
</style>
