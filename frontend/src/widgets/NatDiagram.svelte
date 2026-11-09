<script>
  let step = $state(-1);
  const out = [
    ['Pod', '10.244.1.7:51234 → api.example.com:443', 'The pod sends from its own IP.'],
    ['Node', 'src rewritten to the node IP 10.20.0.5', 'With overlay networking, pod IPs never leave the node: the node SNATs them.'],
    ['NAT gateway', 'src rewritten to 20.50.9.3', 'Outbound to the internet leaves through the NAT gateway’s public IP.'],
    ['Internet API', 'sees 20.50.9.3:443', 'The API only ever sees the public IP. Allow-list that, not pod IPs.'],
  ];
  let replying = $state(false);
  function next() { replying = false; step = (step + 1) % out.length; }
  function reply() { replying = true; step = out.length - 1; const t = setInterval(() => { step -= 1; if (step <= 0) { step = 0; clearInterval(t); } }, 600); }
</script>

<div class="wg">
  <div class="flowline">
    {#each out as h, i}
      {#if i}<span class="arrow">{replying ? '←' : '→'}</span>{/if}
      <button class="hop" class:on={i === step} class:done={i < step && !replying} onclick={() => { replying = false; step = i; }}>{h[0]}</button>
    {/each}
  </div>
  {#if step >= 0}
    <div class="wg-msg"><b class="mono">{replying ? (step === 0 ? 'reply delivered to 10.244.1.7:51234' : `reply to ${out[step][1].split(' ').pop()}`) : out[step][1]}</b><br />{replying ? 'Each hop translates the destination back, using its connection table.' : out[step][2]}</div>
  {/if}
  <div class="wg-bar"><button class="btn small primary" onclick={next}>{step < 0 ? 'Send a request' : 'Next hop →'}</button><button class="btn small" onclick={reply} disabled={step < 0}>Reply ←</button></div>
</div>
