<script>
  let { text, onsolved } = $props();
  const task = /Success when/i.test(text);
  const HOPS = ['Client → Gateway', 'Gateway → HTTPRoute', 'HTTPRoute → Service', 'Service → EndpointSlice', 'NetworkPolicy', 'Pod'];
  const SCENARIOS = [
    {
      name: '503 on /api after a blue/green switch',
      broken: 3,
      out: [
        '$ kubectl get gateway shop-gateway -n gateway-infra\nNAME           CLASS                ADDRESS          PROGRAMMED\nshop-gateway   azure-alb-external   shop.contoso…    True',
        '$ kubectl get httproute orders-api -n orders -o jsonpath=\'{.status.parents[0].conditions[*].type}={.status.parents[0].conditions[*].status}\'\nAccepted ResolvedRefs=True True',
        '$ kubectl get svc orders-api -n orders -o yaml | grep -A3 selector\n  selector:\n    app: orders-api\n    version: green',
        '$ kubectl get endpointslices -n orders -l kubernetes.io/service-name=orders-api\nNAME               ADDRESSTYPE   PORTS     ENDPOINTS   AGE\norders-api-x7k2q   IPv4          <unset>   <unset>     40m\n\n$ kubectl get pods -n orders --show-labels\norders-api-5b6f…   1/1  Running  app=orders-api,version=blue',
        '$ kubectl get netpol -n orders\nNAME                 POD-SELECTOR     AGE\ndefault-deny         <none>           9d\nallow-gateway-api    app=orders-api   9d   (allows gateway-infra → 8080)',
        '$ kubectl get pods -n orders\nNAME              READY   STATUS    RESTARTS\norders-api-5b6f…  1/1     Running   0',
      ],
      why: 'The Service selects version: green, but the pods are labelled version: blue, so the EndpointSlice is empty and the gateway has nowhere to send traffic.',
    },
    {
      name: 'Timeouts after adding default-deny',
      broken: 4,
      out: [
        '$ kubectl get gateway shop-gateway -n gateway-infra\nshop-gateway   azure-alb-external   PROGRAMMED True',
        'HTTPRoute orders-api: Accepted=True ResolvedRefs=True',
        'Service orders-api: selector app=orders-api · port 80 → targetPort http',
        'EndpointSlice: 3 endpoints ready (10.244.1.12, 10.244.2.7, 10.244.3.9 : 8080)',
        '$ kubectl get netpol -n orders\nNAME           POD-SELECTOR   AGE\ndefault-deny   <none>         3m\n(no policy allows ingress from gateway-infra)\n\nHubble: DROPPED (Policy denied) gateway-infra/alb → orders/orders-api:8080',
        'Pods 3/3 Running and Ready',
      ],
      why: 'default-deny blocks ingress to orders-api, and nothing allows traffic from gateway-infra on 8080.',
    },
    {
      name: '500 errors only on /api',
      broken: 1,
      out: [
        'Gateway PROGRAMMED True · listener https Accepted',
        '$ kubectl describe httproute orders-api -n orders\n  Conditions:\n    Type: Accepted      Status: True\n    Type: ResolvedRefs  Status: False  Reason: BackendNotFound\n    Message: backendRef orders-api:8080 — Service has no port 8080',
        'Service orders-api: port 80 → targetPort http',
        'EndpointSlice: 3 endpoints ready',
        'NetworkPolicy allows gateway-infra → orders-api:8080',
        'Pods Running and Ready',
      ],
      why: 'The HTTPRoute’s backendRef points at Service port 8080; the Service exposes port 80. ResolvedRefs=False says so.',
    },
  ];
  let sc = $state(0);
  let seen = $state({});
  let insp = $state(null);
  let verdict = $state(null);
  const S = $derived(SCENARIOS[task ? 0 : sc]);
  function inspect(i) { insp = i; seen[i] = true; }
  function blame(i) {
    if (i === S.broken) { verdict = ['ok', `✓ Found it. ${S.why}`]; if (task) onsolved(); }
    else verdict = ['warn', `${HOPS[i]}: not here — its output is healthy.`];
  }
</script>

<div class="wg">
  {#if !task}<div class="wg-bar"><label>Scenario <select bind:value={sc} onchange={() => { seen = {}; insp = null; verdict = null; }}>{#each SCENARIOS as s, i}<option value={i}>{s.name}</option>{/each}</select></label></div>{/if}
  <div class="flowline">
    {#each HOPS as h, i}
      {#if i}<span class="arrow">→</span>{/if}
      <button class="hop" class:on={insp === i} class:bad={verdict?.[0] === 'ok' && i === S.broken} onclick={() => inspect(i)}>{h}{seen[i] ? ' 🔍' : ''}</button>
    {/each}
  </div>
  {#if insp !== null}
    <pre class="code out">{S.out[insp]}</pre>
    <div class="wg-bar"><button class="btn small" onclick={() => blame(insp)}>This hop is broken</button></div>
  {:else}<div class="small muted">Click a hop to inspect it, then say which one is broken.</div>{/if}
  {#if verdict}<div class="wg-msg {verdict[0]}">{verdict[1]}</div>{/if}
</div>

<style>.out { font-size: 12px; white-space: pre-wrap; }</style>
