import BadRequestException from "@/exceptions/bad-request-exception";
import { parseDateParam } from "@/lib/parse-date-param";

describe("parseDateParam", () => {
  it("parses a valid date string", () => {
    const result = parseDateParam("2026-07-31", "entry_date");
    expect(result).toEqual(new Date("2026-07-31"));
  });

  it("throws BadRequestException for an invalid date string", () => {
    expect(() => parseDateParam("not-a-date", "entry_date")).toThrow(BadRequestException);
  });

  it("anchors a naive timestamp to the business timezone, not the server's local time", () => {
    // 2026-08-01T23:30 UTC is already 2026-08-02 in Beirut (UTC+3) — a raw `new Date()`
    // would keep it on Aug 1 if the server isn't running in UTC/Beirut.
    const result = parseDateParam("2026-08-01T23:30:00.000Z", "entry_date");
    expect(result.toISOString()).toBe("2026-08-02T00:00:00.000Z");
  });

  it("includes the label in the error message", () => {
    expect(() => parseDateParam("not-a-date", "entry_date")).toThrow("Invalid entry_date");
  });
});
