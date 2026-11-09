// Learner progress: one reactive object, synced to the Rust API (SQLite)
// with a localStorage mirror so the page still works if the API is down.

import { api } from './api.js';
import { today } from './util.js';

const LOCAL = 'kq.progress';

function blank() {
  return {
    version: 1,
    name: '',
    persona: { A: 'Developer (Docker Compose)', B: 'GitHub Actions', C: 'az CLI scripts' },
    settings: { theme: 'system', unlockAll: false },
    lessons: {},
    checks: {},
    quizzes: {},
    predict: {},
    labs: {},
    exam: null,
    placement: null,
    review: [],
    reflection: '',
    last: null,
    activity: {},
  };
}

export const progress = $state(blank());
export const sync = $state({ status: 'loading', error: '' });

let timer = null;

function mirror() {
  try { localStorage.setItem(LOCAL, JSON.stringify($state.snapshot(progress))); } catch { /* ignore */ }
}

export function save() {
  mirror();
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await api.putProgress($state.snapshot(progress));
      sync.status = 'saved';
      sync.error = '';
    } catch (e) {
      sync.status = 'offline';
      sync.error = e.message;
    }
  }, 600);
}

function assign(data) {
  const b = blank();
  for (const k of Object.keys(b)) progress[k] = data && data[k] !== undefined ? data[k] : b[k];
  progress.persona = { ...b.persona, ...(data?.persona || {}) };
  progress.settings = { ...b.settings, ...(data?.settings || {}) };
}

export async function loadProgress() {
  try {
    await api.ensureLearner();
    const data = await api.getProgress();
    if (data && Object.keys(data).length) {
      assign(data);
    } else {
      // first visit on this server: adopt any local copy
      let local = null;
      try { local = JSON.parse(localStorage.getItem(LOCAL) || 'null'); } catch { /* ignore */ }
      assign(local);
      save();
    }
    sync.status = 'saved';
  } catch (e) {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(LOCAL) || 'null'); } catch { /* ignore */ }
    assign(local);
    sync.status = 'offline';
    sync.error = e.message;
  }
  applyTheme();
}

export function applyTheme() {
  const t = progress.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function bump() {
  const d = today();
  progress.activity[d] = (progress.activity[d] || 0) + 1;
}

export function setLast(route, title) {
  progress.last = { route, title, at: Date.now() };
  save();
}

export function markStep(lessonId, stepIndex, total) {
  const l = (progress.lessons[lessonId] ||= { step: 0, max: 0, done: false });
  l.step = stepIndex;
  l.max = Math.max(l.max || 0, stepIndex);
  l.total = total;
  save();
}

export function completeLesson(lessonId) {
  const l = (progress.lessons[lessonId] ||= { step: 0, max: 0, done: false });
  if (!l.done) {
    l.done = true;
    l.doneAt = Date.now();
    bump();
  }
  save();
}

/** Records a check result. The first attempt decides the score. */
export function recordCheck(id, correct) {
  const c = progress.checks[id];
  if (!c) {
    progress.checks[id] = { first: correct, solved: correct, tries: 1 };
    bump();
  } else {
    c.tries += 1;
    c.solved = c.solved || correct;
  }
  if (!correct && !progress.review.includes(id)) progress.review.push(id);
  if (correct && c && progress.review.includes(id)) progress.review = progress.review.filter((x) => x !== id);
  save();
}

export function recordQuiz(ch, pct, passed) {
  const q = (progress.quizzes[ch] ||= { best: 0, attempts: 0 });
  q.best = Math.max(q.best, pct);
  q.last = pct;
  q.attempts += 1;
  q.passed = q.passed || passed;
  bump();
  save();
  api.attempt('quiz', ch, pct, passed).catch(() => {});
}

export function recordPredict(ch, pct) {
  const p = (progress.predict[ch] ||= { best: 0, attempts: 0 });
  p.best = Math.max(p.best, pct);
  p.attempts += 1;
  bump();
  save();
  api.attempt('predict', ch, pct, pct >= 70).catch(() => {});
}

export function labState(id) {
  return (progress.labs[id] ||= { best: 0, passed: false, criticalFailed: false, solutionViewed: false, files: {} });
}

export function recordLab(id, result) {
  const l = labState(id);
  const capped = l.solutionViewed ? Math.min(result.score, 60) : result.score;
  if (capped >= (l.best || 0)) {
    l.best = capped;
    l.criticalFailed = result.criticalFailed;
  }
  l.passed = l.passed || (result.passed && !l.solutionViewed);
  l.lastScore = result.score;
  bump();
  save();
}

export function recordExam(pct, passed) {
  const e = (progress.exam ||= { best: 0, attempts: 0 });
  e.best = Math.max(e.best, pct);
  e.last = pct;
  e.attempts += 1;
  e.passed = e.passed || passed;
  save();
  api.attempt('exam', 'final', pct, passed).catch(() => {});
}

export async function resetAll() {
  await api.resetProgress().catch(() => {});
  const keep = { persona: progress.persona, settings: progress.settings, name: progress.name };
  assign({ ...blank(), ...keep });
  save();
}

// ---------- derived status ----------

export function lessonDone(id) {
  return !!progress.lessons[id]?.done;
}

/** Placement: Kubernetes section 3/3 lets learners test out of Chapters 1–3. */
export function testOutOffered() {
  return progress.placement?.sections?.k8s === 'pass';
}

export function chapterStats(ch) {
  const total = ch.lessons.length;
  const done = ch.lessons.filter((l) => lessonDone(l.id)).length;
  const quiz = progress.quizzes[ch.key];
  const testOut = ch.num >= 1 && ch.num <= 3 && testOutOffered() && quiz?.passed;
  const completed = (total > 0 && done === total) || !!testOut || (ch.num === 17 && !!progress.labs['ch17/project']?.passed);

  // components: labs 40, quiz 30, predict 15, checks 15 (re-normalised when absent)
  const parts = [];
  if (ch.labs.length) {
    const s = ch.labs.reduce((a, id) => a + (progress.labs[id]?.best || 0), 0) / ch.labs.length;
    parts.push([40, s]);
  }
  if (ch.quiz) parts.push([30, quiz?.best || 0]);
  if (ch.predictCount) parts.push([15, progress.predict[ch.key]?.best || 0]);
  const checkTotal = ch.lessons.reduce((a, l) => a + l.checks, 0);
  let firstRight = 0;
  for (const [id, c] of Object.entries(progress.checks)) {
    if (c.first && id.startsWith(ch.key + '/') && !id.includes('/practice/')) firstRight++;
  }
  const checksPct = checkTotal ? Math.min(100, (firstRight / checkTotal) * 100) : 0;
  if (checkTotal) parts.push([15, checksPct]);
  const w = parts.reduce((a, p) => a + p[0], 0);
  const score = w ? Math.round(parts.reduce((a, p) => a + p[0] * p[1], 0) / w) : 0;

  const labsOk = ch.labs.every((id) => progress.labs[id] && !progress.labs[id].criticalFailed && progress.labs[id].best > 0);
  const quizOk = !ch.quiz || (quiz?.best || 0) >= 80;
  const passed = completed && score >= 70 && quizOk && labsOk;
  const mastered = passed && score >= 90 && ch.labs.every((id) => progress.labs[id]?.passed && !progress.labs[id]?.solutionViewed);
  return { total, done, completed, score, passed, mastered, quizBest: quiz?.best ?? null, checksPct: Math.round(checksPct), testOut: !!testOut };
}

export function chapterUnlocked(course, ch) {
  if (progress.settings.unlockAll || ch.num <= 1) return true;
  const prev = course.chapters.find((c) => c.num === ch.num - 1);
  if (!prev) return true;
  if (ch.num >= 2 && ch.num <= 4 && testOutOffered()) return true;
  return chapterStats(prev).completed;
}

export function examUnlocked(course) {
  if (progress.settings.unlockAll) return true;
  return course.chapters.filter((c) => c.num >= 1 && c.num <= 16).every((c) => chapterStats(c).completed);
}

export function streak() {
  let n = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (progress.activity[key]) n++;
    else if (n > 0 || key !== today()) break;
    d.setDate(d.getDate() - 1);
    if (n > 3650) break;
  }
  return n;
}
