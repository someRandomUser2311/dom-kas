/* KubeQuest prototype — stage/job graph renderer.
   model = { stages: [{ name, displayName, dependsOn: [..], state, note, jobs: [{ name, kind, env, state, steps: [] }] }] }
   state ∈ queued | running | succeeded | failed | skipped | waiting */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICON = { succeeded: "✓", failed: "✕", running: "", skipped: "–", waiting: "⏸", queued: "" };
  const LABEL = { succeeded: "Succeeded", failed: "Failed", running: "Running", skipped: "Skipped", waiting: "Waiting for approval", queued: "Queued" };

  // group stages into columns by dependency depth
  function levels(stages) {
    const byName = Object.fromEntries(stages.map(s => [s.name, s]));
    const memo = {};
    function depth(s, seen = new Set()) {
      if (memo[s.name] != null) return memo[s.name];
      if (seen.has(s.name)) return 0;
      seen.add(s.name);
      const deps = (s.dependsOn || []).filter(d => byName[d]);
      const d = deps.length ? Math.max(...deps.map(n => depth(byName[n], seen))) + 1 : 0;
      return (memo[s.name] = d);
    }
    const cols = [];
    stages.forEach(s => { const d = depth(s); (cols[d] = cols[d] || []).push(s); });
    return cols.filter(Boolean);
  }

  const arrow = '<svg viewBox="0 0 46 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 10h38"/><path d="m34 4 7 6-7 6"/></svg>';

  function render(el, model, opts = {}) {
    if (!model || !model.stages || !model.stages.length) {
      el.innerHTML = `<div class="subtle" style="padding:18px;text-align:center">No stages to draw yet.</div>`;
      return;
    }
    const cols = levels(model.stages);
    el.classList.add("pgraph");
    el.innerHTML = cols.map((col, ci) => `
      ${ci > 0 ? `<div class="pconnector">${arrow}</div>` : ""}
      <div class="pstage" style="justify-content:center">
        ${col.map(s => stageHtml(s, opts)).join("")}
      </div>`).join("");
  }

  function stageHtml(s, opts) {
    const st = s.state || "queued";
    const jobs = (s.jobs || []).map(j => {
      const js = j.state || st;
      const steps = (j.steps || []).slice(0, opts.maxSteps || 6).map(step => `<li><span class="st-icon ${js === "skipped" ? "skipped" : js === "failed" && step.failed ? "failed" : js === "queued" || js === "waiting" ? "queued" : js === "running" && step.running ? "running" : js === "running" ? "queued" : "succeeded"}" style="width:12px;height:12px;font-size:8px">${js === "succeeded" ? "✓" : ""}</span>${esc(step.name || step)}</li>`).join("");
      return `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
        <div style="font-size:12.5px;font-weight:650;display:flex;gap:6px;align-items:center">${j.kind === "deployment" ? "🚀" : "⚙️"} ${esc(j.displayName || j.name)}${j.env ? ` <span class="badge badge-warn" style="height:18px;font-size:11px">env: ${esc(j.env)}</span>` : ""}</div>
        ${steps ? `<ul class="pn-steps">${steps}</ul>` : ""}</div>`;
    }).join("");
    return `<div class="pnode st-${st}" data-stage="${esc(s.name)}">
      <div class="pn-title"><span class="st-icon ${st}">${ICON[st] || ""}</span>${esc(s.displayName || s.name)}</div>
      <div class="pn-sub">${esc(s.note || LABEL[st])}${s.condition ? ` · <span class="mono" title="${esc(s.condition)}">condition</span>` : ""}</div>
      ${jobs}
    </div>`;
  }

  // Build a graph model from a parsed azure-pipelines.yml object (as produced by KQY.parse)
  function fromPipeline(p) {
    if (!p || typeof p !== "object") return { stages: [] };
    const stepName = st => {
      if (!st || typeof st !== "object") return String(st);
      if (st.displayName) return st.displayName;
      if (st.task) return st.task;
      if (st.script != null) return "script";
      if (st.bash != null) return "bash";
      if (st.checkout) return "checkout: " + st.checkout;
      if (st.template) return "template: " + st.template;
      return Object.keys(st)[0];
    };
    const jobModel = j => {
      if (!j || typeof j !== "object") return null;
      const isDep = j.deployment != null;
      let steps = j.steps || [];
      if (isDep && j.strategy && typeof j.strategy === "object") {
        const strat = Object.values(j.strategy)[0];
        const deploy = strat && strat.deploy;
        steps = (deploy && deploy.steps) || [];
      }
      return {
        name: isDep ? j.deployment : (j.job || "job"),
        displayName: j.displayName,
        kind: isDep ? "deployment" : "job",
        env: isDep ? (typeof j.environment === "object" && j.environment ? j.environment.name : j.environment) : null,
        steps: Array.isArray(steps) ? steps.map(stepName) : [],
      };
    };
    if (Array.isArray(p.stages)) {
      let prev = null;
      const stages = p.stages.filter(s => s && typeof s === "object" && s.stage).map(s => {
        let deps;
        if (s.dependsOn === undefined) deps = prev ? [prev] : [];
        else deps = Array.isArray(s.dependsOn) ? s.dependsOn : (s.dependsOn ? [s.dependsOn] : []);
        prev = s.stage;
        return { name: s.stage, displayName: s.displayName, dependsOn: deps, condition: s.condition, state: "queued",
                 jobs: (Array.isArray(s.jobs) ? s.jobs : []).map(jobModel).filter(Boolean) };
      });
      return { stages };
    }
    if (Array.isArray(p.jobs)) return { stages: [{ name: "__default", displayName: "(implicit stage)", state: "queued", jobs: p.jobs.map(jobModel).filter(Boolean) }] };
    if (Array.isArray(p.steps)) return { stages: [{ name: "__default", displayName: "(implicit stage)", state: "queued", jobs: [{ name: "job", displayName: "(implicit job)", steps: p.steps.map(stepName) }] }] };
    return { stages: [] };
  }

  window.KQG = { render, fromPipeline, levels };
})();
