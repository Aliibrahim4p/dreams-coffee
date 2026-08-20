import { getCurrentBusinessDate, getCountEntryLockDeadline, toBusinessDateFromInstant } from "@/lib/business-date";

describe("getCountEntryLockDeadline", () => {
  const originalTimezone = process.env.BUSINESS_TIMEZONE;

  afterEach(() => {
    process.env.BUSINESS_TIMEZONE = originalTimezone;
  });

  it("locks an Aug 2 entry at Aug 3 03:00 Beirut time (DST, UTC+3)", () => {
    delete process.env.BUSINESS_TIMEZONE;
    const entryDate = new Date(Date.UTC(2026, 7, 2));

    const deadline = getCountEntryLockDeadline(entryDate);

    expect(deadline.toISOString()).toBe("2026-08-03T00:00:00.000Z");
  });

  it("locks a Jan 15 entry at Jan 16 03:00 Beirut time (winter, UTC+2)", () => {
    delete process.env.BUSINESS_TIMEZONE;
    const entryDate = new Date(Date.UTC(2026, 0, 15));

    const deadline = getCountEntryLockDeadline(entryDate);

    expect(deadline.toISOString()).toBe("2026-01-16T01:00:00.000Z");
  });
});

describe("toBusinessDateFromInstant", () => {
  it("matches getCurrentBusinessDate's convention for the current moment", () => {
    delete process.env.BUSINESS_TIMEZONE;
    const now = new Date();
    expect(toBusinessDateFromInstant(now)).toEqual(getCurrentBusinessDate());
  });

  it("anchors a naive local timestamp to the business timezone, not the server's local time", () => {
    delete process.env.BUSINESS_TIMEZONE;
    // 2026-08-01T23:30 UTC is still 2026-08-02 in Beirut (UTC+3)
    const result = toBusinessDateFromInstant(new Date("2026-08-01T23:30:00.000Z"));
    expect(result.toISOString()).toBe("2026-08-02T00:00:00.000Z");
  });
});

describe("getCurrentBusinessDate", () => {
  const originalTimezone = process.env.BUSINESS_TIMEZONE;

  afterEach(() => {
    jest.useRealTimers();
    process.env.BUSINESS_TIMEZONE = originalTimezone;
  });

  it("defaults to Asia/Beirut when BUSINESS_TIMEZONE is not set", () => {
    delete process.env.BUSINESS_TIMEZONE;
    jest.useFakeTimers().setSystemTime(new Date("2026-01-15T22:00:00.000Z"));

    const result = getCurrentBusinessDate();

    expect(result.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("uses BUSINESS_TIMEZONE when set, e.g. a timezone behind UTC", () => {
    process.env.BUSINESS_TIMEZONE = "America/New_York";
    jest.useFakeTimers().setSystemTime(new Date("2026-03-10T02:00:00.000Z"));

    const result = getCurrentBusinessDate();

    expect(result.toISOString()).toBe("2026-03-09T00:00:00.000Z");
  });

  it("matches the UTC date when well within the configured day", () => {
    delete process.env.BUSINESS_TIMEZONE;
    jest.useFakeTimers().setSystemTime(new Date("2026-03-10T10:00:00.000Z"));

    const result = getCurrentBusinessDate();

    expect(result.toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });
});
