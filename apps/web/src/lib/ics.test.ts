import { describe, expect, test } from "bun:test";
import {
  buildIcsCalendar,
  escapeIcsText,
  eventEndOrDefault,
  eventLocationText,
  foldIcsLine,
  formatIcsDate,
} from "./ics";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const START = new Date("2026-09-29T20:30:00.000Z"); // 4:30 PM EDT

describe("formatIcsDate", () => {
  test("UTC basic format with Z", () => {
    expect(formatIcsDate(START)).toBe("20260929T203000Z");
  });
});

describe("escapeIcsText", () => {
  test("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldIcsLine", () => {
  test("short lines are untouched", () => {
    expect(foldIcsLine("SUMMARY:Hi")).toBe("SUMMARY:Hi");
  });

  test("folds at 75 octets with CRLF + space", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldIcsLine(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    for (const [i, l] of physical.entries()) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
      if (i > 0) expect(l.startsWith(" ")).toBe(true);
    }
    expect(physical.map((l, i) => (i === 0 ? l : l.slice(1))).join("")).toBe(line);
  });

  test("never splits a multi-byte character", () => {
    const line = `SUMMARY:${"é🎉".repeat(40)}`;
    const unfolded = foldIcsLine(line)
      .split("\r\n")
      .map((l, i) => (i === 0 ? l : l.slice(1)))
      .join("");
    expect(unfolded).toBe(line);
    for (const l of foldIcsLine(line).split("\r\n")) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("helpers", () => {
  test("location joins venue and room", () => {
    expect(eventLocationText("Frist Campus Center", "Room 207")).toBe(
      "Frist Campus Center, Room 207",
    );
    expect(eventLocationText("Frist", null)).toBe("Frist");
    expect(eventLocationText(null, null)).toBe("");
  });
  test("end defaults to +1h", () => {
    expect(eventEndOrDefault(START, null).toISOString()).toBe("2026-09-29T21:30:00.000Z");
    expect(eventEndOrDefault(START, START).toISOString()).toBe("2026-09-29T21:30:00.000Z");
  });
});

describe("buildIcsCalendar", () => {
  const ics = buildIcsCalendar({
    name: "Going, Forum",
    now: NOW,
    events: [
      {
        id: "11ba7ebb-dd4b-451d-b53b-391c932afe53",
        title: "Mini-CTF; snacks, prizes",
        start: START,
        location: "Frist Campus Center",
        locationDetail: "Room 207",
        description: "Line one\nLine two",
        url: "https://forum.tigerapps.org/events/11ba7ebb-dd4b-451d-b53b-391c932afe53",
      },
    ],
  });
  const lines = ics.split("\r\n");

  test("CRLF throughout and a trailing CRLF", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  test("calendar header", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("PRODID:-//TigerApps//The Forum//EN");
    expect(lines).toContain("X-WR-CALNAME:Going\\, Forum");
    expect(lines).toContain("X-WR-TIMEZONE:America/New_York");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
  });

  test("event fields", () => {
    expect(lines).toContain("UID:11ba7ebb-dd4b-451d-b53b-391c932afe53@forum.tigerapps.org");
    expect(lines).toContain("DTSTAMP:20260928T120000Z");
    expect(lines).toContain("DTSTART:20260929T203000Z");
    expect(lines).toContain("DTEND:20260929T213000Z");
    expect(lines).toContain("SUMMARY:Mini-CTF\\; snacks\\, prizes");
    expect(lines).toContain("LOCATION:Frist Campus Center\\, Room 207");
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(
      "URL:https://forum.tigerapps.org/events/11ba7ebb-dd4b-451d-b53b-391c932afe53",
    );
    expect(unfolded).toContain("DESCRIPTION:Line one\\nLine two\\n\\nhttps://forum.tigerapps.org/");
  });

  test("every physical line is at most 75 octets", () => {
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});
