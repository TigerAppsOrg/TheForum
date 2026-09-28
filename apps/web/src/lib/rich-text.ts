/**
 * Tiny, safe parser for the plain text we get from imported events, org
 * descriptions and listserv emails (html-to-text output). Produces a tree the
 * `RichText` component renders with React elements — never raw HTML.
 *
 * Supported:
 *   - paragraphs (blank-line separated) and single line breaks
 *   - list items: lines starting with "* " or "- "
 *   - "[https://…]"            → link labelled "host ↗" (html-to-text's style)
 *   - "[text](https://…)"      → link labelled "text"
 *   - bare http(s) URLs         → link
 * Only http:, https: and mailto: hrefs are ever produced.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "link"; href: string; label: string; external: boolean };

export type Block = { type: "paragraph"; lines: Inline[][] } | { type: "list"; items: Inline[][] };

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Returns a normalized href if it's an allowed http/https/mailto URL, else null. */
export function safeHref(raw: string): string | null {
  const candidate = raw.trim();
  try {
    const url = new URL(candidate);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    if (url.protocol !== "mailto:" && !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** "https://www.cglink.me/2gi/s54144" → "cglink.me ↗"; mailto → the address. */
export function linkLabelFor(href: string): string {
  try {
    const url = new URL(href);
    if (url.protocol === "mailto:") return decodeURIComponent(url.pathname);
    return `${url.hostname.replace(/^www\./, "")} ↗`;
  } catch {
    return href;
  }
}

// Order matters: markdown links, then bracketed URLs, then angle-bracketed and bare URLs.
const TOKEN =
  /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|\[((?:https?:\/\/|mailto:)[^\]\s]+)\]|<((?:https?:\/\/|mailto:)[^\s>]+)>|(https?:\/\/[^\s<>()[\]"']+)/g;

/** Trailing punctuation that belongs to the sentence, not the URL. */
function splitTrailing(url: string): [string, string] {
  const m = url.match(/[.,;:!?]+$/);
  if (!m) return [url, ""];
  return [url.slice(0, -m[0].length), m[0]];
}

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev?.type === "text") prev.text += text;
    else out.push({ type: "text", text });
  };

  for (const match of line.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    pushText(line.slice(last, index));
    last = index + match[0].length;

    const [, mdText, mdHref, bracketHref, angleHref, bare] = match;
    if (mdText && mdHref) {
      const href = safeHref(mdHref);
      if (href)
        out.push({
          type: "link",
          href,
          label: mdText.trim(),
          external: !href.startsWith("mailto:"),
        });
      else pushText(mdText);
    } else if (bracketHref || angleHref) {
      const href = safeHref((bracketHref ?? angleHref) as string);
      if (href)
        out.push({
          type: "link",
          href,
          label: linkLabelFor(href),
          external: !href.startsWith("mailto:"),
        });
      else pushText(match[0]);
    } else if (bare) {
      const [urlPart, trailing] = splitTrailing(bare);
      const href = safeHref(urlPart);
      if (href) {
        out.push({ type: "link", href, label: urlPart, external: true });
        pushText(trailing);
      } else {
        pushText(bare);
      }
    }
  }
  pushText(line.slice(last));
  return out;
}

const LIST_ITEM = /^\s*[*-]\s+(.*)$/;

export function parseRichText(input: string | null | undefined): Block[] {
  if (!input) return [];
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  const blocks: Block[] = [];
  for (const chunk of text.split(/\n\s*\n+/)) {
    const lines = chunk.split("\n");
    let paragraph: Inline[][] = [];
    let list: Inline[][] = [];

    const flushParagraph = () => {
      if (paragraph.length > 0) blocks.push({ type: "paragraph", lines: paragraph });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length > 0) blocks.push({ type: "list", items: list });
      list = [];
    };

    for (const raw of lines) {
      const item = raw.match(LIST_ITEM);
      if (item) {
        flushParagraph();
        list.push(parseInline((item[1] ?? "").trim()));
      } else if (raw.trim()) {
        flushList();
        paragraph.push(parseInline(raw.trim()));
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}

/**
 * Plain one-paragraph preview for clamped card text: link markup is reduced
 * to its label (markdown) or dropped (bare/bracketed URLs) so URLs don't eat
 * the visible lines.
 */
export function plainPreview(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|mailto:)[^\s)]+\)/g, "$1")
    .replace(/\[(?:https?:\/\/|mailto:)[^\]\s]+\]/g, " ")
    .replace(/<?https?:\/\/[^\s>)\]]+>?/g, " ")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}
