mod content;
mod grade;
mod store;

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use content::{Block, Content, LabRuleText, PublicCheck};
use grade::lab::{LabResult, LabSpec};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use store::Store;

struct AppState {
    content: Content,
    specs: HashMap<String, LabSpec>,
    store: Store,
}

type S = State<Arc<AppState>>;

struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    }
}

fn not_found(what: &str) -> ApiError {
    ApiError(StatusCode::NOT_FOUND, format!("{what} not found"))
}

type R<T> = Result<Json<T>, ApiError>;

// ---------- content ----------

async fn course(State(s): S) -> R<Value> {
    Ok(Json(serde_json::to_value(&s.content.course).unwrap()))
}

async fn lesson(State(s): S, Path((ch, id)): Path<(String, String)>) -> R<Value> {
    let l = s.content.lessons.get(&format!("{ch}/{id}")).ok_or_else(|| not_found("lesson"))?;
    Ok(Json(serde_json::to_value(l).unwrap()))
}

async fn page(State(s): S, Path((ch, name)): Path<(String, String)>) -> R<Value> {
    let p = s.content.pages.get(&format!("{ch}/{name}")).ok_or_else(|| not_found("page"))?;
    Ok(Json(serde_json::to_value(p).unwrap()))
}

async fn exam_page(State(s): S) -> R<Value> {
    let p = s.content.pages.get("exam").ok_or_else(|| not_found("exam"))?;
    Ok(Json(serde_json::to_value(p).unwrap()))
}

// ---------- grading ----------

#[derive(Deserialize)]
struct CheckReq {
    id: String,
    #[serde(default)]
    answer: grade::Answer,
}

async fn grade_check(State(s): S, Json(req): Json<CheckReq>) -> R<grade::CheckResult> {
    let c = s.content.checks.get(&req.id).ok_or_else(|| not_found("check"))?;
    Ok(Json(grade::grade_check(c, &req.answer)))
}

#[derive(Deserialize)]
struct LabReq {
    id: String,
    files: HashMap<String, String>,
}

async fn grade_lab(State(s): S, headers: HeaderMap, Json(req): Json<LabReq>) -> R<LabResult> {
    let lab = s.content.labs.get(&req.id).ok_or_else(|| not_found("lab"))?;
    let spec = s
        .specs
        .get(&req.id)
        .ok_or_else(|| ApiError(StatusCode::NOT_IMPLEMENTED, format!("no grader rules for {}", req.id)))?;
    let mut files: Vec<(String, String)> = req.files.into_iter().collect();
    files.sort();
    let res = grade::lab::grade(spec, &lab.public.rules, &files);
    if let Some(l) = learner(&headers, &s) {
        s.store.record_attempt(&l, "lab", &req.id, res.score, res.passed).ok();
    }
    Ok(Json(res))
}

#[derive(Deserialize)]
struct IdReq {
    id: String,
}

async fn lab_solution(State(s): S, Json(req): Json<IdReq>) -> R<Value> {
    let lab = s.content.labs.get(&req.id).ok_or_else(|| not_found("lab"))?;
    let spec_sol = s.specs.get(&req.id).and_then(|sp| sp.solution.clone());
    Ok(Json(json!({
        "solution": spec_sol.unwrap_or_else(|| lab.solution.clone()),
        "solutionHtml": lab.solution_html,
    })))
}

/// Simple xorshift RNG seeded from the clock (no extra crates).
struct Rng(u64);
impl Rng {
    fn new() -> Self {
        let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos() as u64;
        Rng(t | 1)
    }
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn shuffle<T>(&mut self, v: &mut [T]) {
        for i in (1..v.len()).rev() {
            let j = (self.next() % (i as u64 + 1)) as usize;
            v.swap(i, j);
        }
    }
}

/// The final exam blueprint: chapter groups and how many questions each draws.
async fn exam_draw(State(s): S) -> R<Vec<PublicCheck>> {
    let groups: &[(&[u32], usize)] = &[
        (&[1, 2, 3], 6),
        (&[4, 5, 6], 7),
        (&[7, 10, 11], 7),
        (&[8, 9], 4),
        (&[12, 13], 4),
        (&[14, 15, 16], 4),
    ];
    let mut rng = Rng::new();
    let mut out = vec![];
    for (chs, n) in groups {
        let mut pool: Vec<&String> = chs
            .iter()
            .filter_map(|c| s.content.quiz_pools.get(&format!("ch{c:02}")))
            .flatten()
            .collect();
        rng.shuffle(&mut pool);
        for id in pool.into_iter().take(*n) {
            if let Some(c) = s.content.checks.get(id) {
                out.push(c.public.clone());
            }
        }
    }
    if let Some(p) = s.content.pages.get("exam") {
        let mut integ: Vec<&PublicCheck> = p
            .sections
            .iter()
            .filter(|sec| sec.id == "integration")
            .flat_map(|sec| sec.blocks.iter())
            .filter_map(|b| match b {
                Block::Check { check } => Some(check),
                _ => None,
            })
            .collect();
        rng.shuffle(&mut integ);
        out.extend(integ.into_iter().take(8).cloned());
    }
    rng.shuffle(&mut out);
    Ok(Json(out))
}

// ---------- learners & progress ----------

fn learner(headers: &HeaderMap, s: &AppState) -> Option<String> {
    let id = headers.get("x-learner")?.to_str().ok()?.to_string();
    if s.store.learner_exists(&id).ok()? {
        Some(id)
    } else {
        None
    }
}

#[derive(Deserialize, Default)]
struct NewLearner {
    #[serde(default)]
    name: String,
}

async fn create_learner(State(s): S, body: Option<Json<NewLearner>>) -> R<Value> {
    let name = body.map(|b| b.0.name).unwrap_or_default();
    let id = s.store.create_learner(name.trim())?;
    Ok(Json(json!({ "id": id })))
}

async fn get_progress(State(s): S, headers: HeaderMap) -> R<Value> {
    let id = learner(&headers, &s).ok_or(ApiError(StatusCode::UNAUTHORIZED, "unknown learner".into()))?;
    let data = s.store.get_progress(&id)?;
    let v: Value = data.and_then(|d| serde_json::from_str(&d).ok()).unwrap_or(json!({}));
    Ok(Json(v))
}

async fn put_progress(State(s): S, headers: HeaderMap, Json(v): Json<Value>) -> R<Value> {
    let id = learner(&headers, &s).ok_or(ApiError(StatusCode::UNAUTHORIZED, "unknown learner".into()))?;
    let text = v.to_string();
    if text.len() > 2_000_000 {
        return Err(ApiError(StatusCode::PAYLOAD_TOO_LARGE, "progress too large".into()));
    }
    s.store.put_progress(&id, &text)?;
    Ok(Json(json!({ "ok": true })))
}

async fn reset_progress(State(s): S, headers: HeaderMap) -> R<Value> {
    let id = learner(&headers, &s).ok_or(ApiError(StatusCode::UNAUTHORIZED, "unknown learner".into()))?;
    s.store.reset(&id)?;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
struct AttemptReq {
    kind: String,
    #[serde(rename = "ref")]
    r: String,
    score: u32,
    passed: bool,
}

async fn post_attempt(State(s): S, headers: HeaderMap, Json(a): Json<AttemptReq>) -> R<Value> {
    let id = learner(&headers, &s).ok_or(ApiError(StatusCode::UNAUTHORIZED, "unknown learner".into()))?;
    s.store.record_attempt(&id, &a.kind, &a.r, a.score.min(100), a.passed)?;
    Ok(Json(json!({ "ok": true })))
}

async fn get_attempts(State(s): S, headers: HeaderMap) -> R<Value> {
    let id = learner(&headers, &s).ok_or(ApiError(StatusCode::UNAUTHORIZED, "unknown learner".into()))?;
    let rows: Vec<Value> = s
        .store
        .attempts(&id)?
        .into_iter()
        .map(|(k, r, sc, p, c)| json!({"kind": k, "ref": r, "score": sc, "passed": p, "at": c}))
        .collect();
    Ok(Json(json!(rows)))
}

async fn eval_widget(Json(req): Json<grade::EvalReq>) -> Json<Value> {
    Json(grade::eval(&req))
}

async fn health(State(s): S) -> Json<Value> {
    Json(json!({
        "ok": true,
        "lessons": s.content.lessons.len(),
        "checks": s.content.checks.len(),
        "labs": s.content.labs.len(),
        "gradedLabs": s.specs.len(),
    }))
}

// ---------- startup ----------

fn load_specs(dir: &std::path::Path, content: &mut Content) -> anyhow::Result<HashMap<String, LabSpec>> {
    let mut specs = HashMap::new();
    if !dir.exists() {
        return Ok(specs);
    }
    let mut entries: Vec<_> = std::fs::read_dir(dir)?.flatten().collect();
    entries.sort_by_key(|e| e.path());
    for e in entries {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()) != Some("yaml") {
            continue;
        }
        let text = std::fs::read_to_string(&p)?;
        for d in serde_yaml::Deserializer::from_str(&text) {
        let spec: LabSpec = serde::Deserialize::deserialize(d).map_err(|e| anyhow::anyhow!("{}: {e}", p.display()))?;
        // A document with only `lab` + `solution` adds a reference solution to a spec.
        if spec.rules.is_empty() {
            if let (Some(existing), Some(sol)) = (specs.get_mut(&spec.lab), spec.solution.clone()) {
                let existing: &mut LabSpec = existing;
                existing.solution = Some(sol);
            } else {
                eprintln!("warning: {} has a solution-only entry for unknown lab {}", p.display(), spec.lab);
            }
            continue;
        }
        match content.labs.get_mut(&spec.lab) {
            None => eprintln!("warning: {} names unknown lab {}", p.display(), spec.lab),
            Some(lab) => {
                if let Some(st) = &spec.start {
                    lab.public.start = st.clone();
                }
                if !spec.files.is_empty() {
                    lab.public.files = spec.files.clone();
                }
                if lab.public.rules.is_empty() {
                    lab.public.rules = spec
                        .rules
                        .iter()
                        .map(|r| LabRuleText {
                            html: r.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            critical: r.get("critical").and_then(|v| v.as_bool()).unwrap_or(false),
                        })
                        .collect();
                } else if lab.public.rules.len() != spec.rules.len() {
                    eprintln!(
                        "warning: {} has {} rules but the lab lists {}",
                        spec.lab,
                        spec.rules.len(),
                        lab.public.rules.len()
                    );
                }
                // keep the copies embedded in pages in sync
                let updated = lab.public.clone();
                for page in content.pages.values_mut() {
                    for sec in page.sections.iter_mut() {
                        for b in sec.blocks.iter_mut() {
                            if let Block::Lab { lab } = b {
                                if lab.id == updated.id {
                                    *lab = updated.clone();
                                }
                            }
                        }
                    }
                    for b in page.intro.iter_mut() {
                        if let Block::Lab { lab } = b {
                            if lab.id == updated.id {
                                *lab = updated.clone();
                            }
                        }
                    }
                }
                specs.insert(spec.lab.clone(), spec);
            }
        }
        }
    }
    for id in content.labs.keys() {
        if !specs.contains_key(id) {
            eprintln!("warning: lab {id} has no grader rules");
        }
    }
    Ok(specs)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let content_dir = PathBuf::from(std::env::var("CONTENT_DIR").unwrap_or_else(|_| "../course-content".into()));
    let labs_dir = PathBuf::from(std::env::var("LABS_DIR").unwrap_or_else(|_| "labs".into()));
    let db = PathBuf::from(std::env::var("DB_PATH").unwrap_or_else(|_| "data/kq.db".into()));
    let addr = std::env::var("BIND").unwrap_or_else(|_| "0.0.0.0:8080".into());

    let mut content = content::load(&content_dir)?;
    let specs = load_specs(&labs_dir, &mut content)?;
    println!(
        "loaded {} chapters, {} lessons, {} checks, {} labs ({} graded)",
        content.course.chapters.len(),
        content.lessons.len(),
        content.checks.len(),
        content.labs.len(),
        specs.len()
    );
    let store = Store::open(&db)?;
    let state = Arc::new(AppState { content, specs, store });

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/course", get(course))
        .route("/api/lessons/{ch}/{id}", get(lesson))
        .route("/api/pages/exam", get(exam_page))
        .route("/api/pages/{ch}/{name}", get(page))
        .route("/api/checks/grade", post(grade_check))
        .route("/api/labs/grade", post(grade_lab))
        .route("/api/labs/solution", post(lab_solution))
        .route("/api/exam/draw", get(exam_draw))
        .route("/api/eval", post(eval_widget))
        .route("/api/learners", post(create_learner))
        .route("/api/progress", get(get_progress).put(put_progress).delete(reset_progress))
        .route("/api/attempts", get(get_attempts).post(post_attempt))
        .layer(tower_http::cors::CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("listening on {addr}");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
        })
        .await?;
    Ok(())
}
