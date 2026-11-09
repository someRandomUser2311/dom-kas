// Hash router: #/lesson/ch02/2.1-pods/s3 → { name: 'lesson', params: [...] }

function parse() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const parts = h.split('/').filter(Boolean);
  return { name: parts[0] || 'home', params: parts.slice(1), path: '/' + parts.join('/') };
}

export const route = $state(parse());

window.addEventListener('hashchange', () => {
  const r = parse();
  route.name = r.name;
  route.params = r.params;
  route.path = r.path;
});

export function go(path) {
  location.hash = '#' + path;
}
