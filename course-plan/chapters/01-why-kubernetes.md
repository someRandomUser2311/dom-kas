# Chapter 1 · Why Kubernetes: containers, the cluster & kubectl

**Part:** Kubernetes foundations · **Lessons:** 6 · **Time:** ~1.5 h · **Persona tabs:** A · Background

## By the end, learners can
- Explain what a container image is and why it's portable.
- Describe what an orchestrator does that `docker run` doesn't.
- Name the control-plane and node components and what each one does.
- Explain desired state and the reconciliation loop.
- Use `kubectl` to read, apply and inspect resources, and switch contexts.

## Lessons

### 1.1 Containers in 10 minutes (~10 steps)
- **Teaches:**
  - Image vs container, layers, registry, tags vs digests.
  - A minimal `Dockerfile` for `orders-api`.
- **Interactive:** a layer-stack widget. Change one line and see which layers rebuild.
- **Checks:**
  - fill: `FROM` / `COPY` / `CMD`.
  - mcq: why a digest is safer than `:latest`.
  - tapline: the line that breaks layer caching.

### 1.2 Why orchestration? (~10 steps)
- **Teaches:** what breaks with one host:
  - restarts
  - scaling
  - rolling updates
  - service discovery
  - bin-packing
- **Interactive:** a "one VM" widget. Kill the container or add load, and see what nobody handles.
- **Checks:** mcq scenarios ("the VM reboots at 3 am: what restarts your app?"); match problem ↔ Kubernetes feature.

### 1.3 The cluster: control plane & nodes (~12 steps)
- **Teaches:**
  - `kube-apiserver`, `etcd`, scheduler, controller manager, cloud-controller-manager.
  - On each node: kubelet, kube-proxy, container runtime (containerd).
- **Interactive:** a clickable cluster diagram that highlights each component's job. Then "follow a `kubectl apply`" animation: API server → etcd → scheduler → kubelet.
- **Checks:**
  - order: the steps from `apply` to a running container.
  - mcq: what happens if the scheduler is down (existing pods keep running).
- **Sets up Chapter 4:** "In AKS, Azure runs the top half of this diagram for you."

### 1.4 Desired state & reconciliation (~10 steps)
- **Teaches:**
  - Declarative vs imperative.
  - spec vs status.
  - Controllers loop forever, comparing the two.
- **Interactive:** a reconcile widget. Set replicas to 3, delete a pod, and watch the controller fix it.
- **Checks:**
  - mcq: `kubectl delete pod` on a Deployment's pod. What happens?
  - tapline: in a manifest, the field you own (spec) vs the one Kubernetes writes (status).

### 1.5 kubectl essentials (~12 steps)
- **Teaches:**
  - `get`, `describe`, `apply -f`, `delete`, `logs`, `exec`.
  - `-o yaml` / `-o wide`, `-n`, `--all-namespaces`.
  - `explain`.
- **Checks (command):**
  - "list pods in namespace orders with node names" → `kubectl get pods -n orders -o wide`
  - "show the last 50 log lines of pod X"
- **Interactive:** a scripted terminal walkthrough.

### 1.6 kubeconfig & contexts (~9 steps)
- **Teaches:**
  - clusters / users / contexts.
  - `kubectl config get-contexts`, `use-context`.
  - Why "wrong context" is the classic production accident.
- **Checks:**
  - tapline in a kubeconfig.
  - command: switch context.
  - mcq: safest habit (prompt shows context; separate kubeconfigs).

## Practice
- **Quiz (8):**
  - components
  - reconciliation
  - kubectl flags
  - image tags vs digests
- **Predict (3):**
  - delete a pod
  - the scheduler is down
  - a node dies
- **Write lab:** write a `Dockerfile` for `orders-api`. Rules:
  - pinned base image
  - non-root `USER`
  - `EXPOSE`
  - no secrets in `ENV`
  - multi-stage build
- **Critical rules (⛔):** no secrets in `ENV`/`ARG`; the final stage runs as a non-root `USER`.
- **Walkthrough:** `kubectl` tour of a running cluster.

## Try it locally
Optional boxes on the local `kind` lab (see [formats.md → Try it locally](../formats.md#try-it-locally-boxes)):
- 1.1 Build the `orders-api` image, run it with Docker, push it to the local registry (`localhost:5001`).
- 1.3 `kubectl get pods -n kube-system`: in kind you can *see* the control-plane pods (on AKS Azure hides them).
- 1.4 Delete a Deployment's pod and watch it come back with `kubectl get pods -w`.
- 1.5 The lesson's `get` / `describe` / `logs` / `exec` commands against the lab.
- 1.6 `kubectl config get-contexts`: the lab context `kind-kq`.

## Misconceptions to target
- "Kubernetes runs containers." (The kubelet asks a runtime to run them.)
- "Deleting a pod deletes the app."
- "`latest` means the newest version." (It's just a tag name; nothing guarantees it's the newest.)

## Accuracy notes
- Docker Engine/dockershim removal history: mention briefly only. Use containerd as the runtime in all diagrams.
