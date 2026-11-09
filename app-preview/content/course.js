/* Course manifest: the 18 chapters from course-plan/README.md.
   `built: true` chapters link to their overview page; the rest show as planned. */
window.COURSE = {
  parts: ["Getting started", "Kubernetes foundations", "Azure Kubernetes Service", "DevOps", "Infrastructure as code", "Operate & secure", "Capstone"],
  chapters: [
    { num: 0, part: "Getting started", title: "Ready check: placement & refreshers", lessons: "6 lessons + placement quiz", optional: true },
    { num: 1, part: "Kubernetes foundations", title: "Why Kubernetes: containers, the cluster & kubectl", lessons: "6 lessons" },
    { num: 2, part: "Kubernetes foundations", title: "Core objects: Pods, Deployments, Services, config", lessons: "7 lessons" },
    { num: 3, part: "Kubernetes foundations", title: "Scheduling, storage, probes & autoscaling", lessons: "6 lessons" },
    { num: 4, part: "Azure Kubernetes Service", title: "AKS: what Azure manages vs what you control", lessons: "6 lessons" },
    { num: 5, part: "Azure Kubernetes Service", title: "AKS networking & identity", lessons: "7 lessons" },
    { num: 6, part: "Azure Kubernetes Service", title: "ACR & deploying to AKS: public vs private clusters", lessons: "6 lessons" },
    { num: 7, part: "DevOps", title: "Azure Pipelines: CI/CD to AKS", lessons: "6 lessons · quiz · 2 labs", built: true, href: "chapter.html" },
    { num: 8, part: "DevOps", title: "Namespaces, Ingress & the Gateway API", lessons: "6 lessons" },
    { num: 9, part: "DevOps", title: "Network policies: default-deny & zero trust", lessons: "5 lessons" },
    { num: 10, part: "DevOps", title: "Helm & Kustomize in pipelines", lessons: "6 lessons" },
    { num: 11, part: "DevOps", title: "Release strategies: rolling, blue/green, canary", lessons: "5 lessons" },
    { num: 12, part: "Infrastructure as code", title: "Infrastructure as code with Terraform", lessons: "8 lessons" },
    { num: 13, part: "Infrastructure as code", title: "Infrastructure as code with Bicep", lessons: "8 lessons" },
    { num: 14, part: "Operate & secure", title: "Observability & troubleshooting", lessons: "6 lessons" },
    { num: 15, part: "Operate & secure", title: "Cluster & pipeline security", lessons: "7 lessons" },
    { num: 16, part: "Operate & secure", title: "Supply chain: scanning, signing & policy-as-code", lessons: "5 lessons" },
    { num: 17, part: "Capstone", title: "Capstone: ship a production-grade app to AKS", lessons: "4 lessons + project" },
  ],
};
