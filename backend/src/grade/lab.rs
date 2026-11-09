//! Lab grading. Each lab has a rule file in `labs/` (YAML). Rule `i` in the
//! file grades rule `i` of the lab's prose list in the course content.
//!
//! A rule is one *test*:
//!   re / not_re          regex over the file text (Rust regex syntax)
//!   before: [a, b]       regex a matches earlier than regex b
//!   parses: true         the YAML parses (optionally `require: [Kind…]`)
//!   path + op [+ value]  values at a path in docs of `kind` (see yamlx)
//!   each + path + op     the path, evaluated under every item of `each`
//!   fn + args            a built-in cross-file check
//!   all / any / not      combinators
//! Meta keys: text, critical, file, group, hint.

use super::netpol::{self, Fixture};
use super::rbac;
use super::yamlx::{self, as_f64, as_text, Doc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Deserialize, Clone, Debug, Default)]
pub struct RbacFixture {
    pub subject: BTreeMap<String, String>,
    #[serde(default)]
    pub cases: Vec<RbacCase>,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct RbacCase {
    pub case: String,
    pub allow: bool,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct LabSpec {
    pub lab: String,
    #[serde(default)]
    pub start: Option<String>,
    #[serde(default)]
    pub solution: Option<String>,
    #[serde(default)]
    pub files: Vec<crate::content::LabFile>,
    #[serde(default)]
    pub fixture: Option<Fixture>,
    #[serde(default)]
    pub rbac: Option<RbacFixture>,
    #[serde(default)]
    pub weights: BTreeMap<String, f64>,
    /// Given context the learner doesn't write (e.g. a base for overlays).
    #[serde(default)]
    pub context: String,
    #[serde(default)]
    pub rules: Vec<Value>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RuleResult {
    pub index: usize,
    pub html: String,
    pub critical: bool,
    pub pass: bool,
    pub message: Option<String>,
    pub group: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LabResult {
    pub score: u32,
    pub passed: bool,
    pub critical_failed: bool,
    pub rules: Vec<RuleResult>,
    pub parse_error: Option<String>,
    pub groups: Vec<GroupScore>,
}

#[derive(Serialize, Debug, Clone)]
pub struct GroupScore {
    pub group: String,
    pub weight: f64,
    pub score: u32,
}

struct Ctx<'a> {
    files: &'a [(String, String)],
    spec: &'a LabSpec,
}

fn glob_match(pattern: &str, name: &str) -> bool {
    let re = format!(
        "^{}$",
        regex::escape(pattern).replace(r"\*", "[^/]*").replace(r"\{", "(").replace(r"\}", ")").replace(',', "|")
    );
    Regex::new(&re).map(|r| r.is_match(name)).unwrap_or(false)
}

impl Ctx<'_> {
    fn text(&self, file: Option<&str>) -> String {
        self.files
            .iter()
            .filter(|(n, _)| file.map(|f| f.split('|').any(|p| glob_match(p, n))).unwrap_or(true))
            .map(|(_, t)| t.as_str())
            .collect::<Vec<_>>()
            .join("\n---\n")
    }
    fn docs(&self, file: Option<&str>) -> Result<Vec<Doc>, String> {
        let mut t = self.text(file);
        // Lines starting with a comment-only file marker are fine for YAML.
        if !self.spec.context.is_empty() && file.is_none() {
            t = format!("{}\n---\n{}", t, self.spec.context);
        }
        yamlx::parse_docs(&t)
    }
}

type Outcome = Result<(), String>;

fn re(p: &str) -> Result<Regex, String> {
    Regex::new(&format!("(?m){p}")).map_err(|e| format!("bad rule regex: {e}"))
}

fn eval(test: &Value, ctx: &Ctx, file: Option<&str>) -> Outcome {
    let file = test.get("file").and_then(|v| v.as_str()).or(file);
    if let Some(a) = test.get("all").and_then(|v| v.as_array()) {
        for t in a {
            eval(t, ctx, file)?;
        }
        return Ok(());
    }
    if let Some(a) = test.get("any").and_then(|v| v.as_array()) {
        let mut first = None;
        for t in a {
            match eval(t, ctx, file) {
                Ok(()) => return Ok(()),
                Err(e) => {
                    if first.is_none() {
                        first = Some(e)
                    }
                }
            }
        }
        return Err(first.unwrap_or_default());
    }
    if let Some(t) = test.get("not") {
        return match eval(t, ctx, file) {
            Ok(()) => Err(msg(test, "This shouldn't be there.")),
            Err(_) => Ok(()),
        };
    }
    if let Some(p) = test.get("re").and_then(|v| v.as_str()) {
        let text = ctx.text(file);
        return if re(p)?.is_match(&text) { Ok(()) } else { Err(msg(test, "Not found yet.")) };
    }
    if let Some(p) = test.get("not_re").and_then(|v| v.as_str()) {
        let text = ctx.text(file);
        return match re(p)?.find(&text) {
            None => Ok(()),
            Some(m) => {
                let line = text[..m.start()].lines().count().max(1);
                Err(msg(test, &format!("Found on line {line}: `{}`", m.as_str().trim())))
            }
        };
    }
    if let Some(a) = test.get("before").and_then(|v| v.as_array()) {
        let text = ctx.text(file);
        let a0 = re(a.first().and_then(|v| v.as_str()).unwrap_or(""))?.find(&text);
        let a1 = re(a.get(1).and_then(|v| v.as_str()).unwrap_or(""))?.find(&text);
        return match (a0, a1) {
            (Some(x), Some(y)) if x.start() < y.start() => Ok(()),
            (Some(_), Some(_)) => Err(msg(test, "These are in the wrong order.")),
            _ => Err(msg(test, "A required step is missing.")),
        };
    }
    if test.get("parses").is_some() {
        let docs = ctx.docs(file)?;
        if docs.is_empty() {
            return Err("Nothing to grade yet.".into());
        }
        for d in &docs {
            if d.value.get("apiVersion").is_none() && d.value.get("kind").is_some() {
                return Err(format!("{} is missing apiVersion.", d.kind()));
            }
        }
        if let Some(req) = test.get("require").and_then(|v| v.as_array()) {
            for k in req {
                let k = as_text(k);
                if !docs.iter().any(|d| d.kind() == k) {
                    return Err(format!("No {k} found."));
                }
            }
        }
        for d in &docs {
            if let Some(want) = api_version_for(d.kind()) {
                let got = d.value.get("apiVersion").map(as_text).unwrap_or_default();
                if !want.contains(&got.as_str()) {
                    return Err(format!("{} uses apiVersion {got}; expected {}.", d.kind(), want[0]));
                }
            }
        }
        return Ok(());
    }
    if let Some(name) = test.get("fn").and_then(|v| v.as_str()) {
        let args = test.get("args").cloned().unwrap_or(Value::Null);
        return builtin(name, &args, ctx, file).map_err(|e| msg_or(test, e));
    }
    if test.get("path").is_some() {
        return path_test(test, ctx, file);
    }
    Err("rule has no test".into())
}

fn msg(test: &Value, default: &str) -> String {
    test.get("hint").and_then(|v| v.as_str()).unwrap_or(default).to_string()
}

fn msg_or(test: &Value, e: String) -> String {
    match test.get("hint").and_then(|v| v.as_str()) {
        Some(h) => format!("{h} ({e})"),
        None => e,
    }
}

fn api_version_for(kind: &str) -> Option<&'static [&'static str]> {
    Some(match kind {
        "Deployment" | "StatefulSet" | "DaemonSet" | "ReplicaSet" => &["apps/v1"],
        "Service" | "ConfigMap" | "Secret" | "Pod" | "ServiceAccount" | "Namespace" => &["v1"],
        "HorizontalPodAutoscaler" => &["autoscaling/v2"],
        "PodDisruptionBudget" => &["policy/v1"],
        "NetworkPolicy" | "Ingress" => &["networking.k8s.io/v1"],
        "Role" | "RoleBinding" | "ClusterRole" | "ClusterRoleBinding" => &["rbac.authorization.k8s.io/v1"],
        "Gateway" | "HTTPRoute" | "GatewayClass" => &["gateway.networking.k8s.io/v1"],
        "SecretProviderClass" => &["secrets-store.csi.x-k8s.io/v1"],
        "Kustomization" => &["kustomize.config.k8s.io/v1beta1"],
        _ => return None,
    })
}

fn compare(op: &str, got: Option<&Value>, want: &Value) -> bool {
    match op {
        "exists" => got.map(|v| !v.is_null()).unwrap_or(false),
        "absent" => got.map(|v| v.is_null()).unwrap_or(true),
        "eq" => got.map(|g| as_text(g) == as_text(want)).unwrap_or(false),
        "ne" => got.map(|g| as_text(g) != as_text(want)).unwrap_or(true),
        "gte" => got.and_then(as_f64).zip(as_f64(want)).map(|(a, b)| a >= b).unwrap_or(false),
        "lte" => got.and_then(as_f64).zip(as_f64(want)).map(|(a, b)| a <= b).unwrap_or(false),
        "in" => got
            .map(|g| want.as_array().map(|a| a.iter().any(|w| as_text(w) == as_text(g))).unwrap_or(false))
            .unwrap_or(false),
        "re" => got
            .map(|g| Regex::new(&as_text(want)).map(|r| r.is_match(&as_text(g))).unwrap_or(false))
            .unwrap_or(false),
        "not_re" => got
            .map(|g| !Regex::new(&as_text(want)).map(|r| r.is_match(&g.to_string())).unwrap_or(false))
            .unwrap_or(true),
        "contains" => got
            .map(|g| match g {
                Value::Array(a) => a.iter().any(|x| as_text(x) == as_text(want)),
                other => as_text(other).contains(&as_text(want)),
            })
            .unwrap_or(false),
        _ => false,
    }
}

fn path_test(test: &Value, ctx: &Ctx, file: Option<&str>) -> Outcome {
    let docs = ctx.docs(file)?;
    let kind = test.get("kind").and_then(|v| v.as_str());
    let path = test.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let op = test.get("op").and_then(|v| v.as_str()).unwrap_or("exists");
    let want = test.get("value").cloned().unwrap_or(Value::Null);
    let any = test.get("any").and_then(|v| v.as_bool()).unwrap_or(false);
    let each = test.get("each").and_then(|v| v.as_str());
    let selected: Vec<&Doc> = docs.iter().filter(|d| kind.map(|k| d.kind() == k).unwrap_or(true)).collect();
    if selected.is_empty() {
        return Err(msg(test, &format!("No {} found.", kind.unwrap_or("document"))));
    }
    let mut subjects: Vec<&Value> = vec![];
    for d in &selected {
        match each {
            Some(e) => subjects.extend(yamlx::query(&d.value, e)),
            None => subjects.push(&d.value),
        }
    }
    if subjects.is_empty() {
        return Err(msg(test, "Nothing to check yet."));
    }
    let mut results = vec![];
    for s in subjects {
        let found = yamlx::query(s, path);
        let ok = if found.is_empty() {
            compare(op, None, &want)
        } else if op == "absent" {
            found.iter().all(|v| v.is_null())
        } else {
            found.iter().any(|v| compare(op, Some(v), &want))
        };
        results.push(ok);
    }
    let ok = if any { results.iter().any(|x| *x) } else { results.iter().all(|x| *x) };
    if ok {
        Ok(())
    } else {
        Err(msg(test, &format!("`{path}` doesn't meet the rule.")))
    }
}

fn subset(sel: &BTreeMap<String, String>, labels: &BTreeMap<String, String>) -> bool {
    !sel.is_empty() && sel.iter().all(|(k, v)| labels.get(k) == Some(v))
}

fn image_pinned(img: &str) -> bool {
    if img.contains("@sha256:") {
        return true;
    }
    let last = img.rsplit('/').next().unwrap_or(img);
    match last.split_once(':') {
        Some((_, tag)) => !tag.is_empty() && tag != "latest",
        None => false,
    }
}

fn secretish(s: &str) -> bool {
    let r = Regex::new(r"(?i)(password|passwd|secret|token|apikey|api_key|private_key|connectionstring|Password=|AccountKey=)").unwrap();
    r.is_match(s)
}

fn builtin(name: &str, args: &Value, ctx: &Ctx, file: Option<&str>) -> Outcome {
    let docs = || ctx.docs(file);
    match name {
        "deploy_selector_matches" => {
            for d in docs()?.iter().filter(|d| d.kind() == "Deployment") {
                let sel = yamlx::str_map(d.value.pointer("/spec/selector/matchLabels"));
                if !subset(&sel, &yamlx::pod_labels(d)) {
                    return Err(format!("{}: selector.matchLabels doesn't match the template labels.", d.name()));
                }
            }
            Ok(())
        }
        "service_selects_pods" => {
            let ds = docs()?;
            let svcs: Vec<_> = ds.iter().filter(|d| d.kind() == "Service").collect();
            if svcs.is_empty() {
                return Err("No Service found.".into());
            }
            for s in svcs {
                let sel = yamlx::str_map(s.value.pointer("/spec/selector"));
                let ok = ds.iter().filter(|d| yamlx::is_workload(d)).any(|w| {
                    subset(&sel, &yamlx::pod_labels(w)) && (s.namespace() == w.namespace() || s.namespace().is_empty() || w.namespace().is_empty())
                });
                if !ok {
                    return Err(format!("Service {} selects no pods: {:?}", s.name(), sel));
                }
            }
            Ok(())
        }
        "service_target_port" => {
            let ds = docs()?;
            for s in ds.iter().filter(|d| d.kind() == "Service") {
                let sel = yamlx::str_map(s.value.pointer("/spec/selector"));
                let pods: Vec<_> = ds.iter().filter(|d| yamlx::is_workload(d) && subset(&sel, &yamlx::pod_labels(d))).collect();
                let mut names = vec![];
                let mut nums = vec![];
                for p in &pods {
                    for c in yamlx::containers(p) {
                        for port in yamlx::query(c, "ports[*]") {
                            if let Some(n) = port.get("name") {
                                names.push(as_text(n));
                            }
                            if let Some(n) = port.get("containerPort") {
                                nums.push(as_text(n));
                            }
                        }
                    }
                }
                if pods.is_empty() {
                    return Err(format!("Service {} selects no pods, so its targetPort can't be checked.", s.name()));
                }
                for p in yamlx::query(&s.value, "spec.ports[*]") {
                    let tp = p.get("targetPort").or(p.get("port")).map(as_text).unwrap_or_default();
                    if !names.contains(&tp) && !nums.contains(&tp) {
                        return Err(format!("targetPort {tp} matches no containerPort ({}).", nums.join(", ")));
                    }
                }
            }
            Ok(())
        }
        "configmap_refs_exist" => {
            let ds = docs()?;
            let cms: Vec<_> = ds.iter().filter(|d| d.kind() == "ConfigMap").collect();
            for w in ds.iter().filter(|d| yamlx::is_workload(d)) {
                for c in yamlx::containers(w) {
                    for r in yamlx::query(c, "env[*].valueFrom.configMapKeyRef") {
                        let n = r.get("name").map(as_text).unwrap_or_default();
                        let k = r.get("key").map(as_text).unwrap_or_default();
                        let ok = cms.iter().any(|cm| cm.name() == n && cm.value.pointer("/data").and_then(|d| d.get(&k)).is_some());
                        if !ok {
                            return Err(format!("configMapKeyRef {n}/{k} doesn't exist."));
                        }
                    }
                }
            }
            Ok(())
        }
        "images_pinned" => {
            let ds = docs()?;
            let mut n = 0;
            for w in ds.iter().filter(|d| yamlx::is_workload(d)) {
                for c in yamlx::containers(w) {
                    let img = c.get("image").map(as_text).unwrap_or_default();
                    n += 1;
                    if !image_pinned(&img) {
                        return Err(format!("Image `{img}` isn't pinned to a version or digest."));
                    }
                }
            }
            if n == 0 {
                return Err("No containers found.".into());
            }
            Ok(())
        }
        "no_secrets_in_configmaps" => {
            for cm in docs()?.iter().filter(|d| d.kind() == "ConfigMap") {
                if let Some(o) = cm.value.get("data").and_then(|v| v.as_object()) {
                    for (k, v) in o {
                        if secretish(k) || secretish(&as_text(v)) {
                            return Err(format!("ConfigMap {} key `{k}` looks like a credential.", cm.name()));
                        }
                    }
                }
            }
            Ok(())
        }
        "no_secret_objects_with_data" => {
            for s in docs()?.iter().filter(|d| d.kind() == "Secret") {
                if s.value.get("data").is_some() || s.value.get("stringData").is_some() {
                    return Err(format!("Secret {} holds values in the repo.", s.name()));
                }
            }
            Ok(())
        }
        "pdb_matches" => {
            let ds = docs()?;
            let pdb = ds.iter().find(|d| d.kind() == "PodDisruptionBudget").ok_or("No PodDisruptionBudget.")?;
            let sel = yamlx::str_map(pdb.value.pointer("/spec/selector/matchLabels"));
            let dep = ds.iter().find(|d| d.kind() == "Deployment").ok_or("No Deployment.")?;
            if !subset(&sel, &yamlx::pod_labels(dep)) {
                return Err("The PDB's selector doesn't match the Deployment's pods.".into());
            }
            let min_rep = ds
                .iter()
                .find(|d| d.kind() == "HorizontalPodAutoscaler")
                .and_then(|h| h.value.pointer("/spec/minReplicas").and_then(as_f64))
                .or_else(|| dep.value.pointer("/spec/replicas").and_then(as_f64))
                .unwrap_or(1.0);
            if let Some(mu) = pdb.value.pointer("/spec/maxUnavailable") {
                let s = as_text(mu);
                if s == "0" || s == "0%" {
                    return Err("maxUnavailable 0 blocks every voluntary disruption.".into());
                }
                return Ok(());
            }
            if let Some(ma) = pdb.value.pointer("/spec/minAvailable") {
                let s = as_text(ma);
                if s.ends_with('%') {
                    return if s == "100%" { Err("minAvailable 100% blocks every disruption.".into()) } else { Ok(()) };
                }
                if as_f64(ma).unwrap_or(0.0) >= min_rep {
                    return Err("minAvailable is not below the minimum replica count, so nothing can be evicted.".into());
                }
            }
            Ok(())
        }
        "replicas_within_hpa" => {
            let ds = docs()?;
            let max = ds
                .iter()
                .find(|d| d.kind() == "HorizontalPodAutoscaler")
                .and_then(|h| h.value.pointer("/spec/maxReplicas").and_then(as_f64));
            for d in ds.iter().filter(|d| d.kind() == "Deployment") {
                if let (Some(r), Some(m)) = (d.value.pointer("/spec/replicas").and_then(as_f64), max) {
                    if r > m {
                        return Err(format!("replicas {r} is above the HPA max {m}."));
                    }
                }
            }
            Ok(())
        }
        "restricted_pss" => {
            let ds = docs()?;
            let mut any = false;
            for w in ds.iter().filter(|d| yamlx::is_workload(d)) {
                any = true;
                let ps = yamlx::pod_spec(w).cloned().unwrap_or(Value::Null);
                for k in ["hostNetwork", "hostPID", "hostIPC"] {
                    if ps.get(k).and_then(|v| v.as_bool()) == Some(true) {
                        return Err(format!("{k} isn't allowed."));
                    }
                }
                if !yamlx::query(&ps, "volumes[*].hostPath").is_empty() {
                    return Err("hostPath volumes aren't allowed.".into());
                }
                let pod_nonroot = ps.pointer("/securityContext/runAsNonRoot").and_then(|v| v.as_bool()) == Some(true);
                let pod_seccomp = ps.pointer("/securityContext/seccompProfile/type").map(as_text);
                for c in yamlx::containers(w) {
                    let sc = c.get("securityContext").cloned().unwrap_or(Value::Null);
                    let cname = c.get("name").map(as_text).unwrap_or_default();
                    if sc.get("privileged").and_then(|v| v.as_bool()) == Some(true) {
                        return Err(format!("{cname}: privileged."));
                    }
                    if sc.get("allowPrivilegeEscalation").and_then(|v| v.as_bool()) != Some(false) {
                        return Err(format!("{cname}: allowPrivilegeEscalation must be false."));
                    }
                    let nonroot = sc.get("runAsNonRoot").and_then(|v| v.as_bool()).map(|b| b).unwrap_or(pod_nonroot);
                    if !nonroot {
                        return Err(format!("{cname}: runAsNonRoot must be true."));
                    }
                    let drops: Vec<String> = yamlx::query(&sc, "capabilities.drop[*]").into_iter().map(as_text).collect();
                    if !drops.iter().any(|d| d == "ALL") {
                        return Err(format!("{cname}: capabilities must drop ALL."));
                    }
                    let sec = sc.pointer("/seccompProfile/type").map(as_text).or(pod_seccomp.clone());
                    if !matches!(sec.as_deref(), Some("RuntimeDefault") | Some("Localhost")) {
                        return Err(format!("{cname}: seccompProfile must be RuntimeDefault."));
                    }
                }
            }
            if !any {
                return Err("No workload found.".into());
            }
            Ok(())
        }
        "sa_reference" => {
            let ds = docs()?;
            let sas: Vec<_> = ds.iter().filter(|d| d.kind() == "ServiceAccount").map(|d| d.name().to_string()).collect();
            for w in ds.iter().filter(|d| yamlx::is_workload(d)) {
                let n = yamlx::pod_spec(w).and_then(|p| p.get("serviceAccountName")).map(as_text).unwrap_or_default();
                if !sas.contains(&n) {
                    return Err(format!("serviceAccountName `{n}` doesn't match a ServiceAccount here."));
                }
            }
            Ok(())
        }
        "spc_matches" => {
            let ds = docs()?;
            let spc = ds.iter().find(|d| d.kind() == "SecretProviderClass").ok_or("No SecretProviderClass.")?;
            let client = spc.value.pointer("/spec/parameters/clientID").map(as_text).unwrap_or_default();
            let sa_client = ds
                .iter()
                .filter(|d| d.kind() == "ServiceAccount")
                .filter_map(|d| d.value.pointer("/metadata/annotations").and_then(|a| a.get("azure.workload.identity/client-id")).map(as_text))
                .next();
            if let Some(sc) = sa_client {
                if !client.is_empty() && sc != client {
                    return Err("The SecretProviderClass clientID differs from the ServiceAccount's client-id.".into());
                }
            }
            let used = ds.iter().filter(|d| yamlx::is_workload(d)).any(|w| {
                yamlx::pod_spec(w)
                    .map(|p| yamlx::query(p, "volumes[*].csi.volumeAttributes.secretProviderClass"))
                    .unwrap_or_default()
                    .iter()
                    .any(|v| as_text(v) == spc.name())
                    && (w.namespace() == spc.namespace() || w.namespace().is_empty() || spc.namespace().is_empty())
            });
            if !used {
                return Err("No CSI volume references the SecretProviderClass by name.".into());
            }
            Ok(())
        }
        "gateway_parent_refs" => {
            let ds = docs()?;
            let gws: Vec<_> = ds.iter().filter(|d| d.kind() == "Gateway").collect();
            let routes: Vec<_> = ds.iter().filter(|d| d.kind() == "HTTPRoute").collect();
            if routes.is_empty() {
                return Err("No HTTPRoute found.".into());
            }
            for r in routes {
                for p in yamlx::query(&r.value, "spec.parentRefs[*]") {
                    let n = p.get("name").map(as_text).unwrap_or_default();
                    let ns = p.get("namespace").map(as_text).unwrap_or(r.namespace().to_string());
                    if !gws.iter().any(|g| g.name() == n && g.namespace() == ns) {
                        return Err(format!("{}: parentRef {ns}/{n} matches no Gateway.", r.name()));
                    }
                }
            }
            Ok(())
        }
        "route_backends_exist" => {
            let ds = docs()?;
            let svcs: Vec<_> = ds.iter().filter(|d| d.kind() == "Service").collect();
            let known: Vec<(String, String, String)> = args
                .get("services")
                .and_then(|v| v.as_array())
                .map(|a| {
                    a.iter()
                        .map(|s| {
                            let t = as_text(s);
                            let p: Vec<&str> = t.split(&['/', ':'][..]).collect();
                            (p[0].to_string(), p.get(1).unwrap_or(&"").to_string(), p.get(2).unwrap_or(&"").to_string())
                        })
                        .collect()
                })
                .unwrap_or_default();
            for r in ds.iter().filter(|d| d.kind() == "HTTPRoute") {
                for b in yamlx::query(&r.value, "spec.rules[*].backendRefs[*]") {
                    let n = b.get("name").map(as_text).unwrap_or_default();
                    let port = b.get("port").map(as_text).unwrap_or_default();
                    let ns = b.get("namespace").map(as_text).unwrap_or(r.namespace().to_string());
                    let in_docs = svcs.iter().any(|s| {
                        s.name() == n && s.namespace() == ns
                            && yamlx::query(&s.value, "spec.ports[*].port").iter().any(|p| as_text(p) == port)
                    });
                    let in_known = known.iter().any(|(kns, kn, kp)| *kns == ns && *kn == n && *kp == port);
                    if !in_docs && !in_known {
                        return Err(format!("{}: backend {ns}/{n}:{port} isn't an existing Service port.", r.name()));
                    }
                }
            }
            Ok(())
        }
        "route_hostnames" => {
            let ds = docs()?;
            let listener_hosts: Vec<String> = ds
                .iter()
                .filter(|d| d.kind() == "Gateway")
                .flat_map(|g| yamlx::query(&g.value, "spec.listeners[*].hostname").into_iter().map(as_text).collect::<Vec<_>>())
                .collect();
            for r in ds.iter().filter(|d| d.kind() == "HTTPRoute") {
                for h in yamlx::query(&r.value, "spec.hostnames[*]") {
                    let h = as_text(h);
                    let ok = listener_hosts.is_empty()
                        || listener_hosts.iter().any(|l| *l == h || (l.starts_with("*.") && h.ends_with(&l[1..])));
                    if !ok {
                        return Err(format!("{}: hostname {h} isn't served by any listener.", r.name()));
                    }
                }
            }
            Ok(())
        }
        "netpol" => netpol_builtin(args, ctx, &docs()?),
        "rbac_cases" => {
            let ds = docs()?;
            let fx = ctx.spec.rbac.clone().unwrap_or_default();
            let s = rbac::Subject {
                kind: fx.subject.get("kind").cloned().unwrap_or("ServiceAccount".into()),
                name: fx.subject.get("name").cloned().unwrap_or_default(),
                namespace: fx.subject.get("namespace").cloned().unwrap_or_default(),
            };
            let mut wrong = vec![];
            for c in &fx.cases {
                let got = rbac::can(&ds, &s, &c.case);
                if got != c.allow {
                    wrong.push(format!("{} → {} (expected {})", c.case, if got { "allow" } else { "deny" }, if c.allow { "allow" } else { "deny" }));
                }
            }
            if wrong.is_empty() { Ok(()) } else { Err(wrong.join("; ")) }
        }
        "rbac_no_wildcard" => {
            if rbac::has_wildcard(&docs()?) { Err("A rule uses `*`.".into()) } else { Ok(()) }
        }
        "rbac_no_cluster_binding" => {
            let fx = ctx.spec.rbac.clone().unwrap_or_default();
            let name = fx.subject.get("name").cloned().unwrap_or_default();
            for d in docs()?.iter().filter(|d| d.kind() == "ClusterRoleBinding") {
                if yamlx::query(&d.value, "subjects[*].name").iter().any(|n| as_text(n) == name) {
                    return Err(format!("ClusterRoleBinding {} grants {name} cluster-wide.", d.name()));
                }
            }
            Ok(())
        }
        "dockerfile_pinned" => {
            let text = ctx.text(file);
            let from = Regex::new(r"(?im)^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?").unwrap();
            let mut stages: Vec<String> = vec![];
            let mut n = 0;
            for c in from.captures_iter(&text) {
                let img = c[1].to_string();
                n += 1;
                if !(img == "scratch" || stages.iter().any(|s| s.eq_ignore_ascii_case(&img)) || image_pinned(&img)) {
                    return Err(format!("FROM {img} isn't pinned to a version or digest."));
                }
                if let Some(a) = c.get(2) {
                    stages.push(a.as_str().to_string());
                }
            }
            if n == 0 { Err("No FROM line.".into()) } else { Ok(()) }
        }
        "dockerfile_final_user" => {
            let text = ctx.text(file);
            let last_from = Regex::new(r"(?im)^FROM\s").unwrap().find_iter(&text).last().map(|m| m.start()).ok_or("No FROM line.")?;
            let user = Regex::new(r"(?im)^USER\s+(\S+)").unwrap();
            let u = user.captures_iter(&text[last_from..]).last().map(|c| c[1].to_string());
            match u {
                None => Err("The final stage has no USER, so it runs as root.".into()),
                Some(u) => {
                    let name = u.split(':').next().unwrap_or("");
                    if name == "root" || name == "0" { Err(format!("USER {u} is root.")) } else { Ok(()) }
                }
            }
        }
        "known_top_keys" => {
            let ds = docs()?;
            let allowed: Vec<String> = args
                .get("keys")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().map(as_text).collect())
                .unwrap_or_default();
            for d in &ds {
                if let Some(o) = d.value.as_object() {
                    for k in o.keys() {
                        if !allowed.contains(k) {
                            return Err(format!("Unknown top-level key `{k}`."));
                        }
                    }
                }
            }
            Ok(())
        }
        other => Err(format!("unknown check {other}")),
    }
}

fn netpol_builtin(args: &Value, ctx: &Ctx, docs: &[Doc]) -> Outcome {
    let fx = ctx.spec.fixture.clone().ok_or("lab has no fixture")?;
    let mode = args.get("mode").and_then(|v| v.as_str()).unwrap_or("matrix");
    let mut all_docs = yamlx::parse_docs(&fx.given).unwrap_or_default();
    let mut owned = yamlx::parse_docs(&ctx.text(None)).unwrap_or_default();
    all_docs.append(&mut owned);
    let docs_ref: &[Doc] = if fx.given.is_empty() { docs } else { &all_docs };
    match mode {
        "no_allow_all" => match netpol::has_allow_all(docs_ref) {
            Some(e) => Err(e),
            None => Ok(()),
        },
        "default_deny" => {
            let ns: Vec<String> = args
                .get("namespaces")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().map(as_text).collect())
                .unwrap_or_default();
            let missing = netpol::default_deny_missing(docs_ref, &ns);
            if missing.is_empty() { Ok(()) } else { Err(format!("No default-deny (Ingress + Egress) in: {}", missing.join(", "))) }
        }
        _ => {
            let ev = netpol::Eval::new(&fx);
            let flows = ev.flows(docs_ref);
            let expected = netpol::expected_keys(&fx);
            let to = args.get("to").and_then(|v| v.as_str());
            let port = args.get("port").and_then(|v| v.as_u64());
            let only_expected = args.get("expected_only").and_then(|v| v.as_bool()).unwrap_or(false);
            let mut diffs = vec![];
            for f in &flows {
                if to.map(|t| f.to != t).unwrap_or(false) || port.map(|p| f.port as u64 != p).unwrap_or(false) {
                    continue;
                }
                let want = expected.contains(&f.key());
                if only_expected && !want {
                    continue;
                }
                if f.allowed() != want {
                    let why = if want {
                        match (f.egress, f.ingress) {
                            (false, false) => "egress and ingress both block it",
                            (false, true) => "egress side missing",
                            (true, false) => "ingress side missing",
                            _ => "",
                        }
                    } else {
                        "should be denied"
                    };
                    diffs.push(format!("{} {} ({why})", f.key(), if f.allowed() { "✓" } else { "✗" }));
                }
            }
            if diffs.is_empty() {
                Ok(())
            } else {
                let more = if diffs.len() > 4 { format!(" … and {} more", diffs.len() - 4) } else { String::new() };
                Err(format!("{}{more}", diffs.into_iter().take(4).collect::<Vec<_>>().join("; ")))
            }
        }
    }
}

pub fn grade(spec: &LabSpec, rule_texts: &[crate::content::LabRuleText], files: &[(String, String)]) -> LabResult {
    let ctx = Ctx { files, spec };
    let mut out = vec![];
    for (i, r) in spec.rules.iter().enumerate() {
        let file = r.get("file").and_then(|v| v.as_str());
        let res = eval(r, &ctx, file);
        let (html, critical) = match rule_texts.get(i) {
            Some(t) if r.get("text").is_none() => (t.html.clone(), t.critical),
            _ => (
                r.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                r.get("critical").and_then(|v| v.as_bool()).unwrap_or(false),
            ),
        };
        out.push(RuleResult {
            index: i,
            html,
            critical,
            pass: res.is_ok(),
            message: res.err(),
            group: r.get("group").and_then(|v| v.as_str()).map(|s| s.to_string()),
        });
    }
    // score: weighted by group if weights are given
    let mut groups = vec![];
    let score = if spec.weights.is_empty() {
        let p = out.iter().filter(|r| r.pass).count() as f64;
        if out.is_empty() { 0.0 } else { p / out.len() as f64 * 100.0 }
    } else {
        let mut total_w = 0.0;
        let mut acc = 0.0;
        for (g, w) in &spec.weights {
            let rs: Vec<_> = out.iter().filter(|r| r.group.as_deref() == Some(g)).collect();
            if rs.is_empty() {
                continue;
            }
            let s = rs.iter().filter(|r| r.pass).count() as f64 / rs.len() as f64;
            groups.push(GroupScore { group: g.clone(), weight: *w, score: (s * 100.0).round() as u32 });
            acc += s * w;
            total_w += w;
        }
        if total_w > 0.0 { acc / total_w * 100.0 } else { 0.0 }
    };
    let critical_failed = out.iter().any(|r| r.critical && !r.pass);
    let parse_error = out
        .iter()
        .filter_map(|r| r.message.clone())
        .find(|m| m.starts_with("Document "));
    LabResult {
        score: score.round() as u32,
        passed: score >= 80.0 && !critical_failed,
        critical_failed,
        rules: out,
        parse_error,
        groups,
    }
}
