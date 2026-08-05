const DEFAULT_BUSINESS_TIMEZONE = "Asia/Beirut";
/** Count entries lock this many hours after midnight of the following business day. */
const COUNT_ENTRY_LOCK_HOUR = 3;

function businessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE ?? DEFAULT_BUSINESS_TIMEZONE;
}

/** Calendar date (Y-M-D) of `instant` in the business timezone, as a UTC-midnight Date for @db.Date columns. */
function toBusinessDate(instant: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return new Date(
    Date.UTC(Number(lookup.year), Number(lookup.month) - 1, Number(lookup.day)),
  );
}

/** Today's calendar date in the configured timezone (BUSINESS_TIMEZONE env var, defaults to Asia/Beirut), as a UTC-midnight Date for @db.Date columns. */
export function getCurrentBusinessDate(): Date {
  return toBusinessDate(new Date());
}

/** Same calendar-date resolution as `getCurrentBusinessDate`, but for an arbitrary instant instead of now. */
export function toBusinessDateFromInstant(instant: Date): Date {
  return toBusinessDate(instant);
}

/** The business timezone's UTC offset, in minutes, at `instant` — handles DST. */
function businessTimezoneOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimezone(),
    timeZoneName: "shortOffset",
  }).formatToParts(instant);

  const offsetName =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetName.match(/GMT([+-]\d+)/);
  return match ? Number(match[1]) * 60 : 0;
}

/**
 * Current instant, shifted so its UTC fields read as business-timezone wall-clock
 * time (handles DST via businessTimezoneOffsetMinutes) — for full DateTime columns
 * (e.g. synced_at) stored as `timestamp without time zone`, which persist whatever
 * calendar digits they're given with no zone conversion of their own. Not a true UTC
 * instant: don't use this for elapsed-time math, only for storing/displaying local time.
 * getCurrentBusinessDate is the date-only (midnight) counterpart for @db.Date columns.
 */
export function getCurrentBusinessDateTime(): Date {
  const now = new Date();
  const offsetMinutes = businessTimezoneOffsetMinutes(now);
  return new Date(now.getTime() + offsetMinutes * 60 * 1000);
}

/**
 * Deadline for editing a count entry submitted for `entryDate`: 03:00 business-time
 * the following calendar day (e.g. an Aug 2 entry locks Aug 3 03:00 Beirut time).
 */
export function getCountEntryLockDeadline(entryDate: Date): Date {
  const nextDay = new Date(entryDate.getTime() + 24 * 60 * 60 * 1000);
  const roughUtc = Date.UTC(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth(),
    nextDay.getUTCDate(),
    COUNT_ENTRY_LOCK_HOUR,
  );
  const offsetMinutes = businessTimezoneOffsetMinutes(new Date(roughUtc));
  return new Date(roughUtc - offsetMinutes * 60 * 1000);
}
