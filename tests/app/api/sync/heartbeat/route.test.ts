import { GET } from "@/app/api/sync/heartbeat/route";

describe("GET /api/sync/heartbeat", () => {
  it("returns 200 with the server's current time", async () => {
    const before = Date.now();
    const res = await GET();
    const after = Date.now();

    expect(res.status).toBe(200);
    const json = await res.json();
    const serverTime = new Date(json.server_time).getTime();
    expect(serverTime).toBeGreaterThanOrEqual(before);
    expect(serverTime).toBeLessThanOrEqual(after);
  });
});
