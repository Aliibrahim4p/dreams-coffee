jest.mock("@/lib/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/services/sync-service");

import { NextRequest } from "next/server";
import { SyncService } from "@/services/sync-service";
import { POST } from "@/app/api/sync/records/route";

const MockedService = SyncService as jest.Mocked<typeof SyncService>;

const validRecord = {
  order_id: "order-1",
  session_id: "session-1",
  total_due: 5000,
  created_at: "2026-08-01T10:00:00Z",
  line_items: [{ product_id: 1, quantity: 1, unit_price: 5000 }],
};

function makeRequest(body: unknown, managerId: string | null = "1") {
  return new NextRequest("http://localhost/api/sync/records", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(managerId !== null ? { "x-manager-id": managerId } : {}),
    },
  });
}

describe("POST /api/sync/records", () => {
  it("returns 200 with per-record sync results", async () => {
    MockedService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "synced", synced_at: new Date("2026-08-01T10:01:00Z") },
    ]);

    const res = await POST(makeRequest({ records: [validRecord] }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([
      { order_id: "order-1", sync_status: "synced", synced_at: "2026-08-01T10:01:00.000Z" },
    ]);
    expect(MockedService.syncOrderRecords).toHaveBeenCalledWith([expect.objectContaining({ order_id: "order-1" })]);
  });

  it("returns 200 even when some records fail to sync (per-record, not batch-level, failure)", async () => {
    MockedService.syncOrderRecords.mockResolvedValue([
      { order_id: "order-1", sync_status: "failed", synced_at: null },
    ]);

    const res = await POST(makeRequest({ records: [validRecord] }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0].sync_status).toBe("failed");
  });

  it("returns 400 when records is empty", async () => {
    const res = await POST(makeRequest({ records: [] }));
    expect(res.status).toBe(400);
    expect(MockedService.syncOrderRecords).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/sync/records", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json", "x-manager-id": "1" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedService.syncOrderRecords).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedService.syncOrderRecords.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest({ records: [validRecord] }));

    expect(res.status).toBe(500);
  });
});
