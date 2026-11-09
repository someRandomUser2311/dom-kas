/* KubeQuest prototype — guided step player.
   A lesson is window.LESSON = { id, code, title, file, next, reference, steps: [...] }
   step = {
     title, body (html), visual? (html), more? (html for "Read more"),
     code?   (full file text; inherited from the previous step when omitted; new lines are auto-highlighted),
     coming? { set?: "A" | "B" | "C" | "TF" (default "B"), <persona key>: html, ... }
             A · Background: windows, linux, dev, clouds   B · CI/CD: gha, gitlab, jenkins, classic
             C · Infra tooling: portal, azcli, cfn, pulumi  TF: terraform (fixed tab, Chapter 13)
     check?  { type: "mcq",     q, options: [{ t, ok?, why? }], explain }
             { type: "multi",   q, options: [{ t, ok?, why? }], explain }          (select all that apply)
             { type: "order",   q, items: ["first", "second", ...], explain }     (shown shuffled)
             { type: "match",   q, pairs: [["left", "right"], ...], explain }
             { type: "command", q, spec: { cmd: ["kubectl", "get"], args?: [...], flags?: { "-n": "dev" | true },
                                         optional?: ["-o"], aliases?: { "--namespace": "-n", "no": "nodes" } },
                                    placeholder?, explain }
             { type: "write",   q, start: "file text", file?, rules: [{ label, test(text, parsed), hint?, critical? }], explain }
             { type: "tapline", q, match: "text on the right line", explain, wrong? }
             { type: "fill",    q, chips: [{ t, ok?, why? }], explain }   (code contains [[blank]])
     summary? true
   } */
(function () {
  "use strict";
  const L = window.LESSON;
  const PERSONA_SETS = {
    A: { label: "Background", def: "dev", list: [["windows", "Windows/IIS admin"], ["linux", "Linux admin"], ["dev", "Developer (Compose)"], ["clouds", "Other clouds"]] },
    B: { label: "CI/CD tool", def: "gha", list: [["gha", "GitHub Actions"], ["gitlab", "GitLab CI"], ["jenkins", "Jenkins"], ["classic", "Classic pipelines"]] },
    C: { label: "Infra tooling", def: "portal", list: [["portal", "Portal/ARM"], ["azcli", "az CLI scripts"], ["cfn", "CloudFormation"], ["pulumi", "Pulumi"]] },
    TF: { label: "Terraform", def: "terraform", list: [["terraform", "Terraform"]] },
  };
  const personaOf = set => KQ.store.get("persona." + set, set === "B" ? KQ.store.get("persona", "gha") : PERSONA_SETS[set].def);
  const esc = KQ.escapeHtml;
  // deterministic shuffle so the same step always shows the same order (and never the solved order)
  function shuffled(arr, seed) {
    const a = arr.map((v, i) => [v, i]);
    let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.length > 1 && a.every(([, i], k) => i === k)) a.push(a.shift());
    return a;
  }

  // resolve inherited code + auto-diff added lines
  let prev = "";
  // A step shows either a widget `panel` (+ optional onShow(el, api)) or a code file on the right.
  // Code is inherited from the previous code step unless the step has a panel; `noDiff` skips the "+" marks.
  let prevFile = L.file, prevShown = true;
  L.steps.forEach(s => {
    if (s.panel || (s.check && s.check.type === "write")) { s.code = s.code || ""; s.added = []; prevShown = false; return; }
    if (s.code == null) {
      // a step without its own code shows the previous file only if the previous step showed code
      s.code = prevShown ? prev : ""; s.file = s.file || prevFile; s.added = []; prevShown = !!s.code;
      if (!s.code) return;
    } else {
      prevShown = true;
      s.added = (s.summary || s.noDiff || (s.file && s.file !== prevFile)) ? [] : diffAdded(prev.replace("[[blank]]", ""), s.code.replace("[[blank]]", ""));
    }
    s.file = s.file || L.file;
    prevFile = s.file;
    prev = s.code.replace("[[blank]]", s.check && s.check.type === "fill" ? (s.check.chips.find(c => c.ok) || {}).t || "" : "");
  });
  function diffAdded(a, b) {
    const A = a ? a.split("\n") : [], B = b.split("\n");
    const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const added = []; let i = 0, j = 0;
    while (j < B.length) {
      if (i < A.length && A[i] === B[j]) { i++; j++; }
      else if (i < A.length && dp[i + 1][j] >= dp[i][j + 1]) i++;
      else { if (B[j].trim() !== "") added.push(j + 1); j++; }
    }
    return added;
  }

  const key = "step." + L.id;
  let idx = Math.min(KQ.store.get(key, 0), L.steps.length - 1);
  const solved = new Set(KQ.store.get(key + ".solved", []));
  const misses = {};
  let seen = new Set();

  // ---------- shell ----------
  document.body.innerHTML = `
    <div class="stp-top">
      <a class="stp-close" href="chapter.html" title="Exit lesson" aria-label="Exit lesson">✕</a>
      <div class="seg-progress" id="seg"></div>
      <span class="stp-label">${esc(L.code)} · ${esc(L.title)}</span>
      <button class="btn" id="more-btn">Read more</button>
    </div>
    <main class="stp-wrap" id="main"></main>
    <div class="stp-bottom">
      <button class="btn btn-lg" id="back">Back</button>
      <span class="stp-hintkeys"><kbd>←</kbd> <kbd>→</kbd> to move · <kbd>1</kbd>–<kbd>4</kbd> to answer</span>
      <button class="btn btn-lg btn-primary btn-raised" id="next">Continue</button>
    </div>
    <div class="drawer-scrim" id="scrim"></div>
    <aside class="drawer" aria-label="Read more">
      <div class="drawer-head">📖 Read more <button class="icon-btn" id="drawer-close" style="margin-left:auto" aria-label="Close">✕</button></div>
      <div class="drawer-body" id="drawer-body"></div>
    </aside>`;
  const $ = id => document.getElementById(id);

  function save() { KQ.store.set(key, idx); KQ.store.set(key + ".solved", [...solved]); }

  // ---------- render ----------
  function render() {
    const s = L.steps[idx];
    seen.add(idx);
    $("seg").innerHTML = L.steps.map((_, k) => `<i class="${k < idx ? "done" : k === idx ? "cur" : ""}" data-k="${k}" title="Step ${k + 1}"></i>`).join("");
    $("seg").querySelectorAll("i").forEach(el => el.onclick = () => { const k = +el.dataset.k; if (k <= Math.max(...seen)) go(k); });
    $("back").disabled = idx === 0;
    $("more-btn").classList.toggle("hidden", !s.more && !L.reference);
    if (s.summary) return renderSummary(s);

    const main = $("main");
    const isWrite = s.check && s.check.type === "write";
    const showComing = s.coming && personaOf(s.coming.set || "B") !== "none";
    main.innerHTML = `<div class="stp-anim">
      <div class="stp-kicker">${esc(L.short)} · ${idx + 1} of ${L.steps.length}</div>
      <h1 class="stp-title">${s.title}</h1>
      <div class="stp-grid ${!s.panel && !s.code && !isWrite ? "single" : ""}">
        <div class="stp-left">
          <div class="stp-card">${s.body}${s.visual || ""}</div>
          ${showComing ? comingHtml(s) : ""}
          ${s.check ? checkHtml(s) : ""}
        </div>
        ${s.panel ? `<div class="stp-code stp-panel"><div id="panel"></div></div>`
          : isWrite ? `<div class="stp-code"><div class="code"><div class="code-head"><span class="dots"><i></i><i></i><i></i></span><span>${esc(s.check.file || L.file || "file")}</span></div><div id="editor"></div></div></div>`
          : s.code ? `<div class="stp-code"><div id="code"></div></div>` : ""}
      </div></div>`;
    if (s.panel) $("panel").innerHTML = typeof s.panel === "function" ? s.panel() : s.panel;
    else if (s.code) drawCode(s);
    if (showComing) wireComing(s);
    if (s.check) wireCheck(s);
    if (s.onShow) s.onShow(s.panel ? $("panel") : $("code"), api(s));
    updateNext();
    window.scrollTo({ top: 0 });
  }

  function drawCode(s, opts = {}) {
    const el = $("code");
    const check = s.check;
    KQY.block(el, s.code, { title: s.file || L.file, clickable: check && check.type === "tapline" });
    if (check && check.type === "tapline") el.classList.add("tap");
    s.added.forEach(n => { const ln = el.querySelector(`.ln[data-line="${n}"]`); if (ln) ln.classList.add("added"); });
    if (check && check.type === "fill") {
      const filled = solved.has(idx) ? (check.chips.find(c => c.ok) || {}).t : null;
      el.innerHTML = el.innerHTML.replace("[[blank]]", `<span class="blank ${filled ? "filled ok" : ""}" id="blank">${filled || "?"}</span>`);
    }
    if (check && check.type === "tapline" && solved.has(idx)) markLine(lineOf(s, check.match), "hl-ok");
  }
  const lineOf = (s, m) => s.code.split("\n").findIndex(l => l.includes(m)) + 1;
  function markLine(n, cls) { const ln = $("code").querySelector(`.ln[data-line="${n}"]`); if (ln) { $("code").querySelectorAll(".ln").forEach(x => x.classList.remove("hl-bad")); ln.classList.add(cls); } }

  function comingHtml(s) {
    const set = PERSONA_SETS[s.coming.set || "B"], cur = personaOf(s.coming.set || "B");
    return `<div class="coming"><div class="coming-tabs"><span class="lbl">Coming from</span>${set.list.map(([k, n]) => `<button data-p="${k}" class="${k === cur ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="coming-body" id="coming-body"></div></div>`;
  }
  function wireComing(s) {
    const setKey = s.coming.set || "B";
    let cur = personaOf(setKey);
    const paint = () => {
      document.querySelectorAll(".coming-tabs button").forEach(b => b.classList.toggle("on", b.dataset.p === cur));
      $("coming-body").innerHTML = s.coming[cur] || "No direct equivalent. This one is specific to Azure.";
    };
    document.querySelectorAll(".coming-tabs button").forEach(b => b.onclick = () => { cur = b.dataset.p; KQ.store.set("persona." + setKey, cur); paint(); });
    paint();
  }

  // ---------- command check: a small CLI spec matcher ----------
  function tokenize(line) {
    const out = []; let m; const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
    return out;
  }
  function gradeCommand(line, spec) {
    const al = spec.aliases || {}, canon = t => al[t] || t;
    const toks = tokenize(line.trim().replace(/^\$\s*/, ""));
    if (!toks.length) return "Type a command first.";
    for (let i = 0; i < spec.cmd.length; i++) {
      if (canon(toks[i]) !== spec.cmd[i]) return i === 0 ? `Start with <code>${esc(spec.cmd[0])}</code>.` : `After <code>${esc(spec.cmd.slice(0, i).join(" "))}</code>, the next word should say what to do.`;
    }
    const args = [], flags = {};
    for (let i = spec.cmd.length; i < toks.length; i++) {
      let t = toks[i];
      if (t.startsWith("-")) {
        let v = true;
        if (t.includes("=")) { [t, v] = [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)]; }
        else {
          const isBool = (spec.flags || {})[canon(t)] === true || (spec.boolFlags || []).includes(canon(t));
          if (!isBool && toks[i + 1] && !toks[i + 1].startsWith("-")) v = toks[++i];
        }
        flags[canon(t)] = v;
      } else args.push(canon(t));
    }
    const want = (spec.args || []).map(canon);
    const missing = want.filter(a => !args.includes(a)), extra = args.filter(a => !want.includes(a));
    if (missing.length) return `Something's missing: which <b>resource</b> or argument? (expected ${missing.length} more)`;
    if (extra.length) return `<code>${esc(extra[0])}</code> isn't needed here.`;
    for (const [f, v] of Object.entries(spec.flags || {})) {
      if (!(f in flags)) return `You're missing a flag. Hint: <code>${esc(f)}</code>${v === true ? "" : " …"}`;
      if (v !== true && String(flags[f]) !== String(v)) return `<code>${esc(f)}</code> has the wrong value: <code>${esc(String(flags[f]))}</code>.`;
    }
    const allowed = new Set([...Object.keys(spec.flags || {}), ...(spec.optional || []).map(canon)]);
    const stray = Object.keys(flags).find(f => !allowed.has(f));
    if (stray) return `<code>${esc(stray)}</code> isn't needed for this task.`;
    return null;
  }

  // ---------- write check: rules over the learner's file ----------
  function gradeWrite(c, text) {
    const parsed = KQY.parse(text);
    return c.rules.map(r => { let ok = false; try { ok = !!r.test(text, parsed); } catch (e) { ok = false; } return { r, ok }; });
  }
  function writeResults(res) {
    return `<ul class="rule-list">${res.map(({ r, ok }) => `<li class="${ok ? "ok" : "bad"}"><span>${ok ? "✓" : r.critical ? "⛔" : "✗"}</span> ${r.label}${!ok && r.hint ? `<div class="subtle">${r.hint}</div>` : ""}</li>`).join("")}</ul>`;
  }

  function checkHtml(s) {
    const c = s.check;
    const label = c.label || { mcq: "Quick check", multi: "Select all that apply", order: "Put in order", match: "Match them up", command: "Type the command", write: "Write it", tapline: "Tap the line", fill: "Complete the code", custom: "Try it" }[c.type];
    let inner = "";
    const checkBtn = `<button class="btn btn-primary" id="chk" style="margin-top:12px">Check</button>`;
    if (c.type === "mcq") inner = `<div class="options">${c.options.map((o, k) => `<button class="option" data-k="${k}"><span class="key">${k + 1}</span><span>${o.t}</span></button>`).join("")}</div>`;
    if (c.type === "multi") inner = `<div class="options">${c.options.map((o, k) => `<button class="option" data-k="${k}" aria-pressed="false"><span class="key box">✓</span><span>${o.t}</span></button>`).join("")}</div>${checkBtn}`;
    if (c.type === "order") inner = `<ol class="order-list" id="order">${shuffled(c.items, L.id + idx).map(([t, i]) => `<li data-i="${i}"><span class="grip">⋮⋮</span><span class="t">${t}</span><span class="mv"><button class="icon-btn" data-d="-1" aria-label="Move up">↑</button><button class="icon-btn" data-d="1" aria-label="Move down">↓</button></span></li>`).join("")}</ol>${checkBtn}`;
    if (c.type === "match") {
      const rights = shuffled(c.pairs.map(p => p[1]), L.id + idx + "m");
      inner = `<div class="match-list">${c.pairs.map((p, k) => `<label class="match-row"><span class="l">${p[0]}</span><select data-k="${k}"><option value="">Choose…</option>${rights.map(([t, i]) => `<option value="${i}">${esc(t)}</option>`).join("")}</select></label>`).join("")}</div>${checkBtn}`;
    }
    if (c.type === "command") inner = `<div class="cmd-line"><span class="pr">$</span><input id="cmd" class="mono" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(c.placeholder || "type here, then press Enter")}"></div>${checkBtn}`;
    if (c.type === "write") inner = `<p class="subtle" style="margin:0">👉 Edit the file ${window.innerWidth > 900 ? "on the right" : "below"}, then press Check.</p>${checkBtn}<div id="rules"></div>`;
    if (c.type === "fill") inner = `<div class="chip-bank" style="margin-top:0">${c.chips.map((o, k) => `<span class="chip mono" data-k="${k}">${esc(o.t)}</span>`).join("")}</div>`;
    if (c.type === "custom") inner = c.html || `<p class="subtle" style="margin:0">👉 Use the panel ${window.innerWidth > 900 ? "on the right" : "below"}.</p>`;
    if (c.type === "tapline") inner = `<p class="subtle" style="margin:0">👉 Tap a line in the code ${window.innerWidth > 900 ? "on the right" : "below"}.</p>`;
    return `<div class="stp-interact" id="interact"><div class="kicker">${label}</div><div class="q">${c.q}</div>${inner}<div class="stp-fb" id="fb"></div></div>`;
  }
  function feedback(ok, html) {
    const fb = $("fb");
    fb.className = "stp-fb " + (ok ? "ok" : "bad");
    fb.innerHTML = html;
    if (!ok) { const box = $("interact"); box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); }
  }
  function solve(s) {
    if (!solved.has(idx)) { solved.add(idx); if (!misses[idx]) KQ.addXP(5); save(); }
    feedback(true, `<b>${misses[idx] ? "Got it." : "Correct!"}</b> ${s.check.explain}`);
    updateNext();
  }
  function miss(html) { misses[idx] = (misses[idx] || 0) + 1; feedback(false, html); }
  // handed to step.onShow so widgets can complete a "custom" check
  function api(s) {
    const at = idx;
    return { solve: () => { if (idx === at && s.check && !solved.has(at)) solve(s); },
             miss: html => { if (idx === at && s.check && !solved.has(at)) miss(html); },
             isSolved: () => solved.has(at) };
  }

  function wireCheck(s) {
    const c = s.check;
    const q = sel => [...document.querySelectorAll("#interact " + sel)];
    const showSolved = () => {
      if (c.type === "mcq" || c.type === "multi") q(".option").forEach(b => { if (c.options[+b.dataset.k].ok) b.classList.add("correct"); });
      if (c.type === "fill") q(".chip").forEach(ch => { if (c.chips[+ch.dataset.k].ok) ch.classList.add("used"); });
      if (c.type === "order") { $("order").innerHTML = c.items.map(t => `<li class="ok"><span class="grip">✓</span><span class="t">${t}</span></li>`).join(""); }
      if (c.type === "match") q("select").forEach(sl => { sl.value = sl.dataset.k; sl.disabled = true; sl.classList.add("ok"); });
      if (c.type === "command") { $("cmd").value = c.answer || [...c.spec.cmd, ...(c.spec.args || []), ...Object.entries(c.spec.flags || {}).map(([f, v]) => v === true ? f : `${f} ${v}`)].join(" "); $("cmd").disabled = true; }
      if ($("chk")) $("chk").classList.add("hidden");
    };
    if (c.type === "write") {
      const ed = KQY.editor($("editor"), KQ.store.get(key + ".w" + idx, c.start || ""), v => KQ.store.set(key + ".w" + idx, v));
      $("chk").onclick = () => {
        const res = gradeWrite(c, ed.value);
        $("rules").innerHTML = writeResults(res);
        const bad = res.filter(x => !x.ok);
        if (!bad.length) { solve(s); $("chk").classList.add("hidden"); }
        else miss(`${res.length - bad.length} of ${res.length} rules pass. Fix the ✗ items and check again.`);
      };
      if (solved.has(idx)) { $("rules").innerHTML = writeResults(gradeWrite(c, ed.value)); feedback(true, `<b>Correct!</b> ${c.explain}`); $("chk").classList.add("hidden"); }
      return;
    }
    if (solved.has(idx)) { feedback(true, `<b>Correct!</b> ${c.explain}`); showSolved(); return; }
    if (c.type === "multi") {
      q(".option").forEach(b => b.onclick = () => { if (solved.has(idx)) return; b.classList.toggle("picked"); b.setAttribute("aria-pressed", b.classList.contains("picked")); q(".option").forEach(x => x.classList.remove("wrong")); });
      $("chk").onclick = () => {
        const opts = q(".option");
        const wrongPick = opts.find(b => b.classList.contains("picked") && !c.options[+b.dataset.k].ok);
        const missed = opts.find(b => !b.classList.contains("picked") && c.options[+b.dataset.k].ok);
        if (!wrongPick && !missed) { opts.forEach(b => b.classList.remove("picked")); showSolved(); solve(s); return; }
        if (wrongPick) { wrongPick.classList.add("wrong"); return miss(c.options[+wrongPick.dataset.k].why || "One of your picks doesn't belong."); }
        miss(`You've missed ${opts.filter(b => !b.classList.contains("picked") && c.options[+b.dataset.k].ok).length > 1 ? "some" : "one"}. Look again.`);
      };
    }
    if (c.type === "order") {
      const list = $("order");
      list.addEventListener("click", e => {
        const b = e.target.closest("button[data-d]"); if (!b || solved.has(idx)) return;
        const li = b.closest("li"), d = +b.dataset.d;
        if (d < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
        if (d > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
        [...list.children].forEach(x => x.classList.remove("bad"));
        b.focus();
      });
      $("chk").onclick = () => {
        const lis = [...list.children], firstBad = lis.findIndex((li, k) => +li.dataset.i !== k);
        if (firstBad < 0) { showSolved(); solve(s); return; }
        lis[firstBad].classList.add("bad");
        miss(`Position ${firstBad + 1} isn't right yet. ${lis.filter((li, k) => +li.dataset.i === k).length} of ${lis.length} are in place.`);
      };
    }
    if (c.type === "match") {
      $("chk").onclick = () => {
        const sels = q("select");
        if (sels.some(sl => sl.value === "")) return miss("Match every item first.");
        let right = 0;
        sels.forEach(sl => { const ok = sl.value === sl.dataset.k; sl.classList.toggle("ok", ok); sl.classList.toggle("bad", !ok); if (ok) right++; });
        if (right === sels.length) { showSolved(); solve(s); } else miss(`${right} of ${sels.length} are right. The red ones need another look.`);
      };
    }
    if (c.type === "command") {
      const run = () => { const err = gradeCommand($("cmd").value, c.spec); if (err) miss(err); else { $("cmd").disabled = true; $("chk").classList.add("hidden"); solve(s); } };
      $("chk").onclick = run;
      $("cmd").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); run(); } });
    }
    if (c.type === "mcq") document.querySelectorAll("#interact .option").forEach(b => b.onclick = () => {
      if (solved.has(idx)) return;
      const o = c.options[+b.dataset.k];
      if (o.ok) { document.querySelectorAll("#interact .option").forEach(x => x.classList.remove("wrong")); b.classList.add("correct"); solve(s); }
      else { b.classList.add("wrong"); miss(o.why || "Not quite. Try again."); }
    });
    if (c.type === "fill") document.querySelectorAll("#interact .chip").forEach(ch => ch.onclick = () => {
      if (solved.has(idx)) return;
      const o = c.chips[+ch.dataset.k], blank = $("blank");
      blank.textContent = o.t; blank.classList.add("filled");
      if (o.ok) { blank.classList.remove("bad"); blank.classList.add("ok"); ch.classList.add("used"); solve(s); }
      else { blank.classList.add("bad"); miss(o.why || "That doesn't fit here."); setTimeout(() => { if (!solved.has(idx)) { blank.textContent = "?"; blank.classList.remove("bad", "filled"); } }, 1100); }
    });
    if (c.type === "tapline") $("code").addEventListener("click", e => {
      const ln = e.target.closest(".ln"); if (!ln || solved.has(idx)) return;
      const n = +ln.dataset.line, want = lineOf(s, c.match);
      if (n === want) { $("code").querySelectorAll(".ln").forEach(x => x.classList.remove("hl-bad")); ln.classList.add("hl-ok"); solve(s); }
      else { markLine(n, "hl-bad"); miss((c.wrong && c.wrong(s.code.split("\n")[n - 1])) || `Line ${n} isn't it. Read the question again.`); }
    });
  }

  function updateNext() {
    const s = L.steps[idx];
    const locked = s.check && !solved.has(idx);
    const nb = $("next");
    nb.disabled = locked;
    nb.textContent = locked ? "Answer to continue" : idx === L.steps.length - 2 ? "Finish" : "Continue";
  }

  function renderSummary(s) {
    KQ.markDone(L.id);
    const checks = L.steps.filter(x => x.check).length;
    const first = L.steps.filter((x, k) => x.check && solved.has(k) && !misses[k]).length;
    $("main").innerHTML = `<div class="stp-anim stp-summary">
      <div class="confetti">🎉</div>
      <div class="stp-kicker" style="margin-top:12px">${esc(L.code)} complete</div>
      <h1 class="stp-title" style="margin-bottom:8px">${s.title}</h1>
      <p class="muted" style="font-size:17px">${s.body}</p>
      <div class="stp-stats">
        <div class="card"><div class="v">${L.steps.length - 1}</div><div class="subtle">steps</div></div>
        <div class="card"><div class="v">${first}/${checks}</div><div class="subtle">checks first try</div></div>
        <div class="card"><div class="v">+${checks * 5 + 20}</div><div class="subtle">XP earned</div></div>
      </div>
      ${s.code ? `<div style="text-align:left"><div id="code"></div></div>` : ""}${s.panel ? `<div style="text-align:left" id="panel">${s.panel}</div>` : ""}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px">
        <a class="btn btn-lg" href="${L.reference}">📖 Full reference view</a>
        <button class="btn btn-lg" id="restart">↺ Replay lesson</button>
        <a class="btn btn-lg btn-primary btn-raised" href="${L.next.href}">Next: ${esc(L.next.title)} →</a>
      </div></div>`;
    if (s.code) KQY.block($("code"), s.code, { title: (s.file || L.file) + " · what you built" });
    $("restart").onclick = () => { solved.clear(); idx = 0; save(); render(); };
    $("next").textContent = "Next lesson →";
    $("next").disabled = false;
    save();
  }

  function go(k) {
    if (k < 0 || k >= L.steps.length) return;
    idx = k; save(); closeDrawer(); render();
  }
  $("back").onclick = () => go(idx - 1);
  $("next").onclick = () => { if (L.steps[idx].summary) location.href = L.next.href; else go(idx + 1); };

  // drawer
  function openDrawer() {
    const s = L.steps[idx];
    $("drawer-body").innerHTML = `<h3 style="margin-top:0">${s.title}</h3>${s.more || "<p class='muted'>Nothing extra for this step.</p>"}
      <hr><a class="btn btn-sm" href="${L.reference}">Open the full reference page →</a>`;
    document.body.classList.add("drawer-open");
  }
  function closeDrawer() { document.body.classList.remove("drawer-open"); }
  $("more-btn").onclick = openDrawer;
  $("drawer-close").onclick = closeDrawer;
  $("scrim").onclick = closeDrawer;

  document.addEventListener("keydown", e => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "Escape") return closeDrawer();
    if (e.key === "ArrowRight" || e.key === "Enter") { if (!$("next").disabled) $("next").click(); }
    else if (e.key === "ArrowLeft") go(idx - 1);
    else if (/^[1-9]$/.test(e.key)) { const b = document.querySelector(`#interact .option[data-k="${+e.key - 1}"]`); if (b) b.click(); }
  });

  render();
})();
