// Thin client for the Rust API. The learner id is a random UUID the server
// issues on first visit; it is kept in localStorage and sent as X-Learner.

const KEY = 'kq.learner';
let learnerId = null;
const cache = new Map();

function readId() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function writeId(id) {
  try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
}

async function req(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (learnerId) headers['x-learner'] = learnerId;
  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function cached(path) {
  if (!cache.has(path)) cache.set(path, req('GET', path).catch((e) => { cache.delete(path); throw e; }));
  return cache.get(path);
}

export const api = {
  get learner() { return learnerId; },
  async ensureLearner() {
    learnerId = readId();
    if (learnerId) {
      try { await req('GET', '/progress'); return learnerId; } catch (e) { if (e.status !== 401) return learnerId; }
    }
    const { id } = await req('POST', '/learners', {});
    learnerId = id;
    writeId(id);
    return id;
  },
  forget() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } learnerId = null; },
  course: () => cached('/course'),
  lesson: (ch, id) => cached(`/lessons/${ch}/${id}`),
  page: (ch, name) => cached(`/pages/${ch}/${name}`),
  examPage: () => cached('/pages/exam'),
  examDraw: () => req('GET', '/exam/draw'),
  grade: (id, answer) => req('POST', '/checks/grade', { id, answer }),
  gradeLab: (id, files) => req('POST', '/labs/grade', { id, files }),
  labSolution: (id) => req('POST', '/labs/solution', { id }),
  getProgress: () => req('GET', '/progress'),
  putProgress: (data) => req('PUT', '/progress', data),
  resetProgress: () => req('DELETE', '/progress'),
  attempt: (kind, ref, score, passed) => req('POST', '/attempts', { kind, ref, score, passed }),
  attempts: () => req('GET', '/attempts'),
  health: () => req('GET', '/health'),
};
