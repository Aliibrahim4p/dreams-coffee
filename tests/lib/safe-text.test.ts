import { hasUnsafeCharacters } from "@/lib/safe-text";

describe("hasUnsafeCharacters", () => {
  it("returns false for ordinary text", () => {
    expect(hasUnsafeCharacters("jdoe")).toBe(false);
  });

  it("flags an apostrophe — a legitimate name character (O'Brien) but also a SQL metacharacter", () => {
    expect(hasUnsafeCharacters("O'Brien")).toBe(true);
  });

  it.each([
    ["<script>alert(1)</script>", "<"],
    ["1 OR 1=1;", ";"],
    ["admin' --", "'"],
    ['"quoted"', '"'],
    ["`backticked`", "`"],
  ])("flags %s as unsafe", (value) => {
    expect(hasUnsafeCharacters(value)).toBe(true);
  });

  it("returns false for plain alphanumeric and common punctuation", () => {
    expect(hasUnsafeCharacters("jane.doe-99_ok")).toBe(false);
  });
});
