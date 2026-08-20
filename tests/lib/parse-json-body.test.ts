import { NextRequest } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";

function makeRequest(body: string) {
  return new NextRequest("http://localhost/api/whatever", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });
}

describe("parseJsonBody", () => {
  it("returns the parsed data for valid JSON", async () => {
    const result = await parseJsonBody(makeRequest(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ success: true, data: { a: 1 } });
  });

  it("returns a 400 response for an empty body", async () => {
    const result = await parseJsonBody(makeRequest(""));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({ error: "Invalid JSON body" });
    }
  });

  it("returns a 400 response for malformed JSON", async () => {
    const result = await parseJsonBody(makeRequest("{not valid json"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });
});
