import { describe, expect, test } from "bun:test";
import { linkLabelFor, parseInline, parseRichText, plainPreview, safeHref } from "./rich-text";

describe("safeHref", () => {
  test("allows http, https and mailto", () => {
    expect(safeHref("https://a.com/x")).toBe("https://a.com/x");
    expect(safeHref("http://a.com")).toBe("http://a.com/");
    expect(safeHref("mailto:x@princeton.edu")).toBe("mailto:x@princeton.edu");
  });
  test("rejects other schemes and junk", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
  });
});

describe("parseInline", () => {
  test("html-to-text bracketed URL becomes a host-labelled link", () => {
    const out = parseInline("Use Agreement [https://cglink.me/2gi/s54144]. Save time");
    expect(out).toEqual([
      { type: "text", text: "Use Agreement " },
      { type: "link", href: "https://cglink.me/2gi/s54144", label: "cglink.me ↗", external: true },
      { type: "text", text: ". Save time" },
    ]);
  });

  test("markdown link keeps its text", () => {
    const out = parseInline("RSVP [here](https://forms.gle/abc) now");
    expect(out[1]).toEqual({
      type: "link",
      href: "https://forms.gle/abc",
      label: "here",
      external: true,
    });
  });

  test("bare URL is linkified without trailing punctuation", () => {
    const out = parseInline("See https://tigerapps.org/about, then reply.");
    expect(out).toEqual([
      { type: "text", text: "See " },
      {
        type: "link",
        href: "https://tigerapps.org/about",
        label: "https://tigerapps.org/about",
        external: true,
      },
      { type: "text", text: ", then reply." },
    ]);
  });

  test("unsafe markdown link degrades to text", () => {
    // Not matched as a link token at all (scheme isn't http/https/mailto).
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { type: "text", text: "[x](javascript:alert(1))" },
    ]);
  });

  test("mailto in brackets is labelled with the address", () => {
    const out = parseInline("Email [mailto:it.admin@tigerapps.org]");
    expect(out[1]).toMatchObject({
      type: "link",
      label: "it.admin@tigerapps.org",
      external: false,
    });
  });
});

describe("parseRichText", () => {
  test("paragraphs, line breaks and lists", () => {
    const blocks = parseRichText("Hello\nworld\n\n* one\n- two\nafter");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      lines: [[{ type: "text", text: "Hello" }], [{ type: "text", text: "world" }]],
    });
    expect(blocks[1]).toEqual({
      type: "list",
      items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]],
    });
    expect(blocks[2]).toEqual({ type: "paragraph", lines: [[{ type: "text", text: "after" }]] });
  });

  test("empty input", () => {
    expect(parseRichText("")).toEqual([]);
    expect(parseRichText(null)).toEqual([]);
  });
});

describe("plainPreview", () => {
  test("strips bracketed URLs and keeps markdown labels", () => {
    expect(
      plainPreview("Sign [https://x.com/a]. Or [the form](https://y.com). Go https://z.com"),
    ).toBe("Sign. Or the form. Go");
  });
});

describe("linkLabelFor", () => {
  test("drops www", () => {
    expect(linkLabelFor("https://www.princeton.edu/x")).toBe("princeton.edu ↗");
  });
});
