<script>
  // A plain-textarea code editor with line numbers. Tab indents two spaces.
  let { value = $bindable(''), rows = 22, label = 'editor' } = $props();
  let ta;
  let gutter;
  const lines = $derived(Math.max(value.split('\n').length, rows));

  function keydown(e) {
    if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const s = ta.selectionStart;
      const en = ta.selectionEnd;
      value = value.slice(0, s) + '  ' + value.slice(en);
      requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2));
    }
  }
  function scroll() {
    if (gutter) gutter.scrollTop = ta.scrollTop;
  }
</script>

<div class="editor" style="--rows:{rows}">
  <div class="gutter" bind:this={gutter} aria-hidden="true">{#each { length: lines } as _, i}<div>{i + 1}</div>{/each}</div>
  <textarea bind:this={ta} bind:value onkeydown={keydown} onscroll={scroll} spellcheck="false" autocapitalize="off" autocomplete="off" aria-label={label}></textarea>
</div>

<style>
  .editor { display: flex; background: var(--code-bg); border-radius: 10px; overflow: hidden; height: calc(var(--rows) * 1.55em + 20px); font: 13.5px/1.55 var(--mono); border: 1px solid var(--border); }
  .gutter { flex: none; width: 44px; padding: 10px 8px 10px 0; text-align: right; color: var(--code-com); overflow: hidden; user-select: none; background: rgba(255, 255, 255, 0.03); }
  textarea { flex: 1; resize: none; border: 0; border-radius: 0; background: transparent; color: var(--code-text); font: inherit; padding: 10px 12px; white-space: pre; overflow: auto; tab-size: 2; }
  textarea:focus { outline: none; }
</style>
