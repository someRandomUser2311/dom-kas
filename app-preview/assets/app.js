/* KubeQuest prototype — shared shell, curriculum, progress, theme, toasts */
(function () {
  "use strict";

  // ---------- curriculum (single source of truth for nav) ----------
  const CHAPTER = {
    num: 7,
    title: "Azure Pipelines: CI/CD to AKS",
    sections: [
      { title: "Foundations", items: [
        { id: "l1", href: "lesson.html?l=ch07/l1", title: "CI/CD and where Azure Pipelines fits", kind: "Guided · 11 steps", ico: "📘", min: 10 },
        { id: "l2", href: "lesson.html?l=ch07/l2", title: "Anatomy of azure-pipelines.yml", kind: "Guided · 13 steps", ico: "🧩", min: 15 },
      ]},
      { title: "Where pipelines run & what they can touch", items: [
        { id: "l3", href: "lesson.html?l=ch07/l3", title: "Agents and agent pools", kind: "Guided · 10 steps", ico: "🖥️", min: 12 },
        { id: "l4", href: "lesson.html?l=ch07/l4", title: "Service connections, service principals & ACR", kind: "Guided · 11 steps", ico: "🔐", min: 16 },
      ]},
      { title: "Real-world pipelines", items: [
        { id: "l5", href: "lesson.html?l=ch07/l5", title: "Stages, conditions, environments & approvals", kind: "Guided · 11 steps", ico: "🚦", min: 16 },
        { id: "l6", href: "lesson.html?l=ch07/l6", title: "Variables, secrets & templates", kind: "Guided · 10 steps", ico: "🧬", min: 14 },
      ]},
      { title: "Practice & evaluation", items: [
        { id: "quiz", href: "quiz.html", title: "Checkpoint quiz", kind: "Quiz · 8 questions", ico: "❓", min: 10 },
        { id: "predict", href: "predict.html", title: "Predict the pipeline run", kind: "Read & reason", ico: "🔮", min: 8 },
        { id: "lab-yaml", href: "lab-yaml.html", title: "Write a multi-stage pipeline", kind: "YAML lab · auto-graded", ico: "✍️", min: 25 },
        { id: "lab-term", href: "lab-terminal.html", title: "Ship it by hand: ACR → AKS", kind: "Terminal lab · floci-az", ico: "⌨️", min: 20 },
      ]},
    ],
  };
  const ORDER = CHAPTER.sections.flatMap(s => s.items);

  // ---------- storage (always guarded) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("kq." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("kq." + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const doneSet = () => new Set(store.get("done", []));
  function isDone(id) { return doneSet().has(id); }
  function markDone(id) {
    const s = doneSet();
    if (!s.has(id)) { s.add(id); store.set("done", [...s]); addXP(id.startsWith("l") ? 20 : 40, false); }
  }
  function xp() { return store.get("xp", 1240); }
  function addXP(n, notify = true) {
    store.set("xp", xp() + n);
    const el = document.getElementById("xp-val");
    if (el) el.textContent = xp().toLocaleString();
    if (notify) toast(`+${n} XP`, "⚡");
  }
  function chapterProgress() {
    const s = doneSet();
    return Math.round((ORDER.filter(i => s.has(i.id)).length / ORDER.length) * 100);
  }

  // ---------- theme ----------
  const root = document.documentElement;
  const savedTheme = store.get("theme", null);
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  function currentTheme() {
    const t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store.set("theme", next);
    paintThemeIcon();
  }
  function paintThemeIcon() {
    const b = document.getElementById("theme-btn");
    if (b) b.innerHTML = currentTheme() === "dark" ? ICONS.sun : ICONS.moon;
  }

  // ---------- icons ----------
  const ICONS = {
    logo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3.5 6.5v11L12 22l8.5-4.5v-11z"/><circle cx="12" cy="12" r="3"/><path d="M12 5v4M12 15v4M6 8.5l3.4 2M14.6 13.5 18 15.5M6 15.5l3.4-2M14.6 10.5 18 8.5"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    moon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    sun: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    menu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };

  // ---------- top bar ----------
  function renderTopbar() {
    const host = document.getElementById("topbar");
    if (!host) return;
    const page = document.body.dataset.page || "";
    const hasCur = !!document.getElementById("curriculum");
    host.className = "topbar";
    host.innerHTML = `
      ${hasCur ? `<button class="icon-btn menu-btn" id="menu-btn" aria-label="Open curriculum">${ICONS.menu}</button>` : ""}
      <a class="brand" href="index.html"><span class="brand-mark">${ICONS.logo}</span><span class="brand-name">KubeQuest</span></a>
      <nav class="topnav">
        <a href="index.html" class="${page === "home" ? "active" : ""}">Home</a>
        <a href="chapter.html" class="${page !== "home" ? "active" : ""}">Course</a>
        <a href="lab-terminal.html">Labs</a>
      </nav>
      <div class="search">${ICONS.search}<span>Search lessons, YAML keywords…</span><kbd>⌘K</kbd></div>
      <div class="top-stats">
        <span class="stat-pill hide-sm" title="Day streak"><span class="ico">🔥</span>12</span>
        <span class="stat-pill" title="Experience points"><span class="ico">⚡</span><span id="xp-val">${xp().toLocaleString()}</span></span>
        <button class="icon-btn" id="theme-btn" aria-label="Toggle theme"></button>
        <span class="avatar" title="Your profile">RS</span>
      </div>`;
    paintThemeIcon();
    document.getElementById("theme-btn").addEventListener("click", toggleTheme);
    const mb = document.getElementById("menu-btn");
    if (mb) mb.addEventListener("click", () => document.body.classList.toggle("cur-open"));
  }

  // ---------- curriculum sidebar ----------
  function renderCurriculum() {
    const host = document.getElementById("curriculum");
    if (!host) return;
    const page = document.body.dataset.page;
    const done = doneSet();
    const pct = chapterProgress();
    let html = `
      <div class="cur-head">
        <div class="cur-kicker">Chapter ${CHAPTER.num}</div>
        <div class="cur-title">${CHAPTER.title}</div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <div class="subtle" style="margin-top:6px">${pct}% complete · ${ORDER.filter(i => done.has(i.id)).length}/${ORDER.length} items</div>
      </div>
      <a class="cur-item" href="chapter.html"><span class="status-dot" style="border:0">↩</span><span>Chapter overview</span></a>`;
    CHAPTER.sections.forEach((s, si) => {
      html += `<div class="cur-section"><div class="cur-section-title">${String(si + 1).padStart(2, "0")} · ${s.title}</div>`;
      s.items.forEach(it => {
        const st = it.id === page ? "current" : done.has(it.id) ? "done" : "";
        html += `<a class="cur-item ${it.id === page ? "active" : ""}" href="${it.href}">
          <span class="status-dot ${st}">${st === "done" ? "✓" : ""}</span>
          <span>${it.title}<span class="cur-meta">${it.kind} · ${it.min} min</span></span></a>`;
      });
      html += `</div>`;
    });
    host.innerHTML = html;
  }

  // ---------- prev / next ----------
  function renderLessonNav() {
    const host = document.getElementById("lesson-nav");
    if (!host) return;
    const page = document.body.dataset.page;
    const i = ORDER.findIndex(x => x.id === page);
    const prev = i > 0 ? ORDER[i - 1] : null;
    const next = i < ORDER.length - 1 ? ORDER[i + 1] : { href: "chapter-complete.html", title: "Chapter results" };
    host.className = "lesson-nav";
    host.innerHTML = `
      ${prev ? `<a class="btn btn-lg" href="${prev.href}">← ${prev.title}</a>` : `<a class="btn btn-lg" href="chapter.html">← Chapter overview</a>`}
      <a class="btn btn-lg btn-primary" id="next-btn" href="${next.href}">Complete & continue →</a>`;
    document.getElementById("next-btn").addEventListener("click", () => markDone(page));
  }

  // ---------- toast ----------
  function toast(msg, ico = "✓") {
    let w = document.querySelector(".toast-wrap");
    if (!w) { w = document.createElement("div"); w.className = "toast-wrap"; document.body.appendChild(w); }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span>${ico}</span><span>${msg}</span>`;
    w.appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; }, 1800);
    setTimeout(() => t.remove(), 2200);
  }

  // ---------- reusable: inline "check your knowledge" cards ----------
  // <div class="check-card" data-answer="b"> ... <button class="option" data-v="a">…</button> ... <div class="check-result" data-ok="…" data-bad="…"></div></div>
  function wireChecks() {
    document.querySelectorAll(".check-card").forEach(card => {
      const ans = card.dataset.answer;
      const res = card.querySelector(".check-result");
      card.querySelectorAll(".option").forEach(op => {
        op.addEventListener("click", () => {
          if (card.dataset.locked) return;
          card.dataset.locked = "1";
          const ok = op.dataset.v === ans;
          card.querySelectorAll(".option").forEach(o => {
            if (o.dataset.v === ans) o.classList.add("correct");
          });
          if (!ok) op.classList.add("wrong");
          if (res) {
            res.innerHTML = ok ? `<strong style="color:var(--success-strong)">Correct.</strong> ${res.dataset.ok || ""}`
                               : `<strong style="color:var(--danger)">Not quite.</strong> ${res.dataset.bad || res.dataset.ok || ""}`;
            res.classList.add("show");
          }
          if (ok) addXP(5);
        });
      });
    });
  }

  // ---------- reusable: tabs ----------
  // <div class="tabs" data-tabs="group"><button class="tab" data-tab="a">…</button></div> + <div data-panel="group:a">
  function wireTabs() {
    document.querySelectorAll("[data-tabs]").forEach(bar => {
      const g = bar.dataset.tabs;
      bar.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
        bar.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
        document.querySelectorAll(`[data-panel^="${g}:"]`).forEach(p => p.classList.toggle("hidden", p.dataset.panel !== `${g}:${t.dataset.tab}`));
      }));
    });
  }

  function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    renderTopbar();
    renderCurriculum();
    renderLessonNav();
    wireChecks();
    wireTabs();
    document.addEventListener("click", e => {
      if (document.body.classList.contains("cur-open") && !e.target.closest(".curriculum") && !e.target.closest("#menu-btn")) {
        document.body.classList.remove("cur-open");
      }
    });
  });

  window.KQ = { CHAPTER, ORDER, store, isDone, markDone, addXP, xp, toast, chapterProgress, escapeHtml };
})();
