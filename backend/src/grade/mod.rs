//! Grading of in-lesson checks, quiz questions and labs.

pub mod command;
pub mod lab;
pub mod netpol;
pub mod pss;
pub mod rbac;
pub mod yamlx;

use crate::content::CheckDef;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Answer {
    /// mcq / predict / diagnose / fill: chosen option key
    pub choice: Option<usize>,
    /// multi: chosen option keys
    pub choices: Option<Vec<usize>>,
    /// order: option keys in the learner's order
    pub order: Option<Vec<usize>>,
    /// match: for each left row (in order), the chosen right key
    pub matches: Option<Vec<usize>>,
    /// tapline: line index
    pub line: Option<usize>,
    /// command: the typed command
    pub text: Option<String>,
    /// custom: the learner says they completed the widget task / reveals
    pub done: Option<bool>,
}

#[derive(Serialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptionFeedback {
    pub key: usize,
    pub correct: bool,
    pub why: Option<String>,
}

#[derive(Serialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub correct: bool,
    /// Survey questions (no correct option) are always "correct".
    pub survey: bool,
    pub message: Option<String>,
    pub explain: String,
    pub solution: Option<String>,
    pub options: Vec<OptionFeedback>,
    /// order: correct key sequence; match: correct right key per left row
    pub correct_order: Vec<usize>,
    pub correct_lines: Vec<usize>,
    pub answer: Option<String>,
    pub accept: Option<String>,
}

pub fn grade_check(c: &CheckDef, a: &Answer) -> CheckResult {
    let mut r = CheckResult {
        explain: c.explain.clone(),
        solution: c.solution.clone(),
        ..Default::default()
    };
    r.options = c
        .options
        .iter()
        .enumerate()
        .map(|(k, o)| OptionFeedback { key: k, correct: o.correct, why: o.why.clone() })
        .collect();
    match c.kind.as_str() {
        "order" => {
            let want: Vec<usize> = (0..c.options.len()).collect();
            r.correct = a.order.as_ref() == Some(&want);
            r.correct_order = want.clone();
            if !r.correct {
                if let Some(o) = &a.order {
                    let right = o.iter().enumerate().filter(|(i, k)| i == *k).count();
                    r.message = Some(format!("{right} of {} in the right place.", c.options.len()));
                }
            }
        }
        "match" => {
            let want: Vec<usize> = (0..c.pairs.len()).collect();
            r.correct = a.matches.as_ref() == Some(&want);
            r.correct_order = want.clone();
            if !r.correct {
                if let Some(m) = &a.matches {
                    let right = m.iter().enumerate().filter(|(i, k)| i == *k).count();
                    r.message = Some(format!("{right} of {} pairs right.", c.pairs.len()));
                }
            }
        }
        "tapline" => {
            let unq = |x: &str| x.replace(['"', '\''], "");
            let needle = unq(&c.tap_match.clone().unwrap_or_default());
            let n = needle.trim();
            r.correct_lines = c
                .lines
                .iter()
                .enumerate()
                .filter(|(_, l)| { let l = unq(l); !n.is_empty() && (l.contains(&needle) || l.contains(n)) })
                .map(|(i, _)| i)
                .collect();
            r.correct = a.line.map(|l| r.correct_lines.contains(&l)).unwrap_or(false);
            if !r.correct {
                r.message = Some("That line looks fine. Look again.".into());
            }
        }
        "command" => {
            let canon = c.answer.clone().unwrap_or_default();
            let accept = c.accept.clone().unwrap_or_default();
            let extras = command::extras_for(&canon, &accept);
            match command::compare(a.text.as_deref().unwrap_or(""), &canon, &extras) {
                Ok(()) => r.correct = true,
                Err(e) => r.message = Some(e),
            }
            r.answer = Some(canon);
            r.accept = c.accept.clone();
        }
        "custom" => {
            r.correct = a.done.unwrap_or(false);
            r.survey = true;
        }
        _ => {
            // mcq, multi, predict, diagnose, fill
            let correct: Vec<usize> =
                c.options.iter().enumerate().filter(|(_, o)| o.correct).map(|(i, _)| i).collect();
            if correct.is_empty() {
                r.correct = true;
                r.survey = true;
            } else if c.public.multiple {
                let mut ch = a.choices.clone().unwrap_or_default();
                ch.sort();
                ch.dedup();
                r.correct = ch == correct;
                if !r.correct {
                    let hit = ch.iter().filter(|k| correct.contains(k)).count();
                    let wrong = ch.len() - hit;
                    r.message = Some(format!(
                        "{hit} of {} correct selected{}.",
                        correct.len(),
                        if wrong > 0 { format!(", {wrong} wrong") } else { String::new() }
                    ));
                }
            } else {
                r.correct = a.choice.map(|k| correct.contains(&k)).unwrap_or(false);
            }
        }
    }
    r
}

// ---------- widget evaluation (/api/eval) ----------

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum EvalReq {
    /// Connectivity matrix for NetworkPolicies against a pod fixture.
    Netpol { yaml: String, fixture: netpol::Fixture },
    /// RBAC cases ("patch deployments -n orders") for a subject.
    Rbac { yaml: String, subject: std::collections::BTreeMap<String, String>, cases: Vec<String> },
    /// Pod Security "restricted" rule by rule.
    Pss { yaml: String },
}

pub fn eval(req: &EvalReq) -> serde_json::Value {
    use serde_json::json;
    let parse = |y: &str| yamlx::parse_docs(y);
    match req {
        EvalReq::Netpol { yaml, fixture } => match parse(yaml) {
            Err(e) => json!({ "error": e }),
            Ok(docs) => {
                let ev = netpol::Eval::new(fixture);
                let flows: Vec<_> = ev
                    .flows(&docs)
                    .into_iter()
                    .map(|f| json!({ "from": f.from, "to": f.to, "port": f.port, "egress": f.egress, "ingress": f.ingress, "allowed": f.allowed() }))
                    .collect();
                json!({ "flows": flows, "policies": docs.iter().filter(|d| d.kind() == "NetworkPolicy").count() })
            }
        },
        EvalReq::Rbac { yaml, subject, cases } => match parse(yaml) {
            Err(e) => json!({ "error": e }),
            Ok(docs) => {
                let s = rbac::Subject {
                    kind: subject.get("kind").cloned().unwrap_or_else(|| "ServiceAccount".into()),
                    name: subject.get("name").cloned().unwrap_or_default(),
                    namespace: subject.get("namespace").cloned().unwrap_or_default(),
                };
                let results: Vec<_> = cases
                    .iter()
                    .map(|c| {
                        let why = rbac::explain(&docs, &s, c);
                        json!({ "case": c, "allow": why.is_some(), "why": why.unwrap_or_else(|| "no rule".into()) })
                    })
                    .collect();
                json!({ "results": results, "wildcard": rbac::has_wildcard(&docs) })
            }
        },
        EvalReq::Pss { yaml } => match parse(yaml) {
            Err(e) => json!({ "error": e }),
            Ok(docs) => json!({ "rules": pss::restricted(&docs) }),
        },
    }
}
