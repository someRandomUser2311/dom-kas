//! The `command` check: the learner types a command and we compare it with
//! the canonical answer after normalising flag spellings, flag order,
//! resource aliases and `type/name` forms.

use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, PartialEq)]
pub struct Parsed {
    pub program: String,
    pub positional: Vec<String>,
    pub flags: BTreeMap<String, String>,
}

/// Shell-like tokenizer: whitespace separated, single/double quotes group.
pub fn tokenize(s: &str) -> Vec<String> {
    let mut out = vec![];
    let mut cur = String::new();
    let mut quote: Option<char> = None;
    let mut has = false;
    for ch in s.trim().trim_start_matches('$').chars() {
        match quote {
            Some(q) if ch == q => quote = None,
            Some(_) => cur.push(ch),
            None if ch == '"' || ch == '\'' => {
                quote = Some(ch);
                has = true;
            }
            None if ch.is_whitespace() => {
                if has || !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                    has = false;
                }
            }
            None if ch == '\\' => {}
            None => cur.push(ch),
        }
    }
    if has || !cur.is_empty() {
        out.push(cur);
    }
    out
}

fn short_flag(program: &str, sub: &str, f: &str) -> String {
    let m = match program {
        "kubectl" => match f {
            "-n" => "--namespace",
            "-o" => "--output",
            "-L" => "--label-columns",
            "-l" => "--selector",
            "-f" => "--filename",
            "-c" => "--container",
            "-p" if sub == "logs" => "--previous",
            "-A" => "--all-namespaces",
            "-w" => "--watch",
            _ => f,
        },
        "az" => match f {
            "-g" => "--resource-group",
            "-n" => "--name",
            "-o" => "--output",
            "-s" => "--subscription",
            "-l" => "--location",
            _ => f,
        },
        "helm" => match f {
            "-n" => "--namespace",
            "-f" => "--values",
            "-i" => "--install",
            _ => f,
        },
        _ => f,
    };
    m.to_string()
}

fn is_bool_flag(f: &str) -> bool {
    const B: &[&str] = &[
        "--previous", "--all-namespaces", "--watch", "--wait", "--atomic", "--rollback-on-failure",
        "--install", "--create-namespace", "--no-wait", "--yes", "--overwrite", "--force",
        "--overwrite-existing", "--admin", "--dry-run", "--debug", "--help", "--recursive",
        "--follow", "--show-labels", "--insecure",
    ];
    B.contains(&f) || f.starts_with("--enable-") || f.starts_with("--disable-") || f.starts_with("--no-")
}

fn resource_alias(r: &str) -> String {
    let base = match r {
        "deploy" | "deployments" | "deployment" => "deployment",
        "svc" | "services" | "service" => "service",
        "po" | "pods" | "pod" => "pod",
        "ns" | "namespaces" | "namespace" => "namespace",
        "cm" | "configmaps" | "configmap" => "configmap",
        "rs" | "replicasets" | "replicaset" => "replicaset",
        "hpa" | "horizontalpodautoscalers" | "horizontalpodautoscaler" => "horizontalpodautoscaler",
        "netpol" | "networkpolicies" | "networkpolicy" => "networkpolicy",
        "sa" | "serviceaccounts" | "serviceaccount" => "serviceaccount",
        "ing" | "ingresses" | "ingress" => "ingress",
        "pvc" | "persistentvolumeclaims" | "persistentvolumeclaim" => "persistentvolumeclaim",
        "no" | "nodes" | "node" => "node",
        "secrets" | "secret" => "secret",
        "ep" | "endpoints" => "endpoints",
        "ds" | "daemonsets" | "daemonset" => "daemonset",
        "sts" | "statefulsets" | "statefulset" => "statefulset",
        other => other,
    };
    base.to_string()
}

pub fn parse(s: &str) -> Parsed {
    let toks = tokenize(s);
    let program = toks.first().cloned().unwrap_or_default();
    let mut positional = vec![];
    let mut flags = BTreeMap::new();
    let mut i = 1;
    let sub = toks.get(1).cloned().unwrap_or_default();
    while i < toks.len() {
        let t = &toks[i];
        if t.starts_with('-') && t.len() > 1 {
            let (name, inline) = match t.split_once('=') {
                Some((n, v)) => (n.to_string(), Some(v.to_string())),
                None => (t.clone(), None),
            };
            let name = short_flag(&program, &sub, &name);
            let value = if let Some(v) = inline {
                v
            } else if !is_bool_flag(&name)
                && i + 1 < toks.len()
                && !(toks[i + 1].starts_with('-') && toks[i + 1].len() > 1)
            {
                i += 1;
                toks[i].clone()
            } else {
                String::new()
            };
            flags.insert(name, value);
        } else if program == "kubectl" {
            // type/name → type name, and resource aliases
            if let Some((ty, name)) = t.split_once('/') {
                positional.push(resource_alias(ty));
                positional.push(name.to_string());
            } else {
                positional.push(resource_alias(t));
            }
        } else {
            positional.push(t.clone());
        }
        i += 1;
    }
    Parsed { program, positional, flags }
}

fn value_eq(a: &str, b: &str) -> bool {
    if a == b {
        return true;
    }
    // comma lists in any order
    if a.contains(',') || b.contains(',') {
        let sa: BTreeSet<_> = a.split(',').map(|x| x.trim()).collect();
        let sb: BTreeSet<_> = b.split(',').map(|x| x.trim()).collect();
        return sa == sb;
    }
    false
}

/// Per-check extras the prose "Also accepted" line describes.
#[derive(Default)]
pub struct Extras {
    pub alternatives: Vec<String>,
    pub any_value: Vec<&'static str>,
    pub equivalent_flags: Vec<(&'static str, &'static str)>,
    pub extra_allowed: Vec<String>,
}

pub fn extras_for(canonical: &str, accept: &str) -> Extras {
    let mut e = Extras::default();
    // every flag the accept text names may be added
    for t in tokenize(&strip_tags(accept)) {
        let t = t.trim_matches(|c: char| c == ';' || c == ',' || c == '.' || c == '(' || c == ')');
        if t.starts_with('-') && t.len() > 1 {
            let p = parse(canonical);
            let name = t.split('=').next().unwrap_or(t);
            let sub = canonical.split_whitespace().nth(1).unwrap_or("");
            e.extra_allowed.push(short_flag(&p.program, sub, name));
        }
    }
    if canonical.starts_with("helm upgrade") {
        e.any_value.push("--timeout");
        e.equivalent_flags.push(("--atomic", "--rollback-on-failure"));
    }
    if canonical.starts_with("az account set") {
        e.any_value.push("--subscription");
    }
    if canonical.starts_with("docker push") {
        e.alternatives.push(canonical.replacen("docker", "podman", 1));
    }
    if canonical.starts_with("az role assignment create") {
        e.alternatives.push(
            "az role assignment create --assignee $SRE_GROUP_ID --role \"Azure Kubernetes Service RBAC Reader\" --scope $AKS_ID"
                .into(),
        );
    }
    e
}

pub fn strip_tags(s: &str) -> String {
    let re = regex::Regex::new(r"<[^>]+>").unwrap();
    re.replace_all(s, "").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
}

/// Returns Ok(()) or a hint describing the first difference.
pub fn compare(input: &str, canonical: &str, extras: &Extras) -> Result<(), String> {
    let mut first_err = None;
    for c in std::iter::once(canonical.to_string()).chain(extras.alternatives.iter().cloned()) {
        match compare_one(input, &c, extras) {
            Ok(()) => return Ok(()),
            Err(e) => {
                if first_err.is_none() {
                    first_err = Some(e)
                }
            }
        }
    }
    Err(first_err.unwrap_or_else(|| "Not quite.".into()))
}

fn compare_one(input: &str, canonical: &str, extras: &Extras) -> Result<(), String> {
    let a = parse(input);
    let b = parse(canonical);
    if a.program.is_empty() {
        return Err("Type a command.".into());
    }
    if a.program != b.program {
        return Err(format!("This task uses `{}`, not `{}`.", b.program, a.program));
    }
    // positional args: compare in order
    if a.positional != b.positional {
        let n = a.positional.len().max(b.positional.len());
        for i in 0..n {
            match (a.positional.get(i), b.positional.get(i)) {
                (Some(x), Some(y)) if x != y => {
                    return Err(format!("Check the argument `{x}`: that's not what this task needs."));
                }
                (None, Some(_)) => return Err("Something is missing: a subcommand, resource or name.".into()),
                (Some(x), None) => return Err(format!("`{x}` isn't needed here.")),
                _ => {}
            }
        }
    }
    let canon_flag = |f: &str| -> String {
        for (x, y) in &extras.equivalent_flags {
            if f == *y {
                return x.to_string();
            }
        }
        f.to_string()
    };
    let af: BTreeMap<String, String> = a.flags.iter().map(|(k, v)| (canon_flag(k), v.clone())).collect();
    let bf: BTreeMap<String, String> = b.flags.iter().map(|(k, v)| (canon_flag(k), v.clone())).collect();
    for (k, v) in &bf {
        match af.get(k) {
            None => return Err(format!("A required flag is missing ({}).", hint_flag(k))),
            Some(x) => {
                if !extras.any_value.contains(&k.as_str()) && !value_eq(x, v) {
                    return Err(format!("`{k}` has the wrong value."));
                }
            }
        }
    }
    for k in af.keys() {
        if !bf.contains_key(k) && !extras.extra_allowed.iter().any(|x| canon_flag(x) == *k) {
            return Err(format!("`{k}` isn't needed for this task."));
        }
    }
    Ok(())
}

fn hint_flag(k: &str) -> String {
    let mut s: String = k.chars().take(4).collect();
    s.push('…');
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ok(input: &str, canon: &str, accept: &str) -> bool {
        compare(input, canon, &extras_for(canon, accept)).is_ok()
    }
    #[test]
    fn kubectl_forms() {
        let c = "kubectl rollout undo deployment/orders-api -n orders";
        let a = "Also accepted: deployment orders-api or deploy/orders-api; --namespace orders; --to-revision=1.";
        assert!(ok("kubectl rollout undo deploy orders-api --namespace=orders", c, a));
        assert!(ok("kubectl rollout undo deploy/orders-api -n orders --to-revision 1", c, a));
        assert!(!ok("kubectl rollout undo deploy/orders-api", c, a));
        assert!(!ok("kubectl rollout restart deploy/orders-api -n orders", c, a));
    }
    #[test]
    fn az_forms() {
        let c = "az group show --name rg-orders-dev --query id -o tsv";
        assert!(ok("az group show -o tsv -n rg-orders-dev --query id", c, ""));
        assert!(ok("az group show --output=tsv --name rg-orders-dev --query 'id'", c, ""));
    }
    #[test]
    fn helm_forms() {
        let c = "helm upgrade --install orders-api charts/orders-api -n orders -f values-prod.yaml --atomic --wait --timeout 5m";
        let a = "Also accepted: --rollback-on-failure instead of --atomic; --namespace; --values; any timeout; --create-namespace";
        assert!(ok("helm upgrade orders-api charts/orders-api --install --namespace orders --values values-prod.yaml --rollback-on-failure --wait --timeout 10m --create-namespace", c, a));
        assert!(!ok("helm upgrade --install orders-api charts/orders-api -n orders -f values-prod.yaml --wait --timeout 5m", c, a));
    }
    #[test]
    fn ranges_any_order() {
        let c = "az aks update -g rg-orders-dev -n aks-orders-dev --api-server-authorized-ip-ranges 203.0.113.0/24,198.51.100.7/32";
        assert!(ok("az aks update --resource-group rg-orders-dev --name aks-orders-dev --api-server-authorized-ip-ranges 198.51.100.7/32,203.0.113.0/24", c, ""));
    }
}
