// Shared helpers for the interactive widgets.
import { parseAllDocuments, LineCounter } from 'yaml';

/** Parse multi-document YAML. Returns { docs, errors: [{ line, message }] }. */
export function parseYaml(text) {
  const lc = new LineCounter();
  const out = { docs: [], errors: [] };
  let parsed;
  try {
    parsed = parseAllDocuments(text, { lineCounter: lc, prettyErrors: false });
  } catch (e) {
    out.errors.push({ line: 1, message: e.message });
    return out;
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  for (const d of list) {
    for (const e of [...d.errors]) {
      const pos = e.pos ? lc.linePos(e.pos[0]) : { line: 1 };
      out.errors.push({ line: pos.line, message: e.message.split('\n')[0] });
    }
    if (!d.errors.length) {
      const v = d.toJS();
      if (v !== null && v !== undefined) out.docs.push(v);
    }
  }
  // Tabs are never valid indentation in YAML; say so plainly.
  text.split('\n').forEach((l, i) => {
    if (/^\s*\t/.test(l) && !out.errors.some((e) => e.line === i + 1)) out.errors.push({ line: i + 1, message: 'A tab is used for indentation. YAML only allows spaces.' });
  });
  return out;
}

/** Kubernetes label selector match: { matchLabels, matchExpressions } or a flat map. */
export function selects(selector, labels = {}) {
  if (!selector) return true;
  const ml = selector.matchLabels || (selector.matchExpressions ? {} : selector);
  for (const [k, v] of Object.entries(ml || {})) if (labels[k] !== String(v)) return false;
  for (const e of selector.matchExpressions || []) {
    const has = Object.prototype.hasOwnProperty.call(labels, e.key);
    const vals = (e.values || []).map(String);
    const ok = e.operator === 'In' ? has && vals.includes(labels[e.key])
      : e.operator === 'NotIn' ? !has || !vals.includes(labels[e.key])
      : e.operator === 'Exists' ? has
      : e.operator === 'DoesNotExist' ? !has : false;
    if (!ok) return false;
  }
  return true;
}

/** -l style selectors: "app=web,env in (dev,prod),!canary,tier!=db" */
export function selectsCli(sel, labels = {}) {
  const parts = sel.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  return parts.every((p) => {
    let m;
    if ((m = p.match(/^(\S+)\s+in\s+\(([^)]*)\)$/))) return m[2].split(',').map((x) => x.trim()).includes(labels[m[1]]);
    if ((m = p.match(/^(\S+)\s+notin\s+\(([^)]*)\)$/))) return !m[2].split(',').map((x) => x.trim()).includes(labels[m[1]]);
    if ((m = p.match(/^(\S+?)\s*!=\s*(\S+)$/))) return labels[m[1]] !== m[2];
    if ((m = p.match(/^(\S+?)\s*==?\s*(\S+)$/))) return labels[m[1]] === m[2];
    if ((m = p.match(/^!(\S+)$/))) return !(m[1] in labels);
    return p in labels;
  });
}

export async function evalApi(body) {
  const res = await fetch('/api/eval', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pick a mode by matching the widget's description against regexes. */
export function modeOf(text, table, fallback) {
  for (const [mode, re] of Object.entries(table)) if (re.test(text)) return mode;
  return fallback;
}

let n = 0;
export const uid = (p = 'w') => `${p}${++n}`;
