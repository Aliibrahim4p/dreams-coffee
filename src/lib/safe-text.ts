// NFR-008: reject (never silently strip) input carrying HTML/script or SQL-injection
// metacharacters. Applied to the login fields — the only surface where arbitrary
// string input reaches the server before any auth check has run. Every other
// authenticated write requires a manager/admin token first, so it isn't in scope here.
const UNSAFE_CHARACTERS = /[<>;'"`]/;

export function hasUnsafeCharacters(value: string): boolean {
  return UNSAFE_CHARACTERS.test(value);
}
