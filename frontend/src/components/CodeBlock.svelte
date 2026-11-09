<script>
  import { highlight } from '../lib/util.js';
  let { file = null, text = '', output = false, diff = false } = $props();
  let copied = $state(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text.replace(/^\+/gm, diff ? '' : '+')); copied = true; setTimeout(() => (copied = false), 1200); } catch { /* ignore */ }
  }
</script>

<div class="codebox">
  <div class="file"><span>{file || (output ? 'output' : 'code')}</span><button class="copy" onclick={copy}>{copied ? 'copied' : 'copy'}</button></div>
  <pre class="code">{#if output}{text}{:else}{@html highlight(text, diff)}{/if}</pre>
</div>

<style>
  .copy { background: none; border: 0; color: var(--muted); font: inherit; cursor: pointer; }
  .copy:hover { color: var(--accent); }
</style>
