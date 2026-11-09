<script>
  // Compiles a small Bicep subset to ARM JSON: params, vars, resources,
  // symbolic references (→ resourceId / reference + dependsOn), interpolation.
  let src = $state(`param location string = resourceGroup().location
param env string = 'dev'

var vnetName = 'vnet-orders-\${env}'

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.20.0.0/16']
    }
  }
}

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  parent: vnet
  name: 'snet-nodes'
  properties: {
    addressPrefix: '10.20.0.0/22'
  }
}

output subnetId string = subnet.id
`);

  function compile(text) {
    const lines = text.split('\n');
    const params = {}, vars = {}, resources = {}, outputs = {};
    const symbols = {};
    // 1. collect declarations
    let i = 0;
    const blocks = [];
    while (i < lines.length) {
      const l = lines[i];
      let m;
      if ((m = l.match(/^param\s+(\w+)\s+(\w+)(?:\s*=\s*(.+))?$/))) { params[m[1]] = { type: m[2], def: m[3] }; i++; continue; }
      if ((m = l.match(/^var\s+(\w+)\s*=\s*(.+)$/))) { vars[m[1]] = m[2]; i++; continue; }
      if ((m = l.match(/^output\s+(\w+)\s+(\w+)\s*=\s*(.+)$/))) { outputs[m[1]] = { type: m[2], v: m[3] }; i++; continue; }
      if ((m = l.match(/^resource\s+(\w+)\s+'([^@']+)@([^']+)'\s*=\s*\{\s*$/))) {
        let depth = 1, j = i + 1, body = [];
        while (j < lines.length && depth > 0) { depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length; if (depth > 0) body.push(lines[j]); j++; }
        symbols[m[1]] = { type: m[2], api: m[3] };
        blocks.push({ sym: m[1], type: m[2], api: m[3], body: body.join('\n') });
        i = j; continue;
      }
      if (l.trim() && !l.trim().startsWith('//')) throw new Error(`line ${i + 1}: can't parse "${l.trim()}"`);
      i++;
    }
    // 2. values
    const deps = new Set();
    function expr(e) {
      e = e.trim();
      if (/^'.*'$/.test(e) && !e.includes('${')) return { lit: e.slice(1, -1) };
      if (/^-?\d+$/.test(e)) return { lit: Number(e) };
      if (e === 'true' || e === 'false') return { lit: e === 'true' };
      return { x: arm(e) };
    }
    function arm(e) {
      e = e.trim();
      if (/^'.*'$/.test(e)) {
        const parts = [];
        const fmt = e.slice(1, -1).replace(/\$\{([^}]*)\}/g, (_, x) => { parts.push(arm(x)); return `{${parts.length - 1}}`; });
        return parts.length ? `format('${fmt}', ${parts.join(', ')})` : `'${fmt}'`;
      }
      return e.replace(/\b([A-Za-z_]\w*)((?:\.\w+)*)(\(\))?/g, (all, id, rest, call) => {
        if (call) return all;
        if (id in params) return `parameters('${id}')${rest}`;
        if (id in vars) return `variables('${id}')${rest}`;
        if (id in symbols) {
          deps.add(id);
          const rid = resId(id);
          if (rest === '.id') return rid;
          if (rest === '.name') return nameOf(id);
          return `reference(${rid}, '${symbols[id].api}')${rest.replace(/^\.properties/, '')}`;
        }
        return all;
      });
    }
    function nameOf(sym) { return resources[sym]?.nameArm ?? `'${sym}'`; }
    function resId(sym) {
      const r = resources[sym];
      const segs = r?.parentSym ? [nameOf(r.parentSym), r.nameArm] : [r?.nameArm ?? `'${sym}'`];
      return `resourceId('${symbols[sym].type}', ${segs.join(', ')})`;
    }
    function value(src) {
      src = src.trim();
      if (src.startsWith('{')) {
        const inner = src.slice(1, src.lastIndexOf('}'));
        return objectOf(inner);
      }
      if (src.startsWith('[')) {
        const inner = src.slice(1, src.lastIndexOf(']'));
        return split(inner).map(value);
      }
      const v = expr(src);
      return 'lit' in v ? v.lit : `[${v.x}]`;
    }
    function split(s) {
      const out = []; let depth = 0, cur = '', q = false;
      for (const ch of s) {
        if (ch === "'") q = !q;
        if (!q && (ch === '{' || ch === '[')) depth++;
        if (!q && (ch === '}' || ch === ']')) depth--;
        if (!q && depth === 0 && (ch === '\n' || ch === ',')) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      if (cur.trim()) out.push(cur.trim());
      return out;
    }
    function objectOf(inner) {
      const o = {};
      for (const item of split(inner)) {
        const m = item.match(/^(\w+)\s*:\s*([\s\S]+)$/);
        if (!m) throw new Error(`can't parse "${item}"`);
        o[m[1]] = value(m[2]);
      }
      return o;
    }
    for (const b of blocks) {
      const obj = objectOf(b.body);
      const parentSym = typeof obj.parent === 'string' ? null : null;
      const pm = b.body.match(/^\s*parent:\s*(\w+)/m);
      const nameArm = (() => { const nm = b.body.match(/^\s*name:\s*(.+)$/m); const v = nm ? expr(nm[1]) : { lit: b.sym }; return 'lit' in v ? `'${v.lit}'` : v.x; })();
      resources[b.sym] = { nameArm, parentSym: pm ? pm[1] : parentSym };
    }
    const armResources = blocks.map((b) => {
      deps.clear();
      const obj = objectOf(b.body);
      const r = resources[b.sym];
      delete obj.parent;
      const name = r.parentSym ? `[format('{0}/{1}', ${nameOf(r.parentSym)}, ${r.nameArm})]` : obj.name;
      if (r.parentSym) deps.add(r.parentSym);
      deps.delete(b.sym);
      const res = { type: b.type, apiVersion: b.api, name, ...Object.fromEntries(Object.entries(obj).filter(([k]) => k !== 'name')) };
      if (deps.size) res.dependsOn = [...deps].map((d) => `[${resId(d)}]`);
      return res;
    });
    return {
      $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
      contentVersion: '1.0.0.0',
      parameters: Object.fromEntries(Object.entries(params).map(([k, p]) => [k, { type: p.type, ...(p.def ? { defaultValue: value(p.def) } : {}) }])),
      variables: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, value(v)])),
      resources: armResources,
      outputs: Object.fromEntries(Object.entries(outputs).map(([k, o]) => { deps.clear(); return [k, { type: o.type, value: value(o.v) }]; })),
    };
  }
  const out = $derived.by(() => { try { return { json: JSON.stringify(compile(src), null, 2) }; } catch (e) { return { error: e.message }; } });
</script>

<div class="wg">
  <div class="two-col">
    <div><div class="small muted">main.bicep (editable)</div><textarea class="mini-editor" rows="26" bind:value={src} spellcheck="false"></textarea></div>
    <div><div class="small muted">az bicep build → main.json</div>
      {#if out.error}<div class="wg-msg bad">{out.error}</div>{:else}<pre class="code json">{#each out.json.split('\n') as l}<span class:hl={/resourceId|dependsOn|parameters\(|variables\(|format\(/.test(l)}>{l}</span>{'\n'}{/each}</pre>{/if}
    </div>
  </div>
  <div class="small muted">Highlighted: symbolic references compiled to resourceId()/reference(), the dependsOn Bicep generates for you, and interpolation compiled to format().</div>
</div>

<style>
  .json { font-size: 11px; max-height: 520px; }
  .hl { background: rgba(125, 211, 252, 0.18); }
</style>
