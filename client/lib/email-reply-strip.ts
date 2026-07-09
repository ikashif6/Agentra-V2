const REPLY_MARKERS = [
  /\s+on\s+(?:\w{3},\s*)?.{0,240}?\bwrote:\s*[\s\S]*/i,
  /\s*-{2,}\s*original message\s*-{2,}[\s\S]*/i,
  /\s*_{5,}[\s\S]*/,
  /\s*from:\s.+\r?\n(?:sent|date):\s[\s\S]*/i,
];

export function stripQuotedPlainText(text: string) {
  let out = String(text || "");
  for (const pattern of REPLY_MARKERS) {
    out = out.replace(pattern, "");
  }

  const lines = out.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^>+/.test(line.trim())) break;
    kept.push(line);
  }

  return kept.join("\n").trim();
}

function trimTrailingEmptyNodes(root: HTMLElement) {
  while (root.lastChild) {
    const last = root.lastChild;
    if (last.nodeType === Node.TEXT_NODE && !(last.textContent ?? "").trim()) {
      last.remove();
      continue;
    }
    if (last.nodeType === Node.ELEMENT_NODE) {
      const el = last as HTMLElement;
      if (el.tagName.toLowerCase() === "br" || !(el.textContent ?? "").trim()) {
        el.remove();
        continue;
      }
    }
    break;
  }
}

function removeFollowingSiblings(node: Node, root: HTMLElement) {
  let current: Node | null = node;
  while (current && current !== root) {
    let sibling = current.nextSibling;
    while (sibling) {
      const toRemove = sibling;
      sibling = sibling.nextSibling;
      toRemove.parentNode?.removeChild(toRemove);
    }
    current = current.parentNode;
  }
}

export function stripQuotedReplyHtml(root: HTMLElement) {
  root
    .querySelectorAll('blockquote, .gmail_quote, .gmail_extra, .yahoo_quoted, [id="appendonsend"]')
    .forEach((node) => node.remove());

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current: Node | null;
  while ((current = walker.nextNode())) {
    textNodes.push(current as Text);
  }

  const fullText = textNodes.map((node) => node.textContent ?? "").join("");
  let cutAt = -1;
  for (const pattern of REPLY_MARKERS) {
    const match = fullText.match(pattern);
    if (match && match.index != null && (cutAt === -1 || match.index < cutAt)) {
      cutAt = match.index;
    }
  }

  if (cutAt < 0) {
    trimTrailingEmptyNodes(root);
    return;
  }

  let pos = 0;
  for (const textNode of textNodes) {
    const value = textNode.textContent ?? "";
    const len = value.length;
    if (pos + len > cutAt) {
      textNode.textContent = value.slice(0, cutAt - pos).trimEnd();
      removeFollowingSiblings(textNode, root);
      break;
    }
    pos += len;
  }

  trimTrailingEmptyNodes(root);
}
