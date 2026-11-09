<script>
  let step = $state(0);
  const msgs = ['', 'api opens a connection to localhost:2020…', '…the packet stays on the pod’s loopback interface (they share one network namespace)…', '…log-agent answers on :2020. It never left the pod, and needed no Service.'];
  function go() { step = 1; const t = setInterval(() => { step += 1; if (step >= 3) clearInterval(t); }, 900); }
</script>

<div class="wg">
  <div class="pod box">
    <div class="row between"><h4>Pod orders-api-7d9c… </h4><span class="chip accent mono">IP 10.244.1.12</span></div>
    <div class="inner">
      <div class="tile" class:hit={step === 1}><b>api</b>:8080</div>
      <div class="vol" class:on={step === 2}>{step === 2 ? '⇢ localhost ⇢' : 'emptyDir /var/log/app (shared)'}</div>
      <div class="tile" class:hit={step === 3}><b>log-agent</b>:2020</div>
    </div>
  </div>
  <div class="wg-bar"><button class="btn small primary" onclick={go}>api → localhost:2020</button><span class="small muted">{msgs[step]}</span></div>
  <div class="small muted">Containers in a pod share the IP, the port space and any volumes you mount into both. Two containers can’t both listen on 8080.</div>
</div>

<style>
  .inner { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }
  .vol { border: 1.5px dashed var(--border); border-radius: 8px; padding: 6px 8px; font-size: 0.75rem; text-align: center; color: var(--muted); }
  .vol.on { border-color: var(--accent); color: var(--accent); font-weight: 600; }
</style>
