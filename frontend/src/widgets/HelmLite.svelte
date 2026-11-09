<script>
  import { parseYaml } from './lib.js';
  const T_DEPLOY = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
spec:
{{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
{{- end }}
  template:
    spec:
      containers:
        - name: api
          image: "{{ .Values.image.repository }}:{{ required "image.tag is required" .Values.image.tag }}"`;
  const T_HPA = `{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ .Release.Name }}
spec:
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
{{- end }}`;
  let values = $state(`replicaCount: 2
image:
  repository: contosoacr.azurecr.io/orders-api
  tag: "1.4.2"
autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
`);
  let release = $state('orders-api');

  function lookup(ctx, path) {
    return path.replace(/^\./, '').split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
  }
  function evalExpr(expr, ctx) {
    expr = expr.trim();
    let m;
    if ((m = expr.match(/^required\s+"([^"]*)"\s+(\S+)$/))) {
      const v = lookup(ctx, m[2]);
      if (v === undefined || v === null || v === '') throw new Error(`execution error: ${m[1]}`);
      return v;
    }
    if ((m = expr.match(/^not\s+(\S+)$/))) return !evalExpr(m[1], ctx);
    if ((m = expr.match(/^(\S+)\s*\|\s*default\s+(.+)$/))) { const v = lookup(ctx, m[1]); return v === undefined || v === '' ? m[2].replace(/^"|"$/g, '') : v; }
    if (expr.startsWith('.')) return lookup(ctx, expr);
    return expr.replace(/^"|"$/g, '');
  }
  function renderT(tpl, ctx) {
    const lines = tpl.split('\n');
    const out = [];
    const stack = [true];
    for (const line of lines) {
      const ctrl = line.match(/^\s*\{\{-?\s*(if|else|end)\s*(.*?)\s*-?\}\}\s*$/);
      if (ctrl) {
        if (ctrl[1] === 'if') stack.push(stack[stack.length - 1] && !!evalExpr(ctrl[2], ctx));
        else if (ctrl[1] === 'else') { const v = stack.pop(); stack.push(stack[stack.length - 1] && !v); }
        else stack.pop();
        continue;
      }
      if (!stack[stack.length - 1]) continue;
      out.push(line.replace(/\{\{-?\s*(.*?)\s*-?\}\}/g, (_, e) => String(evalExpr(e, ctx))));
    }
    return out.join('\n').trim();
  }
  const result = $derived.by(() => {
    const v = parseYaml(values);
    if (v.errors.length) return { error: `values.yaml line ${v.errors[0].line}: ${v.errors[0].message}` };
    const ctx = { Values: v.docs[0] || {}, Release: { Name: release }, Chart: { AppVersion: '1.4.2' } };
    try {
      return { out: [renderT(T_DEPLOY, ctx), renderT(T_HPA, ctx)].filter(Boolean).join('\n---\n') };
    } catch (e) { return { error: `Error: ${e.message}` }; }
  });
</script>

<div class="wg">
  <div class="two-col">
    <div>
      <div class="small muted">templates/deployment.yaml · templates/hpa.yaml (read-only)</div>
      <pre class="code tpl">{T_DEPLOY}{'\n---\n'}{T_HPA}</pre>
      <div class="small muted">values.yaml (editable) · release <input class="mono rel" bind:value={release} /></div>
      <textarea class="mini-editor" rows="10" bind:value={values} spellcheck="false"></textarea>
    </div>
    <div>
      <div class="small muted">helm template {release} ./charts/orders-api</div>
      {#if result.error}<div class="wg-msg bad mono small">{result.error}</div>{:else}<pre class="code">{result.out}</pre>{/if}
    </div>
  </div>
  <div class="small muted">Try autoscaling.enabled: true (replicas disappears, an HPA appears), or delete image.tag (required fails the render).</div>
</div>

<style>
  .tpl { font-size: 11.5px; }
  .rel { width: 140px; padding: 2px 6px; font-size: 0.8rem; }
</style>
