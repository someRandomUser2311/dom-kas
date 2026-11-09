<script>
  // Cards from the check's answer table; each must be dropped in its column.
  let { context = '', onsolved } = $props();
  const COLS = ['Azure', 'Shared', 'You'];
  const d = document.createElement('div');
  d.innerHTML = context;
  const cards = [...d.querySelectorAll('tr')]
    .map((tr) => [...tr.querySelectorAll('td')])
    .filter((td) => td.length === 2)
    .map((td, i) => ({ id: i, html: td[0].innerHTML, col: COLS.find((c) => td[1].textContent.trim().startsWith(c)), note: td[1].textContent.trim() }));
  const HINTS = { Azure: 'That runs in the control plane, which Azure operates for you.', You: 'That’s about what you deploy and configure — Azure won’t do it for you.', Shared: 'Azure does part of it, but you decide when or how.' };
  let placed = $state({});
  let picked = $state(null);
  let msg = $state('');
  let dragging = null;
  function drop(col, id = picked ?? dragging) {
    if (id === null || id === undefined) return;
    const c = cards[id];
    if (c.col === col) { placed[id] = col; msg = ''; }
    else msg = `“${c.html.replace(/<[^>]+>/g, '')}” isn’t ${col}. ${HINTS[c.col]}`;
    picked = null;
    if (cards.every((x) => placed[x.id])) onsolved();
  }
</script>

<div class="wg">
  <div class="tiles pool">
    {#each cards.filter((c) => !placed[c.id]) as c (c.id)}
      <button class="tile card-btn" class:hit={picked === c.id} draggable="true" ondragstart={() => (dragging = c.id)} onclick={() => (picked = c.id)}>{@html c.html}</button>
    {/each}
    {#if cards.every((c) => placed[c.id])}<span class="small yes">✓ All sorted.</span>{/if}
  </div>
  <div class="cols">
    {#each COLS as col}
      <div class="box col" role="list" ondragover={(e) => e.preventDefault()} ondrop={() => drop(col)} onclick={() => drop(col)} onkeydown={(e) => e.key === 'Enter' && drop(col)} tabindex="0">
        <h4>{col}</h4>
        {#each cards.filter((c) => placed[c.id] === col) as c}<div class="tile ready">{@html c.html}{#if col === 'Shared'}<span class="small muted"> · {c.note.replace(/^Shared\s*/, '')}</span>{/if}</div>{/each}
      </div>
    {/each}
  </div>
  <div class="small muted">Drag a card into a column, or click a card and then a column.</div>
  {#if msg}<div class="wg-msg warn">{msg}</div>{/if}
</div>

<style>
  .cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  @container (max-width: 520px) { .cols { grid-template-columns: 1fr; } }
  .col { min-height: 120px; cursor: pointer; display: grid; align-content: start; gap: 4px; }
  .card-btn { cursor: grab; color: var(--text); font-family: var(--font); font-size: 0.82rem; }
  .pool { min-height: 40px; }
</style>
