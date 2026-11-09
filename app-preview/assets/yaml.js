/* KubeQuest prototype — YAML highlighter, code blocks, editor overlay, mini YAML parser.
   The real app does parsing/grading in Rust (serde_yaml + JSON schema + rule engine);
   this is a faithful-enough browser mock for the prototype. */
(function () {
  "use strict";
  const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ---------- highlighter (line based) ----------
  function hlValue(v) {
    if (!v) return "";
    let out = esc(v);
    // pipeline expressions first
    out = out.replace(/(\$\{\{.*?\}\}|\$\[.*?\]|\$\([\w.\-]+\))/g, '<span class="tk-expr">$1</span>');
    if (/^\s*(["']).*\1\s*$/.test(v)) return `<span class="tk-str">${out}</span>`;
    if (/^\s*(true|false|null|~)\s*$/i.test(v)) return `<span class="tk-kw">${out}</span>`;
    if (/^\s*-?\d+(\.\d+)?\s*$/.test(v)) return `<span class="tk-num">${out}</span>`;
    if (/^\s*[|>][-+]?\s*$/.test(v)) return `<span class="tk-kw">${out}</span>`;
    if (/<span/.test(out)) return out;
    return `<span class="tk-str">${out}</span>`;
  }
  function hlLine(line) {
    if (/^\s*#/.test(line)) return `<span class="tk-com">${esc(line)}</span>`;
    // split trailing comment (naive: " #" not inside quotes)
    let comment = "";
    const m = line.match(/^(.*?[^\\])(\s#.*)$/);
    if (m && !/["'][^"']*\s#/.test(m[1] + m[2].slice(0, 2))) { line = m[1]; comment = m[2]; }
    let out;
    const km = line.match(/^(\s*)(- )?([\w.\-$\[\]{}() '"]+?)(:)(\s+.*|\s*)$/);
    if (km && !/^\s*-\s*$/.test(line) && !km[3].includes("://")) {
      out = esc(km[1]) + (km[2] ? '<span class="tk-dash">- </span>' : "") + `<span class="tk-key">${esc(km[3])}</span>` + "<span class=\"tk-dash\">:</span>" + hlValue(km[5]);
    } else {
      const dm = line.match(/^(\s*)(- )(.*)$/);
      if (dm) out = esc(dm[1]) + '<span class="tk-dash">- </span>' + hlValue(dm[3]);
      else out = hlValue(line).replace(/^<span class="tk-str">(\s*)/, '$1<span class="tk-str">');
    }
    return out + (comment ? `<span class="tk-com">${esc(comment)}</span>` : "");
  }
  // block scalars (script: |) — highlight continuation lines as plain shell text
  function highlight(text) {
    const lines = text.replace(/\t/g, "  ").split("\n");
    const res = [];
    let blockIndent = -1;
    for (const line of lines) {
      const ind = line.match(/^\s*/)[0].length;
      if (blockIndent >= 0) {
        if (line.trim() === "" || ind > blockIndent) { res.push(`<span style="color:#c9d4e8">${esc(line).replace(/(\$\([\w.\-]+\))/g, '<span class="tk-expr">$1</span>')}</span>`); continue; }
        blockIndent = -1;
      }
      res.push(hlLine(line));
      if (/:\s*[|>][-+]?\s*$/.test(line)) blockIndent = ind + (/^\s*- /.test(line) ? 2 : 0);
    }
    return res;
  }

  // ---------- code block renderer ----------
  // opts: { title, clickable, startLine }
  function block(el, text, opts = {}) {
    const lines = highlight(text.replace(/\n$/, ""));
    const start = opts.startLine || 1;
    el.classList.add("code");
    if (opts.clickable) el.classList.add("clickable");
    el.innerHTML = (opts.title ? `<div class="code-head"><span class="dots"><i></i><i></i><i></i></span><span>${esc(opts.title)}</span>${opts.right ? `<span style="margin-left:auto">${opts.right}</span>` : ""}</div>` : "") +
      `<pre>${lines.map((l, i) => `<div class="ln" data-line="${i + start}"><span class="g">${i + start}</span><span class="t">${l || " "}</span></div>`).join("")}</pre>`;
    return el;
  }

  // ---------- editor (textarea + highlighted pre overlay) ----------
  function editor(host, initial, onChange) {
    host.classList.add("editor");
    host.innerHTML = `<div class="gutter"></div><pre aria-hidden="true"></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="YAML editor"></textarea>`;
    const ta = host.querySelector("textarea"), pre = host.querySelector("pre"), gut = host.querySelector(".gutter");
    let errLines = new Set();
    function paint() {
      const v = ta.value;
      pre.innerHTML = highlight(v).join("\n") + "\n";
      const n = v.split("\n").length;
      let g = "";
      for (let i = 1; i <= n; i++) g += `<div class="${errLines.has(i) ? "err" : ""}">${errLines.has(i) ? "●" : i}</div>`;
      gut.innerHTML = g;
      sync();
    }
    function sync() { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; }
    ta.addEventListener("input", () => { paint(); onChange && onChange(ta.value); });
    ta.addEventListener("scroll", sync);
    ta.addEventListener("keydown", e => {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 2;
        paint(); onChange && onChange(ta.value);
      } else if (e.key === "Enter") {
        // keep indentation (+2 after a trailing colon)
        e.preventDefault();
        const s = ta.selectionStart;
        const lineStart = ta.value.lastIndexOf("\n", s - 1) + 1;
        const cur = ta.value.slice(lineStart, s);
        let ind = cur.match(/^\s*/)[0];
        if (/:\s*$/.test(cur) || /:\s*[|>]\s*$/.test(cur)) ind += "  ";
        else if (/^\s*- /.test(cur) && /:\s*\S/.test(cur)) ind += "  ";
        const ins = "\n" + ind;
        ta.value = ta.value.slice(0, s) + ins + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + ins.length;
        paint(); onChange && onChange(ta.value);
      }
    });
    ta.value = initial;
    paint();
    return {
      get value() { return ta.value; },
      set value(v) { ta.value = v; paint(); onChange && onChange(v); },
      markErrors(lines) { errLines = new Set(lines); paint(); },
      focus() { ta.focus(); },
    };
  }

  // ---------- mini YAML parser (subset used by pipelines) ----------
  function parse(text) {
    const raw = text.split("\n");
    const errors = [];
    raw.forEach((l, i) => { if (/^\t/.test(l) || /^ *\t/.test(l)) errors.push({ line: i + 1, msg: "Tabs are not allowed for indentation in YAML. Use spaces." }); });
    const L = raw.map((r, i) => ({ raw: r, n: i + 1, ind: r.match(/^ */)[0].length, c: stripComment(r).trim() }));
    let i = 0;

    function stripComment(s) {
      let q = null;
      for (let k = 0; k < s.length; k++) {
        const ch = s[k];
        if (q) { if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'") q = ch;
        else if (ch === "#" && (k === 0 || /\s/.test(s[k - 1]))) return s.slice(0, k);
      }
      return s;
    }
    function skip() { while (i < L.length && L[i].c === "") i++; }
    function scalar(v) {
      v = v.trim();
      if (v === "") return null;
      if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
      if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map(x => scalar(x)).filter(x => x !== null && x !== "");
      if (/^(true|yes)$/i.test(v)) return true;
      if (/^(false|no)$/i.test(v)) return false;
      if (/^(null|~)$/i.test(v)) return null;
      if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
      return v;
    }
    function blockScalar(parentInd) {
      const out = [];
      let bi = -1;
      while (i < L.length) {
        const l = L[i];
        if (l.raw.trim() === "") { out.push(""); i++; continue; }
        if (l.ind <= parentInd) break;
        if (bi < 0) bi = l.ind;
        out.push(l.raw.slice(bi));
        i++;
      }
      while (out.length && out[out.length - 1] === "") out.pop();
      return out.join("\n");
    }
    function splitKey(c) {
      // key: value  (key may contain ${{ }})
      const m = c.match(/^((?:\$\{\{.*?\}\})|[^:\s][^:]*?)\s*:(?:\s+(.*)|\s*)$/);
      return m ? { k: m[1].replace(/^["']|["']$/g, ""), v: m[2] === undefined ? "" : m[2] } : null;
    }
    function parseValue(rest, ownInd, line) {
      if (/^[|>][-+]?$/.test(rest)) { i++; return blockScalar(ownInd); }
      if (rest !== "") { i++; return scalar(rest); }
      i++; skip();
      if (i >= L.length) return null;
      const nx = L[i];
      if (nx.ind > ownInd) return parseBlock(nx.ind);
      if (nx.ind === ownInd && /^-(\s|$)/.test(nx.c)) return parseSeq(ownInd);
      return null;
    }
    function parseBlock(ind) {
      skip();
      if (i >= L.length) return null;
      return /^-(\s|$)/.test(L[i].c) ? parseSeq(ind) : parseMap(ind);
    }
    function parseMap(ind) {
      const obj = {};
      while (true) {
        skip();
        if (i >= L.length) break;
        const l = L[i];
        if (l.ind < ind) break;
        if (l.ind > ind) { errors.push({ line: l.n, msg: `Unexpected indentation (${l.ind} spaces, expected ${ind}).` }); i++; continue; }
        if (/^-(\s|$)/.test(l.c)) break;
        const kv = splitKey(l.c);
        if (!kv) { errors.push({ line: l.n, msg: `Expected "key: value" but found "${l.c}".` }); i++; continue; }
        if (Object.prototype.hasOwnProperty.call(obj, kv.k)) errors.push({ line: l.n, msg: `Duplicate key "${kv.k}".` });
        Object.defineProperty(obj, "__line_" + kv.k, { value: l.n, enumerable: false });
        obj[kv.k] = parseValue(kv.v, ind, l.n);
      }
      return obj;
    }
    function parseSeq(ind) {
      const arr = [];
      while (true) {
        skip();
        if (i >= L.length) break;
        const l = L[i];
        if (l.ind !== ind || !/^-(\s|$)/.test(l.c)) {
          if (l.ind > ind) { errors.push({ line: l.n, msg: "Unexpected indentation inside a list." }); i++; continue; }
          break;
        }
        const rest = l.c.replace(/^-\s*/, "");
        if (rest === "") { i++; arr.push(parseBlock(L[i] ? L[i].ind : ind + 2)); continue; }
        const kv = splitKey(rest);
        if (kv && !/^["']/.test(rest)) {
          // inline map item: rewrite this line as a map line at a virtual indent
          const vInd = ind + (l.c.length - rest.length);
          L[i] = { ...l, ind: vInd, c: rest };
          arr.push(parseMap(vInd));
        } else { i++; arr.push(scalar(rest)); }
      }
      return arr;
    }

    let value = null;
    try { value = parseBlock(0); skip(); if (i < L.length) errors.push({ line: L[i].n, msg: "Could not parse the rest of the document." }); }
    catch (e) { errors.push({ line: 1, msg: "Parser error: " + e.message }); }
    return { value, errors };
  }

  window.KQY = { highlight, block, editor, parse, esc };
})();
