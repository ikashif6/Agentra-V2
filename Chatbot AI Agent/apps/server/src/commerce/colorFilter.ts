/** Shared product search helpers */

export function parseColorFilters(color?: string | null): string[] {
  if (!color) return [];
  const known =
    /\b(ivory|white|champagne|black|blush|pearl|gold|silver|cream|beige|nude|red|navy|pink|blue|green|rose|taupe|mocha)\b/gi;
  const fromKnown = String(color).match(known)?.map((c) => c.toLowerCase()) || [];
  if (fromKnown.length) {
    return [...new Set(fromKnown)];
  }
  return String(color)
    .toLowerCase()
    .split(/[,|/]|(\s+or\s+)|(\s+and\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s && s !== "or" && s !== "and" && s.length > 1);
}

export function productMatchesAnyColor(
  product: {
    title?: string;
    colors?: string[];
    tags?: string[];
  },
  colorFilter?: string | null,
): boolean {
  const wants = parseColorFilters(colorFilter);
  if (!wants.length) return true;
  const pool = [
    ...(product.colors || []),
    ...(product.tags || []),
    product.title || "",
  ]
    .filter(Boolean)
    .map((c) => String(c).toLowerCase());
  return wants.some((want) => pool.some((c) => c.includes(want) || want.includes(c)));
}
