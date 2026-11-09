//! netpol-eval: computes which pod-to-pod flows a set of NetworkPolicies
//! allows, following Kubernetes semantics (isolation per direction,
//! additive rules, peers by pod and namespace selectors, ports).

use super::yamlx::{as_f64, as_text, str_map, Doc};
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Deserialize, Clone, Debug)]
pub struct PodFixture {
    pub name: String,
    pub ns: String,
    #[serde(default)]
    pub labels: BTreeMap<String, String>,
    #[serde(default)]
    pub ports: Vec<u16>,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct Fixture {
    #[serde(default)]
    pub pods: Vec<PodFixture>,
    /// Allowed flows as "from -> to:port".
    #[serde(default)]
    pub expect: Vec<String>,
    /// Extra namespace labels (besides kubernetes.io/metadata.name).
    #[serde(default)]
    pub namespace_labels: BTreeMap<String, BTreeMap<String, String>>,
    /// Policies that exist in the cluster already (not written by the learner).
    #[serde(default)]
    pub given: String,
}

#[derive(Debug, Clone)]
pub struct Flow {
    pub from: String,
    pub to: String,
    pub port: u16,
    pub egress: bool,
    pub ingress: bool,
}

impl Flow {
    pub fn allowed(&self) -> bool {
        self.egress && self.ingress
    }
    pub fn key(&self) -> String {
        format!("{} -> {}:{}", self.from, self.to, self.port)
    }
}

fn selector_matches(sel: Option<&Value>, labels: &BTreeMap<String, String>) -> bool {
    let Some(sel) = sel else { return true };
    if sel.is_null() {
        return true;
    }
    for (k, v) in str_map(sel.get("matchLabels")) {
        if labels.get(&k) != Some(&v) {
            return false;
        }
    }
    if let Some(exprs) = sel.get("matchExpressions").and_then(|v| v.as_array()) {
        for e in exprs {
            let key = e.get("key").map(as_text).unwrap_or_default();
            let op = e.get("operator").map(as_text).unwrap_or_default();
            let vals: Vec<String> = e
                .get("values")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().map(as_text).collect())
                .unwrap_or_default();
            let have = labels.get(&key);
            let ok = match op.as_str() {
                "In" => have.map(|h| vals.contains(h)).unwrap_or(false),
                "NotIn" => have.map(|h| !vals.contains(h)).unwrap_or(true),
                "Exists" => have.is_some(),
                "DoesNotExist" => have.is_none(),
                _ => false,
            };
            if !ok {
                return false;
            }
        }
    }
    true
}

struct Policy<'a> {
    ns: String,
    v: &'a Value,
}

impl Policy<'_> {
    fn types(&self) -> (bool, bool) {
        if let Some(t) = self.v.pointer("/spec/policyTypes").and_then(|v| v.as_array()) {
            let t: Vec<String> = t.iter().map(as_text).collect();
            (t.iter().any(|x| x == "Ingress"), t.iter().any(|x| x == "Egress"))
        } else {
            (true, self.v.pointer("/spec/egress").is_some())
        }
    }
    fn selects(&self, p: &PodFixture) -> bool {
        p.ns == self.ns && selector_matches(self.v.pointer("/spec/podSelector"), &p.labels)
    }
}

pub struct Eval {
    pub pods: Vec<PodFixture>,
    ns_labels: BTreeMap<String, BTreeMap<String, String>>,
}

impl Eval {
    pub fn new(f: &Fixture) -> Self {
        let mut ns_labels: BTreeMap<String, BTreeMap<String, String>> = BTreeMap::new();
        for p in &f.pods {
            let e = ns_labels.entry(p.ns.clone()).or_default();
            e.insert("kubernetes.io/metadata.name".into(), p.ns.clone());
        }
        for (ns, l) in &f.namespace_labels {
            ns_labels.entry(ns.clone()).or_default().extend(l.clone());
        }
        Eval { pods: f.pods.clone(), ns_labels }
    }

    fn peer_matches(&self, peer: &Value, policy_ns: &str, p: &PodFixture) -> bool {
        let pod_sel = peer.get("podSelector");
        let ns_sel = peer.get("namespaceSelector");
        if pod_sel.is_none() && ns_sel.is_none() {
            return false; // ipBlock only: never a pod in our model
        }
        let ns_ok = match ns_sel {
            Some(s) => selector_matches(Some(s), self.ns_labels.get(&p.ns).unwrap_or(&BTreeMap::new())),
            None => p.ns == policy_ns,
        };
        ns_ok && selector_matches(pod_sel, &p.labels)
    }

    fn port_matches(rule: &Value, port: u16, proto: &str) -> bool {
        let Some(ports) = rule.get("ports").and_then(|v| v.as_array()) else { return true };
        if ports.is_empty() {
            return true;
        }
        ports.iter().any(|pp| {
            let pr = pp.get("protocol").map(as_text).unwrap_or_else(|| "TCP".into());
            if pr != proto {
                return false;
            }
            match pp.get("port") {
                None => true,
                Some(v) => {
                    if let Some(n) = as_f64(v) {
                        let end = pp.get("endPort").and_then(as_f64).unwrap_or(n);
                        (port as f64) >= n && (port as f64) <= end
                    } else {
                        // named ports: http → 8080, dns → 53, postgres → 5432
                        matches!(
                            (as_text(v).as_str(), port),
                            ("http", 8080) | ("dns", 53) | ("dns-tcp", 53) | ("postgres", 5432)
                        )
                    }
                }
            }
        })
    }

    fn direction_allows(
        &self,
        policies: &[Policy],
        subject: &PodFixture,
        other: &PodFixture,
        port: u16,
        proto: &str,
        ingress: bool,
    ) -> bool {
        let (rules_key, peers_key) = if ingress { ("ingress", "from") } else { ("egress", "to") };
        let selecting: Vec<&Policy> = policies
            .iter()
            .filter(|p| p.selects(subject) && if ingress { p.types().0 } else { p.types().1 })
            .collect();
        if selecting.is_empty() {
            return true;
        }
        selecting.iter().any(|pol| {
            pol.v
                .pointer(&format!("/spec/{rules_key}"))
                .and_then(|v| v.as_array())
                .map(|rules| {
                    rules.iter().any(|r| {
                        let peers_ok = match r.get(peers_key).and_then(|v| v.as_array()) {
                            None => true,
                            Some(a) if a.is_empty() => true,
                            Some(a) => a.iter().any(|peer| self.peer_matches(peer, &pol.ns, other)),
                        };
                        peers_ok && Self::port_matches(r, port, proto)
                    })
                })
                .unwrap_or(false)
        })
    }

    pub fn flows(&self, docs: &[Doc]) -> Vec<Flow> {
        let policies: Vec<Policy> = docs
            .iter()
            .filter(|d| d.kind() == "NetworkPolicy")
            .map(|d| Policy {
                ns: if d.namespace().is_empty() { "default".into() } else { d.namespace().into() },
                v: &d.value,
            })
            .collect();
        let mut out = vec![];
        for src in &self.pods {
            for dst in &self.pods {
                if src.name == dst.name {
                    continue;
                }
                for &port in &dst.ports {
                    let protos: &[&str] = if port == 53 { &["UDP", "TCP"] } else { &["TCP"] };
                    let eg = protos.iter().all(|pr| self.direction_allows(&policies, src, dst, port, pr, false));
                    let ing = protos.iter().all(|pr| self.direction_allows(&policies, dst, src, port, pr, true));
                    out.push(Flow { from: src.name.clone(), to: dst.name.clone(), port, egress: eg, ingress: ing });
                }
            }
        }
        out
    }
}

/// Parses "a,b -> c:80" style expectations into flow keys.
pub fn expected_keys(f: &Fixture) -> Vec<String> {
    let mut keys = vec![];
    for e in &f.expect {
        let Some((from, to)) = e.split_once("->") else { continue };
        let (to, port) = to.trim().rsplit_once(':').unwrap_or((to.trim(), ""));
        let froms: Vec<String> = if from.trim() == "*" {
            f.pods.iter().map(|p| p.name.clone()).collect()
        } else {
            from.split(',').map(|s| s.trim().to_string()).collect()
        };
        for fr in froms {
            for t in to.split(',') {
                if fr != t.trim() {
                    keys.push(format!("{} -> {}:{}", fr, t.trim(), port.trim()));
                }
            }
        }
    }
    keys
}

pub fn has_allow_all(docs: &[Doc]) -> Option<String> {
    for d in docs.iter().filter(|d| d.kind() == "NetworkPolicy") {
        for (dir, peers) in [("ingress", "from"), ("egress", "to")] {
            if let Some(rules) = d.value.pointer(&format!("/spec/{dir}")).and_then(|v| v.as_array()) {
                for r in rules {
                    let no_peers = r.get(peers).and_then(|v| v.as_array()).map(|a| a.is_empty()).unwrap_or(true);
                    let no_ports = r.get("ports").and_then(|v| v.as_array()).map(|a| a.is_empty()).unwrap_or(true);
                    if no_peers && no_ports {
                        return Some(format!("{}: an empty {dir} rule allows everything", d.name()));
                    }
                }
            }
        }
    }
    None
}

/// Every namespace must have default-deny for both directions.
pub fn default_deny_missing(docs: &[Doc], namespaces: &[String]) -> Vec<String> {
    let mut missing = vec![];
    for ns in namespaces {
        let mut ing = false;
        let mut eg = false;
        for d in docs.iter().filter(|d| d.kind() == "NetworkPolicy" && d.namespace() == ns) {
            let sel = d.value.pointer("/spec/podSelector");
            let empty_sel = sel
                .map(|s| s.is_null() || s.as_object().map(|o| o.values().all(|v| v.as_object().map(|x| x.is_empty()).unwrap_or(v.is_null()))).unwrap_or(false))
                .unwrap_or(true);
            if !empty_sel {
                continue;
            }
            let p = Policy { ns: ns.clone(), v: &d.value };
            let (ti, te) = p.types();
            let no_rules = |k: &str| d.value.pointer(&format!("/spec/{k}")).and_then(|v| v.as_array()).map(|a| a.is_empty()).unwrap_or(true);
            if ti && no_rules("ingress") {
                ing = true;
            }
            if te && no_rules("egress") {
                eg = true;
            }
        }
        if !ing || !eg {
            missing.push(ns.clone());
        }
    }
    missing
}
