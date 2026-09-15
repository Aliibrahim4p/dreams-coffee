jest.mock("@/lib/r2", () => ({ __esModule: true, default: {}, R2_BUCKET: "test-bucket" }));
jest.mock("@/services/staging-service");

import { NextRequest } from "next/server";
import { StagingService } from "@/services/staging-service";
import { POST } from "@/app/api/sync/staging/route";

const MockedService = StagingService as jest.Mocked<typeof StagingService>;

const validRecord = {
  order_id: "order-1",
  session_id: "session-1",
  order_type: "dine_in",
  created_at: "2026-08-01T10:00:00Z",
  line_items: [
    { product_id: 1, unit_price: 5000 },
    { product_id: 1, unit_price: 5000 },
  ],
};

function makeRequest(body: unknown, managerId: string | null = "1") {
  return new NextRequest("http://localhost/api/sync/staging", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(managerId !== null ? { "x-manager-id": managerId } : {}),
    },
  });
}

describe("POST /api/sync/staging", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with per-record staging results", async () => {
    MockedService.stageRecords.mockResolvedValue([
      { order_id: "order-1", staged: true, key: "staging/order-1.json" },
    ]);

    const res = await POST(makeRequest({ records: [validRecord] }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([{ order_id: "order-1", staged: true, key: "staging/order-1.json" }]);
    expect(MockedService.stageRecords).toHaveBeenCalledWith([expect.objectContaining({ order_id: "order-1" })]);
  });

  it("returns 200 with a mixed batch — one bad record never blocks another", async () => {
    MockedService.stageRecords.mockResolvedValue([
      { order_id: "order-1", staged: true, key: "staging/order-1.json" },
      { order_id: "order-2", staged: false, code: "STAGING_STORAGE_UNAVAILABLE", message: "r2 down" },
    ]);

    const res = await POST(makeRequest({ records: [validRecord, { ...validRecord, order_id: "order-2" }] }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0].staged).toBe(true);
    expect(json.results[1]).toEqual({ order_id: "order-2", staged: false, code: "STAGING_STORAGE_UNAVAILABLE", message: "r2 down" });
  });

  it("returns 400 when records is empty", async () => {
    const res = await POST(makeRequest({ records: [] }));
    expect(res.status).toBe(400);
    expect(MockedService.stageRecords).not.toHaveBeenCalled();
  });

  it("returns 400 when a record's line_items is empty", async () => {
    const res = await POST(makeRequest({ records: [{ ...validRecord, line_items: [] }] }));
    expect(res.status).toBe(400);
    expect(MockedService.stageRecords).not.toHaveBeenCalled();
  });

  it("returns 400 when a line item is missing unit_price", async () => {
    const res = await POST(makeRequest({ records: [{ ...validRecord, line_items: [{ product_id: 1 }] }] }));
    expect(res.status).toBe(400);
    expect(MockedService.stageRecords).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body instead of crashing", async () => {
    const req = new NextRequest("http://localhost/api/sync/staging", {
      method: "POST",
      body: "not valid json",
      headers: { "content-type": "application/json", "x-manager-id": "1" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(MockedService.stageRecords).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected service error", async () => {
    MockedService.stageRecords.mockRejectedValue(new Error("bug"));

    const res = await POST(makeRequest({ records: [validRecord] }));

    expect(res.status).toBe(500);
  });
});
