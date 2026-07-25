// Same Sky — safe rendering utilities.
// `html` is a tagged template that HTML-escapes every interpolated value by
// default; nested html`` fragments (Raw) pass through untouched. `render`
// parses with DOMParser (scripts stay inert) and swaps nodes in — no direct
// markup-string sinks anywhere in the app.

class Raw {
  constructor(s) { this.s = s; }
}

export const raw = s => new Raw(String(s));

export function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function toChunk(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(toChunk).join('');
  return escapeHTML(v);
}

export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += toChunk(v) + strings[i + 1]; });
  return new Raw(out);
}

const parser = new DOMParser();

export function render(el, fragment) {
  const markup = fragment instanceof Raw ? fragment.s : escapeHTML(fragment);
  const doc = parser.parseFromString(markup, 'text/html');
  el.replaceChildren(...doc.body.childNodes);
}

export function clear(el) {
  el.replaceChildren();
}
