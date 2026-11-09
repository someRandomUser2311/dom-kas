/* Developer fixture: one step per check type, so the player can be tested without real lessons.
   Open lesson.html?l=dev/checks. Not linked from the course. */
window.LESSON = {
  id: "dev-checks", code: "DEV", short: "Check types", title: "Every check type, once",
  file: "deployment.yaml", reference: "chapter.html",
  next: { href: "index.html", title: "Home" },
  steps: [
    { title: "Select all that apply",
      body: "<p>A <b>multi</b> check: every right option must be picked, and no wrong one.</p>",
      coming: { set: "A",
        windows: "Think of a Pod as an app pool that IIS can recycle at any time, so don't store anything on it.",
        linux: "A Pod is like a systemd unit that can be rescheduled to another host.",
        dev: "A Pod is close to one service in <code>docker-compose.yml</code>, but it can hold several containers that share localhost.",
        clouds: "Same Kubernetes Pod as on EKS or GKE. Nothing Azure-specific yet." },
      check: { type: "multi", q: "Which of these are Kubernetes <b>workload</b> objects?",
        options: [
          { t: "Deployment", ok: true },
          { t: "StatefulSet", ok: true },
          { t: "Service", why: "A Service routes traffic to Pods; it doesn't run them." },
          { t: "DaemonSet", ok: true },
          { t: "ConfigMap", why: "A ConfigMap holds configuration; it doesn't run anything." },
        ],
        explain: "Deployments, StatefulSets and DaemonSets all create and manage Pods." } },

    { title: "Put the steps in order",
      body: "<p>An <b>order</b> check. Use ↑ and ↓ to move items.</p>",
      check: { type: "order", q: "What happens after <code>kubectl apply -f deployment.yaml</code>?",
        items: [
          "The API server validates the object and stores it in etcd",
          "The Deployment controller creates a ReplicaSet",
          "The ReplicaSet controller creates Pods",
          "The scheduler assigns each Pod to a node",
          "The kubelet on that node starts the containers",
        ],
        explain: "Every arrow in that chain is a controller watching the API server. Nothing talks to the nodes directly." } },

    { title: "Match them up",
      body: "<p>A <b>match</b> check: pick the right partner for each item.</p>",
      check: { type: "match", q: "Match each identity type to its typical use.",
        pairs: [
          ["User", "A person signing in to the portal"],
          ["Service principal", "An app registration used by an external tool"],
          ["System-assigned managed identity", "Lives and dies with one Azure resource"],
          ["User-assigned managed identity", "Shared by several resources, managed on its own"],
        ],
        explain: "Prefer managed identities wherever Azure supports them. There is no secret to rotate." } },

    { title: "Type the command",
      body: "<p>A <b>command</b> check. Flags can be in any order, and long or short forms both work.</p>",
      check: { type: "command", q: "List the nodes and show each node's <code>topology.kubernetes.io/zone</code> label as a column.",
        spec: { cmd: ["kubectl", "get"], args: ["nodes"], flags: { "-L": "topology.kubernetes.io/zone" }, optional: ["-o"],
          aliases: { "--label-columns": "-L", "node": "nodes", "no": "nodes" } },
        answer: "kubectl get nodes -L topology.kubernetes.io/zone",
        explain: "<code>-L</code> (<code>--label-columns</code>) adds a column per label key. Handy for checking zone spread." } },

    { title: "Write the file",
      body: "<p>A <b>write</b> check: each rule is graded separately, and ⛔ marks a critical rule.</p>",
      check: { type: "write", file: "deployment.yaml", q: "Give the container a memory limit and make it run as non-root.",
        start: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orders-api
  template:
    metadata:
      labels:
        app: orders-api
    spec:
      containers:
        - name: api
          image: contosoacr.azurecr.io/orders-api:1.4.2
`,
        rules: [
          { label: "The file still parses", test: (t, p) => !p.errors.length, hint: "Check indentation: spaces only, two per level." },
          { label: "Selector matches the Pod template labels", test: t => /matchLabels:\s*\n\s+app: orders-api/.test(t) && /labels:\s*\n\s+app: orders-api/.test(t) },
          { label: "<code>resources.limits.memory</code> is set", test: t => /limits:\s*\n(\s+\S.*\n)*?\s+memory:\s*\S+/.test(t), hint: "Under the container: <code>resources:</code> → <code>limits:</code> → <code>memory: 256Mi</code>." },
          { label: "<code>runAsNonRoot: true</code>", test: t => /runAsNonRoot:\s*true/.test(t), critical: true, hint: "Add <code>securityContext:</code> → <code>runAsNonRoot: true</code>." },
        ],
        explain: "A memory limit protects the node, and <code>runAsNonRoot</code> is part of the restricted Pod Security level." } },

    { summary: true, title: "All check types work",
      body: "multi, order, match, command and write, plus the existing mcq, tapline, fill and custom." },
  ],
};
