/**
 * Dokument Tiptap (JSON) → bezpieczny HTML, bez ładowania edytora (np. strona akceptacji dla klienta).
 * Obsługuje tylko węzły i znaczniki, których używa ContentFlow; wszystko inne pomija. Tekst jest escapowany,
 * a linki dopuszczamy wyłącznie http(s).
 */
type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type?: string; text?: string; marks?: Mark[]; attrs?: Record<string, unknown>; content?: Node[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function text(n: Node) {
  let out = esc(n.text ?? "");
  for (const m of n.marks ?? []) {
    if (m.type === "bold") out = `<strong>${out}</strong>`;
    else if (m.type === "italic") out = `<em>${out}</em>`;
    else if (m.type === "strike") out = `<s>${out}</s>`;
    else if (m.type === "code") out = `<code>${out}</code>`;
    else if (m.type === "link") {
      const href = String(m.attrs?.href ?? "");
      if (/^https?:\/\//i.test(href)) out = `<a href="${esc(href)}" target="_blank" rel="noreferrer noopener">${out}</a>`;
    }
  }
  return out;
}

function render(n: Node): string {
  const inner = (n.content ?? []).map(render).join("");
  switch (n.type) {
    case "doc":
      return inner;
    case "text":
      return text(n);
    case "paragraph":
      return `<p>${inner || "<br>"}</p>`;
    case "heading": {
      const level = n.attrs?.level === 3 ? 3 : 2;
      return `<h${level}>${inner}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${inner}</ul>`;
    case "orderedList":
      return `<ol>${inner}</ol>`;
    case "listItem":
      return `<li>${inner}</li>`;
    case "taskList":
      return `<ul data-type="taskList">${inner}</ul>`;
    case "taskItem":
      return `<li data-checked="${n.attrs?.checked ? "true" : "false"}"><label><input type="checkbox" disabled${n.attrs?.checked ? " checked" : ""}></label><div>${inner}</div></li>`;
    case "blockquote":
      return `<blockquote>${inner}</blockquote>`;
    case "hardBreak":
      return "<br>";
    case "horizontalRule":
      return "<hr>";
    case "codeBlock":
      return `<pre><code>${inner}</code></pre>`;
    default:
      return inner;
  }
}

export const docToHtml = (doc: unknown) => (doc && typeof doc === "object" ? render(doc as Node) : "");
