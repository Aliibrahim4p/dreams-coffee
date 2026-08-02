import UnauthorizedException from "@/exceptions/unauthorized-exception";
import { getManagerId } from "@/lib/get-manager-id";

function makeRequest(headers: Record<string, string>) {
  return new Request("http://localhost/api/example", { headers });
}

describe("getManagerId", () => {
  it("returns the parsed manager id when present", () => {
    expect(getManagerId(makeRequest({ "x-manager-id": "7" }))).toBe(7);
  });

  it("throws UnauthorizedException when the header is missing", () => {
    expect(() => getManagerId(makeRequest({}))).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the header is not a valid integer", () => {
    expect(() => getManagerId(makeRequest({ "x-manager-id": "abc" }))).toThrow(
      UnauthorizedException,
    );
  });
});
