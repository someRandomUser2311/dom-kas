//! Pod Security Standards "restricted": one result per rule, for the
//! policy-rules widget (the lab grader uses the same checks via lab.rs).

use super::yamlx::{self, as_text, Doc};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct RuleCheck {
    pub rule: &'static str,
    pub pass: bool,
    pub detail: String,
}

pub fn restricted(docs: &[Doc]) -> Vec<RuleCheck> {
    let mut out = vec![];
    let workloads: Vec<&Doc> = docs.iter().filter(|d| yamlx::is_workload(d)).collect();
    fn push(out: &mut Vec<RuleCheck>, rule: &'static str, bad: Vec<String>) {
        out.push(RuleCheck { rule, pass: bad.is_empty(), detail: bad.join("; ") });
    }
    if workloads.is_empty() {
        push(&mut out, "A Pod or workload to check", vec!["no Pod, Deployment or other workload found".into()]);
        return out;
    }
    let mut nonroot = vec![];
    let mut escalation = vec![];
    let mut drop_all = vec![];
    let mut added = vec![];
    let mut seccomp = vec![];
    let mut privileged = vec![];
    let mut hostns = vec![];
    let mut hostpath = vec![];
    for w in workloads {
        let ps = yamlx::pod_spec(w).cloned().unwrap_or(Value::Null);
        for k in ["hostNetwork", "hostPID", "hostIPC"] {
            if ps.get(k).and_then(|v| v.as_bool()) == Some(true) {
                hostns.push(format!("{}: {k}: true", w.name()));
            }
        }
        for v in yamlx::query(&ps, "volumes[*]") {
            if v.get("hostPath").is_some() {
                hostpath.push(format!("volume {}", v.get("name").map(as_text).unwrap_or_default()));
            }
        }
        let pod_nonroot = ps.pointer("/securityContext/runAsNonRoot").and_then(|v| v.as_bool());
        let pod_user = ps.pointer("/securityContext/runAsUser").and_then(|v| v.as_i64());
        let pod_seccomp = ps.pointer("/securityContext/seccompProfile/type").map(as_text);
        for c in yamlx::containers(w) {
            let n = c.get("name").map(as_text).unwrap_or_default();
            let sc = c.get("securityContext").cloned().unwrap_or(Value::Null);
            let nr = sc.get("runAsNonRoot").and_then(|v| v.as_bool()).or(pod_nonroot);
            let user = sc.get("runAsUser").and_then(|v| v.as_i64()).or(pod_user);
            if nr != Some(true) || user == Some(0) {
                nonroot.push(n.clone());
            }
            if sc.get("allowPrivilegeEscalation").and_then(|v| v.as_bool()) != Some(false) {
                escalation.push(n.clone());
            }
            let drops: Vec<String> = yamlx::query(&sc, "capabilities.drop[*]").into_iter().map(as_text).collect();
            if !drops.iter().any(|d| d == "ALL") {
                drop_all.push(n.clone());
            }
            for a in yamlx::query(&sc, "capabilities.add[*]").into_iter().map(as_text) {
                if a != "NET_BIND_SERVICE" {
                    added.push(format!("{n}: {a}"));
                }
            }
            let sec = sc.pointer("/seccompProfile/type").map(as_text).or(pod_seccomp.clone());
            if !matches!(sec.as_deref(), Some("RuntimeDefault") | Some("Localhost")) {
                seccomp.push(n.clone());
            }
            if sc.get("privileged").and_then(|v| v.as_bool()) == Some(true) {
                privileged.push(n.clone());
            }
        }
    }
    push(&mut out, "runAsNonRoot: true (and not runAsUser: 0)", nonroot);
    push(&mut out, "allowPrivilegeEscalation: false", escalation);
    push(&mut out, "capabilities drop ALL", drop_all);
    push(&mut out, "No added capabilities except NET_BIND_SERVICE", added);
    push(&mut out, "seccompProfile RuntimeDefault or Localhost", seccomp);
    push(&mut out, "Not privileged", privileged);
    push(&mut out, "No host namespaces (hostNetwork, hostPID, hostIPC)", hostns);
    push(&mut out, "No hostPath volumes", hostpath);
    out
}
