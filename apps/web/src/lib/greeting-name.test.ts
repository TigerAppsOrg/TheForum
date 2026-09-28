import { describe, expect, test } from "bun:test";
import { greetingName } from "./greeting-name";

describe("greetingName", () => {
  test("first word of a real display name", () => {
    expect(greetingName("Albert Einstein", "ae1234")).toBe("Albert");
    expect(greetingName("  Albert  ", "ae1234")).toBe("Albert");
  });

  test("no name when the display name is the NetID (any case) or empty", () => {
    expect(greetingName("ia1234", "ia1234")).toBeNull();
    expect(greetingName("IA1234", "ia1234")).toBeNull();
    expect(greetingName("", "ia1234")).toBeNull();
    expect(greetingName("   ", "ia1234")).toBeNull();
    expect(greetingName(null, "ia1234")).toBeNull();
    expect(greetingName(undefined, undefined)).toBeNull();
  });
});
