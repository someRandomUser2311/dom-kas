export function stripTags(html = '') {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim();
}

export function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Minimal highlighter for YAML / HCL / Bicep / shell / Dockerfile. */
export function highlight(text = '', diff = false) {
  return text
    .split('\n')
    .map((line) => {
      let added = false;
      if (diff && line.startsWith('+')) { added = true; line = ' ' + line.slice(1); }
      let out;
      const m = line.match(/^(\s*)(#|\/\/)(.*)$/);
      if (m) {
        out = `${escapeHtml(m[1])}<span class="tok-c">${escapeHtml(m[2] + m[3])}</span>`;
      } else {
        const km = line.match(/^(\s*-?\s*)([A-Za-z_][\w.\/-]*)(\s*[:=])(.*)$/);
        if (km) {
          out = `${escapeHtml(km[1])}<span class="tok-k">${escapeHtml(km[2])}</span>${escapeHtml(km[3])}${strings(km[4])}`;
        } else {
          out = strings(line);
        }
      }
      return added ? `<span class="tok-add">${out}</span>` : out;
    })
    .join('\n');
}

function strings(s) {
  return escapeHtml(s).replace(/(&quot;[^&]*?&quot;|'[^']*')/g, '<span class="tok-s">$1</span>');
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export const PERSONA_SETS = {
  A: { label: 'Background', options: ['Windows/IIS admin', 'Linux admin', 'Developer (Docker Compose)', 'Other clouds (EKS/GKE)'] },
  B: { label: 'CI/CD tool', options: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'Classic pipelines'] },
  C: { label: 'Infra tooling', options: ['Portal/ARM', 'az CLI scripts', 'CloudFormation', 'Pulumi'] },
  TF: { label: 'Terraform', options: ['Coming from Terraform'] },
};
