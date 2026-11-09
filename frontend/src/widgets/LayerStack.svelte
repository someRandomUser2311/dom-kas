<script>
  // Docker layer cache: which layers rebuild after a change.
  let order = $state('good');
  let change = $state(null);
  const layers = $derived(order === 'good'
    ? [
        { cmd: 'FROM golang:1.23 AS build', t: 0, dep: null },
        { cmd: 'WORKDIR /src', t: 0, dep: null },
        { cmd: 'COPY go.mod go.sum ./', t: 1, dep: 'deps' },
        { cmd: 'RUN go mod download', t: 45, dep: 'deps' },
        { cmd: 'COPY . .', t: 1, dep: 'src' },
        { cmd: 'RUN go build -o /out/orders-api ./cmd/orders-api', t: 25, dep: 'src' },
        { cmd: 'FROM gcr.io/distroless/static-debian12:nonroot', t: 0, dep: null },
        { cmd: 'COPY --from=build /out/orders-api /orders-api', t: 1, dep: 'src' },
      ]
    : [
        { cmd: 'FROM golang:1.23 AS build', t: 0, dep: null },
        { cmd: 'WORKDIR /src', t: 0, dep: null },
        { cmd: 'COPY . .', t: 1, dep: 'src' },
        { cmd: 'RUN go mod download', t: 45, dep: 'src' },
        { cmd: 'RUN go build -o /out/orders-api ./cmd/orders-api', t: 25, dep: 'src' },
        { cmd: 'FROM gcr.io/distroless/static-debian12:nonroot', t: 0, dep: null },
        { cmd: 'COPY --from=build /out/orders-api /orders-api', t: 1, dep: 'src' },
      ]);
  // a layer rebuilds if its inputs changed, or any layer above it in the same stage rebuilt
  const state = $derived.by(() => {
    let broken = false;
    return layers.map((l) => {
      if (l.cmd.startsWith('FROM')) broken = false;
      const hit = change && (l.dep === change || (change === 'deps' && l.dep === 'src'));
      if (hit) broken = true;
      return change ? broken || (change === 'src' && l.dep === 'src' && l.cmd.includes('--from')) : false;
    });
  });
  const total = $derived(layers.reduce((a, l, i) => a + (state[i] ? l.t : 0), 0));
</script>

<div class="wg">
  <div class="wg-bar">
    <span class="seg"><button class:on={order === 'naive'} onclick={() => (order = 'naive')}>Naïve: COPY . . first</button><button class:on={order === 'good'} onclick={() => (order = 'good')}>Cache-friendly</button></span>
    <button class="btn small" onclick={() => (change = 'src')}>✏️ Edit a source file</button>
    <button class="btn small" onclick={() => (change = 'deps')}>📦 Add a dependency</button>
    <button class="btn small ghost" onclick={() => (change = null)}>Reset</button>
  </div>
  <div class="stack">
    {#each layers as l, i}
      <div class="layer" class:rebuilt={state[i]}><span class="mono">{l.cmd}</span><span class="chip" class:warn={state[i]} class:ok={change && !state[i]}>{change ? (state[i] ? `rebuilt · ${l.t}s` : 'cached') : '—'}</span></div>
    {/each}
  </div>
  <div class="wg-msg" class:ok={change && total < 10} class:warn={total >= 10}>
    {#if !change}Make a change to see which layers Docker can reuse.{:else}Estimated build: <b>{total}s</b>. {order === 'naive' && change === 'src' ? 'Every source edit re-downloads all modules, because go mod download sits below COPY . .' : order === 'good' && change === 'src' ? 'Modules stay cached; only the build reruns.' : 'A dependency change has to re-download modules either way.'}{/if}
  </div>
</div>

<style>
  .stack { display: grid; gap: 3px; }
  .layer { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 5px 10px; border-radius: 6px; background: var(--surface); border: 1px solid var(--border); font-size: 12px; transition: background 0.3s; }
  .layer.rebuilt { background: var(--warn-soft); border-color: var(--warn); }
</style>
