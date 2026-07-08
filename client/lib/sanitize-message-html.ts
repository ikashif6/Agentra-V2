const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "a",
  "br",
  "p",
  "div",
  "img",
  "video",
  "span",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "class"]),
  img: new Set(["src", "alt", "class", "width", "height", "data-emoji"]),
  video: new Set(["src", "controls", "class"]),
  span: new Set(["class"]),
  p: new Set(["class"]),
  div: new Set(["class"]),
};

export function sanitizeMessageHtml(html: string): string {
  if (typeof window === "undefined" || !html.trim()) return "";

  const doc = new DOMParser().parseFromString(html, "text/html");

  const clean = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (!ALLOWED_TAGS.has(tag)) {
          while (el.firstChild) {
            el.parentNode?.insertBefore(el.firstChild, el);
          }
          el.remove();
          continue;
        }

        for (const attr of Array.from(el.attributes)) {
          const allowed = ALLOWED_ATTRS[tag];
          if (!allowed?.has(attr.name.toLowerCase())) {
            el.removeAttribute(attr.name);
          }
        }

        if (tag === "a") {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
      }

      clean(child);
    }
  };

  clean(doc.body);
  return doc.body.innerHTML;
}

export function messageHtmlToPlain(html: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

export function editorHasContent(html: string): boolean {
  if (messageHtmlToPlain(html)) return true;
  if (typeof window === "undefined") return !!html.trim();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Boolean(doc.body.querySelector("img, a, video"));
}

export function isMessageHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}
