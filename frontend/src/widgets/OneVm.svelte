<script>
  let { text } = $props();
  const events = {
    crash: ['Container crashes', 'orders-api exits with code 2. Docker’s restart policy may bring it back, but nobody checks it is healthy.', 'Nothing notices that it keeps crashing every minute.'],
    reboot: ['VM reboots', 'The host is patched and reboots. Everything on it is down for 3 minutes.', 'No second machine took over.'],
    traffic: ['Black Friday traffic', 'Requests jump 10×. CPU hits 100% and latency climbs to seconds.', 'Nobody added capacity, and one VM can only grow so far.'],
    deploy: ['Deploy v1.1', 'You stop v1.0 and start v1.1 by hand. Users see errors for 40 seconds.', 'There was no rolling update and no automatic rollback.'],
    second: ['Add a second service', 'web needs to call orders-api. You hard-code 10.20.0.4:8080 in its config.', 'Nothing gives services stable names or balances between copies.'],
  };
  let ev = $state(null);
  let load = $derived(ev === 'traffic' ? 100 : ev === 'crash' || ev === 'reboot' || ev === 'deploy' ? 0 : 35);
  const highlight = Object.keys(events).find((k) => text.toLowerCase().includes(events[k][0].toLowerCase()) && text.includes('highlighted'));
</script>

<div class="wg">
  <div class="wg-bar">{#each Object.entries(events) as [k, e]}<button class="btn small" class:primary={ev === k} onclick={() => (ev = k)}>{e[0]}</button>{/each}</div>
  <div class="vm box" class:badb={ev && ev !== 'second'}>
    <h4>🖥️ vm-orders-01</h4>
    <div class="row"><span class="tile" class:ready={!ev || ev === 'traffic' || ev === 'second'} class:term={ev === 'crash' || ev === 'reboot' || ev === 'deploy'}><b>orders-api</b>{ev === 'crash' ? 'Exited (2)' : ev === 'reboot' ? 'host rebooting' : ev === 'deploy' ? 'stopped → v1.1' : 'running'}</span>
      {#if ev === 'second'}<span class="tile ready"><b>web</b>→ 10.20.0.4:8080</span>{/if}</div>
    <div class="barrow small"><span>Traffic / CPU</span><div class="bartrack"><span style="width:{load}%;background:{load > 90 ? 'var(--bad)' : 'var(--ok)'}"></span></div><b>{load}%</b></div>
  </div>
  {#if ev}<div class="wg-msg">{events[ev][1]}<br /><b class="no">Nobody handled this:</b> {events[ev][2]}</div>{/if}
</div>
