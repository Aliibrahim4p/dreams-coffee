import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { getSessionId } from "@/lib/get-session-id";

function makeRequest(headers: Record<string, string>) {
  return new Request("http://localhost/api/example", { headers });
}

describe("getSessionId", () => {
  it("returns the session id when present", () => {
    expect(getSessionId(makeRequest({ "x-session-id": "session-1" }))).toBe("session-1");
  });

  it("throws UnauthorizedException when the header is missing", () => {
    expect(() => getSessionId(makeRequest({}))).toThrow(UnauthorizedException);
  });
});
