// A tiny evaluator for HCL and Bicep expressions: literals, lists,
// var./local. references (HCL) or bare names (Bicep), == != && || !,
// ternaries, parentheses, string interpolation and a few functions.

function tokenize(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, out = '';
      while (j < s.length && s[j] !== c) { if (s[j] === '\\') { out += s[j + 1]; j += 2; continue; } out += s[j++]; }
      t.push({ k: 'str', v: out });
      i = j + 1;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['==', '!=', '&&', '||', '>=', '<='].includes(two)) { t.push({ k: 'op', v: two }); i += 2; continue; }
    if ('()[],?:!<>'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
    const m = s.slice(i).match(/^[A-Za-z_][\w.\-\[\]0-9]*/) ;
    if (m) { t.push({ k: 'id', v: m[0].replace(/\.$/, '') }); i += m[0].length; continue; }
    const n = s.slice(i).match(/^\d+(\.\d+)?/);
    if (n) { t.push({ k: 'num', v: Number(n[0]) }); i += n[0].length; continue; }
    throw new Error(`unexpected "${c}"`);
  }
  return t;
}

export function evaluate(src, lookup) {
  const t = tokenize(src);
  let p = 0;
  const peek = () => t[p];
  const eat = (v) => { if (peek()?.v !== v) throw new Error(`expected ${v}`); p++; };
  function interp(str) { return str.replace(/\$\{([^}]*)\}/g, (_, e) => String(evaluate(e, lookup))); }
  function primary() {
    const tk = t[p++];
    if (!tk) throw new Error('unexpected end');
    if (tk.k === 'str') return interp(tk.v);
    if (tk.k === 'num') return tk.v;
    if (tk.v === '(') { const v = ternary(); eat(')'); return v; }
    if (tk.v === '[') { const arr = []; while (peek()?.v !== ']') { arr.push(ternary()); if (peek()?.v === ',') p++; } eat(']'); return arr; }
    if (tk.v === '!') return !primary();
    if (tk.k === 'id') {
      if (tk.v === 'true') return true;
      if (tk.v === 'false') return false;
      if (tk.v === 'null') return null;
      if (peek()?.v === '(') {
        p++;
        const args = [];
        while (peek()?.v !== ')') { args.push(ternary()); if (peek()?.v === ',') p++; }
        eat(')');
        const f = { contains: (l, x) => l.includes(x), lower: (s) => s.toLowerCase(), upper: (s) => s.toUpperCase(), toLower: (s) => s.toLowerCase(), empty: (x) => !x || x.length === 0, length: (x) => x.length }[tk.v];
        if (!f) throw new Error(`unknown function ${tk.v}()`);
        return f(...args);
      }
      return lookup(tk.v);
    }
    throw new Error(`unexpected "${tk.v}"`);
  }
  function cmp() {
    let l = primary();
    while (['==', '!=', '>=', '<=', '<', '>'].includes(peek()?.v)) {
      const op = t[p++].v; const r = primary();
      l = op === '==' ? l === r : op === '!=' ? l !== r : op === '>=' ? l >= r : op === '<=' ? l <= r : op === '<' ? l < r : l > r;
    }
    return l;
  }
  function and() { let l = cmp(); while (peek()?.v === '&&') { p++; const r = cmp(); l = l && r; } return l; }
  function or() { let l = and(); while (peek()?.v === '||') { p++; const r = and(); l = l || r; } return l; }
  function ternary() {
    const c = or();
    if (peek()?.v === '?') { p++; const a = ternary(); eat(':'); const b = ternary(); return c ? a : b; }
    return c;
  }
  const v = ternary();
  if (p < t.length) throw new Error(`unexpected "${t[p].v}"`);
  return v;
}

/** HCL: collect `locals { name = expr }` (single-line values). */
export function hclLocals(src) {
  const out = {};
  for (const m of src.matchAll(/locals\s*\{([\s\S]*?)\n\s*\}/g)) {
    for (const line of m[1].split('\n')) {
      const a = line.replace(/#.*$/, '').match(/^\s*(\w+)\s*=\s*(.+?)\s*$/);
      if (a) out[a[1]] = a[2];
    }
  }
  return out;
}

export function hclLookup(src, vars) {
  const locals = hclLocals(src);
  const seen = new Set();
  const look = (id) => {
    if (id.startsWith('var.')) { const k = id.slice(4); if (!(k in vars)) throw new Error(`undeclared ${id}`); return vars[k]; }
    if (id.startsWith('local.')) {
      const k = id.slice(6);
      if (!(k in locals)) throw new Error(`unknown ${id}`);
      if (seen.has(k)) throw new Error(`cycle in local.${k}`);
      seen.add(k); const v = evaluate(locals[k], look); seen.delete(k); return v;
    }
    throw new Error(`unknown reference ${id}`);
  };
  return look;
}

/** Bicep: params come from the env; `var x = expr` are evaluated lazily. */
export function bicepLookup(src, params) {
  const vars = {};
  for (const m of src.matchAll(/^\s*var\s+(\w+)\s*=\s*(.+?)\s*$/gm)) vars[m[1]] = m[2];
  const look = (id) => {
    if (id in params) return params[id];
    if (id in vars) return evaluate(vars[id], look);
    throw new Error(`unknown name ${id}`);
  };
  return look;
}
