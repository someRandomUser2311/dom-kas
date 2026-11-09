//! rbac-eval: answers "can subject X do verb on resource in namespace N?"
//! from Roles, ClusterRoles and their bindings.

use super::yamlx::{as_text, Doc};
use serde_json::Value;

pub struct Subject {
    pub kind: String,
    pub name: String,
    pub namespace: String,
}

fn default_group(resource: &str) -> &'static str {
    match resource.split('/').next().unwrap_or("") {
        "deployments" | "replicasets" | "statefulsets" | "daemonsets" => "apps",
        "horizontalpodautoscalers" => "autoscaling",
        "httproutes" | "gateways" => "gateway.networking.k8s.io",
        "networkpolicies" | "ingresses" => "networking.k8s.io",
        "roles" | "rolebindings" | "clusterroles" | "clusterrolebindings" => "rbac.authorization.k8s.io",
        "jobs" | "cronjobs" => "batch",
        _ => "",
    }
}

/// "patch deployments -n orders" → (verb, resource, group, namespace)
pub fn parse_case(case: &str) -> (String, String, String, Option<String>) {
    let toks: Vec<&str> = case.split_whitespace().collect();
    let verb = toks.first().unwrap_or(&"").to_string();
    let res_full = toks.get(1).unwrap_or(&"").to_string();
    let (resource, group) = match res_full.split_once('.') {
        Some((r, g)) => (r.to_string(), g.to_string()),
        None => (res_full.clone(), default_group(&res_full).to_string()),
    };
    let ns = toks.iter().position(|t| *t == "-n").and_then(|i| toks.get(i + 1)).map(|s| s.to_string());
    (verb, resource, group, ns)
}

fn list(v: Option<&Value>) -> Vec<String> {
    v.and_then(|v| v.as_array()).map(|a| a.iter().map(as_text).collect()).unwrap_or_default()
}

fn rule_allows(rule: &Value, verb: &str, resource: &str, group: &str) -> bool {
    let groups = list(rule.get("apiGroups"));
    let resources = list(rule.get("resources"));
    let verbs = list(rule.get("verbs"));
    (groups.iter().any(|g| g == group || g == "*"))
        && (resources.iter().any(|r| r == resource || r == "*"))
        && (verbs.iter().any(|v| v == verb || v == "*"))
}

fn subject_matches(b: &Value, s: &Subject, binding_ns: &str) -> bool {
    b.get("subjects").and_then(|v| v.as_array()).map(|subs| {
        subs.iter().any(|x| {
            let kind = x.get("kind").map(as_text).unwrap_or_default();
            let name = x.get("name").map(as_text).unwrap_or_default();
            let ns = x.get("namespace").map(as_text).unwrap_or_else(|| binding_ns.to_string());
            kind == s.kind && name == s.name && (kind != "ServiceAccount" || ns == s.namespace)
        })
    }).unwrap_or(false)
}

pub fn can(docs: &[Doc], s: &Subject, case: &str) -> bool {
    explain(docs, s, case).is_some()
}

/// Which role and binding grant the action, if any.
pub fn explain(docs: &[Doc], s: &Subject, case: &str) -> Option<String> {
    let (verb, resource, group, ns) = parse_case(case);
    for b in docs.iter().filter(|d| d.kind() == "RoleBinding" || d.kind() == "ClusterRoleBinding") {
        let bns = b.namespace().to_string();
        if !subject_matches(&b.value, s, &bns) {
            continue;
        }
        let role_kind = b.value.pointer("/roleRef/kind").map(as_text).unwrap_or_default();
        let role_name = b.value.pointer("/roleRef/name").map(as_text).unwrap_or_default();
        // A RoleBinding only grants inside its namespace.
        if b.kind() == "RoleBinding" && ns.as_deref() != Some(bns.as_str()) {
            continue;
        }
        let role = docs.iter().find(|d| {
            d.kind() == role_kind && d.name() == role_name && (role_kind == "ClusterRole" || d.namespace() == bns)
        });
        if let Some(role) = role {
            if let Some(rules) = role.value.get("rules").and_then(|v| v.as_array()) {
                if let Some(i) = rules.iter().position(|r| rule_allows(r, &verb, &resource, &group)) {
                    let rns = if role.namespace().is_empty() { String::new() } else { format!("{}/", role.namespace()) };
                    let bns = if bns.is_empty() { String::new() } else { format!("{bns}/") };
                    return Some(format!(
                        "{role_kind} {rns}{} rule {} via {} {bns}{}",
                        role.name(), i + 1, b.kind(), b.name()
                    ));
                }
            }
        }
    }
    None
}

pub fn has_wildcard(docs: &[Doc]) -> bool {
    docs.iter().filter(|d| d.kind() == "Role" || d.kind() == "ClusterRole").any(|d| {
        d.value.get("rules").and_then(|v| v.as_array()).map(|rules| {
            rules.iter().any(|r| {
                ["apiGroups", "resources", "verbs"].iter().any(|k| list(r.get(*k)).iter().any(|x| x == "*"))
            })
        }).unwrap_or(false)
    })
}
