//! YAML helpers: multi-document parsing and a tiny path language.
//!
//! Path syntax: `spec.template.spec.containers[*].image`,
//! `metadata.labels["azure.workload.identity/use"]`, `items[0]`.

use serde_json::Value;

pub struct Doc {
    pub value: Value,
}

impl Doc {
    pub fn kind(&self) -> &str {
        self.value.get("kind").and_then(|v| v.as_str()).unwrap_or("")
    }
    pub fn name(&self) -> &str {
        self.value.pointer("/metadata/name").and_then(|v| v.as_str()).unwrap_or("")
    }
    pub fn namespace(&self) -> &str {
        self.value.pointer("/metadata/namespace").and_then(|v| v.as_str()).unwrap_or("")
    }
}

/// Parses every `---`-separated document. Empty documents are skipped.
pub fn parse_docs(text: &str) -> Result<Vec<Doc>, String> {
    let mut out = vec![];
    for (i, d) in serde_yaml::Deserializer::from_str(text).enumerate() {
        let v: serde_yaml::Value =
            serde::Deserialize::deserialize(d).map_err(|e| format!("Document {}: {}", i + 1, e))?;
        if v.is_null() {
            continue;
        }
        let j = serde_json::to_value(&v).map_err(|e| format!("Document {}: {}", i + 1, e))?;
        out.push(Doc { value: j });
    }
    Ok(out)
}

#[derive(Debug, Clone, PartialEq)]
enum Seg {
    Key(String),
    All,
    Index(usize),
}

fn parse_path(p: &str) -> Vec<Seg> {
    let mut segs = vec![];
    let chars: Vec<char> = p.chars().collect();
    let mut i = 0;
    let mut cur = String::new();
    while i < chars.len() {
        let c = chars[i];
        match c {
            '.' => {
                if !cur.is_empty() {
                    segs.push(Seg::Key(std::mem::take(&mut cur)));
                }
            }
            '[' => {
                if !cur.is_empty() {
                    segs.push(Seg::Key(std::mem::take(&mut cur)));
                }
                let end = chars[i..].iter().position(|c| *c == ']').map(|e| e + i).unwrap_or(chars.len());
                let inner: String = chars[i + 1..end].iter().collect();
                let inner = inner.trim();
                if inner == "*" || inner.is_empty() {
                    segs.push(Seg::All);
                } else if let Ok(n) = inner.parse::<usize>() {
                    segs.push(Seg::Index(n));
                } else {
                    segs.push(Seg::Key(inner.trim_matches(|c| c == '"' || c == '\'').to_string()));
                }
                i = end;
            }
            _ => cur.push(c),
        }
        i += 1;
    }
    if !cur.is_empty() {
        segs.push(Seg::Key(cur));
    }
    segs
}

/// All values reached by the path (arrays expand at `[*]`).
pub fn query<'a>(v: &'a Value, path: &str) -> Vec<&'a Value> {
    let mut cur = vec![v];
    for seg in parse_path(path) {
        let mut next = vec![];
        for x in cur {
            match &seg {
                Seg::Key(k) => {
                    if let Some(y) = x.get(k.as_str()) {
                        next.push(y);
                    }
                }
                Seg::Index(n) => {
                    if let Some(y) = x.get(*n) {
                        next.push(y);
                    }
                }
                Seg::All => {
                    if let Some(a) = x.as_array() {
                        next.extend(a.iter());
                    } else if let Some(o) = x.as_object() {
                        next.extend(o.values());
                    }
                }
            }
        }
        cur = next;
    }
    cur
}

pub fn as_text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

pub fn as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

/// Labels as a flat string map.
pub fn str_map(v: Option<&Value>) -> std::collections::BTreeMap<String, String> {
    let mut m = std::collections::BTreeMap::new();
    if let Some(o) = v.and_then(|v| v.as_object()) {
        for (k, v) in o {
            m.insert(k.clone(), as_text(v));
        }
    }
    m
}

/// The pod spec of a workload (Deployment, StatefulSet, Job …) or a Pod.
pub fn pod_spec(d: &Doc) -> Option<&Value> {
    match d.kind() {
        "Pod" => d.value.get("spec"),
        "CronJob" => d.value.pointer("/spec/jobTemplate/spec/template/spec"),
        _ => d.value.pointer("/spec/template/spec"),
    }
}

pub fn pod_labels(d: &Doc) -> std::collections::BTreeMap<String, String> {
    match d.kind() {
        "Pod" => str_map(d.value.pointer("/metadata/labels")),
        _ => str_map(d.value.pointer("/spec/template/metadata/labels")),
    }
}

pub fn is_workload(d: &Doc) -> bool {
    matches!(d.kind(), "Deployment" | "StatefulSet" | "DaemonSet" | "Pod" | "Job" | "ReplicaSet")
}

pub fn containers(d: &Doc) -> Vec<&Value> {
    let mut out = vec![];
    if let Some(ps) = pod_spec(d) {
        for key in ["containers", "initContainers"] {
            if let Some(a) = ps.get(key).and_then(|v| v.as_array()) {
                out.extend(a.iter());
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paths() {
        let d = parse_docs("a:\n  b:\n    - c: 1\n    - c: 2\n  labels:\n    x.y/z: 'true'\n").unwrap();
        let v = &d[0].value;
        assert_eq!(query(v, "a.b[*].c").len(), 2);
        assert_eq!(as_text(query(v, "a.labels[\"x.y/z\"]")[0]), "true");
        assert_eq!(query(v, "a.b[1].c")[0], &serde_json::json!(2));
    }
}
