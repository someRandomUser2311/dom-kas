//! Parses the simple-HTML course source (`course-content/`) into structured
//! data. Answers stay on the server: the public views never include which
//! option is correct, the solution or the explanation.

use anyhow::{Context, Result};
use regex::Regex;
use scraper::{ElementRef, Html, Node, Selector};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

// ---------- public data ----------

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Block {
    Html { html: String },
    Code { file: Option<String>, text: String, output: bool, diff: bool },
    Widget { name: String, html: String },
    Coming { set: String, items: Vec<ComingItem> },
    More { html: String },
    Check { check: PublicCheck },
    Lab { lab: PublicLab },
    Try { lesson: Option<String>, html: String },
}

#[derive(Serialize, Clone, Debug)]
pub struct ComingItem {
    pub persona: String,
    pub html: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PublicCheck {
    pub id: String,
    pub kind: String,
    pub prompt: String,
    /// mcq / multi / predict / diagnose / order / fill chips: html of each option, in display order.
    pub options: Vec<PublicOption>,
    /// match: left column (in order) and right column (shuffled).
    pub left: Vec<String>,
    pub right: Vec<PublicOption>,
    /// tapline: the lines of the file to tap, and its name.
    pub lines: Vec<String>,
    pub file: Option<String>,
    pub multiple: bool,
    pub section: Option<String>,
    pub sets: Option<String>,
    pub has_solution: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct PublicOption {
    /// Index into the original (author) order; what the client sends back.
    pub key: usize,
    pub html: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PublicLab {
    pub id: String,
    pub title: String,
    pub brief: String,
    pub rules: Vec<LabRuleText>,
    pub start: String,
    /// Multi-file labs (the capstone): file names with starter text.
    pub files: Vec<LabFile>,
}

#[derive(Serialize, Clone, Debug)]
pub struct LabRuleText {
    pub html: String,
    pub critical: bool,
}

#[derive(Serialize, Clone, Debug, serde::Deserialize)]
pub struct LabFile {
    pub name: String,
    #[serde(default)]
    pub start: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    pub id: String,
    pub title: String,
    pub summary: bool,
    pub blocks: Vec<Block>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Lesson {
    pub id: String,
    pub chapter: u32,
    pub num: String,
    pub title: String,
    pub kicker: String,
    pub meta: String,
    pub steps: Vec<Step>,
    pub check_count: usize,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub id: String,
    pub title: String,
    pub blocks: Vec<Block>,
}

/// A non-lesson page: practice, project, final exam.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DocPage {
    pub id: String,
    pub title: String,
    pub kicker: String,
    pub intro: Vec<Block>,
    pub sections: Vec<Section>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LessonRef {
    pub id: String,
    pub num: String,
    pub title: String,
    pub minutes: u32,
    pub checks: usize,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    pub num: u32,
    pub key: String,
    pub title: String,
    pub part: String,
    pub kicker: String,
    pub intro: String,
    pub outcomes: String,
    pub practice: String,
    pub note: String,
    pub optional: bool,
    pub lessons: Vec<LessonRef>,
    pub pages: Vec<String>,
    pub quiz: Option<QuizInfo>,
    pub labs: Vec<String>,
    pub predict_count: usize,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct QuizInfo {
    pub draw: usize,
    pub pool: usize,
}

#[derive(Serialize, Clone, Debug)]
pub struct Part {
    pub title: String,
    pub chapters: Vec<u32>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CourseSummary {
    pub title: String,
    pub parts: Vec<Part>,
    pub chapters: Vec<Chapter>,
}

// ---------- private (answer-bearing) data ----------

#[derive(Clone, Debug)]
pub struct OptionDef {
    pub html: String,
    pub correct: bool,
    pub why: Option<String>,
}

#[derive(Clone, Debug)]
pub struct CheckDef {
    pub id: String,
    pub kind: String,
    pub options: Vec<OptionDef>,
    pub pairs: Vec<(String, String)>,
    pub tap_match: Option<String>,
    pub lines: Vec<String>,
    pub answer: Option<String>,
    pub accept: Option<String>,
    pub explain: String,
    pub solution: Option<String>,
    pub public: PublicCheck,
}

#[derive(Clone, Debug)]
pub struct LabDef {
    pub public: PublicLab,
    pub solution: String,
    pub solution_html: String,
}

pub struct Content {
    pub course: CourseSummary,
    pub lessons: HashMap<String, Lesson>,
    pub pages: HashMap<String, DocPage>,
    pub checks: HashMap<String, CheckDef>,
    pub labs: HashMap<String, LabDef>,
    /// chapter key ("ch02") → ids of its quiz-pool checks
    pub quiz_pools: HashMap<String, Vec<String>>,
}

// ---------- helpers ----------

fn sel(s: &str) -> Selector {
    Selector::parse(s).expect("selector")
}

fn has_class(el: &ElementRef, c: &str) -> bool {
    el.value().classes().any(|x| x == c)
}

fn text_of(el: &ElementRef) -> String {
    el.text().collect::<String>()
}

fn squash(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

static WHY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(?s)\s*<span class="why">(.*?)</span>"#).unwrap());
static HREF_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r#"href="([^"]*)""#).unwrap());
static STEP_NUM_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\s*\d+\.\s*").unwrap());
static MIN_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"~?(\d+)\s*min").unwrap());
static DRAW_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\((\d+)\s+drawn from\s+(\d+)\)").unwrap());

/// Deterministic shuffle so a check looks the same on reload.
pub fn shuffle_keys(n: usize, seed: &str) -> Vec<usize> {
    let mut h: u64 = 1469598103934665603;
    for b in seed.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    let mut v: Vec<usize> = (0..n).collect();
    for i in (1..n).rev() {
        h ^= h << 13;
        h ^= h >> 7;
        h ^= h << 17;
        let j = (h % (i as u64 + 1)) as usize;
        v.swap(i, j);
    }
    // never present an "order" check already solved
    if n > 1 && v.iter().enumerate().all(|(i, k)| i == *k) {
        v.rotate_left(1);
    }
    v
}

/// Rewrites links between content pages into SPA hash routes.
fn rewrite_links(html: &str, dir: &str) -> String {
    HREF_RE
        .replace_all(html, |c: &regex::Captures| {
            let href = &c[1];
            if href.starts_with("http") || href.starts_with('#') && !href.starts_with("#/") {
                if href.starts_with('#') {
                    return format!(r#"href="{}" data-anchor="1""#, href);
                }
                return format!(r#"href="{}" target="_blank" rel="noopener""#, href);
            }
            format!(r#"href="{}""#, route_for(href, dir))
        })
        .into_owned()
}

pub fn route_for(href: &str, dir: &str) -> String {
    let (path, anchor) = match href.split_once('#') {
        Some((p, a)) => (p, Some(a)),
        None => (href, None),
    };
    // resolve relative to dir ("" for the root, "ch02" for a chapter)
    let mut parts: Vec<&str> = if dir.is_empty() { vec![] } else { vec![dir] };
    for seg in path.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            s => parts.push(s),
        }
    }
    let joined = parts.join("/");
    let a = anchor.map(|a| format!("/{a}")).unwrap_or_default();
    if joined.is_empty() || joined == "index.html" {
        return "#/".into();
    }
    if joined == "final-exam.html" {
        return format!("#/exam{a}");
    }
    if joined.ends_with(".md") {
        return "#/about".into();
    }
    if let Some((ch, file)) = joined.split_once('/') {
        let stem = file.trim_end_matches(".html");
        return match stem {
            "index" => format!("#/chapter/{ch}"),
            "practice" => format!("#/practice/{ch}{a}"),
            "project" => format!("#/project/{ch}"),
            _ => format!("#/lesson/{ch}/{stem}{a}"),
        };
    }
    "#/".into()
}

// ---------- check parsing ----------

struct Ctx<'a> {
    page_id: String,
    dir: String,
    checks: &'a mut HashMap<String, CheckDef>,
    labs: &'a mut HashMap<String, LabDef>,
    counter: usize,
    scope: String,
    /// The last code block seen on the page: tap-the-line checks without
    /// their own file use it.
    last_code: Option<(Option<String>, String)>,
}

impl Ctx<'_> {
    fn link(&self, html: &str) -> String {
        rewrite_links(html.trim(), &self.dir)
    }
}

fn parse_check(el: &ElementRef, ctx: &mut Ctx) -> PublicCheck {
    let kind = el.value().attr("data-type").unwrap_or("mcq").to_string();
    let id = format!("{}/{}/{}", ctx.page_id, ctx.scope, ctx.counter);
    ctx.counter += 1;
    let mut prompt = String::new();
    let mut options = vec![];
    let mut pairs = vec![];
    let mut lines = vec![];
    let mut file = None;
    let mut answer = None;
    let mut accept = None;
    let mut explain = String::new();
    let mut solution = None;
    let tap_match = el.value().attr("data-match").map(|s| html_unescape(s));

    for child in el.children() {
        if let Some(t) = child.value().as_text() {
            if !t.trim().is_empty() {
                prompt.push_str(&t.to_string());
            }
            continue;
        }
        let Some(c) = ElementRef::wrap(child) else { continue };
        let name = c.value().name();
        if (name == "ol" && has_class(&c, "options")) || (name == "ul" && has_class(&c, "chips")) {
            for li in c.select(&sel("li")) {
                let inner = li.inner_html();
                let why = WHY_RE.captures(&inner).map(|m| m[1].trim().to_string());
                let html = WHY_RE.replace_all(&inner, "").trim().to_string();
                options.push(OptionDef {
                    html: ctx.link(&html),
                    correct: has_class(&li, "correct"),
                    why: why.map(|w| ctx.link(&w)),
                });
            }
        } else if name == "table" && has_class(&c, "pairs") {
            for tr in c.select(&sel("tr")) {
                let tds: Vec<_> = tr.select(&sel("td")).collect();
                if tds.len() >= 2 {
                    pairs.push((ctx.link(&tds[0].inner_html()), ctx.link(&tds[1].inner_html())));
                }
            }
        } else if name == "p" && has_class(&c, "answer") {
            answer = Some(squash(&text_of(&c)));
        } else if name == "p" && has_class(&c, "accept") {
            accept = Some(ctx.link(&c.inner_html()));
        } else if name == "div" && has_class(&c, "explain") {
            explain = ctx.link(&c.inner_html());
        } else if name == "details" && has_class(&c, "solution") {
            let mut s = String::new();
            for n in c.children() {
                if let Some(e) = ElementRef::wrap(n) {
                    if e.value().name() != "summary" {
                        s.push_str(&e.html());
                    }
                } else if let Some(t) = n.value().as_text() {
                    s.push_str(&t.to_string());
                }
            }
            solution = Some(ctx.link(&s));
        } else if name == "pre" && kind == "tapline" && lines.is_empty() {
            let t = text_of(&c);
            lines = t.lines().map(|l| l.to_string()).collect();
            file = c.value().attr("data-file").map(|s| s.to_string());
        } else {
            prompt.push_str(&c.html());
        }
    }

    if kind == "tapline" && lines.is_empty() {
        if let Some((f, t)) = &ctx.last_code {
            lines = t.lines().map(|l| l.to_string()).collect();
            file = f.clone();
        }
    }
    let n = options.len();
    // Shuffle every option list (deterministically per check) so the correct
    // answer's position carries no signal. Survey questions keep their order.
    let has_correct = options.iter().any(|o| o.correct);
    let order = if kind == "order" || has_correct {
        shuffle_keys(n, &id)
    } else {
        (0..n).collect()
    };
    let pub_opts = order
        .iter()
        .map(|k| PublicOption { key: *k, html: options[*k].html.clone() })
        .collect();
    let right_order = shuffle_keys(pairs.len(), &format!("{id}/r"));
    let public = PublicCheck {
        id: id.clone(),
        kind: kind.clone(),
        prompt: ctx.link(&prompt),
        options: pub_opts,
        left: pairs.iter().map(|p| p.0.clone()).collect(),
        right: right_order
            .iter()
            .map(|k| PublicOption { key: *k, html: pairs[*k].1.clone() })
            .collect(),
        lines: lines.clone(),
        file,
        multiple: kind == "multi" || options.iter().filter(|o| o.correct).count() > 1,
        section: el.value().attr("data-section").map(|s| s.to_string()),
        sets: el.value().attr("data-sets").map(|s| s.to_string()),
        has_solution: solution.is_some(),
    };
    ctx.checks.insert(
        id.clone(),
        CheckDef {
            id,
            kind,
            options,
            pairs,
            tap_match,
            lines,
            answer,
            accept,
            explain,
            solution,
            public: public.clone(),
        },
    );
    public
}

fn html_unescape(s: &str) -> String {
    s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&amp;", "&")
}

fn parse_lab(el: &ElementRef, ctx: &mut Ctx, id: &str, title: &str) -> PublicLab {
    let mut brief = String::new();
    let mut rules = vec![];
    let mut start = String::new();
    let mut solution = String::new();
    let mut solution_html = String::new();
    for child in el.children() {
        let Some(c) = ElementRef::wrap(child) else {
            if let Some(t) = child.value().as_text() {
                brief.push_str(&t.to_string());
            }
            continue;
        };
        let name = c.value().name();
        if name == "ul" && has_class(&c, "rules") {
            for li in c.select(&sel("li")) {
                rules.push(LabRuleText {
                    html: ctx.link(&li.inner_html()),
                    critical: has_class(&li, "critical"),
                });
            }
        } else if name == "pre" && has_class(&c, "start") {
            start = text_of(&c);
        } else if name == "details" && has_class(&c, "solution") {
            let pres: Vec<_> = c.select(&sel("pre")).collect();
            solution = pres.iter().map(|p| text_of(p)).collect::<Vec<_>>().join("\n---\n");
            let mut s = String::new();
            for n in c.children() {
                if let Some(e) = ElementRef::wrap(n) {
                    if e.value().name() != "summary" {
                        s.push_str(&e.html());
                    }
                }
            }
            solution_html = ctx.link(&s);
        } else if name == "h2" {
            // the capstone's lab box carries its own headings
            brief.push_str(&c.html());
        } else {
            brief.push_str(&c.html());
        }
    }
    let public = PublicLab {
        id: id.to_string(),
        title: title.to_string(),
        brief: ctx.link(&brief),
        rules,
        start,
        files: vec![],
    };
    ctx.labs.insert(
        id.to_string(),
        LabDef { public: public.clone(), solution, solution_html },
    );
    public
}

// ---------- block walking ----------

fn push_html(blocks: &mut Vec<Block>, html: &str) {
    if html.trim().is_empty() {
        return;
    }
    if let Some(Block::Html { html: prev }) = blocks.last_mut() {
        prev.push_str(html);
    } else {
        blocks.push(Block::Html { html: html.to_string() });
    }
}

fn contains_special(el: &ElementRef) -> bool {
    el.select(&sel(".check, .widget, pre.code, pre.output, aside")).next().is_some()
}

fn walk(parent: &ElementRef, ctx: &mut Ctx, blocks: &mut Vec<Block>, lab_title: &mut String) {
    for child in parent.children() {
        match child.value() {
            Node::Text(t) => {
                if !t.trim().is_empty() {
                    push_html(blocks, &t.to_string());
                }
                continue;
            }
            Node::Element(_) => {}
            _ => continue,
        }
        let c = ElementRef::wrap(child).unwrap();
        let name = c.value().name();
        let cls = |x: &str| has_class(&c, x);
        if name == "div" && cls("check") {
            let check = parse_check(&c, ctx);
            blocks.push(Block::Check { check });
        } else if name == "div" && cls("lab") {
            let id = format!("{}{}", ctx.page_id.replace("/practice", "/"), ctx.scope)
                .replace("//", "/");
            let id = if ctx.page_id.ends_with("/project") { ctx.page_id.clone() } else { id };
            let lab = parse_lab(&c, ctx, &id, lab_title);
            blocks.push(Block::Lab { lab });
        } else if name == "div" && cls("try") {
            blocks.push(Block::Try {
                lesson: c.value().attr("data-lesson").map(|s| s.to_string()),
                html: ctx.link(&c.inner_html()),
            });
        } else if name == "div" && cls("widget") {
            blocks.push(Block::Widget {
                name: c.value().attr("data-widget").unwrap_or("widget").to_string(),
                html: ctx.link(&c.inner_html()),
            });
        } else if name == "pre" && (cls("code") || cls("output")) {
            ctx.last_code = Some((c.value().attr("data-file").map(|s| s.to_string()), text_of(&c)));
            blocks.push(Block::Code {
                file: c.value().attr("data-file").map(|s| s.to_string()),
                text: text_of(&c),
                output: cls("output"),
                diff: c.value().attr("data-diff").is_some(),
            });
        } else if name == "aside" && cls("coming") {
            let set = c.value().attr("data-set").unwrap_or("A").to_string();
            let mut items = vec![];
            let mut persona = String::new();
            if let Some(dl) = c.select(&sel("dl")).next() {
                for n in dl.children() {
                    let Some(e) = ElementRef::wrap(n) else { continue };
                    match e.value().name() {
                        "dt" => persona = squash(&text_of(&e)),
                        "dd" => items.push(ComingItem {
                            persona: persona.clone(),
                            html: ctx.link(&e.inner_html()),
                        }),
                        _ => {}
                    }
                }
            }
            blocks.push(Block::Coming { set, items });
        } else if name == "aside" && cls("more") {
            blocks.push(Block::More { html: ctx.link(&c.inner_html()) });
        } else if name == "div" && cls("body") && contains_special(&c) {
            walk(&c, ctx, blocks, lab_title);
        } else if name == "div" && cls("body") {
            push_html(blocks, &ctx.link(&c.inner_html()));
        } else {
            push_html(blocks, &ctx.link(&c.html()));
        }
    }
}

// ---------- pages ----------

fn read(path: &Path) -> Result<Html> {
    let s = std::fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
    Ok(Html::parse_document(&s))
}

fn first_text(doc: &Html, s: &str) -> String {
    doc.select(&sel(s)).next().map(|e| squash(&text_of(&e))).unwrap_or_default()
}

fn parse_lesson(
    path: &Path,
    ch_key: &str,
    chapter: u32,
    checks: &mut HashMap<String, CheckDef>,
    labs: &mut HashMap<String, LabDef>,
) -> Result<Lesson> {
    let doc = read(path)?;
    let stem = path.file_stem().unwrap().to_string_lossy().to_string();
    let id = format!("{ch_key}/{stem}");
    let num = stem.split('-').next().unwrap_or("").to_string();
    let mut steps = vec![];
    let mut total = 0;
    let mut last_code = None;
    for sec in doc.select(&sel("section.step")) {
        let sid = sec.value().attr("id").unwrap_or("s").to_string();
        let title = sec
            .select(&sel("h2"))
            .next()
            .map(|h| STEP_NUM_RE.replace(&squash(&text_of(&h)), "").to_string())
            .unwrap_or_default();
        let mut ctx = Ctx {
            page_id: id.clone(),
            dir: ch_key.to_string(),
            checks,
            labs,
            counter: 0,
            scope: sid.clone(),
            last_code: last_code.take(),
        };
        let mut blocks = vec![];
        let mut lt = String::new();
        // skip the h2 (title) when walking
        let mut tmp = vec![];
        walk(&sec, &mut ctx, &mut tmp, &mut lt);
        total += ctx.counter;
        last_code = ctx.last_code.take();
        for b in tmp {
            if let Block::Html { html } = &b {
                let stripped = Regex::new(r"(?s)^\s*<h2[^>]*>.*?</h2>").unwrap().replace(html, "");
                if stripped.trim().is_empty() {
                    continue;
                }
                blocks.push(Block::Html { html: stripped.to_string() });
            } else {
                blocks.push(b);
            }
        }
        steps.push(Step { id: sid, title, summary: has_class(&sec, "summary"), blocks });
    }
    Ok(Lesson {
        id,
        chapter,
        num,
        title: first_text(&doc, "header h1"),
        kicker: first_text(&doc, "header .kicker"),
        meta: first_text(&doc, "header .meta"),
        steps,
        check_count: total,
    })
}

fn parse_doc(
    path: &Path,
    id: &str,
    dir: &str,
    checks: &mut HashMap<String, CheckDef>,
    labs: &mut HashMap<String, LabDef>,
) -> Result<DocPage> {
    let doc = read(path)?;
    let main = doc.select(&sel("main")).next().context("no <main>")?;
    let mut intro = vec![];
    let mut sections: Vec<Section> = vec![];
    let mut title = String::new();
    let mut kicker = String::new();
    // Walk top-level children, starting a new section at each h2.
    let mut current: Option<Section> = None;
    let mut counter_by_scope: HashMap<String, usize> = HashMap::new();
    for child in main.children() {
        let Some(c) = ElementRef::wrap(child) else { continue };
        let name = c.value().name();
        if name == "nav" {
            continue;
        }
        if name == "h1" {
            title = squash(&text_of(&c));
            continue;
        }
        if name == "p" && has_class(&c, "kicker") {
            kicker = squash(&text_of(&c));
            continue;
        }
        if name == "h2" {
            if let Some(s) = current.take() {
                sections.push(s);
            }
            let sid = c
                .value()
                .attr("id")
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("sec{}", sections.len() + 1));
            current = Some(Section { id: sid, title: squash(&text_of(&c)), blocks: vec![] });
            continue;
        }
        let scope = current.as_ref().map(|s| s.id.clone()).unwrap_or_else(|| "intro".into());
        let counter = *counter_by_scope.get(&scope).unwrap_or(&0);
        let mut ctx = Ctx {
            page_id: id.to_string(),
            dir: dir.to_string(),
            checks,
            labs,
            counter,
            scope: scope.clone(),
            last_code: None,
        };
        let mut lab_title = current.as_ref().map(|s| s.title.clone()).unwrap_or(title.clone());
        let target = match current.as_mut() {
            Some(s) => &mut s.blocks,
            None => &mut intro,
        };
        // wrap the element in a fake parent walk: handle it as a single child
        let mut tmp = vec![];
        walk_one(&c, &mut ctx, &mut tmp, &mut lab_title);
        counter_by_scope.insert(scope, ctx.counter);
        for b in tmp {
            if let Block::Html { html } = &b {
                push_html(target, html);
            } else {
                target.push(b);
            }
        }
    }
    if let Some(s) = current.take() {
        sections.push(s);
    }
    Ok(DocPage { id: id.to_string(), title, kicker, intro, sections })
}

fn walk_one(el: &ElementRef, ctx: &mut Ctx, blocks: &mut Vec<Block>, lab_title: &mut String) {
    // Re-use `walk` by walking the parent and filtering to this child would be
    // wasteful; instead mirror its dispatch for a single element.
    let name = el.value().name();
    let cls = |x: &str| has_class(el, x);
    if name == "div" && (cls("check") || cls("lab") || cls("try") || cls("widget"))
        || name == "pre" && (cls("code") || cls("output"))
        || name == "aside"
    {
        // build a tiny wrapper document containing just this element
        let frag = Html::parse_fragment(&format!("<div id=\"w\">{}</div>", el.html()));
        let w = frag.select(&sel("div#w")).next().unwrap();
        walk(&w, ctx, blocks, lab_title);
    } else if name == "h3" || !contains_special(el) {
        push_html(blocks, &ctx.link(&el.html()));
    } else {
        walk(el, ctx, blocks, lab_title);
    }
}

pub fn load(root: &Path) -> Result<Content> {
    let mut checks = HashMap::new();
    let mut labs = HashMap::new();
    let mut lessons = HashMap::new();
    let mut pages = HashMap::new();
    let mut quiz_pools: HashMap<String, Vec<String>> = HashMap::new();

    // Parts and chapter order from the course index.
    let idx = read(&root.join("index.html"))?;
    let mut parts: Vec<Part> = vec![];
    let main = idx.select(&sel("main")).next().context("no main in index")?;
    let mut course_title = String::new();
    for child in main.children() {
        let Some(c) = ElementRef::wrap(child) else { continue };
        match c.value().name() {
            "h1" => course_title = squash(&text_of(&c)),
            "h2" => parts.push(Part { title: squash(&text_of(&c)), chapters: vec![] }),
            "ul" => {
                for a in c.select(&sel("a")) {
                    let href = a.value().attr("href").unwrap_or("");
                    if let Some(n) = href.strip_prefix("ch").and_then(|s| s.get(0..2)) {
                        if let (Ok(n), Some(p)) = (n.parse::<u32>(), parts.last_mut()) {
                            p.chapters.push(n);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    let mut chapters = vec![];
    for part in &parts {
        for &num in &part.chapters {
            let key = format!("ch{num:02}");
            let dir: PathBuf = root.join(&key);
            let cdoc = read(&dir.join("index.html"))?;
            let cmain = cdoc.select(&sel("main")).next().context("chapter main")?;
            let title = first_text(&cdoc, "main h1");
            let title = title.split_once(" · ").map(|(_, t)| t.to_string()).unwrap_or(title);
            let mut intro = String::new();
            let mut outcomes = String::new();
            let mut practice = String::new();
            let mut note = String::new();
            let mut lesson_files: Vec<String> = vec![];
            let mut heading = String::new();
            for child in cmain.children() {
                let Some(c) = ElementRef::wrap(child) else { continue };
                let name = c.value().name();
                if name == "h2" {
                    heading = squash(&text_of(&c)).to_lowercase();
                    continue;
                }
                if name == "nav" || name == "h1" || (name == "p" && has_class(&c, "kicker")) {
                    continue;
                }
                if name == "p" && has_class(&c, "muted") {
                    note.push_str(&rewrite_links(&c.inner_html(), &key));
                    continue;
                }
                let h = rewrite_links(&c.html(), &key);
                if heading.is_empty() {
                    intro.push_str(&h);
                } else if heading.starts_with("by the end") {
                    outcomes.push_str(&h);
                } else if heading.contains("lesson") {
                    for a in c.select(&sel("a")) {
                        if let Some(href) = a.value().attr("href") {
                            if href.ends_with(".html") && !href.contains('/') && href != "project.html" {
                                lesson_files.push(href.to_string());
                            }
                        }
                    }
                    if !c.select(&sel("a")).next().is_some() {
                        practice.push_str(&h);
                    }
                } else {
                    practice.push_str(&format!("<h3>{}</h3>{}", capitalize(&heading), h));
                }
            }
            let mut lrefs = vec![];
            for f in &lesson_files {
                let l = parse_lesson(&dir.join(f), &key, num, &mut checks, &mut labs)?;
                let minutes = MIN_RE
                    .captures(&l.kicker)
                    .and_then(|m| m[1].parse().ok())
                    .unwrap_or(10);
                lrefs.push(LessonRef {
                    id: l.id.clone(),
                    num: l.num.clone(),
                    title: l.title.clone(),
                    minutes,
                    checks: l.check_count,
                });
                lessons.insert(l.id.clone(), l);
            }
            let mut page_ids = vec![];
            let mut quiz = None;
            let mut lab_ids = vec![];
            let mut predict_count = 0;
            for doc_name in ["practice", "project"] {
                let p = dir.join(format!("{doc_name}.html"));
                if !p.exists() {
                    continue;
                }
                let pid = format!("{key}/{doc_name}");
                let page = parse_doc(&p, &pid, &key, &mut checks, &mut labs)?;
                for s in &page.sections {
                    if s.id == "quiz" {
                        let ids: Vec<String> = s
                            .blocks
                            .iter()
                            .filter_map(|b| match b {
                                Block::Check { check } => Some(check.id.clone()),
                                _ => None,
                            })
                            .collect();
                        let draw = DRAW_RE
                            .captures(&s.title)
                            .and_then(|m| m[1].parse().ok())
                            .unwrap_or(ids.len().min(10));
                        quiz = Some(QuizInfo { draw, pool: ids.len() });
                        quiz_pools.insert(key.clone(), ids);
                    }
                    if s.id == "predict" {
                        predict_count += s.blocks.iter().filter(|b| matches!(b, Block::Check { .. })).count();
                    }
                    for b in &s.blocks {
                        if let Block::Lab { lab } = b {
                            lab_ids.push(lab.id.clone());
                        }
                    }
                }
                page_ids.push(pid.clone());
                pages.insert(pid, page);
            }
            chapters.push(Chapter {
                num,
                key: key.clone(),
                title,
                part: part.title.clone(),
                kicker: first_text(&cdoc, "main .kicker"),
                intro,
                outcomes,
                practice,
                note,
                optional: num == 0,
                lessons: lrefs,
                pages: page_ids,
                quiz,
                labs: lab_ids,
                predict_count,
            });
        }
    }

    // Course-wide final exam.
    let exam = parse_doc(&root.join("final-exam.html"), "exam", "", &mut checks, &mut labs)?;
    pages.insert("exam".into(), exam);

    Ok(Content {
        course: CourseSummary { title: course_title, parts, chapters },
        lessons,
        pages,
        checks,
        labs,
        quiz_pools,
    })
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn routes() {
        assert_eq!(route_for("2.1-pods.html", "ch02"), "#/lesson/ch02/2.1-pods");
        assert_eq!(route_for("../ch03/3.3-probes.html#s4", "ch02"), "#/lesson/ch03/3.3-probes/s4");
        assert_eq!(route_for("practice.html#lab", "ch02"), "#/practice/ch02/lab");
        assert_eq!(route_for("../index.html", "ch02"), "#/");
        assert_eq!(route_for("index.html", "ch02"), "#/chapter/ch02");
        assert_eq!(route_for("ch02/index.html", ""), "#/chapter/ch02");
        assert_eq!(route_for("final-exam.html", ""), "#/exam");
    }
}
