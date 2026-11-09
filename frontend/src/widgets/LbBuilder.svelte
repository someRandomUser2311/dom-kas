<script>
  let applied = $state(false);
  let internal = $state(false);
  const yaml = $derived(`apiVersion: v1
kind: Service
metadata:
  name: orders-api-public
  namespace: orders${internal ? `
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "true"` : ''}
spec:
  type: LoadBalancer
  selector:
    app: orders-api
  ports:
    - port: 80
      targetPort: 8080`);
</script>

<div class="wg">
  <div class="wg-bar">
    <button class="btn small primary" onclick={() => (applied = true)} disabled={applied}>kubectl apply</button>
    <button class="btn small" onclick={() => (applied = false)} disabled={!applied}>kubectl delete</button>
    <label><input type="checkbox" bind:checked={internal} /> internal annotation</label>
  </div>
  <div class="two-col">
    <pre class="code">{yaml}</pre>
    <div class="wg-panel">
      <div class="kicker">MC_rg-orders-dev_aks-orders-dev_westeurope</div>
      <div class="box" class:on={applied}>
        <h4>⚖️ {internal ? 'kubernetes-internal' : 'kubernetes'} (load balancer)</h4>
        {#if applied}
          <div class="tiles">
            <span class="tile ready"><b>frontend IP config</b>{internal ? '10.20.0.240 (VNet)' : 'a1b2c3d4… → public IP'}</span>
            <span class="tile ready"><b>rule</b>TCP 80 → nodes</span>
            <span class="tile ready"><b>health probe</b>TCP / nodePort</span>
          </div>
        {:else}<div class="small muted">no frontends for this Service</div>{/if}
      </div>
      {#if applied && !internal}<div class="box on"><h4>🌐 public IP kubernetes-a1b2c3d4…</h4><span class="mono small">20.103.48.17</span></div>{/if}
      <div class="small muted">{applied ? 'The cloud-controller-manager created these. Delete the Service and they go too — never edit them in the portal.' : 'Apply the Service and watch Azure resources appear.'}</div>
    </div>
  </div>
</div>
