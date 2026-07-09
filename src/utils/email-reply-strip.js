const REPLY_MARKERS = [
  /\s+on\s+(?:\w{3},\s*)?.{0,240}?\bwrote:\s*[\s\S]*/i,
  /\s*-{2,}\s*original message\s*-{2,}[\s\S]*/i,
  /\s*_{5,}[\s\S]*/,
  /\s*from:\s.+\r?\n(?:sent|date):\s[\s\S]*/i,
];

function stripQuotedPlainText(text) {
  let out = String(text || '');
  for (const pattern of REPLY_MARKERS) {
    out = out.replace(pattern, '');
  }

  const lines = out.split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    if (/^>+/.test(line.trim())) break;
    kept.push(line);
  }

  return kept.join('\n').trim();
}

function stripQuotedHtml(html) {
  let out = String(html || '');

  out = out.replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, '');
  out = out.replace(
    /<div[^>]*class=["'][^"']*(?:gmail_quote|gmail_extra|yahoo_quoted)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    '',
  );
  out = out.replace(/<div[^>]*id=["']appendonsend["'][^>]*>[\s\S]*$/gi, '');

  for (const pattern of REPLY_MARKERS) {
    out = out.replace(pattern, '');
  }

  out = out.replace(/<p[^>]*>\s*on\s+.{0,300}?\bwrote:\s*(?:<\/p>)?[\s\S]*/i, '');
  out = out.replace(
    /(?:<br\s*\/?>|<\/p>|<\/div>)\s*on\s+(?:\w{3},\s*)?.{0,240}?\bwrote:\s*[\s\S]*/i,
    '',
  );

  return out.trim();
}

function stripEmailQuotedReply(content, { isHtml = false } = {}) {
  if (!content) return content;
  return isHtml ? stripQuotedHtml(content) : stripQuotedPlainText(content);
}

module.exports = {
  stripEmailQuotedReply,
  stripQuotedHtml,
  stripQuotedPlainText,
};
