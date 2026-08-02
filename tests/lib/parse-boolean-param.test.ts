import { parseBooleanParam } from "@/lib/parse-boolean-param";

describe("parseBooleanParam", () => {
  it('returns true for "true"', () => {
    expect(parseBooleanParam("true")).toBe(true);
  });

  it("returns false for null (param absent)", () => {
    expect(parseBooleanParam(null)).toBe(false);
  });

  it('returns false for "false"', () => {
    expect(parseBooleanParam("false")).toBe(false);
  });

  it("returns false for any other value", () => {
    expect(parseBooleanParam("1")).toBe(false);
    expect(parseBooleanParam("")).toBe(false);
  });
});
